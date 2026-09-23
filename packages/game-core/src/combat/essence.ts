import { ADVANCED_DISCIPLINE_ESSENCES } from './advanced-discipline-content'
import type { CombatActionEvaluation, CombatTargetSelection } from './actions'
import { FOUNDATION_TRIO_ESSENCES } from './foundation-trio-essences'
import { IRONFIST_ESSENCE } from './ironfist-content'
import {
  currentMysticMpCost,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'
import {
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  readPv1fActionEconomy,
  type Pv1fTransition,
} from './pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

export const ESSENCE_SCHEMA_VERSION = 1 as const

export interface EssenceDefinition {
  readonly essenceId: string
  readonly contentVersion: number
  readonly enabled: boolean
  readonly sourceDisciplineId: string
  readonly name: string
  readonly description: string
  readonly skill: MatureSkillDefinition
  readonly authoring: {
    readonly schemaVersion: typeof ESSENCE_SCHEMA_VERSION
    readonly status: 'representative' | 'production'
    readonly validationTags: readonly string[]
  }
}

export interface EssenceSnapshotReference {
  readonly essenceId: string
  readonly contentVersion: number
  readonly sourceDisciplineId: string
  readonly skillId: string
  readonly skillContentVersion: number
}

export interface EssenceAiEvaluation {
  readonly essenceId: string
  readonly contentVersion: number
  readonly skillId: string
  readonly legal: boolean
  readonly affordable: boolean
  readonly apCost: number
  readonly actionEconomyRemaining: number
  readonly baseUtility: number
  readonly purposeTags: readonly string[]
  readonly combatEvaluation: CombatActionEvaluation
}

const PRE_PHASE4_REBALANCE_ESSENCES = [
  {
    essenceId: 'essence.vanguard.unbroken-strike',
    contentVersion: 1,
    enabled: true,
    sourceDisciplineId: 'vanguard',
    name: 'Unbroken Strike',
    description:
      'A pure Vanguard Essence Skill: commit heavily to a single adjacent enemy for a stronger decisive strike.',
    skill: {
      id: 'essence.vanguard.unbroken-strike',
      contentVersion: 1,
      enabled: true,
      nameRef: 'essence.vanguard.unbroken-strike.name',
      descriptionRef: 'essence.vanguard.unbroken-strike.description',
      sourceDisciplineId: 'vanguard',
      unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
      apCost: 55,
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 1,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        friendlyFire: 'enemies-only',
      },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
      tags: ['essence', 'vanguard', 'attack', 'melee', 'cockpit:attack'],
      cooldown: { key: 'essence.vanguard.unbroken-strike', ownerTurns: 3 },
      ai: {
        enabled: true,
        baseUtility: 92,
        purposeTags: ['damage', 'finisher', 'pure-build'],
      },
      overrides: { pvp: { apCost: 60 } },
      media: {
        iconKey: 'essence.vanguard.unbroken-strike.icon',
        audioCueKey: 'essence.vanguard.unbroken-strike.audio',
        vfxKey: 'essence.vanguard.unbroken-strike.vfx',
      },
      authoring: {
        schemaVersion: 1,
        status: 'representative',
        validationTags: ['p3.6', 'representative', 'essence', 'pure-only'],
      },
    },
    authoring: {
      schemaVersion: ESSENCE_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.6', 'representative', 'pure-only'],
    },
  },
  {
    essenceId: 'essence.lifebinder.verdant-rupture',
    contentVersion: 1,
    enabled: true,
    sourceDisciplineId: 'lifebinder',
    name: 'Verdant Rupture',
    description:
      'A pure Lifebinder Essence Skill: condense restorative force into a violent bloom that tears through a distant enemy.',
    skill: {
      id: 'essence.lifebinder.verdant-rupture',
      contentVersion: 1,
      enabled: true,
      nameRef: 'essence.lifebinder.verdant-rupture.name',
      descriptionRef: 'essence.lifebinder.verdant-rupture.description',
      sourceDisciplineId: 'lifebinder',
      unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
      apCost: 55,
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: true,
        maximumElevationDifference: 2,
        friendlyFire: 'enemies-only',
      },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 18 }],
      tags: ['essence', 'lifebinder', 'attack', 'mystic', 'ranged', 'cockpit:attack'],
      cooldown: { key: 'essence.lifebinder.verdant-rupture', ownerTurns: 3 },
      ai: {
        enabled: true,
        baseUtility: 90,
        purposeTags: ['damage', 'pressure', 'pure-build'],
      },
      overrides: { pvp: { apCost: 60 } },
      media: {
        iconKey: 'essence.lifebinder.verdant-rupture.icon',
        audioCueKey: 'essence.lifebinder.verdant-rupture.audio',
        vfxKey: 'essence.lifebinder.verdant-rupture.vfx',
      },
      authoring: {
        schemaVersion: 1,
        status: 'representative',
        validationTags: [
          'p3.6',
          'representative',
          'essence',
          'pure-only',
          'owner-approved-offense',
        ],
      },
    },
    authoring: {
      schemaVersion: ESSENCE_SCHEMA_VERSION,
      status: 'representative',
      validationTags: ['p3.6', 'representative', 'pure-only', 'owner-approved-offense'],
    },
  },
  ...FOUNDATION_TRIO_ESSENCES,
  IRONFIST_ESSENCE,
  ...ADVANCED_DISCIPLINE_ESSENCES,
] as const satisfies readonly EssenceDefinition[]

