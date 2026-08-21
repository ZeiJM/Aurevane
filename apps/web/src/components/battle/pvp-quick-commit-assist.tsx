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

function facingButton(target: Element | null): HTMLButtonElement | null {
  return target?.closest<HTMLButtonElement>('button[aria-label^="Face "]') ?? null
}

function quickKey(target: Element | null): string | null {
  const command = commandButton(target)
  if (command) return `command:${textOf(command.querySelector('strong'))}`
  const tile = battlefieldTile(target)
  if (tile) return `tile:${tile.getAttribute('aria-label') ?? ''}`
  return null
}

function clearFacingPreview() {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    'button[data-quick-facing-preview]',
  )) {
    button.removeAttribute('data-quick-facing-preview')
    button.style.removeProperty('outline')
    button.style.removeProperty('outline-offset')
  }
}

export function PvpQuickCommitAssist() {
  const lastTap = useRef<{ key: string; at: number } | null>(null)
  const lastFacing = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    const windowMs = 750

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) return

      const face = facingButton(target)
      if (isCoarse && face && !face.disabled) {
        const key = face.getAttribute('aria-label') ?? ''
        const now = Date.now()
        const previous = lastFacing.current
        if (!previous || previous.key !== key || now - previous.at > windowMs) {
          event.preventDefault()
          event.stopImmediatePropagation()
          clearFacingPreview()
          face.dataset.quickFacingPreview = 'true'
          face.style.outline = '2px solid rgba(207, 169, 93, .85)'
          face.style.outlineOffset = '2px'
          lastFacing.current = { key, at: now }
          return
        }
        clearFacingPreview()
        lastFacing.current = null
        return
      }

      if (!isCoarse) return
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
      clearFacingPreview()
    }
  }, [])

  return null
}
