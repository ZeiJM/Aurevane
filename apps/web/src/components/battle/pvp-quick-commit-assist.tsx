'use client'

import { useEffect, useRef } from 'react'

const DOUBLE_TAP_WINDOW_MS = 760
const CONFIRM_WAIT_MS = 1500
const SYNTHETIC_CLICK_SUPPRESS_MS = 520
const QUICK_COMMAND_SLOTS = ['move', 'attack', 'guard', 'recover'] as const

type QuickCommandSlot = (typeof QUICK_COMMAND_SLOTS)[number]

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function battleRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main[data-unified-battle="true"][data-battle-kind]')
}

function confirmButton(): HTMLButtonElement | null {
  const root = battleRoot()
  if (!root) return null
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('footer button')).find((button) =>
      textOf(button).includes('Confirm Action'),
    ) ?? null
  )
}

function isQuickCommandSlot(value: string): value is QuickCommandSlot {
  return QUICK_COMMAND_SLOTS.some((slot) => slot === value)
}

function commandSlot(button: HTMLButtonElement | null): QuickCommandSlot | null {
  const slot = button?.dataset.battleCommand ?? ''
  return isQuickCommandSlot(slot) ? slot : null
}

function commandButton(target: Element | null): HTMLButtonElement | null {
  const button = target?.closest<HTMLButtonElement>(
    'section[aria-label="Command Deck"] button[data-battle-command]',
  )
  return commandSlot(button ?? null) ? (button ?? null) : null
}

function activeCommandSlot(): QuickCommandSlot | null {
  const root = battleRoot()
  if (!root) return null
  const active = Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      'section[aria-label="Command Deck"] button[data-active][data-battle-command]',
    ),
  ).find((button) => commandSlot(button) !== null)
  return commandSlot(active ?? null)
}

function battlefieldTile(target: Element | null): HTMLButtonElement | null {
  const tile =
    target?.closest<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]') ?? null
  if (!tile || tile.dataset.facingGuide === 'true') return null

  const active = activeCommandSlot()
  if (active === 'move') {
    return tile.hasAttribute('data-reachable') || tile.hasAttribute('data-path') ? tile : null
  }
  if (active === 'attack') {
    return tile.dataset.target === 'enemy' || tile.dataset.attackRange === 'legal' ? tile : null
  }
  if (active === 'guard' || active === 'recover') {
    return tile.dataset.target === 'friendly' || tile.dataset.targetRelation === 'friendly'
      ? tile
      : null
  }
  return null
}

function quickKey(target: Element | null): string | null {
  const command = commandButton(target)
  const slot = commandSlot(command)
  if (slot) return `command:${slot}`

  const tile = battlefieldTile(target)
  const active = activeCommandSlot()
  if (tile && active) return `tile:${active}:${tile.getAttribute('aria-label') ?? ''}`
  return null
}

function commandSlotForKey(key: string): QuickCommandSlot | null {
  if (key.startsWith('command:')) {
    const slot = key.slice('command:'.length)
    return isQuickCommandSlot(slot) ? slot : null
  }
  if (!key.startsWith('tile:')) return null
  const slotEnd = key.indexOf(':', 'tile:'.length)
  if (slotEnd < 0) return null
  const slot = key.slice('tile:'.length, slotEnd)
  return isQuickCommandSlot(slot) ? slot : null
}

function requestConfirmWhenReady(key: string) {
  const started = performance.now()
  const expectedSlot = commandSlotForKey(key)

  const attempt = () => {
    if (expectedSlot && activeCommandSlot() !== expectedSlot) return

    const confirm = confirmButton()
    if (confirm && !confirm.disabled) {
      confirm.click()
      return
    }

    if (performance.now() - started < CONFIRM_WAIT_MS) window.requestAnimationFrame(attempt)
  }

  window.requestAnimationFrame(attempt)
}

export function PvpQuickCommitAssist() {
  const lastTap = useRef<{ key: string; at: number } | null>(null)
  const suppressClick = useRef<{ key: string; until: number } | null>(null)

  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches

    const onPointerUp = (event: PointerEvent) => {
      if (!isCoarse || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return
      const target = event.target instanceof Element ? event.target : null
      const key = quickKey(target)
      if (!key) {
        lastTap.current = null
        return
      }

      const now = Date.now()
      const previous = lastTap.current
      const secondTap = Boolean(
        previous && previous.key === key && now - previous.at <= DOUBLE_TAP_WINDOW_MS,
      )

      if (!secondTap) {
        lastTap.current = { key, at: now }
        return
      }

      lastTap.current = null
      const confirm = confirmButton()

      // Tap one still uses the native authoritative preview path. Tap two commits that same legal
      // category-slot preview on both PvE and PvP mobile battles.
      if (confirm && !confirm.disabled) {
        event.preventDefault()
        event.stopImmediatePropagation()
        suppressClick.current = { key, until: now + SYNTHETIC_CLICK_SUPPRESS_MS }
        confirm.click()
        return
      }

      // A slower preview may not have enabled Confirm Action by the second pointer-up. Let the
      // native click finish selecting the same target, then commit as soon as that matching slot's
      // server-backed preview becomes legal. Changing modes cancels the wait.
      requestConfirmWhenReady(key)
    }

    const onClick = (event: MouseEvent) => {
      if (!isCoarse) return
      const target = event.target instanceof Element ? event.target : null
      const key = quickKey(target)
      const suppressed = suppressClick.current
      if (!key || !suppressed || suppressed.key !== key || Date.now() > suppressed.until) return
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressClick.current = null
    }

    const onDoubleClick = (event: MouseEvent) => {
      if (isCoarse) return
      const target = event.target instanceof Element ? event.target : null
      const key = quickKey(target)
      if (!key) return
      event.preventDefault()
      event.stopImmediatePropagation()

      const confirm = confirmButton()
      if (confirm && !confirm.disabled) confirm.click()
      else requestConfirmWhenReady(key)
    }

    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onDoubleClick, true)
    return () => {
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onDoubleClick, true)
    }
  }, [])

  return null
}
