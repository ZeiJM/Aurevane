export const BATTLE_EFFECT_KEYBOARD_HELP =
  'Read battle effects with Ctrl+Alt+E. Use Up and Down arrows, Home or End to choose an effect; Enter or Space opens its report. Escape closes the report, then returns to the previous focus.'

const effectSelector = 'button[data-battle-live-effect-trigger]'

/** Information navigation has no configurable combat chord and never submits a command. */
export function registerBattleEffectKeyboardNavigation(
  target: EventTarget,
  doc: Document,
): () => void {
  let origin: HTMLElement | null = null
  const readEffects = (event: Event) => {
    const key = event as KeyboardEvent
    if (key.defaultPrevented || doc.hidden) return
    const source = key.target instanceof HTMLElement ? key.target : null
    if (
      !source ||
      source.isContentEditable ||
      source.closest('input, textarea, select, [contenteditable="true"]')
    )
      return
    const inspect = doc.querySelector<HTMLElement>('[data-battle-effect-inspect]')
    const modal = doc.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open]')
    if (modal && modal !== inspect) return
    const entry = key.code === 'KeyE' && key.ctrlKey && key.altKey && !key.metaKey && !key.shiftKey
    if (entry) {
      key.preventDefault()
      key.stopImmediatePropagation()
    }
    if (key.repeat) return
    const current = source.closest<HTMLButtonElement>(effectSelector)
    const onOwner = source === inspect
    if (!entry && !current && !onOwner) return
    if (entry && doc.querySelector('[data-battle-info-panel]')) return
    if (!entry && (key.ctrlKey || key.altKey || key.metaKey || key.shiftKey)) return
    if (key.key === 'Escape') {
      // The active popup gets first Escape, including its trigger-focused hover reader.
      if (!current || doc.querySelector('[data-battle-info-panel]') || !origin) return
      key.preventDefault()
      key.stopImmediatePropagation()
      const previous = origin
      origin = null
      if (previous !== doc.body && previous.isConnected) previous.focus({ preventScroll: true })
      if (previous === doc.body || doc.activeElement !== previous)
        doc
          .querySelector<HTMLElement>('main[data-battle-keyboard-focus-root="true"]')
          ?.focus({ preventScroll: true })
      return
    }
    if (!entry && !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key.key)) return
    const scope = inspect ?? doc
    const effects = Array.from(scope.querySelectorAll<HTMLButtonElement>(effectSelector)).filter(
      (button) =>
        !button.disabled &&
        !button.closest('[hidden], [aria-hidden="true"]') &&
        button.getClientRects().length > 0,
    )
    if (!effects.length) return
    const index = effects.indexOf(current!)
    const next =
      entry || key.key === 'Home'
        ? 0
        : key.key === 'End'
          ? effects.length - 1
          : key.key === 'ArrowDown'
            ? (index + 1) % effects.length
            : index <= 0
              ? effects.length - 1
              : index - 1
    if (!current) origin = source
    key.preventDefault()
    key.stopImmediatePropagation()
    effects[next]!.focus()
  }
  const options = { capture: true }
  target.addEventListener('keydown', readEffects, options)
  return () => target.removeEventListener('keydown', readEffects, options)
}
