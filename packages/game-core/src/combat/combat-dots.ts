import type { CombatEffectRecipient, CombatEncounterIssue, CombatEncounterState } from './actions'
import {
  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,
} from './combat-effect-state'

export const CURRENT_POISON_PROFILE_VERSION = 1 as const
export const CURRENT_POISON_DAMAGE = 2 as const
export const CURRENT_BLEED_MAX_STACKS = 3 as const
export const CURRENT_BLEED_MAX_TICKS = 4 as const
export const CURRENT_BLEED_MAX_RAW_TOTAL = 80 as const
export const CURRENT_BURN_PROFILE_VERSION = 1 as const
export const CURRENT_BURN_DAMAGE_BY_STAGE = [4, 3, 2] as const
export const CURRENT_BURN_BACKLASH_DAMAGE = 2 as const

/** Absence retains the historical per-effect caps and replacement rules. */
export function usesUnlimitedCombatEffectStacking(
  state: Pick<CombatEncounterState, 'effectStackingPolicyVersion'>,
): boolean {
  return state.effectStackingPolicyVersion === 1
}

export function compareCombatDotApplications(
  left: { targetCombatantId: string; applicationOrder?: number },
  right: { targetCombatantId: string; applicationOrder?: number },
): number {
  return (
    left.targetCombatantId.localeCompare(right.targetCombatantId) ||
    (left.applicationOrder ?? 0) - (right.applicationOrder ?? 0)
  )
}

export function nextCombatDotApplicationOrder(
  rows: readonly { applicationOrder?: number }[],
): number {
  let maximum = 0
  for (const row of rows) {
    if (!Number.isSafeInteger(row.applicationOrder) || (row.applicationOrder ?? 0) <= 0)
      throw new RangeError('DoT application order must be a positive safe integer.')
    maximum = Math.max(maximum, row.applicationOrder!)
  }
  if (maximum >= Number.MAX_SAFE_INTEGER)
    throw new RangeError('DoT application order has reached the safe integer limit.')
  return maximum + 1
}

function safeDotTotal(left: number, right: number): number {
  const total = left + right
  if (!Number.isSafeInteger(total))
    throw new RangeError('DoT aggregate has reached the safe integer limit.')
  return total
}

export function currentPoisonInstances(
  state: CombatEncounterState,
  targetCombatantId: string,
): readonly CombatPoisonInstance[] {
  return normalizeCombatEffectState(state.effectState)
    .poison.filter((row) => row.targetCombatantId === targetCombatantId)
    .sort(compareCombatDotApplications)
}

export function currentPoisonEndTurnInstances(
  state: CombatEncounterState,
  targetCombatantId: string,
): readonly CombatPoisonInstance[] {
  return currentPoisonInstances(state, targetCombatantId).filter(
    (row) => !row.skipCurrentOwnerTurnEnd,
  )
}

export function currentBurnInstances(
  state: CombatEncounterState,
  targetCombatantId: string,
): readonly CombatBurnInstance[] {
  return normalizeCombatEffectState(state.effectState)
    .burn.filter((row) => row.targetCombatantId === targetCombatantId)
    .sort(compareCombatDotApplications)
}

export interface CurrentPoisonEffect {
  type: 'poison'
  recipient: CombatEffectRecipient
  power?: number
  durationTurns?: number
  curseCopyable?: boolean
}

export function validateCurrentPoisonEffect(effect: {
  curseCopyable?: unknown
  power?: unknown
  durationTurns?: unknown
}): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Poison curseCopyable must be boolean when supplied.')
  }
  if (
    effect.power !== undefined &&
    (!Number.isSafeInteger(effect.power) ||
      (effect.power as number) < 1 ||
      (effect.power as number) > 20)
  ) {
    throw new RangeError('Poison power must be an integer from 1 to 20.')
  }
  if (
    effect.durationTurns !== undefined &&
    (!Number.isSafeInteger(effect.durationTurns) ||
      (effect.durationTurns as number) < 1 ||
      (effect.durationTurns as number) > 4)
  ) {
    throw new RangeError('Poison duration must be an integer from 1 to 4 turns.')
  }
}

