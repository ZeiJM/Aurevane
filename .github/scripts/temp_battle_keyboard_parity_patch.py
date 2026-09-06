from pathlib import Path

# 1) Tagged Attack Techniques must reuse the same directional keyboard path as Basic Attack.
attack_assist = Path('apps/web/src/components/battle/battle-directional-attack-assist.tsx')
text = attack_assist.read_text()
old = '''function basicAttackButton(): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
    ).find((button) => button.querySelector('strong')?.textContent?.trim() === 'Basic Attack') ??
    null
  )
}

function attackModeIsActive(): boolean {
  const button = basicAttackButton()
'''
new = '''function attackButton(): HTMLButtonElement | null {
  const deck = document.querySelector<HTMLElement>('section[aria-label="Command Deck"]')
  if (!deck) return null

  return (
    deck.querySelector<HTMLButtonElement>(
      'button[data-command-slot="attack"], button[data-battle-command="attack"]',
    ) ??
    Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.querySelector('strong')?.textContent?.trim() === 'Basic Attack',
    ) ??
    null
  )
}

function attackModeIsActive(): boolean {
  const button = attackButton()
'''
if old not in text:
    raise SystemExit('directional attack button anchor not found')
text = text.replace(old, new, 1)
attack_assist.write_text(text)

# 2) Tab targeting must follow the currently rendered mouse-valid target state, not a duplicated
#    Basic-Attack-only geometry calculation.
keyboard = Path('apps/web/src/components/battle/battle-keyboard-assist.tsx')
text = keyboard.read_text()
old = '''function legalVisibleTargetButtons(playerName: string): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).filter((button) => {
    if (button.disabled) return false
    const label = button.getAttribute('aria-label') ?? ''
    return !label.includes(`occupied by ${playerName}`)
  })
}
'''
new = '''function legalVisibleTargetButtons(playerName: string): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).filter((button) => {
    if (button.disabled || button.dataset.target !== 'enemy') return false
    const label = button.getAttribute('aria-label') ?? ''
    return !label.includes(`occupied by ${playerName}`)
  })
}
'''
if old not in text:
    raise SystemExit('keyboard target helper anchor not found')
text = text.replace(old, new, 1)
old = '''      const targets = legalVisibleTargetButtons(playerName).filter(
        (button) => button.dataset.attackRange === 'legal',
      )
'''
new = '''      const targets = legalVisibleTargetButtons(playerName)
'''
if old not in text:
    raise SystemExit('keyboard cycle target anchor not found')
text = text.replace(old, new, 1)
keyboard.write_text(text)

# 3) The board's presentation target range follows the selected Technique's authored range. The
#    server preview remains authoritative; this only exposes the same mouse target affordance to
#    keyboard helpers instead of hard-coding Basic Attack adjacency.
experience = Path('apps/web/src/components/battle/battle-experience.tsx')
text = experience.read_text()
old = '''  const attackRange = useMemo(() => {
    const result = new Set<string>()
    if (!localPlacement) return result
    for (const position of [
      { x: localPlacement.position.x + 1, y: localPlacement.position.y },
      { x: localPlacement.position.x - 1, y: localPlacement.position.y },
      { x: localPlacement.position.x, y: localPlacement.position.y + 1 },
      { x: localPlacement.position.x, y: localPlacement.position.y - 1 },
    ]) {
      if (
        position.x >= 0 &&
        position.x < tactical.width &&
        position.y >= 0 &&
        position.y < tactical.height
      ) {
        result.add(positionKey(position))
      }
    }
    return result
  }, [localPlacement, tactical.height, tactical.width])
'''
new = '''  const attackRange = useMemo(() => {
    const result = new Set<string>()
    if (!localPlacement) return result

    const minimumRange = selectedAttackTechnique?.minimumRange ?? 1
    const maximumRange = selectedAttackTechnique?.maximumRange ?? 1
    for (const tile of tactical.tiles) {
      const distance =
        Math.abs(tile.position.x - localPlacement.position.x) +
        Math.abs(tile.position.y - localPlacement.position.y)
      if (distance >= minimumRange && distance <= maximumRange) {
        result.add(positionKey(tile.position))
      }
    }
    return result
  }, [
    localPlacement,
    selectedAttackTechnique?.maximumRange,
    selectedAttackTechnique?.minimumRange,
    tactical.tiles,
  ])
'''
if old not in text:
    raise SystemExit('attack range anchor not found')
text = text.replace(old, new, 1)
experience.write_text(text)

# 4) Final Facing was being placed in the same desktop grid cell as the six command cards. Move it
#    to its own compact row and flatten the cross-shaped pad so Space never paints over the cockpit.
css = Path('apps/web/src/components/battle/unified-battle-experience.module.css')
text = css.read_text()
old = '''  :global([data-unified-command-deck='true']) {
    display: grid !important;
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: auto auto !important;
    gap: 0.32rem !important;
    padding: 0.4rem !important;
  }
'''
new = '''  :global([data-unified-command-deck='true']) {
    display: grid !important;
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: auto auto auto !important;
    gap: 0.32rem !important;
    padding: 0.4rem !important;
  }
'''
if old not in text:
    raise SystemExit('command deck grid anchor not found')
text = text.replace(old, new, 1)
old = '''  :global([data-unified-command-deck='true'] > [data-unified-facing-pad='true']) {
    grid-column: 1;
    grid-row: 2;
  }
'''
new = '''  :global([data-unified-command-deck='true'] > [data-unified-facing-pad='true']) {
    grid-column: 1;
    grid-row: 3;
    grid-template-columns: auto repeat(4, 2rem) !important;
    grid-template-rows: 2rem !important;
    width: max-content;
    max-width: 100%;
    gap: 0.24rem !important;
    align-items: center;
    justify-self: end;
    padding: 0.24rem 0.3rem !important;
  }

  :global([data-unified-command-deck='true'] > [data-unified-facing-pad='true'] > span) {
    grid-column: 1 !important;
    grid-row: 1 !important;
    padding: 0 0.2rem;
  }

  :global(
    [data-unified-command-deck='true'] > [data-unified-facing-pad='true'] > button:nth-of-type(1)
  ) {
    grid-column: 2 !important;
    grid-row: 1 !important;
  }

  :global(
    [data-unified-command-deck='true'] > [data-unified-facing-pad='true'] > button:nth-of-type(2)
  ) {
    grid-column: 3 !important;
    grid-row: 1 !important;
  }

  :global(
    [data-unified-command-deck='true'] > [data-unified-facing-pad='true'] > button:nth-of-type(3)
  ) {
    grid-column: 4 !important;
    grid-row: 1 !important;
  }

  :global(
    [data-unified-command-deck='true'] > [data-unified-facing-pad='true'] > button:nth-of-type(4)
  ) {
    grid-column: 5 !important;
    grid-row: 1 !important;
  }

  :global([data-unified-command-deck='true'] > [data-unified-facing-pad='true']::after) {
    display: none !important;
    content: none !important;
  }
'''
if old not in text:
    raise SystemExit('desktop facing pad anchor not found')
text = text.replace(old, new, 1)
css.write_text(text)
