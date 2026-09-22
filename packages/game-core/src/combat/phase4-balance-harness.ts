import { ADVANCED_DISCIPLINES } from '../character/advanced-disciplines'
import {
  foundationDisciplineAttributePolicy,
  personalAttributePointPoolForLevel,
  type DisciplineAttributePolicy,
} from '../character/attribute-allocation'
import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '../character/creation'
import { calculateDerivedStats, type DerivedStatSnapshot } from '../character/derived-stats'
import { FOUNDATION_DISCIPLINES } from '../character/foundation-disciplines'
import type { CombatEffectDefinition } from './actions'
import { calculateScaledRawDamage, currentSkillDamageScaling } from './damage-scaling'
import { mitigateDamageByDefense } from './damage-mitigation'
import { resolveEssenceForBuild } from './essence'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillForContext,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from './mature-skills'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { P35_REPRESENTATIVE_RESONANCES } from './resonance'

export const PHASE4_BALANCE_LEVELS = [25, 50, 100] as const
export const PHASE4_BALANCE_TARGET_DEFENSE = 100 as const
export const PHASE4_BALANCE_TARGET_EVASION = 500 as const
export const PHASE4_BALANCE_ASSUMED_MOVEMENT_TILES = 2 as const

export type Phase4BalanceAllocation = 'balanced' | 'offensive'

export interface Phase4BalanceMetrics {
  bestDirectDamagePer100Ap: number
  bestPvpDirectDamagePer100Ap: number
  bestSetupPayoffDamagePer100Ap: number
  bestHealingPer100Ap: number
  bestProtectionBasisPoints: number
  bestControlApSwing: number
  maximumRange: number
  maximumAreaTargets: number
  currentMpSpendMaximum: number
  currentMpRecoveryMaximum: number
  repeatDamageEfficiencyRatio: number
}

export interface Phase4BalanceScenario {
  level: (typeof PHASE4_BALANCE_LEVELS)[number]
  allocation: Phase4BalanceAllocation
  attributes: CharacterAttributes
  physicalPower: number
  mysticPower: number
  accuracy: number
  criticalChance: number
  armor: number
  ward: number
  metrics: Phase4BalanceMetrics
}

export interface Phase4BalanceEssenceReport {
  essenceId: string
  directDamagePer100Ap: number
  healingPer100Ap: number
  protectionBasisPoints: number
  controlApSwing: number
}

export interface Phase4BalanceResonanceReport {
  pairCount: number
  averageBonusDamage: number
  maximumBonusDamage: number
}

export interface Phase4BalanceDisciplineReport {
  disciplineId: string
  focusAttributes: readonly CharacterAttributeId[]
  primaryDamageSource: 'physical-power' | 'mystic-power'
  scenarios: readonly Phase4BalanceScenario[]
  essence: Phase4BalanceEssenceReport
  resonance: Phase4BalanceResonanceReport
}

export interface Phase4BalanceHarnessReport {
  assumptions: {
    targetArmor: number
    targetWard: number
    targetEvasion: number
    assumedMovementTiles: number
  }
  disciplines: readonly Phase4BalanceDisciplineReport[]
}

const PUBLISHED_DISCIPLINES = [...FOUNDATION_DISCIPLINES, ...ADVANCED_DISCIPLINES] as const

