from pathlib import Path

path = Path('apps/web/src/components/character/skill-detail-presentation.ts')
text = path.read_text()
old = """    case 'poison':
      return `Apply Poison (Poisoned) to ${target}.`
    case 'return-to-turn-start':"""
new = """    case 'poison':
      return `Apply Poison (Poisoned) to ${target}.`
    case 'bleed':
      return `Apply Bleed (Bleeding) to ${target} for ${effect.ticks} ${effect.ticks === 1 ? 'end-turn tick' : 'end-turn ticks'} at ${effect.damagePerTick} damage per tick. Bleed stacks independently up to three times.`
    case 'return-to-turn-start':"""
if text.count(old) != 1:
    raise RuntimeError(f'expected one Bleed presentation insertion site, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
