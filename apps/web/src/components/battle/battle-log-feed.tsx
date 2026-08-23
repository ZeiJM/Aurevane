'use client'

import { useEffect, useMemo, useState } from 'react'

import type {
  BattleLogEntry,
  BattleLogFact,
  BattleLogKind,
  BattleLogTone,
  BattleLogView,
} from '@/server/battle/battle-log-service'

import styles from './battle-log-feed.module.css'

interface BattleLogFeedProps {
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  emptyMessage?: string
}

interface ActionGroup {
  battleVersion: number
  entries: BattleLogEntry[]
  round: number | null
  turnNumber: number | null
  occurredAt: string
  kind: BattleLogKind
  tone: BattleLogTone
  headline: string
  actorCombatantId: string | null
  targetCombatantId: string | null
  facts: BattleLogFact[]
  fallback: BattleLogEntry
}

interface RoundGroup {
  key: string
  round: number | null
  occurredAt: string
  actions: ActionGroup[]
}

const BOOKKEEPING_EVENTS = new Set([
  'round_started',
  'turn_started',
  'turn_ended',
  'movement_spent',
  'combatant_facing_changed',
  'recruit_ai_decision',
])

const PRIMARY_EVENT_PRIORITY = [
  'combat_action_used',
  'stat_driven_attack_resolved',
  'combatant_moved',
  'damage_applied',
  'healing_applied',
  'status_applied',
  'status_expired',
  'combatant_waited',
  'pvp_turn_timed_out',
  'pvp_lowered_guard_applied',
  'pvp_combatant_surrendered',
  'battle_completed',
  'battle_abandoned',
  'battle_started',
]

const TONE_PRIORITY: Record<BattleLogTone, number> = {
  neutral: 0,
  benefit: 1,
  healing: 2,
  damage: 3,
  warning: 4,
}

function combatantName(
  combatantId: string | null,
  playerName?: string,
  combatantNames?: Readonly<Record<string, string>>,
): string | null {
  if (!combatantId) return null
  const exact = combatantNames?.[combatantId]
  if (exact) return exact
  if (combatantId.startsWith('character:')) return playerName ?? 'Wayfarer'
  if (combatantId.startsWith('recruit:')) return 'Recruit'
  return 'Combatant'
}

function renderEntry(
  entry: BattleLogEntry,
  playerName?: string,
  combatantNames?: Readonly<Record<string, string>>,
): string {
  const values: Readonly<Record<string, string>> = {
    ...entry.templateValues,
    actor: combatantName(entry.actorCombatantId, playerName, combatantNames) ?? 'Combatant',
    target: combatantName(entry.targetCombatantId, playerName, combatantNames) ?? 'Combatant',
  }

  return entry.messageTemplate.replace(
    /\{([a-zA-Z][a-zA-Z0-9_.-]*)\}/gu,
    (_match, token: string) => values[token] ?? '',
  )
}

function strongestTone(entries: readonly BattleLogEntry[]): BattleLogTone {
  return entries.reduce<BattleLogTone>((strongest, entry) => {
    return TONE_PRIORITY[entry.tone] > TONE_PRIORITY[strongest] ? entry.tone : strongest
  }, 'neutral')
}

