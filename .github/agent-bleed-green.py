from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement site, found {count}')
    file.write_text(text.replace(old, new, 1))


dots = 'packages/game-core/src/combat/combat-dots.ts'
replace_once(
    dots,
    "import { normalizeCombatEffectState, type CombatPoisonInstance } from './combat-effect-state'",
    """import {
  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatPoisonInstance,
} from './combat-effect-state'""",
)
replace_once(
    dots,
    """export const CURRENT_POISON_PROFILE_VERSION = 1 as const
export const CURRENT_POISON_DAMAGE = 2 as const""",
    """export const CURRENT_POISON_PROFILE_VERSION = 1 as const
export const CURRENT_POISON_DAMAGE = 2 as const
export const CURRENT_BLEED_MAX_STACKS = 3 as const
export const CURRENT_BLEED_MAX_TICKS = 4 as const
export const CURRENT_BLEED_MAX_RAW_TOTAL = 10 as const""",
)
replace_once(
    dots,
    """export function validateCombatDotState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  if (!state.effectState) return []

  const poison = state.effectState.poison
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
""",
    """export function validateCurrentBleedEffect(effect: {
  damagePerTick: number
  ticks: number
}): void {
  if (!Number.isSafeInteger(effect.damagePerTick) || effect.damagePerTick <= 0) {
    throw new RangeError('Bleed damage per tick must be a positive safe integer.')
  }
  if (!Number.isSafeInteger(effect.ticks) || effect.ticks < 1 || effect.ticks > CURRENT_BLEED_MAX_TICKS) {
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
  return normalizeCombatEffectState(state.effectState).bleed
    .filter((stack) => stack.targetCombatantId === targetCombatantId)
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
        left.remainingTicks - right.remainingTicks || left.applicationOrder - right.applicationOrder,
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

export function validateCombatDotState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  if (!state.effectState) return []
  return [...validateCurrentPoisonState(state), ...validateCurrentBleedState(state)]
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
""",
)

