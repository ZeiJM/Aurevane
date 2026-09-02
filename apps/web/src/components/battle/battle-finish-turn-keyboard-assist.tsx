'use client'

import {
  DEFAULT_COMBAT_KEYBINDS,
  parseCombatKeybindMap,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { useEffect, useLayoutEffect, useRef } from 'react'

const DESKTOP_QUERY = '(min-width: 821px)'
const TRANSIENT_SECOND_PRESS_MS = 800
const FACING_READY_WAIT_MS = 1500
const FACING_LABELS = ['north', 'east', 'south', 'west'] as const

type Facing = (typeof FACING_LABELS)[number]

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function activeBattleRoot(): HTMLElement | null {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('main[data-unified-battle="true"][data-battle-kind]'),
  )
  return (
    roots.find(
      (root) =>
        root.dataset.localTurn === 'true' &&
        root.getClientRects().length > 0 &&
        root.ariaHidden !== 'true',
    ) ?? null
  )
}

function finishTurnButton(root: HTMLElement): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(
    'section[aria-label="Command Deck"] button[data-battle-command="finish"]',
  )
}

function facingControlsActive(root: HTMLElement): boolean {
  return FACING_LABELS.every((facing) => {
    const button = root.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
    return Boolean(button && !button.disabled)
  })
}

function facingFromText(value: string): Facing | null {
  const lower = value.toLowerCase()
  if (value.includes('↑') || lower.includes('facing north')) return 'north'
  if (value.includes('→') || lower.includes('facing east')) return 'east'
  if (value.includes('↓') || lower.includes('facing south')) return 'south'
  if (value.includes('←') || lower.includes('facing west')) return 'west'
  return null
}

function currentFacing(root: HTMLElement, playerName: string): Facing | null {
  const playerTile = Array.from(
    root.querySelectorAll<HTMLButtonElement>('#battlefield button[aria-label*="occupied by"]'),
  ).find((tile) => (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`))
  if (playerTile) {
    const ariaFacing = facingFromText(playerTile.getAttribute('aria-label') ?? '')
    if (ariaFacing) return ariaFacing

    for (const marker of playerTile.querySelectorAll<HTMLElement>('i, span')) {
      const facing = facingFromText(marker.textContent?.trim() ?? '')
      if (facing) return facing
    }
  }

  const semanticFacing = root.querySelector<HTMLElement>(
    '[aria-label*="Finishing; facing "], [aria-label*="Current facing:"]',
  )
  return facingFromText(semanticFacing?.getAttribute('aria-label') ?? '')
}

function currentFacingButton(root: HTMLElement, playerName: string): HTMLButtonElement | null {
  const facing = currentFacing(root, playerName)
  if (!facing) return null
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="Face ${facing}"]`)
  return button && !button.disabled ? button : null
}

function finishTurnIsActive(button: HTMLButtonElement): boolean {
  return (
    button.hasAttribute('data-active') ||
    button.dataset.battleActive === 'true' ||
    `${button.className}`.includes('commandActive')
  )
}

export function BattleFinishTurnKeyboardAssist({ playerName }: { playerName: string }) {
  const bindingsRef = useRef<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const playerNameRef = useRef(playerName)
  const firstPressAtRef = useRef<number | null>(null)
  const pendingCommitSequenceRef = useRef(0)
  playerNameRef.current = playerName

  useEffect(() => {
    let cancelled = false

    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) bindingsRef.current = parsed
      } catch {
        // Default bindings remain authoritative for this session if preferences cannot be refreshed.
      }
    }

    void loadControls()
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    function cancelPendingCommit() {
      pendingCommitSequenceRef.current += 1
      firstPressAtRef.current = null
    }

    function commitCurrentFacingWhenReady() {
      const sequence = ++pendingCommitSequenceRef.current
      const started = performance.now()

      const attempt = () => {
        if (sequence !== pendingCommitSequenceRef.current || document.hidden) return

        const root = activeBattleRoot()
        if (!root) {
          firstPressAtRef.current = null
          return
        }

        if (facingControlsActive(root)) {
          const facing = currentFacingButton(root, playerNameRef.current)
          if (facing) {
            firstPressAtRef.current = null
            facing.click()
            return
          }
        }

        if (performance.now() - started < FACING_READY_WAIT_MS) {
          window.requestAnimationFrame(attempt)
        } else {
          firstPressAtRef.current = null
        }
      }

      window.requestAnimationFrame(attempt)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.repeat ||
        isTextEntryTarget(event.target) ||
        !event.code ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !window.matchMedia(DESKTOP_QUERY).matches
      ) {
        return
      }

      const binding = bindingsRef.current.endTurn
      if (event.code !== binding.code || event.shiftKey !== binding.shift) return

      const root = activeBattleRoot()
      if (!root) return

      const finishTurn = finishTurnButton(root)
      if (!finishTurn || finishTurn.disabled) return

      event.preventDefault()
      event.stopImmediatePropagation()

      if (facingControlsActive(root)) {
        const facing = currentFacingButton(root, playerNameRef.current)
        if (facing) {
          cancelPendingCommit()
          facing.click()
        }
        return
      }

      const now = performance.now()
      const firstPressAt = firstPressAtRef.current
      const transientSecondPress =
        firstPressAt !== null && now - firstPressAt <= TRANSIENT_SECOND_PRESS_MS

      if (finishTurnIsActive(finishTurn) || transientSecondPress) {
        commitCurrentFacingWhenReady()
        return
      }

      firstPressAtRef.current = now
      finishTurn.click()
    }

    function handleBlur() {
      cancelPendingCommit()
    }

    function handleVisibilityChange() {
      if (document.hidden) cancelPendingCommit()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      pendingCommitSequenceRef.current += 1
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
