'use client'

import { useEffect } from 'react'

const BATTLE_HEADER_MESSAGES = [
  'Steel is drawn. The battle is underway.',
  'Stand fast. The field belongs to the resolute.',
  'Hold your nerve. One clear move can turn the tide.',
  'Press forward. Fortune follows the decisive.',
  'Every step has weight. Make this one count.',
] as const

const MESSAGE_ROTATION_INTERVAL_MS = 12_000

function shuffled(indices: readonly number[], avoidFirst: number | null): number[] {
  const result = [...indices]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }

  if (avoidFirst !== null && result.length > 1 && result[0] === avoidFirst) {
    const swapIndex = result.findIndex((candidate) => candidate !== avoidFirst)
    if (swapIndex > 0) {
      ;[result[0], result[swapIndex]] = [result[swapIndex], result[0]]
    }
  }

  return result
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

export function BattleHeaderMessageCycle() {
  useEffect(() => {
    let frame: number | null = null
    let currentIndex = 0
    let queue = shuffled([1, 2, 3, 4], currentIndex)

    const sync = () => {
      frame = null
      syncVisibleMessage(BATTLE_HEADER_MESSAGES[currentIndex])
    }

    const scheduleSync = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(sync)
    }

    const advance = () => {
      if (document.visibilityState === 'hidden') return
      if (queue.length === 0) {
        queue = shuffled([0, 1, 2, 3, 4], currentIndex)
      }
      const nextIndex = queue.shift()
      if (nextIndex === undefined) return
      currentIndex = nextIndex
      scheduleSync()
    }

    sync()
    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true })
    const interval = window.setInterval(advance, MESSAGE_ROTATION_INTERVAL_MS)

    return () => {
      observer.disconnect()
      window.clearInterval(interval)
      if (frame !== null) window.cancelAnimationFrame(frame)
      restoreNativeHeader()
    }
  }, [])

  return null
}
