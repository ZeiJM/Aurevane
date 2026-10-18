import { applyAbilityTimingDefaults } from './combat-definition'
import type { CombatEncounterState, CombatEncounterIssue } from './actions'
import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import type { GridPosition } from './board'
import type { ManualCombatModifierSelection } from './combat-ability-command'
import { combatCanonicalModifierRootFacts as controlledModifierRootFacts } from './combat-modifier-compatibility'
import {
  resolveCombatManualModifierReferences,
  combatModifierRootCompatible,
} from './combat-manual-modifier-references'

interface ControlledManualModifierCapture extends ManualCombatModifierSelection {
  readonly abilityId: string
  readonly contentVersion: number
}

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
  /** Definitions remain in the encounter's immutable captured-source inventory. */
  readonly manualModifiers?: readonly ControlledManualModifierCapture[]
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
        ) &&
        (prime.manualModifiers ?? []).every((modifier) =>
          sources.some(
            (source) =>
              source.sourceInstanceId === modifier.sourceInstanceId &&
              source.ownerCombatantId === prime.ownerCombatantId &&
              source.abilityId === modifier.abilityId &&
              source.contentVersion === modifier.contentVersion,
          ),
        ),
    ),
  }
}

export interface CombatControlledAbilityInput {
  readonly state: CombatEncounterState
  readonly actorId: string
  readonly sourceInstanceId: string
  readonly behaviorId: string
  readonly manualModifiers?: readonly ManualCombatModifierSelection[]
}

/** Owner-only command presentation. Release readiness still requires a complete legal intent. */
export function combatControlledAbilityAvailability(input: CombatControlledAbilityInput):
  | {
      readonly phase: 'unprimed' | 'primed' | 'spent'
      readonly canPrime: boolean
      readonly canCancel: boolean
      readonly manualModifiers?: readonly ManualCombatModifierSelection[]
    }
  | undefined {
  const source = input.state.capturedAbilitySources?.find(
    (row) => row.sourceInstanceId === input.sourceInstanceId,
  )
  const authored = source?.definition.behaviors.find((row) => row.id === input.behaviorId)
  if (!source || source.ownerCombatantId !== input.actorId || !authored) return undefined
  const behavior = applyAbilityTimingDefaults(authored, input.state.effectTimingPolicy)
  if (!isControlledCombatAbility(behavior)) return undefined
  const prime = combatControlledPrime(input.state, source, behavior)
  const key = combatControlledAbilityKey({
    battleId: input.state.tactical.battle.battleId,
    ownerCombatantId: source.ownerCombatantId,
    abilityId: source.abilityId,
  })
  const used =
    input.state.effectTimingPolicy?.tagAuthority !== 'global' &&
    input.state.abilityRuntime?.controlled?.used.some(
      (row) => combatControlledAbilityKey(row) === key,
    )
  const allowed = (operation: 'prime' | 'cancel') => {
    try {
      updateCombatControlledAbility(
        operation === 'cancel' ? { ...input, manualModifiers: undefined } : input,
        operation,
      )
      return true
    } catch {
      return false
    }
  }
  return {
    phase: prime ? 'primed' : used ? 'spent' : 'unprimed',
    canPrime: !prime && !used && allowed('prime'),
    canCancel: !!prime && allowed('cancel'),
    ...(prime?.manualModifiers?.length
      ? {
          manualModifiers: prime.manualModifiers.map(({ sourceInstanceId, behaviorId }) => ({
            sourceInstanceId,
            behaviorId,
          })),
        }
      : {}),
  }
}

