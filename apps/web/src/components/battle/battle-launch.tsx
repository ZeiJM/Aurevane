'use client'

import type { TacticalHallArenaId } from '@aurevane/game-core/combat/tactical-hall-arenas'
import {
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
  'recruit-sparring',
  'movement-drill',
  'strike-drill',
  'guard-drill',
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
      summary: 'Full duel arena with rough terrain, elevation, and flanking room.',
    },
  ]

const DIFFICULTIES: readonly { id: AiDifficulty; label: string; description: string }[] = [
  { id: 'easy', label: 'Easy', description: 'Forgiving AI decisions.' },
  { id: 'standard', label: 'Standard', description: 'Balanced AI opponent.' },
  { id: 'high', label: 'High', description: 'Sharper positioning and action choices.' },
]

const FUTURE_MATCHES = [
  { label: '1v1', detail: 'Player duel' },
  { label: '2v2', detail: 'Small-team battle' },
  { label: '3v3', detail: 'Full-team skirmish' },
] as const

function recordDisplayName(recordId: TacticalHallRecordId, fallback: string): string {
  return recordId === 'recruit-sparring' ? 'AI Sparring' : fallback
}

export function BattleLaunch({ characterId }: BattleLaunchProps) {
  const router = useRouter()
  const launchLock = useRef(false)
  const [recordId, setRecordId] = useState<TacticalHallRecordId | null>(null)
  const [arenaId, setArenaId] = useState<TacticalHallArenaId>('duel-yard')
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('standard')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedRecord = recordId ? getTacticalHallRecord(recordId) : null
  const selectedArena = ARENAS.find((arena) => arena.id === arenaId) ?? ARENAS[1]
  const visibleRecords = VISIBLE_RECORD_IDS.map((id) => getTacticalHallRecord(id))

  function chooseRecord(nextRecordId: TacticalHallRecordId) {
    const nextRecord = getTacticalHallRecord(nextRecordId)
    setRecordId(nextRecordId)
    setArenaId(nextRecord.defaultArenaId)
    setError(null)
  }

  async function launchBattle() {
    if (!selectedRecord || launchLock.current || pending) return
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
    <section className={styles.page} id="battle-launch" aria-labelledby="battle-launch-title">
      <div className={styles.vista} aria-hidden="true">
        <AurevaneImage assetId="ui.foundation.vista" className={styles.vistaImage} />
      </div>
      <div className={styles.content}>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Battle Hall</p>
            <h1 id="battle-launch-title">Choose a battle.</h1>
          </div>
          <p>Select a training mode. Nothing is preselected.</p>
        </header>

        <nav className={styles.recordGrid} aria-label="Choose Battle Hall battle">
          {visibleRecords.map((record) => (
            <button
              key={record.id}
              type="button"
              className={`${styles.recordChoice} ${recordId === record.id ? styles.recordChoiceSelected : ''}`}
              onClick={() => chooseRecord(record.id)}
              disabled={pending}
              aria-pressed={recordId === record.id}
            >
              <span>{record.id === 'recruit-sparring' ? 'AI Battle' : 'Training'}</span>
              <strong>{recordDisplayName(record.id, record.name)}</strong>
              <small>{record.purpose}</small>
            </button>
          ))}
        </nav>

        <section className={styles.selectedPanel} data-empty={!selectedRecord || undefined}>
          {selectedRecord ? (
            <>
              <div className={styles.selectedCopy}>
                <span>Selected battle</span>
                <h2>{recordDisplayName(selectedRecord.id, selectedRecord.name)}</h2>
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
                  <legend>AI difficulty</legend>
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
            </>
          ) : (
            <div className={styles.neutralSelection}>
              <span>Battle selection</span>
              <h2>No mode selected</h2>
              <p>Choose any option above to configure the arena.</p>
            </div>
          )}

          <button
            type="button"
            className={styles.startButton}
            onClick={() => void launchBattle()}
            disabled={pending || !selectedRecord}
          >
            {pending ? 'Entering…' : 'Enter Battle'}
          </button>
        </section>

        <section className={styles.futureModes} aria-label="Future player battle modes">
          <div>
            <span>Player sparring</span>
            <strong>Multiplayer battle shell</strong>
          </div>
          {FUTURE_MATCHES.map((mode) => (
            <button key={mode.label} type="button" disabled>
              <strong>{mode.label}</strong>
              <small>{mode.detail} · coming later</small>
            </button>
          ))}
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
