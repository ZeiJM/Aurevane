'use client'

import type { TacticalHallArenaId } from '@aurevane/game-core/combat/tactical-hall-arenas'
import {
  P2_7_TACTICAL_HALL_RECORDS,
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'

import styles from './battle-launch.module.css'

interface BattleLaunchProps {
  characterId: string
  characterName: string
}

const VISIBLE_RECORD_IDS: readonly TacticalHallRecordId[] = [
  'movement-drill',
  'strike-drill',
  'guard-drill',
  'recruit-sparring',
]

const ARENAS: readonly {
  id: TacticalHallArenaId
  name: string
  scale: string
  summary: string
}[] = [
  {
    id: 'basic-training-floor',
    name: 'Basic Training Floor',
    scale: '5×3',
    summary: 'Compact teaching floor for the focused drills.',
  },
  {
    id: 'duel-yard',
    name: 'Duel Yard',
    scale: '9×7',
    summary: 'Full duel arena with approach space, rough terrain, elevation, and flanking room.',
  },
]

export function BattleLaunch({ characterId, characterName }: BattleLaunchProps) {
  const router = useRouter()
  const launchLock = useRef(false)
  const [recordId, setRecordId] = useState<TacticalHallRecordId>('recruit-sparring')
  const [arenaId, setArenaId] = useState<TacticalHallArenaId>('duel-yard')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedRecord = getTacticalHallRecord(recordId)
  const selectedArena = ARENAS.find((arena) => arena.id === arenaId) ?? ARENAS[1]
  const visibleRecords = P2_7_TACTICAL_HALL_RECORDS.filter((record) =>
    VISIBLE_RECORD_IDS.includes(record.id),
  )

  function chooseRecord(nextRecordId: TacticalHallRecordId) {
    const nextRecord = getTacticalHallRecord(nextRecordId)
    setRecordId(nextRecordId)
    setArenaId(nextRecord.defaultArenaId)
    setError(null)
  }

  async function launchBattle() {
    if (launchLock.current || pending) return
    launchLock.current = true
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          arenaId,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as {
        battle?: { battleSessionId?: string }
        error?: { message?: string }
      }
      if (!response.ok || !body.battle?.battleSessionId) {
        throw new Error(body.error?.message ?? 'The battle could not be started.')
      }
      sessionStorage.setItem(
        `aurevane:tactical-record:${body.battle.battleSessionId}`,
        selectedRecord.id,
      )
      router.push(`/game/battle/${body.battle.battleSessionId}`)
    } catch (launchError) {
      setError(
        launchError instanceof Error ? launchError.message : 'The battle could not be started.',
      )
      setPending(false)
      launchLock.current = false
    }
  }

  return (
    <main className={styles.page}>
      <a className="skip-link" href="#battle-launch">
        Skip to battle launch
      </a>
      <section id="battle-launch" className={styles.panel} aria-labelledby="battle-launch-title">
        <div className={styles.vista} aria-hidden="true">
          <AurevaneImage assetId="ui.foundation.vista" className={styles.vistaImage} />
        </div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Tactical Hall</p>
          <h1 id="battle-launch-title">Choose a practice</h1>
          <p className={styles.lede}>
            {characterName}, start with a short lesson or enter Recruit Sparring for the full tactical
            loop. The highlighted card is what will launch.
          </p>

          <nav className={styles.recordGrid} aria-label="Choose Tactical Hall practice">
            {visibleRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                className={`${styles.recordChoice} ${recordId === record.id ? styles.recordChoiceSelected : ''}`}
                onClick={() => chooseRecord(record.id)}
                disabled={pending}
                aria-pressed={recordId === record.id}
              >
                <span>{record.combinedDuel ? 'FULL DUEL' : 'GUIDED LESSON'}</span>
                <strong>{record.name}</strong>
                <small>{record.purpose}</small>
                {recordId === record.id ? <b>SELECTED ✓</b> : null}
              </button>
            ))}
          </nav>

          <section className={styles.record} aria-labelledby="selected-record-title">
            <div className={styles.recordHeading}>
              <div>
                <span>Selected practice</span>
                <h2 id="selected-record-title">{selectedRecord.name}</h2>
              </div>
              <strong>{selectedArena.name}</strong>
            </div>

            <ol className={styles.steps}>
              {selectedRecord.coachSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {selectedRecord.combinedDuel ? (
              <div className={styles.arenaChoice}>
                <div>
                  <strong>{selectedArena.name}</strong>
                  <span>
                    {selectedArena.scale} · {selectedArena.summary}
                  </span>
                </div>
                <span className={styles.arenaLocked}>Sparring arena</span>
              </div>
            ) : (
              <p className={styles.floorNote}>
                Focused lessons use the {selectedArena.name} ({selectedArena.scale}) so the concept is
                easy to see before the larger duel.
              </p>
            )}
          </section>

          <div className={styles.rules} aria-label="Exercise rules">
            <span>Server-authoritative actions</span>
            <span>No progression rewards</span>
            <span>Abort anytime</span>
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.launchActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void launchBattle()}
              disabled={pending}
            >
              {pending ? 'Opening practice…' : `Start ${selectedRecord.name}`}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => router.push('/game')}
              disabled={pending}
            >
              Return to Wayfarer
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