function rebalanceEssencePurposeTags(
  definition: EssenceDefinition,
  additions: readonly string[],
): readonly string[] {
  return [...new Set([...definition.skill.ai.purposeTags, ...additions])]
}

function currentEssenceEffect(
  effect: MatureSkillDefinition['effects'][number],
): MatureSkillDefinition['effects'][number] {
  if (
    effect.type === 'remove-status' &&
    effect.statusIds.includes('marked') &&
    !effect.statusIds.includes('mark')
  ) {
    return { ...effect, statusIds: [...effect.statusIds, 'mark'] }
  }
  return effect
}

function currentEssenceAccuracyMode(
  definition: EssenceDefinition,
): NonNullable<MatureSkillDefinition['accuracyMode']> {
  const skill = definition.skill
  if (skill.target.kind !== 'unit') return 'automatic'
  if (skill.target.teamPolicy !== 'enemy' && skill.target.teamPolicy !== 'any') return 'automatic'
  return skill.effects.some((effect) => {
    if (!('recipient' in effect) || effect.recipient === 'actor') return false
    if (effect.type === 'healing') return false
    if (effect.type === 'resource-change') return effect.delta < 0
    if (effect.type === 'barrier-change') return effect.amount < 0
    return effect.type !== 'create-terrain'
  })
    ? 'per-target'
    : 'automatic'
}

