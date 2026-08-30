'use client'

import { useEffect, useRef } from 'react'

const DOUBLE_TAP_WINDOW_MS = 760
const CONFIRM_WAIT_MS = 1500
const SYNTHETIC_CLICK_SUPPRESS_MS = 520
const QUICK_COMMANDS = ['Move', 'Basic Attack', 'Guard', 'Recover'] as const

type QuickCommand = (typeof QUICK_COMMANDS)[number]

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

function isQuickCommand(value: string): value is QuickCommand {
  return QUICK_COMMANDS.some((command) => command === value)
}

function commandButton(target: Element | null): HTMLButtonElement | null {
  const button = target?.closest<HTMLButtonElement>('section[aria-label="Command Deck"] button')
  if (!button) return null
  const label = textOf(button.querySelector('strong'))
  return isQuickCommand(label) ? button : null
}

function activeCommandLabel(): QuickCommand | null {
  const root = battleRoot()
  if (!root) return null
  const active = Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      'section[aria-label="Command Deck"] button[data-active]',
    ),
  ).find((button) => isQuickCommand(textOf(button.querySelector('strong'))))
  const label = active ? textOf(active.querySelector('strong')) : ''
  return isQuickCommand(label) ? label : null
}

function battlefieldTile(target: Element | null): HTMLButtonElement | null {
  const tile =
    target?.closest<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]') ?? null
  if (!tile || tile.dataset.facingGuide === 'true') return null

  const active = activeCommandLabel()
  if (active === 'Move') {
    return tile.hasAttribute('data-reachable') || tile.hasAttribute('data-path') ? tile : null
  }
  if (active === 'Basic Attack') {
    return tile.dataset.target === 'enemy' || tile.dataset.attackRange === 'legal' ? tile : null
  }
  if (active === 'Guard' || active === 'Recover') {
    return tile.dataset.target === 'friendly' || tile.dataset.targetRelation === 'friendly'
      ? tile
      : null
  }
  return null
}

function quickKey(target: Element | null): string | null {
  const command = commandButton(target)
  if (command) return `command:${textOf(command.querySelector('strong'))}`

  const tile = battlefieldTile(target)
  const active = activeCommandLabel()
  if (tile && active) return `tile:${active}:${tile.getAttribute('aria-label') ?? ''}`
  return null
}

function commandLabelForKey(key: string): QuickCommand | null {
  if (key.startsWith('command:')) {
    const label = key.slice('command:'.length)
    return isQuickCommand(label) ? label : null
  }
  if (!key.startsWith('tile:')) return null
  const labelEnd = key.indexOf(':', 'tile:'.length)
  if (labelEnd < 0) return null
  const label = key.slice('tile:'.length, labelEnd)
  return isQuickCommand(label) ? label : null
}

function requestConfirmWhenReady(key: string) {
  const started = performance.now()
  const commandLabel = commandLabelForKey(key)

  const attempt = () => {
    if (commandLabel && activeCommandLabel() !== commandLabel) return

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
      // Move/Attack/Guard/Recover preview on both PvE and PvP mobile battles.
      if (confirm && !confirm.disabled) {
        event.preventDefault()
        event.stopImmediatePropagation()
        suppressClick.current = { key, until: now + SYNTHETIC_CLICK_SUPPRESS_MS }
        confirm.click()
        return
      }

      // A slower preview may not have enabled Confirm Action by the second pointer-up. Let the
      // native click finish selecting the same target, then commit as soon as that matching mode's
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
