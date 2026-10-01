import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { buildPresentedBattleLogTurns, resolveBattleLogTurnIndex } from './battle-log-turn-groups'

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
  view = 'timeline',
  renderTranscript,
}: {
  rounds: readonly PresentedBattleLogRound[]
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  view?: 'timeline' | 'text'
  renderTranscript: (action: PresentedBattleLogAction) => ReactNode
}) {
  const [selected, setSelected] = useState<PresentedBattleLogAction | null>(null)
  const [requestedTurn, setRequestedTurn] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousTurnRef = useRef<HTMLButtonElement>(null)
  const nextTurnRef = useRef<HTMLButtonElement>(null)
  const pendingTurnFocus = useRef<'previous' | 'next' | null>(null)
  const turns = useMemo(() => buildPresentedBattleLogTurns(rounds, entries), [rounds, entries])
  const turnIndex = resolveBattleLogTurnIndex(turns, requestedTurn)
  const turn = turns[turnIndex]
  useEffect(() => {
    const direction = pendingTurnFocus.current
    pendingTurnFocus.current = null
    if (direction === 'previous') previousTurnRef.current?.focus()
    if (direction === 'next') nextTurnRef.current?.focus()
  }, [turnIndex])
  const actions = turn?.actions ?? []
  const turnLabel =
    turn?.turnNumber === null || !turn
      ? turn?.round === null || !turn
        ? 'Battle'
        : `Round ${turn.round}`
      : `${turn.round === null ? '' : `Round ${turn.round} · `}Turn ${turn.turnNumber}`
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
    <div className={styles.timeline} data-view={view}>
      <div className={styles.turnHeader}>
        <span className={styles.turnLabel}>{turnLabel}</span>
        <div className={styles.turnControls} role="group" aria-label="Battle history turns">
          {turnIndex > 0 ? (
            <button
              type="button"
              ref={previousTurnRef}
              aria-label="Previous turn"
              onClick={() => {
                if (turnIndex === 1) pendingTurnFocus.current = 'next'
                setRequestedTurn(turns[turnIndex - 1]!.key)
              }}
            >
              &lt;
            </button>
          ) : null}
          {turnIndex >= 0 && turnIndex < turns.length - 1 ? (
            <button
              type="button"
              ref={nextTurnRef}
              aria-label="Next turn"
              onClick={() => {
                if (turnIndex + 1 === turns.length - 1) pendingTurnFocus.current = 'previous'
                setRequestedTurn(
                  turnIndex + 1 === turns.length - 1 ? null : turns[turnIndex + 1]!.key,
                )
              }}
            >
              &gt;
            </button>
          ) : null}
        </div>
      </div>
      <ol
        className={styles.track}
        data-view={view}
        aria-label={view === 'text' ? 'Battle action transcript' : 'Battle action timeline'}
      >
        {actions.map((action) => (
          <li key={action.key}>
            {view === 'text' ? (
              <div className={styles.transcriptEntry}>
                {renderTranscript(action)}
                <button
                  className={styles.transcriptDetails}
                  type="button"
                  onClick={() => setSelected(action)}
                  aria-label={`Action details: ${action.ariaLabel}`}
                  title="Action details"
                >
                  ⓘ
                </button>
              </div>
            ) : (
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
                </span>
              </button>
            )}
          </li>
        ))}
        {actions.length === 0 ? (
          <li>
            <p className={styles.empty}>No committed actions this turn yet.</p>
          </li>
        ) : null}
      </ol>
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
