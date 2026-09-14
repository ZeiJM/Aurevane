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
import { useBattleOpponentNames } from './battle-runtime-context'

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

function hasGuardedEffect(action: PresentedBattleLogAction): boolean {
  return [...action.primary, ...(action.secondary ?? [])].some((part) =>
    /\bguarded\b/iu.test(part.text),
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

interface TranscriptPage {
  start: number
  end: number
  oversized?: true
}

/** Pack complete action/result blocks from newest to oldest using their rendered heights. */
export function paginateBattleTranscript(
  actions: readonly { height: number; round: number | null }[],
  availableHeight: number,
  headingHeight: number,
  gap: number,
): TranscriptPage[] {
  const pages: TranscriptPage[] = []
  let end = actions.length
  while (end > 0) {
    let start = end
    let height = 0
    while (start > 0) {
      const action = actions[start - 1]!
      const newRound = start === end || action.round !== actions[start]?.round
      const nextHeight =
        height + action.height + (start < end ? gap : 0) + (newRound ? headingHeight : 0)
      if (start < end && nextHeight > availableHeight) break
      height = nextHeight
      start -= 1
    }
    pages.push({ start, end, ...(height > availableHeight ? { oversized: true as const } : {}) })
    end = start
  }
  return pages
}

export function BattleActionTimeline({
  rounds,
  entries,
  playerName,
  combatantNames,
  view = 'timeline',
  recentTurnCount,
  renderTranscript,
}: {
  rounds: readonly PresentedBattleLogRound[]
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  view?: 'timeline' | 'text'
  recentTurnCount?: number
  renderTranscript: (action: PresentedBattleLogAction) => ReactNode
}) {
  const [filter, setFilter] = useState<'all' | 'you' | 'opponents'>('all')
  const opponentNames = useBattleOpponentNames()
  const [selected, setSelected] = useState<PresentedBattleLogAction | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [pageSize, setPageSize] = useState(8)
  const measureRef = useRef<HTMLOListElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const [textPages, setTextPages] = useState<TranscriptPage[]>([])
  const [pagination, setPagination] = useState({ key: '', pagesBack: 0 })
  const [narrowTranscript, setNarrowTranscript] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const actions = useMemo(
    () =>
      rounds
        .flatMap((round) => round.actions)
        .sort(
          (a, b) => a.battleVersion - b.battleVersion || a.occurredAt.localeCompare(b.occurredAt),
        ),
    [rounds],
  )
  const visible = useMemo(
    () =>
      actions.filter(
        (action) =>
          filter === 'all' ||
          (Boolean(actorName(action)) &&
            (filter === 'you'
              ? actorName(action) === playerName
              : opponentNames
                ? opponentNames.includes(actorName(action))
                : actorName(action) !== playerName)),
      ),
    [actions, filter, opponentNames, playerName],
  )

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    setNarrowTranscript(false)
    const resize = () => {
      const flow = list.closest<HTMLElement>('[aria-label="Battle flow"]')
      const nextNarrow = Boolean(flow && flow.getBoundingClientRect().width <= 240)
      setNarrowTranscript((current) => (current === nextNarrow ? current : nextNarrow))
      if (view === 'timeline') {
        setPageSize(Math.max(1, Math.floor(list.clientWidth / 96)))
        return
      }
      const measurement = measureRef.current
      const heading = headingRef.current
      if (!measurement || !heading) return
      const dimensions = getComputedStyle(list)
      const availableHeight =
        list.clientHeight - parseFloat(dimensions.paddingTop) - parseFloat(dimensions.paddingBottom)
      const measured = Array.from(measurement.children).map((item, index) => ({
        height: item.getBoundingClientRect().height,
        round: visible[index]?.round ?? null,
      }))
      const pages = paginateBattleTranscript(
        measured,
        availableHeight,
        heading.getBoundingClientRect().height,
        parseFloat(dimensions.rowGap) || 0,
      )
      setTextPages((current) =>
        JSON.stringify(current) === JSON.stringify(pages) ? current : pages,
      )
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(list)
    if (measureRef.current) observer.observe(measureRef.current)
    return () => observer.disconnect()
  }, [view, visible])
  const pageKey = `${actions.at(-1)?.key ?? ''}:${actions.length}:${filter}:${view}`
  const lastPage = Math.max(
    0,
    view === 'text' ? textPages.length - 1 : Math.ceil(visible.length / pageSize) - 1,
  )
  const currentPage = Math.min(pagination.key === pageKey ? pagination.pagesBack : 0, lastPage)
  const textPage = textPages[currentPage]
  const oversized = view === 'text' && Boolean(textPage?.oversized)
  const showOverflow = oversized && narrowTranscript
  const end =
    view === 'text'
      ? (textPage?.end ?? visible.length)
      : Math.max(0, visible.length - currentPage * pageSize)
  const start =
    view === 'text' ? (textPage?.start ?? Math.max(0, end - 1)) : Math.max(0, end - pageSize)
  const page = visible.slice(start, end)
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
      <div className={styles.pageControls} role="group" aria-label="Battle history pages">
        <button
          type="button"
          aria-label="Older actions"
          disabled={currentPage >= lastPage}
          onClick={() => setPagination({ key: pageKey, pagesBack: currentPage + 1 })}
        >
          ‹
        </button>
        <span>
          {visible.length ? `${start + 1}–${end} of ${visible.length}` : 'No actions'}
          {recentTurnCount ? ` · Recent ${recentTurnCount} turns` : ''}
        </span>
        <button
          type="button"
          aria-label="Newer actions"
          disabled={currentPage === 0}
          onClick={() => setPagination({ key: pageKey, pagesBack: currentPage - 1 })}
        >
          ›
        </button>
      </div>
      <ol
        ref={listRef}
        className={styles.track}
        data-view={view}
        data-oversized={oversized || undefined}
        aria-label={view === 'text' ? 'Battle action transcript' : 'Battle action timeline'}
      >
        {page.map((action, index) => (
          <li key={action.key}>
            {view === 'text' ? (
              <>
                {index === 0 || page[index - 1]?.round !== action.round ? (
                  <div className={styles.transcriptRound}>
                    {action.round === null ? 'Battle' : `Round ${action.round}`}
                  </div>
                ) : null}
                <div
                  className={styles.transcriptEntry}
                  inert={oversized || undefined}
                  aria-hidden={oversized || undefined}
                >
                  {renderTranscript(action)}
                  {!showOverflow ? (
                    <button
                      className={styles.transcriptDetails}
                      type="button"
                      onClick={() => setSelected(action)}
                      aria-label={`Action details: ${action.ariaLabel}`}
                      title="Action details"
                    >
                      ⓘ
                    </button>
                  ) : null}
                </div>
                {showOverflow ? (
                  <>
                    {hasGuardedEffect(action) ? (
                      <button
                        className={styles.transcriptEffect}
                        type="button"
                        data-battle-effect-trigger="true"
                        data-battle-effect-name="Guarded"
                        data-battle-effect-kind="Buff"
                        aria-label="Explain Guarded"
                      >
                        Guarded
                      </button>
                    ) : null}
                    <button
                      className={styles.transcriptOverflow}
                      type="button"
                      aria-label={`View full action and results: ${action.ariaLabel}`}
                      onClick={() => setSelected(action)}
                    >
                      View full action and results
                    </button>
                  </>
                ) : null}
              </>
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
            )}
          </li>
        ))}
        {visible.length === 0 ? (
          <li>
            <p className={styles.empty}>No actions in this view yet.</p>
          </li>
        ) : null}
      </ol>
      {view === 'text' ? (
        <div className={styles.transcriptMeasure} aria-hidden="true" inert>
          <div className={styles.transcriptRound} ref={headingRef}>
            Round
          </div>
          <ol ref={measureRef}>
            {visible.map((action) => (
              <li className={styles.transcriptEntry} key={action.key}>
                {renderTranscript(action)}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
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
