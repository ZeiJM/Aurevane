'use client'

import { useEffect, useMemo, useState } from 'react'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'

import { PvpBattleChat } from './pvp-battle-chat'
import styles from './pvp-battle-chat-bridge.module.css'

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? ''
}

function battleRoot(): HTMLElement | Document {
  return document.querySelector<HTMLElement>('main[data-pvp-battle="true"]') ?? document
}

function findChatButton(): HTMLButtonElement | null {
  return (
    Array.from(battleRoot().querySelectorAll<HTMLButtonElement>('footer button')).find((button) =>
      /^chat\b/i.test(textOf(button)),
    ) ?? null
  )
}

function findLogButton(): HTMLButtonElement | null {
  return (
    Array.from(battleRoot().querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      /combat log/i.test(textOf(button)),
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
  const [requestedTab, setRequestedTab] = useState<'chat' | 'log'>('chat')
  const [unread, setUnread] = useState(0)
  const combatantNames = useMemo(
    () =>
      Object.fromEntries(
        metadata.participants.map((participant) => [
          participant.combatantId,
          participant.characterName,
        ]),
      ),
    [metadata.participants],
  )

  useEffect(() => {
    let attachedChat: HTMLButtonElement | null = null
    let attachedLog: HTMLButtonElement | null = null
    let badge: HTMLSpanElement | null = null

    const openChat = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      setRequestedTab('chat')
      setUnread(0)
      setOpen((current) => (requestedTab === 'chat' ? !current : true))
    }

    const openLog = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      setRequestedTab('log')
      setOpen(true)
    }

    const sync = () => {
      const chatButton = findChatButton()
      if (chatButton && attachedChat !== chatButton) {
        attachedChat?.removeEventListener('click', openChat, true)
        attachedChat = chatButton
        attachedChat.addEventListener('click', openChat, true)
        attachedChat.setAttribute('aria-controls', 'pvp-battle-chat-panel')
      }

      const logButton = findLogButton()
      if (logButton && attachedLog !== logButton) {
        attachedLog?.removeEventListener('click', openLog, true)
        attachedLog = logButton
        attachedLog.addEventListener('click', openLog, true)
        attachedLog.setAttribute('aria-controls', 'pvp-battle-chat-panel')
      }

      if (chatButton) {
        badge = chatButton.querySelector<HTMLSpanElement>('[data-pvp-chat-badge]')
        if (unread > 0) {
          if (!badge) {
            badge = document.createElement('span')
            badge.dataset.pvpChatBadge = 'true'
            badge.className = styles.triggerBadge
            chatButton.appendChild(badge)
          }
          badge.textContent = 'NEW'
        } else {
          badge?.remove()
          badge = null
        }
        chatButton.setAttribute('aria-expanded', open && requestedTab === 'chat' ? 'true' : 'false')
        chatButton.dataset.hasUnread = unread > 0 ? 'true' : ''
      }

      if (logButton) {
        logButton.setAttribute('aria-expanded', open && requestedTab === 'log' ? 'true' : 'false')
      }
    }

    sync()
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      attachedChat?.removeEventListener('click', openChat, true)
      attachedLog?.removeEventListener('click', openLog, true)
      badge?.remove()
    }
  }, [open, requestedTab, unread])

  return (
    <div
      id="pvp-battle-chat-panel"
      className={styles.panel}
      data-open={open || undefined}
      aria-hidden={!open}
    >
      <div className={styles.panelTop}>
        <strong>Shared Battle Communication</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close battle communication"
        >
          ×
        </button>
      </div>
      <PvpBattleChat
        battleSessionId={battleSessionId}
        readOnly={false}
        open={open}
        localCharacterId={metadata.localCharacterId}
        showBattleLog
        requestedTab={requestedTab}
        onRequestedTabChange={setRequestedTab}
        onUnreadChange={setUnread}
        combatantNames={combatantNames}
      />
    </div>
  )
}
