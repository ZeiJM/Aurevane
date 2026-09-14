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
    """  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatPoisonInstance,""",
    """  normalizeCombatEffectState,
  type CombatBleedStack,
  type CombatBurnInstance,
  type CombatPoisonInstance,""",
)
replace_once(
    dots,
    """export const CURRENT_BLEED_MAX_STACKS = 3 as const
export const CURRENT_BLEED_MAX_TICKS = 4 as const
export const CURRENT_BLEED_MAX_RAW_TOTAL = 10 as const""",
    """export const CURRENT_BLEED_MAX_STACKS = 3 as const
export const CURRENT_BLEED_MAX_TICKS = 4 as const
export const CURRENT_BLEED_MAX_RAW_TOTAL = 10 as const
export const CURRENT_BURN_PROFILE_VERSION = 1 as const
export const CURRENT_BURN_DAMAGE_BY_STAGE = [4, 3, 2] as const""",
)
replace_once(
    dots,
    """export function validateCombatDotState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  if (!state.effectState) return []
  return [...validateCurrentPoisonState(state), ...validateCurrentBleedState(state)]
}""",
    """export function currentBurnInstance(
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
        ...effectState.burn.filter((candidate) => candidate.targetCombatantId !== targetCombatantId),
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
}""",
)
replace_once(
    dots,
    """function validateCurrentBleedState(state: CombatEncounterState): readonly CombatEncounterIssue[] {""",
    """function validateCurrentBurnState(state: CombatEncounterState): readonly CombatEncounterIssue[] {
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

function validateCurrentBleedState(state: CombatEncounterState): readonly CombatEncounterIssue[] {""",
)

