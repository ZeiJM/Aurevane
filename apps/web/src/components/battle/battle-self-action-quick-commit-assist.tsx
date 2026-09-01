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
import { useEffect, useRef, useState } from 'react'

type CommandSlot = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'
type CategoryAction = Extract<CombatKeybindAction, 'move' | 'basicAttack' | 'guard' | 'recover'>

type SlotBinding = readonly [CombatKeybindAction, CommandSlot]

const CATEGORY_ACTION_SLOTS: Record<CategoryAction, CommandSlot> = {
  move: 'move',
  basicAttack: 'attack',
  guard: 'guard',
  recover: 'recover',
}

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

function commandButton(slot: CommandSlot): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `section[aria-label="Command Deck"] button[data-battle-command="${slot}"]`,
  )
}

function commandIsActive(slot: CommandSlot): boolean {
  const button = commandButton(slot)
  return Boolean(
    button &&
    !button.disabled &&
    (button.hasAttribute('data-active') ||
      button.dataset.battleActive === 'true' ||
      `${button.className}`.includes('commandActive')),
  )
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
  // A second press for the current self-action slot commits through the real unified footer, so
  // the shortcut never bypasses the authoritative preview/confirmation path.
  return document.querySelector<HTMLButtonElement>(
    'footer[data-unified-battle-footer="true"] > div > button:nth-of-type(2)',
  )
}

export function BattleSelfActionQuickCommitAssist() {
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const commitSequence = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) setBindings(parsed)
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
    const deck = document.querySelector('section[aria-label="Command Deck"]')
    if (deck) observer.observe(deck, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [bindings])

  useEffect(() => {
    function commitWhenPreviewReady(slot: CommandSlot) {
      const sequence = ++commitSequence.current
      let attempts = 0

      const tryCommit = () => {
        attempts += 1
        if (sequence !== commitSequence.current || attempts > 40 || !commandIsActive(slot)) {
          return true
        }

        const confirm = confirmButton()
        if (!confirm || confirm.disabled) return false
        commitSequence.current += 1
        confirm.click()
        return true
      }

      if (tryCommit()) return

      const timer = window.setInterval(() => {
        if (tryCommit()) window.clearInterval(timer)
      }, 50)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        isTextEntryTarget(event.target) ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !event.code ||
        !window.matchMedia('(min-width: 821px)').matches
      ) {
        return
      }

      const action = configuredAction(bindings, eventChord(event))
      if (!action || !isCategoryAction(action)) return

      const slot = CATEGORY_ACTION_SLOTS[action]
      const button = commandButton(slot)
      if (!button) return

      if ((action === 'guard' || action === 'recover') && commandIsActive(slot)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        commitWhenPreviewReady(slot)
        return
      }

      // Category hotkeys belong to the cockpit slot, not to the currently displayed skill name.
      // Clicking the actual button preserves every existing preview, legality, and server-authority
      // boundary while allowing a future skill swap to keep the player's configured keybind.
      event.preventDefault()
      event.stopImmediatePropagation()
      commitSequence.current += 1
      button.click()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      commitSequence.current += 1
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [bindings])

  return null
}