export function buildPhase4BalanceHarness(): Phase4BalanceHarnessReport {
  const currentSkills = latestEnabledMatureSkills()
  const disciplines = PUBLISHED_DISCIPLINES.map((discipline) => {
    const policy = foundationDisciplineAttributePolicy(discipline.id)
    if (!policy) throw new Error('Missing attribute policy for ' + discipline.id + '.')
    const skills = currentSkills.filter((skill) => skill.sourceDisciplineId === discipline.id)
    const primaryDamageSource = representativeDamageSource(skills)
    const scenarios = PHASE4_BALANCE_LEVELS.flatMap((level) =>
      (['balanced', 'offensive'] as const).map((allocation) =>
        buildScenario(policy, skills, primaryDamageSource, level, allocation),
      ),
    )
    const referenceScenario =
      scenarios.find((scenario) => scenario.level === 100 && scenario.allocation === 'offensive') ??
      scenarios[scenarios.length - 1]!
    return {
      disciplineId: discipline.id,
      focusAttributes: [...discipline.focusAttributes],
      primaryDamageSource,
      scenarios,
      essence: buildEssenceReport(discipline.id, referenceScenario),
      resonance: buildResonanceReport(discipline.id),
    }
  }).sort((left, right) => left.disciplineId.localeCompare(right.disciplineId))

  return {
    assumptions: {
      targetArmor: PHASE4_BALANCE_TARGET_DEFENSE,
      targetWard: PHASE4_BALANCE_TARGET_DEFENSE,
      targetEvasion: PHASE4_BALANCE_TARGET_EVASION,
      assumedMovementTiles: PHASE4_BALANCE_ASSUMED_MOVEMENT_TILES,
    },
    disciplines,
  }
}

function buildScenario(
  policy: DisciplineAttributePolicy,
  skills: readonly MatureSkillDefinition[],
  damageSource: 'physical-power' | 'mystic-power',
  level: (typeof PHASE4_BALANCE_LEVELS)[number],
  allocation: Phase4BalanceAllocation,
): Phase4BalanceScenario {
  const attributes = representativeAttributes(policy, level, allocation, damageSource)
  const stats = calculateDerivedStats({ attributes, level })
  return {
    level,
    allocation,
    attributes,
    physicalPower: stats.stats.physicalPower.value,
    mysticPower: stats.stats.mysticPower.value,
    accuracy: stats.stats.accuracy.value,
    criticalChance: stats.stats.criticalChance.value,
    armor: stats.stats.armor.value,
    ward: stats.stats.ward.value,
    metrics: metricsForSkills(skills, stats),
  }
}

function representativeAttributes(
  policy: DisciplineAttributePolicy,
  level: number,
  allocation: Phase4BalanceAllocation,
  damageSource: 'physical-power' | 'mystic-power',
): CharacterAttributes {
  const personal = Object.fromEntries(
    CHARACTER_ATTRIBUTE_IDS.map((id) => [id, 0]),
  ) as CharacterAttributes
  let remaining = personalAttributePointPoolForLevel(level)

  const canAdd = (id: CharacterAttributeId) =>
    policy.baseAttributes[id] + personal[id] < (policy.attributeCaps[id] ?? 40)
  const add = (id: CharacterAttributeId) => {
    if (remaining <= 0 || !canAdd(id)) return false
    personal[id] += 1
    remaining -= 1
    return true
  }

  if (allocation === 'offensive') {
    const primary: CharacterAttributeId = damageSource === 'mystic-power' ? 'intellect' : 'might'
    const order = uniqueAttributes([
      primary,
      'finesse',
      ...policy.focusAttributes,
      ...CHARACTER_ATTRIBUTE_IDS,
    ])
    for (const id of order) {
      while (remaining > 0 && canAdd(id)) add(id)
    }
  } else {
    const order = uniqueAttributes([...policy.focusAttributes, ...CHARACTER_ATTRIBUTE_IDS])
    while (remaining > 0) {
      let progressed = false
      for (const id of order) {
        if (add(id)) progressed = true
        if (remaining === 0) break
      }
      if (!progressed) break
    }
  }

  if (remaining !== 0) {
    throw new Error('Representative allocation left unspent points.')
  }

  return Object.fromEntries(
    CHARACTER_ATTRIBUTE_IDS.map((id) => [id, policy.baseAttributes[id] + personal[id]]),
  ) as CharacterAttributes
}

function uniqueAttributes(ids: readonly CharacterAttributeId[]): CharacterAttributeId[] {
  return [...new Set(ids)]
}

function representativeDamageSource(
  skills: readonly MatureSkillDefinition[],
): 'physical-power' | 'mystic-power' {
  let mystic = 0
  let physical = 0
  for (const skill of skills) {
    if (!skill.effects.some(isDirectDamage)) continue
    if (skill.tags.includes('mystic')) mystic += 1
    else physical += 1
  }
  return mystic > physical ? 'mystic-power' : 'physical-power'
}

