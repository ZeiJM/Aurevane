'use client'

import { useEffect, useRef } from 'react'

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
  return target?.closest<HTMLButtonElement>('#battlefield button[aria-label^="Tile "]') ?? null
}

function quickKey(target: Element | null): string | null {
  const command = commandButton(target)
  if (command) return `command:${textOf(command.querySelector('strong'))}`
  const tile = battlefieldTile(target)
  if (tile) return `tile:${tile.getAttribute('aria-label') ?? ''}`
  return null
}

export function PvpQuickCommitAssist() {
  const lastTap = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    const windowMs = 750

    const onClick = (event: MouseEvent) => {
      if (!isCoarse) return
      const target = event.target instanceof Element ? event.target : null
      const key = quickKey(target)
      if (!key) return
      const now = Date.now()
      const previous = lastTap.current
      lastTap.current = { key, at: now }
      if (!previous || previous.key !== key || now - previous.at > windowMs) return

      window.requestAnimationFrame(() => {
        const confirm = confirmButton()
        if (confirm && !confirm.disabled) confirm.click()
      })
      lastTap.current = null
    }

    const onDoubleClick = (event: MouseEvent) => {
      if (isCoarse) return
      const target = event.target instanceof Element ? event.target : null
      if (!quickKey(target)) return
      window.requestAnimationFrame(() => {
        const confirm = confirmButton()
        if (confirm && !confirm.disabled) confirm.click()
      })
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onDoubleClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onDoubleClick, true)
    }
  }, [])

  return null
}
