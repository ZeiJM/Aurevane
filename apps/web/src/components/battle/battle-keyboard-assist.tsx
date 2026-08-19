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

function modeInstruction(): string {
  return (
    document.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]')?.textContent ??
    ''
  ).toLowerCase()
}

function attackModeIsActive(): boolean {
  return modeInstruction().includes('basic attack')
}

function moveModeIsActive(): boolean {
  return modeInstruction().includes('move') || modeInstruction().includes('movement')
}

function legalVisibleTargetButtons(playerName: string): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).filter((button) => {
    if (button.disabled) return false
    const label = button.getAttribute('aria-label') ?? ''
    return !label.includes(`occupied by ${playerName}`)
  })
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

function combatLogButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      button.textContent?.includes('Combat Log'),
    ) ?? null
  )
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

function directionForCode(code: string): { dx: number; dy: number } | null {
  if (code === 'ArrowUp' || code === 'KeyW') return { dx: 0, dy: -1 }
  if (code === 'ArrowDown' || code === 'KeyS') return { dx: 0, dy: 1 }
  if (code === 'ArrowLeft' || code === 'KeyA') return { dx: -1, dy: 0 }
  if (code === 'ArrowRight' || code === 'KeyD') return { dx: 1, dy: 0 }
  return null
}

function clickAdjacentMove(direction: { dx: number; dy: number }, playerName: string): boolean {
  const tiles = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
  )
  const playerTile = tiles.find((button) =>
    (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
  )
  const match = playerTile?.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return false

  const targetX = Number(match[1]) + direction.dx
  const targetY = Number(match[2]) + direction.dy
  const targetPrefix = `Tile ${targetX}, ${targetY};`
  const target = tiles.find((button) =>
    (button.getAttribute('aria-label') ?? '').startsWith(targetPrefix),
  )
  if (!target || target.disabled) return false
  if ((target.getAttribute('aria-label') ?? '').includes('occupied by ')) return false

  target.focus({ preventScroll: true })
  // Programmatic click has detail=0, which the battlefield deliberately routes through its
  // canonical move-selection handler without creating a second pointer preview request.
  target.click()
  return true
}

function syncVisibleCommandLabels(bindings: CombatKeybindMap) {
  const commands: readonly [CombatKeybindAction, readonly string[]][] = [
    ['inspect', ['Inspect']],
    ['move', ['Move']],
    ['basicAttack', ['Basic Attack']],
    ['guard', ['Guard']],
    ['recover', ['Recover']],
    ['endTurn', ['Finish Turn', 'End Turn', 'Facing / End Turn']],
  ]
  for (const [action, labels] of commands) {
    const button = commandButton(...labels)
    const badge = button?.querySelector<HTMLElement>(':scope > span')
    if (!badge) continue
    const binding = formatCombatKeybind(bindings[action])
    badge.textContent = action === 'move' ? `${binding} · WASD` : binding
  }
}

export function BattleKeyboardAssist({ playerName }: { playerName: string }) {
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
    syncVisibleCommandLabels(bindings)
    const observer = new MutationObserver(() => syncVisibleCommandLabels(bindings))
    const deck = document.querySelector('section[aria-label="Command Deck"]')
    if (deck) observer.observe(deck, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [bindings])

  useEffect(() => {
    function cycleTarget(reverse: boolean) {
      if (!attackModeIsActive()) return false
      const targets = legalVisibleTargetButtons(playerName)
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
      if (action === 'inspect') {
        commandButton('Inspect')?.click()
        return true
      }
      if (action === 'move') {
        commandButton('Move')?.click()
        return true
      }
      if (action === 'basicAttack') {
        commandButton('Basic Attack')?.click()
        return true
      }
      if (action === 'guard') {
        commandButton('Guard')?.click()
        return true
      }
      if (action === 'recover') {
        commandButton('Recover')?.click()
        return true
      }
      if (action === 'endTurn') {
        commandButton('Finish Turn', 'End Turn', 'Facing / End Turn')?.click()
        return true
      }
      if (action === 'confirm') {
        planningButton('Confirm Action')?.click()
        return true
      }
      if (action === 'cancel') {
        planningButton('Cancel')?.click()
        return true
      }
      if (action === 'faceNorth') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face north"]')?.click()
        return true
      }
      if (action === 'faceWest') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face west"]')?.click()
        return true
      }
      if (action === 'faceSouth') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face south"]')?.click()
        return true
      }
      if (action === 'faceEast') {
        document.querySelector<HTMLButtonElement>('[aria-label="Face east"]')?.click()
        return true
      }
      if (action === 'nextTarget') return cycleTarget(false)
      if (action === 'previousTarget') return cycleTarget(true)
      if (action === 'combatLog') {
        const trigger = combatLogButton()
        if (trigger) trigger.click()
        else window.dispatchEvent(new Event('aurevane:battle-log-toggle'))
        return true
      }
      return false
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target) || !event.code) return

      const movementDirection = directionForCode(event.code)
      if (movementDirection && moveModeIsActive()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        clickAdjacentMove(movementDirection, playerName)
        return
      }

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
  }, [bindings, playerName])

  return null
}
