import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEncounterState,
  CombatResolutionTransition,
  CombatStatusInstance,
} from './actions'

export interface CombatEndureProfile {
  readonly releaseBasisPoints: number
  readonly radiusTiles: number
  readonly targetTeams: 'enemies' | 'allies' | 'all'
}
export interface CombatEndureEffect extends CombatEndureProfile {
  readonly type: 'endure'
  readonly recipient: 'actor'
  readonly durationTurns: number
}
export interface CombatEndureState {
  readonly nextApplicationId: number
  readonly applications: readonly {
    readonly applicationId: number
    readonly combatantId: string
    readonly receivedDamage: number
  }[]
}
export function validateCombatEndureProfile(value: unknown): asserts value is CombatEndureProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Endure requires a release profile.')
  const profile = value as CombatEndureProfile
  if (
    Object.keys(profile).some(
      (key) => !['releaseBasisPoints', 'radiusTiles', 'targetTeams'].includes(key),
    ) ||
    !Number.isSafeInteger(profile.releaseBasisPoints) ||
    profile.releaseBasisPoints < 1 ||
    !Number.isSafeInteger(profile.radiusTiles) ||
    profile.radiusTiles < 1 ||
    profile.radiusTiles > 20 ||
    !['enemies', 'allies', 'all'].includes(profile.targetTeams)
  )
    throw new TypeError(
      'Endure requires a positive release percentage, radius 1–20 and target teams.',
    )
}
export function validateCombatEndureEffect(value: unknown): void {
  const effect = value as CombatEndureEffect & {
    target?: unknown
    power?: unknown
    potencyBasisPoints?: unknown
  }
  if (effect?.type !== 'endure') {
    if (
      (value as { type?: string; statusId?: string })?.type === 'apply-status' &&
      (value as { statusId?: string }).statusId === 'endure'
    )
      throw new TypeError('Use the Endure effect to create its private application.')
    return
  }
  validateCombatEndureProfile({
    releaseBasisPoints: effect.releaseBasisPoints,
    radiusTiles: effect.radiusTiles,
    targetTeams: effect.targetTeams,
  })
  if (
    effect.recipient !== 'actor' ||
    (effect.target !== undefined && effect.target !== 'self') ||
    !Number.isSafeInteger(effect.durationTurns) ||
    effect.durationTurns < 1 ||
    effect.durationTurns > 4 ||
    effect.power !== undefined ||
    effect.potencyBasisPoints !== undefined
  )
    throw new TypeError(
      'Endure requires Self and 1–4 turns; damage power and status potency are unsupported.',
    )
}
export function activeCombatEndure(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
): CombatStatusInstance | undefined {
  return state.statusState
    .find((row) => row.combatantId === combatantId)
    ?.statuses.find((status) => status.statusId === 'endure' && status.timingState !== 'pending')
}
function statusDealsDamage(statusId: string, content?: CombatContentCatalog): boolean {
  const definition = content?.statuses.find((status) => status.id === statusId)
  return definition
    ? definition.endOfTurn?.type === 'damage' && definition.endOfTurn.amount > 0
    : ['burn', 'poison', 'bleed'].includes(statusId)
}
export function combatEndureBlocksAction(
  state: Pick<CombatEncounterState, 'statusState' | 'effectState'>,
  actorId: string,
  action: Pick<CombatActionDefinition, 'effects' | 'sourceType'>,
  content?: CombatContentCatalog,
): boolean {
  if (!activeCombatEndure(state, actorId)) return false
  return (
    action.sourceType === 'basic-attack' ||
    action.effects.some((effect) => {
      if (effect.type === 'damage') return effect.amount > 0 || effect.vengeance !== undefined
      if (['burn', 'poison', 'bleed'].includes(effect.type)) return true
      if (effect.type === 'apply-status') return statusDealsDamage(effect.statusId, content)
      if (effect.type !== 'copy-statuses' || effect.mode !== 'curse') return false
      const selected = (id: string) =>
        effect.statusIds === undefined || effect.statusIds.includes(id)
      const statusDamage = state.statusState
        .find((row) => row.combatantId === actorId)
        ?.statuses.some((status) => {
          if (
            status.timingState === 'pending' ||
            !selected(status.statusId) ||
            !statusDealsDamage(status.statusId, content)
          )
            return false
          const definition = content?.statuses.find((row) => row.id === status.statusId)
          return (
            definition?.curseCopyable === true &&
            definition.polarity === 'negative' &&
            (definition.reactionClass === undefined ||
              ['ordinary', 'periodic', 'reactive'].includes(definition.reactionClass))
          )
        })
      return (
        Boolean(statusDamage) ||
        (['burn', 'poison', 'bleed'] as const).some(
          (id) =>
            selected(id) &&
            state.effectState?.[id].some(
              (row) => row.targetCombatantId === actorId && row.curseCopyable === true,
            ),
        )
      )
    })
  )
}
export function applyCombatEndure(
  state: CombatEncounterState,
  actorId: string,
  actionId: string,
  effect: CombatEndureEffect,
  content: CombatContentCatalog,
  rounds = false,
): CombatResolutionTransition {
  validateCombatEndureEffect(effect)
  const definition = content.statuses.find((status) => status.id === 'endure')
  if (!definition) throw new TypeError('Endure requires its captured status definition.')
  const previous = activeCombatEndure(state, actorId)
  const applicationId = state.endureState?.nextApplicationId ?? 1
  if (applicationId >= Number.MAX_SAFE_INTEGER)
    throw new RangeError('Endure application identity exceeds safe range.')
  const endure = {
    releaseBasisPoints: effect.releaseBasisPoints,
    radiusTiles: effect.radiusTiles,
    targetTeams: effect.targetTeams,
  }
  const status: CombatStatusInstance = {
    statusId: 'endure',
    statusVersion: definition.version,
    stacks: 1,
    sourceCombatantId: actorId,
    endure,
    timingState: 'active',
    remainingOwnerTurnStarts: effect.durationTurns,
    remainingOwnerTurnEnds: effect.durationTurns,
    ...(rounds
      ? { durationScope: 'rounds' as const, remainingRoundBoundaries: effect.durationTurns }
      : { skipCurrentOwnerTurnEnd: true }),
  }
  return {
    state: {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === actorId
          ? {
              ...row,
              statuses: [
                ...row.statuses.filter((status) => status.statusId !== 'endure'),
                status,
              ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
            }
          : row,
      ),
      endureState: {
        nextApplicationId: applicationId + 1,
        applications: [
          ...(state.endureState?.applications ?? []).filter((row) => row.combatantId !== actorId),
          { applicationId, combatantId: actorId, receivedDamage: 0 },
        ],
      },
    },
    events: [
      {
        event: 'status_applied',
        actionId,
        sourceCombatantId: actorId,
        targetCombatantId: actorId,
        statusId: 'endure',
        stacks: 1,
        remainingOwnerTurnStarts: effect.durationTurns,
        expiryBoundary: rounds ? 'round-end' : 'owner-turn-end',
        refreshed: Boolean(previous),
        stacked: false,
      },
    ],
  }
}
export function pruneCombatEndure(state: CombatEncounterState): CombatEncounterState {
  if (!state.endureState) return state
  const living = new Set(
    state.tactical.battle.lifecycle === 'active'
      ? state.tactical.battle.combatants.filter((unit) => unit.hp > 0).map((unit) => unit.id)
      : [],
  )
  const statusState = state.statusState.map((row) =>
    living.has(row.combatantId)
      ? row
      : { ...row, statuses: row.statuses.filter((status) => status.statusId !== 'endure') },
  )
  const next = { ...state, statusState }
  return {
    ...next,
    endureState: {
      ...state.endureState,
      applications: state.endureState.applications.filter(
        (row) => living.has(row.combatantId) && activeCombatEndure(next, row.combatantId),
      ),
    },
  }
}
/** Native receipts, not net HP changes, exclude costs, absorption and recovery automatically. */
export function recordCombatEndureMutation(
  before: CombatEncounterState,
  transition: CombatResolutionTransition,
): CombatEncounterState {
  const after = transition.state
  if (!before.endureState && !after.endureState) return after
  const applications = (after.endureState?.applications ?? []).map((application) => {
    const old = before.endureState?.applications.find(
      (row) =>
        row.applicationId === application.applicationId &&
        row.combatantId === application.combatantId,
    )
    if (!old || !activeCombatEndure(before, application.combatantId)) return application
    const amount = transition.events.reduce(
      (sum, event) =>
        event.event === 'damage_applied' &&
        event.targetCombatantId === application.combatantId &&
        event.amount > 0
          ? sum + event.amount
          : sum,
      0,
    )
    if (!amount) return application
    const receivedDamage = old.receivedDamage + amount
    if (!Number.isSafeInteger(receivedDamage))
      throw new RangeError('Endure received damage exceeds safe range.')
    return { ...application, receivedDamage }
  })
  return pruneCombatEndure(
    after.endureState ? { ...after, endureState: { ...after.endureState, applications } } : after,
  )
}
export function validateCombatEndureState(
  state: CombatEncounterState,
): readonly { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = []
  try {
    if (state.endureState !== undefined) {
      const ledger = state.endureState
      if (
        !ledger ||
        typeof ledger !== 'object' ||
        Array.isArray(ledger) ||
        Object.keys(ledger).some((key) => !['nextApplicationId', 'applications'].includes(key)) ||
        !Number.isSafeInteger(ledger.nextApplicationId) ||
        ledger.nextApplicationId < 1 ||
        !Array.isArray(ledger.applications) ||
        ledger.applications.length > state.tactical.battle.combatants.length ||
        new Set(ledger.applications.map((row) => row.combatantId)).size !==
          ledger.applications.length ||
        new Set(ledger.applications.map((row) => row.applicationId)).size !==
          ledger.applications.length
      )
        throw new TypeError('Invalid Endure ledger.')
      for (const row of ledger.applications)
        if (
          !row ||
          Object.keys(row).some(
            (key) => !['applicationId', 'combatantId', 'receivedDamage'].includes(key),
          ) ||
          !Number.isSafeInteger(row.applicationId) ||
          row.applicationId < 1 ||
          row.applicationId >= ledger.nextApplicationId ||
          !Number.isSafeInteger(row.receivedDamage) ||
          row.receivedDamage < 0 ||
          !state.tactical.battle.combatants.some(
            (unit) => unit.id === row.combatantId && unit.hp > 0,
          ) ||
          !activeCombatEndure(state, row.combatantId)
        )
          throw new TypeError('Invalid Endure application.')
    }
    for (const row of state.statusState)
      for (const status of row.statuses) {
        if (status.statusId === 'endure') {
          validateCombatEndureProfile(status.endure)
          if (
            status.timingState !== 'active' ||
            status.remainingOwnerTurnEnds !== status.remainingOwnerTurnStarts ||
            (status.durationScope !== undefined && status.durationScope !== 'rounds') ||
            (status.durationScope === 'rounds'
              ? status.remainingRoundBoundaries !== status.remainingOwnerTurnEnds ||
                status.skipCurrentOwnerTurnEnd !== undefined
              : status.remainingRoundBoundaries !== undefined)
          )
            throw new TypeError('Endure requires a bounded, matching owner-turn or round clock.')
          if (
            status.stacks !== 1 ||
            status.sourceCombatantId !== row.combatantId ||
            status.applicationModifiers !== undefined ||
            status.remainingOwnerTurnStarts < 1 ||
            status.remainingOwnerTurnStarts > 4 ||
            !state.endureState?.applications.some(
              (application) => application.combatantId === row.combatantId,
            )
          )
            throw new TypeError('Endure requires its private active application.')
        } else if (status.endure !== undefined)
          throw new TypeError('Endure profiles require Endure status.')
      }
  } catch (error) {
    issues.push({
      field: 'endureState',
      message: error instanceof Error ? error.message : 'Invalid Endure state.',
    })
  }
  return issues
}
