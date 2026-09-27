import type { CombatEffectRecipient, CombatEncounterIssue, CombatEncounterState } from './actions'
import {
  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,
} from './combat-effect-state'
import { usesUnboundedEffectApplications } from './effect-application-rules'

export const CURRENT_POISON_PROFILE_VERSION = 1 as const
export const CURRENT_POISON_DAMAGE = 2 as const
export const CURRENT_BLEED_MAX_STACKS = 3 as const
export const CURRENT_BLEED_MAX_TICKS = 4 as const
export const CURRENT_BLEED_MAX_RAW_TOTAL = 10 as const
export const CURRENT_BURN_PROFILE_VERSION = 1 as const
export const CURRENT_BURN_DAMAGE_BY_STAGE = [4, 3, 2] as const
export const CURRENT_BURN_BACKLASH_DAMAGE = 2 as const

function dotOrder(value: { applicationOrder?: number }): number {
  return value.applicationOrder ?? 0
}

function compareDotApplication<
  T extends { targetCombatantId: string; applicationOrder?: number },
>(left: T, right: T): number {
  return (
    left.targetCombatantId.localeCompare(right.targetCombatantId) ||
    dotOrder(left) - dotOrder(right)
  )
}

function nextDotApplicationOrder(rows: readonly { applicationOrder?: number }[]): number {
  const maximum = rows.reduce((value, row) => Math.max(value, dotOrder(row)), 0)
  if (maximum >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Effect application order has reached the safe integer limit.')
  }
  return maximum + 1
}

export interface CurrentPoisonEffect {
  type: 'poison'
  recipient: CombatEffectRecipient
  curseCopyable?: boolean
}

export function validateCurrentPoisonEffect(effect: { curseCopyable?: unknown }): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Poison curseCopyable must be boolean when supplied.')
  }
}

export function currentPoisonInstances(
  state: CombatEncounterState,
  targetCombatantId: string,
): readonly CombatPoisonInstance[] {
  return normalizeCombatEffectState(state.effectState).poison
    .filter((instance) => instance.targetCombatantId === targetCombatantId)
    .sort(compareDotApplication)
}

