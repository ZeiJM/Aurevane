import type {
  CombatEffectDefinition,
  CombatEncounterIssue,
  CombatEncounterState,
  CombatResolutionEvent,
  CombatSourceCommandVisibility,
} from './actions'
import { nextCombatDotApplicationOrder, usesUnlimitedCombatEffectStacking } from './combat-dots'
import { normalizeCombatEffectState, type CombatBarrierInstance } from './combat-effect-state'

export interface CombatBarrierGrantResult {
  state: CombatEncounterState
  before: number
  after: number
  applied: number
}

export interface CombatBarrierAbsorptionResult {
  state: CombatEncounterState
  before: number
  after: number
  absorbed: number
  remainingDamage: number
}

export function validateBarrierEffect(effect: CombatEffectDefinition): void {
  if (
    effect.type === 'damage' &&
    effect.shattersBarrier !== undefined &&
    effect.shattersBarrier !== true
  )
    throw new TypeError('Barrier shattering must be the trusted Pierce marker.')
  if (effect.type !== 'barrier-change') return
  if (!Number.isSafeInteger(effect.amount) || effect.amount <= 0) {
    throw new RangeError('Barrier amount must be a positive safe integer.')
  }
  if (effect.basis !== undefined && effect.basis !== 'maximum-hp-percent')
    throw new TypeError('Unknown Barrier basis.')
  if (effect.durationTurns !== undefined) validateBarrierDuration(effect.durationTurns)
  if (effect.basis === 'maximum-hp-percent' && effect.amount > 100)
    throw new RangeError('Barrier percentage must be from 1 to 100.')
}

export function barrierGrantAmount(
  state: Pick<CombatEncounterState, 'tactical'>,
  targetCombatantId: string,
  effect: Extract<CombatEffectDefinition, { type: 'barrier-change' }>,
): number {
  validateBarrierEffect(effect)
  if (effect.basis !== 'maximum-hp-percent') return effect.amount
  const target = state.tactical.battle.combatants.find((unit) => unit.id === targetCombatantId)
  if (!target) throw new TypeError('Unknown Barrier recipient.')
  return Math.max(1, Number((BigInt(target.maxHp) * BigInt(effect.amount)) / 100n))
}

export function currentBarrierAmount(
  state: CombatEncounterState,
  targetCombatantId: string,
): number {
  return barrierTotal(state.effectState?.barriers ?? [], targetCombatantId)
}

/** New temporary-HP rules also protect against ticks, backlash and reflected damage. */
export function absorbIndirectDamageWithBarrier(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  actionId: string,
  requested: number | bigint,
): CombatBarrierAbsorptionResult & { events: readonly CombatResolutionEvent[] } {
  if (typeof requested === 'number' && (!Number.isSafeInteger(requested) || requested < 0))
    throw new RangeError('Damage must be a non-negative safe integer.')
  const damage = BigInt(requested)
  if (damage < 0n) throw new RangeError('Damage must be non-negative.')
  const target = getCombatant(state, targetCombatantId)
  const before = currentBarrierAmount(state, targetCombatantId)
  const absorbed =
    state.modularSkillPolicyVersion === 1
      ? Number(damage < BigInt(before) ? damage : BigInt(before))
      : 0
  const result = absorbDirectDamageWithBarrier(state, targetCombatantId, absorbed)
  const remaining = damage - BigInt(absorbed)
  return {
    ...result,
    remainingDamage: Number(remaining < BigInt(target.hp) ? remaining : BigInt(target.hp)),
    events:
      absorbed > 0
        ? [
            {
              event: 'barrier_absorbed',
              actionId,
              sourceCombatantId,
              targetCombatantId,
              amount: absorbed,
              before,
              after: result.after,
            },
          ]
        : [],
  }
}

