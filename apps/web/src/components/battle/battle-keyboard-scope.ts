/** Reading controls and native action-details dialogs own keyboard input instead of combat shortcuts. */
export function isBattleShortcutBlocked(target: EventTarget | null): boolean {
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
