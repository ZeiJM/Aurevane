'use client'

import {
  COMBAT_KEYBIND_ACTIONS,
  DEFAULT_COMBAT_KEYBINDS,
  combatKeybindChord,
  parseCombatKeybindMap,
  type CombatKeybindAction,
  type CombatKeybindMap,
} from '@aurevane/validation/player/combat-controls'
import { useEffect, useRef, useState } from 'react'

type SelfAction = Extract<CombatKeybindAction, 'guard' | 'recover'>

const SELF_ACTION_LABELS: Record<SelfAction, string> = {
  guard: 'Guard',
  recover: 'Recover',
}

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

function configuredAction(bindings: CombatKeybindMap, chord: string): CombatKeybindAction | null {
  return (
    COMBAT_KEYBIND_ACTIONS.find((action) => combatKeybindChord(bindings[action]) === chord) ?? null
  )
}

function commandButton(label: string): HTMLButtonElement | null {
  return (
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
    ).find((button) => button.querySelector('strong')?.textContent?.trim() === label) ?? null
  )
}

function commandIsActive(label: string): boolean {
  const button = commandButton(label)
  return Boolean(
    button &&
    !button.disabled &&
    (button.hasAttribute('data-active') ||
      button.dataset.battleActive === 'true' ||
      `${button.className}`.includes('commandActive')),
  )
}

function confirmButton(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('footer button')).find((button) =>
      button.textContent?.startsWith('Confirm Action'),
    ) ?? null
  )
}

export function BattleSelfActionQuickCommitAssist() {
  const [bindings, setBindings] = useState<CombatKeybindMap>(DEFAULT_COMBAT_KEYBINDS)
  const commitSequence = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function loadControls() {
      try {
        const response = await fetch('/api/account/controls', { method: 'GET', cache: 'no-store' })
        const body = (await response.json()) as { controls?: { combatKeybinds?: unknown } }
        const parsed = parseCombatKeybindMap(body.controls?.combatKeybinds)
        if (!cancelled && response.ok && parsed) setBindings(parsed)
      } catch {
        // Default combat bindings remain valid if preferences cannot be refreshed mid-battle.
      }
    }

    void loadControls()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function commitWhenPreviewReady(label: string) {
      const sequence = ++commitSequence.current
      let attempts = 0

      const tryCommit = () => {
        attempts += 1
        if (sequence !== commitSequence.current || attempts > 40 || !commandIsActive(label)) {
          return true
        }

        const confirm = confirmButton()
        if (!confirm || confirm.disabled) return false
        commitSequence.current += 1
        confirm.click()
        return true
      }

      if (tryCommit()) return

      const timer = window.setInterval(() => {
        if (tryCommit()) window.clearInterval(timer)
      }, 50)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        isTextEntryTarget(event.target) ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !event.code ||
        !window.matchMedia('(min-width: 821px)').matches
      ) {
        return
      }

      const action = configuredAction(bindings, eventChord(event))
      if (action !== 'guard' && action !== 'recover') return

      const label = SELF_ACTION_LABELS[action]
      if (!commandIsActive(label)) {
        commitSequence.current += 1
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      commitWhenPreviewReady(label)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      commitSequence.current += 1
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [bindings])

  return null
}
