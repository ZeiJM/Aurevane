'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'
import type {
  PvpBattleChatMessageView,
  PvpSpectatorPresenceView,
} from '@/server/battle/pvp-battle-communication-service'

import { BattleLogFeed } from './battle-log-feed'
import styles from './pvp-battle-chat.module.css'

interface ChatApiBody {
  messages?: PvpBattleChatMessageView[]
  spectators?: PvpSpectatorPresenceView[]
  spectatorCount?: number
  battleLog?: BattleLogView
  message?: PvpBattleChatMessageView
  error?: { message?: string }
}

interface EmojiPreferencesBody {
  emojis?: string[]
}

interface PvpBattleChatProps {
  battleSessionId: string
  readOnly: boolean
  open?: boolean
  localCharacterId?: string | null
  showBattleLog?: boolean
  showSpectatorPresence?: boolean
  requestedTab?: 'chat' | 'log'
  onRequestedTabChange?: (tab: 'chat' | 'log') => void
  onUnreadChange?: (unread: number) => void
  onSpectatorCountChange?: (count: number) => void
  onSpectatorsChange?: (spectators: PvpSpectatorPresenceView[]) => void
  combatantNames?: Readonly<Record<string, string>>
  className?: string
}

const OPEN_CHAT_POLL_MS = 1200
const CLOSED_CHAT_POLL_MS = 3000
const MAX_CHAT_RECONNECT_MS = 10000
const MAX_RECENT_EMOJIS = 10

function extractEmojis(text: string): string[] {
  return (
    text.match(
      /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/gu,
    ) ?? []
  )
}

function mergeRecentEmojis(current: readonly string[], used: readonly string[]): string[] {
  const result = [...current]
  for (const emoji of used) {
    const existing = result.indexOf(emoji)
    if (existing >= 0) result.splice(existing, 1)
    result.unshift(emoji)
  }
  return result.slice(0, MAX_RECENT_EMOJIS)
}

