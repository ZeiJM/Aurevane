from pathlib import Path


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new)


cockpit_path = Path('apps/web/src/components/battle/battle-command-cockpit-polish.tsx')
cockpit = cockpit_path.read_text()

cockpit = replace_exact(
    cockpit,
    """function previewSlug(preview: IntentPreview): CommandSlug | null {
  if (preview.kind === 'move') return 'move'
  if (preview.kind === 'face' || preview.kind === 'end-turn') return 'finish'
  if (preview.kind !== 'action') return null
  if (preview.actionId === 'basic.attack.unarmed.basic') return 'attack'
  if (preview.actionId === 'basic.guard') return 'guard'
  if (preview.actionId === 'basic.recover') return 'recover'
  return null
}
""",
    """function isCommandSlug(value: string | undefined): value is CommandSlug {
  return (
    value === 'inspect' ||
    value === 'move' ||
    value === 'attack' ||
    value === 'guard' ||
    value === 'recover' ||
    value === 'finish'
  )
}

function commandButtonForSlug(deck: HTMLElement, slug: CommandSlug): HTMLButtonElement | null {
  return (
    deck.querySelector<HTMLButtonElement>(`button[data-command-slot=\"${slug}\"]`) ??
    deck.querySelector<HTMLButtonElement>(`button[data-battle-command=\"${slug}\"]`)
  )
}

function commandButtonIsActive(button: HTMLButtonElement): boolean {
  return (
    button.hasAttribute('data-active') ||
    button.dataset.battleActive === 'true' ||
    `${button.className}`.includes('commandActive')
  )
}

function activeCommandSlug(deck: HTMLElement): CommandSlug | null {
  for (const button of deck.querySelectorAll<HTMLButtonElement>(
    'button[data-command-slot], button[data-battle-command]',
  )) {
    if (!commandButtonIsActive(button)) continue
    const slot = button.dataset.commandSlot ?? button.dataset.battleCommand
    if (isCommandSlug(slot)) return slot
  }
  return null
}

function commandDisplayLabel(deck: HTMLElement, slug: CommandSlug): string {
  return (
    commandButtonForSlug(deck, slug)?.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim() ||
    COMMAND_PRESENTATION[slug].title
  )
}

function previewSlug(preview: IntentPreview, deck: HTMLElement): CommandSlug | null {
  if (preview.kind === 'move') return 'move'
  if (preview.kind === 'face' || preview.kind === 'end-turn') return 'finish'
  if (preview.kind !== 'action') return null
  if (preview.actionId === 'basic.attack.unarmed.basic') return 'attack'
  if (preview.actionId === 'basic.guard') return 'guard'
  if (preview.actionId === 'basic.recover') return 'recover'

  // Mature Techniques use their frozen action id rather than a legacy basic-action id. The
  // authoritative preview is already tied to the currently armed cockpit action, so use the stable
  // cockpit slot to classify presentation instead of guessing from the Technique name.
  const active = activeCommandSlug(deck)
  return active === 'attack' || active === 'guard' || active === 'recover' ? active : null
}
""",
    'preview slug classification',
)

cockpit = replace_exact(
    cockpit,
    """  const presentation = COMMAND_PRESENTATION[slug]
  const description = semanticDescription(deck, slug)
  instruction.row.dataset.battleCommandExplanation = slug
  if (instruction.title.textContent !== presentation.title) {
    instruction.title.textContent = presentation.title
  }
  if (instruction.description.textContent !== description) {
    instruction.description.textContent = description
  }
""",
    """  const presentation = COMMAND_PRESENTATION[slug]
  const displayTitle = commandDisplayLabel(deck, slug)
  const customTechnique = displayTitle !== presentation.title
  const description = customTechnique
    ? 'Review the authoritative target preview, effects, and legality before committing.'
    : semanticDescription(deck, slug)
  instruction.row.dataset.battleCommandExplanation = slug
  if (instruction.title.textContent !== displayTitle) {
    instruction.title.textContent = displayTitle
  }
  if (instruction.description.textContent !== description) {
    instruction.description.textContent = description
  }
""",
    'dynamic command description',
)

cockpit = replace_exact(
    cockpit,
    """function showBattlePreview(deck: HTMLElement, preview: IntentPreview): void {
  const slug = previewSlug(preview)
""",
    """function showBattlePreview(deck: HTMLElement, preview: IntentPreview): void {
  const slug = previewSlug(preview, deck)
""",
    'preview deck classification',
)

