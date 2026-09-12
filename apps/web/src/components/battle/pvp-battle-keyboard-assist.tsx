'use client'

import { isBattleShortcutBlocked as isTextEntryTarget } from './battle-keyboard-scope'

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

function eventChord(event: KeyboardEvent): string {
  return combatKeybindChord({ code: event.code, shift: event.shiftKey })
}

function battleRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
}

function battleTiles(): HTMLButtonElement[] {
  const root = battleRoot()
  return root
    ? Array.from(
        root.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]'),
      )
    : []
}

const LEGACY_COMMAND_SLOTS: Readonly<Record<string, string>> = {
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
}

function commandButton(...labels: string[]): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null

  for (const label of labels) {
    const slot = LEGACY_COMMAND_SLOTS[label]
    if (!slot) continue
    const stable = root.querySelector<HTMLButtonElement>(
      `section[aria-label="Command Deck"] button[data-command-slot="${slot}"], section[aria-label="Command Deck"] button[data-battle-command="${slot}"]`,
    )
    if (stable) return stable
  }

  return (
    Array.from(
      root.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
    ).find((button) =>
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

function isSharedCategoryAction(action: CombatKeybindAction): boolean {
  return action === 'move' || action === 'basicAttack' || action === 'guard' || action === 'recover'
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
    ['recover', ['Recover', 'HP Recovery', 'MP Recovery']],
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
        commandButton('Recover', 'HP Recovery', 'MP Recovery')?.click()
        return true
      }
      if (action === 'endTurn') {
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
      // Preserve native tile/button/summary activation rather than committing an older preview.
      if (
        event.key === 'Enter' &&
        event.target instanceof Element &&
        event.target.closest('button, summary, a, [role="button"]')
      )
        return

      const movementDirection = directionForCode(event.code)
      if (movementDirection && moveModeIsActive()) {
        // Move preview keyboard editing is owned by BattleMovementKeyboardAssist for both PvE and PvP.
        // Do not consume the event here; the shared owner reads the rendered live path and trims it.
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
        // Shared category actions and Finish Turn have one persistent keyboard owner.
        // Viewport size changes presentation only; they must never swap keyboard implementations.
        if (isSharedCategoryAction(action) || action === 'endTurn') return
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