export function grantBarrier(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  amount: number,
  lifetime?: {
    durationTurns: number
    scope: 'owner-turns' | 'rounds'
    sourceCommandVisibility?: CombatSourceCommandVisibility
  },
): CombatBarrierGrantResult {
  assertIdentity(sourceCombatantId, 'Barrier source combatant ID')
  assertIdentity(targetCombatantId, 'Barrier target combatant ID')
  assertIdentity(sourceActionId, 'Barrier source action ID')
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError('Barrier amount must be a positive safe integer.')
  }

  if (lifetime !== undefined) {
    validateBarrierDuration(lifetime.durationTurns)
    if (lifetime.scope !== 'owner-turns' && lifetime.scope !== 'rounds')
      throw new TypeError('Unknown Barrier lifetime scope.')
  }
  const target = getCombatant(state, targetCombatantId)
  const before = currentBarrierAmount(state, targetCombatantId)
  const independent = usesUnlimitedCombatEffectStacking(state)
  const available = Math.max(0, target.maxHp - before)
  const applied = independent ? amount : Math.min(amount, available)
  if (BigInt(before) + BigInt(applied) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Barrier total exceeds the safe integer range.')
  if (applied === 0) {
    return { state, before, after: before, applied: 0 }
  }

  const effectState = normalizeCombatEffectState(state.effectState)
  const barriers = [...(effectState.barriers ?? [])]
  const existingIndex = barriers.findIndex(
    (barrier) =>
      barrier.targetCombatantId === targetCombatantId &&
      barrier.sourceCombatantId === sourceCombatantId &&
      barrier.sourceActionId === sourceActionId &&
      !hasBarrierLifetime(barrier),
  )

  if (!independent && lifetime === undefined && existingIndex >= 0) {
    const existing = barriers[existingIndex]!
    barriers[existingIndex] = { ...existing, amount: existing.amount + applied }
  } else {
    barriers.push({
      targetCombatantId,
      sourceCombatantId,
      sourceActionId,
      amount: applied,
      ...(independent || lifetime !== undefined
        ? {
            applicationOrder: nextCombatDotApplicationOrder(
              barriers.filter((barrier) => barrier.applicationOrder !== undefined),
            ),
          }
        : {}),
      ...(lifetime?.sourceCommandVisibility
        ? { sourceCommandVisibility: lifetime.sourceCommandVisibility }
        : {}),
      ...(lifetime === undefined
        ? {}
        : lifetime.scope === 'rounds'
          ? { remainingRoundBoundaries: lifetime.durationTurns }
          : { remainingOwnerTurnEnds: lifetime.durationTurns }),
    })
  }
  barriers.sort(compareBarrierInstances)

  return {
    state: { ...state, effectState: { ...effectState, barriers } },
    before,
    after: before + applied,
    applied,
  }
}

/** Advance only the authoritative boundary that owns each pool's captured clock. */
export function advanceBarrierLifetimes(
  state: CombatEncounterState,
  boundary: { kind: 'round' } | { kind: 'owner-turn'; combatantId: string },
): {
  state: CombatEncounterState
  events: Extract<CombatResolutionEvent, { event: 'barrier_changed' }>[]
} {
  const effects = state.effectState
  if (
    !effects?.barriers?.some((barrier) =>
      boundary.kind === 'round'
        ? barrier.remainingRoundBoundaries !== undefined
        : barrier.targetCombatantId === boundary.combatantId &&
          barrier.remainingOwnerTurnEnds !== undefined,
    )
  )
    return { state, events: [] }
  const events: Extract<CombatResolutionEvent, { event: 'barrier_changed' }>[] = []
  const totals = new Map<string, number>()
  const barriers = effects.barriers.flatMap((barrier) => {
    const clock = boundary.kind === 'round' ? 'remainingRoundBoundaries' : 'remainingOwnerTurnEnds'
    const remaining =
      boundary.kind === 'owner-turn' && barrier.targetCombatantId !== boundary.combatantId
        ? undefined
        : barrier[clock]
    if (remaining === undefined) return [barrier]
    if (remaining > 1) return [{ ...barrier, [clock]: remaining - 1 }]
    const before =
      totals.get(barrier.targetCombatantId) ??
      currentBarrierAmount(state, barrier.targetCombatantId)
    const after = before - barrier.amount
    totals.set(barrier.targetCombatantId, after)
    events.push({
      event: 'barrier_changed',
      reason: 'expired',
      actionId: barrier.sourceActionId,
      sourceCombatantId: barrier.sourceCombatantId,
      targetCombatantId: barrier.targetCombatantId,
      amount: -barrier.amount,
      before,
      after,
      ...(barrier.sourceCommandVisibility
        ? { sourceCommandVisibility: barrier.sourceCommandVisibility }
        : {}),
    })
    return []
  })
  return { state: { ...state, effectState: { ...effects, barriers } }, events }
}

