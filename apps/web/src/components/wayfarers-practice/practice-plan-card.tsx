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
    {
      window: 'short',
      seconds: practice.shortWindowSeconds,
      description: 'A few hours away.',
    },
    {
      window: 'overnight',
      seconds: practice.overnightWindowSeconds,
      description: 'The normal before-bed plan.',
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
        setErrorMessage(payload.error?.message ?? 'The Practice plan could not be set.')
        return
      }

      retryKey.current = null
      router.refresh()
    } catch {
      setErrorMessage('The Practice plan could not reach the server. You can safely try again.')
    } finally {
      setSubmittingWindow(null)
    }
  }

  return (
    <section className={styles.card} data-testid="practice-plan-card" aria-labelledby="practice-plan-title">
      <div className={styles.heading}>
        <div>
          <Kicker marker="◇">Character → Training</Kicker>
          <h2 id="practice-plan-title">Wayfarer&apos;s Practice</h2>
        </div>
        <span>{practice.plannedWindow ? 'Plan set' : 'Balanced default'}</span>
      </div>

      <p className={styles.intro}>
        Practice begins only after a meaningful server-measured absence. Active play never waits on
        this timer, and changing your browser clock or timezone cannot create progress.
      </p>

      <dl className={styles.status}>
        <div>
          <dt>Next absence</dt>
          <dd>
            {practice.plannedWindow && practice.plannedWindowSeconds
              ? `${LABELS[practice.plannedWindow]} · ${formatPracticeDuration(practice.plannedWindowSeconds)}`
              : 'Automatic Balanced Practice'}
          </dd>
        </div>
        <div>
          <dt>Meaningful absence</dt>
          <dd>After {formatPracticeDuration(practice.minimumOfflineSeconds)}</dd>
        </div>
        <div>
          <dt>Rested Momentum stored</dt>
          <dd>{practice.restedMomentumBalance.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Server state checked</dt>
          <dd>{formatServerTimestamp(practice.serverNow)}</dd>
        </div>
      </dl>

      <div className={styles.windowGrid} aria-label="Planned Practice windows">
        {windows.map((option) => (
          <div className={styles.window} key={option.window}>
            <div>
              <strong>{LABELS[option.window]}</strong>
              <span>{formatPracticeDuration(option.seconds)}</span>
            </div>
            <p>{option.description}</p>
            <GameButton
              type="button"
              variant={practice.plannedWindow === option.window ? 'quiet' : undefined}
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
        A plan applies once to the next meaningful absence. Returning early credits only the time
        you were actually away. If you stay away longer than the selected window, the remaining
        eligible time automatically continues as Balanced Practice. After that Training Report is
        generated, the explicit plan is consumed.
      </p>

      {practice.planSetAt ? (
        <p className={styles.planMeta}>Current plan recorded by the server at {formatServerTimestamp(practice.planSetAt)}.</p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}

function formatServerTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Server time unavailable'
  return `${new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`
}
