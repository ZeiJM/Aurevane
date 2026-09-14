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
export const CURRENT_BLEED_MAX_RAW_TOTAL = 10 as const
export const CURRENT_BURN_PROFILE_VERSION = 1 as const
export const CURRENT_BURN_DAMAGE_BY_STAGE = [4, 3, 2] as const

export interface CurrentPoisonEffect {
  type: 'poison'
  recipient: CombatEffectRecipient
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
  return hasCurrentPoison(state, targetCombatantId) ? CURRENT_POISON_DAMAGE : 0
}

export function applyCurrentPoisonState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  const existing = effectState.poison.find(
    (instance) => instance.targetCombatantId === targetCombatantId,
  )
  const instance = {
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_POISON_PROFILE_VERSION,
    movementRemainder: existing?.movementRemainder ?? 0,
  }

  return {
    ...state,
    effectState: {
      ...effectState,
      poison: [
        ...effectState.poison.filter(
          (candidate) => candidate.targetCombatantId !== targetCombatantId,
        ),
        instance,
      ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
    },
  }
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
): { state: CombatEncounterState; triggeredTicks: number } {
  if (!Number.isSafeInteger(traversedTiles) || traversedTiles < 0) {
    throw new RangeError(
      'Poison movement progress requires a non-negative safe integer tile count.',
    )
  }
  if (traversedTiles === 0) return { state, triggeredTicks: 0 }

  const effectState = normalizeCombatEffectState(state.effectState)
  const existing = effectState.poison.find(
    (instance) => instance.targetCombatantId === targetCombatantId,
  )
  if (!existing) return { state, triggeredTicks: 0 }

  const total = existing.movementRemainder + traversedTiles
  const triggeredTicks = Math.floor(total / 5)
  const movementRemainder = total % 5
  const poison = effectState.poison.map((instance) =>
    instance.targetCombatantId === targetCombatantId
      ? { ...instance, movementRemainder }
      : instance,
  )

  return {
    state: { ...state, effectState: { ...effectState, poison } },
    triggeredTicks,
  }
}

export function validateCurrentBleedEffect(effect: { damagePerTick: number; ticks: number }): void {
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
    throw new RangeError('Bleed raw per-stack total must not exceed 10 damage.')
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
): CombatEncounterState {
  validateCurrentBleedEffect({ damagePerTick, ticks })
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
  if (targetStacks.length >= CURRENT_BLEED_MAX_STACKS) {
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
    .filter((stack) => stack.targetCombatantId === targetCombatantId)
    .sort((left, right) => left.applicationOrder - right.applicationOrder)
  if (stacks.length === 0) return { state, stacks: [] }

  const bleed = effectState.bleed.flatMap((stack) => {
    if (stack.targetCombatantId !== targetCombatantId) return [stack]
    if (stack.remainingTicks <= 1) return []
    return [{ ...stack, remainingTicks: stack.remainingTicks - 1 }]
  })
  return { state: { ...state, effectState: { ...effectState, bleed } }, stacks }
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
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  const instance: CombatBurnInstance = {
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_BURN_PROFILE_VERSION,
    stage: 0,
  }
  return {
    ...state,
    effectState: {
      ...effectState,
      burn: [
        ...effectState.burn.filter(
          (candidate) => candidate.targetCombatantId !== targetCombatantId,
        ),
        instance,
      ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
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
): { state: CombatEncounterState; instance: CombatBurnInstance | null; damage: number } {
  const effectState = normalizeCombatEffectState(state.effectState)
  const instance = effectState.burn.find(
    (candidate) => candidate.targetCombatantId === targetCombatantId,
  )
  if (!instance) return { state, instance: null, damage: 0 }

  const damage = CURRENT_BURN_DAMAGE_BY_STAGE[instance.stage]
  if (damage === undefined) {
    throw new RangeError('Current Burn stage is outside the canonical profile.')
  }
  const nextStage = instance.stage + 1
  const burn =
    nextStage >= CURRENT_BURN_DAMAGE_BY_STAGE.length
      ? effectState.burn.filter((candidate) => candidate.targetCombatantId !== targetCombatantId)
      : effectState.burn.map((candidate) =>
          candidate.targetCombatantId === targetCombatantId
            ? { ...candidate, stage: nextStage }
            : candidate,
        )

  return {
    state: { ...state, effectState: { ...effectState, burn } },
    instance,
    damage,
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
  let invalid = false
  let previousTargetId: string | null = null

  for (const instance of poison) {
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_POISON_PROFILE_VERSION ||
      !Number.isSafeInteger(instance.movementRemainder) ||
      instance.movementRemainder < 0 ||
      instance.movementRemainder > 4 ||
      targetIds.has(instance.targetCombatantId) ||
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
            'Poison state must contain one valid current-profile instance per target, sorted by target ID, with movement progress from 0 to 4.',
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
  let invalid = false
  let previousTargetId: string | null = null

  for (const instance of burn) {
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_BURN_PROFILE_VERSION ||
      !Number.isSafeInteger(instance.stage) ||
      instance.stage < 0 ||
      instance.stage >= CURRENT_BURN_DAMAGE_BY_STAGE.length ||
      targetIds.has(instance.targetCombatantId) ||
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
            'Burn state must contain one valid current-profile instance per target, sorted by target ID, with canonical stage 0 through 2.',
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
      !rawTotalValid ||
      !Number.isSafeInteger(stack.applicationOrder) ||
      stack.applicationOrder <= 0 ||
      applicationOrders.has(stack.applicationOrder) ||
      targetCount > CURRENT_BLEED_MAX_STACKS ||
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
            'Bleed state must contain at most three valid independent stacks per target in stable application order, each with one to four remaining ticks and no more than 10 raw remaining damage.',
        },
      ]
    : []
}
