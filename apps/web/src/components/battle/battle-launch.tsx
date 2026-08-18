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

type AiDifficulty = 'easy' | 'standard' | 'high'

const VISIBLE_RECORD_IDS: readonly TacticalHallRecordId[] = [
  'movement-drill',
  'strike-drill',
  'guard-drill',
  'recruit-sparring',
]

const ARENAS: readonly { id: TacticalHallArenaId; name: string; scale: string; summary: string }[] =
  [
    {
      id: 'basic-training-floor',
      name: 'Basic Training Floor',
      scale: '5×3',
      summary: 'Compact teaching floor for focused drills.',
    },
    {
      id: 'duel-yard',
      name: 'Duel Yard',
      scale: '9×7',
      summary: 'Full duel arena with approach space, rough terrain, elevation, and flanking room.',
    },
  ]

const DIFFICULTIES: readonly { id: AiDifficulty; label: string; description: string }[] = [
  { id: 'easy', label: 'Easy', description: 'Slower, forgiving Recruit decisions.' },
  { id: 'standard', label: 'Standard', description: 'Balanced Tactical Hall opponent.' },
  { id: 'high', label: 'High', description: 'Sharper positioning and action choices.' },
]

export function BattleLaunch({ characterId, characterName }: BattleLaunchProps) {
  const router = useRouter()
  const launchLock = useRef(false)
  const [recordId, setRecordId] = useState<TacticalHallRecordId>('recruit-sparring')
  const [arenaId, setArenaId] = useState<TacticalHallArenaId>('duel-yard')
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('standard')
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
          aiDifficulty: selectedRecord.combinedDuel ? aiDifficulty : 'easy',
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as {
        battle?: { battleSessionId?: string }
        error?: { message?: string }
      }
      if (!response.ok || !body.battle?.battleSessionId) {
        throw new Error(body.error?.message ?? 'The practice could not be started.')
      }
      sessionStorage.setItem(
        `aurevane:tactical-record:${body.battle.battleSessionId}`,
        selectedRecord.id,
      )
      router.push(`/game/battle/${body.battle.battleSessionId}`)
    } catch (launchError) {
      setError(
        launchError instanceof Error ? launchError.message : 'The practice could not be started.',
      )
      setPending(false)
      launchLock.current = false
    }
  }

  return (
    <section className={styles.page} id="battle-launch" aria-labelledby="battle-launch-title">
      <div className={styles.vista} aria-hidden="true">
        <AurevaneImage assetId="ui.foundation.vista" className={styles.vistaImage} />
      </div>
      <div className={styles.content}>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Tactical Hall</p>
            <h1 id="battle-launch-title">Choose a practice</h1>
          </div>
          <p>
            {characterName}, choose a focused lesson or a full Recruit duel. The highlighted card
            launches.
          </p>
        </header>

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
              <span>{record.combinedDuel ? 'Full Duel' : 'Guided Lesson'}</span>
              <strong>{record.name}</strong>
              <small>{record.purpose}</small>
            </button>
          ))}
        </nav>

        <section className={styles.selectedPanel}>
          <div className={styles.selectedCopy}>
            <span>Selected practice</span>
            <h2>{selectedRecord.name}</h2>
            <p>{selectedRecord.coachSteps[0]}</p>
            <div className={styles.arenaLine}>
              <strong>{selectedArena.name}</strong>
              <span>
                {selectedArena.scale} · {selectedArena.summary}
              </span>
            </div>
          </div>

          {selectedRecord.combinedDuel ? (
            <fieldset className={styles.difficulty}>
              <legend>Recruit AI</legend>
              <div className={styles.difficultyToggle}>
                {DIFFICULTIES.map((difficulty) => (
                  <button
                    key={difficulty.id}
                    type="button"
                    aria-pressed={aiDifficulty === difficulty.id}
                    data-selected={aiDifficulty === difficulty.id || undefined}
                    onClick={() => setAiDifficulty(difficulty.id)}
                    disabled={pending}
                  >
                    {difficulty.label}
                  </button>
                ))}
              </div>
              <small>
                {DIFFICULTIES.find((difficulty) => difficulty.id === aiDifficulty)?.description}
              </small>
            </fieldset>
          ) : null}

          <button
            type="button"
            className={styles.startButton}
            onClick={() => void launchBattle()}
            disabled={pending}
          >
            {pending ? 'Opening…' : `Start ${selectedRecord.name}`}
          </button>
        </section>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