function createPhase4RebalancedEssence(definition: EssenceDefinition): EssenceDefinition {
  const version = definition.contentVersion + 1
  const authoring = {
    ...definition.authoring,
    validationTags: [
      ...new Set([...definition.authoring.validationTags, 'phase4-discipline-rebalance']),
    ],
  }
  const skillAuthoring = {
    ...definition.skill.authoring,
    validationTags: [
      ...new Set([...definition.skill.authoring.validationTags, 'phase4-discipline-rebalance']),
    ],
  }

  switch (definition.essenceId) {
    case 'essence.chronist.borrowed-hour':
      return {
        ...definition,
        contentVersion: version,
        description:
          'Restore an ally over two applications and grant movement Haste. No extra turn, AP or battle reset.',
        authoring,
        skill: {
          ...definition.skill,
          contentVersion: version,
          accuracyMode: 'automatic',
          accuracyModifierBasisPoints: undefined,
          effects: [
            {
              type: 'healing',
              recipient: 'primary-unit',
              amount: 5,
              ticks: 2,
            },
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'haste',
              stacks: 1,
            },
          ],
          ai: {
            ...definition.skill.ai,
            purposeTags: rebalanceEssencePurposeTags(definition, ['heal', 'recovery', 'haste']),
          },
          authoring: skillAuthoring,
        },
      }
    case 'essence.ravager.red-tempest':
      return {
        ...definition,
        contentVersion: version,
        authoring,
        skill: {
          ...definition.skill,
          contentVersion: version,
          accuracyMode: 'per-target',
          accuracyModifierBasisPoints: 0,
          effects: [
            { type: 'damage', recipient: 'affected-units', amount: 13 },
            {
              type: 'bleed',
              recipient: 'affected-units',
              damagePerTick: 3,
              ticks: 3,
              curseCopyable: true,
            },
          ],
          ai: {
            ...definition.skill.ai,
            purposeTags: rebalanceEssencePurposeTags(definition, ['bleed', 'area']),
          },
          authoring: skillAuthoring,
        },
      }
    case 'essence.cinderweaver.phoenix-wake':
      return {
        ...definition,
        contentVersion: version,
        authoring,
        skill: {
          ...definition.skill,
          contentVersion: version,
          accuracyMode: 'per-target',
          accuracyModifierBasisPoints: 0,
          effects: [
            { type: 'damage', recipient: 'affected-units', amount: 10 },
            { type: 'burn', recipient: 'affected-units', curseCopyable: true },
          ],
          ai: {
            ...definition.skill.ai,
            purposeTags: rebalanceEssencePurposeTags(definition, ['burn', 'area']),
          },
          authoring: skillAuthoring,
        },
      }
    case 'essence.tidecaller.tidal-crown':
      return {
        ...definition,
        contentVersion: version,
        description:
          'Cleanse and restore allies in a small area, then continue restoring them over time.',
        authoring,
        skill: {
          ...definition.skill,
          contentVersion: version,
          accuracyMode: 'automatic',
          accuracyModifierBasisPoints: undefined,
          effects: [
            {
              type: 'remove-status',
              recipient: 'affected-units',
              statusIds: [
                'burn',
                'bleed',
                'poison',
                'slow',
                'root',
                'exposed',
                'mark',
                'marked',
                'challenged',
              ],
            },
            { type: 'healing', recipient: 'affected-units', amount: 10 },
            {
              type: 'healing',
              recipient: 'affected-units',
              amount: 4,
              ticks: 2,
            },
          ],
          ai: {
            ...definition.skill.ai,
            purposeTags: rebalanceEssencePurposeTags(definition, [
              'cleanse',
              'heal',
              'recovery',
              'area',
            ]),
          },
          authoring: skillAuthoring,
        },
      }
    default: {
      const accuracyMode = currentEssenceAccuracyMode(definition)
      return {
        ...definition,
        contentVersion: version,
        authoring,
        skill: {
          ...definition.skill,
          contentVersion: version,
          accuracyMode,
          effects: definition.skill.effects.map(currentEssenceEffect),
          ...(accuracyMode === 'per-target'
            ? { accuracyModifierBasisPoints: definition.skill.accuracyModifierBasisPoints ?? 0 }
            : { accuracyModifierBasisPoints: undefined }),
          authoring: skillAuthoring,
        },
      }
    }
  }
}

const PHASE4_REBALANCED_ESSENCES = PRE_PHASE4_REBALANCE_ESSENCES.map(createPhase4RebalancedEssence)

function latestEnabledEssences(
  definitions: readonly EssenceDefinition[],
): readonly EssenceDefinition[] {
  const latest = new Map<string, EssenceDefinition>()
  for (const definition of definitions) {
    if (!definition.enabled) continue
    const previous = latest.get(definition.essenceId)
    if (!previous || definition.contentVersion > previous.contentVersion) {
      latest.set(definition.essenceId, definition)
    }
  }
  return [...latest.values()]
}

