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
type PvpModeId = '1v1' | '2v2' | '3v3' | '1v1v1' | 'flex-teams'

const VISIBLE_RECORD_IDS: readonly TacticalHallRecordId[] = [
  'recruit-sparring',
  'guided-fundamentals',
]

const ARENAS: readonly { id: TacticalHallArenaId; name: string; scale: string; summary: string }[] =
  [
    {
      id: 'basic-training-floor',
      name: 'Basic Training Floor',
      scale: '5×3',
      summary: 'Compact teaching floor for the guided fundamentals exercise.',
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

const PVP_MODES: readonly {
  id: PvpModeId
  label: string
  detail: string
  lobby: string
}[] = [
  { id: '1v1', label: '1v1', detail: 'Standard player duel', lobby: '2 players · 1 per side' },
  { id: '2v2', label: '2v2', detail: 'Small-team battle', lobby: '4 players · 2 per side' },
  { id: '3v3', label: '3v3', detail: 'Full-team skirmish', lobby: '6 players · 3 per side' },
  {
    id: '1v1v1',
    label: '1v1v1',
    detail: 'Three-way battle',
    lobby: '3 players · 3 opposing sides',
  },
  {
    id: 'flex-teams',
    label: '1–3 vs 1–3',
    detail: 'Flexible team battle',
    lobby: '2–6 players · 1–3 per side',
  },
]

function recordDisplayName(recordId: TacticalHallRecordId, fallback: string): string {
  return recordId === 'recruit-sparring' ? 'AI Sparring' : fallback
}

export function BattleLaunch({ characterId, characterName }: BattleLaunchProps) {
  const router = useRouter()
  const launchLock = useRef(false)
  const [recordId, setRecordId] = useState<TacticalHallRecordId | null>(null)
  const [arenaId, setArenaId] = useState<TacticalHallArenaId>('duel-yard')
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('standard')
  const [pvpMode, setPvpMode] = useState<PvpModeId | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedRecord = recordId ? getTacticalHallRecord(recordId) : null
  const selectedArena = ARENAS.find((arena) => arena.id === arenaId) ?? ARENAS[1]
  const visibleRecords = VISIBLE_RECORD_IDS.map((id) => getTacticalHallRecord(id))
  const selectedPvp = PVP_MODES.find((mode) => mode.id === pvpMode) ?? null

  function chooseRecord(nextRecordId: TacticalHallRecordId) {
    const nextRecord = getTacticalHallRecord(nextRecordId)
    setRecordId(nextRecordId)
    setArenaId(nextRecord.defaultArenaId)
    setPvpMode(null)
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
          battleHallRecordId: selectedRecord.id,
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
          <p>Practice now. PvP and public viewing are staged here for their dedicated rollout.</p>
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

        <section className={styles.pvpSection} aria-labelledby="pvp-shell-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span>Player sparring</span>
              <strong id="pvp-shell-heading">Choose a future lobby format</strong>
            </div>
            <small>
              Lobby structure is visible now; matchmaking and PvP authority arrive in the PvP phase.
            </small>
          </div>
          <div className={styles.pvpModes}>
            {PVP_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-selected={pvpMode === mode.id || undefined}
                onClick={() => {
                  setPvpMode(mode.id)
                  setRecordId(null)
                }}
              >
                <strong>{mode.label}</strong>
                <small>{mode.detail}</small>
              </button>
            ))}
          </div>

          {selectedPvp ? (
            <div className={styles.lobbyPreview}>
              <div>
                <span>Waiting lobby preview</span>
                <h3>
                  {selectedPvp.label} · {selectedPvp.detail}
                </h3>
                <p>
                  {selectedPvp.lobby}. {characterName} occupies the local preview position.
                </p>
              </div>
              <div className={styles.lobbyStatus}>
                <strong>Waiting for required players</strong>
                <small>
                  Start Battle unlocks only when the future authoritative lobby reports every
                  required seat ready.
                </small>
              </div>
              <div className={styles.lobbyActions}>
                <button type="button" disabled>
                  Start Battle · PvP phase
                </button>
                <button type="button" onClick={() => setPvpMode(null)}>
                  Leave lobby preview
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.publicBattles} aria-labelledby="public-battles-heading">
          <div>
            <span>Colosseum spectator feed</span>
            <strong id="public-battles-heading">Ongoing public battles</strong>
            <p>
              Publicly viewable PvP battles will appear here with mode, participants, round, and a
              read-only Spectate action. Private Battle Hall practice is never exposed as a public
              spectator feed.
            </p>
          </div>
          <div className={styles.publicEmpty}>
            <strong>No public PvP battles yet</strong>
            <small>The spectator feed activates with the Colosseum/PvP rollout.</small>
          </div>
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