function uniqueFacts(entries: readonly BattleLogEntry[]): BattleLogFact[] {
  const seen = new Set<string>()
  const result: BattleLogFact[] = []

  for (const entry of entries) {
    for (const item of entry.facts) {
      const key = `${item.tone}:${item.label}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(item)
      if (result.length >= 5) return result
    }
  }

  return result
}

function primaryEntry(entries: readonly BattleLogEntry[]): BattleLogEntry {
  for (const eventType of PRIMARY_EVENT_PRIORITY) {
    const match = entries.find((entry) => entry.eventType === eventType)
    if (match) return match
  }
  return entries[0]
}

function groupActions(entries: BattleLogView['entries']): ActionGroup[] {
  const ordered = [...entries].sort((left, right) => {
    if (left.battleVersion !== right.battleVersion) return right.battleVersion - left.battleVersion
    return right.eventIndex - left.eventIndex
  })
  const groups: Array<{ battleVersion: number; entries: BattleLogEntry[] }> = []

  for (const entry of ordered) {
    const current = groups.at(-1)
    if (current?.battleVersion === entry.battleVersion) current.entries.push(entry)
    else groups.push({ battleVersion: entry.battleVersion, entries: [entry] })
  }

  return groups.flatMap((group) => {
    const visible = group.entries.filter((entry) => !BOOKKEEPING_EVENTS.has(entry.eventType))
    if (visible.length === 0) return []

    const primary = primaryEntry(visible)
    const actorCombatantId =
      visible.find((entry) => entry.actorCombatantId)?.actorCombatantId ?? null
    const targetCombatantId =
      visible.find(
        (entry) =>
          entry.targetCombatantId && entry.targetCombatantId !== actorCombatantId,
      )?.targetCombatantId ??
      visible.find((entry) => entry.targetCombatantId)?.targetCombatantId ??
      null
    const actionLabel =
      visible.find((entry) => entry.actionLabel)?.actionLabel ?? primary.actionLabel ?? null

    return [
      {
        battleVersion: group.battleVersion,
        entries: group.entries,
        round: primary.round ?? visible.find((entry) => entry.round !== null)?.round ?? null,
        turnNumber:
          primary.turnNumber ?? visible.find((entry) => entry.turnNumber !== null)?.turnNumber ?? null,
        occurredAt: group.entries[0]?.occurredAt ?? primary.occurredAt,
        kind: primary.kind,
        tone: strongestTone(visible),
        headline: actionLabel ?? primary.headline,
        actorCombatantId,
        targetCombatantId,
        facts: uniqueFacts(visible),
        fallback: primary,
      },
    ]
  })
}

function groupRounds(actions: readonly ActionGroup[]): RoundGroup[] {
  const result: RoundGroup[] = []

  for (const action of actions) {
    const key = action.round === null ? 'recent' : `round:${action.round}`
    const current = result.at(-1)
    if (current?.key === key) current.actions.push(action)
    else {
      result.push({
        key,
        round: action.round,
        occurredAt: action.occurredAt,
        actions: [action],
      })
    }
  }

  return result
}

function kindGlyph(kind: BattleLogKind): string {
  if (kind === 'offense') return '⚔'
  if (kind === 'movement') return '↗'
  if (kind === 'defense') return '◇'
  if (kind === 'recovery') return '✦'
  if (kind === 'status') return '◆'
  if (kind === 'resource') return '◈'
  if (kind === 'turn') return '◷'
  return '•'
}

function timeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function countBattleLogActions(entries: BattleLogView['entries']): number {
  return groupActions(entries).length
}

export function BattleLogFeed({
  entries,
  playerName,
  combatantNames,
  emptyMessage = 'No committed battle actions yet.',
}: BattleLogFeedProps) {
  const rounds = useMemo(() => groupRounds(groupActions(entries)), [entries])
  const [expandedRound, setExpandedRound] = useState<string | null>(null)

  useEffect(() => {
    if (rounds.length === 0) {
      setExpandedRound(null)
      return
    }
    setExpandedRound((current) =>
      current && rounds.some((round) => round.key === current) ? current : rounds[0].key,
    )
  }, [rounds])

  if (rounds.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

  return (
    <div className={styles.feed} data-testid="battle-log-feed">
      {rounds.map((round) => {
        const open = expandedRound === round.key
        const roundLabel = round.round === null ? 'Recent' : `Round ${round.round}`
        return (
          <section className={styles.round} data-open={open || undefined} key={round.key}>
            <button
              type="button"
              className={styles.roundHeader}
              aria-expanded={open}
              onClick={() => setExpandedRound((current) => (current === round.key ? null : round.key))}
            >
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
              <span className={styles.roundTitle}>
                <strong>{roundLabel}</strong>
                <small>
                  {round.actions.length} action{round.actions.length === 1 ? '' : 's'}
                </small>
              </span>
              <time dateTime={round.occurredAt}>{timeLabel(round.occurredAt)}</time>
            </button>

            {open ? (
              <div className={styles.actions}>
                {round.actions.map((action) => {
                  const actor = combatantName(
                    action.actorCombatantId,
                    playerName,
                    combatantNames,
                  )
                  const target = combatantName(
                    action.targetCombatantId,
                    playerName,
                    combatantNames,
                  )
                  const subject =
                    actor && target && actor !== target ? `${actor} → ${target}` : (actor ?? target)
                  const fallback = renderEntry(action.fallback, playerName, combatantNames)
                  const showFallback = action.facts.length === 0 || (!subject && action.kind === 'system')

                  return (
                    <article
                      className={styles.action}
                      data-kind={action.kind}
                      data-tone={action.tone}
                      key={action.battleVersion}
                    >
                      <span className={styles.glyph} aria-hidden="true">
                        {kindGlyph(action.kind)}
                      </span>
                      <div className={styles.actionMain}>
                        <div className={styles.actionHeading}>
                          <strong>{action.headline}</strong>
                          {action.turnNumber !== null ? <small>Turn {action.turnNumber}</small> : null}
                        </div>
                        {subject ? <p className={styles.subject}>{subject}</p> : null}
                        {action.facts.length > 0 ? (
                          <div className={styles.facts} aria-label="Action outcome">
                            {action.facts.map((item) => (
                              <span data-tone={item.tone} key={`${item.tone}:${item.label}`}>
                                {item.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {showFallback ? <p className={styles.fallback}>{fallback}</p> : null}
                      </div>
                      <time className={styles.actionTime} dateTime={action.occurredAt}>
                        {timeLabel(action.occurredAt)}
                      </time>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
