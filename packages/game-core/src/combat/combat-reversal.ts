import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import type { CombatControlledAbilityRecord } from './combat-controlled'
import type {
  CombatActionDefinition,
  CombatEncounterIssue,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatResolutionTransition,
  CombatSourceCommandVisibility,
} from './actions'

/** Version 1 fixes one trigger, front/sides, next actual owner start and one complete Strain turn. */
export interface CombatReversalPayload {
  readonly type: 'reversal'
  readonly recipient: 'actor'
  readonly version: 1
  readonly family: 'physical' | 'mystic'
  readonly reflectionBasisPoints: number
  readonly attackerMaxHpCapBasisPoints: number
  readonly defenderMaxHpCapBasisPoints: number
}
export type CombatReversalEndReason =
  'triggered' | 'expired' | 'revealed' | 'cancelled' | 'defeated' | 'battle-ended'
export type CombatReversalEvent = (
  | {
      readonly event: 'reversal_prepared'
      readonly actionId: string
      readonly combatantId: string
      readonly family: 'physical' | 'mystic'
    }
  | {
      readonly event: 'reversal_ended'
      readonly actionId: string
      readonly combatantId: string
      readonly reason: CombatReversalEndReason
    }
  | {
      readonly event: 'reversal_triggered'
      readonly actionId: string
      readonly combatantId: string
      readonly attackerCombatantId: string
      readonly incomingActionId: string
      readonly preventedDamage: number
      readonly returnedDamage: number
    }
  | { readonly event: 'reversal_strain_ended'; readonly combatantId: string }
) & { readonly sourceCommandVisibility?: CombatSourceCommandVisibility }
interface ArmedReversal extends CombatControlledAbilityRecord {
  readonly preparedTurnNumber: number
  readonly sourceCommandVisibility?: CombatSourceCommandVisibility
}
interface ReversalStrain {
  readonly combatantId: string
  readonly endedTurnNumber: number
  readonly activeTurnNumber?: number
}
export interface CombatReversalState {
  readonly version: 1
  readonly armed: readonly ArmedReversal[]
  readonly strain: readonly ReversalStrain[]
  readonly offensiveTurns: readonly { readonly combatantId: string; readonly turnNumber: number }[]
}
export function combatReversalPayload(
  behavior: Pick<AbilityBehavior, 'effects'>,
): CombatReversalPayload | undefined {
  return behavior.effects.find((effect) => effect.payload.type === 'reversal')?.payload as
    CombatReversalPayload | undefined
}
export function validateCombatReversalPayload(value: CombatReversalPayload): void {
  if (
    Object.keys(value).some(
      (key) =>
        ![
          'type',
          'recipient',
          'version',
          'family',
          'reflectionBasisPoints',
          'attackerMaxHpCapBasisPoints',
          'defenderMaxHpCapBasisPoints',
          'target',
        ].includes(key),
    )
  )
    throw new TypeError('Reversal version 1 has fixed trigger, arcs, lifetime and Strain policies.')
  if ('target' in value && value.target !== 'self')
    throw new TypeError('Reversal targets only Self.')
  if (
    value.version !== 1 ||
    value.recipient !== 'actor' ||
    !['physical', 'mystic'].includes(value.family)
  )
    throw new TypeError('Reversal requires version 1 and exactly one Physical or Mystic family.')
  for (const key of [
    'reflectionBasisPoints',
    'attackerMaxHpCapBasisPoints',
    'defenderMaxHpCapBasisPoints',
  ] as const) {
    const maximum = key === 'reflectionBasisPoints' ? 100000 : 10000
    if (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > maximum)
      throw new RangeError(`Reversal ${key} must be from 1 to ${maximum} basis points.`)
  }
}
export type CombatReversalReadState = Pick<
  CombatEncounterState,
  'reversalState' | 'capturedAbilitySources' | 'abilityRuntime'
