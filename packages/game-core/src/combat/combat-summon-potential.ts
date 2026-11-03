import { effectiveCombatStatProfile } from './combat-stat-bonuses'
import { hasGameplayTag } from './gameplay-tags'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import type { CombatEffectDefinition } from './actions'
import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import { combatAbilitySubject, combatAbilityBehavior } from './combat-behavior-runtime'
import { effectiveBasicSkillBehavior } from './combat-basic-actions'
import { evaluateAbilitySelectedRequirements } from './combat-requirements'
import { nativeCombatTagPayload } from './combat-tag-registry'
import {
  calculateScaledRawDamage,
  standardSkillDamageScaling,
  summonSkillDamageScaling,
} from './damage-scaling'
import { calculatePv1fBasicAttackDamage } from './pv1f-basic-attack'
import { PV1F_BASIC_ATTACK_COST } from './pv1f-skills'
import { CURRENT_POISON_DAMAGE, CURRENT_BURN_DAMAGE_BY_STAGE } from './combat-dots'
import { percentageDotTickDamage } from './combat-percentage-dots'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

const MAXIMUM = BigInt(Number.MAX_SAFE_INTEGER)
const bounded = (value: bigint): number => Number(value > MAXIMUM ? MAXIMUM : value)

/** Exact integer square root, with no floating-point intermediate or combat RNG. */
function integerSquareRoot(value: bigint): bigint {
  if (value < 2n) return value
  let current = 1n << BigInt(Math.ceil(value.toString(2).length / 2))
  for (;;) {
    const next = (current + value / current) / 2n
    if (next >= current) return current
    current = next
  }
}

/** The only ceiling is the engine's safe-integer damage representation, never a balance limit. */
export function summonPotentialBudget(owner: number, enemy: number, potency: number): number {
  for (const value of [owner, enemy, potency])
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError('Summon potential requires nonnegative safe integers.')
  return bounded(integerSquareRoot(BigInt(owner) * BigInt(enemy) * BigInt(potency) ** 2n) / 10000n)
}

function activations(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  costs: AbilityBehavior['costs'],
  limited: boolean,
): number {
  const unit = state.tactical.battle.combatants.find((row) => row.id === actorId)!
  const cost = (resource: 'ap' | 'mp' | 'hp') =>
    costs.filter((row) => row.resource === resource).reduce((sum, row) => sum + row.amount, 0)
  const ap = cost('ap')
  const mp = cost('mp')
  const hp = cost('hp')
  return Math.max(
    0,
    Math.min(
      ap > 0 ? Math.floor(100 / ap) : 1,
      mp > 0 ? Math.floor(unit.maxMp / mp) : Number.MAX_SAFE_INTEGER,
      hp > 0 ? Math.floor(Math.max(0, unit.maxHp - 1) / hp) : Number.MAX_SAFE_INTEGER,
      limited ? 1 : Number.MAX_SAFE_INTEGER,
    ),
  )
}

function effectDamage(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  effects: readonly CombatEffectDefinition[],
): number {
  const profile = effectiveCombatStatProfile(state, actorId)!
  const direct = effects.reduce((sum, effect) => {
    if (effect.type !== 'damage' || effect.vengeance) return sum
    const scaling = effect.scaling
    const amount = calculateScaledRawDamage(
      effect.amount,
      scaling,
      scaling
        ? ((scaling.source === 'physical-power' ? profile.physicalPower : profile.mysticPower) ?? 0)
        : null,
    )
    return sum + BigInt(amount)
  }, 0n)
  const periodic = effects.reduce((sum, effect) => {
    if (!['poison', 'burn', 'bleed'].includes(effect.type)) return sum
    if (effect.type !== 'poison' && effect.type !== 'burn' && effect.type !== 'bleed') return sum
    return (
      sum +
      BigInt(
        effect.damageProfile
          ? percentageDotTickDamage(bounded(direct), effect.damageProfile)
          : effect.type === 'bleed'
            ? effect.damagePerTick
            : (effect.power ??
              (effect.type === 'poison' ? CURRENT_POISON_DAMAGE : CURRENT_BURN_DAMAGE_BY_STAGE[0])),
      )
    )
  }, 0n)
  return bounded(direct + periodic)
}