/** Free prime admits a structural bundle without targets, payment, clocks or action-use hooks. */
export function updateCombatControlledAbility(
  input: CombatControlledAbilityInput,
  operation: 'prime' | 'cancel',
): CombatEncounterState {
  const { state } = input
  const tracking = state.abilityRuntime
  const source = state.capturedAbilitySources?.find(
    (source) => source.sourceInstanceId === input.sourceInstanceId,
  )
  const authored = source?.definition.behaviors.find((behavior) => behavior.id === input.behaviorId)
  const behavior = authored
    ? applyAbilityTimingDefaults(authored, state.effectTimingPolicy)
    : undefined
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
  if (operation === 'cancel' && input.manualModifiers !== undefined)
    throw new TypeError('controlled-cancel-modifiers-invalid')
  const manualModifiers =
    operation === 'prime'
      ? resolveCombatManualModifierReferences(state, input.actorId, input.manualModifiers).map(
          ({ source: modifierSource, behavior: modifier }) => {
            if (!combatModifierRootCompatible(modifier, controlledModifierRootFacts(behavior)))
              throw new TypeError('modifier-root-incompatible')
            return Object.freeze({
              sourceInstanceId: modifierSource.sourceInstanceId,
              abilityId: modifierSource.abilityId,
              contentVersion: modifierSource.contentVersion,
              behaviorId: modifier.id,
            })
          },
        )
      : []
  const record: CombatControlledAbilityRecord = {
    battleId: state.tactical.battle.battleId,
    ownerCombatantId: input.actorId,
    abilityId: source.abilityId,
    sourceInstanceId: source.sourceInstanceId,
    contentVersion: source.contentVersion,
    behaviorId: behavior.id,
    ...(manualModifiers.length ? { manualModifiers: Object.freeze(manualModifiers) } : {}),
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
    (controlled.primes.some((prime) => combatControlledAbilityKey(prime) === key) ||
      (state.effectTimingPolicy?.tagAuthority !== 'global' &&
        controlled.used.some((used) => combatControlledAbilityKey(used) === key)))
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
                ...controlled.used.filter(
                  (used) =>
                    state.effectTimingPolicy?.tagAuthority !== 'global' ||
                    combatControlledAbilityKey(used) !== key,
                ),
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

/** A release may change legal targets, but cannot change the freely captured attachment set. */
export function assertCombatControlledModifierBundle(
  state: CombatEncounterState,
  prime: CombatControlledAbilityRecord,
  references?: readonly ManualCombatModifierSelection[],
): void {
  const selected = resolveCombatManualModifierReferences(state, prime.ownerCombatantId, references)
  const captured = prime.manualModifiers ?? []
  if (
    selected.length !== captured.length ||
    selected.some(({ source, behavior }, index) => {
      const expected = captured[index]!
      return (
        source.sourceInstanceId !== expected.sourceInstanceId ||
        source.abilityId !== expected.abilityId ||
        source.contentVersion !== expected.contentVersion ||
        behavior.id !== expected.behaviorId
      )
    })
  )
    throw new TypeError('controlled-modifier-bundle-mismatch')
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
        (key) =>
          !['returnAnchor', 'manualModifiers'].includes(key) &&
          !CONTROLLED_RECORD_FIELDS.includes(key as never),
      )
    )
      return invalid()
    const source = sources.find((source) => source.sourceInstanceId === record.sourceInstanceId)
    const authored = source?.definition.behaviors.find(
      (behavior) => behavior.id === record.behaviorId,
    )
    let behavior: AbilityBehavior | undefined
    try {
      behavior = authored
        ? applyAbilityTimingDefaults(authored, state.effectTimingPolicy)
        : undefined
    } catch {
      return invalid()
    }
    const key = combatControlledAbilityKey(record)
    if (
      record.battleId !== state.tactical.battle.battleId ||
      !source ||
      !behavior ||
      !isControlledCombatAbility(behavior) ||
      !validControlledAnchor(state, record, behavior) ||
      !validControlledModifiers(record, behavior, sources) ||
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
        (key) =>
          !['returnAnchor', 'manualModifiers'].includes(key) &&
          !CONTROLLED_RECORD_FIELDS.includes(key as never),
      ) ||
      CONTROLLED_RECORD_FIELDS.some((key) => prime[key] !== used[key]) ||
      prime.returnAnchor?.x !== used.returnAnchor?.x ||
      prime.returnAnchor?.y !== used.returnAnchor?.y ||
      !sameControlledModifiers(prime.manualModifiers, used.manualModifiers) ||
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
  if (
    Object.keys(record).length !==
    CONTROLLED_RECORD_FIELDS.length +
      (needed ? 1 : 0) +
      (record.manualModifiers !== undefined ? 1 : 0)
  )
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

function sameControlledModifiers(
  left: CombatControlledAbilityRecord['manualModifiers'],
  right: CombatControlledAbilityRecord['manualModifiers'],
): boolean {
  if (!Array.isArray(left) || !Array.isArray(right))
    return left === undefined && right === undefined
  return (
    left.length === right.length &&
    left.every((row, index) => {
      const other = right[index]
      return (
        row &&
        other &&
        row.sourceInstanceId === other.sourceInstanceId &&
        row.abilityId === other.abilityId &&
        row.contentVersion === other.contentVersion &&
        row.behaviorId === other.behaviorId &&
        Object.keys(row).length === Object.keys(other).length
      )
    })
  )
}

function validControlledModifiers(
  record: CombatControlledAbilityRecord,
  root: AbilityBehavior,
  sources: readonly CapturedCombatAbilitySource[],
): boolean {
  const rows = record.manualModifiers
  if (rows === undefined) return true
  if (!Array.isArray(rows) || rows.length > 15) return false
  const seen = new Set<string>()
  let previous: string[] | undefined
  return rows.every((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      Object.keys(row).length !== 4 ||
      Object.keys(row).some(
        (key) => !['sourceInstanceId', 'abilityId', 'contentVersion', 'behaviorId'].includes(key),
      )
    )
      return false
    const source = sources.find((source) => source.sourceInstanceId === row.sourceInstanceId)
    const behavior = source?.definition.behaviors.find((behavior) => behavior.id === row.behaviorId)
    const key = JSON.stringify([row.sourceInstanceId, row.behaviorId])
    if (
      !source ||
      !behavior ||
      source.ownerCombatantId !== record.ownerCombatantId ||
      source.abilityId !== row.abilityId ||
      source.contentVersion !== row.contentVersion ||
      behavior.activation !== 'manual' ||
      behavior.mode !== 'modifier' ||
      seen.has(key) ||
      (previous &&
        (previous[0]! > row.sourceInstanceId ||
          (previous[0] === row.sourceInstanceId && previous[1]! >= row.behaviorId))) ||
      !combatModifierRootCompatible(behavior, controlledModifierRootFacts(root))
    )
      return false
    seen.add(key)
    previous = [row.sourceInstanceId, row.behaviorId]
    return true
  })
}

/** Canonical area activation and Ground-only selection never identify an explicit unit. */
