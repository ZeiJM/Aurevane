'use client'

import { useEffect, useRef } from 'react'

type RepeatableCommandSlot = 'move' | 'attack' | 'recover'

const REPEATABLE_COMMAND_SLOTS = new Set<RepeatableCommandSlot>(['move', 'attack', 'recover'])
const SETTLE_DELAYS_MS = [0, 24, 60, 120, 220] as const

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function commandButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      'section[aria-label="Command Deck"] button[data-battle-command]',
    ),
  )
}

function commandSlot(button: HTMLButtonElement): string {
  return button.dataset.battleCommand ?? ''
}

function isRepeatableCommandSlot(value: string): value is RepeatableCommandSlot {
  return REPEATABLE_COMMAND_SLOTS.has(value as RepeatableCommandSlot)
}

function activeCommand(): HTMLButtonElement | null {
  return (
    commandButtons().find((button) => {
      if (!isRepeatableCommandSlot(commandSlot(button))) return false
      return (
        button.getAttribute('data-active') === 'true' ||
        button.hasAttribute('data-active') ||
        `${button.className}`.includes('commandActive')
      )
    }) ?? null
  )
}

function confirmButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target instanceof Element ? target : null
  const button = element?.closest<HTMLButtonElement>('button') ?? null
  return button && textOf(button).includes('Confirm Action') ? button : null
}

function actionEconomy(): number | null {
  const progress = document.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  if (!progress) return null
  const value = Number(progress.getAttribute('aria-valuenow'))
  return Number.isFinite(value) ? value : null
}

function findCommand(slot: RepeatableCommandSlot): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `section[aria-label="Command Deck"] button[data-battle-command="${slot}"]`,
  )
}

export function BattleStickyActionAssist() {
  const pendingRepeat = useRef<RepeatableCommandSlot | null>(null)
  const lastKnownEconomy = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)

  useEffect(() => {
    function clearSettleTimer() {
      if (settleTimer.current === null) return
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }

    function rememberCurrentAction() {
      const active = activeCommand()
      const slot = active ? commandSlot(active) : ''
      if (isRepeatableCommandSlot(slot)) pendingRepeat.current = slot
    }

    function handleClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target : null
      const command = element?.closest<HTMLButtonElement>(
        'section[aria-label="Command Deck"] button[data-battle-command]',
      )
      if (command) {
        const slot = commandSlot(command)
        if (isRepeatableCommandSlot(slot)) pendingRepeat.current = slot
        else if (slot === 'inspect' || slot === 'finish' || slot === 'guard') {
          pendingRepeat.current = null
        }
      }

      if (confirmButton(event.target)) rememberCurrentAction()
    }

    function handleDoubleClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target : null
      if (
        element?.closest('#battlefield button[aria-label^="Tile "]') ||
        element?.closest('section[aria-label="Command Deck"] button[data-battle-command]')
      ) {
        rememberCurrentAction()
      }
    }

    function settleRestore(slot: RepeatableCommandSlot, attempt: number) {
      clearSettleTimer()
      const delay = SETTLE_DELAYS_MS[Math.min(attempt, SETTLE_DELAYS_MS.length - 1)]
      settleTimer.current = window.setTimeout(() => {
        settleTimer.current = null
        if (pendingRepeat.current !== slot) return

        const current = findCommand(slot)
        if (!current || current.disabled) {
          pendingRepeat.current = null
          return
        }

        if (activeCommand()) {
          // The battle component may already preserve the action itself (for example PvP attacks).
          pendingRepeat.current = null
          return
        }

        if (attempt < SETTLE_DELAYS_MS.length - 1) {
          settleRestore(slot, attempt + 1)
          return
        }

        current.click()
        pendingRepeat.current = null
      }, delay)
    }

    function tryRestore() {
      const economy = actionEconomy()
      if (economy === null) return

      const previousEconomy = lastKnownEconomy.current
      lastKnownEconomy.current = economy
      const slot = pendingRepeat.current
      if (!slot || previousEconomy === null || economy >= previousEconomy) return

      const button = findCommand(slot)
      if (!button || button.disabled) {
        pendingRepeat.current = null
        clearSettleTimer()
        return
      }

      // Affordability belongs to the currently equipped skill. The rendered slot button already
      // reflects that server-backed cost, so sticky restore must not hardcode Basic-skill AP values.
      settleRestore(slot, 0)
    }

    lastKnownEconomy.current = actionEconomy()
    const observer = new MutationObserver(tryRestore)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-valuenow', 'class', 'data-active', 'disabled'],
    })

    document.addEventListener('click', handleClick, true)
    document.addEventListener('dblclick', handleDoubleClick, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('dblclick', handleDoubleClick, true)
      clearSettleTimer()
    }
  }, [])

  return null
}
