import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { BattleLogView } from '@/server/battle/battle-log-service'
import {
  renderBattleLogEntry,
  type PresentedBattleLogAction,
  type PresentedBattleLogRound,
} from './battle-log-presentation'
import {
  battleSkillArtwork,
  BATTLE_COMMAND_ARTWORK,
  BATTLE_MISSING_ARTWORK,
} from './battle-skill-presentation'
import styles from './battle-action-timeline.module.css'

function actionName(action: PresentedBattleLogAction): string {
  const recordedName = action.sourceEntries?.find((entry) => entry.actionLabel)?.actionLabel
  if (recordedName) return recordedName
  return (
    action.primary.find((part) => part.role === 'action')?.text.trim() ||
    ({
      movement: 'Move',
      turn: 'Turn ended',
      status: 'Status effect',
      system: 'Battle update',
      offense: 'Attack',
      recovery: 'Recover',
      defense: 'Guard',
      resource: 'Resources',
    }[action.kind] ??
      'Action')
  )
}
function actorName(action: PresentedBattleLogAction): string {
  return (
    action.primary
      .find((part) => part.role === 'actor')
      ?.text.trim()
      .replace(/[’']s$/, '') ?? ''
  )
}
function artwork(action: PresentedBattleLogAction, entries: BattleLogView['entries']): string {
  const entry = (action.sourceEntries ?? entries).find(
    (item) => item.battleVersion === action.battleVersion && item.actionId,
  )
  if (entry?.actionId) return battleSkillArtwork(entry.actionId)
  if (action.kind === 'movement') return BATTLE_COMMAND_ARTWORK.move
  if (action.kind === 'turn') return BATTLE_COMMAND_ARTWORK.finish
  if (action.kind === 'offense') return BATTLE_COMMAND_ARTWORK.attack
  if (action.kind === 'defense') return BATTLE_COMMAND_ARTWORK.guard
  return BATTLE_COMMAND_ARTWORK.inspect
}
function segments(parts: PresentedBattleLogAction['primary']) {
  return parts.map((part, index) => (
    <span key={index} data-tone={part.tone} data-role={part.role}>
      {part.text}
    </span>
  ))
}

export function BattleActionTimeline({
  rounds,
  entries,
  playerName,
  combatantNames,
}: {
  rounds: readonly PresentedBattleLogRound[]
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
}) {
  const [filter, setFilter] = useState<'all' | 'you' | 'opponents'>('all')
  const [selected, setSelected] = useState<PresentedBattleLogAction | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const actions = rounds
    .flatMap((round) => round.actions)
    .sort((a, b) => a.battleVersion - b.battleVersion || a.occurredAt.localeCompare(b.occurredAt))
  const visible = actions.filter(
    (action) =>
      filter === 'all' ||
      (Boolean(actorName(action)) &&
        (filter === 'you' ? actorName(action) === playerName : actorName(action) !== playerName)),
  )

  useEffect(() => {
    if (listRef.current) listRef.current.scrollLeft = listRef.current.scrollWidth
  }, [actions.length, filter])
  useEffect(() => {
    if (selected && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
      dialogRef.current.focus()
    }
  }, [selected])

  const recordedResults =
    selected?.sourceEntries?.filter(
      (entry) =>
        ![
          'combat_action_used',
          'round_started',
          'turn_started',
          'turn_ended',
          'movement_spent',
          'recruit_ai_decision',
          'stat_driven_attack_resolved',
        ].includes(entry.eventType),
    ) ?? []
  return (
    <div className={styles.timeline}>
      <div className={styles.filter} role="group" aria-label="Filter battle actions">
        {(['all', 'you', 'opponents'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? 'All' : value === 'you' ? 'You' : 'Opponents'}
          </button>
        ))}
      </div>
      <ol ref={listRef} className={styles.track} aria-label="Battle action timeline">
        {visible.map((action) => (
          <li key={action.key}>
            <button
              type="button"
              onClick={() => setSelected(action)}
              aria-label={`Action details: ${action.ariaLabel}`}
              title={action.ariaLabel}
            >
              <span className={styles.art}>
                <Image
                  src={artwork(action, entries)}
                  width={44}
                  height={44}
                  unoptimized
                  alt=""
                  onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = BATTLE_MISSING_ARTWORK
                  }}
                />
                {actorName(action) ? (
                  <b aria-hidden="true">{actorName(action).slice(0, 1)}</b>
                ) : null}
              </span>
              <strong>{actionName(action)}</strong>
              <span>
                {actorName(action) || 'Battle'} ·{' '}
                {action.round === null ? 'Event' : `R${action.round}`}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {visible.length === 0 ? <p className={styles.empty}>No actions in this view yet.</p> : null}
      {selected ? (
        <dialog
          ref={dialogRef}
          data-battle-action-details="true"
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          className={styles.dialog}
          aria-labelledby="battle-action-detail-title"
          onClose={() => setSelected(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close()
          }}
        >
          <header>
            <div>
              <span>
                {selected.round === null ? 'Battle event' : `Round ${selected.round}`} · Action
                details
              </span>
              <h2 id="battle-action-detail-title">{actionName(selected)}</h2>
            </div>
            <button
              type="button"
              aria-label="Close action details"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className={styles.actionSummary}>
            <Image src={artwork(selected, entries)} width={72} height={72} unoptimized alt="" />
            <p>{segments(selected.primary)}</p>
          </div>
          <section className={styles.result} aria-label="Recorded action result">
            <h3>Result</h3>
            {recordedResults.length ? (
              <ul>
                {recordedResults.map((entry) => (
                  <li key={`${entry.battleVersion}:${entry.eventIndex}`} data-tone={entry.tone}>
                    {renderBattleLogEntry(entry, { playerName, combatantNames })}
                  </li>
                ))}
              </ul>
            ) : selected.secondary ? (
              <p>{segments(selected.secondary)}</p>
            ) : (
              <p>{segments(selected.primary)}</p>
            )}
            {selected.details.length ? (
              <ul>
                {selected.details.map((fact, index) => (
                  <li key={index} data-tone={fact.tone}>
                    {fact.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </dialog>
      ) : null}
    </div>
  )
}
