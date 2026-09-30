/** Reading controls and native action-details dialogs own keyboard input instead of combat shortcuts. */
export function isBattleShortcutBlocked(target: EventTarget | null): boolean {
  // Inspect owns keyboard input even when focus remains on the tile that opened it.
  if (
    document.querySelector(
      '[data-desktop-battle-inspect="true"], [data-pvp-inspect-popup="true"], [data-mobile-battle-popup]',
    )
  )
    return true
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'dialog[open][data-battle-action-details], [data-battle-flow], [data-battle-effect-trigger], [data-battle-info-panel], [data-battle-info-trigger]',
    ) ||
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement,
  )
}
