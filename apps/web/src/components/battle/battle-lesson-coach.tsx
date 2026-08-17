'use client'

import {
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import { useEffect, useState } from 'react'

import styles from './battle-lesson-coach.module.css'

interface BattleLessonCoachProps {
  battleSessionId: string
}

const VALID_RECORD_IDS: readonly TacticalHallRecordId[] = [
  'movement-drill',
  'strike-drill',
  'guard-drill',
  'facing-drill',
  'recruit-sparring',
]

function isRecordId(value: string | null): value is TacticalHallRecordId {
  return value !== null && VALID_RECORD_IDS.includes(value as TacticalHallRecordId)
}

export function BattleLessonCoach({ battleSessionId }: BattleLessonCoachProps) {
  const [recordId, setRecordId] = useState<TacticalHallRecordId>('recruit-sparring')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`aurevane:tactical-record:${battleSessionId}`)
    if (isRecordId(stored)) setRecordId(stored)
    setDismissed(
      sessionStorage.getItem(`aurevane:tactical-coach-dismissed:${battleSessionId}`) === '1',
    )
  }, [battleSessionId])

  if (dismissed) return null

  const record = getTacticalHallRecord(recordId)

  return (
    <aside
      className={styles.coach}
      aria-label="Tactical Hall lesson"
      data-testid="battle-lesson-coach"
    >
      <div className={styles.heading}>
        <div>
          <span>Guided Tactical Record</span>
          <strong>{record.name}</strong>
        </div>
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => {
            sessionStorage.setItem(`aurevane:tactical-coach-dismissed:${battleSessionId}`, '1')
            setDismissed(true)
          }}
        >
          Dismiss
        </button>
      </div>
      <p>{record.purpose}</p>
      <ol>
        {record.coachSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </aside>
  )
}
