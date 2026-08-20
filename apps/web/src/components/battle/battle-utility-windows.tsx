'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import styles from './battle-utility-windows.module.css'

interface BattleUtilityWindowsProps {
  battleSessionId: string
  playerName: string
}

interface LocalChatMessage {
  id: string
  author: string
  text: string
}

interface BattleLogEntry {
  battleVersion: number
  message: string
}

interface BattleLogResponse {
  battleLog?: { entries: BattleLogEntry[] }
  error?: { message?: string }
}

const MAX_RECENT_EMOJIS = 8

function logTrigger(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      button.textContent?.includes('Combat Log'),
    ) ?? null
  )
}

function chatTrigger(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('footer button')).find((button) =>
      /^Chat\b/i.test(button.textContent?.trim() ?? ''),
    ) ?? null
  )
}

function recentEmojiStorageKey(playerName: string): string {
  return `aurevane:battle-recent-emojis:${playerName}`
}

function loadRecentEmojis(playerName: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentEmojiStorageKey(playerName)) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .slice(0, MAX_RECENT_EMOJIS)
  } catch {
    return []
  }
}

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

function groupLogEntries(entries: readonly BattleLogEntry[]): Array<{
  battleVersion: number
  entries: BattleLogEntry[]
}> {
  const groups: Array<{ battleVersion: number; entries: BattleLogEntry[] }> = []
  for (const entry of entries) {
    const current = groups.at(-1)
    if (current?.battleVersion === entry.battleVersion) current.entries.push(entry)
    else groups.push({ battleVersion: entry.battleVersion, entries: [entry] })
  }
  return groups
}

function isBookkeepingMessage(message: string): boolean {
  return (
    /^Round \d+ began\.?$/i.test(message) ||
    /activation began/i.test(message) ||
    /ended the activation/i.test(message) ||
    /ended facing/i.test(message) ||
    /chose facing/i.test(message) ||
    /chose (an? )?.*opportunity/i.test(message) ||
    /spent \d+ Movement/i.test(message)
  )
}

function summarizeCommittedAction(entries: readonly BattleLogEntry[], playerName: string): string {
  const personalized = entries.map((entry) => entry.message.replaceAll('Wayfarer', playerName))
  const meaningful = personalized.filter((message) => !isBookkeepingMessage(message))
  const source = meaningful.length > 0 ? meaningful : personalized
  const unique = source.filter((message, index) => source.indexOf(message) === index)
  if (unique.length === 0) return 'Combat state advanced.'
  return unique.slice(0, 3).join(' · ')
}

function UtilityWindow({
  title,
  meta,
  side,
  onClose,
  testId,
  children,
}: {
  title: string
  meta: string
  side: 'left' | 'right'
  onClose: () => void
  testId?: string
  children: ReactNode
}) {
  const windowRef = useRef<HTMLElement>(null)

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return
    if ((event.target as Element | null)?.closest('button, input, textarea, select, a')) return
    const panel = windowRef.current
    if (!panel) return

    event.preventDefault()
    const rect = panel.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = rect.left
    const startTop = rect.top

    panel.style.width = `${rect.width}px`
    panel.style.height = `${rect.height}px`
    panel.style.left = `${rect.left}px`
    panel.style.top = `${rect.top}px`
    panel.style.right = 'auto'
    panel.style.bottom = 'auto'

    function move(moveEvent: PointerEvent) {
      const width = panel.getBoundingClientRect().width
      const height = panel.getBoundingClientRect().height
      const left = Math.max(
        4,
        Math.min(window.innerWidth - width - 4, startLeft + moveEvent.clientX - startX),
      )
      const top = Math.max(
        4,
        Math.min(window.innerHeight - height - 4, startTop + moveEvent.clientY - startY),
      )
      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
    }

    function finish() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  return (
    <section
      ref={windowRef}
      className={`${styles.utilityWindow} ${side === 'left' ? styles.leftWindow : styles.rightWindow}`}
      data-testid={testId}
      data-battle-utility-window={side}
      aria-label={title}
    >
      <header className={styles.windowHeader} onPointerDown={beginDrag}>
        <div>
          <strong>{title}</strong>
          <span>{meta}</span>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
          ×
        </button>
      </header>
      <div className={styles.windowBody}>{children}</div>
    </section>
  )
}