>
function inventory(state: Pick<CombatEncounterState, 'reversalState'>): CombatReversalState {
  return state.reversalState ?? { version: 1, armed: [], strain: [], offensiveTurns: [] }
}
function matches(
  left: CombatControlledAbilityRecord,
  right: CombatControlledAbilityRecord,
): boolean {
  return (
    left.battleId === right.battleId &&
    left.ownerCombatantId === right.ownerCombatantId &&
    left.sourceInstanceId === right.sourceInstanceId &&
    left.abilityId === right.abilityId &&
    left.contentVersion === right.contentVersion &&
    left.behaviorId === right.behaviorId
  )
}
export function armedCombatReversalPayload(
  state: CombatReversalReadState,
  armed: ArmedReversal,
): CombatReversalPayload | undefined {
  const source = state.capturedAbilitySources?.find(
    (source) =>
      source.sourceInstanceId === armed.sourceInstanceId &&
      source.ownerCombatantId === armed.ownerCombatantId &&
      source.abilityId === armed.abilityId &&
      source.contentVersion === armed.contentVersion,
  )
  const behavior = source?.definition.behaviors.find((behavior) => behavior.id === armed.behaviorId)
  return behavior ? combatReversalPayload(behavior) : undefined
}
export function hasArmedCombatReversal(
  state: CombatReversalReadState,
  combatantId: string,
): boolean {
  return inventory(state).armed.some(
    (armed) =>
      armed.ownerCombatantId === combatantId &&
      state.abilityRuntime?.controlled?.primes.some((prime) => matches(prime, armed)),
  )
}
export function hasCombatReversalStrain(
  state: Pick<CombatEncounterState, 'reversalState'>,
  combatantId: string,
): boolean {
  return inventory(state).strain.some((row) => row.combatantId === combatantId)
}
export function combatReversalPreparationIssue(
  state: CombatEncounterState,
  actorId: string,
): string | undefined {
  if (
    state.tactical.battle.lifecycle !== 'active' ||
    state.tactical.battle.currentTurn?.combatantId !== actorId
  )
    return 'Reversal preparation requires the owner’s normal turn.'
  if (hasArmedCombatReversal(state, actorId)) return 'A Reversal is already armed.'
  if (hasCombatReversalStrain(state, actorId))
    return 'Reversal cannot be prepared during Reversal Strain.'
  if (
    state.statusState
      .find((row) => row.combatantId === actorId)
      ?.statuses.some(
        (status) => status.statusId === 'revealed' && status.timingState !== 'pending',
      )
  )
    return 'Active Revealed prevents Reversal preparation.'
  if (
    inventory(state).offensiveTurns.some(
      (row) => row.combatantId === actorId && row.turnNumber === state.tactical.battle.turnNumber,
    )
  )
    return 'Reversal cannot be prepared after an offensive attack during this turn.'
  return undefined
}
export function combatReversalAttackIssue(
  state: CombatEncounterState,
  actorId: string,
  action: Pick<
    CombatActionDefinition,
    'tags' | 'effects' | 'sourceType' | 'id' | 'nativeBasicAttackCommand'
  >,
): string | undefined {
  const offensive =
    action.tags.includes('attack') ||
    action.effects.some((effect) => effect.type === 'damage' && effect.recipient !== 'actor')
  if (!offensive) return undefined
  if (hasArmedCombatReversal(state, actorId))
    return 'Offensive attacks are unavailable while Reversal is armed.'
  if (
    hasCombatReversalStrain(state, actorId) &&
    !(
      action.sourceType === 'basic-attack' &&
      (action.nativeBasicAttackCommand === true || action.id === 'basic.attack.unarmed.basic')
    )
  )
    return 'Attack Skills are unavailable during Reversal Strain.'
  return undefined
}
export function recordCombatReversalOffense(
  state: CombatEncounterState,
  actorId: string,
  action: Pick<CombatActionDefinition, 'tags' | 'effects'>,
): CombatEncounterState {
  if (
    !action.tags.includes('attack') &&
    !action.effects.some((effect) => effect.type === 'damage' && effect.recipient !== 'actor')
  )
    return state
  if (
    !state.reversalState &&
    !state.effectState?.summons?.some(
      (summon) =>
        summon.combatantId === actorId &&
        summon.profile.abilities.some((ability) =>
          ability.effects.some((effect) => effect.type === 'reversal'),
        ),
    ) &&
    !state.capturedAbilitySources?.some(
      (source) =>
        source.ownerCombatantId === actorId &&
        source.definition.behaviors.some(combatReversalPayload),
    )
  )
    return state
  const ledger = inventory(state)
  return {
    ...state,
    reversalState: {
      ...ledger,
      offensiveTurns: [
        ...ledger.offensiveTurns.filter((row) => row.combatantId !== actorId),
        { combatantId: actorId, turnNumber: state.tactical.battle.turnNumber },
      ],
    },
  }
}
export function armCombatReversal(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): CombatResolutionTransition {
  const payload = combatReversalPayload(behavior)
  if (!payload) throw new TypeError('Reversal payload required.')
  const issue = combatReversalPreparationIssue(state, source.ownerCombatantId)
  if (issue) throw new TypeError(issue)
  const record: CombatControlledAbilityRecord = {
    battleId: state.tactical.battle.battleId,
    ownerCombatantId: source.ownerCombatantId,
    sourceInstanceId: source.sourceInstanceId,
    abilityId: source.abilityId,
    contentVersion: source.contentVersion,
    behaviorId: behavior.id,
  }
  const owner = state.tactical.battle.combatants.find(
    (unit) => unit.id === source.ownerCombatantId,
  )!
  const visibility = state.statusState
    .find((row) => row.combatantId === source.ownerCombatantId)
    ?.statuses.some((status) => status.statusId === 'covert')
    ? { kind: 'team-only' as const, teamId: owner.teamId }
    : undefined
  const armed = {
    ...record,
    preparedTurnNumber: state.tactical.battle.turnNumber,
    ...(visibility ? { sourceCommandVisibility: visibility } : {}),
  }
  const ledger = inventory(state),
    runtime = state.abilityRuntime!
  return {
    state: {
      ...state,
      reversalState: { ...ledger, armed: [...ledger.armed, armed] },
      abilityRuntime: {
        ...runtime,
        controlled: {
          primes: [...(runtime.controlled?.primes ?? []), record],
          used: [
            ...(runtime.controlled?.used ?? []).filter(
              (row) =>
                !(
                  row.ownerCombatantId === record.ownerCombatantId &&
                  row.abilityId === record.abilityId
                ),
            ),
            record,
          ],
        },
      },
    },
    events: [
      {
        event: 'reversal_prepared',
        actionId: source.abilityId,
        combatantId: source.ownerCombatantId,
        family: payload.family,
        ...(visibility ? { sourceCommandVisibility: visibility } : {}),
      },
    ],
  }
}
export function endCombatReversal(
  state: CombatEncounterState,
  combatantId: string,
  reason: CombatReversalEndReason,
): { state: CombatEncounterState; events: readonly CombatReversalEvent[] } {
  const ledger = inventory(state),
    armed = ledger.armed.filter((row) => row.ownerCombatantId === combatantId)
  if (!armed.length) return { state, events: [] }
  const strain: ReversalStrain = {
    combatantId,
    endedTurnNumber: state.tactical.battle.turnNumber,
    ...(reason === 'expired' && state.tactical.battle.currentTurn?.combatantId === combatantId
      ? { activeTurnNumber: state.tactical.battle.turnNumber }
      : {}),
  }
  return {
    state: {
      ...state,
      reversalState: {
        ...ledger,
        armed: ledger.armed.filter((row) => row.ownerCombatantId !== combatantId),
        strain: [...ledger.strain.filter((row) => row.combatantId !== combatantId), strain],
      },
      ...(state.abilityRuntime?.controlled
        ? {
            abilityRuntime: {
              ...state.abilityRuntime,
              controlled: {
                ...state.abilityRuntime.controlled,
                primes: state.abilityRuntime.controlled.primes.filter(
                  (prime) => !armed.some((row) => matches(row, prime)),
                ),
              },
            },
          }
        : {}),
    },
    events: armed.map((row) => ({
      event: 'reversal_ended',
      actionId: row.abilityId,
      combatantId,
      reason,
      ...(row.sourceCommandVisibility
        ? { sourceCommandVisibility: row.sourceCommandVisibility }
        : {}),
    })),
  }
}
export function beginCombatReversalOwnerTurn(
  state: CombatEncounterState,
  combatantId: string,
): CombatResolutionTransition {
  let next = state
  const events: CombatResolutionEvent[] = []
  if (
    inventory(next).armed.some(
      (row) =>
        row.ownerCombatantId === combatantId &&
        row.preparedTurnNumber < state.tactical.battle.turnNumber,
    )
  ) {
    const ended = endCombatReversal(next, combatantId, 'expired')
    next = ended.state
    events.push(...ended.events)
  }
  if (next.reversalState)
    next = {
      ...next,
      reversalState: {
        ...next.reversalState,
        strain: next.reversalState.strain.map((row) =>
          row.combatantId === combatantId &&
          row.activeTurnNumber === undefined &&
          row.endedTurnNumber <= state.tactical.battle.turnNumber
            ? { ...row, activeTurnNumber: state.tactical.battle.turnNumber }
            : row,
        ),
      },
    }
  return { state: next, events }
}
export function endCombatReversalOwnerTurn(
  state: CombatEncounterState,
  combatantId: string,
  turnNumber: number,
): CombatResolutionTransition {
  if (!state.reversalState) return { state, events: [] }
  const expired = state.reversalState.strain.some(
    (row) => row.combatantId === combatantId && row.activeTurnNumber === turnNumber,
  )
  return {
    state: {
      ...state,
      reversalState: {
        ...state.reversalState,
        strain: state.reversalState.strain.filter(
          (row) => !(row.combatantId === combatantId && row.activeTurnNumber === turnNumber),
        ),
      },
    },
    events: expired ? [{ event: 'reversal_strain_ended', combatantId }] : [],
  }
}
export function reconcileCombatReversalState(
  state: CombatEncounterState,
): CombatResolutionTransition {
  let next = state
  const events: CombatResolutionEvent[] = []
  for (const armed of inventory(state).armed) {
    const owner = next.tactical.battle.combatants.find((unit) => unit.id === armed.ownerCombatantId)
    const reason =
      next.tactical.battle.lifecycle !== 'active'
        ? 'battle-ended'
        : !owner || owner.hp <= 0
          ? 'defeated'
          : !hasArmedCombatReversal(next, armed.ownerCombatantId)
            ? 'cancelled'
            : undefined
    if (reason) {
      const out = endCombatReversal(next, armed.ownerCombatantId, reason)
      next = out.state
      events.push(...out.events)
    }
  }
  return { state: next, events }
}
export function combatReversalStatusProfiles(state: CombatReversalReadState, ownerId: string) {
  const armed = inventory(state).armed.find(
      (row) => row.ownerCombatantId === ownerId && hasArmedCombatReversal(state, ownerId),
    ),
    payload = armed && armedCombatReversalPayload(state, armed)
  return [
    ...(armed && payload
      ? [
          {
            kind: 'armed' as const,
            combatantId: ownerId,
            sourceAbilityId: armed.abilityId,
            family: payload.family,
            reflectionBasisPoints: payload.reflectionBasisPoints,
            attackerMaxHpCapBasisPoints: payload.attackerMaxHpCapBasisPoints,
            defenderMaxHpCapBasisPoints: payload.defenderMaxHpCapBasisPoints,
            ...(armed.sourceCommandVisibility
              ? { sourceCommandVisibility: armed.sourceCommandVisibility }
              : {}),
          },
        ]
      : []),
    ...(hasCombatReversalStrain(state, ownerId)
      ? [{ kind: 'strain' as const, combatantId: ownerId }]
      : []),
  ]
}
export function validateCombatReversalState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const ledger = state.reversalState
  if (ledger === undefined) return []
  const invalid = () => [
    { field: 'reversalState', message: 'Invalid private versioned Reversal authority.' },
  ]
  if (
    !ledger ||
    ledger.version !== 1 ||
    Object.keys(ledger).some(
      (key) => !['version', 'armed', 'strain', 'offensiveTurns'].includes(key),
    ) ||
    !Array.isArray(ledger.armed) ||
    !Array.isArray(ledger.strain) ||
    !Array.isArray(ledger.offensiveTurns)
  )
    return invalid()
  const ids = new Set<string>()
  for (const armed of ledger.armed) {
    if (
      !armed ||
      Object.keys(armed).some(
        (key) =>
          ![
            'battleId',
            'ownerCombatantId',
            'abilityId',
            'sourceInstanceId',
            'contentVersion',
            'behaviorId',
            'preparedTurnNumber',
            'sourceCommandVisibility',
          ].includes(key),
      ) ||
      ids.has(armed.ownerCombatantId) ||
      !Number.isSafeInteger(armed.preparedTurnNumber) ||
      armed.preparedTurnNumber < 1 ||
      armed.preparedTurnNumber > state.tactical.battle.turnNumber ||
      armed.battleId !== state.tactical.battle.battleId ||
      !armedCombatReversalPayload(state, armed) ||
      !state.abilityRuntime?.controlled?.primes.some((prime) => matches(prime, armed))
    )
      return invalid()
    ids.add(armed.ownerCombatantId)
  }
  const strains = new Set<string>()
  for (const row of ledger.strain) {
    if (
      !row ||
      Object.keys(row).some(
        (key) => !['combatantId', 'endedTurnNumber', 'activeTurnNumber'].includes(key),
      ) ||
      strains.has(row.combatantId) ||
      ids.has(row.combatantId) ||
      !state.tactical.battle.combatants.some((unit) => unit.id === row.combatantId) ||
      !Number.isSafeInteger(row.endedTurnNumber) ||
      row.endedTurnNumber < 1 ||
      row.endedTurnNumber > state.tactical.battle.turnNumber ||
      (row.activeTurnNumber !== undefined &&
        (!Number.isSafeInteger(row.activeTurnNumber) ||
          row.activeTurnNumber < row.endedTurnNumber ||
          row.activeTurnNumber > state.tactical.battle.turnNumber))
    )
      return invalid()
    strains.add(row.combatantId)
  }
  if (
    ledger.offensiveTurns.some(
      (row) =>
        !row ||
        !Number.isSafeInteger(row.turnNumber) ||
        row.turnNumber < 1 ||
        row.turnNumber > state.tactical.battle.turnNumber ||
        !state.tactical.battle.combatants.some((unit) => unit.id === row.combatantId),
    )
  )
    return invalid()
  return []
}

