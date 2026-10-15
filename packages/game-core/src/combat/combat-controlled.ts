import type { CombatEncounterState, CombatEncounterIssue } from './actions'
import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import type { GridPosition } from './board'

const CONTROLLED_RECORD_FIELDS = [
  'battleId',
  'ownerCombatantId',
  'abilityId',
  'sourceInstanceId',
  'contentVersion',
  'behaviorId',
] as const

/** Private encounter memory. The admission bound survives cancel, removal and release. */
export interface CombatControlledAbilityRecord {
  readonly battleId: string
  readonly ownerCombatantId: string
  readonly abilityId: string
  readonly sourceInstanceId: string
  readonly contentVersion: number
  readonly behaviorId: string
  readonly returnAnchor?: GridPosition
}

export interface CombatControlledAbilityState {
  readonly primes: readonly CombatControlledAbilityRecord[]
  readonly used: readonly CombatControlledAbilityRecord[]
}

export function isControlledCombatAbility(behavior: AbilityBehavior): boolean {
  return (
    behavior.activation === 'manual' &&
    behavior.mode === 'action' &&
    behavior.effects.some((effect) => effect.timing === 'controlled')
  )
}

export function combatControlledAbilityKey(
  record: Pick<CombatControlledAbilityRecord, 'battleId' | 'ownerCombatantId' | 'abilityId'>,
): string {
  return JSON.stringify([record.battleId, record.ownerCombatantId, record.abilityId])
}

export function combatControlledPrime(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): CombatControlledAbilityRecord | undefined {
  return state.abilityRuntime?.controlled?.primes.find(
    (prime) =>
      prime.battleId === state.tactical.battle.battleId &&
      prime.ownerCombatantId === source.ownerCombatantId &&
      prime.abilityId === source.abilityId &&
      prime.sourceInstanceId === source.sourceInstanceId &&
      prime.contentVersion === source.contentVersion &&
      prime.behaviorId === behavior.id,
  )
}

export function reconcileCombatControlledAbilities(
  state: CombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[],
): CombatControlledAbilityState | undefined {
  const controlled = state.abilityRuntime?.controlled
  if (!controlled) return undefined
  return {
    used: controlled.used,
    primes: controlled.primes.filter(
      (prime) =>
        state.tactical.battle.lifecycle === 'active' &&
        prime.battleId === state.tactical.battle.battleId &&
        state.tactical.battle.combatants.some(
          (unit) => unit.id === prime.ownerCombatantId && unit.hp > 0,
        ) &&
        sources.some(
          (source) =>
            source.sourceInstanceId === prime.sourceInstanceId &&
            source.ownerCombatantId === prime.ownerCombatantId &&
            source.abilityId === prime.abilityId &&
            source.contentVersion === prime.contentVersion &&
            source.basic?.enabled !== false,
        ),
    ),
  }
}

export interface CombatControlledAbilityInput {
  readonly state: CombatEncounterState
  readonly actorId: string
  readonly sourceInstanceId: string
  readonly behaviorId: string
}

/** No selection, cost, action-use hooks or modifier bundle is admitted while priming. */
export function updateCombatControlledAbility(
  input: CombatControlledAbilityInput,
  operation: 'prime' | 'cancel',
): CombatEncounterState {
  const { state } = input
  const tracking = state.abilityRuntime
  const source = state.capturedAbilitySources?.find(
    (source) => source.sourceInstanceId === input.sourceInstanceId,
  )
  const behavior = source?.definition.behaviors.find((behavior) => behavior.id === input.behaviorId)
  if (
    !tracking ||
    !source ||
    source.ownerCombatantId !== input.actorId ||
    !behavior ||
    !isControlledCombatAbility(behavior) ||
    source.basic?.enabled === false ||
    !tracking.activeSourceIds.includes(source.sourceInstanceId)
  )
    throw new TypeError('controlled-source-unavailable')
  if (
    state.tactical.battle.lifecycle !== 'active' ||
    state.tactical.battle.currentTurn?.combatantId !== input.actorId ||
    !state.tactical.battle.combatants.some((unit) => unit.id === input.actorId && unit.hp > 0)
  )
    throw new TypeError('controlled-turn-unavailable')
  const record: CombatControlledAbilityRecord = {
    battleId: state.tactical.battle.battleId,
    ownerCombatantId: input.actorId,
    abilityId: source.abilityId,
    sourceInstanceId: source.sourceInstanceId,
    contentVersion: source.contentVersion,
    behaviorId: behavior.id,
    ...(behavior.effects.some((effect) => effect.payload.type === 'return-to-turn-start')
      ? {
          returnAnchor: {
            ...state.tactical.placements.find(
              (placement) => placement.combatantId === input.actorId,
            )!.position,
          },
        }
      : {}),
  }
  const key = combatControlledAbilityKey(record)
  const controlled = tracking.controlled ?? { primes: [], used: [] }
  const sequence = tracking.nextCommandSequence ?? 1
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence === Number.MAX_SAFE_INTEGER)
    throw new RangeError('command-sequence-overflow')
  if (
    operation === 'prime' &&
    controlled.used.some((used) => combatControlledAbilityKey(used) === key)
  )
    throw new TypeError('controlled-prime-used')
  if (operation === 'cancel' && !combatControlledPrime(state, source, behavior))
    throw new TypeError('controlled-prime-missing')
  return {
    ...state,
    abilityRuntime: {
      ...tracking,
      nextCommandSequence: sequence + 1,
      controlled:
        operation === 'prime'
          ? {
              primes: [...controlled.primes, record],
              used: [
                ...controlled.used,
                {
                  ...record,
                  ...(record.returnAnchor ? { returnAnchor: { ...record.returnAnchor } } : {}),
                },
              ],
            }
          : {
              used: controlled.used,
              primes: controlled.primes.filter(
                (prime) => combatControlledAbilityKey(prime) !== key,
              ),
            },
    },
  }
}