function createA03MysticMpEssenceVersion(definition: EssenceDefinition): EssenceDefinition | null {
  if (!definition.skill.tags.includes('mystic')) return null
  const mpCost = currentMysticMpCost(definition.skill.apCost)
  if (definition.skill.mpCost === mpCost) return null
  const contentVersion = definition.contentVersion + 1
  return {
    ...definition,
    contentVersion,
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, 'a03-roster-rebalance']),
      ],
    },
    skill: {
      ...definition.skill,
      contentVersion,
      mpCost,
      authoring: {
        ...definition.skill.authoring,
        validationTags: [
          ...new Set([...definition.skill.authoring.validationTags, 'a03-roster-rebalance']),
        ],
      },
    },
  }
}

const A03_MYSTIC_MP_ESSENCES = latestEnabledEssences([
  ...PRE_PHASE4_REBALANCE_ESSENCES,
  ...PHASE4_REBALANCED_ESSENCES,
]).flatMap((definition) => {
  const next = createA03MysticMpEssenceVersion(definition)
  return next ? [next] : []
})

function createA03ClassTunedEssenceVersion(
  definition: EssenceDefinition,
): EssenceDefinition | null {
  if (definition.essenceId !== 'essence.edgedancer.sevenfold-cut') return null

  const contentVersion = definition.contentVersion + 1
  const validationTag = 'a03-roster-rebalance'
  return {
    ...definition,
    contentVersion,
    authoring: {
      ...definition.authoring,
      validationTags: [...new Set([...definition.authoring.validationTags, validationTag])],
    },
    skill: {
      ...definition.skill,
      contentVersion,
      effects: definition.skill.effects.map((effect) =>
        effect.type === 'damage' ? { ...effect, amount: 4 } : effect,
      ),
      authoring: {
        ...definition.skill.authoring,
        validationTags: [...new Set([...definition.skill.authoring.validationTags, validationTag])],
      },
    },
  }
}

const A03_CLASS_TUNED_ESSENCES = latestEnabledEssences([
  ...PRE_PHASE4_REBALANCE_ESSENCES,
  ...PHASE4_REBALANCED_ESSENCES,
  ...A03_MYSTIC_MP_ESSENCES,
]).flatMap((definition) => {
  const next = createA03ClassTunedEssenceVersion(definition)
  return next ? [next] : []
})

export const P36_REPRESENTATIVE_ESSENCES = [
  ...PRE_PHASE4_REBALANCE_ESSENCES,
  ...PHASE4_REBALANCED_ESSENCES,
  ...A03_MYSTIC_MP_ESSENCES,
  ...A03_CLASS_TUNED_ESSENCES,
] as const satisfies readonly EssenceDefinition[]

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

export function validateEssenceDefinition(definition: EssenceDefinition): readonly string[] {
  const issues: string[] = []
  if (!STABLE_ID_PATTERN.test(definition.essenceId)) issues.push('essenceId')
  if (!Number.isSafeInteger(definition.contentVersion) || definition.contentVersion < 1) {
    issues.push('contentVersion')
  }
  if (!STABLE_ID_PATTERN.test(definition.sourceDisciplineId)) issues.push('sourceDisciplineId')
  if (!definition.name.trim()) issues.push('name')
  if (!definition.description.trim()) issues.push('description')
  if (definition.skill.id !== definition.essenceId) issues.push('skill.id')
  if (definition.skill.contentVersion !== definition.contentVersion) {
    issues.push('skill.contentVersion')
  }
  if (definition.skill.sourceDisciplineId !== definition.sourceDisciplineId) {
    issues.push('skill.sourceDisciplineId')
  }
  if (!definition.skill.tags.includes('essence')) issues.push('skill.tags.essence')
  if (validateMatureSkillDefinition(definition.skill).length > 0) issues.push('skill.definition')
  if (definition.authoring.schemaVersion !== ESSENCE_SCHEMA_VERSION) {
    issues.push('authoring.schemaVersion')
  }
  return issues
}