actions = 'packages/game-core/src/combat/actions.ts'
replace_once(
    actions,
    """  CURRENT_POISON_DAMAGE,
  advanceCurrentBleedEndTurn,""",
    """  CURRENT_POISON_DAMAGE,
  advanceCurrentBleedEndTurn,
  advanceCurrentBurnEndTurn,""",
)
replace_once(
    actions,
    """  applyCurrentBleedState,
  applyCurrentPoisonState,
  currentBleedStacks,""",
    """  applyCurrentBleedState,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  currentBleedStacks,
  currentBurnInstance,""",
)
replace_once(
    actions,
    """  hasCurrentBleed,
  hasCurrentPoison,
  removeCurrentBleedState,""",
    """  hasCurrentBleed,
  hasCurrentBurn,
  hasCurrentPoison,
  removeCurrentBleedState,
  removeCurrentBurnState,""",
)
replace_once(
    actions,
    """  | { type: 'poison'; recipient: CombatEffectRecipient }
  | {
      type: 'bleed'""",
    """  | { type: 'poison'; recipient: CombatEffectRecipient }
  | { type: 'burn'; recipient: CombatEffectRecipient }
  | {
      type: 'bleed'""",
)
replace_once(
    actions,
    """        'poison',
        'bleed',
      ],""",
    """        'poison',
        'bleed',
        'burn',
      ],""",
)
replace_once(
    actions,
    """      } else if (effect.type === 'bleed') {
        beforeValue = `x${currentBleedStacks(before, recipientId).length}`
        afterValue = `x${currentBleedStacks(nextState, recipientId).length}`
      } else if (effect.type === 'remove-status') {""",
    """      } else if (effect.type === 'bleed') {
        beforeValue = `x${currentBleedStacks(before, recipientId).length}`
        afterValue = `x${currentBleedStacks(nextState, recipientId).length}`
      } else if (effect.type === 'burn') {
        beforeValue = currentBurnInstance(before, recipientId)?.stage ?? 'none'
        afterValue = currentBurnInstance(nextState, recipientId)?.stage ?? 'none'
      } else if (effect.type === 'remove-status') {""",
)
replace_once(
    actions,
    """        if (effect.statusIds.includes('bleed') && hasCurrentBleed(before, recipientId)) {
          removedStatusIds.push('bleed')
        }
        beforeValue = [...new Set(removedStatusIds)].sort(compareStableString).join(',') || 'none'""",
    """        if (effect.statusIds.includes('bleed') && hasCurrentBleed(before, recipientId)) {
          removedStatusIds.push('bleed')
        }
        if (effect.statusIds.includes('burn') && hasCurrentBurn(before, recipientId)) {
          removedStatusIds.push('burn')
        }
        beforeValue = [...new Set(removedStatusIds)].sort(compareStableString).join(',') || 'none'""",
)
replace_once(
    actions,
    """  if (effect.type === 'bleed') {
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
    """  if (effect.type === 'bleed') {
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
  if (effect.type === 'burn') {
    return {
      state: applyCurrentBurnState(state, actorId, recipientId, actionId),
      events: [],
    }
  }
  if (effect.type === 'return-to-turn-start') {""",
)
replace_once(
    actions,
    """    const removesCurrentBleed =
      effect.statusIds.includes('bleed') && hasCurrentBleed(state, recipientId)
    if (removesCurrentPoison) removedStatusIds.push('poison')
    if (removesCurrentBleed) removedStatusIds.push('bleed')

    let nextState = removeStatuses(state, recipientId, effect.statusIds)
    if (removesCurrentPoison) nextState = removeCurrentPoisonState(nextState, recipientId)
    if (removesCurrentBleed) nextState = removeCurrentBleedState(nextState, recipientId)
""",
    """    const removesCurrentBleed =
      effect.statusIds.includes('bleed') && hasCurrentBleed(state, recipientId)
    const removesCurrentBurn =
      effect.statusIds.includes('burn') && hasCurrentBurn(state, recipientId)
    if (removesCurrentPoison) removedStatusIds.push('poison')
    if (removesCurrentBleed) removedStatusIds.push('bleed')
    if (removesCurrentBurn) removedStatusIds.push('burn')

    let nextState = removeStatuses(state, recipientId, effect.statusIds)
    if (removesCurrentPoison) nextState = removeCurrentPoisonState(nextState, recipientId)
    if (removesCurrentBleed) nextState = removeCurrentBleedState(nextState, recipientId)
    if (removesCurrentBurn) nextState = removeCurrentBurnState(nextState, recipientId)
""",
)
replace_once(
    actions,
    """  for (const stack of bleedTurn.stacks) {
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

  return { state: nextState, events }""",
    """  for (const stack of bleedTurn.stacks) {
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

  target = getCombatant(nextState.tactical.battle, combatantId)
  if (target.hp <= 0) return { state: nextState, events }

  const burnTurn = advanceCurrentBurnEndTurn(nextState, combatantId)
  nextState = burnTurn.state
  if (burnTurn.instance && burnTurn.damage > 0) {
    target = getCombatant(nextState.tactical.battle, combatantId)
    const hpAfter = Math.max(0, target.hp - burnTurn.damage)
    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })
    events.push({
      event: 'damage_applied',
      actionId: 'status.burn.current.v1',
      sourceCombatantId: burnTurn.instance.sourceCombatantId,
      targetCombatantId: combatantId,
      amount: target.hp - hpAfter,
      hpBefore: target.hp,
      hpAfter,
    })
    if (hpAfter < target.hp) {
      const revealed = removeGameplayTags(
        nextState,
        burnTurn.instance.sourceCombatantId,
        combatantId,
        'status.burn.current.v1',
        ['Invisible'],
        content,
      )
      nextState = revealed.state
      events.push(...revealed.events)
    }
  }

  return { state: nextState, events }""",
)

authoring = 'packages/game-core/src/combat/combat-authoring-validation.ts'
replace_once(
    authoring,
    """        'poison',
        'bleed',
      ],""",
    """        'poison',
        'bleed',
        'burn',
      ],""",
)

pv1f = 'packages/game-core/src/combat/pv1f-action-economy.ts'
replace_once(
    pv1f,
    """      effect.type === 'displace' ||
      effect.type === 'poison'
    )""",
    """      effect.type === 'displace' ||
      effect.type === 'poison' ||
      effect.type === 'burn'
    )""",
)

presentation = 'packages/game-core/src/combat/gameplay-tags.ts'
replace_once(
    presentation,
    """    'apply-burn': 'Burn (Scorched)',
    'apply-bleed': 'Bleed (Bleeding)',
    'apply-poison': 'Poison (Poisoned)',
    poison: 'Poison (Poisoned)',""",
    """    'apply-burn': 'Burn (Scorched)',
    'apply-bleed': 'Bleed (Bleeding)',
    'apply-poison': 'Poison (Poisoned)',
    burn: 'Burn (Scorched)',
    bleed: 'Bleed (Bleeding)',
    poison: 'Poison (Poisoned)',""",
)

web = 'apps/web/src/components/character/skill-detail-presentation.ts'
replace_once(
    web,
    """    case 'poison':
      return `Apply Poison (Poisoned) to ${target}.`
    case 'bleed':""",
    """    case 'poison':
      return `Apply Poison (Poisoned) to ${target}.`
    case 'burn':
      return `Apply Burn (Scorched) to ${target}. Burn deals 4, then 3, then 2 fixed damage at the target's next three end-turn boundaries; reapplication restarts the sequence.`
    case 'bleed':""",
)
