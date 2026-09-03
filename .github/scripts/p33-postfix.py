from pathlib import Path

root = Path(__file__).resolve().parents[2]

pv1f_path = root / 'packages/game-core/src/combat/pv1f-action-economy.ts'
pv1f = pv1f_path.read_text(encoding='utf-8')
for line in [
    '  PV1F_MP_RECOVER_COST,\n',
    '  PV1F_RECOVER_COST,\n',
]:
    if pv1f.count(line) < 2:
        raise RuntimeError(f'Expected import and re-export occurrences for {line!r}')
    pv1f = pv1f.replace(line, '', 1)
pv1f_path.write_text(pv1f, encoding='utf-8')

actions_path = root / 'packages/game-core/src/combat/actions.ts'
actions = actions_path.read_text(encoding='utf-8')
old = "    ['basic-attack', 'basic-action', 'scenario', 'test'],\n"
new = "    ['basic-attack', 'basic-action', 'discipline-skill', 'scenario', 'test'],\n"
if actions.count(old) != 1:
    raise RuntimeError(f'Expected exactly one combat action source allowlist, found {actions.count(old)}')
actions_path.write_text(actions.replace(old, new), encoding='utf-8')

Path(__file__).unlink()
