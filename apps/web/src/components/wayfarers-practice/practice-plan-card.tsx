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
    { window: 'overnight', seconds: practice.overnightWindowSeconds, description: 'A normal overnight absence.' },
    { window: 'extended', seconds: practice.extendedWindowSeconds, description: 'A longer day-away plan.' },
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
        setErrorMessage(payload.error?.message ?? 'The offline training plan could not be set.')
        return
      }
      retryKey.current = null
      router.refresh()
    } catch {
      setErrorMessage('The offline training plan could not reach the server. You can safely try again.')
    } finally {
      setSubmittingWindow(null)
    }
  }

  return (
    <section className={styles.card} data-testid="practice-plan-card" aria-labelledby="practice-plan-title">
      <div className={styles.heading}>
        <div>
          <Kicker marker="◇">Offline Training Plan</Kicker>
          <h2 id="practice-plan-title">Choose an absence plan</h2>
        </div>
        <span>{practice.plannedWindow ? 'Plan set' : 'Balanced default'}</span>
      </div>

      <p className={styles.intro}>
        Pick roughly how long you expect to be away. This is not a timer you must wait through:
        the server measures your real absence after you leave and credits only legitimate elapsed time.
      </p>

      <dl className={styles.status}>
        <div>
          <dt>Next absence</dt>
          <dd>
            {practice.plannedWindow && practice.plannedWindowSeconds
              ? `${LABELS[practice.plannedWindow]} · ${formatPracticeDuration(practice.plannedWindowSeconds)}`
              : 'Automatic Balanced Training'}
          </dd>
        </div>
        <div>
          <dt>Training begins after</dt>
          <dd>{formatPracticeDuration(practice.minimumOfflineSeconds)} offline</dd>
        </div>
        <div>
          <dt>Rested Momentum stored</dt>
          <dd>{practice.restedMomentumBalance.toLocaleString('en-US')}</dd>
        </div>
      </dl>

      <div className={styles.windowGrid} aria-label="Offline Training plan windows">
        {windows.map((option) => (
          <div className={styles.window} key={option.window}>
            <div><strong>{LABELS[option.window]}</strong><span>{formatPracticeDuration(option.seconds)}</span></div>
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
        Returning earlier simply credits less time. Staying away longer safely falls back to Balanced
        Training for any remaining eligible time. The plan is consumed when the next Training Report is created.
      </p>

      {errorMessage ? <p className={styles.error} role="status" aria-live="polite">{errorMessage}</p> : null}
    </section>
  )
}