export function currentPoisonInstance(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatPoisonInstance | null {
  return (
    normalizeCombatEffectState(state.effectState).poison.find(
      (instance) => instance.targetCombatantId === targetCombatantId,
    ) ?? null
  )
}

export function hasCurrentPoison(state: CombatEncounterState, targetCombatantId: string): boolean {
  return currentPoisonInstance(state, targetCombatantId) !== null
}

export function currentPoisonEndTurnDamage(
  state: CombatEncounterState,
  targetCombatantId: string,
): number {
  return currentPoisonEndTurnInstances(state, targetCombatantId).reduce(
    (sum, row) => safeDotTotal(sum, row.damagePerTick ?? CURRENT_POISON_DAMAGE),
    0,
  )
}

export function applyCurrentPoisonState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  curseCopyable?: boolean,
  power?: number,
  durationTurns?: number,
): CombatEncounterState {
  validateCurrentPoisonEffect({ curseCopyable, power, durationTurns })
  const effectState = normalizeCombatEffectState(state.effectState)
  const existing = effectState.poison.find(
    (instance) => instance.targetCombatantId === targetCombatantId,
  )
  const instance = {
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_POISON_PROFILE_VERSION,
    movementRemainder: usesUnlimitedCombatEffectStacking(state)
      ? 0
      : (existing?.movementRemainder ?? 0),
    ...(usesUnlimitedCombatEffectStacking(state)
      ? { applicationOrder: nextCombatDotApplicationOrder(effectState.poison) }
      : {}),
    ...(power !== undefined ? { damagePerTick: power } : {}),
    ...(durationTurns !== undefined ? { remainingTicks: durationTurns } : {}),
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  }

  return {
    ...state,
    effectState: {
      ...effectState,
      poison: [
        ...effectState.poison.filter(
          (candidate) =>
            usesUnlimitedCombatEffectStacking(state) ||
            candidate.targetCombatantId !== targetCombatantId,
        ),
        instance,
      ].sort(compareCombatDotApplications),
    },
  }
}

export function advanceCurrentPoisonEndTurn(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  const poison = effectState.poison.flatMap((instance) => {
    if (instance.targetCombatantId === targetCombatantId && instance.skipCurrentOwnerTurnEnd)
      return [{ ...instance, skipCurrentOwnerTurnEnd: undefined }]
    if (instance.targetCombatantId !== targetCombatantId || instance.remainingTicks === undefined) {
      return [instance]
    }
    return instance.remainingTicks <= 1
      ? []
      : [{ ...instance, remainingTicks: instance.remainingTicks - 1 }]
  })
  return { ...state, effectState: { ...effectState, poison } }
}

export function removeCurrentPoisonState(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      poison: effectState.poison.filter(
        (instance) => instance.targetCombatantId !== targetCombatantId,
      ),
    },
  }
}

export function advanceCurrentPoisonMovement(
  state: CombatEncounterState,
  targetCombatantId: string,
  traversedTiles: number,
): {
  state: CombatEncounterState
  triggeredTicks: number
  ticks: readonly { instance: CombatPoisonInstance; triggeredTicks: number }[]
} {
  if (!Number.isSafeInteger(traversedTiles) || traversedTiles < 0)
    throw new RangeError(
      'Poison movement progress requires a non-negative safe integer tile count.',
    )
  if (traversedTiles === 0) return { state, triggeredTicks: 0, ticks: [] }
  const effectState = normalizeCombatEffectState(state.effectState)
  const ticks = currentPoisonInstances(state, targetCombatantId).map((instance) => ({
    instance,
    triggeredTicks: Math.floor(safeDotTotal(instance.movementRemainder, traversedTiles) / 5),
  }))
  if (ticks.length === 0) return { state, triggeredTicks: 0, ticks: [] }
  const triggeredTicks = ticks.reduce((sum, row) => safeDotTotal(sum, row.triggeredTicks), 0)
  const poison = effectState.poison.map((instance) =>
    instance.targetCombatantId === targetCombatantId
      ? {
          ...instance,
          movementRemainder: safeDotTotal(instance.movementRemainder, traversedTiles) % 5,
        }
      : instance,
  )
  return { state: { ...state, effectState: { ...effectState, poison } }, triggeredTicks, ticks }
}

