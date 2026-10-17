'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  chatApi,
  type ChannelId,
  type ChatInbox,
  type ChatMessage,
  type ChatSettings,
  type MentionCandidate,
} from './chat-api'
import { ChatLine } from './chat-message'
import { activeMentionQuery, applyMention, EMOJI_CHOICES } from './chat-format'
import styles from './chat.module.css'
import { FriendsView, SettingsView } from './friends-view'

type View = 'chat' | 'friends' | 'settings'

function channelTitle(channel: ChannelId, inbox: ChatInbox | null): string {
  if (channel === 'world') return 'World'
  if (channel === 'village') return 'Village'
  if (channel === 'feed') return 'Game feed'
  if (channel.startsWith('whisper:')) {
    return inbox?.whispers.find((w) => w.characterId === channel.slice(8))?.name ?? 'Whisper'
  }
  if (channel.startsWith('group:')) {
    return inbox?.groups.find((g) => g.id === channel.slice(6))?.name ?? 'Group'
  }
  return 'Lobby'
}

const FEED_POLL_MS = 2500
const HIDDEN_POLL_MS = 15000

export function ChatPanel({
  selfName,
  lockedChannel,
}: {
  selfName: string
  /** Lobby chat pins the panel to one channel and hides the switcher. */
  lockedChannel?: ChannelId
}) {
  const [settings, setSettings] = useState<ChatSettings | null>(null)
  const [channel, setChannel] = useState<ChannelId>(lockedChannel ?? 'world')
  const [view, setView] = useState<View>('chat')
  const [menuOpen, setMenuOpen] = useState(false)
  const [inbox, setInbox] = useState<ChatInbox | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [candidates, setCandidates] = useState<MentionCandidate[]>([])
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [sending, setSending] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastId = useRef(0)
  const stickToBottom = useRef(true)

  // The feed-only mode reads the World stream and keeps just the game lines.
  const wireChannel = channel === 'feed' ? 'world' : channel
  const feedOnly = channel === 'feed'

  useEffect(() => {
    void chatApi
      .settings()
      .then(({ settings: loaded }) => {
        setSettings(loaded)
        if (!lockedChannel && loaded.defaultChannel !== 'world') {
          setChannel(loaded.defaultChannel)
          setMessages([])
        }
      })
      .catch(() => undefined)
  }, [lockedChannel])

  const refreshInbox = useCallback(() => {
    void chatApi
      .inbox()
      .then(setInbox)
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    if (lockedChannel) return
    refreshInbox()
    const timer = window.setInterval(refreshInbox, 10000)
    return () => window.clearInterval(timer)
  }, [lockedChannel, refreshInbox])

  // Load and poll the active channel.
  useEffect(() => {
    if (view !== 'chat') return
    let cancelled = false
    lastId.current = 0
    const load = async () => {
      try {
        const { messages: fresh } = await chatApi.messages(wireChannel, lastId.current)
        if (cancelled || fresh.length === 0) return
        lastId.current = Math.max(lastId.current, ...fresh.map((m) => m.id))
        setMessages((current) => {
          const seen = new Set(current.map((m) => m.id))
          return [...current, ...fresh.filter((m) => !seen.has(m.id))].slice(-200)
        })
        void chatApi.read(wireChannel, lastId.current).catch(() => undefined)
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'Chat is unavailable.')
      }
    }
    void load()
    let timer = window.setInterval(() => void load(), FEED_POLL_MS)
    const onVisibility = () => {
      window.clearInterval(timer)
      timer = window.setInterval(
        () => void load(),
        document.visibilityState === 'hidden' ? HIDDEN_POLL_MS : FEED_POLL_MS,
      )
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [wireChannel, view])

  useEffect(() => {
    const feed = feedRef.current
    if (feed && stickToBottom.current) feed.scrollTop = feed.scrollHeight
  }, [messages, view])

  const visible = useMemo(
    () => (feedOnly ? messages.filter((m) => m.kind !== 'chat') : messages),
    [feedOnly, messages],
  )
  const knownNames = useMemo(
    () => [...new Set(messages.map((m) => m.senderName).filter((n): n is string => Boolean(n)))],
    [messages],
  )

  // @mention autocomplete.
  useEffect(() => {
    if (!mention || feedOnly) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void chatApi
        .mentions(wireChannel, mention.query)
        .then(({ candidates: found }) => !cancelled && setCandidates(found))
        .catch(() => !cancelled && setCandidates([]))
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mention, wireChannel, feedOnly])

  const onDraftChange = (value: string, caret: number) => {
    setDraft(value)
    setMention(activeMentionQuery(value, caret))
  }

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setNotice(null)
    try {
      const { message } = await chatApi.send(wireChannel, body, replyTo?.id ?? null)
      lastId.current = Math.max(lastId.current, message.id)
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message].slice(-200),
      )
      setDraft('')
      setReplyTo(null)
      setMention(null)
      stickToBottom.current = true
      refreshInbox()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Message not sent.')
    } finally {
      setSending(false)
    }
  }

  const insertAtCaret = (text: string) => {
    const input = inputRef.current
    const caret = input?.selectionStart ?? draft.length
    const next = `${draft.slice(0, caret)}${text}${draft.slice(caret)}`
    setDraft(next.slice(0, 500))
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(caret + text.length, caret + text.length)
    })
  }

  const pickChannel = (next: ChannelId) => {
    if (next !== channel) {
      setMessages([])
      setNotice(null)
    }
    setChannel(next)
    setView('chat')
    setMenuOpen(false)
    setReplyTo(null)
  }

  const unread = inbox?.unreadTotal ?? 0
  const inviteCount = inbox?.groupInvites.length ?? 0

  return (
    <div className={styles.panel} data-chat-panel>
      <div className={styles.bar}>
        {lockedChannel ? (
          <strong className={styles.switcher}>{channelTitle(channel, inbox)}</strong>
        ) : (
          <button
            type="button"
            className={styles.switcher}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {view === 'chat'
              ? channelTitle(channel, inbox)
              : view === 'friends'
                ? 'Friends'
                : 'Settings'}
            <span aria-hidden="true">▾</span>
            {unread + inviteCount > 0 ? (
              <span className={styles.badge} aria-label={`${unread + inviteCount} unread`}>
                {unread + inviteCount}
              </span>
            ) : null}
          </button>
        )}
        <span className={styles.spacer} />
        {lockedChannel ? null : (
          <>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Friends and groups"
              aria-pressed={view === 'friends'}
              onClick={() => setView(view === 'friends' ? 'chat' : 'friends')}
            >
              👥
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Chat settings"
              aria-pressed={view === 'settings'}
              onClick={() => setView(view === 'settings' ? 'chat' : 'settings')}
            >
              ⚙
            </button>
          </>
        )}
      </div>

      {menuOpen && !lockedChannel ? (
        <div className={styles.menu} role="listbox" aria-label="Channels">
          <div className={styles.menuLabel}>Channels</div>
          <button
            type="button"
            className={styles.menuItem}
            role="option"
            aria-selected={channel === 'world'}
            aria-current={channel === 'world'}
            onClick={() => pickChannel('world')}
          >
            🌍{' '}
            <span>
              World<small>Everyone</small>
            </span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            role="option"
            aria-selected={channel === 'village'}
            aria-current={channel === 'village'}
            disabled={!inbox?.village.available}
            onClick={() => pickChannel('village')}
          >
            🏘{' '}
            <span>
              Village
              <small>
                {inbox?.village.available
                  ? 'People in this village'
                  : 'Opens when you stand in a village'}
              </small>
            </span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            role="option"
            disabled
            aria-selected={false}
          >
            🛡{' '}
            <span>
              Team<small>Unlocks with teams</small>
            </span>
          </button>
          <button
            type="button"
            className={styles.menuItem}
            role="option"
            aria-selected={feedOnly}
            aria-current={feedOnly}
            onClick={() => pickChannel('feed')}
          >
            📜{' '}
            <span>
              Game feed only<small>No player chat, just events and story</small>
            </span>
          </button>
          {inbox && inbox.whispers.length > 0 ? (
            <div className={styles.menuLabel}>Whispers</div>
          ) : null}
          {inbox?.whispers.map((w) => (
            <button
              key={w.characterId}
              type="button"
              className={styles.menuItem}
              role="option"
              aria-selected={channel === `whisper:${w.characterId}`}
              aria-current={channel === `whisper:${w.characterId}`}
              onClick={() => pickChannel(`whisper:${w.characterId}`)}
            >
              <span className={styles.dot} data-online={w.online} />
              <span>
                {w.name}
                <small>{w.lastBody}</small>
              </span>
              {w.unread > 0 ? <span className={styles.badge}>{w.unread}</span> : null}
            </button>
          ))}
          {inbox && inbox.groups.length > 0 ? (
            <div className={styles.menuLabel}>Private groups</div>
          ) : null}
          {inbox?.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={styles.menuItem}
              role="option"
              aria-selected={channel === `group:${g.id}`}
              aria-current={channel === `group:${g.id}`}
              onClick={() => pickChannel(`group:${g.id}`)}
            >
              🫂{' '}
              <span>
                {g.name}
                <small>{g.members} of 10</small>
              </span>
              {g.unread > 0 ? <span className={styles.badge}>{g.unread}</span> : null}
            </button>
          ))}
          {inbox && inbox.groupInvites.length > 0 ? (
            <div className={styles.menuLabel}>Invites</div>
          ) : null}
          {inbox?.groupInvites.map((invite) => (
            <div key={invite.groupId} className={styles.menuItem}>
              <span>
                {invite.name}
                <small>
                  from {invite.invitedBy ?? 'someone'} · {invite.members} of 10
                </small>
              </span>
              <span className={styles.actions}>
                <button
                  type="button"
                  className={styles.small}
                  onClick={() =>
                    void chatApi
                      .groupAction({ action: 'accept', groupId: invite.groupId })
                      .then(refreshInbox)
                      .catch((e: Error) => setNotice(e.message))
                  }
                >
                  Join
                </button>
                <button
                  type="button"
                  className={styles.small}
                  data-tone="danger"
                  onClick={() =>
                    void chatApi
                      .groupAction({ action: 'decline', groupId: invite.groupId })
                      .then(refreshInbox)
                      .catch((e: Error) => setNotice(e.message))
                  }
                >
                  No
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {view === 'friends' ? (
        <FriendsView
          onWhisper={(id) => pickChannel(`whisper:${id}`)}
          onOpenGroup={(id) => pickChannel(`group:${id}`)}
          onChanged={refreshInbox}
        />
      ) : view === 'settings' ? (
        <SettingsView settings={settings} onSaved={setSettings} />
      ) : (
        <>
          <div
            ref={feedRef}
            className={styles.feed}
            role="log"
            aria-live="polite"
            aria-label={`${channelTitle(channel, inbox)} messages`}
            onScroll={(event) => {
              const el = event.currentTarget
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
            }}
          >
            {visible.length === 0 ? (
              <p className={styles.empty}>
                {feedOnly
                  ? 'Game events and story lines will appear here.'
                  : 'Nothing here yet. Say hello.'}
              </p>
            ) : (
              visible.map((message, index) => {
                const previous = visible[index - 1]
                const grouped =
                  message.kind === 'chat' &&
                  previous?.kind === 'chat' &&
                  previous.senderCharacterId === message.senderCharacterId &&
                  !message.replyTo &&
                  new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
                    5 * 60_000
                return (
                  <ChatLine
                    key={message.id}
                    message={message}
                    grouped={grouped}
                    selfName={selfName}
                    knownNames={knownNames}
                    showEmbeds={settings?.showEmbeds ?? true}
                    onReply={(target) => {
                      setReplyTo(target)
                      inputRef.current?.focus()
                    }}
                  />
                )
              })
            )}
          </div>

          {notice ? (
            <p className={styles.notice} role="alert">
              {notice}
            </p>
          ) : null}

          <div className={styles.composerWrap}>
            {feedOnly ? (
              <button type="button" className={styles.joinPrompt} onClick={() => setMenuOpen(true)}>
                Join a channel to chat
              </button>
            ) : (
              <>
                {mention && !feedOnly && candidates.length > 0 ? (
                  <div className={styles.popover} role="listbox" aria-label="Mention someone">
                    {candidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={styles.menuItem}
                        role="option"
                        aria-selected={false}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          const caret = inputRef.current?.selectionStart ?? draft.length
                          const applied = applyMention(draft, caret, mention.start, candidate.name)
                          setDraft(applied.value)
                          setMention(null)
                          requestAnimationFrame(() => {
                            inputRef.current?.focus()
                            inputRef.current?.setSelectionRange(applied.caret, applied.caret)
                          })
                        }}
                      >
                        <span className={styles.dot} data-online={candidate.online} />
                        <span>
                          {candidate.name}
                          <small>{candidate.friend ? 'Friend' : `Level ${candidate.level}`}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {emojiOpen ? (
                  <div className={styles.popover} aria-label="Emoji">
                    <div className={styles.emojiGrid}>
                      {EMOJI_CHOICES.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`Insert ${emoji}`}
                          onClick={() => insertAtCaret(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {replyTo ? (
                  <p className={styles.reply}>
                    Replying to {replyTo.senderName ?? 'message'}{' '}
                    <button
                      type="button"
                      className={styles.small}
                      style={{ minHeight: 28, minWidth: 28 }}
                      onClick={() => setReplyTo(null)}
                      aria-label="Cancel reply"
                    >
                      ✕
                    </button>
                  </p>
                ) : null}
                <div className={styles.composer}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    maxLength={500}
                    value={draft}
                    placeholder={`Message ${channelTitle(channel, inbox)}`}
                    aria-label={`Message ${channelTitle(channel, inbox)}`}
                    onChange={(event) =>
                      onDraftChange(event.target.value, event.target.selectionStart)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void send()
                      } else if (event.key === 'Escape') {
                        setMention(null)
                        setEmojiOpen(false)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Emoji"
                    aria-pressed={emojiOpen}
                    onClick={() => setEmojiOpen((open) => !open)}
                  >
                    🙂
                  </button>
                  <button
                    type="button"
                    className={styles.send}
                    aria-label="Send message"
                    disabled={sending || !draft.trim()}
                    onClick={() => void send()}
                  >
                    ➤
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