cockpit = replace_exact(
    cockpit,
    """  const commandButtons = Array.from(deck.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) =>
      COMMAND_SLUGS.has(button.querySelector(':scope > strong')?.textContent?.trim() ?? ''),
  )
  let activeSlug: CommandSlug | null = null

  if (commandButtons.length > 0) {
    const commandGroup = commandButtons[0]?.parentElement
    if (commandGroup instanceof HTMLElement) commandGroup.dataset.battleCommandGroup = 'true'

    for (const button of commandButtons) {
      const label = button.querySelector(':scope > strong')?.textContent?.trim() ?? ''
      const slug = COMMAND_SLUGS.get(label)
      if (!slug) continue
      button.dataset.battleCommand = slug

      const active =
        button.hasAttribute('data-active') || `${button.className}`.includes('commandActive')
      if (active) {
        button.dataset.battleActive = 'true'
        activeSlug = slug
      } else {
        delete button.dataset.battleActive
      }
    }
  }
""",
    """  const commandButtons = Array.from(
    deck.querySelectorAll<HTMLButtonElement>('button[data-command-slot], button[data-battle-command]'),
  ).filter((button) => {
    const slot = button.dataset.commandSlot ?? button.dataset.battleCommand
    return isCommandSlug(slot)
  })
  let activeSlug: CommandSlug | null = null

  if (commandButtons.length > 0) {
    const commandGroup = commandButtons[0]?.parentElement
    if (commandGroup instanceof HTMLElement) commandGroup.dataset.battleCommandGroup = 'true'

    for (const button of commandButtons) {
      const slot = button.dataset.commandSlot ?? button.dataset.battleCommand
      if (!isCommandSlug(slot)) continue
      button.dataset.battleCommand = slot

      if (commandButtonIsActive(button)) {
        button.dataset.battleActive = 'true'
        activeSlug = slot
      } else {
        delete button.dataset.battleActive
      }
    }
  }
""",
    'stable cockpit command discovery',
)

cockpit = replace_exact(
    cockpit,
    """      const label = button.querySelector(':scope > strong')?.textContent?.trim() ?? ''
      const slug = COMMAND_SLUGS.get(label)
      const deck = button.closest<HTMLElement>('section[aria-label=\"Command Deck\"]')
      if (!slug || !deck) return
""",
    """      const deck = button.closest<HTMLElement>('section[aria-label=\"Command Deck\"]')
      const slot = button.dataset.commandSlot ?? button.dataset.battleCommand
      if (!deck || !isCommandSlug(slot)) return
      const slug = slot
""",
    'stable click presentation routing',
)

cockpit_path.write_text(cockpit)

for keyboard_name in [
    'apps/web/src/components/battle/battle-keyboard-assist.tsx',
    'apps/web/src/components/battle/pvp-battle-keyboard-assist.tsx',
]:
    path = Path(keyboard_name)
    text = path.read_text()
    old = """function commandButton(...labels: string[]): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label=\"Command Deck\"] button'),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}
"""
    if 'pvp-' in keyboard_name:
        old = """function commandButton(...labels: string[]): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      'main[data-pvp-battle=\"true\"] section[aria-label=\"Command Deck\"] button',
    ),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}
"""
    scope = (
        'main[data-pvp-battle="true"] section[aria-label="Command Deck"]'
        if 'pvp-' in keyboard_name
        else 'section[aria-label="Command Deck"]'
    )
    slot_template = '${' + 'slot}'
    new = f"""const LEGACY_COMMAND_SLOTS: Readonly<Record<string, string>> = {{
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
}}

function commandButton(...labels: string[]): HTMLButtonElement | null {{
  const root = document.querySelector<HTMLElement>('{scope}')
  if (!root) return null

  for (const label of labels) {{
    const slot = LEGACY_COMMAND_SLOTS[label]
    if (!slot) continue
    const stable = root.querySelector<HTMLButtonElement>(
      `button[data-command-slot=\"{slot_template}\"], button[data-battle-command=\"{slot_template}\"]`,
    )
    if (stable) return stable
  }}

  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}}
"""
    text = replace_exact(text, old, new, f'{keyboard_name} stable command lookup')
    path.write_text(text)