/** Read-only planning follows the same Covert visibility as public counter profiles.
 * The real command always settles against the original encounter, never this knowledge copy. */
export function combatReversalKnowledgeState<T extends CombatEncounterState>(
  state: T,
  actorId: string | undefined,
): T {
  if (!actorId || !state.reversalState?.armed.length) return state
  const actorTeam = state.tactical.battle.combatants.find((unit) => unit.id === actorId)?.teamId
  if (actorTeam === undefined) return state
  const hidden = state.reversalState.armed.filter((armed) => {
    const ownerTeam = state.tactical.battle.combatants.find(
      (unit) => unit.id === armed.ownerCombatantId,
    )?.teamId
    if (ownerTeam === actorTeam) return false
    const covert = state.statusState
      .find((row) => row.combatantId === armed.ownerCombatantId)
      ?.statuses.some((status) => status.statusId === 'covert' && status.timingState !== 'pending')
    const protectedPending =
      armed.sourceCommandVisibility?.kind === 'team-only' &&
      (state.pendingEffects ?? []).some(
        (pending) =>
          pending.actorId === armed.ownerCombatantId &&
          pending.sourceCommandVisibility &&
          pending.effect.type === 'apply-status' &&
          pending.effect.statusId === 'covert' &&
          pending.recipientIds.includes(armed.ownerCombatantId),
      )
    return covert || protectedPending
  })
  if (!hidden.length) return state
  return {
    ...state,
    reversalState: {
      ...state.reversalState,
      armed: state.reversalState.armed.filter((armed) => !hidden.includes(armed)),
    },
    ...(state.abilityRuntime?.controlled
      ? {
          abilityRuntime: {
            ...state.abilityRuntime,
            controlled: {
              ...state.abilityRuntime.controlled,
              primes: state.abilityRuntime.controlled.primes.filter(
                (prime) => !hidden.some((armed) => matches(armed, prime)),
              ),
            },
          },
        }
      : {}),
  }
}
