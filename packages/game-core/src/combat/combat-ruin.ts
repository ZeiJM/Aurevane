import type {
  CombatActionDefinition,
  CombatContentCatalog,
  CombatEffectDefinition,
  CombatEncounterIssue,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatStatusInstance,
} from './actions'
import { combatStatusApplications } from './combat-status-applications'
import type { CombatAttackTagCapture } from './combat-attack-tags'

export interface CombatRuinDebuffSnapshot {
  readonly statusId: string
  readonly applicationIds: readonly number[]
}
export interface CombatRuinState {
  version: 1
  nextApplicationId: number
  nextCommandId: number
  spentTargets: readonly { commandId: number; targetId: string }[]
}
const excluded = new Set(['reversal-strain', 'reckless', 'fortified'])
function activeStatus(status: CombatStatusInstance) {
  return (
    status.timingState !== 'pending' && status.stacks > 0 && status.remainingOwnerTurnStarts > 0
  )
}
function consumable(status: CombatStatusInstance, content: CombatContentCatalog) {
  return (
    activeStatus(status) &&
    !excluded.has(status.statusId) &&
    content.statuses.some(
      (definition) =>
        definition.id === status.statusId &&
        definition.version === status.statusVersion &&
        definition.polarity === 'negative',
    )
  )
}
function activeDot(dot: { remainingTicks?: number }) {
  return dot.remainingTicks === undefined || dot.remainingTicks > 0
}
function hasRuin(action: CombatActionDefinition) {
  return action.effects.some(
    (effect) =>
      effect.type === 'ruin' ||
      (effect.type === 'damage' &&
        effect.attackTagCapture?.ruinBonusPerDebuffBasisPoints !== undefined),
  )
}
/** Identities are assigned only at a Ruin capture boundary. New prefix applications remain distinct. */
export function prepareCombatRuinCommand(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  content: CombatContentCatalog,
  fresh = false,
): { state: CombatEncounterState; action: CombatActionDefinition } {
  if (
    state.ruinPolicyVersion !== 1 ||
    !hasRuin(action) ||
    (!fresh && action.ruinCommandId !== undefined)
  )
    return { state, action }
  let nextId = state.ruinState?.nextApplicationId ?? 1
  const allocate = () => {
    if (!Number.isSafeInteger(nextId) || nextId < 1 || nextId >= Number.MAX_SAFE_INTEGER)
      throw new RangeError('Ruin application identity overflow.')
    return nextId++
  }
  const statusState = state.statusState.map((row) => ({
    ...row,
    statuses: row.statuses.map((status) => {
      if (!consumable(status, content)) return status
      if (status.applicationModifiers)
        return {
          ...status,
          applicationModifiers: status.applicationModifiers.map((application) =>
            application.ruinApplicationId !== undefined
              ? application
              : { ...application, ruinApplicationId: allocate() },
          ),
        }
      return status.ruinApplicationId !== undefined
        ? status
        : { ...status, ruinApplicationId: allocate() }
    }),
  }))
  const effects = state.effectState
  const effectState = effects
    ? {
        ...effects,
        ...Object.fromEntries(
          (['poison', 'burn', 'bleed'] as const).map((type) => [
            type,
            effects[type].map((dot) =>
              !activeDot(dot) || dot.ruinApplicationId !== undefined
                ? dot
                : { ...dot, ruinApplicationId: allocate() },
            ),
          ]),
        ),
      }
    : effects
  const commandId = state.ruinState?.nextCommandId ?? 1
  if (!Number.isSafeInteger(commandId) || commandId < 1 || commandId >= Number.MAX_SAFE_INTEGER)
    throw new RangeError('Ruin command identity overflow.')
  return {
    state: {
      ...state,
      statusState,
      ...(effectState ? { effectState } : {}),
      ruinState: {
        version: 1,
        nextApplicationId: nextId,
        nextCommandId: commandId + 1,
        spentTargets: state.ruinState?.spentTargets ?? [],
      },
    },
    action: { ...action, ruinCommandId: commandId },
  }
}
export function captureCombatRuinDebuffs(
  state: CombatEncounterState,
  content: CombatContentCatalog,
): Readonly<Record<string, readonly CombatRuinDebuffSnapshot[]>> {
  return Object.fromEntries(
    state.tactical.battle.combatants.map((unit) => {
      const types = new Map<string, number[]>()
      for (const status of state.statusState.find((row) => row.combatantId === unit.id)?.statuses ??
        []) {
        if (!consumable(status, content)) continue
        const ids = combatStatusApplications(status).flatMap((application) =>
          application.ruinApplicationId === undefined ? [] : [application.ruinApplicationId],
        )
        if (ids.length) types.set(status.statusId, [...(types.get(status.statusId) ?? []), ...ids])
      }
      for (const type of ['poison', 'burn', 'bleed'] as const)
        for (const dot of state.effectState?.[type] ?? []) {
          if (
            dot.targetCombatantId === unit.id &&
            activeDot(dot) &&
            dot.ruinApplicationId !== undefined
          )
            types.set(type, [...(types.get(type) ?? []), dot.ruinApplicationId])
        }
      return [
        unit.id,
        [...types].map(([statusId, applicationIds]) => ({ statusId, applicationIds })),
      ]
    }),
  )
}
export function currentCombatRuinBonus(
  state: CombatEncounterState,
  effect: { attackTagCapture?: CombatAttackTagCapture },
  targetId: string,
  content: CombatContentCatalog,
): bigint {
  const capture = effect.attackTagCapture
  if (
    state.ruinPolicyVersion !== 1 ||
    capture?.ruinPolicyVersion !== 1 ||
    !state.ruinState ||
    !capture.ruinCommandId ||
    capture.ruinCommandId >= state.ruinState.nextCommandId ||
    !capture.ruinBonusPerDebuffBasisPoints ||
    (capture.eligibleRecipients?.ruin && !capture.eligibleRecipients.ruin.includes(targetId)) ||
    state.ruinState?.spentTargets.some(
      (row) => row.commandId === capture.ruinCommandId && row.targetId === targetId,
    )
  )
    return 0n
  const live = new Map(
    (captureCombatRuinDebuffs(state, content)[targetId] ?? []).map((row) => [
      row.statusId,
      new Set(row.applicationIds),
    ]),
  )
  const count = (capture.ruinDebuffsByTarget?.[targetId] ?? []).filter((row) =>
    row.applicationIds.some((id) => live.get(row.statusId)?.has(id)),
  ).length
  return BigInt(count) * BigInt(capture.ruinBonusPerDebuffBasisPoints)
}
/** Remove only captured applications still active now; shared clocks on survivors remain unchanged. */
export function consumeCombatRuin(
  state: CombatEncounterState,
  effect: { attackTagCapture?: CombatAttackTagCapture },
  targetId: string,
  content: CombatContentCatalog,
  actionId: string,
  actorId: string,
): { state: CombatEncounterState; events: CombatResolutionEvent[] } {
  const capture = effect.attackTagCapture!
  if (currentCombatRuinBonus(state, effect, targetId, content) <= 0n) return { state, events: [] }
  const live = new Map(
    (captureCombatRuinDebuffs(state, content)[targetId] ?? []).map((row) => [
      row.statusId,
      new Set(row.applicationIds),
    ]),
  )
  const ids = new Set(
    (capture.ruinDebuffsByTarget?.[targetId] ?? []).flatMap((row) =>
      row.applicationIds.filter((id) => live.get(row.statusId)?.has(id)),
    ),
  )
  const removedTypes = new Set<string>()
  const statusState = state.statusState.map((row) =>
    row.combatantId !== targetId
      ? row
      : {
          ...row,
          statuses: row.statuses.flatMap((status) => {
            if (!consumable(status, content)) return [status]
            const applications = combatStatusApplications(status)
            const surviving = applications.filter(
              (application) =>
                application.ruinApplicationId === undefined ||
                !ids.has(application.ruinApplicationId),
            )
            if (surviving.length === applications.length) return [status]
            removedTypes.add(status.statusId)
            if (!surviving.length) return []
            const next = {
              ...status,
              stacks: surviving.reduce((sum, application) => sum + application.stacks, 0),
              applicationModifiers: surviving,
            }
            delete next.ruinApplicationId
            return [next]
          }),
        },
  )
  const effects = state.effectState
  const effectState = effects
    ? {
        ...effects,
        ...Object.fromEntries(
          (['poison', 'burn', 'bleed'] as const).map((type) => [
            type,
            effects[type].filter((dot) => {
              const remove =
                dot.targetCombatantId === targetId &&
                dot.ruinApplicationId !== undefined &&
                ids.has(dot.ruinApplicationId)
              if (remove) removedTypes.add(type)
              return !remove
            }),
          ]),
        ),
      }
    : effects
  return {
    state: {
      ...state,
      statusState,
      ...(effectState ? { effectState } : {}),
      ruinState: {
        ...state.ruinState!,
        spentTargets: [
          ...state.ruinState!.spentTargets,
          { commandId: capture.ruinCommandId!, targetId },
        ],
      },
    },
    events: [...removedTypes].sort().map((statusId) => ({
      event: 'status_removed',
      actionId,
      sourceCombatantId: actorId,
      targetCombatantId: targetId,
      statusId,
      removalReason: 'ruin',
    })),
  }
}
export function validateCombatRuinState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const issues: CombatEncounterIssue[] = []
  if (
    state.ruinPolicyVersion !== undefined &&
    (state.ruinPolicyVersion !== 1 || state.effectStackingPolicyVersion !== 1)
  )
    issues.push({
      field: 'ruinPolicyVersion',
      message: 'Ruin consumption requires its current application-stacking policy.',
    })
  const tracking = state.ruinState
  if (
    tracking !== undefined &&
    (!tracking ||
      state.ruinPolicyVersion !== 1 ||
      tracking.version !== 1 ||
      ![tracking.nextApplicationId, tracking.nextCommandId].every(
        (id) => Number.isSafeInteger(id) && id > 0,
      ) ||
      !Array.isArray(tracking.spentTargets) ||
      tracking.spentTargets.some(
        (row) =>
          !row ||
          !Number.isSafeInteger(row.commandId) ||
          row.commandId < 1 ||
          row.commandId >= tracking.nextCommandId ||
          typeof row.targetId !== 'string' ||
          !row.targetId.trim(),
      ))
  )
    issues.push({ field: 'ruinState', message: 'Invalid private Ruin command identities.' })
  const commandTargets = Array.isArray(tracking?.spentTargets) ? tracking.spentTargets : []
  if (
    new Set(commandTargets.map((row) => JSON.stringify([row?.commandId, row?.targetId]))).size !==
    commandTargets.length
  )
    issues.push({ field: 'ruinState', message: 'Ruin command targets cannot be spent twice.' })
  const captures = [
    ...(Array.isArray(state.pendingEffects) ? state.pendingEffects : []).flatMap((row) =>
      row?.effect?.type === 'damage' ? [row.effect.attackTagCapture] : [],
    ),
    ...(Array.isArray(state.groundAreas) ? state.groundAreas : []).flatMap((area) =>
      Array.isArray(area?.entryEffects)
        ? area.entryEffects.flatMap((effect: CombatEffectDefinition) =>
            effect?.type === 'damage' ? [effect.attackTagCapture] : [],
          )
        : [],
    ),
  ]
  for (const capture of captures) {
    if (capture?.ruinPolicyVersion !== 1) continue
    if (
      state.ruinPolicyVersion !== 1 ||
      !tracking ||
      !Number.isSafeInteger(capture.ruinCommandId) ||
      capture.ruinCommandId! < 1 ||
      capture.ruinCommandId! >= tracking.nextCommandId ||
      Object.values(capture.ruinDebuffsByTarget ?? {}).some(
        (rows) =>
          !Array.isArray(rows) ||
          rows.some(
            (row) =>
              !row ||
              !Array.isArray(row.applicationIds) ||
              row.applicationIds.some(
                (id: number) =>
                  !Number.isSafeInteger(id) || id < 1 || id >= tracking.nextApplicationId,
              ),
          ),
      )
    )
      issues.push({
        field: 'ruinState',
        message: 'Ruin capture must reference committed command and application identities.',
      })
  }
  const ids = new Set<number>()
  for (const row of Array.isArray(state.statusState) ? state.statusState : [])
    for (const status of Array.isArray(row?.statuses) ? row.statuses : [])
      for (const application of Array.isArray(status.applicationModifiers)
        ? status.applicationModifiers
        : [status])
        validateId(application.ruinApplicationId)
  for (const type of ['poison', 'burn', 'bleed'] as const)
    for (const dot of Array.isArray(state.effectState?.[type]) ? state.effectState![type] : [])
      validateId(dot?.ruinApplicationId)
  function validateId(id: number | undefined) {
    if (id === undefined) return
    if (
      state.ruinPolicyVersion !== 1 ||
      !tracking ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id >= tracking.nextApplicationId ||
      ids.has(id)
    )
      issues.push({ field: 'ruinState', message: 'Invalid or reused Ruin application identity.' })
    ids.add(id)
  }
  return issues
}
