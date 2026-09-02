'use client'

import {
  DEFAULT_COMBAT_KEYBINDS,
  parseCombatKeybindMap,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { useBattleInteractionLifecycle } from './battle-interaction-lifecycle'

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

function visibleBattleRoot(): HTMLElement | null {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('main[data-unified-battle="true"][data-battle-kind]'),
  )
  return (
    roots.find((root) => root.getClientRects().length > 0 && root.ariaHidden !== 'true') ?? null
  )
}

function activeBattleRoot(): HTMLElement | null {
  const root = visibleBattleRoot()
  return root?.dataset.localTurn === 'true' ? root : null
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
    const indicator = playerTile.querySelector<HTMLElement>('[data-battle-facing-indicator="true"]')
    const indicatorFacing = indicator?.dataset.facing
    if (
      indicatorFacing === 'north' ||
      indicatorFacing === 'east' ||
      indicatorFacing === 'south' ||
      indicatorFacing === 'west'
    ) {
      return indicatorFacing
    }

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

function markDecision(root: HTMLElement | null, decision: string, event?: KeyboardEvent) {
  if (!root) return
  root.dataset.finishTurnHotkeyLastDecision = decision
  if (event) {
    root.dataset.finishTurnHotkeyLastCode = event.code || '(empty)'
    root.dataset.finishTurnHotkeyLastTarget =
      event.target instanceof HTMLElement
        ? `${event.target.tagName}:${event.target.getAttribute('aria-label') ?? ''}`
        : 'non-html'
  }
}

export function BattleFinishTurnKeyboardAssist({ playerName }: { playerName: string }) {
  const { finishTurnReady, requestFinishTurn } = useBattleInteractionLifecycle()
  const bindingsRef = useRef<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const playerNameRef = useRef(playerName)
  const requestFinishTurnRef = useRef(requestFinishTurn)
  const firstPressAtRef = useRef<number | null>(null)
  const pendingCommitSequenceRef = useRef(0)
  playerNameRef.current = playerName
  requestFinishTurnRef.current = requestFinishTurn

  useEffect(() => {
    let cancelled = false

    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) bindingsRef.current = parsed
      } catch {
        // Keep default bindings for this session if preferences cannot be refreshed.
      }
    }

    void loadControls()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = visibleBattleRoot()
    if (!root) return
    if (finishTurnReady) root.dataset.finishTurnHotkeyOwner = 'ready'
    else delete root.dataset.finishTurnHotkeyOwner

    return () => {
      if (root.dataset.finishTurnHotkeyOwner === 'ready') {
        delete root.dataset.finishTurnHotkeyOwner
      }
    }
  }, [finishTurnReady])

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
            markDecision(root, 'handled-second')
            facing.click()
            return
          }
        }

        if (performance.now() - started < FACING_READY_WAIT_MS) {
          window.requestAnimationFrame(attempt)
        } else {
          firstPressAtRef.current = null
          markDecision(root, 'second-facing-unavailable')
        }
      }

      window.requestAnimationFrame(attempt)
    }

    function handleKeyDown(event: KeyboardEvent) {
      const observedRoot = visibleBattleRoot()
      markDecision(observedRoot, 'observed', event)

      if (event.repeat) {
        markDecision(observedRoot, 'repeat', event)
        return
      }
      if (event.isComposing) {
        markDecision(observedRoot, 'composing', event)
        return
      }
      if (isTextEntryTarget(event.target)) {
        markDecision(observedRoot, 'text-entry', event)
        return
      }
      if (!event.code) {
        markDecision(observedRoot, 'no-code', event)
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        markDecision(observedRoot, 'modifier', event)
        return
      }
      const binding = bindingsRef.current.endTurn
      if (event.code !== binding.code || event.shiftKey !== binding.shift) {
        markDecision(observedRoot, `binding-mismatch:${binding.code}:${binding.shift}`, event)
        return
      }

      const root = activeBattleRoot()
      if (!root) {
        markDecision(observedRoot, 'no-root', event)
        return
      }

      const finishTurn = finishTurnButton(root)
      if (!finishTurn || finishTurn.disabled) {
        markDecision(root, 'finish-unavailable', event)
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()

      if (facingControlsActive(root)) {
        const facing = currentFacingButton(root, playerNameRef.current)
        if (facing) {
          cancelPendingCommit()
          markDecision(root, 'handled-facing', event)
          facing.click()
        } else {
          markDecision(root, 'facing-current-unavailable', event)
        }
        return
      }

      const now = performance.now()
      const firstPressAt = firstPressAtRef.current
      const transientSecondPress =
        firstPressAt !== null && now - firstPressAt <= TRANSIENT_SECOND_PRESS_MS

      if (transientSecondPress) {
        markDecision(root, 'handled-transient-second', event)
        commitCurrentFacingWhenReady()
        return
      }

      if (!requestFinishTurnRef.current()) {
        firstPressAtRef.current = null
        markDecision(root, 'finish-handler-unavailable', event)
        return
      }

      firstPressAtRef.current = now
      markDecision(root, 'handled-first', event)
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