function sourcePotential(
  state: StatDrivenCombatEncounterState,
  source: CapturedCombatAbilitySource,
  authored: AbilityBehavior,
): number {
  if (authored.activation !== 'manual' || authored.mode !== 'action' || !authored.targeting)
    return 0
  // Walking has a separate native facade and never contributes an offensive template.
  if (
    source.basic?.enabled === false ||
    (source.basic?.execution.kind === 'basic-move' &&
      source.basic.execution.costBasis === 'per-terrain-point')
  )
    return 0
  const behavior = effectiveBasicSkillBehavior(
    state,
    source,
    combatAbilityBehavior(source, authored.id, state.effectTimingPolicy),
  )
  // Potential models a fresh allowance, independent of the live usage ledger.
  const repeats = Math.min(
    behavior.maximumUsesPerBattle ?? Number.MAX_SAFE_INTEGER,
    activations(
      state,
      source.ownerCombatantId,
      behavior.costs,
      Boolean(
        behavior.cooldown ||
        behavior.activationLimits?.some(
          (limit) => limit !== 'once-per-action' || state.abilityUsageLimitPolicyVersion === 1,
        ) ||
        behavior.effects.some((row) => row.timing === 'controlled'),
      ),
    ),
  )
  if (!repeats) return 0
  const ownerUnit = state.tactical.battle.combatants.find(
    (row) => row.id === source.ownerCombatantId,
  )!
  const owner = combatAbilitySubject(state, source.ownerCombatantId)!
  const fullOwner = {
    ...owner,
    resources: { ...owner.resources, hp: ownerUnit.maxHp, mp: ownerUnit.maxMp, ap: 100 },
  }
  let best = 0
  for (const enemy of state.tactical.battle.combatants.filter(
    (row) => row.hp > 0 && row.teamId !== ownerUnit.teamId,
  )) {
    const subject = combatAbilitySubject(state, enemy.id)!
    const selected = { ...subject, resources: { hp: enemy.maxHp, mp: enemy.maxMp, ap: 100 } }
    const context = {
      owner: fullOwner,
      selected,
      affected: selected,
      event: {
        type: 'combat_action_used',
        phase: 'before' as const,
        action: {
          classification: behavior.classification,
          attackFamily: behavior.attackFamily,
          sourceDisciplineId: source.sourceDisciplineId,
          tags: source.tags,
        },
      },
    }
    if (!evaluateAbilitySelectedRequirements(behavior.requirements, context, [selected])) continue
    const effects = behavior.effects.flatMap((row): CombatEffectDefinition[] => {
      const payload = row.payload
      if (
        (payload.type !== 'damage' &&
          payload.type !== 'pierce' &&
          payload.type !== 'poison' &&
          payload.type !== 'burn' &&
          payload.type !== 'bleed') ||
        !evaluateAbilitySelectedRequirements(row.requirements ?? null, context, [selected]) ||
        payload.recipient === 'actor' ||
        ['self', 'ally', 'empty-tile'].includes(payload.target ?? '') ||
        (!payload.target &&
          (behavior.targeting!.teamPolicy === 'ally' || behavior.targeting!.kind === 'self'))
      )
        return []
      return [nativeCombatTagPayload(payload)]
    })
    best = Math.max(
      best,
      bounded(BigInt(effectDamage(state, source.ownerCombatantId, effects)) * BigInt(repeats)),
    )
  }
  return best
}

/**
 * A bounded offensive baseline, measured against one neutral undefended recipient: best
 * available manual template repeated within a fresh 100 AP turn and maximum MP/HP capacity.
 * Direct packets plus one periodic tick count; target count, criticals, facing, reactions and
 * hypothetical modifier combinations do not inflate it. Current resource depletion, range,
 * cooldown progress and current turn ownership do not alter a combatant's captured potential.
 * Retained native Skills without a captured template cannot be reconstructed here: the
 * deterministic native Basic fallback is conservative, without consulting a live catalogue.
 */