export function consumeCombatControlledPrime(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
): CombatEncounterState {
  if (!isControlledCombatAbility(behavior)) return state
  const prime = combatControlledPrime(state, source, behavior)
  if (!prime || !state.abilityRuntime?.controlled) throw new TypeError('controlled-prime-missing')
  return {
    ...state,
    abilityRuntime: {
      ...state.abilityRuntime,
      controlled: {
        ...state.abilityRuntime.controlled,
        primes: state.abilityRuntime.controlled.primes.filter((row) => row !== prime),
      },
    },
  }
}

export function validateCombatControlledAbilities(
  state: CombatEncounterState,
  sources: readonly CapturedCombatAbilitySource[] = state.capturedAbilitySources ?? [],
): readonly CombatEncounterIssue[] {
  const controlled = state.abilityRuntime?.controlled
  if (controlled === undefined) return []
  const invalid = (): readonly CombatEncounterIssue[] => [
    {
      field: 'abilityRuntime.controlled',
      message: 'Invalid private Controlled admission or prime inventory.',
    },
  ]
  if (
    !controlled ||
    typeof controlled !== 'object' ||
    Object.keys(controlled).some((key) => !['primes', 'used'].includes(key)) ||
    !Array.isArray(controlled.primes) ||
    !Array.isArray(controlled.used)
  )
    return invalid()
  const capacity = new Set(
    sources.map((source) => JSON.stringify([source.ownerCombatantId, source.abilityId])),
  ).size
  if (controlled.used.length > capacity || controlled.primes.length > controlled.used.length)
    return invalid()
  const usedKeys = new Set<string>()
  for (const record of controlled.used) {
    if (
      !record ||
      typeof record !== 'object' ||
      Object.keys(record).some(
        (key) => key !== 'returnAnchor' && !CONTROLLED_RECORD_FIELDS.includes(key as never),
      )
    )
      return invalid()
    const source = sources.find((source) => source.sourceInstanceId === record.sourceInstanceId)
    const behavior = source?.definition.behaviors.find(
      (behavior) => behavior.id === record.behaviorId,
    )
    const key = combatControlledAbilityKey(record)
    if (
      record.battleId !== state.tactical.battle.battleId ||
      !source ||
      !behavior ||
      !isControlledCombatAbility(behavior) ||
      !validControlledAnchor(state, record, behavior) ||
      record.ownerCombatantId !== source.ownerCombatantId ||
      record.abilityId !== source.abilityId ||
      record.contentVersion !== source.contentVersion ||
      usedKeys.has(key)
    )
      return invalid()
    usedKeys.add(key)
  }
  const primeKeys = new Set<string>()
  for (const prime of controlled.primes) {
    if (!prime || typeof prime !== 'object') return invalid()
    const key = combatControlledAbilityKey(prime)
    const used = controlled.used.find((row) => combatControlledAbilityKey(row) === key)
    if (
      !used ||
      Object.keys(prime).length !== Object.keys(used).length ||
      Object.keys(prime).some(
        (key) => key !== 'returnAnchor' && !CONTROLLED_RECORD_FIELDS.includes(key as never),
      ) ||
      CONTROLLED_RECORD_FIELDS.some((key) => prime[key] !== used[key]) ||
      prime.returnAnchor?.x !== used.returnAnchor?.x ||
      prime.returnAnchor?.y !== used.returnAnchor?.y ||
      (prime.returnAnchor !== undefined &&
        (typeof prime.returnAnchor !== 'object' ||
          prime.returnAnchor === null ||
          Object.keys(prime.returnAnchor).length !== 2 ||
          Object.keys(prime.returnAnchor).some((key) => key !== 'x' && key !== 'y'))) ||
      primeKeys.has(key)
    )
      return invalid()
    primeKeys.add(key)
  }
  return []
}

function validControlledAnchor(
  state: CombatEncounterState,
  record: CombatControlledAbilityRecord,
  behavior: AbilityBehavior,
): boolean {
  const needed = behavior.effects.some((effect) => effect.payload.type === 'return-to-turn-start')
  if (Object.keys(record).length !== CONTROLLED_RECORD_FIELDS.length + (needed ? 1 : 0))
    return false
  const anchor = record.returnAnchor
  if (!needed) return anchor === undefined
  return (
    !!anchor &&
    typeof anchor === 'object' &&
    Object.keys(anchor).length === 2 &&
    Object.keys(anchor).every((key) => key === 'x' || key === 'y') &&
    Number.isSafeInteger(anchor.x) &&
    Number.isSafeInteger(anchor.y) &&
    state.tactical.tiles.some(
      (tile) => tile.position.x === anchor.x && tile.position.y === anchor.y,
    )
  )
}
