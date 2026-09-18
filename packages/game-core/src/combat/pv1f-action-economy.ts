import { materializeVengeanceDamage } from './combat-vengeance'
import {
  commitCombatSkillCopy,
  copiedSkillApCost,
  copiedSkillUsageKey,
  previewCombatSkillCopy,
} from './combat-skill-copy'
import {
  forecastCombatSkillAccuracyForTarget,
  rollCombatSkillAccuracyForTarget,
} from './combat-skill-accuracy'
import { normalizeCombatEffectState } from './combat-effect-state'
import { hasGameplayTag } from './gameplay-tags'
import { CURRENT_POISON_DAMAGE, advanceCurrentPoisonMovement } from './combat-dots'
import { terrainOverlayAt, COMBAT_TERRAIN_OVERLAY_DETAILS } from './terrain-overlays'
import { readBattleAuthorityCombatBuildSnapshot } from './battle-authority-build-snapshot'
import {
  forecastResonanceForSkill,
  resolveResonanceForPair,
  constrainResonanceForecastToTarget,
} from './resonance'
import { PHASE4_STATUSES } from './status-content'
import {
  createCovertStatusDefinition,
  createRevealedStatusDefinition,
  revealedSkillApCost,
} from './covert-sensory-revealed'
import {
  createBasicAttackDefinition,
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  resolveCombatMovementStepEffects,
  type CombatActionDefinition,
  type CombatActionEvaluation,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatEffectDefinition,
  type CombatStatusDefinition,
  type CombatTargetSelection,
} from './actions'
import type { BattleCombatant, BattleFacing, BattleTemporaryResource } from './battle-state'
import {
  resolveMatureSkillForContext,
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  type MatureSkillCombatContext,
  type MatureSkillDefinition,
} from './mature-skills'
import {
  advanceSkillCooldownsAtOwnerTurnStart,
  applySkillCooldown,
  readSkillCooldown,
  type SkillCooldownDefinition,
} from './skill-cooldowns'
import {
  evaluateCurrentMovementPath,
  movementTraversalCostAt,
  moveCurrentCombatant,
  selectCurrentFinalFacing,
  type GridPosition,
} from './board'
import {
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_GUARD_COST,
  movementApCostForTile,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
  pv1fFlatActionCost,
} from './pv1f-skills'
import {
  executeStatDrivenAttack,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

export {
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_GUARD_COST,
  PV1F_MOVEMENT_COST_PER_TERRAIN_POINT,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_MP_RECOVER_COST,
  PV1F_RECOVER_ACTION_ID,
  PV1F_RECOVER_COST,
} from './pv1f-skills'

export const PV1F_ACTION_ECONOMY_MAXIMUM = 100 as const
export const PV1F_RECOVER_PERCENT = 10 as const
export const PV1F_MP_RECOVER_PERCENT = 10 as const
export const PV1F_STATUS_MAXIMUM_STACKS = 3 as const
export const PV1F_RECOVERY_COOLDOWN_OWNER_TURNS = 2 as const
export const PV1F_REPEAT_SKILL_EFFECTIVENESS_BASIS_POINTS = 5_000 as const
export const PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX = 'pv1f.last-mature-skill.' as const

export const PV1F_RECOVERY_COOLDOWN: SkillCooldownDefinition = {
  key: 'basic.recovery',
  ownerTurns: PV1F_RECOVERY_COOLDOWN_OWNER_TURNS,
}

export const PV1F_ACTION_ECONOMY_RESOURCE_KEY = 'pv1f.action-economy' as const
export const PV1F_ACTION_ECONOMY_TURN_KEY = 'pv1f.action-economy-turn' as const
export const PV1F_BASIC_ATTACK_DAMAGE_KEY = 'pv1f.basic-attack-damage' as const

export const PV1F_GUARDED_STATUS: CombatStatusDefinition = {
  id: 'guarded',
  version: 1,
  maximumStacks: PV1F_STATUS_MAXIMUM_STACKS,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 8_500,
  polarity: 'positive',
}

// Lowered Guard is a one-turn anti-timeout debuff. A combatant who times out again can receive
// a fresh application, but one application must never persist beyond the next owner-turn start.
export const PV1F_LOWERED_GUARD_STATUS: CombatStatusDefinition = {
  id: 'lowered-guard',
  version: 1,
  maximumStacks: PV1F_STATUS_MAXIMUM_STACKS,
  durationOwnerTurnStarts: 1,
  damageTakenMultiplierBasisPoints: 25_000,
  polarity: 'negative',
}

export const PV1F_EXPOSED_STATUS: CombatStatusDefinition = {
  id: 'exposed',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 11_500,
  polarity: 'negative',
}

export const PV1F_COVERT_STATUS = createCovertStatusDefinition(4)
export const PV1F_REVEALED_STATUS = createRevealedStatusDefinition(4)

export const PV1F_COMBAT_CONTENT: CombatContentCatalog = {
  statuses: [
    PV1F_GUARDED_STATUS,
    PV1F_LOWERED_GUARD_STATUS,
    PV1F_EXPOSED_STATUS,
    PV1F_COVERT_STATUS,
    PV1F_REVEALED_STATUS,
    ...PHASE4_STATUSES,
  ],
}

export const PV1F_GUARD_ACTION: CombatActionDefinition = {
  id: PV1F_GUARD_ACTION_ID,
  version: 1,
  sourceType: 'basic-action',
  tags: ['basic', 'defensive', 'buff'],
  target: {
    kind: 'self',
    teamPolicy: 'self',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'allies-only',
  },
  cost: { spendsAction: true, mp: 0 },
  requirements: [],
  effects: [{ type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 }],
}

export interface Pv1fTransition {
  state: StatDrivenCombatEncounterState
  events: readonly unknown[]
}

export function calculatePv1fBasicAttackDamage(input: {
  level: number
  might: number
  finesse: number
}): number {
  for (const [field, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${field} must be a positive safe integer.`)
    }
  }
  return 6 + input.level + Math.floor(input.might * 0.8) + Math.floor(input.finesse * 0.4)
}

export function createPv1fBasicAttackDefinition(damage: number): CombatActionDefinition {
  if (!Number.isSafeInteger(damage) || damage < 1) {
    throw new RangeError('Basic Attack damage must be a positive safe integer.')
  }
  return createBasicAttackDefinition({
    id: 'unarmed.basic',
    version: 1,
    damage,
    minimumRange: 1,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: 1,
    facingModifiersBasisPoints: {
      front: 10_000,
      side: 11_000,
      rear: 12_500,
    },
  })
}

export function createPv1fRecoverAction(maxHp: number): CombatActionDefinition {
  if (!Number.isSafeInteger(maxHp) || maxHp < 1) {
    throw new RangeError('Maximum HP must be a positive safe integer.')
  }
  const amount = Math.max(1, Math.round(maxHp * (PV1F_RECOVER_PERCENT / 100)))
  return {
    id: PV1F_RECOVER_ACTION_ID,
    version: 1,
    sourceType: 'basic-action',
    tags: ['basic', 'recovery', 'heal'],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    cost: { spendsAction: true, mp: 0 },
    requirements: [{ kind: 'actor-hp-at-most', basisPoints: 9_999 }],
    effects: [{ type: 'healing', recipient: 'actor', amount }],
  }
}

export function createPv1fMpRecoveryAction(maxMp: number): CombatActionDefinition {
  if (!Number.isSafeInteger(maxMp) || maxMp < 1) {
    throw new RangeError('Maximum MP must be a positive safe integer.')
  }
  const amount = Math.max(1, Math.round(maxMp * (PV1F_MP_RECOVER_PERCENT / 100)))
  return {
    id: PV1F_MP_RECOVER_ACTION_ID,
    version: 1,
    sourceType: 'basic-action',
    tags: ['basic', 'recovery', 'heal', 'mp'],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    cost: { spendsAction: true, mp: 0 },
    requirements: [],
    effects: [{ type: 'resource-change', recipient: 'actor', resource: 'mp', delta: amount }],
  }
}

export function createPv1fTemporaryResources(
  basicAttackDamage: number,
): readonly BattleTemporaryResource[] {
  if (!Number.isSafeInteger(basicAttackDamage) || basicAttackDamage < 1) {
    throw new RangeError('Basic Attack damage must be a positive safe integer.')
  }
  return [
    {
      key: PV1F_ACTION_ECONOMY_RESOURCE_KEY,
      current: PV1F_ACTION_ECONOMY_MAXIMUM,
      maximum: PV1F_ACTION_ECONOMY_MAXIMUM,
    },
    {
      key: PV1F_ACTION_ECONOMY_TURN_KEY,
      current: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    },
    {
      key: PV1F_BASIC_ATTACK_DAMAGE_KEY,
      current: basicAttackDamage,
      maximum: basicAttackDamage,
    },
  ].sort((left, right) => left.key.localeCompare(right.key))
}

export function readPv1fActionEconomy(
  state: StatDrivenCombatEncounterState,
  combatantId: string | null = state.tactical.battle.currentTurn?.combatantId ?? null,
): { current: number; maximum: number } | null {
  if (!combatantId) return null
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) return null
  const resource = combatant.temporaryResources.find(
    (candidate) => candidate.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  return resource ? { current: resource.current, maximum: resource.maximum } : null
}

export function readPv1fBasicAttackDamage(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): number {
  const combatant = getCombatant(state, combatantId)
  return (
    combatant.temporaryResources.find((resource) => resource.key === PV1F_BASIC_ATTACK_DAMAGE_KEY)
      ?.current ?? 16
  )
}

function preparePv1fTurnEconomyTransition(state: StatDrivenCombatEncounterState): Pv1fTransition {
  const battle = state.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn) return { state, events: [] }

  const actor = getCombatant(state, turn.combatantId)
  const marker = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_TURN_KEY,
  )
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (marker?.current === battle.turnNumber && economy) return { state, events: [] }

  const placement = state.tactical.placements.find((unit) => unit.combatantId === actor.id)!
  state = {
    ...state,
    turnOrigin: {
      combatantId: actor.id,
      turnNumber: battle.turnNumber,
      position: { ...placement.position },
    },
  }
  const cooldownTransition = advanceSkillCooldownsAtOwnerTurnStart(actor)
  const resources = replaceResources(cooldownTransition.combatant.temporaryResources, [
    {
      key: PV1F_ACTION_ECONOMY_RESOURCE_KEY,
      current: PV1F_ACTION_ECONOMY_MAXIMUM,
      maximum: PV1F_ACTION_ECONOMY_MAXIMUM,
    },
    {
      key: PV1F_ACTION_ECONOMY_TURN_KEY,
      current: battle.turnNumber,
      maximum: Number.MAX_SAFE_INTEGER,
    },
  ])

  return {
    state: withCombatantAndTurn(
      state,
      { ...cooldownTransition.combatant, temporaryResources: resources },
      {
        ...turn,
        actionState: 'ready',
      },
    ),
    events: cooldownTransition.events,
  }
}

export function preparePv1fTurnEconomy(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  return preparePv1fTurnEconomyTransition(state).state
}

export function pv1fCooldownForAction(actionId: string): SkillCooldownDefinition | null {
  if (actionId === PV1F_RECOVER_ACTION_ID || actionId === PV1F_MP_RECOVER_ACTION_ID) {
    return PV1F_RECOVERY_COOLDOWN
  }
  return null
}

export function readPv1fActionCooldown(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  actionId: string,
) {
  const definition = pv1fCooldownForAction(actionId)
  if (!definition) return null
  return readSkillCooldown(getCombatant(state, combatantId), definition)
}

export function pv1fActionCost(actionId: string): number {
  const cost = pv1fFlatActionCost(actionId)
  if (cost !== null) return cost
  throw new Error(`No PV-1F Action Economy cost is registered for ${actionId}.`)
}

export function canAffordPv1fEconomy(state: StatDrivenCombatEncounterState, cost: number): boolean {
  const economy = readPv1fActionEconomy(preparePv1fTurnEconomy(state))
  return Boolean(economy && economy.current >= cost)
}

export function spendPv1fActionEconomy(
  state: StatDrivenCombatEncounterState,
  cost: number,
): StatDrivenCombatEncounterState {
  if (!Number.isSafeInteger(cost) || cost < 0 || cost > PV1F_ACTION_ECONOMY_MAXIMUM) {
    throw new RangeError('Action Economy cost must be a safe integer from 0 to 100.')
  }

  const prepared = preparePv1fTurnEconomy(state)
  const battle = prepared.tactical.battle
  const turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn)
    throw new Error('Action Economy requires an active turn.')
  const actor = getCombatant(prepared, turn.combatantId)
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (!economy || economy.current < cost) {
    throw new Error('Not enough Action Economy remains for that command.')
  }

  const remaining = economy.current - cost
  const resources = replaceResources(actor.temporaryResources, [{ ...economy, current: remaining }])
  return withCombatantAndTurn(
    prepared,
    { ...actor, temporaryResources: resources },
    {
      ...turn,
      actionState:
        remaining >= Math.min(PV1F_BASIC_ATTACK_COST, PV1F_GUARD_COST) ? 'ready' : 'spent',
    },
  )
}

function spendPv1fActionEconomyForActor(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  cost: number,
): StatDrivenCombatEncounterState {
  if (state.tactical.battle.lifecycle === 'active') {
    if (state.tactical.battle.currentTurn?.combatantId === combatantId) {
      return spendPv1fActionEconomy(state, cost)
    }
    const defeatedActor = getCombatant(state, combatantId)
    if (defeatedActor.hp > 0) {
      throw new Error('Action Economy can only be spent by the active combatant.')
    }
    if (!Number.isSafeInteger(cost) || cost < 0 || cost > PV1F_ACTION_ECONOMY_MAXIMUM) {
      throw new RangeError('Action Economy cost must be a safe integer from 0 to 100.')
    }
    const economy = defeatedActor.temporaryResources.find(
      (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
    )
    if (!economy || economy.current < cost) {
      throw new Error('Not enough Action Economy remains for that command.')
    }
    return withCombatant(state, {
      ...defeatedActor,
      temporaryResources: replaceResources(defeatedActor.temporaryResources, [
        { ...economy, current: economy.current - cost },
      ]),
    })
  }

  if (state.tactical.battle.lifecycle !== 'completed') {
    throw new Error('Action Economy cannot be spent after that battle transition.')
  }
  if (!Number.isSafeInteger(cost) || cost < 0 || cost > PV1F_ACTION_ECONOMY_MAXIMUM) {
    throw new RangeError('Action Economy cost must be a safe integer from 0 to 100.')
  }

  const actor = getCombatant(state, combatantId)
  const economy = actor.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )
  if (!economy || economy.current < cost) {
    throw new Error('Not enough Action Economy remains for that command.')
  }

  const resources = replaceResources(actor.temporaryResources, [
    { ...economy, current: economy.current - cost },
  ])
  return withCombatant(state, { ...actor, temporaryResources: resources })
}

export function evaluatePv1fAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): {
  prepared: StatDrivenCombatEncounterState
  action: CombatActionDefinition
  cost: number
  evaluation: CombatActionEvaluation
} {
  const prepared = preparePv1fTurnEconomy(state)
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F action evaluation requires an active turn.')
  const action = resolvePv1fActionDefinition(prepared, actorId, actionId)
  const cost = pv1fActionCost(action.id)
  const baseEvaluation = evaluateCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
  const cooldownDefinition = pv1fCooldownForAction(action.id)
  const cooldown = cooldownDefinition
    ? readSkillCooldown(getCombatant(prepared, actorId), cooldownDefinition)
    : null
  const evaluation =
    cooldown?.active === true
      ? {
          ...baseEvaluation,
          legal: false,
          issues: [
            ...baseEvaluation.issues,
            {
              code: 'cooldown-active' as const,
              message: `That action is cooling down (${cooldown.ticksRemaining} owner-turn tick${cooldown.ticksRemaining === 1 ? '' : 's'} remain).`,
            },
          ],
        }
      : baseEvaluation
  return { prepared, action, cost, evaluation }
}

export function executePv1fAction(
  state: StatDrivenCombatEncounterState,
  actionId: string,
  target: CombatTargetSelection,
): Pv1fTransition {
  const { prepared, action, cost, evaluation } = evaluatePv1fAction(state, actionId, target)
  if (!evaluation.legal) {
    throw new Error(evaluation.issues[0]?.message ?? 'That action is not legal.')
  }
  if (!canAffordPv1fEconomy(prepared, cost)) {
    throw new Error('Not enough Action Economy remains for that action.')
  }

  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F action execution requires an active turn.')
  const transition =
    action.sourceType === 'basic-attack'
      ? executeStatDrivenAttack(prepared, action, target, PV1F_COMBAT_CONTENT)
      : (() => {
          const resolved = executeCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
          return {
            state: reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge),
            events: resolved.events,
          }
        })()
  let next = spendPv1fActionEconomyForActor(transition.state, actorId, cost)
  next = clearLastMatureSkill(next, actorId)
  const cooldownDefinition = pv1fCooldownForAction(action.id)
  const cooldownEvents: readonly unknown[] = cooldownDefinition
    ? (() => {
        const started = applySkillCooldown(getCombatant(next, actorId), cooldownDefinition, {
          actionId: action.id,
          definitionVersion: action.version,
        })
        next = withCombatant(next, started.combatant)
        return started.events
      })()
    : []
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...transition.events,
      ...cooldownEvents,
      { event: 'action_economy_spent', combatantId: actorId, amount: cost, remaining },
    ],
  }
}

export interface Pv1fMatureSkillCopyContext {
  sourceCombatantId: string
  sourceSkills: readonly MatureSkillDefinition[]
  actorCommittedSkills?: readonly MatureSkillDefinition[]
}

export interface Pv1fMatureSkillOptions {
  apCostOverride?: number
  repeatHistoryKey?: string
  copyContext?: Pv1fMatureSkillCopyContext
}

export function evaluatePv1fMatureSkill(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
  target: CombatTargetSelection,
  combatContext: MatureSkillCombatContext = 'pve',
  options: Pv1fMatureSkillOptions = {},
): {
  prepared: StatDrivenCombatEncounterState
  action: CombatActionDefinition
  cost: number
  evaluation: CombatActionEvaluation
  repeatPenaltyApplied: boolean
} {
  const prepared = preparePv1fTurnEconomy(state)
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Mature Skill evaluation requires an active turn.')
  const resolved = resolveMatureSkillForContext(definition, combatContext)
  const resonance = committedResonanceForecast(prepared, definition, target)
  const authoredAction = toCombatActionDefinition(definition, combatContext)
  const copyEffect = authoredAction.effects.find((effect) => effect.type === 'copy')
  const baseAction: CombatActionDefinition = {
    ...authoredAction,
    effects: authoredAction.effects.filter((effect) => effect.type !== 'copy'),
  }
  if (resonance?.forecast.willActivate)
    baseAction.effects = [...baseAction.effects, ...resonance.forecast.bonusEffects]
  const usageKey = options.repeatHistoryKey ?? definition.id
  const repeatPenaltyApplied = lastMatureSkillId(prepared, actorId) === usageKey
  const vengeance = materializeVengeanceDamage(prepared, baseAction)
  const defendedEffects: readonly CombatEffectDefinition[] = vengeance.action.effects.map(
    (effect) =>
      effect.type === 'damage'
        ? { ...effect, defenseKind: definition.tags.includes('mystic') ? 'ward' : 'armor' }
        : effect,
  )
  const action: CombatActionDefinition = {
    ...baseAction,
    cooldown: undefined,
    effects: repeatPenaltyApplied
      ? scaleRepeatedMatureSkillEffects(defendedEffects)
      : defendedEffects,
  }
  let evaluation = evaluateCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)
  if (
    copyEffect &&
    evaluation.legal &&
    evaluation.primaryCombatantId &&
    !(evaluation.targetHitChances ?? []).some(
      (chance) => chance.targetCombatantId === evaluation.primaryCombatantId,
    )
  ) {
    const copyHitChance = forecastCombatSkillAccuracyForTarget(
      prepared,
      action,
      actorId,
      evaluation.primaryCombatantId,
      PV1F_COMBAT_CONTENT,
    )
    if (copyHitChance) {
      evaluation = {
        ...evaluation,
        targetHitChances: [...(evaluation.targetHitChances ?? []), copyHitChance].sort(
          (left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId),
        ),
        projectionsAssumeHits: true,
      }
    }
  }
  if (copyEffect && evaluation.legal) {
    const primary = evaluation.primaryCombatantId
    const copyContext = options.copyContext
    if (!primary || !copyContext || copyContext.sourceCombatantId !== primary) {
      evaluation = {
        ...evaluation,
        legal: false,
        issues: [
          ...evaluation.issues,
          {
            code: 'requirement-not-met',
            message: "Copy requires the selected unit's committed regular Skill snapshot.",
          },
        ],
      }
    } else {
      const preview = previewCombatSkillCopy({
        state: prepared,
        actorCombatantId: actorId,
        sourceCombatantId: primary,
        sourceSkills: copyContext.sourceSkills,
        actorCommittedSkills: copyContext.actorCommittedSkills,
      })
      if (preview.issues.length > 0) {
        evaluation = {
          ...evaluation,
          legal: false,
          issues: [
            ...evaluation.issues,
            {
              code: 'requirement-not-met',
              message: preview.issues[0]!.message,
            },
          ],
        }
      } else {
        evaluation = { ...evaluation, skillCopy: preview }
      }
    }
  }
  const evaluatedWithVengeance =
    evaluation.legal && vengeance.basis.length > 0
      ? {
          ...evaluation,
          vengeanceBasis: vengeance.basis.map((basis) => ({
            ...basis,
            rawDamage: repeatPenaltyApplied
              ? halfPositiveMagnitude(basis.rawDamage)
              : basis.rawDamage,
          })),
        }
      : evaluation
  const authoredCost = options.apCostOverride ?? resolved.apCost
  return {
    prepared,
    action,
    cost: revealedSkillApCost(prepared, actorId, authoredCost),
    evaluation: evaluatedWithVengeance,
    repeatPenaltyApplied,
  }
}

export function executePv1fMatureSkill(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
  target: CombatTargetSelection,
  combatContext: MatureSkillCombatContext = 'pve',
  options: Pv1fMatureSkillOptions = {},
): Pv1fTransition {
  const { prepared, action, cost, evaluation, repeatPenaltyApplied } = evaluatePv1fMatureSkill(
    state,
    definition,
    target,
    combatContext,
    options,
  )
  if (!evaluation.legal) {
    throw new Error(evaluation.issues[0]?.message ?? 'That mature Skill is not legal.')
  }
  if (!canAffordPv1fEconomy(prepared, cost)) {
    throw new Error('Not enough Action Economy remains for that mature Skill.')
  }
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Mature Skill execution requires an active turn.')
  const resonance = committedResonanceForecast(prepared, definition, target)

  const copySourceId = evaluation.skillCopy?.sourceCombatantId ?? null
  const ordinaryAccuracyCoversCopy =
    copySourceId !== null &&
    action.accuracyMode === 'per-target' &&
    evaluateCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT).targetHitChances?.some(
      (chance) => chance.targetCombatantId === copySourceId,
    ) === true
  const dedicatedCopyAccuracy =
    copySourceId && action.accuracyMode === 'per-target' && !ordinaryAccuracyCoversCopy
      ? rollCombatSkillAccuracyForTarget(
          prepared,
          action,
          actorId,
          copySourceId,
          PV1F_COMBAT_CONTENT,
        )
      : { state: prepared, event: null }
  const executionState = reattachStatDrivenCombatBridge(
    dedicatedCopyAccuracy.state,
    prepared.statBridge,
  )
  const resolved = executeCombatAction(executionState, action, target, PV1F_COMBAT_CONTENT)
  const resolutionEvents = dedicatedCopyAccuracy.event
    ? [dedicatedCopyAccuracy.event, ...resolved.events]
    : resolved.events
  let next = reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge)
  next = spendPv1fActionEconomyForActor(next, actorId, cost)
  next = markLastMatureSkill(next, actorId, options.repeatHistoryKey ?? definition.id)

  let copyEvent: unknown = null
  if (evaluation.skillCopy && options.copyContext) {
    const missed = resolutionEvents.some(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'combat_accuracy_resolved' &&
        'targetCombatantId' in event &&
        event.targetCombatantId === evaluation.skillCopy!.sourceCombatantId &&
        'hit' in event &&
        event.hit === false,
    )
    if (!missed) {
      const copied = commitCombatSkillCopy({
        state: next,
        actorCombatantId: actorId,
        sourceCombatantId: options.copyContext.sourceCombatantId,
        sourceSkills: options.copyContext.sourceSkills,
        actorCommittedSkills: options.copyContext.actorCommittedSkills,
      })
      next = copied.state
      copyEvent = copied.event
    }
  }

  if (
    resonance &&
    (resonance.forecast.willActivate ||
      resonance.forecast.willExpireArmedSetup ||
      resonance.forecast.willArm)
  ) {
    const actor = getCombatant(next, actorId)
    const resources = actor.temporaryResources.filter(
      (resource) => !resource.key.startsWith(RESONANCE_ARMED_PREFIX),
    )
    if (resonance.forecast.willArm)
      resources.push({ key: `${RESONANCE_ARMED_PREFIX}${definition.id}`, current: 1, maximum: 1 })
    next = withCombatant(next, {
      ...actor,
      temporaryResources: resources.sort((a, b) => a.key.localeCompare(b.key)),
    })
  }
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...resolutionEvents,
      ...(resonance?.forecast.willActivate
        ? [
            {
              event: 'resonance_activated',
              resonanceId: resonance.definition.id,
              contentVersion: resonance.definition.contentVersion,
              actorId,
              setupActionId: resonance.armedByActionId,
              payoffActionId: definition.id,
            },
          ]
        : []),
      ...(resonance?.forecast.willExpireArmedSetup
        ? [
            {
              event: 'resonance_expired',
              resonanceId: resonance.definition.id,
              contentVersion: resonance.definition.contentVersion,
              actorId,
              setupActionId: resonance.armedByActionId,
              interruptedByActionId: definition.id,
            },
          ]
        : []),
      ...(resonance?.forecast.willArm
        ? [
            {
              event: 'resonance_armed',
              resonanceId: resonance.definition.id,
              contentVersion: resonance.definition.contentVersion,
              actorId,
              setupActionId: definition.id,
            },
          ]
        : []),
      ...(copyEvent ? [copyEvent] : []),
      ...(repeatPenaltyApplied
        ? [
            {
              event: 'skill_repeat_penalty_applied',
              combatantId: actorId,
              actionId: definition.id,
              effectivenessBasisPoints: PV1F_REPEAT_SKILL_EFFECTIVENESS_BASIS_POINTS,
            },
          ]
        : []),
      { event: 'action_economy_spent', combatantId: actorId, amount: cost, remaining },
    ],
  }
}

export function evaluatePv1fCopiedSkill(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
  target: CombatTargetSelection,
  combatContext: MatureSkillCombatContext = 'pve',
) {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Copied Skill evaluation requires an active turn.')
  const held = normalizeCombatEffectState(state.effectState).temporarySkills.some(
    (grant) =>
      grant.combatantId === actorId &&
      grant.skillId === definition.id &&
      grant.contentVersion === definition.contentVersion,
  )
  if (!held) throw new Error('That copied Skill is not granted to the active combatant.')
  return evaluatePv1fMatureSkill(state, definition, target, combatContext, {
    apCostOverride: copiedSkillApCost(definition, combatContext),
    repeatHistoryKey: copiedSkillUsageKey(definition.id, definition.contentVersion),
  })
}

export function executePv1fCopiedSkill(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
  target: CombatTargetSelection,
  combatContext: MatureSkillCombatContext = 'pve',
): Pv1fTransition {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('Copied Skill execution requires an active turn.')
  const held = normalizeCombatEffectState(state.effectState).temporarySkills.some(
    (grant) =>
      grant.combatantId === actorId &&
      grant.skillId === definition.id &&
      grant.contentVersion === definition.contentVersion,
  )
  if (!held) throw new Error('That copied Skill is not granted to the active combatant.')
  return executePv1fMatureSkill(state, definition, target, combatContext, {
    apCostOverride: copiedSkillApCost(definition, combatContext),
    repeatHistoryKey: copiedSkillUsageKey(definition.id, definition.contentVersion),
  })
}

/** Shared by authoritative movement and board highlights; does not spend resources. */
export function pv1fMovementModifiers(
  state: Pick<StatDrivenCombatEncounterState, 'statusState' | 'terrainOverlays'> & {
    tactical: { battle: Pick<StatDrivenCombatEncounterState['tactical']['battle'], 'currentTurn'> }
  },
) {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  const definitions = (
    state.statusState.find((row) => row.combatantId === actorId)?.statuses ?? []
  ).map((status) =>
    PV1F_COMBAT_CONTENT.statuses.find(
      (definition) =>
        definition.id === status.statusId && definition.version === status.statusVersion,
    ),
  )
  const rooted = definitions.some((definition) => definition?.movement?.blocked)
  const surcharge = Math.min(
    20,
    definitions.reduce(
      (sum, definition) => sum + (definition?.movement?.additionalApPerTile ?? 0),
      0,
    ),
  )
  const airborne = Boolean(
    actorId && hasGameplayTag(state, actorId, 'Airborne', PV1F_COMBAT_CONTENT),
  )
  return {
    blocked: rooted,
    additionalApAt: (position: GridPosition) =>
      surcharge +
      (!airborne && terrainOverlayAt(state, position)?.kind === 'frozen'
        ? COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.additionalApPerTile
        : 0),
  }
}

export interface Pv1fPoisonMovementForecast {
  traversedTiles: number
  triggeredTicks: number
  damage: number
  willDefeat: boolean
}

function forecastPv1fPoisonMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
): Pv1fPoisonMovementForecast {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return { traversedTiles: 0, triggeredTicks: 0, damage: 0, willDefeat: false }
  const actor = getCombatant(state, actorId)
  let shadow = state as CombatEncounterState
  let hp = actor.hp
  let traversedTiles = 0
  let triggeredTicks = 0

  for (let index = 1; index < path.length; index += 1) {
    const advanced = advanceCurrentPoisonMovement(shadow, actorId, 1)
    shadow = advanced.state
    traversedTiles += 1
    triggeredTicks += advanced.triggeredTicks
    if (advanced.triggeredTicks > 0) {
      hp = Math.max(0, hp - advanced.triggeredTicks * CURRENT_POISON_DAMAGE)
      if (hp === 0) break
    }
  }

  return {
    traversedTiles,
    triggeredTicks,
    damage: actor.hp - hp,
    willDefeat: actor.hp > 0 && hp === 0,
  }
}

export function evaluatePv1fMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
) {
  const prepared = preparePv1fTurnEconomy(state)
  let movement = evaluateCurrentMovementPath(prepared.tactical, path)
  const modifiers = pv1fMovementModifiers(prepared)
  if (modifiers.blocked) {
    movement.legal = false
    movement.issues = [
      ...movement.issues,
      {
        code: 'status-restricted',
        stepIndex: null,
        message: 'Root prevents movement until it expires or is cleansed.',
      },
    ]
  }

  const poisonForecast = movement.legal
    ? forecastPv1fPoisonMovement(prepared, path)
    : { traversedTiles: 0, triggeredTicks: 0, damage: 0, willDefeat: false }
  if (movement.legal && poisonForecast.traversedTiles < path.length - 1) {
    movement = evaluateCurrentMovementPath(
      prepared.tactical,
      path.slice(0, poisonForecast.traversedTiles + 1),
    )
  }
  const economyCost = movement.legal
    ? movement.path.slice(1).reduce((sum, position) => {
        const traversal = movementTraversalCostAt(prepared.tactical, movement.combatantId, position)
        if (traversal === null) throw new Error('Legal movement cannot enter blocked terrain.')
        return sum + movementApCostForTile(traversal, modifiers.additionalApAt(position))
      }, 0)
    : 0
  return { prepared, movement, economyCost, poisonForecast }
}

export function executePv1fMovement(
  state: StatDrivenCombatEncounterState,
  path: readonly GridPosition[],
): Pv1fTransition {
  const { prepared, movement, economyCost, poisonForecast } = evaluatePv1fMovement(state, path)
  if (!movement.legal)
    throw new Error(movement.issues[0]?.message ?? 'That movement path is not legal.')
  if (!canAffordPv1fEconomy(prepared, economyCost)) {
    throw new Error('Not enough Action Economy remains for that movement path.')
  }
  const actorId = prepared.tactical.battle.currentTurn?.combatantId
  if (!actorId) throw new Error('PV-1F movement requires an active turn.')
  const moved = moveCurrentCombatant(prepared.tactical, movement.path)
  let next = reattachStatDrivenCombatBridge(
    { ...prepared, ...createCombatEncounterState(moved.state, prepared.statusState) },
    prepared.statBridge,
  )
  const movementEffectEvents: unknown[] = []
  for (let index = 0; index < poisonForecast.traversedTiles; index += 1) {
    const resolved = resolveCombatMovementStepEffects(next, actorId, PV1F_COMBAT_CONTENT)
    next = reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge)
    movementEffectEvents.push(...resolved.events)
    if (getCombatant(next, actorId).hp <= 0) break
  }
  next = spendPv1fActionEconomyForActor(next, actorId, economyCost)
  next = clearLastMatureSkill(next, actorId)
  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0
  return {
    state: next,
    events: [
      ...moved.events,
      ...movementEffectEvents,
      { event: 'action_economy_spent', combatantId: actorId, amount: economyCost, remaining },
    ],
  }
}

export function finishPv1fTurn(
  state: StatDrivenCombatEncounterState,
  facing: BattleFacing,
  outgoingDefeatedAtTurnEnd = false,
): Pv1fTransition {
  const prepared = preparePv1fTurnEconomy(state)
  const selected = selectCurrentFinalFacing(prepared.tactical, facing)
  const encounter = reattachStatDrivenCombatBridge(
    { ...prepared, ...createCombatEncounterState(selected.state, prepared.statusState) },
    prepared.statBridge,
  )
  const ended = endCombatTurn(encounter, PV1F_COMBAT_CONTENT, outgoingDefeatedAtTurnEnd)
  const bridged = reattachStatDrivenCombatBridge(ended.state, prepared.statBridge)
  const nextTurn = preparePv1fTurnEconomyTransition(bridged)
  return {
    state: nextTurn.state,
    events: [...selected.events, ...ended.events, ...nextTurn.events],
  }
}

export function resolvePv1fActionDefinition(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  actionId: string,
): CombatActionDefinition {
  const actor = getCombatant(state, actorId)
  if (actionId === PV1F_BASIC_ATTACK_ID) {
    return createPv1fBasicAttackDefinition(readPv1fBasicAttackDamage(state, actorId))
  }
  if (actionId === PV1F_GUARD_ACTION_ID) return PV1F_GUARD_ACTION
  if (actionId === PV1F_RECOVER_ACTION_ID) return createPv1fRecoverAction(actor.maxHp)
  if (actionId === PV1F_MP_RECOVER_ACTION_ID) return createPv1fMpRecoveryAction(actor.maxMp)
  throw new Error(`Unsupported PV-1F action ${actionId}.`)
}

function lastMatureSkillId(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): string | null {
  const marker = getCombatant(state, combatantId).temporaryResources.find((resource) =>
    resource.key.startsWith(PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX),
  )
  return marker?.key.slice(PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX.length) ?? null
}

function clearLastMatureSkill(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
): StatDrivenCombatEncounterState {
  const combatant = getCombatant(state, combatantId)
  const temporaryResources = combatant.temporaryResources.filter(
    (resource) => !resource.key.startsWith(PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX),
  )
  if (temporaryResources.length === combatant.temporaryResources.length) return state
  return withCombatant(state, { ...combatant, temporaryResources })
}

function markLastMatureSkill(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  skillId: string,
): StatDrivenCombatEncounterState {
  const combatant = getCombatant(state, combatantId)
  const marker: BattleTemporaryResource = {
    key: `${PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX}${skillId}`,
    current: 1,
    maximum: 1,
  }
  const temporaryResources = [
    ...combatant.temporaryResources.filter(
      (resource) => !resource.key.startsWith(PV1F_LAST_MATURE_SKILL_RESOURCE_PREFIX),
    ),
    marker,
  ].sort((left, right) => left.key.localeCompare(right.key))
  return withCombatant(state, { ...combatant, temporaryResources })
}

function scaleRepeatedMatureSkillEffects(
  effects: readonly CombatEffectDefinition[],
): readonly CombatEffectDefinition[] {
  const scaled: CombatEffectDefinition[] = []
  for (const effect of effects) {
    if (effect.type === 'damage' || effect.type === 'healing' || effect.type === 'barrier-change') {
      scaled.push({ ...effect, amount: halfPositiveMagnitude(effect.amount) })
      continue
    }
    if (effect.type === 'resource-change') {
      scaled.push({ ...effect, delta: halfSignedMagnitude(effect.delta) })
      continue
    }
    if (effect.type === 'bleed') {
      scaled.push({ ...effect, damagePerTick: halfPositiveMagnitude(effect.damagePerTick) })
      continue
    }
    // Removal and Sensory are discrete: a consecutive repeat cannot resolve a half-strength copy.
    if (
      effect.type === 'remove-status' ||
      effect.type === 'return-to-turn-start' ||
      effect.type === 'create-terrain' ||
      effect.type === 'displace' ||
      effect.type === 'poison' ||
      effect.type === 'burn' ||
      effect.type === 'copy' ||
      effect.type === 'sensory'
    )
      continue
    if (effect.type === 'copy-statuses') {
      throw new TypeError('effects.status-copy-staged: repeat-use copying is not yet supported.')
    }
    const stacks = Math.floor(effect.stacks / 2)
    if (stacks > 0) scaled.push({ ...effect, stacks })
  }
  return scaled
}

function halfPositiveMagnitude(value: number): number {
  if (value <= 0) return 0
  return Math.max(1, Math.floor(value / 2))
}

function halfSignedMagnitude(value: number): number {
  if (value === 0) return 0
  const magnitude = Math.max(1, Math.floor(Math.abs(value) / 2))
  return value < 0 ? -magnitude : magnitude
}

function getCombatant(state: StatDrivenCombatEncounterState, combatantId: string): BattleCombatant {
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) throw new Error(`Unknown combatant ${combatantId}.`)
  return combatant
}

function replaceResources(
  current: readonly BattleTemporaryResource[],
  replacements: readonly BattleTemporaryResource[],
): readonly BattleTemporaryResource[] {
  const replacementKeys = new Set(replacements.map((resource) => resource.key))
  return [
    ...current
      .filter((resource) => !replacementKeys.has(resource.key))
      .map((resource) => ({ ...resource })),
    ...replacements.map((resource) => ({ ...resource })),
  ].sort((left, right) => left.key.localeCompare(right.key))
}

function withCombatant(
  state: StatDrivenCombatEncounterState,
  combatant: BattleCombatant,
): StatDrivenCombatEncounterState {
  const next: StatDrivenCombatEncounterState = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((candidate) =>
          candidate.id === combatant.id ? combatant : candidate,
        ),
      },
    },
  }
  const issues = validateStatDrivenCombatEncounterState(next)
  if (issues.length > 0) {
    throw new Error(`Invalid PV-1F combat state: ${issues[0]?.field}: ${issues[0]?.message}`)
  }
  return next
}

function withCombatantAndTurn(
  state: StatDrivenCombatEncounterState,
  combatant: BattleCombatant,
  currentTurn: NonNullable<StatDrivenCombatEncounterState['tactical']['battle']['currentTurn']>,
): StatDrivenCombatEncounterState {
  const next: StatDrivenCombatEncounterState = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((candidate) =>
          candidate.id === combatant.id ? combatant : candidate,
        ),
        currentTurn,
      },
    },
  }
  const issues = validateStatDrivenCombatEncounterState(next)
  if (issues.length > 0) {
    throw new Error(`Invalid PV-1F combat state: ${issues[0]?.field}: ${issues[0]?.message}`)
  }
  return next
}

const RESONANCE_ARMED_PREFIX = 'p35.resonance-armed:'
/** Resolve only the actor's immutable committed pair; neither UI selection nor a foreign actor can arm it. */
export function committedResonanceForecast(
  state: StatDrivenCombatEncounterState,
  skill: MatureSkillDefinition,
  selection?: CombatTargetSelection,
) {
  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return null
  const build = readBattleAuthorityCombatBuildSnapshot(state, actorId)
  const reference = build?.extensions.resonance
  if (
    !build ||
    !reference ||
    !build.disciplineSkills.some(
      (slot) => slot.skillId === skill.id && slot.contentVersion === skill.contentVersion,
    )
  )
    return null
  const definition = resolveResonanceForPair(
    build.primary.disciplineId,
    build.secondary?.disciplineId ?? null,
    reference.contentVersion,
  )
  if (!definition || definition.id !== reference.resonanceId) return null
  const marker = getCombatant(state, actorId).temporaryResources.find(
    (resource) => resource.key.startsWith(RESONANCE_ARMED_PREFIX) && resource.current === 1,
  )
  const markerActionId = marker?.key.slice(RESONANCE_ARMED_PREFIX.length)
  const setupSlot = build.disciplineSkills.find((slot) => slot.skillId === markerActionId)
  const setupSkill = setupSlot
    ? resolveMatureSkillVersion(setupSlot.skillId, setupSlot.contentVersion)
    : null
  const armedByActionId =
    setupSkill &&
    forecastResonanceForSkill(
      definition,
      {
        resonanceId: definition.id,
        contentVersion: definition.contentVersion,
        armedByActionId: null,
      },
      setupSkill,
    ).willArm
      ? setupSkill.id
      : null
  const forecast = forecastResonanceForSkill(
    definition,
    { resonanceId: definition.id, contentVersion: definition.contentVersion, armedByActionId },
    skill,
  )
  return {
    definition,
    armedByActionId,
    forecast: selection
      ? constrainResonanceForecastToTarget(
          forecast,
          skill,
          selection,
          evaluateCombatAction(
            state,
            { ...toCombatActionDefinition(skill, 'pve'), cooldown: undefined },
            selection,
            PV1F_COMBAT_CONTENT,
          ).affectedCombatantIds,
        )
      : forecast,
  }
}
