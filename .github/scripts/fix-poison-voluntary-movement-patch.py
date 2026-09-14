from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement site, found {count}')
    file.write_text(text.replace(old, new, 1))


pv1f = 'packages/game-core/src/combat/pv1f-action-economy.ts'
replace_once(
    pv1f,
    """  type CombatContentCatalog,\n  type CombatEffectDefinition,""",
    """  type CombatContentCatalog,\n  type CombatEncounterState,\n  type CombatEffectDefinition,""",
)
replace_once(
    pv1f,
    """  for (const _position of path.slice(1)) {\n    const advanced = advanceCurrentPoisonMovement(shadow, actorId, 1)""",
    """  for (let index = 1; index < path.length; index += 1) {\n    const advanced = advanceCurrentPoisonMovement(shadow, actorId, 1)""",
)

print('Applied compile-safety fixes to voluntary Poison movement source.')