export function validateCurrentBleedEffect(effect: {
  damagePerTick: number
  ticks: number
  curseCopyable?: unknown
}): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Bleed curseCopyable must be boolean when supplied.')
  }
  if (!Number.isSafeInteger(effect.damagePerTick) || effect.damagePerTick <= 0) {
    throw new RangeError('Bleed damage per tick must be a positive safe integer.')
  }
  if (
    !Number.isSafeInteger(effect.ticks) ||
    effect.ticks < 1 ||
    effect.ticks > CURRENT_BLEED_MAX_TICKS
  ) {
    throw new RangeError('Bleed duration ticks must be an integer between 1 and 4.')
  }
  const total = BigInt(effect.damagePerTick) * BigInt(effect.ticks)
  if (total > BigInt(CURRENT_BLEED_MAX_RAW_TOTAL)) {
    throw new RangeError('Bleed raw per-stack total must not exceed 80 damage.')
  }
}

export function currentBleedStacks(
  state: CombatEncounterState,
  targetCombatantId: string,
): readonly CombatBleedStack[] {
  return normalizeCombatEffectState(state.effectState)
    .bleed.filter((stack) => stack.targetCombatantId === targetCombatantId)
    .sort((left, right) => left.applicationOrder - right.applicationOrder)
}

export function hasCurrentBleed(state: CombatEncounterState, targetCombatantId: string): boolean {
  return currentBleedStacks(state, targetCombatantId).length > 0
}

export function applyCurrentBleedState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  damagePerTick: number,
  ticks: number,
  curseCopyable?: boolean,
): CombatEncounterState {
  validateCurrentBleedEffect({ damagePerTick, ticks, curseCopyable })
  const effectState = normalizeCombatEffectState(state.effectState)
  const maximumOrder = effectState.bleed.reduce(
    (maximum, stack) => Math.max(maximum, stack.applicationOrder),
    0,
  )
  if (maximumOrder >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Bleed application order has reached the safe integer limit.')
  }
  const applicationOrder = maximumOrder + 1
  let bleed = [...effectState.bleed]
  const targetStacks = bleed
    .filter((stack) => stack.targetCombatantId === targetCombatantId)
    .sort(
      (left, right) =>
        left.remainingTicks - right.remainingTicks ||
        left.applicationOrder - right.applicationOrder,
    )
  if (
    !usesUnlimitedCombatEffectStacking(state) &&
    targetStacks.length >= CURRENT_BLEED_MAX_STACKS
  ) {
    const replaced = targetStacks[0]
    bleed = bleed.filter(
      (stack) =>
        stack.targetCombatantId !== replaced.targetCombatantId ||
        stack.applicationOrder !== replaced.applicationOrder,
    )
  }

  bleed.push({
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    damagePerTick,
    remainingTicks: ticks,
    applicationOrder,
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  })
  bleed.sort(
    (left, right) =>
      left.targetCombatantId.localeCompare(right.targetCombatantId) ||
      left.applicationOrder - right.applicationOrder,
  )

  return { ...state, effectState: { ...effectState, bleed } }
}

export function removeCurrentBleedState(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      bleed: effectState.bleed.filter((stack) => stack.targetCombatantId !== targetCombatantId),
    },
  }
}

export function advanceCurrentBleedEndTurn(
  state: CombatEncounterState,
  targetCombatantId: string,
): { state: CombatEncounterState; stacks: readonly CombatBleedStack[] } {
  const effectState = normalizeCombatEffectState(state.effectState)
  const stacks = effectState.bleed
    .filter(
      (stack) => stack.targetCombatantId === targetCombatantId && !stack.skipCurrentOwnerTurnEnd,
    )
    .sort((left, right) => left.applicationOrder - right.applicationOrder)
  if (!effectState.bleed.some((stack) => stack.targetCombatantId === targetCombatantId))
    return { state, stacks: [] }

  const bleed = effectState.bleed.flatMap((stack) => {
    if (stack.targetCombatantId !== targetCombatantId) return [stack]
    if (stack.skipCurrentOwnerTurnEnd) return [{ ...stack, skipCurrentOwnerTurnEnd: undefined }]
    if (stack.remainingTicks <= 1) return []
    return [{ ...stack, remainingTicks: stack.remainingTicks - 1 }]
  })
  return { state: { ...state, effectState: { ...effectState, bleed } }, stacks }
}

