'use client'

import {
  getTacticalHallArena,
  type TacticalHallArenaId,
} from '@aurevane/game-core/combat/tactical-hall-arenas'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './battle-completion-panel.module.css'

interface BattleCompletionPanelProps {
  battle: BattleSessionView
}

function readCharacterId(battle: BattleSessionView): string | null {
  const player = battle.snapshot.tactical.battle.combatants.find(
    (combatant) => combatant.teamId === 'players' && combatant.id.startsWith('character:'),
  )
  return player?.id.slice('character:'.length) ?? null
}

function readResult(battle: BattleSessionView): 'Victory' | 'Defeat' | 'Draw' {
  const livingTeams = new Set(
    battle.snapshot.tactical.battle.combatants
      .filter((combatant) => combatant.hp > 0)
      .map((combatant) => combatant.teamId),
  )
  if (livingTeams.size !== 1) return 'Draw'
  return livingTeams.has('players') ? 'Victory' : 'Defeat'
}

function readArenaId(battle: BattleSessionView): TacticalHallArenaId {
  const tactical = battle.snapshot.tactical
  return tactical.width === 9 && tactical.height === 7 ? 'duel-yard' : 'basic-training-floor'
}

export function BattleCompletionPanel({ battle }: BattleCompletionPanelProps) {
  const router = useRouter()
  const [retryPending, setRetryPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const result = useMemo(() => readResult(battle), [battle])
  const characterId = useMemo(() => readCharacterId(battle), [battle])
  const arenaId = useMemo(() => readArenaId(battle), [battle])
  const arena = useMemo(() => getTacticalHallArena(arenaId), [arenaId])
  const battleState = battle.snapshot.tactical.battle
  const player = battleState.combatants.find((combatant) => combatant.teamId === 'players')
  const recruit = battleState.combatants.find((combatant) => combatant.teamId === 'opponents')

  async function retry() {
    if (retryPending || !characterId) return
    setRetryPending(true)
    setError(null)

    const recordId = sessionStorage.getItem(`aurevane:tactical-record:${battle.battleSessionId}`)

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
        throw new Error(body.error?.message ?? 'The practice battle could not be restarted.')
      }

      if (recordId) {
        sessionStorage.setItem(
          `aurevane:tactical-record:${body.battle.battleSessionId}`,
          recordId,
        )
      }
      router.push(`/game/battle/${body.battle.battleSessionId}`)
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : 'The practice battle could not be restarted.',
      )
      setRetryPending(false)
    }
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="tactical-hall-result-title"
      data-testid="tactical-hall-result"
    >
      <div className={styles.resultCopy}>
        <p className={styles.eyebrow}>Tactical Hall · Practice Result</p>
        <h2 id="tactical-hall-result-title">{result}</h2>
        <p>
          Exercise concluded in Round {battleState.round}. The committed battle history remains
          available for review, and Retry preserves this exercise&apos;s arena.
        </p>
      </div>

      <dl className={styles.record} aria-label="Tactical Hall practice result">
        <div>
          <dt>Opponent</dt>
          <dd>Recruit</dd>
        </div>
        <div>
          <dt>Arena</dt>
          <dd>
            {arena.name} · {arena.width}×{arena.height}
          </dd>
        </div>
        <div>
          <dt>Wayfarer HP</dt>
          <dd>{player ? `${player.hp}/${player.maxHp}` : '—'}</dd>
        </div>
        <div>
          <dt>Recruit HP</dt>
          <dd>{recruit ? `${recruit.hp}/${recruit.maxHp}` : '—'}</dd>
        </div>
      </dl>

      <p className={styles.noRewards} data-testid="practice-no-rewards">
        Practice result only — no Character XP, Mastery, loot, Crowns, PvP rating, or normal
        progression reward is granted.
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void retry()}
          disabled={retryPending || !characterId}
        >
          {retryPending ? 'Restarting…' : 'Retry same drill'}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => router.push('/game/battle')}
          disabled={retryPending}
        >
          Return to Tactical Hall
        </button>
      </div>
    </section>
  )
}
