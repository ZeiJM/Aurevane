'use client'

import {
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import { useSyncExternalStore } from 'react'

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

const DEFAULT_RECORD_ID: TacticalHallRecordId = 'recruit-sparring'
const COACH_STORE_EVENT = 'aurevane:tactical-coach-changed'

function isRecordId(value: string | null): value is TacticalHallRecordId {
  return value !== null && VALID_RECORD_IDS.includes(value as TacticalHallRecordId)
}

function subscribeCoachStore(onStoreChange: () => void): () => void {
  window.addEventListener(COACH_STORE_EVENT, onStoreChange)
  return () => window.removeEventListener(COACH_STORE_EVENT, onStoreChange)
}

function recordSnapshot(battleSessionId: string): TacticalHallRecordId {
  const stored = sessionStorage.getItem(`aurevane:tactical-record:${battleSessionId}`)
  return isRecordId(stored) ? stored : DEFAULT_RECORD_ID
}

function dismissedSnapshot(battleSessionId: string): boolean {
  return sessionStorage.getItem(`aurevane:tactical-coach-dismissed:${battleSessionId}`) === '1'
}

export function BattleLessonCoach({ battleSessionId }: BattleLessonCoachProps) {
  const recordId = useSyncExternalStore(
    subscribeCoachStore,
    () => recordSnapshot(battleSessionId),
    () => DEFAULT_RECORD_ID,
  )
  const dismissed = useSyncExternalStore(
    subscribeCoachStore,
    () => dismissedSnapshot(battleSessionId),
    () => false,
  )

  if (dismissed) return null

  const record = getTacticalHallRecord(recordId)

  return (
    <aside
      className={styles.anchor}
      aria-label="Tactical Hall lesson"
      data-testid="battle-lesson-coach"
    >
      <details className={styles.coach}>
        <summary>
          <span>Guide</span>
          <strong>{record.name}</strong>
        </summary>
        <div className={styles.body}>
          <p>{record.purpose}</p>
          <ol>
            {record.coachSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => {
              sessionStorage.setItem(`aurevane:tactical-coach-dismissed:${battleSessionId}`, '1')
              window.dispatchEvent(new Event(COACH_STORE_EVENT))
            }}
          >
            Hide this guide for this battle
          </button>
        </div>
      </details>
    </aside>
  )
}
