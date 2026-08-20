'use client'

import {
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { GuidedTrainingProgress } from '@/server/battle/guided-training-completion-service'

import styles from './battle-lesson-coach.module.css'

interface BattleLessonCoachProps {
  battleSessionId: string
}

const VALID_RECORD_IDS: readonly TacticalHallRecordId[] = [
  'guided-fundamentals',
  'movement-drill',
  'strike-drill',
  'guard-drill',
  'facing-drill',
  'recruit-sparring',
]

const DEFAULT_RECORD_ID: TacticalHallRecordId = 'recruit-sparring'
const COACH_STORE_EVENT = 'aurevane:tactical-coach-changed'
const EMPTY_PROGRESS: GuidedTrainingProgress = {
  move: false,
  attack: false,
  guard: false,
  facing: false,
}

const GUIDED_CRITERIA = [
  {
    id: 'move' as const,
    label: 'Commit a movement path',
    why: 'Positioning controls range, terrain access, escape routes, and how much Action Economy remains for the rest of your turn.',
  },
  {
    id: 'attack' as const,
    label: 'Commit a Basic Attack',
    why: 'An attack turns good positioning into pressure. Reading range and forecast before committing helps you spend AP deliberately.',
  },
  {
    id: 'guard' as const,
    label: 'Use Guard',
    why: 'Guard is a tempo trade: spending AP defensively can reduce incoming damage and keep a poor exchange from becoming a defeat.',
  },
  {
    id: 'facing' as const,
    label: 'Finish a turn with intentional facing',
    why: 'Final facing makes you think about the opponent’s next angle instead of ending a turn with no plan for the response.',
  },
] as const

function isRecordId(value: string | null): value is TacticalHallRecordId {
  return value !== null && VALID_RECORD_IDS.includes(value as TacticalHallRecordId)
}

function subscribeCoachStore(onStoreChange: () => void): () => void {
  window.addEventListener(COACH_STORE_EVENT, onStoreChange)
  return () => window.removeEventListener(COACH_STORE_EVENT, onStoreChange)
}

function recordSnapshot(battleSessionId: string): TacticalHallRecordId {
  const stored = sessionStorage.getItem(`aurevane:tactical-record:${battleSessionId}`)
  return isRecordId(stored) ? stored : DEFAULT_RECORD_ID
}

function dismissedSnapshot(battleSessionId: string): boolean {
  return sessionStorage.getItem(`aurevane:tactical-coach-dismissed:${battleSessionId}`) === '1'
}

function progressChanged(before: GuidedTrainingProgress, after: GuidedTrainingProgress): boolean {
  return GUIDED_CRITERIA.some((criterion) => !before[criterion.id] && after[criterion.id])
}

function progressComplete(progress: GuidedTrainingProgress): boolean {
  return GUIDED_CRITERIA.every((criterion) => progress[criterion.id])
}

export function BattleLessonCoach({ battleSessionId }: BattleLessonCoachProps) {
  const recordId = useSyncExternalStore(
    subscribeCoachStore,
    () => recordSnapshot(battleSessionId),
    () => DEFAULT_RECORD_ID,
  )
  const dismissed = useSyncExternalStore(
    subscribeCoachStore,
    () => dismissedSnapshot(battleSessionId),
    () => false,
  )

  if (recordId === 'guided-fundamentals') {
    return <GuidedFundamentalsCoach battleSessionId={battleSessionId} />
  }

  if (dismissed) return null
  const record = getTacticalHallRecord(recordId)

  return (
    <aside
      className={styles.anchor}
      aria-label="Battle Hall lesson"
      data-testid="battle-lesson-coach"
    >
      <details className={styles.coach}>
        <summary>
          <span>Guide</span>
          <strong>{record.name}</strong>
        </summary>
        <div className={styles.body}>
          <p>{record.purpose}</p>
          <ol>
            {record.coachSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => {
              sessionStorage.setItem(`aurevane:tactical-coach-dismissed:${battleSessionId}`, '1')
              window.dispatchEvent(new Event(COACH_STORE_EVENT))
            }}
          >
            Hide this guide for this battle
          </button>
        </div>
      </details>
    </aside>
  )
}

function GuidedFundamentalsCoach({ battleSessionId }: { battleSessionId: string }) {
  const [open, setOpen] = useState(true)
  const [progress, setProgress] = useState<GuidedTrainingProgress>(EMPTY_PROGRESS)
  const [error, setError] = useState<string | null>(null)
  const latestProgress = useRef<GuidedTrainingProgress>(EMPTY_PROGRESS)
  const completing = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    async function completeTraining() {
      if (completing.current || cancelled) return
      completing.current = true
      setError(null)
      try {
        const response = await fetch(`/api/battles/${battleSessionId}/guided-training`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
        })
        const body = (await response.json()) as {
          completed?: boolean
          error?: { message?: string }
        }
        if (!response.ok || !body.completed) {
          throw new Error(body.error?.message ?? 'Training completion could not be committed.')
        }
        sessionStorage.setItem(`aurevane:guided-training-completed:${battleSessionId}`, '1')
        window.location.reload()
      } catch (completionError) {
        if (!cancelled) {
          setError(
            completionError instanceof Error
              ? completionError.message
              : 'Training completion could not be committed.',
          )
          completing.current = false
        }
      }
    }

    async function refresh() {
      try {
        const response = await fetch(`/api/battles/${battleSessionId}/guided-training`, {
          cache: 'no-store',
        })
        const body = (await response.json()) as {
          progress?: GuidedTrainingProgress
          error?: { message?: string }
        }
        if (!response.ok || !body.progress || cancelled) return

        const next = body.progress
        if (progressChanged(latestProgress.current, next)) setOpen(true)
        latestProgress.current = next
        setProgress(next)
        if (progressComplete(next)) await completeTraining()
      } catch {
        // The battle itself remains usable if supplementary coaching cannot refresh momentarily.
      } finally {
        if (!cancelled) timer = window.setTimeout(refresh, 900)
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [battleSessionId])

  if (!open) {
    return (
      <button className={styles.guidedReopen} type="button" onClick={() => setOpen(true)}>
        Training criteria {GUIDED_CRITERIA.filter((criterion) => progress[criterion.id]).length}/
        {GUIDED_CRITERIA.length}
      </button>
    )
  }

  return (
    <div className={styles.guidedBackdrop} onPointerDown={() => setOpen(false)}>
      <section
        className={styles.guidedPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-training-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          className={styles.guidedClose}
          type="button"
          aria-label="Close training criteria"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <span>Battle Hall · Guided Fundamentals</span>
        <h2 id="guided-training-title">
          {progressComplete(progress) ? 'Training complete' : 'Complete the tactical fundamentals'}
        </h2>
        <p>
          This exercise ends successfully when every server-recorded criterion is complete. The
          checklist reopens as you make progress so you can see what changed.
        </p>
        <ol className={styles.criteria}>
          {GUIDED_CRITERIA.map((criterion) => {
            const complete = progress[criterion.id]
            return (
              <li key={criterion.id} data-complete={complete || undefined}>
                <strong>
                  {complete ? '✓' : '○'} {criterion.label}
                </strong>
                <small>{criterion.why}</small>
              </li>
            )
          })}
        </ol>
        {error ? <p className={styles.guidedError}>{error}</p> : null}
        <div className={styles.guidedFooter}>
          <span>
            {GUIDED_CRITERIA.filter((criterion) => progress[criterion.id]).length}/
            {GUIDED_CRITERIA.length} complete
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={progressComplete(progress)}
          >
            Continue training
          </button>
        </div>
      </section>
    </div>
  )
}
