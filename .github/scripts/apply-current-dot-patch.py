from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement site, found {count}')
    file.write_text(text.replace(old, new, 1))


dots_path = Path('packages/game-core/src/combat/combat-dots.ts')
if dots_path.exists():
    raise RuntimeError('combat-dots.ts already exists; refusing to overwrite unexpected work')
dots_path.write_text("""import type { CombatEffectRecipient, CombatEncounterState } from './actions'\nimport { normalizeCombatEffectState } from './combat-effect-state'\n\nexport const CURRENT_POISON_PROFILE_VERSION = 1 as const\n\nexport interface CurrentPoisonEffect {\n  type: 'poison'\n  recipient: CombatEffectRecipient\n}\n\nexport function applyCurrentPoisonState(\n  state: CombatEncounterState,\n  sourceCombatantId: string,\n  targetCombatantId: string,\n  sourceActionId: string,\n): CombatEncounterState {\n  const effectState = normalizeCombatEffectState(state.effectState)\n  const existing = effectState.poison.find(\n    (instance) => instance.targetCombatantId === targetCombatantId,\n  )\n  const instance = {\n    targetCombatantId,\n    sourceCombatantId,\n    sourceActionId,\n    profileVersion: CURRENT_POISON_PROFILE_VERSION,\n    movementRemainder: existing?.movementRemainder ?? 0,\n  }\n\n  return {\n    ...state,\n    effectState: {\n      ...effectState,\n      poison: [\n        ...effectState.poison.filter(\n          (candidate) => candidate.targetCombatantId !== targetCombatantId,\n        ),\n        instance,\n      ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),\n    },\n  }\n}\n""")

actions = 'packages/game-core/src/combat/actions.ts'
replace_once(
    actions,
    "} from './combat-recovery'\nimport type { CombatEffectState } from './combat-effect-state'",
    "} from './combat-recovery'\nimport { applyCurrentPoisonState } from './combat-dots'\nimport type { CombatEffectState } from './combat-effect-state'",
)
replace_once(
    actions,
    """  | {\n      type: 'displace'\n      recipient: Exclude<CombatEffectRecipient, 'actor'>\n      direction?: 'push' | 'pull'\n      distance: number\n    }\n  | { type: 'healing'; recipient: CombatEffectRecipient; amount: number; ticks?: number }""",
    """  | {\n      type: 'displace'\n      recipient: Exclude<CombatEffectRecipient, 'actor'>\n      direction?: 'push' | 'pull'\n      distance: number\n    }\n  | { type: 'poison'; recipient: CombatEffectRecipient }\n  | { type: 'healing'; recipient: CombatEffectRecipient; amount: number; ticks?: number }""",
)
replace_once(
    actions,
    """      } else if (effect.type === 'remove-status') {\n        beforeValue =\n          getStatusRow(before, recipientId)""",
    """      } else if (effect.type === 'poison') {\n        beforeValue =\n          before.effectState?.poison.some(\n            (instance) => instance.targetCombatantId === recipientId,\n          ) === true\n            ? 'active'\n            : 'none'\n        afterValue =\n          nextState.effectState?.poison.some(\n            (instance) => instance.targetCombatantId === recipientId,\n          ) === true\n            ? 'active'\n            : 'none'\n      } else if (effect.type === 'remove-status') {\n        beforeValue =\n          getStatusRow(before, recipientId)""",
)
replace_once(
    actions,
    """  if (effect.type === 'displace')\n    return applyDisplacement(state, actorId, recipientId, actionId, effect, content)\n  if (effect.type === 'return-to-turn-start') {""",
    """  if (effect.type === 'displace')\n    return applyDisplacement(state, actorId, recipientId, actionId, effect, content)\n  if (effect.type === 'poison') {\n    return {\n      state: applyCurrentPoisonState(state, actorId, recipientId, actionId),\n      events: [],\n    }\n  }\n  if (effect.type === 'return-to-turn-start') {""",
)
replace_once(
    actions,
    """        'return-to-turn-start',\n        'create-terrain',\n        'displace',\n      ],\n      'effect type',""",
    """        'return-to-turn-start',\n        'create-terrain',\n        'displace',\n        'poison',\n      ],\n      'effect type',""",
)

authoring = 'packages/game-core/src/combat/combat-authoring-validation.ts'
replace_once(
    authoring,
    """        'return-to-turn-start',\n        'create-terrain',\n        'displace',\n      ],\n      'effect type',""",
    """        'return-to-turn-start',\n        'create-terrain',\n        'displace',\n        'poison',\n      ],\n      'effect type',""",
)

presentation = 'packages/game-core/src/combat/gameplay-tags.ts'
replace_once(
    presentation,
    """    'apply-poison': 'Poison (Poisoned)',\n  }""",
    """    'apply-poison': 'Poison (Poisoned)',\n    poison: 'Poison (Poisoned)',\n  }""",
)

print('Applied current Poison effect-state implementation.')