export function validateCurrentBurnEffect(effect: {
  curseCopyable?: unknown
  power?: unknown
  durationTurns?: unknown
}): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Burn curseCopyable must be boolean when supplied.')
  }
  if (
    effect.power !== undefined &&
    (!Number.isSafeInteger(effect.power) ||
      (effect.power as number) < 1 ||
      (effect.power as number) > 20)
  ) {
    throw new RangeError('Burn power must be an integer from 1 to 20.')
  }
  if (
    effect.durationTurns !== undefined &&
    (!Number.isSafeInteger(effect.durationTurns) ||
      (effect.durationTurns as number) < 1 ||
      (effect.durationTurns as number) > 4)
  ) {
    throw new RangeError('Burn duration must be an integer from 1 to 4 turns.')
  }
}

export function currentBurnInstance(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatBurnInstance | null {
  return (
    normalizeCombatEffectState(state.effectState).burn.find(
      (instance) => instance.targetCombatantId === targetCombatantId,
    ) ?? null
  )
}

export function hasCurrentBurn(state: CombatEncounterState, targetCombatantId: string): boolean {
  return currentBurnInstance(state, targetCombatantId) !== null
}

export function applyCurrentBurnState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  curseCopyable?: boolean,
  power?: number,
  durationTurns?: number,
): CombatEncounterState {
  validateCurrentBurnEffect({ curseCopyable, power, durationTurns })
  const effectState = normalizeCombatEffectState(state.effectState)
  const instance: CombatBurnInstance = {
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_BURN_PROFILE_VERSION,
    stage: 0,
    ...(usesUnlimitedCombatEffectStacking(state)
      ? { applicationOrder: nextCombatDotApplicationOrder(effectState.burn) }
      : {}),
    ...(power !== undefined ? { basePower: power } : {}),
    ...(durationTurns !== undefined ? { remainingTicks: durationTurns } : {}),
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  }
  return {
    ...state,
    effectState: {
      ...effectState,
      burn: [
        ...effectState.burn.filter(
          (candidate) =>
            usesUnlimitedCombatEffectStacking(state) ||
            candidate.targetCombatantId !== targetCombatantId,
        ),
        instance,
      ].sort(compareCombatDotApplications),
    },
  }
}

export function removeCurrentBurnState(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      burn: effectState.burn.filter((instance) => instance.targetCombatantId !== targetCombatantId),
    },
  }
}

export function advanceCurrentBurnEndTurn(
  state: CombatEncounterState,
  targetCombatantId: string,
): {
  state: CombatEncounterState
  instance: CombatBurnInstance | null
  damage: number
  ticks: readonly { instance: CombatBurnInstance; damage: number }[]
} {
  const effectState = normalizeCombatEffectState(state.effectState)
  const ticks = currentBurnInstances(state, targetCombatantId)
    .filter((row) => !row.skipCurrentOwnerTurnEnd)
    .map((instance) => {
      const damage =
        instance.basePower === undefined && instance.remainingTicks === undefined
          ? CURRENT_BURN_DAMAGE_BY_STAGE[instance.stage]
          : Math.max(1, (instance.basePower ?? CURRENT_BURN_DAMAGE_BY_STAGE[0]) - instance.stage)
      if (damage === undefined)
        throw new RangeError('Current Burn stage is outside the canonical profile.')
      return { instance, damage }
    })
  const damage = ticks.reduce((sum, row) => safeDotTotal(sum, row.damage), 0)
  const burn = effectState.burn.flatMap((instance) => {
    if (instance.targetCombatantId !== targetCombatantId) return [instance]
    if (instance.skipCurrentOwnerTurnEnd)
      return [{ ...instance, skipCurrentOwnerTurnEnd: undefined }]
    const stage = instance.stage + 1
    const remainingTicks =
      instance.remainingTicks === undefined ? undefined : instance.remainingTicks - 1
    if (
      remainingTicks !== undefined
        ? remainingTicks <= 0
        : stage >= CURRENT_BURN_DAMAGE_BY_STAGE.length
    )
      return []
    return [{ ...instance, stage, ...(remainingTicks === undefined ? {} : { remainingTicks }) }]
  })
  return {
    state: { ...state, effectState: { ...effectState, burn } },
    instance: ticks[0]?.instance ?? null,
    damage,
    ticks,
  }
}