export function currentPoisonInstance(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatPoisonInstance | null {
  return currentPoisonInstances(state, targetCombatantId)[0] ?? null
}

export function hasCurrentPoison(state: CombatEncounterState, targetCombatantId: string): boolean {
  return currentPoisonInstances(state, targetCombatantId).length > 0
}

export function currentPoisonEndTurnDamage(
  state: CombatEncounterState,
  targetCombatantId: string,
): number {
  const total =
    BigInt(currentPoisonInstances(state, targetCombatantId).length) * BigInt(CURRENT_POISON_DAMAGE)
  return Number(total > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : total)
}

export function applyCurrentPoisonState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  curseCopyable?: boolean,
): CombatEncounterState {
  validateCurrentPoisonEffect({ curseCopyable })
  const effectState = normalizeCombatEffectState(state.effectState)
  const unbounded = usesUnboundedEffectApplications(state)
  const existing = effectState.poison.find(
    (instance) => instance.targetCombatantId === targetCombatantId,
  )
  const instance: CombatPoisonInstance = {
    ...(unbounded ? { applicationOrder: nextDotApplicationOrder(effectState.poison) } : {}),
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_POISON_PROFILE_VERSION,
    movementRemainder: unbounded ? 0 : (existing?.movementRemainder ?? 0),
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  }

  return {
    ...state,
    effectState: {
      ...effectState,
      poison: (
        unbounded
          ? [...effectState.poison, instance]
          : [
              ...effectState.poison.filter(
                (candidate) => candidate.targetCombatantId !== targetCombatantId,
              ),
              instance,
            ]
      ).sort(compareDotApplication),
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
): {
  state: CombatEncounterState
  triggeredTicks: number
  triggered: readonly { instance: CombatPoisonInstance; ticks: number }[]
} {
  if (!Number.isSafeInteger(traversedTiles) || traversedTiles < 0) {
    throw new RangeError(
      'Poison movement progress requires a non-negative safe integer tile count.',
    )
  }
  if (traversedTiles === 0) return { state, triggeredTicks: 0, triggered: [] }

  const effectState = normalizeCombatEffectState(state.effectState)
  const triggered: { instance: CombatPoisonInstance; ticks: number }[] = []
  let triggeredTicks = 0
  const poison = effectState.poison.map((instance) => {
    if (instance.targetCombatantId !== targetCombatantId) return instance
    const total = instance.movementRemainder + traversedTiles
    const ticks = Math.floor(total / 5)
    if (ticks > 0) {
      triggered.push({ instance, ticks })
      triggeredTicks += ticks
    }
    return { ...instance, movementRemainder: total % 5 }
  })
  if (triggered.length === 0 && !poison.some((instance) => instance.targetCombatantId === targetCombatantId)) {
    return { state, triggeredTicks: 0, triggered: [] }
  }

  return {
    state: { ...state, effectState: { ...effectState, poison } },
    triggeredTicks,
    triggered,
  }
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
  if (!usesUnboundedEffectApplications(state)) {
    const targetApplications = bleed
      .filter((application) => application.targetCombatantId === targetCombatantId)
      .sort(
        (left, right) =>
          left.remainingTicks - right.remainingTicks ||
          left.applicationOrder - right.applicationOrder,
      )
    if (targetApplications.length >= CURRENT_BLEED_MAX_STACKS) {
      const replaced = targetApplications[0]!
      bleed = bleed.filter(
        (application) =>
          application.targetCombatantId !== replaced.targetCombatantId ||
          application.applicationOrder !== replaced.applicationOrder,
      )
    }
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

export function validateCurrentBurnEffect(effect: { curseCopyable?: unknown }): void {
  if (effect.curseCopyable !== undefined && typeof effect.curseCopyable !== 'boolean') {
    throw new TypeError('Burn curseCopyable must be boolean when supplied.')
  }
}

export function currentBurnInstances(
  state: CombatEncounterState,
  targetCombatantId: string,
): readonly CombatBurnInstance[] {
  return normalizeCombatEffectState(state.effectState).burn
    .filter((instance) => instance.targetCombatantId === targetCombatantId)
    .sort(compareDotApplication)
}

export function currentBurnInstance(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatBurnInstance | null {
  return currentBurnInstances(state, targetCombatantId)[0] ?? null
}

export function hasCurrentBurn(state: CombatEncounterState, targetCombatantId: string): boolean {
  return currentBurnInstances(state, targetCombatantId).length > 0
}

export function applyCurrentBurnState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
  curseCopyable?: boolean,
): CombatEncounterState {
  validateCurrentBurnEffect({ curseCopyable })
  const effectState = normalizeCombatEffectState(state.effectState)
  const unbounded = usesUnboundedEffectApplications(state)
  const instance: CombatBurnInstance = {
    ...(unbounded ? { applicationOrder: nextDotApplicationOrder(effectState.burn) } : {}),
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_BURN_PROFILE_VERSION,
    stage: 0,
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  }
  return {
    ...state,
    effectState: {
      ...effectState,
      burn: (
        unbounded
          ? [...effectState.burn, instance]
          : [
              ...effectState.burn.filter(
                (candidate) => candidate.targetCombatantId !== targetCombatantId,
              ),
              instance,
            ]
      ).sort(compareDotApplication),
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
  applications: readonly { instance: CombatBurnInstance; damage: number }[]
} {
  const effectState = normalizeCombatEffectState(state.effectState)
  const instances = currentBurnInstances(state, targetCombatantId)
  if (instances.length === 0) return { state, instance: null, damage: 0, applications: [] }

  let damage = 0
  const applications = instances.map((instance) => {
    const amount = CURRENT_BURN_DAMAGE_BY_STAGE[instance.stage]
    if (amount === undefined) {
      throw new RangeError('Current Burn stage is outside the canonical profile.')
    }
    damage += amount
    return { instance, damage: amount }
  })
  const expiring = new Set(
    instances
      .filter((instance) => instance.stage + 1 >= CURRENT_BURN_DAMAGE_BY_STAGE.length)
      .map((instance) => instance.applicationOrder ?? 0),
  )
  const burn = effectState.burn
    .flatMap((candidate) => {
      if (candidate.targetCombatantId !== targetCombatantId) return [candidate]
      if (expiring.has(candidate.applicationOrder ?? 0)) return []
      return [{ ...candidate, stage: candidate.stage + 1 }]
    })
    .sort(compareDotApplication)

  return {
    state: { ...state, effectState: { ...effectState, burn } },
    instance: instances[0] ?? null,
    damage,
    applications,
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
  const unbounded = usesUnboundedEffectApplications(state)
  const applicationOrders = new Set<number>()
  const targetIds = new Set<string>()
  let invalid = false
  let previousTargetId: string | null = null
  let previousApplicationOrder = -1

  for (const instance of poison) {
    const applicationOrder = dotOrder(instance)
    const sorted =
      previousTargetId === null ||
      previousTargetId < instance.targetCombatantId ||
      (previousTargetId === instance.targetCombatantId &&
        previousApplicationOrder < applicationOrder)
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_POISON_PROFILE_VERSION ||
      (instance.curseCopyable !== undefined && typeof instance.curseCopyable !== 'boolean') ||
      !Number.isSafeInteger(instance.movementRemainder) ||
      instance.movementRemainder < 0 ||
      instance.movementRemainder > 4 ||
      (unbounded
        ? instance.applicationOrder === undefined ||
          !Number.isSafeInteger(instance.applicationOrder) ||
          instance.applicationOrder < 1 ||
          applicationOrders.has(instance.applicationOrder)
        : instance.applicationOrder !== undefined || targetIds.has(instance.targetCombatantId)) ||
      !sorted
    ) {
      invalid = true
    }
    if (instance.applicationOrder !== undefined) applicationOrders.add(instance.applicationOrder)
    targetIds.add(instance.targetCombatantId)
    previousTargetId = instance.targetCombatantId
    previousApplicationOrder = applicationOrder
  }

  return invalid
    ? [
        {
          field: 'effectState.poison',
          message:
            unbounded
              ? 'Poison state must contain valid independent current-profile applications in stable order, with movement progress from 0 to 4 and optional boolean copy policy.'
              : 'Poison state must contain one valid current-profile instance per target, sorted by target ID, with movement progress from 0 to 4 and optional boolean copy policy.',
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
  const unbounded = usesUnboundedEffectApplications(state)
  const applicationOrders = new Set<number>()
  const targetIds = new Set<string>()
  let invalid = false
  let previousTargetId: string | null = null
  let previousApplicationOrder = -1

  for (const instance of burn) {
    const applicationOrder = dotOrder(instance)
    const sorted =
      previousTargetId === null ||
      previousTargetId < instance.targetCombatantId ||
      (previousTargetId === instance.targetCombatantId &&
        previousApplicationOrder < applicationOrder)
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_BURN_PROFILE_VERSION ||
      (instance.curseCopyable !== undefined && typeof instance.curseCopyable !== 'boolean') ||
      !Number.isSafeInteger(instance.stage) ||
      instance.stage < 0 ||
      instance.stage >= CURRENT_BURN_DAMAGE_BY_STAGE.length ||
      (unbounded
        ? instance.applicationOrder === undefined ||
          !Number.isSafeInteger(instance.applicationOrder) ||
          instance.applicationOrder < 1 ||
          applicationOrders.has(instance.applicationOrder)
        : instance.applicationOrder !== undefined || targetIds.has(instance.targetCombatantId)) ||
      !sorted
    ) {
      invalid = true
    }
    if (instance.applicationOrder !== undefined) applicationOrders.add(instance.applicationOrder)
    targetIds.add(instance.targetCombatantId)
    previousTargetId = instance.targetCombatantId
    previousApplicationOrder = applicationOrder
  }

  return invalid
    ? [
        {
          field: 'effectState.burn',
          message:
            unbounded
              ? 'Burn state must contain valid independent current-profile applications in stable order, with canonical stage 0 through 2 and optional boolean copy policy.'
              : 'Burn state must contain one valid current-profile instance per target, sorted by target ID, with canonical stage 0 through 2 and optional boolean copy policy.',
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
  const unbounded = usesUnboundedEffectApplications(state)
  const applicationOrders = new Set<number>()
  const targetCounts = new Map<string, number>()
  let invalid = false
  let previousTargetId: string | null = null
  let previousApplicationOrder = 0

  for (const stack of bleed) {
    const targetCount = (targetCounts.get(stack.targetCombatantId) ?? 0) + 1
    targetCounts.set(stack.targetCombatantId, targetCount)
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
      !rawTotalValid ||
      !Number.isSafeInteger(stack.applicationOrder) ||
      stack.applicationOrder <= 0 ||
      applicationOrders.has(stack.applicationOrder) ||
      (!unbounded && targetCount > CURRENT_BLEED_MAX_STACKS) ||
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
            unbounded
              ? 'Bleed state must contain valid independent applications in stable order, each with one to four remaining ticks, no more than 10 raw remaining damage, and optional boolean copy policy.'
              : 'Bleed state must contain at most three valid independent applications per target in stable order, each with one to four remaining ticks, no more than 10 raw remaining damage, and optional boolean copy policy.',
        },
      ]
    : []
}
