from pathlib import Path

path = Path('apps/web/src/components/battle/pvp-battle-keyboard-assist.tsx')
text = path.read_text()
old = """function commandButton(...labels: string[]): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('section[aria-label=\"Command Deck\"] button'),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}
"""
new = """const LEGACY_COMMAND_SLOTS: Readonly<Record<string, string>> = {
  Inspect: 'inspect',
  Move: 'move',
  'Basic Attack': 'attack',
  Guard: 'guard',
  Recover: 'recover',
  'HP Recovery': 'recover',
  'MP Recovery': 'recover',
  'Finish Turn': 'finish',
  'End Turn': 'finish',
  'Facing / End Turn': 'finish',
}

function commandButton(...labels: string[]): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null

  for (const label of labels) {
    const slot = LEGACY_COMMAND_SLOTS[label]
    if (!slot) continue
    const stable = root.querySelector<HTMLButtonElement>(
      `section[aria-label=\"Command Deck\"] button[data-command-slot=\"${slot}\"], section[aria-label=\"Command Deck\"] button[data-battle-command=\"${slot}\"]`,
    )
    if (stable) return stable
  }

  return (
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('section[aria-label=\"Command Deck\"] button'),
    ).find((button) => labels.includes(button.querySelector('strong')?.textContent?.trim() ?? '')) ??
    null
  )
}
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'PvP stable command lookup: expected 1 match, found {count}')
path.write_text(text.replace(old, new))
