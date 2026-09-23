'use client'

import {
  calculatePassiveTrainingXp,
  getPassiveTrainingXpPerHour,
  passiveTrainingWindowLabel,
} from '@aurevane/game-core/character/wayfarers-practice'
import { GameButton } from '@aurevane/ui'

import { AurevaneImage } from '@/components/media/aurevane-image'
import type { ImageAssetId } from '@/media/registry'
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
    imageAssetId: ImageAssetId
  }[] = [
    {
      window: 'short',
      seconds: practice.shortWindowSeconds,
      description: 'Best hourly return.',
      imageAssetId: 'environment.passive-training.cloister',
    },
    {
      window: 'overnight',
      seconds: practice.overnightWindowSeconds,
      description: 'Moderate hourly return.',
      imageAssetId: 'environment.battle-hall.courtyard',
    },
    {
      window: 'extended',
      seconds: practice.extendedWindowSeconds,
      description: 'Lowest hourly return.',
      imageAssetId: 'environment.archive.interior',
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
        data-training-surface="moonstone"
        data-av-surface="moonstone"
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
          {windows.map((option) => {
            const rate = getPassiveTrainingXpPerHour(option.window)
            const reward = calculatePassiveTrainingXp(option.window)
            const selected = practice.plannedWindow === option.window
            return (
              <article
                className={styles.window}
                key={option.window}
                data-active={selected || undefined}
              >
                <div className={styles.windowMedia} aria-hidden="true">
                  <AurevaneImage
                    assetId={option.imageAssetId}
                    className={styles.windowImage}
                    sizes="7rem"
                  />
                </div>
                <div className={styles.windowBody}>
                  <div className={styles.windowHeading}>
                    <strong>{passiveTrainingWindowLabel(option.window)}</strong>
                    <span>{formatPracticeDuration(option.seconds)}</span>
                  </div>
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
                </div>
              </article>
            )
          })}
        </div>
        {errorMessage ? (
          <p className={styles.error} role="status">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section
        className={`${styles.panel} ${styles.activity}`}
        id="training-current"
        data-av-surface="moonstone"
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
          {!trainingActive ? (
            <div className={styles.activitySigil} aria-hidden="true">
              <span>❧</span>
            </div>
          ) : null}
          <div className={styles.activitySummary}>
            <div>
              <span className={styles.eyebrow}>CHARACTER XP</span>
              <h3>
                {trainingActive
                  ? `${passiveTrainingWindowLabel(practice.plannedWindow!)} Training`
                  : hasReport
                    ? 'A chapter completed'
                    : 'Ready when you are'}
              </h3>
            </div>
            <div className={styles.countdown}>
              <span>{trainingActive ? 'Time remaining' : 'No active session'}</span>
              <strong>{trainingActive ? formatCountdown(remainingSeconds) : '— : — : —'}</strong>
            </div>
          </div>
          <p className={styles.intro}>
            {trainingActive
              ? 'Training in progress. Your discipline continues while you are away.'
              : hasReport
                ? 'Your Training Report is ready. Claim your earned progress in the next panel.'
                : 'Choose Short, Medium or Extended to begin. Your training continues while you are away.'}
          </p>
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
