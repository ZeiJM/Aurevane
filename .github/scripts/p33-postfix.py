from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / 'packages/game-core/src/combat/pv1f-action-economy.ts'
text = path.read_text(encoding='utf-8')
for line in [
    '  PV1F_MP_RECOVER_COST,\n',
    '  PV1F_RECOVER_COST,\n',
]:
    if text.count(line) < 2:
        raise RuntimeError(f'Expected import and re-export occurrences for {line!r}')
    text = text.replace(line, '', 1)
path.write_text(text, encoding='utf-8')
Path(__file__).unlink()
