import type {
  CombatEncounterState,
  CombatEffectProjection,
  CombatResolutionTransition,
  CombatTargetSelection,
  CombatActionIssue,
} from './actions'
import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import { combatAbilitySubject } from './combat-behavior-runtime'
import { evaluateAbilitySelectedRequirements } from './combat-requirements'
import { combatEffectTimingMode, combatEffectTimingRoundOffset } from './combat-effect-timing'
import { combatSourceCommandVisibility } from './actions-legacy'
import {
  assertCombatSummonPlacement,
  spawnCombatSummon,
  type SpawnCombatSummonInput,
} from './combat-summons'
import {
  reattachStatDrivenCombatBridge,
  STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
  STAT_DRIVEN_COMBAT_RULES_VERSION,
  type StatDrivenCombatBridgeState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

/** Private S0 packet; never an authored action field or a client command. */
export interface PreparedCanonicalSummon {
  readonly issue?: CombatActionIssue
  readonly input: SpawnCombatSummonInput
  readonly eligible: boolean
  readonly activationRound: number
  readonly bridge: StatDrivenCombatBridgeState
  readonly sourceCommandVisibility: ReturnType<typeof combatSourceCommandVisibility>
}

export function prepareCanonicalSummon(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
  selection: CombatTargetSelection,
  actionTags: readonly string[],
): PreparedCanonicalSummon | undefined {
  const effect = behavior.effects.find((effect) => effect.payload.type === 'summon')
  if (!effect || effect.payload.type !== 'summon') return undefined
  if (selection.kind !== 'tile') throw new TypeError('canonical-summon-tile-required')
  const bridge = (state as Partial<StatDrivenCombatEncounterState>).statBridge
  if (
    bridge?.schemaVersion !== STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION ||
    bridge.rulesVersion !== STAT_DRIVEN_COMBAT_RULES_VERSION
  )
    throw new TypeError('canonical-summon-current-stat-bridge-required')
  const facing = state.tactical.placements.find(
    (placement) => placement.combatantId === source.ownerCombatantId,
  )?.facing
  if (!facing) throw new TypeError('canonical-summon-owner-placement-required')
  const timing = effect.timing ?? combatEffectTimingMode(state.effectTimingPolicy, 'summon')
  if (timing !== 'instant' && !state.effectTimingPolicy)
    throw new TypeError('canonical-summon-pinned-timing-policy-required')
  const eligible = evaluateAbilitySelectedRequirements(
    effect.requirements ?? null,
    {
      owner: combatAbilitySubject(state, source.ownerCombatantId),
      selected: null,
      affected: null,
      triggering: null,
      event: {
        type: 'combat_action_used',
        phase: 'before',
        action: {
          classification: behavior.classification,
          attackFamily: behavior.attackFamily,
          sourceDisciplineId: source.sourceDisciplineId,
          tags: actionTags,
        },
      },
    },
    [],
  )
  const input: SpawnCombatSummonInput = {
    ownerCombatantId: source.ownerCombatantId,
    sourceSkillId: source.abilityId,
    sourceSkillVersion: source.contentVersion,
    profile: effect.payload.profile,
    position: { ...selection.position },
    facing,
  }
  // Reuse commit's placement validator without constructing a preview summon or spending RNG.
  let issue: CombatActionIssue | undefined
  if (eligible) {
    try {
      assertCombatSummonPlacement(reattachStatDrivenCombatBridge(state, bridge), input.position)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      issue = { code: 'target-not-found', message: error.message }
    }
  }
  return {
    ...(issue ? { issue } : {}),
    input,
    eligible,
    bridge,
    activationRound: state.tactical.battle.round + combatEffectTimingRoundOffset(timing),
    sourceCommandVisibility: combatSourceCommandVisibility(state, source.ownerCombatantId),
  }
}

export function canonicalSummonForecast(
  summon: PreparedCanonicalSummon,
  currentRound: number,
): readonly CombatEffectProjection[] {
  return summon.eligible && !summon.issue
    ? [
        {
          effectType: 'summon',
          statusId: 'summon',
          combatantId: summon.input.ownerCombatantId,
          before: 'none',
          after: summon.activationRound > currentRound ? 'pending' : 'active',
          ...(summon.activationRound > currentRound
            ? { activationRound: summon.activationRound }
            : {}),
          remainingOwnerTurnEnds: summon.input.profile.lifetimeTurns,
        },
      ]
    : []
}

/** Resolve after ordered native packets and before their after-action reaction frame. */
export function resolveCanonicalSummon(
  transition: CombatResolutionTransition,
  summon: PreparedCanonicalSummon,
): CombatResolutionTransition {
  const owner = transition.state.tactical.battle.combatants.find(
    (unit) => unit.id === summon.input.ownerCombatantId,
  )
  if (
    !summon.eligible ||
    summon.issue ||
    !owner ||
    owner.hp <= 0 ||
    transition.state.tactical.battle.lifecycle !== 'active' ||
    transition.events.some(
      (event) =>
        event.event === 'combat_action_interrupted' &&
        event.actionId === summon.input.sourceSkillId,
    )
  )
    return transition
  const bridge =
    (transition.state as Partial<StatDrivenCombatEncounterState>).statBridge ?? summon.bridge
  const state = reattachStatDrivenCombatBridge(transition.state, bridge)
  if (summon.activationRound > state.tactical.battle.round) {
    assertCombatSummonPlacement(state, summon.input.position)
    return {
      ...transition,
      state: {
        ...state,
        pendingSummons: [
          ...(state.pendingSummons ?? []),
          {
            input: summon.input,
            activationRound: summon.activationRound,
            ...(summon.sourceCommandVisibility
              ? { sourceCommandVisibility: summon.sourceCommandVisibility }
              : {}),
          },
        ],
      },
      events: [
        ...transition.events,
        {
          event: 'effect_pending',
          actionId: summon.input.sourceSkillId,
          sourceCombatantId: summon.input.ownerCombatantId,
          targetCombatantId: summon.input.ownerCombatantId,
          effectTag: 'summon',
          activationRound: summon.activationRound,
          remainingOwnerTurnEnds: summon.input.profile.lifetimeTurns,
        },
      ],
    }
  }
  const spawned = spawnCombatSummon(state, summon.input)
  return { ...transition, state: spawned.state, events: [...transition.events, ...spawned.events] }
}
