'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { appearanceManifestFromImageUrl } from '@/appearance/appearance-manifest'
import type { WorldInteraction, WorldInteractionActionId, WorldObjective } from '@/world/types'
import styles from './world-dialogue.module.css'

const MAX_HISTORY = 12
const progressLabel: Record<WorldInteraction['progress'], string> = {
  available: 'Available',
  active: 'In progress',
  ready: 'Ready',
  completed: 'Completed',
}

export function dialogueSpeakerId(topic: WorldInteraction) {
  return topic.speakerId ?? topic.id
}

export function WorldDialogue({
  opener,
  initialTopic,
  topics,
  objectives,
  interruption,
  error,
  busy,
  onReply,
  onClose,
  extraResponses,
}: {
  opener: HTMLButtonElement
  initialTopic: WorldInteraction
  topics: WorldInteraction[]
  objectives: WorldObjective[]
  interruption: string | null
  error: string
  busy: boolean
  onReply: (id: string, actionId: WorldInteractionActionId) => Promise<boolean>
  onClose: () => void
  extraResponses?: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const responding = useRef(false)
  const [topicId, setTopicId] = useState<string | null>(initialTopic.id)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loreTopic, setLoreTopic] = useState<string | null>(null)
  const [history, setHistory] = useState<{ speaker: string; body: string }[]>([])
  const [failedPortraits, setFailedPortraits] = useState(() => new Set<string>())
  const [ended, setEnded] = useState<string | null>(null)
  const topic = topics.find((entry) => entry.id === topicId)
  const speaker = topic ?? topics[0] ?? initialTopic
  const neutralPortrait = speaker.portraitUrl
  const expressionPortrait =
    appearanceManifestFromImageUrl(neutralPortrait)?.portraits[speaker.expression ?? 'neutral']
  const portrait = [expressionPortrait, neutralPortrait].find(
    (asset) => asset && !failedPortraits.has(asset),
  )
  const objective = objectives.find((entry) => entry.id === topic?.objectiveId)
  const interrupted =
    interruption ?? (!topics.length ? 'This speaker is no longer within reach.' : null)
  if (interrupted && !ended) setEnded(interrupted)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    close.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      if (opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [opener])

  useEffect(() => {
    if (busy) dialog.current?.focus({ preventScroll: true })
  }, [busy])

  const reply = async (actionId: WorldInteractionActionId, label: string) => {
    if (!topic || busy || responding.current) return
    responding.current = true
    try {
      if (await onReply(topic.id, actionId)) {
        setLoreTopic(null)
        if (actionId === 'travel-realm' || actionId === 'leave-realm') onClose()
        setHistory((entries) =>
          [
            ...entries,
            { speaker: topic.speaker, body: topic.body },
            { speaker: 'You', body: label },
          ].slice(-MAX_HISTORY),
        )
      }
    } finally {
      responding.current = false
      close.current?.focus({ preventScroll: true })
    }
  }

  return (
    <dialog
      ref={dialog}
      className={styles.dialogue}
      data-world-dialogue
      aria-labelledby="world-dialogue-speaker"
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy && !responding.current) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [tabindex="0"]',
          ),
        )
        const first = controls[0]
        const last = controls.at(-1)
        const focused = document.activeElement
        if (!first || !last) {
          event.preventDefault()
        } else if (
          !controls.includes(focused as HTMLElement) ||
          (event.shiftKey ? focused === first : focused === last)
        ) {
          event.preventDefault()
          const target = event.shiftKey ? last : first
          target.focus()
        }
      }}
    >
      <div className={styles.portrait} aria-hidden="true">
        {portrait ? (
          // A published NPC may use a registered asset or an approved external portrait.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={portrait}
            src={portrait}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedPortraits((failed) => new Set([...failed, portrait]))}
          />
        ) : (
          <svg viewBox="0 0 40 48" fill="none">
            <path d="M20 3 35 9v13c0 10-6 17-15 23C11 39 5 32 5 22V9L20 3Z" />
            <path d="m20 12 8 10-8 10-8-10 8-10Z" />
          </svg>
        )}
      </div>
      <header className={styles.header}>
        <div>
          <p>Conversation</p>
          <h2 id="world-dialogue-speaker">{speaker.speaker}</h2>
        </div>
        <button
          ref={close}
          type="button"
          aria-label="End conversation"
          onClick={onClose}
          disabled={busy}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className={styles.reading} role="region" aria-label="Dialogue content" tabIndex={0}>
        {ended ? (
          <p className={styles.speech} role="status">
            {ended}
          </p>
        ) : historyOpen ? (
          <section aria-label="Conversation history" className={styles.context}>
            {history.length ? (
              <ol className={styles.history}>
                {history.map((entry, index) => (
                  <li key={index}>
                    <strong>{entry.speaker}</strong> {entry.body}
                  </li>
                ))}
              </ol>
            ) : topic?.lastReply ? (
              <p>
                <strong>Your last reply:</strong> {topic.lastReply}
              </p>
            ) : (
              <p>No replies sent in this conversation.</p>
            )}
          </section>
        ) : topic ? (
          <>
            <p className={styles.speech} aria-live="polite">
              {loreTopic === topic.id ? topic.lore : topic.body}
            </p>
            {objective ? (
              <section className={styles.context} aria-label="Quest details">
                <div>
                  <h3>{topic.title}</h3>
                  <span>{progressLabel[topic.progress]}</span>
                </div>
                <p>{objective.description}</p>
              </section>
            ) : null}
          </>
        ) : (
          <section aria-label="Conversation topics" className={styles.topics}>
            {topics.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => {
                  setTopicId(entry.id)
                  close.current?.focus({ preventScroll: true })
                }}
              >
                {entry.title}
              </button>
            ))}
          </section>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className={styles.responses}>
        {!ended && !historyOpen ? extraResponses : null}
        {!ended && !historyOpen && topic?.actionId && topic.actionLabel ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => void reply(topic.actionId!, topic.actionLabel!)}
            disabled={busy}
          >
            {busy ? 'Sending reply…' : topic.actionLabel}
          </button>
        ) : null}
        {!ended && !historyOpen && topic?.alternative ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const alternative = topic.alternative!
              void reply(alternative.actionId, alternative.label)
            }}
          >
            {topic.alternative.label}
          </button>
        ) : null}
        {!ended && !historyOpen && topic?.lore ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setLoreTopic(loreTopic === topic.id ? null : topic.id)}
          >
            {loreTopic === topic.id ? 'Back to the quest' : 'About the sealed realm'}
          </button>
        ) : null}
        {!ended && !historyOpen && topic?.declineLabel ? (
          <button type="button" disabled={busy} onClick={onClose}>
            {topic.declineLabel}
          </button>
        ) : null}
        {!ended && !historyOpen && topic && topics.length > 1 ? (
          <button
            type="button"
            onClick={() => {
              setTopicId(null)
              close.current?.focus({ preventScroll: true })
            }}
            disabled={busy}
          >
            Topics
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          disabled={busy || Boolean(ended)}
        >
          {historyOpen ? 'Back to conversation' : 'History'}
        </button>
      </footer>
    </dialog>
  )
}
