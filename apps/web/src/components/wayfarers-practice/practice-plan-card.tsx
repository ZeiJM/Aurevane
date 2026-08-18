'use client'

import { GameButton, Kicker } from '@aurevane/ui'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

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

const LABELS: Record<PracticePlanWindow, string> = {
  short: 'Short',
  overnight: 'Overnight',
  extended: 'Extended',
}

export function PracticePlanCard({ practice }: PracticePlanCardProps) {
  const router = useRouter()
  const [submittingWindow, setSubmittingWindow] = useState<PracticePlanWindow | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const retryKey = useRef<{ window: PracticePlanWindow; key: string } | null>(null)

  const windows: readonly { window: PracticePlanWindow; seconds: number; description: string }[] = [
    { window: 'short', seconds: practice.shortWindowSeconds, description: 'A few hours away.' },
    {
      window: 'overnight',
      seconds: practice.overnightWindowSeconds,
      description: 'A normal sleep or overnight absence.',
    },
    {
      window: 'extended',
      seconds: practice.extendedWindowSeconds,
      description: 'A longer day-away plan.',
    },
  ]

  async function setPlan(window: PracticePlanWindow) {
    if (submittingWindow) return
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
        setErrorMessage(payload.error?.message ?? "Wayfarer's Practice could not be set.")
        return
      }
      retryKey.current = null
      router.refresh()
    } catch {
      setErrorMessage("Wayfarer's Practice could not reach the server. You can safely try again.")
    } finally {
      setSubmittingWindow(null)
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
          <Kicker marker="◇">Practice Plan</Kicker>
          <h2 id="practice-plan-title">How long do you expect to be away?</h2>
        </div>
        <span>{practice.plannedWindow ? 'Plan set' : 'Balanced default'}</span>
      </div>

      <p className={styles.intro}>
        Choose the window that best matches your next absence. It is only a planning estimate—not a
        countdown or a promise. The server credits the time you were genuinely offline, and Balanced
        Practice still applies safely if you leave without setting anything.
      </p>

      <dl className={styles.status}>
        <div>
          <dt>Next practice</dt>
          <dd>
            {practice.plannedWindow && practice.plannedWindowSeconds
              ? `${LABELS[practice.plannedWindow]} · ${formatPracticeDuration(practice.plannedWindowSeconds)}`
              : 'Automatic Balanced Practice'}
          </dd>
        </div>
        <div>
          <dt>Offline threshold</dt>
          <dd>{formatPracticeDuration(practice.minimumOfflineSeconds)}</dd>
        </div>
        <div>
          <dt>Rested Momentum</dt>
          <dd>{practice.restedMomentumBalance.toLocaleString('en-US')}</dd>
        </div>
      </dl>

      <div className={styles.windowGrid} aria-label="Wayfarer's Practice plan windows">
        {windows.map((option) => (
          <div className={styles.window} key={option.window}>
            <div>
              <strong>{LABELS[option.window]}</strong>
              <span>{formatPracticeDuration(option.seconds)}</span>
            </div>
            <p>{option.description}</p>
            <GameButton
              type="button"
              variant={practice.plannedWindow === option.window ? 'quiet' : 'primary'}
              disabled={submittingWindow !== null}
              onClick={() => void setPlan(option.window)}
            >
              {submittingWindow === option.window
                ? 'Setting…'
                : practice.plannedWindow === option.window
                  ? `${LABELS[option.window]} set`
                  : `Set ${LABELS[option.window]}`}
            </GameButton>
          </div>
        ))}
      </div>

      <p className={styles.note}>
        Return early and you receive credit only for the eligible time actually away. Stay away
        longer and remaining eligible time safely falls back to Balanced Practice. No browser clock
        can manufacture progress.
      </p>

      {errorMessage ? (
        <p className={styles.error} role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}
