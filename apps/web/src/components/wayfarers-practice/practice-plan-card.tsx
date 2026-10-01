'use client'

import {
  calculatePassiveTrainingXp,
  getPassiveTrainingXpPerHour,
  passiveTrainingWindowLabel,
} from '@aurevane/game-core/character/wayfarers-practice'
import { GameButton } from '@aurevane/ui'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  formatPracticeDuration,
  TrainingReportCard,
  type TrainingReportCardData,
} from './training-report-card'
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
  trainingReport?: TrainingReportCardData | null
}

export function PracticePlanCard({ practice, trainingReport = null }: PracticePlanCardProps) {
  const router = useRouter()
  const [selectedWindow, setSelectedWindow] = useState<PracticePlanWindow>(
    practice.plannedWindow ?? 'short',
  )
  const [submittingWindow, setSubmittingWindow] = useState<PracticePlanWindow | null>(null)
  const [stopping, setStopping] = useState(false)
  const [settleStoppedReport, setSettleStoppedReport] = useState(false)
  const [settledNotice, setSettledNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const retryKey = useRef<{ window: PracticePlanWindow; key: string } | null>(null)
  const refreshedEndMs = useRef<number | null>(null)
  const baseServerTime = useMemo(() => Date.parse(practice.serverNow), [practice.serverNow])
  const [clock, setClock] = useState({ serverNow: practice.serverNow, elapsedMs: 0 })
  const elapsedMs = clock.serverNow === practice.serverNow ? clock.elapsedMs : 0

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(
      () => setClock({ serverNow: practice.serverNow, elapsedMs: Date.now() - started }),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [practice.serverNow])

  const trainingEndMs =
    practice.planSetAt && practice.plannedWindowSeconds
      ? Date.parse(practice.planSetAt) + practice.plannedWindowSeconds * 1000
      : null
  const synchronizedNow = baseServerTime + elapsedMs
  const remainingSeconds = trainingEndMs
    ? Math.max(0, Math.ceil((trainingEndMs - synchronizedNow) / 1000))
    : 0
  const hasPlan = Boolean(
    practice.plannedWindow && practice.planSetAt && practice.plannedWindowSeconds,
  )
  const trainingActive = hasPlan && remainingSeconds > 0
  const currentVisible = hasPlan || settleStoppedReport

  useEffect(() => {
    if (
      !practice.plannedWindow ||
      !trainingEndMs ||
      remainingSeconds > 0 ||
      refreshedEndMs.current === trainingEndMs
    )
      return
    const timer = window.setTimeout(() => {
      refreshedEndMs.current = trainingEndMs
      router.refresh()
    }, 250)
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
      description: 'Best hourly return.',
    },
    {
      window: 'overnight',
      seconds: practice.overnightWindowSeconds,
      description: 'Moderate hourly return.',
    },
    {
      window: 'extended',
      seconds: practice.extendedWindowSeconds,
      description: 'Lowest hourly return.',
    },
  ]

  async function setPlan(window: PracticePlanWindow) {
    if (submittingWindow || stopping || currentVisible || trainingReport) return
    setSubmittingWindow(window)
    setSettledNotice(null)
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
    if (stopping || settleStoppedReport || !trainingActive) return
    setStopping(true)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/wayfarers-practice/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: practice.characterId }),
      })
      const payload = (await response.json()) as {
        stopped?: boolean
        error?: { message?: string }
      }
      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? 'Passive Training could not be stopped.')
        return
      }
      setSettleStoppedReport(payload.stopped === true)
      router.refresh()
    } catch {
      setErrorMessage('Passive Training could not reach the server. Nothing was changed.')
    } finally {
      setStopping(false)
    }
  }

  const progressPercent =
    hasPlan && practice.plannedWindowSeconds
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
    <div
      className={styles.columns}
      data-training-stage={trainingReport ? 'report' : currentVisible ? 'current' : 'plan'}
    >
      {trainingReport ? (
        <aside
          className={styles.reportWorkspace}
          id="training-report-workspace"
          aria-label="Training report workspace"
          tabIndex={-1}
        >
          <TrainingReportCard
            key={trainingReport.reportId}
            report={trainingReport}
            autoClaim={settleStoppedReport}
            onClaimed={() => {
              if (settleStoppedReport)
                setSettledNotice('Training stopped. Your earned progress has been claimed.')
              setSettleStoppedReport(false)
            }}
          />
        </aside>
      ) : !currentVisible ? (
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
              <span className={styles.eyebrow}>Choose your pace</span>
              <h2 id="practice-plan-title">Training Plan</h2>
            </div>
            <span className={styles.badge}>Idle</span>
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
                  <input
                    type="radio"
                    name="training-duration"
                    id={`training-duration-${option.window}`}
                    aria-label={`${passiveTrainingWindowLabel(option.window)} Plan`}
                    checked={selectedWindow === option.window}
                    disabled={submittingWindow !== null || stopping || trainingActive}
                    onChange={() => setSelectedWindow(option.window)}
                  />
                  <div className={styles.windowBody}>
                    <div className={styles.windowHeading}>
                      <label htmlFor={`training-duration-${option.window}`}>
                        {passiveTrainingWindowLabel(option.window)} Plan
                      </label>
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
                  </div>
                </article>
              )
            })}
          </div>
          <GameButton
            className={styles.startButton}
            type="button"
            disabled={submittingWindow !== null || stopping || trainingActive}
            onClick={() => void setPlan(selectedWindow)}
          >
            {submittingWindow ? 'Starting…' : 'Start Training'}
          </GameButton>
          {settledNotice ? (
            <p className={styles.intro} role="status">
              {settledNotice}
            </p>
          ) : null}
          {errorMessage ? (
            <p className={styles.error} role="status">
              {errorMessage}
            </p>
          ) : null}
        </section>
      ) : (
        <section
          className={`${styles.panel} ${styles.activity}`}
          id="training-current"
          data-av-surface="moonstone"
          data-testid="passive-training-active"
          aria-label="Current training activity"
          tabIndex={-1}
        >
          <header className={styles.heading}>
            <div>
              <span className={styles.eyebrow}>In the stillness</span>
              <h2>Current Training</h2>
            </div>
            <span
              className={styles.statusDot}
              data-active={trainingActive || undefined}
              aria-hidden="true"
            />
          </header>
          <div className={styles.activityBody}>
            <div className={styles.activitySummary}>
              <div>
                <span className={styles.eyebrow}>CHARACTER XP</span>
                <h3>
                  {trainingActive
                    ? `${passiveTrainingWindowLabel(practice.plannedWindow!)} Training`
                    : 'Finalizing your report'}
                </h3>
              </div>
              <div className={styles.countdown}>
                <span>{trainingActive ? 'Time remaining' : 'Session ended'}</span>
                <strong>{formatCountdown(remainingSeconds)}</strong>
              </div>
            </div>
            <p className={styles.intro}>
              {trainingActive
                ? 'Training in progress. Your discipline continues while you are away.'
                : 'Waiting for the server to deliver your frozen Training Report.'}
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
              <span>
                {trainingActive ? 'Server-timed session' : 'Awaiting server confirmation'}
              </span>
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
            {trainingActive && !settleStoppedReport ? (
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
            {settleStoppedReport ? (
              <p className={styles.intro} role="status">
                Settling your earned progress…
              </p>
            ) : null}
            {errorMessage ? (
              <p className={styles.error} role="status">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <p className={styles.footnote}>
            The server keeps time. This page does not need to stay open.
          </p>
        </section>
      )}
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
