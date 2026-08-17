'use client'

import { GameButton, Kicker } from '@aurevane/ui'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import styles from './training-report-card.module.css'

export type TrainingReportPracticeWindow = 'short' | 'overnight' | 'extended'

export interface TrainingReportCardData {
  reportId: string
  characterId: string
  practiceSource: 'automatic_balanced' | 'planned_balanced'
  plannedWindow: TrainingReportPracticeWindow | null
  plannedWindowSeconds: number | null
  plannedElapsedSeconds: number
  balancedFallbackSeconds: number
  elapsedSeconds: number
  creditedPracticeSeconds: number
  requestedCharacterXp: number
  restedMomentumGain: number
  directXpCapReached: boolean
  restedMomentumCapReached: boolean
}

interface TrainingReportCardProps {
  report: TrainingReportCardData
}

export function TrainingReportCard({ report }: TrainingReportCardProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const idempotencyKey = useRef<string | null>(null)

  async function claimTraining() {
    if (submitting) {
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    idempotencyKey.current ??= crypto.randomUUID()

    try {
      const response = await fetch('/api/wayfarers-practice/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          characterId: report.characterId,
          reportId: report.reportId,
          idempotencyKey: idempotencyKey.current,
        }),
      })
      const payload = (await response.json()) as {
        error?: { message?: string }
      }

      if (!response.ok) {
        setErrorMessage(payload.error?.message ?? 'The Training Report could not be claimed.')
        return
      }

      router.refresh()
    } catch {
      setErrorMessage('The Training Report could not reach the server. You can safely try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const planLabel = report.plannedWindow ? practiceWindowLabel(report.plannedWindow) : null

  return (
    <section className={styles.report} data-testid="training-report">
      <div className={styles.heading}>
        <div>
          <Kicker marker="◇">Wayfarer&apos;s Practice</Kicker>
          <h2>Training Report</h2>
        </div>
        <span>{planLabel ? `Planned ${planLabel}` : 'Automatic Balanced'}</span>
      </div>

      <p className={styles.intro}>
        While you were away, your character kept to a modest routine of practice, study, and
        reflection. This report is frozen and will wait until you are ready to claim it.
      </p>

      <dl className={styles.rewards}>
        <div>
          <dt>Absence measured</dt>
          <dd>{formatPracticeDuration(report.elapsedSeconds)}</dd>
        </div>
        <div>
          <dt>Practice time credited</dt>
          <dd>{formatPracticeDuration(report.creditedPracticeSeconds)}</dd>
        </div>
        <div>
          <dt>Character XP</dt>
          <dd>+{report.requestedCharacterXp.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Rested Momentum</dt>
          <dd>+{report.restedMomentumGain.toLocaleString('en-US')}</dd>
        </div>
      </dl>

      {report.practiceSource === 'planned_balanced' && planLabel && report.plannedWindowSeconds ? (
        <p className={styles.capNote} data-testid="practice-plan-provenance">
          {`Your ${planLabel} plan covered ${formatPracticeDuration(report.plannedElapsedSeconds)} of this absence. `}
          {report.plannedElapsedSeconds < report.plannedWindowSeconds
            ? 'You returned before the planned window ended, so only legitimate elapsed time was counted. '
            : ''}
          {report.balancedFallbackSeconds > 0
            ? `${formatPracticeDuration(report.balancedFallbackSeconds)} beyond the plan continued automatically as Balanced Practice. `
            : ''}
          The explicit plan is now consumed; a later unplanned absence returns to Balanced Practice.
        </p>
      ) : (
        <p className={styles.capNote} data-testid="practice-plan-provenance">
          No explicit plan was active, so this absence used automatic Balanced Practice.
        </p>
      )}

      {report.directXpCapReached || report.restedMomentumCapReached ? (
        <p className={styles.capNote}>
          {report.directXpCapReached ? 'The direct practice bank reached its current cap. ' : ''}
          {report.restedMomentumCapReached
            ? 'Rested Momentum also reached its current practice cap.'
            : ''}
        </p>
      ) : null}

      <div className={styles.actions}>
        <GameButton disabled={submitting} onClick={claimTraining} type="button">
          {submitting ? 'Claiming…' : 'Claim training'}
        </GameButton>
        <span>Claims do not expire and cannot be duplicated by refreshing or retrying.</span>
      </div>

      {errorMessage ? (
        <p className={styles.error} role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}

export function formatPracticeDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(safeSeconds / 86400)
  const hours = Math.floor((safeSeconds % 86400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function practiceWindowLabel(window: TrainingReportPracticeWindow): string {
  switch (window) {
    case 'short':
      return 'Short'
    case 'overnight':
      return 'Overnight'
    case 'extended':
      return 'Extended'
  }
}