function hasBarrierLifetime(barrier: {
  remainingOwnerTurnEnds?: unknown
  remainingRoundBoundaries?: unknown
}): boolean {
  return (
    barrier.remainingOwnerTurnEnds !== undefined || barrier.remainingRoundBoundaries !== undefined
  )
}
function validateBarrierDuration(duration: number): void {
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > 4)
    throw new RangeError('Barrier duration must be from 1 to 4 turns.')
}

export function absorbDirectDamageWithBarrier(
  state: CombatEncounterState,
  targetCombatantId: string,
  amount: number,
  options: { shatter?: boolean } = {},
): CombatBarrierAbsorptionResult {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError('Barrier damage input must be a non-negative safe integer.')
  }

  const before = currentBarrierAmount(state, targetCombatantId)
  if (before === 0 || amount === 0) {
    return {
      state,
      before,
      after: before,
      absorbed: 0,
      remainingDamage: amount,
    }
  }

  if (options.shatter) {
    const effectState = normalizeCombatEffectState(state.effectState)
    return {
      state: {
        ...state,
        effectState: {
          ...effectState,
          barriers: (effectState.barriers ?? []).filter(
            (barrier) => barrier.targetCombatantId !== targetCombatantId,
          ),
        },
      },
      before,
      after: 0,
      absorbed: 0,
      remainingDamage: amount,
    }
  }

  let remainingDamage = amount
  const effectState = normalizeCombatEffectState(state.effectState)
  const unrelated = (effectState.barriers ?? []).filter(
    (barrier) => barrier.targetCombatantId !== targetCombatantId,
  )
  const targetBarriers = (effectState.barriers ?? [])
    .filter((barrier) => barrier.targetCombatantId === targetCombatantId)
    .sort(compareBarrierInstances)
  const surviving: CombatBarrierInstance[] = []

  for (const barrier of targetBarriers) {
    const consumed = Math.min(barrier.amount, remainingDamage)
    const remainingBarrier = barrier.amount - consumed
    remainingDamage -= consumed
    if (remainingBarrier > 0) surviving.push({ ...barrier, amount: remainingBarrier })
  }

  const barriers = [...unrelated, ...surviving].sort(compareBarrierInstances)
  const absorbed = amount - remainingDamage
  const after = before - absorbed
  return {
    state: { ...state, effectState: { ...effectState, barriers } },
    before,
    after,
    absorbed,
    remainingDamage,
  }
}

