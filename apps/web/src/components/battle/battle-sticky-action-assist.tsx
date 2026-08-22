'use client'

import { useEffect, useRef } from 'react'

const REPEATABLE_ACTIONS = new Set(['Move', 'Basic Attack', 'Guard', 'Recover'])
const SETTLE_DELAYS_MS = [0, 24, 60, 120, 220] as const

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function commandButtons(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('section[aria-label="Command Deck"] button'),
  )
}

function commandLabel(button: HTMLButtonElement): string {
  return textOf(button.querySelector('strong'))
}

function activeCommand(): HTMLButtonElement | null {
  return (
    commandButtons().find((button) => {
      const label = commandLabel(button)
      if (!REPEATABLE_ACTIONS.has(label)) return false
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

function minimumCost(label: string): number {
  if (label === 'Move') return 25
  if (label === 'Basic Attack' || label === 'Guard') return 30
  if (label === 'Recover') return 50
  return Number.POSITIVE_INFINITY
}

function findCommand(label: string): HTMLButtonElement | null {
  return commandButtons().find((button) => commandLabel(button) === label) ?? null
}

export function BattleStickyActionAssist() {
  const pendingRepeat = useRef<string | null>(null)
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
      const label = active ? commandLabel(active) : ''
      if (REPEATABLE_ACTIONS.has(label)) pendingRepeat.current = label
    }

    function handleClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target : null
      const command = element?.closest<HTMLButtonElement>(
        'section[aria-label="Command Deck"] button',
      )
      if (command) {
        const label = commandLabel(command)
        if (REPEATABLE_ACTIONS.has(label)) pendingRepeat.current = label
        else if (label === 'Inspect' || label === 'Finish Turn') pendingRepeat.current = null
      }

      if (confirmButton(event.target)) rememberCurrentAction()
    }

    function handleDoubleClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target : null
      if (
        element?.closest('#battlefield button[aria-label^="Tile "]') ||
        element?.closest('section[aria-label="Command Deck"] button')
      ) {
        rememberCurrentAction()
      }
    }

    function settleRestore(label: string, attempt: number) {
      clearSettleTimer()
      const delay = SETTLE_DELAYS_MS[Math.min(attempt, SETTLE_DELAYS_MS.length - 1)]
      settleTimer.current = window.setTimeout(() => {
        settleTimer.current = null
        if (pendingRepeat.current !== label) return

        const current = findCommand(label)
        const currentEconomy = actionEconomy()
        if (
          !current ||
          current.disabled ||
          currentEconomy === null ||
          currentEconomy < minimumCost(label)
        ) {
          pendingRepeat.current = null
          return
        }

        if (activeCommand()) {
          // The battle component may already preserve the action itself (for example PvP attacks).
          pendingRepeat.current = null
          return
        }

        if (attempt < SETTLE_DELAYS_MS.length - 1) {
          settleRestore(label, attempt + 1)
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
      const label = pendingRepeat.current
      if (!label || previousEconomy === null || economy >= previousEconomy) return

      const button = findCommand(label)
      if (!button || button.disabled || economy < minimumCost(label)) {
        pendingRepeat.current = null
        clearSettleTimer()
        return
      }

      settleRestore(label, 0)
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
