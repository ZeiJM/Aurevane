'use client'

import { useEffect, useMemo } from 'react'

const BATTLE_HEADER_MESSAGES = [
  'Steel is drawn. The battle is underway.',
  'Stand fast. The field belongs to the resolute.',
  'Hold your nerve. One clear move can turn the tide.',
  'Press forward. Fortune follows the decisive.',
  'Every step has weight. Make this one count.',
] as const

function stableMessageIndex(battleSessionId: string): number {
  let hash = 2166136261
  for (let index = 0; index < battleSessionId.length; index += 1) {
    hash ^= battleSessionId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % BATTLE_HEADER_MESSAGES.length
}

function headerObjectiveContainer(): HTMLElement | null {
  const track = document.querySelector<HTMLElement>(
    '[role="progressbar"][aria-label="Action Economy remaining"]',
  )
  const header = track?.closest('header')
  const firstChild = header?.firstElementChild
  return firstChild instanceof HTMLElement ? firstChild : null
}

function directStrong(container: HTMLElement): HTMLElement | null {
  return (
    Array.from(container.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.tagName.toLowerCase() === 'strong',
    ) ?? null
  )
}

function syncVisibleMessage(message: string): void {
  const container = headerObjectiveContainer()
  if (!container) return

  const existing = container.querySelector<HTMLElement>(
    ':scope > [data-battle-header-message="true"]',
  )
  if (existing) {
    if (existing.textContent !== message) existing.textContent = message
    return
  }

  const source =
    container.querySelector<HTMLElement>(':scope > [data-battle-header-message-source="true"]') ??
    directStrong(container)
  if (!source) return

  const visible = source.cloneNode(false) as HTMLElement
  visible.removeAttribute('id')
  visible.removeAttribute('aria-hidden')
  visible.removeAttribute('data-battle-header-message-source')
  visible.style.removeProperty('display')
  visible.dataset.battleHeaderMessage = 'true'
  visible.textContent = message

  source.dataset.battleHeaderMessageSource = 'true'
  source.setAttribute('aria-hidden', 'true')
  source.style.setProperty('display', 'none', 'important')
  source.after(visible)
}

function restoreNativeHeader(): void {
  document
    .querySelectorAll<HTMLElement>('[data-battle-header-message="true"]')
    .forEach((message) => message.remove())

  document
    .querySelectorAll<HTMLElement>('[data-battle-header-message-source="true"]')
    .forEach((source) => {
      source.removeAttribute('data-battle-header-message-source')
      source.removeAttribute('aria-hidden')
      source.style.removeProperty('display')
    })
}

export function BattleHeaderMatchMessage({ battleSessionId }: { battleSessionId: string }) {
  const message = useMemo(
    () => BATTLE_HEADER_MESSAGES[stableMessageIndex(battleSessionId)],
    [battleSessionId],
  )

  useEffect(() => {
    let frame: number | null = null

    const sync = () => {
      frame = null
      syncVisibleMessage(message)
    }

    const scheduleSync = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(sync)
    }

    sync()
    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      restoreNativeHeader()
    }
  }, [message])

  return null
}