export function validateBarrierState(state: CombatEncounterState): readonly CombatEncounterIssue[] {
  const raw = (state.effectState as unknown as { barriers?: unknown } | undefined)?.barriers
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    return [{ field: 'effectState.barriers', message: 'Barrier state must be an array.' }]
  }

  const issues: CombatEncounterIssue[] = []
  const combatants = new Map(
    state.tactical.battle.combatants.map((combatant) => [combatant.id, combatant]),
  )
  const independent = usesUnlimitedCombatEffectStacking(state)
  const seen = new Set<string>()
  const orders = new Set<number>()
  const totals = new Map<string, bigint>()

  raw.forEach((value, index) => {
    const field = `effectState.barriers[${index}]`
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ field, message: 'Barrier instance must be an object.' })
      return
    }

    const barrier = value as Record<string, unknown>
    const targetCombatantId = barrier.targetCombatantId
    const sourceCombatantId = barrier.sourceCombatantId
    const sourceActionId = barrier.sourceActionId
    const amount = barrier.amount

    if (!isIdentity(targetCombatantId)) {
      issues.push({ field: `${field}.targetCombatantId`, message: 'Invalid Barrier target.' })
    } else if (!combatants.has(targetCombatantId)) {
      issues.push({ field: `${field}.targetCombatantId`, message: 'Unknown Barrier target.' })
    }

    if (!isIdentity(sourceCombatantId)) {
      issues.push({ field: `${field}.sourceCombatantId`, message: 'Invalid Barrier source.' })
    } else if (!combatants.has(sourceCombatantId)) {
      issues.push({ field: `${field}.sourceCombatantId`, message: 'Unknown Barrier source.' })
    }

    if (!isIdentity(sourceActionId)) {
      issues.push({ field: `${field}.sourceActionId`, message: 'Invalid Barrier source action.' })
    }

    if (!Number.isSafeInteger(amount) || (amount as number) <= 0) {
      issues.push({
        field: `${field}.amount`,
        message: 'Barrier amount must be a positive safe integer.',
      })
    }

    if (
      isIdentity(targetCombatantId) &&
      isIdentity(sourceCombatantId) &&
      isIdentity(sourceActionId)
    ) {
      const key = `${targetCombatantId} ${sourceCombatantId} ${sourceActionId}`
      if (!independent && !hasBarrierLifetime(barrier) && seen.has(key))
        issues.push({ field, message: 'Duplicate Barrier source/action key.' })
      if (!hasBarrierLifetime(barrier)) seen.add(key)
    }

    for (const clock of ['remainingOwnerTurnEnds', 'remainingRoundBoundaries'] as const) {
      const remaining = barrier[clock]
      if (
        remaining !== undefined &&
        (!Number.isSafeInteger(remaining) || (remaining as number) < 1 || (remaining as number) > 4)
      )
        issues.push({
          field: `${field}.${clock}`,
          message: 'Barrier lifetime must be from 1 to 4 turns.',
        })
    }
    if (
      barrier.remainingOwnerTurnEnds !== undefined &&
      barrier.remainingRoundBoundaries !== undefined
    )
      issues.push({ field, message: 'Barrier must have only one lifetime clock.' })

    if (independent || hasBarrierLifetime(barrier) || barrier.applicationOrder !== undefined) {
      const order = barrier.applicationOrder
      if (!Number.isSafeInteger(order) || (order as number) <= 0 || orders.has(order as number))
        issues.push({
          field: `${field}.applicationOrder`,
          message: 'Barrier application order must be a unique positive safe integer.',
        })
      orders.add(order as number)
    }

    if (isIdentity(targetCombatantId) && Number.isSafeInteger(amount) && (amount as number) > 0) {
      totals.set(
        targetCombatantId,
        (totals.get(targetCombatantId) ?? 0n) + BigInt(amount as number),
      )
    }
  })

  for (const [targetCombatantId, total] of totals) {
    const target = combatants.get(targetCombatantId)
    if (total > BigInt(Number.MAX_SAFE_INTEGER))
      issues.push({
        field: 'effectState.barriers',
        message: `Barrier total for ${targetCombatantId} exceeds the safe integer range.`,
      })
    if (!independent && target && total > BigInt(target.maxHp)) {
      issues.push({
        field: 'effectState.barriers',
        message: `Barrier total for ${targetCombatantId} exceeds maximum HP.`,
      })
    }
  }

  return issues
}

function barrierTotal(
  barriers: readonly CombatBarrierInstance[],
  targetCombatantId: string,
): number {
  const total = barriers
    .filter((barrier) => barrier.targetCombatantId === targetCombatantId)
    .reduce((sum, barrier) => sum + BigInt(barrier.amount), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Barrier total exceeds the safe integer range.')
  }
  return Number(total)
}

function compareBarrierInstances(
  left: CombatBarrierInstance,
  right: CombatBarrierInstance,
): number {
  return (
    compareStableString(left.targetCombatantId, right.targetCombatantId) ||
    compareStableString(left.sourceCombatantId, right.sourceCombatantId) ||
    compareStableString(left.sourceActionId, right.sourceActionId) ||
    (left.applicationOrder ?? 0) - (right.applicationOrder ?? 0)
  )
}

function compareStableString(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function getCombatant(state: CombatEncounterState, combatantId: string) {
  const combatant = state.tactical.battle.combatants.find(
    (candidate) => candidate.id === combatantId,
  )
  if (!combatant) throw new Error(`Unknown combatant ${combatantId}.`)
  return combatant
}

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function assertIdentity(value: string, field: string): void {
  if (!isIdentity(value)) throw new TypeError(`${field} must be a non-empty trimmed string.`)
}
