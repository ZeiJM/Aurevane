'use client'

import { useEffect } from 'react'

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function isMovementKey(event: KeyboardEvent): boolean {
  const lower = event.key.toLowerCase()
  return (
    lower === 'w' ||
    lower === 'a' ||
    lower === 's' ||
    lower === 'd' ||
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight'
  )
}

function moveModeIsActive(): boolean {
  const move = document.querySelector<HTMLButtonElement>(
    'section[aria-label="Command Deck"] button[data-command-slot="move"], section[aria-label="Command Deck"] button[data-battle-command="move"]',
  )
  return Boolean(
    move &&
      (move.hasAttribute('data-active') ||
        move.dataset.battleActive === 'true' ||
        `${move.className}`.includes('commandActive')),
  )
}

/**
 * The legacy PVE keyboard helper owns global capture-phase shortcuts. Its historical movement
 * handler reconstructs an endpoint independently from React's plotted path, which can swallow the
 * reverse key before BattleExperience gets a chance to trim the live preview. Route only active
 * Move-mode direction keys back to BattleExperience, which owns pathRef and therefore has the
 * authoritative client-side preview path.
 */
export function BattleMoveKeyboardBridge() {
  useEffect(() => {
    let redispatching = false

    function handleKeyDown(event: KeyboardEvent) {
      if (
        redispatching ||
        !event.code ||
        isTextEntryTarget(event.target) ||
        !isMovementKey(event) ||
        !moveModeIsActive()
      ) {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()

      redispatching = true
      try {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: event.key,
            code: '',
            bubbles: true,
            cancelable: true,
            repeat: event.repeat,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
          }),
        )
      } finally {
        redispatching = false
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  return null
}
