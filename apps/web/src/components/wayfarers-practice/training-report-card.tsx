'use client'

import { passiveTrainingWindowLabel } from '@aurevane/game-core/character/wayfarers-practice'
import { GameButton, Kicker } from '@aurevane/ui'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import styles from './training-report-card.module.css'

export type TrainingReportPracticeWindow = 'short' | 'overnight' | 'extended'

export interface TrainingReportCardData {
  reportId: string
  characterId: string
  practiceSource: 'automatic_balanced' | 'planned_balanced' | 'passive_training'
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
    if (submitting) return
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
      const payload = (await response.json()) as { error?: { message?: string } }
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

  const passive = report.practiceSource === 'passive_training'
  const planLabel = report.plannedWindow ? passiveTrainingWindowLabel(report.plannedWindow) : null

  return (
    <section className={styles.report} data-testid="training-report">
      <div className={styles.heading}>
        <div>
          <Kicker marker="◇">{passive ? 'Passive Training' : 'Legacy Training'}</Kicker>
          <h2>{passive ? 'Training Complete' : 'Training Report'}</h2>
        </div>
        <span>{planLabel ? `${planLabel} complete` : 'Legacy report'}</span>
      </div>

      {passive ? (
        <>
          <p className={styles.intro}>
            The server completed this training block. The reward is frozen until you claim it.
          </p>
          <dl className={styles.rewards} data-testid="passive-training-reward">
            <div>
              <dt>Training duration</dt>
              <dd>{formatPracticeDuration(report.elapsedSeconds)}</dd>
            </div>
            <div>
              <dt>Character XP</dt>
              <dd>+{report.requestedCharacterXp.toLocaleString('en-US')}</dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <p className={styles.intro}>
            This report was created under the earlier offline-practice rules. It remains frozen and
            safe to claim; new training now uses explicit Passive Training plans.
          </p>
          <dl className={styles.rewards}>
            <div>
              <dt>Time measured</dt>
              <dd>{formatPracticeDuration(report.elapsedSeconds)}</dd>
            </div>
            <div>
              <dt>Training credited</dt>
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
          <p className={styles.capNote} data-testid="practice-plan-provenance">
            Legacy training provenance is preserved for this already-created report.
          </p>
        </>
      )}

      <div className={styles.actions}>
        <GameButton disabled={submitting} onClick={claimTraining} type="button">
          {submitting ? 'Claiming…' : 'Claim Training'}
        </GameButton>
        <span>Claims are idempotent: refreshing or retrying cannot duplicate the reward.</span>
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
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
