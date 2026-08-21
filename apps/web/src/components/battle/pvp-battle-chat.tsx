'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  PvpBattleChatMessageView,
  PvpSpectatorPresenceView,
} from '@/server/battle/pvp-battle-communication-service'

import styles from './pvp-battle-chat.module.css'

interface ChatApiBody {
  messages?: PvpBattleChatMessageView[]
  spectators?: PvpSpectatorPresenceView[]
  spectatorCount?: number
  message?: PvpBattleChatMessageView
  error?: { message?: string }
}

interface PvpBattleChatProps {
  battleSessionId: string
  readOnly: boolean
  open?: boolean
  localCharacterId?: string | null
  onUnreadChange?: (unread: number) => void
  className?: string
}

export function PvpBattleChat({
  battleSessionId,
  readOnly,
  open = true,
  localCharacterId = null,
  onUnreadChange,
  className,
}: PvpBattleChatProps) {
  const [messages, setMessages] = useState<PvpBattleChatMessageView[]>([])
  const [spectators, setSpectators] = useState<PvpSpectatorPresenceView[]>([])
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [spectatorListOpen, setSpectatorListOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const latestMessageId = useRef(0)
  const initialized = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const endpoint = useMemo(
    () => `/api/pvp/battles/${encodeURIComponent(battleSessionId)}/chat`,
    [battleSessionId],
  )

  const publishUnread = useCallback(
    (value: number) => {
      setUnread(value)
      onUnreadChange?.(value)
    },
    [onUnreadChange],
  )

  const mergeMessages = useCallback(
    (incoming: PvpBattleChatMessageView[]) => {
      if (incoming.length === 0) return
      setMessages((current) => {
        const known = new Set(current.map((message) => message.id))
        const additions = incoming.filter((message) => !known.has(message.id))
        if (additions.length === 0) return current
        latestMessageId.current = Math.max(
          latestMessageId.current,
          ...additions.map((message) => message.id),
        )
        if (initialized.current && !open) {
          const nextUnread = additions.filter(
            (message) => !localCharacterId || message.senderCharacterId !== localCharacterId,
          ).length
          if (nextUnread > 0) publishUnread(unread + nextUnread)
        }
        return [...current, ...additions].sort((left, right) => left.id - right.id).slice(-100)
      })
    },
    [localCharacterId, open, publishUnread, unread],
  )

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${endpoint}?after=${latestMessageId.current}`, {
        cache: 'no-store',
      })
      const body = (await response.json()) as ChatApiBody
      if (!response.ok) {
        setNotice(body.error?.message ?? 'Battle chat is temporarily unavailable.')
        return
      }
      mergeMessages(body.messages ?? [])
      setSpectators(body.spectators ?? [])
      setSpectatorCount(body.spectatorCount ?? 0)
      setNotice(null)
      initialized.current = true
    } catch {
      setNotice('Battle chat connection interrupted. Retrying…')
    }
  }, [endpoint, mergeMessages])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 900)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (!open || unread === 0) return
    publishUnread(0)
  }, [open, publishUnread, unread])

  useEffect(() => {
    if (!open) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, open])

  async function sendMessage() {
    const body = draft.trim()
    if (readOnly || pending || body.length < 1 || body.length > 280) return
    setPending(true)
    setNotice(null)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const result = (await response.json()) as ChatApiBody
      if (!response.ok || !result.message) {
        setNotice(result.error?.message ?? 'That battle chat message could not be sent.')
        return
      }
      mergeMessages([result.message])
      setDraft('')
    } catch {
      setNotice('That battle chat message could not be sent.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={`${styles.chat} ${className ?? ''}`} data-open={open || undefined}>
      <header className={styles.header}>
        <div>
          <span>Battle Chat</span>
          <small>{readOnly ? 'Read-only' : 'Live with combatants'}</small>
        </div>
        <div className={styles.presenceWrap}>
          <button
            type="button"
            className={styles.presenceButton}
            aria-expanded={spectatorListOpen}
            onClick={() => setSpectatorListOpen((current) => !current)}
            title="Show spectators"
          >
            ◉ {spectatorCount}
          </button>
          {spectatorListOpen ? (
            <div className={styles.presenceList} role="dialog" aria-label="Current spectators">
              <strong>Spectators</strong>
              {spectators.length > 0 ? (
                spectators.map((spectator) => <span key={spectator.userId}>{spectator.name}</span>)
              ) : (
                <span>No spectators</span>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className={styles.messages} ref={listRef} aria-live="polite">
        {messages.length > 0 ? (
          messages.map((message) => (
            <article
              className={styles.message}
              data-own={localCharacterId === message.senderCharacterId || undefined}
              key={message.id}
            >
              <div>
                <strong>{message.senderCharacterName}</strong>
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p>{message.body}</p>
            </article>
          ))
        ) : (
          <p className={styles.empty}>No battle messages yet.</p>
        )}
      </div>

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      {!readOnly ? (
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage()
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 280))}
            placeholder="Message combatants…"
            maxLength={280}
            aria-label="Battle chat message"
          />
          <button type="submit" disabled={pending || draft.trim().length === 0}>
            Send
          </button>
        </form>
      ) : null}
    </section>
  )
}