export function validateCombatDotState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  if (!state.effectState) return []
  return [
    ...validateCurrentPoisonState(state),
    ...validateCurrentBleedState(state),
    ...validateCurrentBurnState(state),
  ]
}

function validateCurrentPoisonState(state: CombatEncounterState): readonly CombatEncounterIssue[] {
  const poison = state.effectState?.poison
  if (!Array.isArray(poison)) {
    return [{ field: 'effectState.poison', message: 'Poison state must be an array.' }]
  }

  const combatantIds = new Set(state.tactical.battle.combatants.map((row) => row.id))
  const targetIds = new Set<string>()
  const applicationOrders = new Set<number>()
  let previousOrder = 0
  let invalid = false
  let previousTargetId: string | null = null

  for (const instance of poison) {
    if (!instance || typeof instance !== 'object' || Array.isArray(instance)) {
      invalid = true
      continue
    }
    const independent = usesUnlimitedCombatEffectStacking(state)
    const order = instance.applicationOrder
    if (
      (independent || order !== undefined) &&
      (!Number.isSafeInteger(order) || (order ?? 0) <= 0 || applicationOrders.has(order!))
    )
      invalid = true
    if (
      independent &&
      previousTargetId === instance.targetCombatantId &&
      previousOrder >= (order ?? 0)
    )
      invalid = true
    if (order !== undefined) applicationOrders.add(order)
    previousOrder = order ?? 0
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_POISON_PROFILE_VERSION ||
      (instance.curseCopyable !== undefined && typeof instance.curseCopyable !== 'boolean') ||
      (instance.skipCurrentOwnerTurnEnd !== undefined &&
        typeof instance.skipCurrentOwnerTurnEnd !== 'boolean') ||
      !Number.isSafeInteger(instance.movementRemainder) ||
      instance.movementRemainder < 0 ||
      instance.movementRemainder > 4 ||
      (instance.damagePerTick !== undefined &&
        (!Number.isSafeInteger(instance.damagePerTick) ||
          instance.damagePerTick < 1 ||
          instance.damagePerTick > 20)) ||
      (instance.remainingTicks !== undefined &&
        (!Number.isSafeInteger(instance.remainingTicks) ||
          instance.remainingTicks < 1 ||
          instance.remainingTicks > 4)) ||
      (!independent && targetIds.has(instance.targetCombatantId)) ||
      (previousTargetId !== null && previousTargetId > instance.targetCombatantId)
    ) {
      invalid = true
    }
    targetIds.add(instance.targetCombatantId)
    previousTargetId = instance.targetCombatantId
  }

  return invalid
    ? [
        {
          field: 'effectState.poison',
          message:
            'Poison state must contain valid current-profile applications in stable target/application order with movement progress from 0 to 4; legacy state allows one instance per target.',
        },
      ]
    : []
}

function validateCurrentBurnState(state: CombatEncounterState): readonly CombatEncounterIssue[] {
  const burn = state.effectState?.burn
  if (!Array.isArray(burn)) {
    return [{ field: 'effectState.burn', message: 'Burn state must be an array.' }]
  }

  const combatantIds = new Set(state.tactical.battle.combatants.map((row) => row.id))
  const targetIds = new Set<string>()
  const applicationOrders = new Set<number>()
  let previousOrder = 0
  let invalid = false
  let previousTargetId: string | null = null

  for (const instance of burn) {
    if (!instance || typeof instance !== 'object' || Array.isArray(instance)) {
      invalid = true
      continue
    }
    const independent = usesUnlimitedCombatEffectStacking(state)
    const order = instance.applicationOrder
    if (
      (independent || order !== undefined) &&
      (!Number.isSafeInteger(order) || (order ?? 0) <= 0 || applicationOrders.has(order!))
    )
      invalid = true
    if (
      independent &&
      previousTargetId === instance.targetCombatantId &&
      previousOrder >= (order ?? 0)
    )
      invalid = true
    if (order !== undefined) applicationOrders.add(order)
    previousOrder = order ?? 0
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_BURN_PROFILE_VERSION ||
      (instance.curseCopyable !== undefined && typeof instance.curseCopyable !== 'boolean') ||
      (instance.skipCurrentOwnerTurnEnd !== undefined &&
        typeof instance.skipCurrentOwnerTurnEnd !== 'boolean') ||
      !Number.isSafeInteger(instance.stage) ||
      instance.stage < 0 ||
      instance.stage > 3 ||
      (instance.basePower === undefined &&
        instance.remainingTicks === undefined &&
        instance.stage >= CURRENT_BURN_DAMAGE_BY_STAGE.length) ||
      (instance.basePower !== undefined &&
        (!Number.isSafeInteger(instance.basePower) ||
          instance.basePower < 1 ||
          instance.basePower > 20)) ||
      (instance.remainingTicks !== undefined &&
        (!Number.isSafeInteger(instance.remainingTicks) ||
          instance.remainingTicks < 1 ||
          instance.remainingTicks > 4)) ||
      (!independent && targetIds.has(instance.targetCombatantId)) ||
      (previousTargetId !== null && previousTargetId > instance.targetCombatantId)
    ) {
      invalid = true
    }
    targetIds.add(instance.targetCombatantId)
    previousTargetId = instance.targetCombatantId
  }

  return invalid
    ? [
        {
          field: 'effectState.burn',
          message:
            'Burn state must contain valid current-profile applications in stable target/application order with valid decay stage and copy policy; legacy state allows one instance per target.',
        },
      ]
    : []
}

