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
    """export function removeCurrentPoisonState(\n  state: CombatEncounterState,\n  targetCombatantId: string,\n): CombatEncounterState {\n  const effectState = normalizeCombatEffectState(state.effectState)\n  return {\n    ...state,\n    effectState: {\n      ...effectState,\n      poison: effectState.poison.filter(\n        (instance) => instance.targetCombatantId !== targetCombatantId,\n      ),\n    },\n  }\n}\n\nexport function validateCombatDotState(""",
    """export function removeCurrentPoisonState(\n  state: CombatEncounterState,\n  targetCombatantId: string,\n): CombatEncounterState {\n  const effectState = normalizeCombatEffectState(state.effectState)\n  return {\n    ...state,\n    effectState: {\n      ...effectState,\n      poison: effectState.poison.filter(\n        (instance) => instance.targetCombatantId !== targetCombatantId,\n      ),\n    },\n  }\n}\n\nexport function advanceCurrentPoisonMovement(\n  state: CombatEncounterState,\n  targetCombatantId: string,\n  traversedTiles: number,\n): { state: CombatEncounterState; triggeredTicks: number } {\n  if (!Number.isSafeInteger(traversedTiles) || traversedTiles < 0) {\n    throw new RangeError('Poison movement progress requires a non-negative safe integer tile count.')\n  }\n  if (traversedTiles === 0) return { state, triggeredTicks: 0 }\n\n  const effectState = normalizeCombatEffectState(state.effectState)\n  const existing = effectState.poison.find(\n    (instance) => instance.targetCombatantId === targetCombatantId,\n  )\n  if (!existing) return { state, triggeredTicks: 0 }\n\n  const total = existing.movementRemainder + traversedTiles\n  const triggeredTicks = Math.floor(total / 5)\n  const movementRemainder = total % 5\n  const poison = effectState.poison.map((instance) =>\n    instance.targetCombatantId === targetCombatantId\n      ? { ...instance, movementRemainder }\n      : instance,\n  )\n\n  return {\n    state: { ...state, effectState: { ...effectState, poison } },\n    triggeredTicks,\n  }\n}\n\nexport function validateCombatDotState(""",
)

actions = 'packages/game-core/src/combat/actions.ts'
replace_once(
    actions,
    """  CURRENT_POISON_DAMAGE,\n  applyCurrentPoisonState,""",
    """  CURRENT_POISON_DAMAGE,\n  advanceCurrentPoisonMovement,\n  applyCurrentPoisonState,""",
)
replace_once(
    actions,
    """  let stopReason: DisplacementFailureReason | null = null\n  let movedTiles = 0\n\n  for (let index = 0; index < effect.distance; index += 1) {""",
    """  let stopReason: DisplacementFailureReason | null = null\n  let movedTiles = 0\n  const movementEffectEvents: CombatResolutionEvent[] = []\n\n  for (let index = 0; index < effect.distance; index += 1) {""",
)
replace_once(
    actions,
    """    current = to\n    movedTiles += 1\n  }\n\n  if (movedTiles === 0) {""",
    """    current = to\n    movedTiles += 1\n\n    const movementEffects = resolveCombatMovementStepEffects(nextState, recipientId, content)\n    nextState = movementEffects.state\n    movementEffectEvents.push(...movementEffects.events)\n    if (getCombatant(nextState.tactical.battle, recipientId).hp <= 0) {\n      stopReason = 'target-defeated'\n      break\n    }\n  }\n\n  if (movedTiles === 0) {""",
)
replace_once(
    actions,
    """      },\n      ...marked.events,\n    ],\n  }\n}\n\nfunction scheduleAfterRecovery(""",
    """      },\n      ...movementEffectEvents,\n      ...marked.events,\n    ],\n  }\n}\n\nexport function resolveCombatMovementStepEffects(\n  state: CombatEncounterState,\n  combatantId: string,\n  content: CombatContentCatalog,\n): CombatResolutionTransition {\n  const poison = currentPoisonInstance(state, combatantId)\n  const advanced = advanceCurrentPoisonMovement(state, combatantId, 1)\n  if (!poison || advanced.triggeredTicks === 0) return { state: advanced.state, events: [] }\n\n  let nextState = advanced.state\n  const events: CombatResolutionEvent[] = []\n  for (let index = 0; index < advanced.triggeredTicks; index += 1) {\n    const target = getCombatant(nextState.tactical.battle, combatantId)\n    if (target.hp <= 0) break\n    const hpAfter = Math.max(0, target.hp - CURRENT_POISON_DAMAGE)\n    nextState = withUpdatedCombatant(nextState, combatantId, { ...target, hp: hpAfter })\n    events.push({\n      event: 'damage_applied',\n      actionId: 'status.poison.current.v1',\n      sourceCombatantId: poison.sourceCombatantId,\n      targetCombatantId: combatantId,\n      amount: target.hp - hpAfter,\n      hpBefore: target.hp,\n      hpAfter,\n    })\n\n    if (hpAfter < target.hp) {\n      const revealed = removeGameplayTags(\n        nextState,\n        poison.sourceCombatantId,\n        combatantId,\n        'status.poison.current.v1',\n        ['Invisible'],\n        content,\n      )\n      nextState = revealed.state\n      events.push(...revealed.events)\n    }\n  }\n  return { state: nextState, events }\n}\n\nfunction scheduleAfterRecovery(""",
)

print('Applied current Poison movement counter and displacement-step integration.')