function metricsForSkills(
  skills: readonly MatureSkillDefinition[],
  stats: DerivedStatSnapshot,
): Phase4BalanceMetrics {
  const pve = skills.map((skill) => skillMetric(skill, stats, 'pve'))
  const pvp = skills.map((skill) => skillMetric(skill, stats, 'pvp'))
  const direct = pve.filter((row) => row.directDamagePer100Ap > 0)
  const conditional = pve.filter(
    (row) => row.directDamagePer100Ap > 0 && row.hasSetupRequirement,
  )
  const bestDirect = maximum(direct.map((row) => row.directDamagePer100Ap))
  return {
    bestDirectDamagePer100Ap: bestDirect,
    bestPvpDirectDamagePer100Ap: maximum(pvp.map((row) => row.directDamagePer100Ap)),
    bestSetupPayoffDamagePer100Ap: maximum(
      conditional.map((row) => row.directDamagePer100Ap),
    ),
    bestHealingPer100Ap: maximum(pve.map((row) => row.healingPer100Ap)),
    bestProtectionBasisPoints: maximum(pve.map((row) => row.protectionBasisPoints)),
    bestControlApSwing: maximum(pve.map((row) => row.controlApSwing)),
    maximumRange: maximum(pve.map((row) => row.maximumRange)),
    maximumAreaTargets: maximum(pve.map((row) => row.areaTargets)),
    currentMpSpendMaximum: maximum(pve.map((row) => row.mpCost)),
    currentMpRecoveryMaximum: maximum(pve.map((row) => row.mpRecovery)),
    repeatDamageEfficiencyRatio: bestDirect > 0 ? 0.5 : 0,
  }
}

function skillMetric(
  definition: MatureSkillDefinition,
  stats: DerivedStatSnapshot,
  context: MatureSkillCombatContext,
) {
  const resolved = resolveMatureSkillForContext(definition, context)
  const damageEffects = definition.effects.filter(isDirectDamage)
  const source = definition.tags.includes('mystic') ? 'mystic-power' : 'physical-power'
  const power =
    source === 'mystic-power' ? stats.stats.mysticPower.value : stats.stats.physicalPower.value
  const scaling =
    damageEffects.length > 0
      ? currentSkillDamageScaling(source, damageEffects.length, resolved.apCost)
      : null
  const hitChance =
    definition.accuracyMode === 'per-target'
      ? clampBasisPoints(
          stats.stats.accuracy.value -
            PHASE4_BALANCE_TARGET_EVASION +
            (definition.accuracyModifierBasisPoints ?? 0),
        )
      : 10_000
  const critExpectedMultiplier = 1 + (stats.stats.criticalChance.value / 10_000) * 0.5
  const directDamage = damageEffects.reduce((total, effect) => {
    const authoredScaling = 'scaling' in effect ? effect.scaling : undefined
    const raw = calculateScaledRawDamage(effect.amount, authoredScaling ?? scaling, power)
    return total + mitigateDamageByDefense(raw, PHASE4_BALANCE_TARGET_DEFENSE)
  }, 0)
  const expectedDirectDamage = directDamage * (hitChance / 10_000) * critExpectedMultiplier
  const healing = definition.effects.reduce(
    (total, effect) =>
      effect.type === 'healing' ? total + effect.amount * (effect.ticks ?? 1) : total,
    0,
  )
  const mpRecovery = definition.effects.reduce(
    (total, effect) =>
      effect.type === 'resource-change' && effect.delta > 0
        ? total + effect.delta * (effect.ticks ?? 1)
        : total,
    0,
  )

  return {
    directDamagePer100Ap: roundMetric((expectedDirectDamage * 100) / resolved.apCost),
    healingPer100Ap: roundMetric((healing * 100) / resolved.apCost),
    protectionBasisPoints: protectionForEffects(definition.effects),
    controlApSwing: controlApSwing(definition.effects),
    maximumRange: definition.target.maximumRange,
    areaTargets: assumedAreaTargets(definition),
    mpCost: definition.mpCost ?? 0,
    mpRecovery,
    hasSetupRequirement: definition.requirements.length > 0,
  }
}

