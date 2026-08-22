'use client'

import { useEffect, useRef } from 'react'

const REPEATABLE_ACTIONS = new Set(['Move', 'Basic Attack', 'Guard', 'Recover'])

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

    function tryRestore() {
      const label = pendingRepeat.current
      if (!label) return

      const economy = actionEconomy()
      if (economy === null) return
      const previousEconomy = lastKnownEconomy.current
      lastKnownEconomy.current = economy

      // A committed action consumes AP. Wait for that authoritative decrease before restoring.
      if (previousEconomy === null || economy >= previousEconomy) return

      const button = findCommand(label)
      const affordable = economy >= minimumCost(label)
      if (!button || button.disabled || !affordable) {
        pendingRepeat.current = null
        return
      }

      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
      settleTimer.current = window.setTimeout(() => {
        const current = findCommand(label)
        const currentEconomy = actionEconomy()
        if (
          pendingRepeat.current === label &&
          current &&
          !current.disabled &&
          currentEconomy !== null &&
          currentEconomy >= minimumCost(label) &&
          !activeCommand()
        ) {
          current.click()
        }
        pendingRepeat.current = null
      }, 0)
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
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    }
  }, [])

  return null
}
