import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { buildPresentedBattleLogTurns } from './battle-log-turn-groups'
import {
  paginateBattleActionReader,
  resolveBattleActionSelection,
  type BattleActionReaderBlock,
  type BattleActionReaderSelection,
} from './battle-action-reader'
import styles from './battle-action-timeline.module.css'

function actionName(action: PresentedBattleLogAction): string {
  const entry = action.sourceEntries?.find((item) => item.actionContext || item.actionLabel)
  return (
    entry?.actionContext?.name ||
    entry?.actionLabel ||
    action.primary.find((part) => part.role === 'action')?.text.trim() ||
    {
      movement: 'Move',
      turn: 'Turn ended',
      status: 'Status effect',
      system: 'Battle update',
      offense: 'Attack',
      recovery: 'Recover',
      defense: 'Guard',
      resource: 'Resources',
    }[action.kind]
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
function readerBlocks(
  action: PresentedBattleLogAction,
  entries: BattleLogView['entries'],
  playerName?: string,
  combatantNames?: Readonly<Record<string, string>>,
): BattleActionReaderBlock[] {
  const source =
    action.sourceEntries ?? entries.filter((entry) => entry.battleVersion === action.battleVersion)
  const context = source.find((entry) => entry.actionContext)?.actionContext
  const narration = [
    action.primary.map((part) => part.text).join(''),
    action.secondary?.map((part) => part.text).join(''),
  ]
    .filter(Boolean)
    .join('\n')
  const parts = [...action.primary, ...(action.secondary ?? [])]
  const outcomes = parts.filter((part) => part.role === 'outcome').map((part) => part.text.trim())
  const attribution = [
    ...new Set(
      parts
        .filter((part) => part.role === 'actor' || part.role === 'target')
        .map((part) => part.text.trim()),
    ),
  ]
  const result = outcomes.length ? [...outcomes, ...attribution].join(' · ') : narration
  const blocks: BattleActionReaderBlock[] = [{ label: 'Result', text: result, tone: action.tone }]
  if (context?.description)
    blocks.push({ label: 'Description', text: context.description, tone: 'neutral' })
  if (context?.flavor) blocks.push({ label: 'Flavor', text: context.flavor, tone: 'neutral' })
  blocks.push({ label: 'Action', text: actionName(action), tone: 'neutral' })
  if (result !== narration) blocks.push({ label: 'Narration', text: narration, tone: action.tone })
  // Source records retain every target, result and fact, including presentation-capped details.
  for (const entry of source) {
    blocks.push({
      label: 'Recorded result',
      text: renderBattleLogEntry(entry, { playerName, combatantNames }),
      tone: entry.tone,
    })
    for (const fact of entry.facts)
      blocks.push({ label: 'Detail', text: fact.label, tone: fact.tone })
  }
  if (!source.length)
    for (const fact of action.details)
      blocks.push({ label: 'Detail', text: fact.label, tone: fact.tone })
  return blocks.filter((block) => block.text)
}
function ReaderPage({ blocks }: { blocks: readonly BattleActionReaderBlock[] }) {
  return (
    <div className={styles.page}>
      {blocks.map((block, index) => (
        <div
          key={index}
          className={styles.block}
          data-tone={block.tone}
          data-reader-part={block.label}
        >
          <span className={styles.blockLabel}>{block.label}</span>
          <p>{block.text}</p>
        </div>
      ))}
    </div>
  )
}

export function BattleActionTimeline({
  rounds,
  entries,
  playerName,
  combatantNames,
  view = 'timeline',
}: {
  rounds: readonly PresentedBattleLogRound[]
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  view?: 'timeline' | 'text'
}) {
  const [selection, setSelection] = useState<BattleActionReaderSelection | null>(null)
  const [capacity, setCapacity] = useState(4)
  const [pagination, setPagination] = useState<{
    key: string
    pages: BattleActionReaderBlock[][]
  } | null>(null)
  const [requestedPage, setRequestedPage] = useState<{ key: string; index: number } | null>(null)
  const trackRef = useRef<HTMLOListElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const previousTurnRef = useRef<HTMLButtonElement>(null)
  const nextTurnRef = useRef<HTMLButtonElement>(null)
  const pendingTurnFocus = useRef<'previous' | 'next' | null>(null)
  const turns = useMemo(() => buildPresentedBattleLogTurns(rounds, entries), [rounds, entries])
  const { turnIndex, actionIndex } = resolveBattleActionSelection(turns, selection)
  const turn = turns[turnIndex]
  const actions = turn?.actions ?? []
  const selected = actions[actionIndex]
  const blocks = useMemo(
    () => (selected ? readerBlocks(selected, entries, playerName, combatantNames) : []),
    [selected, entries, playerName, combatantNames],
  )
  const readerKey = `${view}:${selected?.key ?? 'empty'}`
  const blockSignature = JSON.stringify(blocks)
  const pages = pagination?.key === readerKey ? pagination.pages : [blocks]
  const detailIndex = Math.min(
    requestedPage?.key === readerKey ? requestedPage.index : 0,
    pages.length - 1,
  )
  const actionPage = Math.floor(Math.max(0, actionIndex) / capacity)
  const pageCount = Math.ceil(actions.length / capacity)
  const actionStart = actionPage * capacity
  const turnLabel =
    turn?.turnNumber == null
      ? turn?.round == null
        ? 'Battle'
        : `Round ${turn.round}`
      : `${turn.round === null ? '' : `Round ${turn.round} · `}Turn ${turn.turnNumber}`

  useEffect(() => {
    const direction = pendingTurnFocus.current
    pendingTurnFocus.current = null
    if (direction === 'previous') previousTurnRef.current?.focus()
    if (direction === 'next') nextTurnRef.current?.focus()
  }, [turnIndex])
  useEffect(() => {
    const viewport = viewportRef.current
    const measurement = measurementRef.current
    if (!viewport || !measurement) return
    // Content equality avoids remeasuring pinned history when a live refetch creates new objects.
    const measuredBlocks = JSON.parse(blockSignature) as BattleActionReaderBlock[]
    let active = true
    let lastSignature: string | null = null
    let currentJob: AbortController | null = null
    const measure = () => {
      if (trackRef.current)
        setCapacity(Math.max(1, Math.floor((trackRef.current.clientWidth + 6) / 50)))
      const width = viewport.clientWidth
      const height = viewport.clientHeight
      if (width === 0 || height === 0) {
        lastSignature = null
        currentJob?.abort()
        measurement.replaceChildren()
        return
      }
      const font = getComputedStyle(viewport)
      const fontReady = document.fonts
        ? ['400 12px', '600 11px', '650 12px', 'italic 400 12px']
            .map((variant) => document.fonts.check(`${variant} ${font.fontFamily}`))
            .join(':')
        : 'ready'
      const signature = `${width}:${height}:${font.fontFamily}:${fontReady}`
      if (lastSignature === signature) return
      lastSignature = signature
      setPagination(null)
      currentJob?.abort()
      const job = new AbortController()
      currentJob = job
      let sliceStarted = performance.now()
      const fits = async (candidate: readonly BattleActionReaderBlock[]) => {
        if (performance.now() - sliceStarted >= 8) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
          sliceStarted = performance.now()
        }
        if (job.signal.aborted) return false
        const page = document.createElement('div')
        page.className = styles.page!
        for (const item of candidate) {
          const block = document.createElement('div')
          block.className = styles.block!
          block.dataset.readerPart = item.label
          const label = document.createElement('span')
          label.className = styles.blockLabel!
          label.textContent = item.label
          const text = document.createElement('p')
          text.textContent = item.text
          block.append(label, text)
          page.append(block)
        }
        measurement.replaceChildren(page)
        return page.getBoundingClientRect().height <= height
      }
      void (async () => {
        try {
          const measuredPages = await paginateBattleActionReader(measuredBlocks, fits, job.signal)
          if (active && !job.signal.aborted && currentJob === job)
            setPagination({ key: readerKey, pages: measuredPages ?? [] })
        } finally {
          if (active && currentJob === job) measurement.replaceChildren()
        }
      })()
    }
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    if (trackRef.current) observer.observe(trackRef.current)
    document.fonts?.addEventListener('loadingdone', measure)
    measure()
    return () => {
      active = false
      currentJob?.abort()
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', measure)
      measurement.replaceChildren()
    }
  }, [blockSignature, readerKey])

  function selectAction(index: number, targetTurnIndex = turnIndex) {
    const target = turns[targetTurnIndex]
    if (!target) return
    const action = target.actions[index]
    setSelection(
      targetTurnIndex === turns.length - 1 && index === target.actions.length - 1
        ? null
        : { turnKey: target.key, actionKey: action?.key ?? null },
    )
    setRequestedPage(null)
  }
  const reader = (
    <section
      className={styles.reader}
      aria-label="Recorded action result"
      data-selected-action={selected?.key}
    >
      <div
        ref={viewportRef}
        className={styles.readerViewport}
        data-battle-log-reading="true"
        data-measured={Boolean(selected) && pagination?.key === readerKey && pages.length > 0}
      >
        {selected ? (
          <ReaderPage blocks={pages[detailIndex] ?? []} />
        ) : (
          <p className={styles.empty}>No committed actions this turn yet.</p>
        )}
        <div ref={measurementRef} className={styles.measurement} aria-hidden="true" />
      </div>
      <div className={styles.detailControls} role="group" aria-label="Action details pages">
        <button
          type="button"
          aria-label="Previous details page"
          disabled={detailIndex <= 0}
          onClick={() => setRequestedPage({ key: readerKey, index: detailIndex - 1 })}
        >
          ‹
        </button>
        <span>
          Details {selected ? detailIndex + 1 : 0} / {selected ? pages.length : 0}
        </span>
        <button
          type="button"
          aria-label="Next details page"
          disabled={detailIndex >= pages.length - 1}
          onClick={() => setRequestedPage({ key: readerKey, index: detailIndex + 1 })}
        >
          ›
        </button>
      </div>
    </section>
  )
  return (
    <div
      className={styles.timeline}
      data-view={view}
      data-battle-log-reader="true"
      data-overflow={actions.length > capacity}
    >
      <div className={styles.turnHeader}>
        <span className={styles.turnLabel} title={turnLabel}>
          <span className={styles.turnLabelFull}>{turnLabel}</span>
          <span className={styles.turnLabelCompact} aria-label={turnLabel}>
            {turn?.turnNumber == null
              ? turn?.round == null
                ? 'Battle'
                : `R${turn.round}`
              : `T${turn.turnNumber}`}
          </span>
        </span>
        <div className={styles.turnControls} role="group" aria-label="Battle history turns">
          {turnIndex > 0 ? (
            <button
              type="button"
              ref={previousTurnRef}
              aria-label="Previous turn"
              onClick={() => {
                if (turnIndex === 1) pendingTurnFocus.current = 'next'
                selectAction((turns[turnIndex - 1]?.actions.length ?? 0) - 1, turnIndex - 1)
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
                selectAction((turns[turnIndex + 1]?.actions.length ?? 0) - 1, turnIndex + 1)
              }}
            >
              &gt;
            </button>
          ) : null}
        </div>
      </div>
      {view === 'timeline' ? (
        <ol ref={trackRef} className={styles.track} aria-label="Battle action timeline">
          {actions.slice(actionStart, actionStart + capacity).map((action, offset) => (
            <li key={action.key}>
              <button
                type="button"
                aria-label={`Action details: ${action.ariaLabel}`}
                aria-pressed={action.key === selected?.key}
                title={action.ariaLabel}
                onClick={() => selectAction(actionStart + offset)}
              >
                <span className={styles.art}>
                  <Image
                    src={artwork(action, entries)}
                    width={96}
                    height={96}
                    unoptimized
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = BATTLE_MISSING_ARTWORK
                    }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div
        className={styles.actionControls}
        role="group"
        aria-label={view === 'text' ? 'Battle history actions' : 'Battle action icon pages'}
      >
        {view === 'text' ? (
          <>
            <button
              type="button"
              aria-label="Previous action"
              disabled={actionIndex <= 0}
              onClick={() => selectAction(actionIndex - 1)}
            >
              ‹
            </button>
            <span>
              Action {selected ? actionIndex + 1 : 0} / {actions.length}
            </span>
            <button
              type="button"
              aria-label="Next action"
              disabled={actionIndex >= actions.length - 1}
              onClick={() => selectAction(actionIndex + 1)}
            >
              ›
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="Previous actions"
              disabled={actionPage === 0}
              onClick={() => selectAction(actionStart - 1)}
            >
              ‹
            </button>
            <span>
              {pageCount > 1
                ? `Actions ${actionStart + 1}–${Math.min(actionStart + capacity, actions.length)} / ${actions.length}`
                : `${actions.length} action${actions.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              aria-label="Next actions"
              disabled={actionPage >= pageCount - 1}
              onClick={() => selectAction(actionStart + capacity)}
            >
              ›
            </button>
          </>
        )}
      </div>
      {view === 'text' ? (
        <ol className={styles.transcript} aria-label="Battle action transcript">
          <li>{reader}</li>
        </ol>
      ) : (
        reader
      )}
    </div>
  )
}