export function BattleUtilityWindows({
  battleSessionId,
  playerName,
}: BattleUtilityWindowsProps) {
  const [mounted, setMounted] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([])
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [logEntries, setLogEntries] = useState<BattleLogEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    setRecentEmojis(loadRecentEmojis(playerName))
  }, [playerName])

  const recordEmojiUsage = useCallback(
    (used: readonly string[]) => {
      if (used.length === 0) return
      setRecentEmojis((current) => {
        const next = mergeRecentEmojis(current, used)
        localStorage.setItem(recentEmojiStorageKey(playerName), JSON.stringify(next))
        return next
      })
    },
    [playerName],
  )

  useEffect(() => {
    function interceptUtilityTrigger(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest<HTMLButtonElement>('button')
      if (!button) return

      const isLog = button.closest('header') && button.textContent?.includes('Combat Log')
      const isChat = button.closest('footer') && /^Chat\b/i.test(button.textContent?.trim() ?? '')
      if (!isLog && !isChat) return

      event.preventDefault()
      event.stopImmediatePropagation()
      if (isLog) setLogOpen((value) => !value)
      else setChatOpen((value) => !value)
    }

    document.addEventListener('click', interceptUtilityTrigger, true)
    return () => document.removeEventListener('click', interceptUtilityTrigger, true)
  }, [])

  useEffect(() => {
    logTrigger()?.setAttribute('aria-expanded', String(logOpen))
  }, [logOpen])

  useEffect(() => {
    chatTrigger()?.setAttribute('aria-expanded', String(chatOpen))
    if (!chatOpen) setEmojiOpen(false)
  }, [chatOpen])

  useEffect(() => {
    if (!emojiOpen) return
    function closeEmojiPicker(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (emojiButtonRef.current?.contains(event.target)) return
      if (emojiPickerRef.current?.contains(event.target)) return
      setEmojiOpen(false)
    }
    document.addEventListener('pointerdown', closeEmojiPicker, true)
    return () => document.removeEventListener('pointerdown', closeEmojiPicker, true)
  }, [emojiOpen])

  const loadLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const response = await fetch(`/api/battles/${battleSessionId}/events`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as BattleLogResponse
      if (!response.ok || !body.battleLog) {
        throw new Error(body.error?.message ?? 'Battle history is temporarily unavailable.')
      }
      setLogEntries(body.battleLog.entries)
      setLogError(null)
    } catch (error) {
      setLogError(
        error instanceof Error ? error.message : 'Battle history is temporarily unavailable.',
      )
    } finally {
      setLogLoading(false)
    }
  }, [battleSessionId])

  useEffect(() => {
    if (!logOpen) return
    void loadLog()
    const timer = window.setInterval(() => void loadLog(), 1200)
    return () => window.clearInterval(timer)
  }, [loadLog, logOpen])

  const logGroups = useMemo(() => groupLogEntries(logEntries), [logEntries])

  function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = chatDraft.trim()
    if (!text) return
    setChatMessages((messages) => [
      ...messages,
      { id: crypto.randomUUID(), author: playerName, text },
    ])
    recordEmojiUsage(extractEmojis(text))
    setChatDraft('')
    setEmojiOpen(false)
  }

  if (!mounted) return null

  return createPortal(
    <>
      {logOpen ? (
        <UtilityWindow
          title="Combat Log"
          meta="Committed action summaries · drag header · resize corner"
          side="right"
          testId="battle-log-panel"
          onClose={() => setLogOpen(false)}
        >
          <div className={styles.logContent} aria-label="Committed battle log">
            {logLoading && logEntries.length === 0 ? (
              <p>Reading committed events…</p>
            ) : logError ? (
              <p role="status">{logError}</p>
            ) : logGroups.length === 0 ? (
              <p>No committed combat events yet.</p>
            ) : (
              <ol>
                {logGroups.map((group) => (
                  <li key={group.battleVersion}>
                    {summarizeCommittedAction(group.entries, playerName)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </UtilityWindow>
      ) : null}

      {chatOpen ? (
        <UtilityWindow
          title="Battle Chat"
          meta="Self channel · drag header · resize corner"
          side="left"
          onClose={() => setChatOpen(false)}
        >
          <div className={styles.chatLayout}>
            <div className={styles.chatMessages} aria-live="polite">
              {chatMessages.length === 0 ? (
                <p>Use this solo channel for notes, callouts, or testing chat behavior.</p>
              ) : (
                chatMessages.map((message) => (
                  <p key={message.id}>
                    <strong>{message.author}</strong>
                    <span>{message.text}</span>
                  </p>
                ))
              )}
            </div>
            <form className={styles.chatComposer} onSubmit={sendChatMessage}>
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Message…"
                maxLength={280}
                aria-label="Battle chat message"
              />
              <button
                ref={emojiButtonRef}
                type="button"
                className={styles.emojiTrigger}
                aria-label="Choose emoji"
                aria-expanded={emojiOpen}
                onClick={() => setEmojiOpen((value) => !value)}
              >
                ☺
              </button>
              <button type="submit" disabled={!chatDraft.trim()}>
                Send
              </button>
              {emojiOpen ? (
                <div
                  ref={emojiPickerRef}
                  className={styles.emojiPicker}
                  role="group"
                  aria-label="Recent emoji"
                >
                  {recentEmojis.length === 0 ? (
                    <span>No recent emoji yet</span>
                  ) : (
                    recentEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`Insert ${emoji}`}
                        onClick={() => {
                          setChatDraft((draft) => `${draft}${emoji}`)
                          recordEmojiUsage([emoji])
                          setEmojiOpen(false)
                        }}
                      >
                        {emoji}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </form>
          </div>
        </UtilityWindow>
      ) : null}
    </>,
    document.body,
  )
}