export function resolveEssenceForBuild(
  primaryDisciplineId: string,
  secondaryDisciplineId: string | null,
  contentVersion?: number,
): EssenceDefinition | null {
  if (secondaryDisciplineId !== null) return null
  const candidates = P36_REPRESENTATIVE_ESSENCES.filter(
    (definition) => definition.enabled && definition.sourceDisciplineId === primaryDisciplineId,
  )
  if (contentVersion !== undefined) {
    return candidates.find((definition) => definition.contentVersion === contentVersion) ?? null
  }
  return (
    [...candidates].sort((left, right) => right.contentVersion - left.contentVersion)[0] ?? null
  )
}

export function essenceSnapshotReference(definition: EssenceDefinition): EssenceSnapshotReference {
  assertUsableEssence(definition)
  return {
    essenceId: definition.essenceId,
    contentVersion: definition.contentVersion,
    sourceDisciplineId: definition.sourceDisciplineId,
    skillId: definition.skill.id,
    skillContentVersion: definition.skill.contentVersion,
  }
}

function resolveLegalEssence(
  essence: EssenceDefinition,
  primaryDisciplineId: string,
  secondaryDisciplineId: string | null,
): EssenceDefinition | null {
  assertUsableEssence(essence)
  const resolved = resolveEssenceForBuild(
    primaryDisciplineId,
    secondaryDisciplineId,
    essence.contentVersion,
  )
  return resolved?.essenceId === essence.essenceId ? resolved : null
}

export function evaluatePv1fEssenceSkillForAi(input: {
  readonly state: StatDrivenCombatEncounterState
  readonly essence: EssenceDefinition
  readonly primaryDisciplineId: string
  readonly secondaryDisciplineId: string | null
  readonly combatContext: MatureSkillCombatContext
  readonly selection: CombatTargetSelection
}): EssenceAiEvaluation | null {
  const essence = resolveLegalEssence(
    input.essence,
    input.primaryDisciplineId,
    input.secondaryDisciplineId,
  )
  if (!essence || !essence.skill.ai.enabled) return null

  const evaluated = evaluatePv1fMatureSkill(
    input.state,
    essence.skill,
    input.selection,
    input.combatContext,
  )
  const actionEconomyRemaining = readPv1fActionEconomy(evaluated.prepared)?.current ?? 0
  const affordable = actionEconomyRemaining >= evaluated.cost

  return {
    essenceId: essence.essenceId,
    contentVersion: essence.contentVersion,
    skillId: essence.skill.id,
    legal: evaluated.evaluation.legal && affordable,
    affordable,
    apCost: evaluated.cost,
    actionEconomyRemaining,
    baseUtility: essence.skill.ai.baseUtility,
    purposeTags: essence.skill.ai.purposeTags,
    combatEvaluation: evaluated.evaluation,
  }
}

export function executePv1fEssenceSkill(input: {
  readonly state: StatDrivenCombatEncounterState
  readonly essence: EssenceDefinition
  readonly primaryDisciplineId: string
  readonly secondaryDisciplineId: string | null
  readonly combatContext: MatureSkillCombatContext
  readonly selection: CombatTargetSelection
}): Pv1fTransition {
  const resolved = resolveLegalEssence(
    input.essence,
    input.primaryDisciplineId,
    input.secondaryDisciplineId,
  )
  if (!resolved) {
    throw new Error('That Essence Skill is not legal for the committed Discipline build.')
  }
  return executePv1fMatureSkill(input.state, resolved.skill, input.selection, input.combatContext)
}

function assertUsableEssence(definition: EssenceDefinition): void {
  const issues = validateEssenceDefinition(definition)
  if (issues.length > 0) throw new TypeError(`Invalid Essence definition: ${issues.join(', ')}.`)
  if (!definition.enabled || !definition.skill.enabled) {
    throw new RangeError('That Essence version is disabled.')
  }
}
