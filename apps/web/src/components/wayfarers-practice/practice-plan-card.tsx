'use client'

import {
  calculatePassiveTrainingXp,
  getPassiveTrainingXpPerHour,
  passiveTrainingWindowLabel,
} from '@aurevane/game-core/character/wayfarers-practice'
import { GameButton } from '@aurevane/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { formatPracticeDuration } from './training-report-card'
import styles from './training-workspace.module.css'

export type PracticePlanWindow = 'short' | 'overnight' | 'extended'

export interface PracticePlanCardData {
  characterId: string
  minimumOfflineSeconds: number
  restedMomentumBalance: number
  plannedWindow: PracticePlanWindow | null
  plannedWindowSeconds: number | null
  planSetAt: string | null
  shortWindowSeconds: number
  overnightWindowSeconds: number
  extendedWindowSeconds: number
  serverNow: string
}

interface PracticePlanCardProps {
  practice: PracticePlanCardData
  report?: ReactNode
  hasReport?: boolean
}

export function PracticePlanCard({ practice, report, hasReport = false }: PracticePlanCardProps) {
  const router = useRouter()
  const [submittingWindow, setSubmittingWindow] = useState<PracticePlanWindow | null>(null)
  const [stopping, setStopping] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const retryKey = useRef<{ window: PracticePlanWindow; key: string } | null>(null)
  const refreshQueued = useRef(false)
  const baseServerTime = useMemo(() => Date.parse(practice.serverNow), [practice.serverNow])
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const trainingEndMs =
    practice.planSetAt && practice.plannedWindowSeconds
      ? Date.parse(practice.planSetAt) + practice.plannedWindowSeconds * 1000
      : null
  const synchronizedNow = baseServerTime + elapsedMs
  const remainingSeconds = trainingEndMs
    ? Math.max(0, Math.ceil((trainingEndMs - synchronizedNow) / 1000))
    : 0
  const trainingActive = Boolean(
    practice.plannedWindow &&
    practice.planSetAt &&
    practice.plannedWindowSeconds &&
    remainingSeconds > 0,
  )

  useEffect(() => {
    if (!practice.plannedWindow || !trainingEndMs || remainingSeconds > 0 || refreshQueued.current)
      return
    refreshQueued.current = true
    const timer = window.setTimeout(() => router.refresh(), 250)
    return () => window.clearTimeout(timer)
  }, [practice.plannedWindow, remainingSeconds, router, trainingEndMs])

  const windows: readonly {
    window: PracticePlanWindow
    seconds: number
    description: string
  }[] = [
    {
      window: 'short',
      seconds: practice.shortWindowSeconds,
      description: 'Best hourly return for a shorter AFK window.',
    },
    {
      window: 'overnight',
      seconds: practice.overnightWindowSeconds,
      description: 'Moderate return for a medium training block.',
    },
    {
      window: 'extended',
      seconds: practice.extendedWindowSeconds,
      description: 'Lowest hourly return for a long unattended block.',
    },
  ]

  async function setPlan(window: PracticePlanWindow) {
    if (submittingWindow || stopping || trainingActive) return
    setSubmittingWindow(window)
    setErrorMessage(null)
    if (!retryKey.current || retryKey.current.window !== window) {
      retryKey.current = { window, key: crypto.randomUUID() }
    }

    try {
      const response = await fetch('/api/wayfarers-practice/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          characterId: practice.characterId,
          plannedWindow: window,
          idempotencyKey: retryKey.current.key,
        }),
      })
      const payload = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? 'Passive Training could not be started.')
        return
      }
      retryKey.current = null
      router.refresh()
    } catch {
      setErrorMessage('Passive Training could not reach the server. You can safely try again.')
    } finally {
      setSubmittingWindow(null)
    }
  }

  async function stopTraining() {
    if (stopping || !practice.plannedWindow) return
    setStopping(true)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/wayfarers-practice/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: practice.characterId }),
      })
      const payload = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? 'Passive Training could not be stopped.')
        return
      }
      router.refresh()
    } catch {
      setErrorMessage('Passive Training could not reach the server. Nothing was changed.')
    } finally {
      setStopping(false)
    }
  }

  const progressPercent =
    trainingActive && practice.plannedWindowSeconds
      ? Math.max(
          0,
          Math.min(
            100,
            ((practice.plannedWindowSeconds - remainingSeconds) / practice.plannedWindowSeconds) *
              100,
          ),
        )
      : 0

  return (
    <div className={styles.columns} data-training-active={trainingActive || undefined}>
      <section
        className={styles.panel}
        id="training-plan"
        data-testid="practice-plan-card"
        data-training-surface="ink"
        data-av-surface="ink"
        aria-labelledby="practice-plan-title"
        tabIndex={-1}
      >
        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>01 / Choose your pace</span>
            <h2 id="practice-plan-title">Training Plan</h2>
          </div>
          <span className={styles.badge}>{trainingActive ? 'Training active' : 'Idle'}</span>
        </header>
        <p className={styles.intro}>Choose a training duration.</p>
        <div className={styles.windowGrid} aria-label="Passive Training durations">
          {windows.map((option, index) => {
            const rate = getPassiveTrainingXpPerHour(option.window)
            const reward = calculatePassiveTrainingXp(option.window)
            const selected = practice.plannedWindow === option.window
            return (
              <div
                className={styles.window}
                key={option.window}
                data-active={selected || undefined}
              >
                <span className={styles.windowNumber} aria-hidden="true">
                  0{index + 1}
                </span>
                <div className={styles.windowHeading}>
                  <strong>{passiveTrainingWindowLabel(option.window)}</strong>
                  <span>{formatPracticeDuration(option.seconds)}</span>
                </div>
                <GameButton
                  className={styles.startButton}
                  type="button"
                  variant={selected ? 'quiet' : 'primary'}
                  disabled={submittingWindow !== null || stopping || trainingActive}
                  onClick={() => void setPlan(option.window)}
                >
                  {submittingWindow === option.window
                    ? 'Starting…'
                    : selected
                      ? 'Training now'
                      : `Start ${passiveTrainingWindowLabel(option.window)}`}
                </GameButton>
                <p>{option.description}</p>
                <dl className={styles.rewardLine}>
                  <div>
                    <dt>Rate</dt>
                    <dd>{rate} XP/hr</dd>
                  </div>
                  <div>
                    <dt>Complete</dt>
                    <dd>+{reward} XP</dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
        <details className={styles.rules}>
          <summary>How Passive Training works</summary>
          <p>
            While training is active, new Battle Hall fights are disabled. Profile, account,
            reference pages, Online Users, and social/chat surfaces remain available. If you stop
            early, the server awards XP for the completed fraction of the training time.
          </p>
        </details>
        {errorMessage ? (
          <p className={styles.error} role="status">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section
        className={`${styles.panel} ${styles.activity}`}
        id="training-current"
        data-av-surface="ink"
        data-testid={trainingActive ? 'passive-training-active' : undefined}
        aria-label="Current training activity"
        tabIndex={-1}
      >
        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>02 / In the stillness</span>
            <h2>Current Training</h2>
          </div>
          <span
            className={styles.statusDot}
            data-active={trainingActive || undefined}
            aria-hidden="true"
          />
        </header>
        <div className={styles.activityBody}>
          <span className={styles.emblem} aria-hidden="true">
            ◷
          </span>
          <span className={styles.eyebrow}>CHARACTER XP</span>
          <h3>
            {trainingActive
              ? 'Training in progress'
              : hasReport
                ? 'A chapter completed'
                : 'A moment of possibility'}
          </h3>
          <p className={styles.intro}>
            {trainingActive
              ? `${passiveTrainingWindowLabel(practice.plannedWindow!)} training · Your discipline continues.`
              : hasReport
                ? 'Your Training Report is ready. Claim your earned progress in the next panel.'
                : 'Choose Short, Medium or Extended to begin. Your training continues while you are away.'}
          </p>
          <div className={styles.countdown}>
            <span>{trainingActive ? 'Time remaining' : 'No active session'}</span>
            <strong>{trainingActive ? formatCountdown(remainingSeconds) : '— : — : —'}</strong>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Training progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(progressPercent)}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.progressLegend}>
            <span>{Math.floor(progressPercent)}% complete</span>
            <span>{trainingActive ? 'Server-timed session' : 'Ready when you are'}</span>
          </div>
          <dl className={styles.rewards}>
            <div>
              <dt>Completion reward</dt>
              <dd>
                {trainingActive
                  ? `+${calculatePassiveTrainingXp(practice.plannedWindow!)} XP`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Training duration</dt>
              <dd>
                {trainingActive ? formatPracticeDuration(practice.plannedWindowSeconds!) : '—'}
              </dd>
            </div>
          </dl>
          {trainingActive ? (
            <GameButton
              className={styles.stopButton}
              type="button"
              variant="quiet"
              disabled={stopping}
              onClick={() => void stopTraining()}
            >
              {stopping ? 'Stopping…' : 'Stop Training'}
            </GameButton>
          ) : null}
        </div>
        <p className={styles.footnote}>
          The server keeps time. This page does not need to stay open.
        </p>
      </section>
      {report}
    </div>
  )
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}
