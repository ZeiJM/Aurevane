'use client'

import {
  COMBAT_KEYBIND_ACTIONS,
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindChord,
  parseCombatKeybindMap,
  type CombatKeybindAction,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { useEffect, useRef, useState } from 'react'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function eventChord(event: KeyboardEvent): string {
  return combatKeybindChord({ code: event.code, shift: event.shiftKey })
}

function attackModeIsActive(): boolean {
  const instruction = document.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]')
  return (instruction?.textContent ?? '').toLowerCase().includes('basic attack')
}

function legalVisibleTargetButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).filter(
    (button) => !button.disabled && !button.getAttribute('aria-label')?.includes('character'),
  )
}

function commandButton(...labels: string[]): HTMLButtonElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}

function planningButton(text: string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('footer button'))
  return buttons.find((button) => button.textContent?.includes(text)) ?? null
}

function configuredAction(bindings: CombatKeybindMap, chord: string): CombatKeybindAction | null {
  return (
    COMBAT_KEYBIND_ACTIONS.find((action) => combatKeybindChord(bindings[action]) === chord) ?? null
  )
}

function defaultAction(chord: string): CombatKeybindAction | null {
  return (
    COMBAT_KEYBIND_ACTIONS.find(
      (action) => combatKeybindChord(DEFAULT_COMBAT_KEYBINDS[action]) === chord,
    ) ?? null
  )
}

export function BattleKeyboardAssist() {
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const targetIndex = useRef(-1)

  useEffect(() => {
    let cancelled = false
    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) setBindings(parsed)
      } catch {
        // Defaults remain available if account preferences cannot be refreshed mid-battle.
      }
    }
    void loadControls()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function cycleTarget(reverse: boolean) {
      if (!attackModeIsActive()) return false
      const targets = legalVisibleTargetButtons()
      if (targets.length === 0) return false
      const direction = reverse ? -1 : 1
      targetIndex.current =
        targetIndex.current < 0
          ? reverse
            ? targets.length - 1
            : 0
          : (targetIndex.current + direction + targets.length) % targets.length
      const target = targets[targetIndex.current]
      target?.focus()
      target?.click()
      return true
    }

    function execute(action: CombatKeybindAction): boolean {
      if (action === 'inspect') return Boolean(commandButton('Inspect')?.click() ?? true)
      if (action === 'move') return Boolean(commandButton('Move')?.click() ?? true)
      if (action === 'basicAttack') return Boolean(commandButton('Basic Attack')?.click() ?? true)
      if (action === 'guard') return Boolean(commandButton('Guard')?.click() ?? true)
      if (action === 'endTurn') {
        commandButton('Finish Turn', 'End Turn', 'Facing / End Turn')?.click()
        return true
      }
      if (action === 'confirm') return Boolean(planningButton('Confirm action')?.click() ?? true)
      if (action === 'cancel') return Boolean(planningButton('Cancel')?.click() ?? true)
      if (action === 'faceNorth')
        return Boolean(
          document.querySelector<HTMLButtonElement>('[aria-label="Face north"]')?.click() ?? true,
        )
      if (action === 'faceWest')
        return Boolean(
          document.querySelector<HTMLButtonElement>('[aria-label="Face west"]')?.click() ?? true,
        )
      if (action === 'faceSouth')
        return Boolean(
          document.querySelector<HTMLButtonElement>('[aria-label="Face south"]')?.click() ?? true,
        )
      if (action === 'faceEast')
        return Boolean(
          document.querySelector<HTMLButtonElement>('[aria-label="Face east"]')?.click() ?? true,
        )
      if (action === 'nextTarget') return cycleTarget(false)
      if (action === 'previousTarget') return cycleTarget(true)
      if (action === 'combatLog') {
        window.dispatchEvent(new Event('aurevane:battle-log-toggle'))
        return true
      }
      return false
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || !event.code) return
      const chord = eventChord(event)
      const action = configuredAction(bindings, chord)
      if (action) {
        if ((action === 'nextTarget' || action === 'previousTarget') && !attackModeIsActive())
          return
        event.preventDefault()
        event.stopImmediatePropagation()
        execute(action)
        return
      }
      const legacyAction = defaultAction(chord)
      if (legacyAction && combatKeybindChord(bindings[legacyAction]) !== chord) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [bindings])

  return null
}
