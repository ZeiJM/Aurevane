'use client'

import {
  COMBAT_KEYBIND_ACTIONS,
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindChord,
  formatCombatKeybind,
  parseCombatKeybindMap,
  type CombatKeybindAction,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type CommandSlot = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type CategoryAction = Extract<CombatKeybindAction, 'move' | 'basicAttack' | 'guard' | 'recover'>

type SlotBinding = readonly [CombatKeybindAction, CommandSlot]

const CATEGORY_ACTION_SLOTS: Record<CategoryAction, CommandSlot> = {
  move: 'move',
  basicAttack: 'attack',
  guard: 'guard',
  recover: 'recover',
}

const TRANSIENT_SECOND_PRESS_MS = 800

const VISIBLE_COMMAND_SLOTS: readonly SlotBinding[] = [
  ['inspect', 'inspect'],
  ['move', 'move'],
  ['basicAttack', 'attack'],
  ['guard', 'guard'],
  ['recover', 'recover'],
  ['endTurn', 'finish'],
]

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function eventChord(event: KeyboardEvent): string {
  return combatKeybindChord({ code: event.code, shift: event.shiftKey })
}

function configuredAction(bindings: CombatKeybindMap, chord: string): CombatKeybindAction | null {
  return (
    COMBAT_KEYBIND_ACTIONS.find((action) => combatKeybindChord(bindings[action]) === chord) ?? null
  )
}

function isCategoryAction(action: CombatKeybindAction): action is CategoryAction {
  return action === 'move' || action === 'basicAttack' || action === 'guard' || action === 'recover'
}

function isCommandSlot(value: string | undefined): value is CommandSlot {
  return (
    value === 'inspect' ||
    value === 'move' ||
    value === 'attack' ||
    value === 'guard' ||
    value === 'recover' ||
    value === 'finish'
  )
}

function battleRoot(): HTMLElement | null {
  const roots = document.querySelectorAll<HTMLElement>(
    'main[data-unified-battle="true"][data-battle-kind]',
  )
  return (
    Array.from(roots).find(
      (root) => root.isConnected && root.getClientRects().length > 0 && root.ariaHidden !== 'true',
    ) ?? null
  )
}

function commandButton(slot: CommandSlot): HTMLButtonElement | null {
  return (
    battleRoot()?.querySelector<HTMLButtonElement>(
      `section[aria-label="Command Deck"] button[data-battle-command="${slot}"]`,
    ) ?? null
  )
}

function buttonIsActive(button: HTMLButtonElement): boolean {
  return (
    button.hasAttribute('data-active') ||
    button.dataset.battleActive === 'true' ||
    `${button.className}`.includes('commandActive')
  )
}

function commandIsActive(slot: CommandSlot): boolean {
  const button = commandButton(slot)
  return Boolean(button && !button.disabled && buttonIsActive(button))
}

function activeCommandSlot(): CommandSlot | null {
  const root = battleRoot()
  if (!root) return null

  const buttons = root.querySelectorAll<HTMLButtonElement>(
    'section[aria-label="Command Deck"] button[data-battle-command]',
  )
  for (const button of buttons) {
    if (!buttonIsActive(button)) continue
    const slot = button.dataset.battleCommand
    if (isCommandSlot(slot)) return slot
  }
  return null
}

function syncVisibleCommandHotkeys(bindings: CombatKeybindMap) {
  for (const [action, slot] of VISIBLE_COMMAND_SLOTS) {
    const button = commandButton(slot)
    const badge = button?.querySelector<HTMLElement>(':scope > span')
    if (!badge) continue
    const binding = formatCombatKeybind(bindings[action])
    const label = action === 'move' || action === 'endTurn' ? `${binding} · WASD` : binding
    if (badge.textContent !== label) badge.textContent = label
  }
}

function confirmButton(): HTMLButtonElement | null {
  const footer = battleRoot()?.querySelector<HTMLElement>(
    'footer[data-unified-battle-footer="true"]',
  )
  if (!footer) return null

  // Resolve the semantic action inside the active battle instead of relying on footer child order.
  return (
    Array.from(footer.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Confirm Action'),
    ) ?? null
  )
}

export function BattleSelfActionQuickCommitAssist() {
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const bindingsRef = useRef<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const commitSequence = useRef(0)
  const armedCategoryRef = useRef<{ slot: CommandSlot; armedAt: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) {
          // Keep keyboard ownership stable while preferences refresh. Re-registering the capture
          // listener here creates an ordering race with the legacy PvE/PvP keyboard helpers.
          bindingsRef.current = parsed
          setBindings(parsed)
        }
      } catch {
        // Default combat bindings remain valid if preferences cannot be refreshed mid-battle.
      }
    }

    void loadControls()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let frame = 0
    const sync = () => {
      frame = 0
      syncVisibleCommandHotkeys(bindings)
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    const deck = battleRoot()?.querySelector('section[aria-label="Command Deck"]')
    if (deck) observer.observe(deck, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [bindings])

  // Category cockpit keys need one deterministic capture owner. Register in the layout phase and
  // keep this listener mounted for the component lifetime so async control refreshes cannot reorder
  // it behind the older PvE/PvP keyboard assists on different browsers or network timings.
  useLayoutEffect(() => {
    const cancelPendingCommit = () => {
      commitSequence.current += 1
      armedCategoryRef.current = null
    }

    function commitWhenPreviewReady(slot: CommandSlot) {
      const sequence = ++commitSequence.current
      const startedAt = performance.now()

      const tryCommit = () => {
        if (sequence !== commitSequence.current || document.hidden || !document.hasFocus()) return

        // A React preview refresh may briefly replace the active button. Treat a temporary lack of
        // an active slot as transitional, but abort if the player has actually armed another slot.
        const activeSlot = activeCommandSlot()
        if (activeSlot && activeSlot !== slot) {
          // A just-closed Inspect popup or a very fast second keypress can leave the previous
          // command marked active for a frame. Give React a short transition window instead of
          // treating that stale DOM marker as a reason to discard the deliberate second press.
          if (performance.now() - startedAt < 300) window.requestAnimationFrame(tryCommit)
          return
        }

        const confirm = confirmButton()
        if (confirm && !confirm.disabled) {
          commitSequence.current += 1
          confirm.click()
          return
        }

        if (performance.now() - startedAt < 1_600) {
          window.requestAnimationFrame(tryCommit)
        }
      }

      tryCommit()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        isTextEntryTarget(event.target) ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !event.code
      ) {
        return
      }

      const action = configuredAction(bindingsRef.current, eventChord(event))
      if (!action || !isCategoryAction(action)) return

      const slot = CATEGORY_ACTION_SLOTS[action]
      const button = commandButton(slot)
      if (!button || button.disabled) return

      const now = performance.now()
      const armed = armedCategoryRef.current
      const deliberateSecondPress =
        armed?.slot === slot && now - armed.armedAt <= TRANSIENT_SECOND_PRESS_MS

      if (
        (action === 'guard' || action === 'recover') &&
        (commandIsActive(slot) || deliberateSecondPress)
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        armedCategoryRef.current = null
        commitWhenPreviewReady(slot)
        return
      }

      // Category hotkeys belong to the cockpit slot, not to the currently displayed skill name.
      // Clicking the actual button preserves every existing preview, legality, and server-authority
      // boundary while allowing HP/MP Recovery swaps to keep the same configured keybind.
      event.preventDefault()
      event.stopImmediatePropagation()
      commitSequence.current += 1
      armedCategoryRef.current = { slot, armedAt: now }
      button.click()
    }

    function handleVisibilityChange() {
      if (document.hidden) cancelPendingCommit()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('blur', cancelPendingCommit)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelPendingCommit()
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('blur', cancelPendingCommit)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
