'use client'

import {
  calculatePassiveTrainingXp,
  getPassiveTrainingXpPerHour,
  passiveTrainingWindowLabel,
} from '@aurevane/game-core/character/wayfarers-practice'
import { GameButton, Kicker } from '@aurevane/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatPracticeDuration } from './training-report-card'
import styles from './practice-plan-card.module.css'

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
}

export function PracticePlanCard({ practice }: PracticePlanCardProps) {
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

  return (
    <section
      className={styles.card}
      data-testid="practice-plan-card"
      aria-labelledby="practice-plan-title"
    >
      <div className={styles.heading}>
        <div>
          <Kicker marker="◇">Training Plan</Kicker>
          <h2 id="practice-plan-title">Choose a training duration.</h2>
        </div>
        <span>{trainingActive ? 'Training active' : 'Idle'}</span>
      </div>

      {trainingActive && practice.plannedWindow ? (
        <div className={styles.activeTraining} data-testid="passive-training-active">
          <div>
            <span>Training now</span>
            <strong>{passiveTrainingWindowLabel(practice.plannedWindow)}</strong>
          </div>
          <div>
            <span>Time remaining</span>
            <strong>{formatCountdown(remainingSeconds)}</strong>
          </div>
          <div>
            <span>Completion reward</span>
            <strong>+{calculatePassiveTrainingXp(practice.plannedWindow)} XP</strong>
          </div>
          <GameButton
            type="button"
            variant="quiet"
            disabled={stopping}
            onClick={() => void stopTraining()}
          >
            {stopping ? 'Stopping…' : 'Stop Training'}
          </GameButton>
        </div>
      ) : (
        <p className={styles.intro}>
          Training does not start automatically. Pick Short, Medium, or Extended and the server
          starts the timer immediately. You can stay signed in; browser activity does not change the
          reward clock.
        </p>
      )}

      <div className={styles.windowGrid} aria-label="Passive Training durations">
        {windows.map((option) => {
          const rate = getPassiveTrainingXpPerHour(option.window)
          const reward = calculatePassiveTrainingXp(option.window)
          const selected = practice.plannedWindow === option.window
          return (
            <div className={styles.window} key={option.window} data-active={selected || undefined}>
              <div>
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
          )
        })}
      </div>

      <p className={styles.note}>
        While training is active, new Battle Hall fights are disabled. Profile, account, reference
        pages, Online Users, and social/chat surfaces remain available. If you stop early, the
        server awards the XP earned for the completed fraction of the training time; the unfinished
        fraction earns nothing.
      </p>

      {errorMessage ? (
        <p className={styles.error} role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
    </section>
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