function validateCurrentBleedState(state: CombatEncounterState): readonly CombatEncounterIssue[] {
  const bleed = state.effectState?.bleed
  if (!Array.isArray(bleed)) {
    return [{ field: 'effectState.bleed', message: 'Bleed state must be an array.' }]
  }

  const combatantIds = new Set(state.tactical.battle.combatants.map((row) => row.id))
  const stackCounts = new Map<string, number>()
  const applicationOrders = new Set<number>()
  let invalid = false
  let previousTargetId: string | null = null
  let previousApplicationOrder = 0

  for (const stack of bleed) {
    if (!stack || typeof stack !== 'object' || Array.isArray(stack)) {
      invalid = true
      continue
    }
    const targetCount = (stackCounts.get(stack.targetCombatantId) ?? 0) + 1
    stackCounts.set(stack.targetCombatantId, targetCount)
    const rawTotalValid =
      Number.isSafeInteger(stack.damagePerTick) &&
      Number.isSafeInteger(stack.remainingTicks) &&
      stack.damagePerTick > 0 &&
      stack.remainingTicks >= 1 &&
      stack.remainingTicks <= CURRENT_BLEED_MAX_TICKS &&
      BigInt(stack.damagePerTick) * BigInt(stack.remainingTicks) <=
        BigInt(CURRENT_BLEED_MAX_RAW_TOTAL)
    const sorted =
      previousTargetId === null ||
      previousTargetId < stack.targetCombatantId ||
      (previousTargetId === stack.targetCombatantId &&
        previousApplicationOrder < stack.applicationOrder)

    if (
      !combatantIds.has(stack.targetCombatantId) ||
      !combatantIds.has(stack.sourceCombatantId) ||
      typeof stack.sourceActionId !== 'string' ||
      stack.sourceActionId.length === 0 ||
      stack.sourceActionId.trim() !== stack.sourceActionId ||
      (stack.curseCopyable !== undefined && typeof stack.curseCopyable !== 'boolean') ||
      (stack.skipCurrentOwnerTurnEnd !== undefined &&
        typeof stack.skipCurrentOwnerTurnEnd !== 'boolean') ||
      !rawTotalValid ||
      !Number.isSafeInteger(stack.applicationOrder) ||
      stack.applicationOrder <= 0 ||
      applicationOrders.has(stack.applicationOrder) ||
      (!usesUnlimitedCombatEffectStacking(state) && targetCount > CURRENT_BLEED_MAX_STACKS) ||
      !sorted
    ) {
      invalid = true
    }
    applicationOrders.add(stack.applicationOrder)
    previousTargetId = stack.targetCombatantId
    previousApplicationOrder = stack.applicationOrder
  }

  return invalid
    ? [
        {
          field: 'effectState.bleed',
          message:
            'Bleed state must contain valid independent stacks in stable application order, each with one to four remaining ticks and no more than 80 raw remaining damage; legacy state allows at most three stacks per target.',
        },
      ]
    : []
}