actions = 'packages/game-core/src/combat/actions.ts'
replace_once(
    actions,
    """  CURRENT_POISON_DAMAGE,
  advanceCurrentPoisonMovement,
  applyCurrentPoisonState,""",
    """  CURRENT_POISON_DAMAGE,
  advanceCurrentBleedEndTurn,
  advanceCurrentPoisonMovement,
  applyCurrentBleedState,
  applyCurrentPoisonState,""",
)
replace_once(
    actions,
    """  currentPoisonEndTurnDamage,
  currentPoisonInstance,
  hasCurrentPoison,
  removeCurrentPoisonState,
  validateCombatDotState,""",
    """  currentBleedStacks,
  currentPoisonEndTurnDamage,
  currentPoisonInstance,
  hasCurrentBleed,
  hasCurrentPoison,
  removeCurrentBleedState,
  removeCurrentPoisonState,
  validateCombatDotState,
  validateCurrentBleedEffect,""",
)
replace_once(
    actions,
    """  | { type: 'poison'; recipient: CombatEffectRecipient }
  | { type: 'healing'; recipient: CombatEffectRecipient; amount: number; ticks?: number }""",
    """  | { type: 'poison'; recipient: CombatEffectRecipient }
  | {
      type: 'bleed'
      recipient: CombatEffectRecipient
      damagePerTick: number
      ticks: number
    }
  | { type: 'healing'; recipient: CombatEffectRecipient; amount: number; ticks?: number }""",
)
replace_once(
    actions,
    """        'displace',
        'poison',
      ],""",
    """        'displace',
        'poison',
        'bleed',
      ],""",
)
replace_once(
    actions,
    """    if (effect.type === 'damage' || effect.type === 'healing') {
      assertNonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }""",
    """    if (effect.type === 'damage' || effect.type === 'healing') {
      assertNonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }
    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)""",
)
replace_once(
    actions,
    """      } else if (effect.type === 'poison') {
        beforeValue =
          before.effectState?.poison.some(
            (instance) => instance.targetCombatantId === recipientId,
          ) === true
            ? 'active'
            : 'none'
        afterValue =
          nextState.effectState?.poison.some(
            (instance) => instance.targetCombatantId === recipientId,
          ) === true
            ? 'active'
            : 'none'
      } else if (effect.type === 'remove-status') {""",
    """      } else if (effect.type === 'poison') {
        beforeValue =
          before.effectState?.poison.some(
            (instance) => instance.targetCombatantId === recipientId,
          ) === true
            ? 'active'
            : 'none'
        afterValue =
          nextState.effectState?.poison.some(
            (instance) => instance.targetCombatantId === recipientId,
          ) === true
            ? 'active'
            : 'none'
      } else if (effect.type === 'bleed') {
        beforeValue = `x${currentBleedStacks(before, recipientId).length}`
        afterValue = `x${currentBleedStacks(nextState, recipientId).length}`
      } else if (effect.type === 'remove-status') {""",
)
replace_once(
    actions,
    """        if (effect.statusIds.includes('poison') && hasCurrentPoison(before, recipientId)) {
          removedStatusIds.push('poison')
        }
        beforeValue = [...new Set(removedStatusIds)].sort(compareStableString).join(',') || 'none'""",
    """        if (effect.statusIds.includes('poison') && hasCurrentPoison(before, recipientId)) {
          removedStatusIds.push('poison')
        }
        if (effect.statusIds.includes('bleed') && hasCurrentBleed(before, recipientId)) {
          removedStatusIds.push('bleed')
        }
        beforeValue = [...new Set(removedStatusIds)].sort(compareStableString).join(',') || 'none'""",
)
replace_once(
    actions,
    """  if (effect.type === 'poison') {
    return {
      state: applyCurrentPoisonState(state, actorId, recipientId, actionId),
      events: [],
    }
  }
  if (effect.type === 'return-to-turn-start') {""",
    """  if (effect.type === 'poison') {
    return {
      state: applyCurrentPoisonState(state, actorId, recipientId, actionId),
      events: [],
    }
  }
  if (effect.type === 'bleed') {
    return {
      state: applyCurrentBleedState(
        state,
        actorId,
        recipientId,
        actionId,
        effect.damagePerTick,
        effect.ticks,
      ),
      events: [],
    }
  }
  if (effect.type === 'return-to-turn-start') {""",
)
replace_once(
    actions,
    """    const removesCurrentPoison =
      effect.statusIds.includes('poison') && hasCurrentPoison(state, recipientId)
    if (removesCurrentPoison) removedStatusIds.push('poison')

    let nextState = removeStatuses(state, recipientId, effect.statusIds)
    if (removesCurrentPoison) nextState = removeCurrentPoisonState(nextState, recipientId)
""",
    """    const removesCurrentPoison =
      effect.statusIds.includes('poison') && hasCurrentPoison(state, recipientId)
    const removesCurrentBleed =
      effect.statusIds.includes('bleed') && hasCurrentBleed(state, recipientId)
    if (removesCurrentPoison) removedStatusIds.push('poison')
    if (removesCurrentBleed) removedStatusIds.push('bleed')

    let nextState = removeStatuses(state, recipientId, effect.statusIds)
    if (removesCurrentPoison) nextState = removeCurrentPoisonState(nextState, recipientId)
    if (removesCurrentBleed) nextState = removeCurrentBleedState(nextState, recipientId)
""",
)
replace_once(
    actions,
    """function resolveCurrentEndOfTurnDots(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  const poison = currentPoisonInstance(state, combatantId)
  const target = getCombatant(state.tactical.battle, combatantId)
  if (!poison || target.hp <= 0) return { state, events: [] }

  const hpAfter = Math.max(0, target.hp - CURRENT_POISON_DAMAGE)
  let nextState = withUpdatedCombatant(state, combatantId, { ...target, hp: hpAfter })
  const events: CombatResolutionEvent[] = [
    {
      event: 'damage_applied',
      actionId: 'status.poison.current.v1',
      sourceCombatantId: poison.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    },
  ]

  if (hpAfter < target.hp) {
    const revealed = removeGameplayTags(
      nextState,
      poison.sourceCombatantId,
      combatantId,
      'status.poison.current.v1',
      ['Invisible'],
      content,
    )
    nextState = revealed.state
    events.push(...revealed.events)
  }

  return { state: nextState, events }
}
""",
    """function resolveCurrentEndOfTurnDots(
  state: CombatEncounterState,
  combatantId: string,
  content: CombatContentCatalog,
): CombatResolutionTransition {
  let nextState = state
  const events: CombatResolutionEvent[] = []

  const poison = currentPoisonInstance(nextState, combatantId)
  let target = getCombatant(nextState.tactical.battle, combatantId)
  if (poison && target.hp > 0) {
    const hpAfter = Math.max(0, target.hp - CURRENT_POISON_DAMAGE)
    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    events.push({
      event: 'damage_applied',
      actionId: 'status.poison.current.v1',
      sourceCombatantId: poison.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })
    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        poison.sourceCombatantId,
        combatantId,
        'status.poison.current.v1',
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
  }

  target = getCombatant(nextState.tactical.battle, combatantId)
  if (target.hp <= 0) return { state: nextState, events }

  const bleedTurn = advanceCurrentBleedEndTurn(nextState, combatantId)
  nextState = bleedTurn.state
  for (const stack of bleedTurn.stacks) {
    target = getCombatant(nextState.tactical.battle, combatantId)
    if (target.hp <= 0) break
    const hpAfter = Math.max(0, target.hp - stack.damagePerTick)
    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    events.push({
      event: 'damage_applied',
      actionId: stack.sourceActionId,
      sourceCombatantId: stack.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })
    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        stack.sourceCombatantId,
        combatantId,
        stack.sourceActionId,
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
  }

  return { state: nextState, events }
}
""",
)

