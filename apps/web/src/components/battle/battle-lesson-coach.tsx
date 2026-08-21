'use client'

import {
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { GuidedTrainingProgress } from '@/server/battle/guided-training-completion-service'

import styles from './battle-lesson-coach.module.css'

interface BattleLessonCoachProps {
  battleSessionId: string
  recordId: TacticalHallRecordId
}

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

function progressChanged(before: GuidedTrainingProgress, after: GuidedTrainingProgress): boolean {
  return GUIDED_CRITERIA.some((criterion) => !before[criterion.id] && after[criterion.id])
}

function progressComplete(progress: GuidedTrainingProgress): boolean {
  return GUIDED_CRITERIA.every((criterion) => progress[criterion.id])
}

function progressCount(progress: GuidedTrainingProgress): number {
  return GUIDED_CRITERIA.filter((criterion) => progress[criterion.id]).length
}

function useHeaderCriteriaTarget(): HTMLElement | null {
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let frame = 0
    let activeHeader: HTMLElement | null = null
    let activeEconomy: HTMLElement | null = null
    let activeObjective: HTMLElement | null = null
    let activeRound: HTMLElement | null = null

    const clearInlineLayout = () => {
      for (const element of [activeHeader, activeEconomy, activeObjective, activeRound]) {
        if (!element) continue
        element.style.removeProperty('grid-template-columns')
        element.style.removeProperty('grid-column')
        element.style.removeProperty('grid-row')
      }
      activeHeader = null
      activeEconomy = null
      activeObjective = null
      activeRound = null
    }

    const locate = () => {
      frame = 0
      const track = document.querySelector<HTMLElement>(
        '[role="progressbar"][aria-label="Action Economy remaining"]',
      )
      const locatedEconomy =
        track?.parentElement instanceof HTMLElement ? track.parentElement : null
      const economy = locatedEconomy ?? (activeEconomy?.isConnected ? activeEconomy : null)
      const header = economy?.closest<HTMLElement>('header') ?? null
      const objective =
        header?.firstElementChild instanceof HTMLElement ? header.firstElementChild : null
      const round =
        header === null
          ? null
          : ((Array.from(header.children).find(
              (element) =>
                element instanceof HTMLButtonElement && element.textContent?.includes('Combat Log'),
            ) as HTMLElement | undefined) ?? null)

      if (!header || !economy || !objective || !round) {
        if (activeHeader && !activeHeader.isConnected) {
          clearInlineLayout()
          setHeaderTarget(null)
        }
        return
      }

      if (
        activeHeader !== header ||
        activeEconomy !== economy ||
        activeObjective !== objective ||
        activeRound !== round
      ) {
        clearInlineLayout()
        activeHeader = header
        activeEconomy = economy
        activeObjective = objective
        activeRound = round
      }

      const compact = window.matchMedia('(max-width: 880px)').matches
      header.style.gridTemplateColumns = compact
        ? 'minmax(0, 1fr) auto'
        : 'minmax(10rem, 1fr) minmax(13rem, 24rem) auto auto'
      objective.style.gridColumn = '1'
      objective.style.gridRow = '1'
      round.style.gridColumn = compact ? '2' : '4'
      round.style.gridRow = '1'
      economy.style.gridColumn = compact ? '1' : '2'
      economy.style.gridRow = compact ? '2' : '1'
      setHeaderTarget((current) => (current === header ? current : header))
    }

    const scheduleLocate = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(scheduleLocate)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleLocate)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleLocate)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      clearInlineLayout()
    }
  }, [])

  return headerTarget
}

export function BattleLessonCoach({ battleSessionId, recordId }: BattleLessonCoachProps) {
  if (recordId === 'guided-fundamentals') {
    return <GuidedFundamentalsCriteria battleSessionId={battleSessionId} />
  }
  return <StandardBattleCriteria recordId={recordId} />
}

function StandardBattleCriteria({ recordId }: { recordId: TacticalHallRecordId }) {
  const [open, setOpen] = useState(false)
  const headerTarget = useHeaderCriteriaTarget()
  const record = getTacticalHallRecord(recordId)

  return (
    <>
      {headerTarget
        ? createPortal(
            <button
              className={styles.guidedReopen}
              type="button"
              aria-label="Victory conditions, 0 of 1 objectives complete"
              onClick={() => setOpen(true)}
            >
              <span>Victory Conditions</span>
              <strong>0/1</strong>
            </button>,
            headerTarget,
          )
        : null}
      {open ? (
        <div className={styles.guidedBackdrop} onPointerDown={() => setOpen(false)}>
          <section
            className={styles.guidedPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="battle-criteria-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              className={styles.guidedClose}
              type="button"
              aria-label="Close victory conditions"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <span>Battle Hall · {record.name}</span>
            <h2 id="battle-criteria-title">Victory conditions</h2>
            <p>
              Defeat all opposing combatants. When no enemy combatants remain able to fight, the
              battle ends in victory.
            </p>
            <div className={styles.guidedFooter}>
              <span>0/1 objectives complete</span>
              <button type="button" onClick={() => setOpen(false)}>
                Return to battle
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

function GuidedFundamentalsCriteria({ battleSessionId }: { battleSessionId: string }) {
  const [open, setOpen] = useState(true)
  const [progress, setProgress] = useState<GuidedTrainingProgress>(EMPTY_PROGRESS)
  const [error, setError] = useState<string | null>(null)
  const [hasUnseenProgress, setHasUnseenProgress] = useState(false)
  const headerTarget = useHeaderCriteriaTarget()
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
        if (progressChanged(latestProgress.current, next)) setHasUnseenProgress(true)
        latestProgress.current = next
        setProgress(next)
        if (progressComplete(next)) await completeTraining()
      } catch {
        // The battle itself remains usable if supplementary criteria cannot refresh momentarily.
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

  return (
    <>
      {headerTarget
        ? createPortal(
            <button
              className={styles.guidedReopen}
              type="button"
              data-new-progress={hasUnseenProgress || undefined}
              aria-label={`Victory conditions, ${progressCount(progress)} of ${GUIDED_CRITERIA.length} criteria complete${hasUnseenProgress ? ', new progress' : ''}`}
              onClick={() => {
                setHasUnseenProgress(false)
                setOpen(true)
              }}
            >
              <span>Victory Conditions</span>
              <strong>
                {progressCount(progress)}/{GUIDED_CRITERIA.length}
              </strong>
            </button>,
            headerTarget,
          )
        : null}
      {open ? (
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
              aria-label="Close victory conditions"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <span>Battle Hall · Guided Fundamentals</span>
            <h2 id="guided-training-title">
              {progressComplete(progress)
                ? 'Training complete'
                : 'Complete the tactical fundamentals'}
            </h2>
            <p>
              This battle has an alternate victory condition: complete every server-recorded
              criterion. New progress highlights the Victory Conditions button instead of
              interrupting your turn.
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
                {progressCount(progress)}/{GUIDED_CRITERIA.length} complete
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
      ) : null}
    </>
  )
}
