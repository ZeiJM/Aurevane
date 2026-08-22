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

function tilePosition(button: HTMLButtonElement): { x: number; y: number } | null {
  const match = button.getAttribute('aria-label')?.match(/^Tile\s+(\d+),\s*(\d+)/i)
  if (!match) return null
  return { x: Number(match[1]) - 1, y: Number(match[2]) - 1 }
}

function positionKey(position: { x: number; y: number }): string {
  return `${position.x}:${position.y}`
}

function battleRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
}

function battleTiles(): HTMLButtonElement[] {
  const root = battleRoot()
  return root
    ? Array.from(root.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'))
    : []
}

function playerTile(playerName: string): HTMLButtonElement | null {
  return (
    battleTiles().find((button) =>
      (button.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
    ) ?? null
  )
}

function commandButton(...labels: string[]): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
  return (
    buttons.find((button) =>
      labels.includes(button.querySelector('strong')?.textContent?.trim() ?? ''),
    ) ?? null
  )
}

function commandIsActive(...labels: string[]): boolean {
  const button = commandButton(...labels)
  if (!button) return false
  return button.hasAttribute('data-active') || `${button.className}`.includes('commandActive')
}

function moveModeIsActive(): boolean {
  return commandIsActive('Move')
}

function attackModeIsActive(): boolean {
  return commandIsActive('Basic Attack')
}

function facingModeIsActive(): boolean {
  const root = battleRoot()
  if (!root) return false
  return Boolean(
    root.querySelector<HTMLButtonElement>('button[aria-label="Face north"]:not(:disabled)') &&
      root.querySelector<HTMLButtonElement>('button[aria-label="Face south"]:not(:disabled)') &&
      root.querySelector<HTMLButtonElement>('button[aria-label="Face west"]:not(:disabled)') &&
      root.querySelector<HTMLButtonElement>('button[aria-label="Face east"]:not(:disabled)'),
  )
}

function footerButton(text: string): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('footer button')).find((button) =>
      button.textContent?.includes(text),
    ) ?? null
  )
}

function combatLogButton(): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
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

function chooseFacing(direction: { dx: number; dy: number }): boolean {
  const label =
    direction.dy < 0
      ? 'Face north'
      : direction.dy > 0
        ? 'Face south'
        : direction.dx < 0
          ? 'Face west'
          : 'Face east'
  const button = battleRoot()?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button || button.disabled) return false
  button.click()
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
    const label = action === 'move' || action === 'endTurn' ? `${binding} · WASD` : binding
    if (badge.textContent !== label) badge.textContent = label
  }
}

function legalAttackTargets(playerName: string): HTMLButtonElement[] {
  return battleTiles().filter((button) => {
    const label = button.getAttribute('aria-label') ?? ''
    if (!label.includes('occupied by ') || label.includes(`occupied by ${playerName}`)) return false
    return button.dataset.target === 'enemy'
  })
}

export function PvpBattleKeyboardAssist({ playerName }: { playerName: string }) {
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const targetIndex = useRef(-1)
  const movementPlan = useRef<{
    committedOriginKey: string
    endpoint: { x: number; y: number }
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) setBindings(parsed)
      } catch {
        // Defaults remain available if preferences cannot be refreshed mid-battle.
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
      syncVisibleCommandLabels(bindings)
      if (!moveModeIsActive()) movementPlan.current = null
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [bindings])

  useEffect(() => {
    function cycleTarget(reverse: boolean): boolean {
      if (!attackModeIsActive()) return false
      const targets = legalAttackTargets(playerName)
      if (targets.length === 0) return false
      const direction = reverse ? -1 : 1
      targetIndex.current =
        targetIndex.current < 0
          ? reverse
            ? targets.length - 1
            : 0
          : (targetIndex.current + direction + targets.length) % targets.length
      const target = targets[targetIndex.current]
      target?.focus({ preventScroll: true })
      target?.click()
      return true
    }

    function moveAdjacent(direction: { dx: number; dy: number }): boolean {
      if (!moveModeIsActive()) return false
      const actorTile = playerTile(playerName)
      const committed = actorTile ? tilePosition(actorTile) : null
      if (!actorTile || !committed) return false

      const committedKey = positionKey(committed)
      if (!movementPlan.current || movementPlan.current.committedOriginKey !== committedKey) {
        movementPlan.current = { committedOriginKey: committedKey, endpoint: committed }
      }

      const base = movementPlan.current.endpoint
      const targetPosition = { x: base.x + direction.dx, y: base.y + direction.dy }
      if (targetPosition.x === committed.x && targetPosition.y === committed.y) {
        commandButton('Move')?.click()
        movementPlan.current = { committedOriginKey: committedKey, endpoint: committed }
        actorTile.focus({ preventScroll: true })
        return true
      }

      const prefix = `Tile ${targetPosition.x + 1}, ${targetPosition.y + 1};`
      const target = battleTiles().find((button) =>
        (button.getAttribute('aria-label') ?? '').startsWith(prefix),
      )
      if (!target || target.disabled || target.hasAttribute('data-facing-guide')) return false
      if ((target.getAttribute('aria-label') ?? '').includes('occupied by ')) return false
      if (!target.hasAttribute('data-reachable')) return false

      movementPlan.current = { committedOriginKey: committedKey, endpoint: targetPosition }
      target.focus({ preventScroll: true })
      target.click()
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
        movementPlan.current = null
        commandButton('Finish Turn', 'End Turn', 'Facing / End Turn')?.click()
        return true
      }
      if (action === 'confirm') {
        footerButton('Confirm Action')?.click()
        return true
      }
      if (action === 'cancel') {
        footerButton('Cancel')?.click()
        return true
      }
      if (action === 'faceNorth') {
        battleRoot()?.querySelector<HTMLButtonElement>('button[aria-label="Face north"]')?.click()
        return true
      }
      if (action === 'faceWest') {
        battleRoot()?.querySelector<HTMLButtonElement>('button[aria-label="Face west"]')?.click()
        return true
      }
      if (action === 'faceSouth') {
        battleRoot()?.querySelector<HTMLButtonElement>('button[aria-label="Face south"]')?.click()
        return true
      }
      if (action === 'faceEast') {
        battleRoot()?.querySelector<HTMLButtonElement>('button[aria-label="Face east"]')?.click()
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
        moveAdjacent(movementDirection)
        return
      }

      if (movementDirection && facingModeIsActive()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        chooseFacing(movementDirection)
        return
      }

      const chord = eventChord(event)
      const action = configuredAction(bindings, chord)
      if (action) {
        if ((action === 'nextTarget' || action === 'previousTarget') && !attackModeIsActive()) return
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