export function combatantDamagePotential(
  state: StatDrivenCombatEncounterState,
  id: string,
): number {
  const unit = state.tactical.battle.combatants.find((row) => row.id === id)
  const stats = effectiveCombatStatProfile(state, id)
  if (!unit || !stats)
    throw new TypeError('Summon potential requires its committed combatant profile.')
  const sources = (state.capturedAbilitySources ?? []).filter(
    (row) =>
      row.ownerCombatantId === id &&
      state.abilityRuntime?.activeSourceIds.includes(row.sourceInstanceId),
  )
  const summon = state.effectState?.summons?.find((row) => row.combatantId === id)
  let best =
    unit.kind === 'summon' || sources.some((row) => row.basic?.execution.kind === 'basic-attack')
      ? 0
      : calculatePv1fBasicAttackDamage({
          physicalPower: Math.max(stats.physicalPower ?? 0, stats.mysticPower ?? 0),
        }) * Math.floor(100 / PV1F_BASIC_ATTACK_COST)
  for (const captured of sources)
    for (const behavior of captured.definition.behaviors)
      best = Math.max(best, sourcePotential(state, captured, behavior))
  for (const ability of summon?.profile.abilities ?? []) {
    if (
      !state.tactical.battle.combatants.some(
        (enemy) =>
          enemy.hp > 0 &&
          enemy.teamId !== unit.teamId &&
          ability.requirements.every((requirement) => {
            if (requirement.kind === 'actor-hp-at-most') return requirement.basisPoints >= 10000
            const subject = combatAbilitySubject(
              state,
              requirement.kind === 'target-status-present' ||
                requirement.kind === 'target-tag-present'
                ? enemy.id
                : id,
            )!
            if ('statusId' in requirement) {
              const present = subject.statusIds?.includes(requirement.statusId) ?? false
              return requirement.kind === 'actor-status-absent' ? !present : present
            }
            const present = hasGameplayTag(
              state,
              requirement.kind === 'target-tag-present' ? enemy.id : id,
              requirement.tag,
              PV1F_COMBAT_CONTENT,
            )
            return requirement.kind === 'actor-tag-absent' ? !present : present
          }),
      )
    )
      continue
    const count = ability.effects.filter((row) => row.type === 'damage').length
    const family = ability.tags.includes('mystic') ? 'mystic-power' : 'physical-power'
    const scaling = count
      ? state.skillPacketPolicyVersion === 1
        ? standardSkillDamageScaling(family)
        : summonSkillDamageScaling(family, count, ability.apCost)
      : null
    const effects = ability.effects
      .filter((row) => row.recipient !== 'actor' && !['self', 'ally'].includes(row.target ?? ''))
      .map((row) => (row.type === 'damage' && !row.scaling && scaling ? { ...row, scaling } : row))
    // Native Summon commands have a once-per-owner-turn gate, independent of AP cost.
    if (
      activations(
        state,
        id,
        [
          { resource: 'ap', amount: ability.apCost },
          { resource: 'mp', amount: ability.mpCost },
          { resource: 'hp', amount: ability.hpCost ?? 0 },
        ],
        true,
      )
    )
      best = Math.max(best, effectDamage(state, id, effects))
  }
  return best
}

export function capturedSummonPotentialBudget(
  state: StatDrivenCombatEncounterState,
  ownerId: string,
  potency: number,
): number {
  const owner = state.tactical.battle.combatants.find((row) => row.id === ownerId)!
  const potential = combatantDamagePotential(state, ownerId)
  const enemies = state.tactical.battle.combatants.filter(
    (row) => row.hp > 0 && row.teamId !== owner.teamId,
  )
  const strongest = enemies.length
    ? Math.max(...enemies.map((row) => combatantDamagePotential(state, row.id)))
    : potential
  return summonPotentialBudget(potential, strongest, potency)
}