export function PvpBattleChat({
  battleSessionId,
  readOnly,
  open = true,
  localCharacterId = null,
  showBattleLog = false,
  showSpectatorPresence = true,
  requestedTab = 'chat',
  onRequestedTabChange,
  onUnreadChange,
  onSpectatorCountChange,
  onSpectatorsChange,
  combatantNames,
  className,
}: PvpBattleChatProps) {
  const [messages, setMessages] = useState<PvpBattleChatMessageView[]>([])
  const [spectators, setSpectators] = useState<PvpSpectatorPresenceView[]>([])
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [battleLog, setBattleLog] = useState<BattleLogView | null>(null)
  const [internalTab, setInternalTab] = useState<'chat' | 'log'>(requestedTab)
  const [spectatorListOpen, setSpectatorListOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const latestMessageId = useRef(0)
  const initialized = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const presenceWrapRef = useRef<HTMLDivElement | null>(null)
  const emojiWrapRef = useRef<HTMLDivElement | null>(null)
  const tab = onRequestedTabChange ? requestedTab : internalTab
  const chatVisible = open && tab === 'chat'

  const endpoint = useMemo(
    () => `/api/pvp/battles/${encodeURIComponent(battleSessionId)}/chat`,
    [battleSessionId],
  )

  const selectTab = useCallback(
    (nextTab: 'chat' | 'log') => {
      if (onRequestedTabChange) onRequestedTabChange(nextTab)
      else setInternalTab(nextTab)
    },
    [onRequestedTabChange],
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
        if (initialized.current && !chatVisible) {
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
    [chatVisible, localCharacterId, onUnreadChange],
  )

  const refresh = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      try {
        const params = new URLSearchParams({ after: String(latestMessageId.current) })
        if (showBattleLog && tab === 'log') params.set('includeLog', '1')
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          cache: 'no-store',
          signal,
        })
        const body = (await response.json()) as ChatApiBody
        if (signal?.aborted) return false
        if (!response.ok) {
          setNotice(body.error?.message ?? 'Battle communication is temporarily unavailable.')
          return false
        }
        mergeMessages(body.messages ?? [])
        const nextSpectators = body.spectators ?? []
        setSpectators(nextSpectators)
        onSpectatorsChange?.(nextSpectators)
        const nextCount = body.spectatorCount ?? 0
        setSpectatorCount(nextCount)
        onSpectatorCountChange?.(nextCount)
        if (body.battleLog) setBattleLog(body.battleLog)
        setNotice(null)
        initialized.current = true
        return true
      } catch {
        if (signal?.aborted) return false
        setNotice('Battle communication interrupted. Retrying…')
        return false
      }
    },
    [endpoint, mergeMessages, onSpectatorCountChange, onSpectatorsChange, showBattleLog, tab],
  )

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    let failures = 0
    let controller: AbortController | null = null

    async function poll() {
      controller = new AbortController()
      const success = await refresh(controller.signal)
      controller = null
      if (cancelled) return

      if (success) failures = 0
      else failures += 1

      const normalDelay = open ? OPEN_CHAT_POLL_MS : CLOSED_CHAT_POLL_MS
      const reconnectDelay = Math.min(
        normalDelay * 2 ** Math.min(failures, 2),
        MAX_CHAT_RECONNECT_MS,
      )
      timer = window.setTimeout(poll, success ? normalDelay : reconnectDelay)
    }

    void poll()
    return () => {
      cancelled = true
      controller?.abort()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [open, refresh])

  useEffect(() => {
    if (readOnly) return
    let cancelled = false
    void fetch('/api/battle/preferences/emojis', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as EmojiPreferencesBody
        if (!cancelled && Array.isArray(body.emojis)) {
          setRecentEmojis(body.emojis.slice(0, MAX_RECENT_EMOJIS))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [readOnly])

  useEffect(() => {
    if (!chatVisible || unread === 0) return
    const frame = window.requestAnimationFrame(() => publishUnread(0))
    return () => window.cancelAnimationFrame(frame)
  }, [chatVisible, publishUnread, unread])

  useEffect(() => {
    if (!chatVisible) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [chatVisible, messages])

  useEffect(() => {
    if (!spectatorListOpen) return
    function closePresence(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (presenceWrapRef.current?.contains(event.target)) return
      setSpectatorListOpen(false)
    }
    document.addEventListener('pointerdown', closePresence, true)
    return () => document.removeEventListener('pointerdown', closePresence, true)
  }, [spectatorListOpen])

  useEffect(() => {
    if (!emojiOpen) return
    function closeEmoji(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (emojiWrapRef.current?.contains(event.target)) return
      setEmojiOpen(false)
    }
    document.addEventListener('pointerdown', closeEmoji, true)
    return () => document.removeEventListener('pointerdown', closeEmoji, true)
  }, [emojiOpen])

  const recordEmojiUsage = useCallback((used: readonly string[]) => {
    if (used.length === 0) return
    setRecentEmojis((current) => {
      const next = mergeRecentEmojis(current, used)
      void fetch('/api/battle/preferences/emojis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emojis: next }),
      }).catch(() => undefined)
      return next
    })
  }, [])

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
      recordEmojiUsage(extractEmojis(body))
      setDraft('')
      setEmojiOpen(false)
      void refresh()
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
            <div className={styles.tabs} role="tablist" aria-label="Battle communication views">
              <button
                type="button"
                className={styles.tab}
                data-active={tab === 'chat' || undefined}
                role="tab"
                aria-selected={tab === 'chat'}
                onClick={() => selectTab('chat')}
              >
                Battle Chat
              </button>
              <span className={styles.tabDivider} aria-hidden="true">
                /
              </span>
              <button
                type="button"
                className={styles.tab}
                data-active={tab === 'log' || undefined}
                role="tab"
                aria-selected={tab === 'log'}
                onClick={() => selectTab('log')}
              >
                Battle Log
              </button>
            </div>
          ) : (
            <span>Battle Chat</span>
          )}
          <small>
            {tab === 'log'
              ? 'Rounds · actions · outcomes'
              : readOnly
                ? 'Read-only live feed'
                : 'Live with combatants'}
          </small>
        </div>
        {showSpectatorPresence ? (
          <div className={styles.presenceWrap} ref={presenceWrapRef}>
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
                    <span key={`${spectator.name}:${spectator.lastSeenAt}:${index}`}>
                      {spectator.name}
                    </span>
                  ))
                ) : (
                  <span>No spectators</span>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
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
        <div className={`${styles.messages} ${styles.logMessages}`} aria-live="polite">
          <BattleLogFeed
            entries={battleLog?.entries ?? []}
            combatantNames={combatantNames}
            emptyMessage="No committed battle actions yet."
          />
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
          <div className={styles.emojiWrap} ref={emojiWrapRef}>
            <button
              type="button"
              className={styles.emojiButton}
              aria-label="Choose recent emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((value) => !value)}
            >
              ☺
            </button>
            {emojiOpen ? (
              <div className={styles.emojiPicker} role="group" aria-label="Recent emoji">
                {recentEmojis.length > 0 ? (
                  recentEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Insert ${emoji}`}
                      onClick={() => {
                        setDraft((value) => `${value}${emoji}`)
                        recordEmojiUsage([emoji])
                        setEmojiOpen(false)
                      }}
                    >
                      {emoji}
                    </button>
                  ))
                ) : (
                  <span>No recent emoji yet</span>
                )}
              </div>
            ) : null}
          </div>
          <button type="submit" disabled={pending || draft.trim().length === 0}>
            Send
          </button>
        </form>
      ) : null}
    </section>
  )
}
