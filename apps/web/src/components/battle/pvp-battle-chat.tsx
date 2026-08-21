'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'
import type {
  PvpBattleChatMessageView,
  PvpSpectatorPresenceView,
} from '@/server/battle/pvp-battle-communication-service'

import styles from './pvp-battle-chat.module.css'

interface ChatApiBody {
  messages?: PvpBattleChatMessageView[]
  spectators?: PvpSpectatorPresenceView[]
  spectatorCount?: number
  battleLog?: BattleLogView
  message?: PvpBattleChatMessageView
  error?: { message?: string }
}

interface PvpBattleChatProps {
  battleSessionId: string
  readOnly: boolean
  open?: boolean
  localCharacterId?: string | null
  showBattleLog?: boolean
  onUnreadChange?: (unread: number) => void
  onSpectatorCountChange?: (count: number) => void
  className?: string
}

export function PvpBattleChat({
  battleSessionId,
  readOnly,
  open = true,
  localCharacterId = null,
  showBattleLog = false,
  onUnreadChange,
  onSpectatorCountChange,
  className,
}: PvpBattleChatProps) {
  const [messages, setMessages] = useState<PvpBattleChatMessageView[]>([])
  const [spectators, setSpectators] = useState<PvpSpectatorPresenceView[]>([])
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [battleLog, setBattleLog] = useState<BattleLogView | null>(null)
  const [tab, setTab] = useState<'chat' | 'log'>('chat')
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
          const addedUnread = additions.filter(
            (message) => !localCharacterId || message.senderCharacterId !== localCharacterId,
          ).length
          if (addedUnread > 0) {
            setUnread((currentUnread) => {
              const next = currentUnread + addedUnread
              onUnreadChange?.(next)
              return next
            })
          }
        }
        return [...current, ...additions].sort((left, right) => left.id - right.id).slice(-100)
      })
    },
    [localCharacterId, onUnreadChange, open],
  )

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ after: String(latestMessageId.current) })
      if (showBattleLog) params.set('includeLog', '1')
      const response = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store' })
      const body = (await response.json()) as ChatApiBody
      if (!response.ok) {
        setNotice(body.error?.message ?? 'Battle communication is temporarily unavailable.')
        return
      }
      mergeMessages(body.messages ?? [])
      setSpectators(body.spectators ?? [])
      const nextCount = body.spectatorCount ?? 0
      setSpectatorCount(nextCount)
      onSpectatorCountChange?.(nextCount)
      if (body.battleLog) setBattleLog(body.battleLog)
      setNotice(null)
      initialized.current = true
    } catch {
      setNotice('Battle communication interrupted. Retrying…')
    }
  }, [endpoint, mergeMessages, onSpectatorCountChange, showBattleLog])

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
    if (!open || tab !== 'chat') return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, open, tab])

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
          {showBattleLog ? (
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setTab('chat')}
                aria-pressed={tab === 'chat'}
                style={{
                  border: 0,
                  padding: 0,
                  color: tab === 'chat' ? 'var(--av-brass-300)' : 'var(--av-text-dim)',
                  background: 'transparent',
                  cursor: 'pointer',
                  font: '800 .57rem/1 var(--av-font-mono)',
                  textTransform: 'uppercase',
                }}
              >
                Battle Chat
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => setTab('log')}
                aria-pressed={tab === 'log'}
                style={{
                  border: 0,
                  padding: 0,
                  color: tab === 'log' ? 'var(--av-brass-300)' : 'var(--av-text-dim)',
                  background: 'transparent',
                  cursor: 'pointer',
                  font: '800 .57rem/1 var(--av-font-mono)',
                  textTransform: 'uppercase',
                }}
              >
                Battle Log
              </button>
            </div>
          ) : (
            <span>Battle Chat</span>
          )}
          <small>{readOnly ? 'Read-only live feed' : 'Live with combatants'}</small>
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
                spectators.map((spectator, index) => (
                  <span key={`${spectator.name}:${spectator.lastSeenAt}:${index}`}>{spectator.name}</span>
                ))
              ) : (
                <span>No spectators</span>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {tab === 'chat' ? (
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
      ) : (
        <div className={styles.messages} aria-live="polite">
          {battleLog && battleLog.entries.length > 0 ? (
            [...battleLog.entries].reverse().map((entry) => (
              <article className={styles.message} key={`${entry.battleVersion}:${entry.eventIndex}`}>
                <div>
                  <strong>{entry.eventType.replaceAll('_', ' ')}</strong>
                  <time dateTime={entry.occurredAt}>
                    {new Date(entry.occurredAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p>{entry.message}</p>
              </article>
            ))
          ) : (
            <p className={styles.empty}>No committed battle events yet.</p>
          )}
        </div>
      )}

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      {!readOnly && tab === 'chat' ? (
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
