'use client'

import { useEffect, useRef } from 'react'

const DOUBLE_TAP_WINDOW_MS = 750
const CONFIRM_WAIT_MS = 1200
const SYNTHETIC_CLICK_SUPPRESS_MS = 450

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function confirmButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      textOf(button).includes('Confirm Action'),
    ) ?? null
  )
}

function commandButton(target: Element | null): HTMLButtonElement | null {
  const button = target?.closest<HTMLButtonElement>('section[aria-label="Command Deck"] button')
  if (!button) return null
  const label = textOf(button.querySelector('strong'))
  return ['Move', 'Basic Attack', 'Guard', 'Recover'].includes(label) ? button : null
}

function battlefieldTile(target: Element | null): HTMLButtonElement | null {
  const tile = target?.closest<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]') ?? null
  // Yellow facing guides have their own first-tap preview / second-tap commit handler.
  // Do not let the generic PvP quick-commit layer compete with that interaction.
  return tile?.dataset.facingGuide === 'true' ? null : tile
}

function quickKey(target: Element | null): string | null {
  const command = commandButton(target)
  if (command) return `command:${textOf(command.querySelector('strong'))}`
  const tile = battlefieldTile(target)
  if (tile) return `tile:${tile.getAttribute('aria-label') ?? ''}`
  return null
}

function activeCommandLabel(): string | null {
  const active = Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button[data-active="true"]'),
  ).find((button) => ['Move', 'Basic Attack', 'Guard', 'Recover'].includes(textOf(button.querySelector('strong'))))
  return active ? textOf(active.querySelector('strong')) : null
}

function commandLabelForKey(key: string): string | null {
  return key.startsWith('command:') ? key.slice('command:'.length) : null
}

function requestConfirmWhenReady(key: string) {
  const started = performance.now()
  const commandLabel = commandLabelForKey(key)

  const attempt = () => {
    // If the user changed away from the command they double-tapped, cancel the pending shortcut.
    if (commandLabel && activeCommandLabel() !== commandLabel) return

    const confirm = confirmButton()
    if (confirm && !confirm.disabled) {
      confirm.click()
      return
    }

    if (performance.now() - started < CONFIRM_WAIT_MS) {
      window.requestAnimationFrame(attempt)
    }
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
      if (!key) return

      const now = Date.now()
      const previous = lastTap.current
      const secondTap = Boolean(
        previous && previous.key === key && now - previous.at <= DOUBLE_TAP_WINDOW_MS,
      )

      if (!secondTap) {
        lastTap.current = { key, at: now }
        return
      }

      // The first tap has already selected the command/target. On the second tap, prevent the
      // browser's synthesized click from re-running the normal onClick handler and clearing the
      // preview before Confirm Action can fire.
      event.preventDefault()
      event.stopImmediatePropagation()
      lastTap.current = null
      suppressClick.current = { key, until: now + SYNTHETIC_CLICK_SUPPRESS_MS }
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
      requestConfirmWhenReady(key)
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
