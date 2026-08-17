'use client'

import type { TacticalHallArenaId } from '@aurevane/game-core/combat/tactical-hall-arenas'
import {
  P2_7_TACTICAL_HALL_RECORDS,
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AurevaneImage } from '@/components/media/aurevane-image'

import styles from './battle-launch.module.css'

interface BattleLaunchProps {
  characterId: string
  characterName: string
}

const ARENAS: readonly {
  id: TacticalHallArenaId
  name: string
  scale: string
  summary: string
}[] = [
  {
    id: 'basic-training-floor',
    name: 'Basic Training Floor',
    scale: '5×3 · Micro drill',
    summary: 'Fast deterministic practice for learning movement, attacks, Guard, and facing.',
  },
  {
    id: 'duel-yard',
    name: 'Duel Yard',
    scale: '9×7 · Duel arena',
    summary:
      'More room for approach choice, rough terrain, elevation, flanking, and repositioning.',
  },
]

export function BattleLaunch({ characterId, characterName }: BattleLaunchProps) {
  const router = useRouter()
  const [recordId, setRecordId] = useState<TacticalHallRecordId>('recruit-sparring')
  const [arenaId, setArenaId] = useState<TacticalHallArenaId>('basic-training-floor')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedRecord = getTacticalHallRecord(recordId)
  const selectedArena = ARENAS.find((arena) => arena.id === arenaId) ?? ARENAS[0]

  function chooseRecord(nextRecordId: TacticalHallRecordId) {
    const nextRecord = getTacticalHallRecord(nextRecordId)
    setRecordId(nextRecordId)
    if (!nextRecord.combinedDuel) setArenaId(nextRecord.defaultArenaId)
  }

  async function launchBattle() {
    if (pending) return
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
          <p className={styles.eyebrow}>Tactical Hall · Controlled Exercise</p>
          <h1 id="battle-launch-title">Enter the training field</h1>
          <p className={styles.lede}>
            {characterName} will enter a controlled tactical exercise. Movement, actions, facing,
            forecasts, Recruit decisions, arena geometry, and every committed result remain server
            authoritative.
          </p>

          <section className={styles.record} aria-labelledby="recruit-record-title">
            <div className={styles.recordHeading}>
              <div>
                <span>Tactical Record</span>
                <h2 id="recruit-record-title">{selectedRecord.name}</h2>
              </div>
              <strong>Guided practice</strong>
            </div>

            <div className={styles.actions} role="group" aria-label="Choose Tactical Hall record">
              {P2_7_TACTICAL_HALL_RECORDS.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className={recordId === record.id ? styles.primary : styles.secondary}
                  onClick={() => chooseRecord(record.id)}
                  disabled={pending}
                  aria-pressed={recordId === record.id}
                >
                  {record.name}
                </button>
              ))}
            </div>

            <dl>
              <div>
                <dt>Intelligence</dt>
                <dd>Recruit</dd>
              </div>
              <div>
                <dt>Lesson</dt>
                <dd>{selectedRecord.combinedDuel ? 'Combined duel' : 'Focused drill'}</dd>
              </div>
              <div>
                <dt>Attributes</dt>
                <dd>Standard preset · fixed</dd>
              </div>
              <div>
                <dt>Arena</dt>
                <dd>{selectedArena?.name ?? 'Basic Training Floor'}</dd>
              </div>
            </dl>
            <p>{selectedRecord.purpose}</p>
            <ol>
              {selectedRecord.coachSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <div className={styles.actions} role="group" aria-label="Choose Tactical Hall arena">
              {ARENAS.map((arena) => (
                <button
                  key={arena.id}
                  type="button"
                  className={arenaId === arena.id ? styles.primary : styles.secondary}
                  onClick={() => setArenaId(arena.id)}
                  disabled={pending || !selectedRecord.combinedDuel}
                  aria-pressed={arenaId === arena.id}
                  title={
                    selectedRecord.combinedDuel
                      ? arena.summary
                      : 'Focused drills use the compact Basic Training Floor.'
                  }
                >
                  {arena.name} · {arena.scale}
                </button>
              ))}
            </div>
          </section>

          <div className={styles.rules} aria-label="Exercise rules">
            <span>One controlled Wayfarer</span>
            <span>One opposing Recruit</span>
            <span>{selectedRecord.combinedDuel ? '1v1 defeat opponent' : 'Guided concept practice'}</span>
            <span>No progression rewards</span>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={launchBattle}
              disabled={pending}
            >
              {pending
                ? 'Opening field…'
                : `Begin exercise · ${selectedArena?.name ?? 'Training Floor'} · ${selectedRecord.name}`}
            </button>
            <button type="button" className={styles.secondary} onClick={() => router.push('/game')}>
              Return to Wayfarer
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