function buildEssenceReport(
  disciplineId: string,
  scenario: Phase4BalanceScenario,
): Phase4BalanceEssenceReport {
  const essence = resolveEssenceForBuild(disciplineId, null)
  if (!essence) {
    return {
      essenceId: '',
      directDamagePer100Ap: 0,
      healingPer100Ap: 0,
      protectionBasisPoints: 0,
      controlApSwing: 0,
    }
  }
  const stats = calculateDerivedStats({ attributes: scenario.attributes, level: scenario.level })
  const metric = skillMetric(essence.skill, stats, 'pve')
  return {
    essenceId: essence.essenceId,
    directDamagePer100Ap: metric.directDamagePer100Ap,
    healingPer100Ap: metric.healingPer100Ap,
    protectionBasisPoints: metric.protectionBasisPoints,
    controlApSwing: metric.controlApSwing,
  }
}

function buildResonanceReport(disciplineId: string): Phase4BalanceResonanceReport {
  const definitions = P35_REPRESENTATIVE_RESONANCES.filter(
    (definition) => definition.enabled && definition.disciplinePair.includes(disciplineId),
  )
  const bonusDamage = definitions.map((definition) =>
    definition.trigger.payoffEffects.reduce(
      (total, effect) => total + (effect.type === 'damage' ? effect.amount : 0),
      0,
    ),
  )
  return {
    pairCount: definitions.length,
    averageBonusDamage:
      definitions.length === 0
        ? 0
        : roundMetric(bonusDamage.reduce((sum, amount) => sum + amount, 0) / definitions.length),
    maximumBonusDamage: maximum(bonusDamage),
  }
}

function protectionForEffects(effects: readonly CombatEffectDefinition[]): number {
  let best = 0
  for (const effect of effects) {
    if (effect.type !== 'apply-status') continue
    const status = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === effect.statusId)
    if (!status) continue
    if (status.damageTakenMultiplierBasisPoints < 10_000) {
      best = Math.max(best, 10_000 - status.damageTakenMultiplierBasisPoints)
    }
    for (const modifier of status.damageModifiers ?? []) {
      if (
        modifier.direction === 'incoming' &&
        modifier.condition.kind === 'always' &&
        modifier.multiplierBasisPoints < 10_000
      ) {
        best = Math.max(best, 10_000 - modifier.multiplierBasisPoints)
      }
    }
  }
  return best
}

function controlApSwing(effects: readonly CombatEffectDefinition[]): number {
  let best = 0
  for (const effect of effects) {
    if (effect.type === 'displace') {
      best = Math.max(best, effect.distance * 20)
      continue
    }
    if (effect.type === 'create-terrain' && effect.terrain === 'frozen') {
      best = Math.max(best, PHASE4_BALANCE_ASSUMED_MOVEMENT_TILES * 10)
      continue
    }
    if (effect.type !== 'apply-status') continue
    if (effect.statusId === 'root') {
      best = Math.max(best, PHASE4_BALANCE_ASSUMED_MOVEMENT_TILES * 20)
    } else if (effect.statusId === 'slow' || effect.statusId === 'haste') {
      best = Math.max(best, PHASE4_BALANCE_ASSUMED_MOVEMENT_TILES * 10)
    }
  }
  return best
}

function assumedAreaTargets(definition: MatureSkillDefinition): number {
  if (definition.target.shape.kind === 'single') return 1
  if (definition.target.shape.kind === 'circle') {
    return Math.min(4, 1 + definition.target.shape.radius)
  }
  return Math.min(4, Math.max(1, definition.target.shape.length))
}

function isDirectDamage(
  effect: CombatEffectDefinition,
): effect is Extract<CombatEffectDefinition, { type: 'damage' }> {
  return (
    effect.type === 'damage' &&
    !('vengeance' in effect && effect.vengeance !== undefined) &&
    (effect.amount > 0 || ('scaling' in effect && effect.scaling !== undefined))
  )
}

function clampBasisPoints(value: number): number {
  return Math.max(0, Math.min(10_000, value))
}

function maximum(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values)
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100
}
