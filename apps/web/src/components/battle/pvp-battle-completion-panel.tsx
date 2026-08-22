'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'
import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './battle-completion-panel.module.css'

function formatFullLog(log: BattleLogView): string {
  return [...log.entries]
    .reverse()
    .map((entry) => {
      const when = new Date(entry.occurredAt).toISOString()
      return `[${when}] v${entry.battleVersion}.${entry.eventIndex} ${entry.message}`
    })
    .join('\n')
}

function resultForLocalPlayer(
  battle: BattleSessionView,
  metadata: PvpBattleMetadata,
): 'Victory' | 'Defeat' | 'Draw' {
  const local = metadata.participants.find(
    (participant) => participant.characterId === metadata.localCharacterId,
  )
  if (!local) return 'Draw'

  const participantByCombatant = new Map(
    metadata.participants.map((participant) => [participant.combatantId, participant] as const),
  )
  const livingTeams = new Set<number>()
  for (const combatant of battle.snapshot.tactical.battle.combatants) {
    if (combatant.hp <= 0) continue
    const participant = participantByCombatant.get(combatant.id)
    if (participant) livingTeams.add(participant.teamIndex)
  }

  if (livingTeams.size !== 1) return 'Draw'
  return livingTeams.has(local.teamIndex) ? 'Victory' : 'Defeat'
}

export function PvpBattleCompletionPanel({
  initialBattle,
  metadata,
}: {
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
}) {
  const router = useRouter()
  const [battle, setBattle] = useState(initialBattle)
  const [error, setError] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [log, setLog] = useState<BattleLogView | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const result = useMemo(() => resultForLocalPlayer(battle, metadata), [battle, metadata])
  const battleState = battle.snapshot.tactical.battle
  const round = battleState.round

  useEffect(() => {
    if (battleState.lifecycle === 'completed') return
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/battles/${initialBattle.battleSessionId}`, {
          cache: 'no-store',
        })
        const body = (await response.json()) as { battle?: BattleSessionView }
        if (response.ok && body.battle && !cancelled) setBattle(body.battle)
      } catch {
        // The active battle UI owns connection messaging. This panel only waits for completion.
      }
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [battleState.lifecycle, initialBattle.battleSessionId])

  async function loadBattleLog(): Promise<BattleLogView | null> {
    if (log) return log
    if (logLoading) return null
    setLogLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/battles/${battle.battleSessionId}/events`, {
        cache: 'no-store',
      })
      const body = (await response.json()) as {
        battleLog?: BattleLogView
        error?: { message?: string }
      }
      if (!response.ok || !body.battleLog) {
        throw new Error(body.error?.message ?? 'Battle history is temporarily unavailable.')
      }
      setLog(body.battleLog)
      return body.battleLog
    } catch (logError) {
      setError(
        logError instanceof Error ? logError.message : 'Battle history is temporarily unavailable.',
      )
      return null
    } finally {
      setLogLoading(false)
    }
  }

  async function toggleBattleLog() {
    if (!logOpen) await loadBattleLog()
    setLogOpen((open) => !open)
  }

  async function copyBattleLog() {
    const current = await loadBattleLog()
    if (!current) return
    try {
      await navigator.clipboard.writeText(formatFullLog(current))
      setCopyNotice('Full battle log copied')
      window.setTimeout(() => setCopyNotice(null), 1800)
    } catch {
      setCopyNotice('Copy unavailable')
    }
  }

  if (battleState.lifecycle !== 'completed') return null

  return (
    <div className={styles.overlay} data-testid="pvp-battle-result-overlay">
      <section
        className={styles.panel}
        aria-labelledby="pvp-battle-result-title"
        data-result={result.toLowerCase()}
      >
        <div className={styles.resultHero}>
          <p className={styles.eyebrow}>Battle Hall · PvP Result</p>
          <h2 id="pvp-battle-result-title">{result}</h2>
          <p>
            The match concluded in Round {round}. Review the battle history or return to the hall.
          </p>
        </div>

        <dl className={`${styles.record} ${styles.pvpRecord}`} aria-label="PvP battle result">
          <div>
            <dt>Format</dt>
            <dd>{metadata.mode.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Round</dt>
            <dd>{round}</dd>
          </div>
          <div>
            <dt>Combatants</dt>
            <dd>{metadata.participants.length}</dd>
          </div>
        </dl>

        <div className={styles.logActions}>
          <button type="button" className={styles.secondary} onClick={() => void toggleBattleLog()}>
            {logLoading ? 'Loading Battle Log…' : logOpen ? 'Hide Battle Log' : 'Review Battle Log'}
          </button>
          <button type="button" className={styles.secondary} onClick={() => void copyBattleLog()}>
            Copy Full Log
          </button>
          {copyNotice ? <span role="status">{copyNotice}</span> : null}
        </div>

        {logOpen ? (
          <section className={styles.logReview} aria-label="Committed PvP battle log review">
            <div className={styles.logHeader}>
              <strong>Battle Log</strong>
              <span>{log?.entries.length ?? 0} events</span>
            </div>
            {log && log.entries.length > 0 ? (
              <ol>
                {[...log.entries].reverse().map((entry) => (
                  <li key={`${entry.battleVersion}:${entry.eventIndex}`}>
                    <small>
                      v{entry.battleVersion}.{entry.eventIndex}
                    </small>
                    <span>{entry.message}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No battle events were recorded.</p>
            )}
          </section>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push('/game/battle')}
          >
            Return to Battle Hall
          </button>
        </div>
      </section>
    </div>
  )
}
