'use client'

import { useEffect, useState } from 'react'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

import { PvpBattleChat } from './pvp-battle-chat'
import styles from './pvp-battle-chat-bridge.module.css'

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function findChatButton(): HTMLButtonElement | null {
  const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]') ?? document
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      /^chat\b/i.test(textOf(button)),
    ) ?? null
  )
}

export function PvpBattleChatBridge({
  battleSessionId,
  metadata,
}: {
  battleSessionId: string
  metadata: PvpBattleMetadata
}) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [spectatorCount, setSpectatorCount] = useState(0)

  useEffect(() => {
    let attached: HTMLButtonElement | null = null
    let badge: HTMLSpanElement | null = null

    const click = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      setOpen((current) => !current)
    }

    const sync = () => {
      const button = findChatButton()
      if (!button) return
      if (attached !== button) {
        attached?.removeEventListener('click', click, true)
        attached = button
        attached.addEventListener('click', click, true)
        attached.setAttribute('aria-controls', 'pvp-battle-chat-panel')
      }
      badge = button.querySelector<HTMLSpanElement>('[data-pvp-chat-badge]')
      if (!badge) {
        badge = document.createElement('span')
        badge.dataset.pvpChatBadge = 'true'
        badge.className = styles.triggerBadge
        button.appendChild(badge)
      }
      badge.textContent = unread > 0 ? `◉ ${spectatorCount} · ${unread} new` : `◉ ${spectatorCount}`
      button.setAttribute('aria-expanded', open ? 'true' : 'false')
      button.dataset.hasUnread = unread > 0 ? 'true' : ''
    }

    sync()
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      attached?.removeEventListener('click', click, true)
      badge?.remove()
    }
  }, [open, spectatorCount, unread])

  return (
    <div
      id="pvp-battle-chat-panel"
      className={styles.panel}
      data-open={open || undefined}
      aria-hidden={!open}
    >
      <div className={styles.panelTop}>
        <strong>Shared Battle Chat</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close battle chat">
          ×
        </button>
      </div>
      <PvpBattleChat
        battleSessionId={battleSessionId}
        readOnly={false}
        open={open}
        localCharacterId={metadata.localCharacterId}
        onUnreadChange={setUnread}
        onSpectatorCountChange={setSpectatorCount}
      />
    </div>
  )
}