authoring = 'packages/game-core/src/combat/combat-authoring-validation.ts'
replace_once(
    authoring,
    "import { validateRecoveryEffect } from './combat-recovery'",
    """import { validateRecoveryEffect } from './combat-recovery'
import { validateCurrentBleedEffect } from './combat-dots'""",
)
replace_once(
    authoring,
    """        'displace',
        'poison',
      ],""",
    """        'displace',
        'poison',
        'bleed',
      ],""",
)
replace_once(
    authoring,
    """    if (effect.type === 'damage' || effect.type === 'healing') {
      nonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }""",
    """    if (effect.type === 'damage' || effect.type === 'healing') {
      nonNegativeSafeInteger(effect.amount, `${effect.type} amount`)
    }
    if (effect.type === 'bleed') validateCurrentBleedEffect(effect)""",
)

pv1f = 'packages/game-core/src/combat/pv1f-action-economy.ts'
replace_once(
    pv1f,
    """    if (effect.type === 'resource-change') {
      scaled.push({ ...effect, delta: halfSignedMagnitude(effect.delta) })
      continue
    }
    // Removal is discrete:""",
    """    if (effect.type === 'resource-change') {
      scaled.push({ ...effect, delta: halfSignedMagnitude(effect.delta) })
      continue
    }
    if (effect.type === 'bleed') {
      scaled.push({ ...effect, damagePerTick: halfPositiveMagnitude(effect.damagePerTick) })
      continue
    }
    // Removal is discrete:""",
)

test = 'packages/game-core/src/combat/combat-bleed-rework.test.ts'
replace_once(
    test,
    "expect(legacy.state.effectState?.bleed).toEqual([])",
    "expect(legacy.state.effectState?.bleed ?? []).toEqual([])",
)
