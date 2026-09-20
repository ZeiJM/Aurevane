'use client'

import { useEffect, useMemo, useState } from 'react'

import styles from './event-operations.module.css'

interface RunSummary {
  runId: string
  eventKey: string
  lifecycleStatus: string
  stateVersion: number
  scopeType: string
  scopeKey: string | null
  currentPhaseId: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  startedAt: string | null
  cleanupStatus: string
  updatedAt: string
}

interface Dashboard {
  run: {
    runId: string
    eventKey: string
    definitionVersionId: string
    lifecycleStatus: string
    stateVersion: number
    scopeType: string
    scopeKey: string | null
    currentPhaseId: string | null
    scheduledStartAt: string | null
    scheduledEndAt: string | null
    startedAt: string | null
    pausedAt: string | null
    resolvingAt: string | null
    endedAt: string | null
    archivedAt: string | null
    cancelledAt: string | null
    emergencyStoppedAt: string | null
    cleanupStatus: string
    cleanupRequiredAt: string | null
    cleanupCompletedAt: string | null
    updatedAt: string
  }
  activeEffects: Array<{
    type?: string
    referenceKey?: string
    enabled?: boolean
  }>
  phases: Array<{
    phaseId: string
    ordinal: number
    status: string
    startedAt: string | null
    completedAt: string | null
    stateVersion: number
    objectives: Array<{
      objectiveId: string
      status: string
      progress: number
      target: number
      stateVersion: number
      updatedAt: string
    }>
  }>
  participants: Array<{
    characterId: string
    firstParticipatedAt: string
    lastContributedAt: string | null
    contributionCount: number
    contributionTotal: number
  }>
  claims: Array<{
    reservationId: string
    characterId: string
    rewardPackageRef: string
    reservedAt: string
    executed: boolean
    executedAt: string | null
    appliedAmount: number | null
  }>
  cleanupRequirements: Array<{
    phaseId: string
    effectOrdinal: number
    effectType: string
    referenceKey: string
    enabled: boolean
    status: string
    completedAt: string | null
    completion: unknown | null
  }>
  chronicle: Record<string, unknown> | null
}

interface Props {
  canEmergencyStop: boolean
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/master/event-operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined
    throw new Error(error?.message ?? 'Live Event operation failed.')
  }
  return payload
}

function when(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString()
}

export function EventOperationsClient({ canEmergencyStop }: Props) {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [message, setMessage] = useState('Loading Event operations…')
  const [operationReason, setOperationReason] = useState('')
  const [operationConfirmed, setOperationConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [runQuery, setRunQuery] = useState('')

  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId) ?? null,
    [runs, selectedRunId],
  )

  const visibleRuns = useMemo(() => {
    const query = runQuery.trim().toLowerCase()
    if (!query) return runs
    return runs.filter((run) =>
      [run.eventKey, run.runId, run.lifecycleStatus, run.scopeKey ?? run.scopeType]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [runQuery, runs])

  const operationReady =
    operationConfirmed &&
    operationReason.length >= 3 &&
    operationReason.length <= 240 &&
    operationReason.trim() === operationReason

  async function loadRuns(preferredRunId?: string) {
    const payload = await post({ operation: 'list' })
    const nextRuns = (payload.runs ?? []) as RunSummary[]
    setRuns(nextRuns)
    const nextSelected =
      preferredRunId && nextRuns.some((run) => run.runId === preferredRunId)
        ? preferredRunId
        : selectedRunId && nextRuns.some((run) => run.runId === selectedRunId)
          ? selectedRunId
          : (nextRuns[0]?.runId ?? '')
    setSelectedRunId(nextSelected)
    if (!nextSelected) {
      setDashboard(null)
      setMessage('No Production Event Runs are available.')
    }
    return nextSelected
  }

  async function loadDashboard(runId = selectedRunId) {
    if (!runId) return
    const payload = await post({ operation: 'read', runId })
    setDashboard(payload.dashboard as Dashboard)
    setMessage('Live Event state refreshed.')
  }

  async function refresh(preferredRunId?: string) {
    setBusy(true)
    try {
      const runId = await loadRuns(preferredRunId)
      if (runId) await loadDashboard(runId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh Event operations.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void refresh()
    })
    return () => {
      cancelled = true
    }
    // Initial authority/state load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function mutate(body: Record<string, unknown>, success: string) {
    if (!dashboard) return
    setBusy(true)
    setMessage('Applying authoritative Event operation…')
    try {
      await post(body)
      await refresh(dashboard.run.runId)
      setOperationConfirmed(false)
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Event operation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function operate(command: string, label: string) {
    if (!dashboard) return
    await mutate(
      {
        operation: 'operate',
        runId: dashboard.run.runId,
        expectedStateVersion: dashboard.run.stateVersion,
        idempotencyKey: crypto.randomUUID(),
        command,
        reason: operationReason,
        confirmed: operationConfirmed,
      },
      `${label} completed.`,
    )
  }

  async function advancePhase() {
    if (!dashboard) return
    await mutate(
      {
        operation: 'advance-phase',
        runId: dashboard.run.runId,
        expectedStateVersion: dashboard.run.stateVersion,
        idempotencyKey: crypto.randomUUID(),
        reason: operationReason,
        confirmed: operationConfirmed,
      },
      'Event phase advanced.',
    )
  }

  async function completeCleanup(phaseId: string, effectOrdinal: number) {
    if (!dashboard) return
    await mutate(
      {
        operation: 'complete-cleanup',
        runId: dashboard.run.runId,
        phaseId,
        effectOrdinal,
        completionKey: crypto.randomUUID(),
        reason: operationReason,
        confirmed: operationConfirmed,
      },
      'Cleanup requirement completed.',
    )
  }

  const status = dashboard?.run.lifecycleStatus ?? selectedRun?.lifecycleStatus ?? ''
  const cleanupPending =
    dashboard?.cleanupRequirements.some((entry) => entry.status === 'pending') ?? false
  const cleanupCompleted =
    dashboard?.cleanupRequirements.filter((entry) => entry.status === 'completed').length ?? 0
  const lifecycleStages = ['scheduled', 'live', 'resolving', 'ended', 'archived'] as const
  const lifecycleIndex = Math.max(
    0,
    lifecycleStages.indexOf(
      status === 'paused'
        ? 'live'
        : status === 'cancelled' || status === 'emergency-stopped'
          ? 'ended'
          : (status as (typeof lifecycleStages)[number]),
    ),
  )

  return (
    <section className={styles.operations}>
      <aside className={styles.runNavigator} aria-label="Live operations navigator">
        <header className={styles.navigatorHeader}>
          <div>
            <p className={styles.eyebrow}>Operations console</p>
            <h2>Event runs</h2>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={busy}>
            Refresh
          </button>
        </header>

        <label className={styles.runSearch}>
          <span>Search runs</span>
          <input
            value={runQuery}
            onChange={(event) => setRunQuery(event.target.value)}
            placeholder="Event, run, status…"
          />
        </label>

        <label className={styles.runSelect}>
          <span>Event Run</span>
          <select
            aria-label="Event Run"
            value={selectedRunId}
            onChange={(event) => {
              const runId = event.target.value
              setSelectedRunId(runId)
              void loadDashboard(runId)
            }}
            disabled={busy || runs.length === 0}
          >
            {runs.map((run) => (
              <option key={run.runId} value={run.runId}>
                {run.eventKey} · {run.lifecycleStatus} · {run.runId.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.runList}>
          {visibleRuns.map((run) => (
            <button
              type="button"
              key={run.runId}
              className={styles.runRow}
              data-selected={run.runId === selectedRunId || undefined}
              onClick={() => {
                setSelectedRunId(run.runId)
                void loadDashboard(run.runId)
              }}
            >
              <span className={styles.runGlyph} aria-hidden="true">
                {run.lifecycleStatus === 'live'
                  ? '✦'
                  : run.lifecycleStatus === 'scheduled'
                    ? '◇'
                    : '✧'}
              </span>
              <span className={styles.runIdentity}>
                <strong>{run.eventKey}</strong>
                <small>
                  {run.runId.slice(0, 8)} · {when(run.scheduledStartAt ?? run.startedAt)}
                </small>
              </span>
              <span className={styles.runStatus} data-status={run.lifecycleStatus}>
                {run.lifecycleStatus}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className={styles.operationWorkspace}>
        {dashboard ? (
          <>
            <header className={styles.runHeader}>
              <div className={styles.runHeaderIcon} aria-hidden="true">
                ✦
              </div>
              <div className={styles.runHeaderIdentity}>
                <p className={styles.eyebrow}>Authoritative Event Run</p>
                <h2>{dashboard.run.eventKey}</h2>
                <p>
                  <code>{dashboard.run.runId.slice(0, 12)}</code>
                  <span data-status={dashboard.run.lifecycleStatus}>
                    {dashboard.run.lifecycleStatus}
                  </span>
                  <span>State v{dashboard.run.stateVersion}</span>
                </p>
              </div>
              <strong className={styles.workspaceMessage}>{message}</strong>
            </header>

            <nav className={styles.workspaceTabs} aria-label="Live Event workspace">
              <a href="#event-overview">Overview</a>
              <a href="#event-phases">Objectives</a>
              <a href="#event-participants">Participants</a>
              <a href="#event-cleanup">Cleanup</a>
              <a href="#event-rewards">Rewards</a>
            </nav>

            <section className={styles.overviewPanel} id="event-overview">
              <div className={styles.overviewFacts}>
                <div>
                  <span>Scope</span>
                  <strong>
                    {dashboard.run.scopeType}
                    {dashboard.run.scopeKey ? ` · ${dashboard.run.scopeKey}` : ''}
                  </strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{dashboard.run.lifecycleStatus}</strong>
                </div>
                <div>
                  <span>Current phase</span>
                  <strong>{dashboard.run.currentPhaseId ?? '—'}</strong>
                </div>
                <div>
                  <span>Scheduled</span>
                  <strong>{when(dashboard.run.scheduledStartAt)}</strong>
                </div>
                <div>
                  <span>Started</span>
                  <strong>{when(dashboard.run.startedAt)}</strong>
                </div>
                <div>
                  <span>Cleanup</span>
                  <strong>{dashboard.run.cleanupStatus}</strong>
                </div>
              </div>

              <div className={styles.lifecycle}>
                <h3>Event lifecycle</h3>
                <div className={styles.lifecycleTrack}>
                  {lifecycleStages.map((stage, index) => (
                    <div
                      key={stage}
                      className={styles.lifecycleStep}
                      data-active={index === lifecycleIndex || undefined}
                      data-complete={index < lifecycleIndex || undefined}
                    >
                      <span aria-hidden="true">
                        {index < lifecycleIndex ? '✓' : index === lifecycleIndex ? '●' : '○'}
                      </span>
                      <strong>{stage}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.card} id="event-phases">
              <div className={styles.cardHeading}>
                <div>
                  <p className={styles.eyebrow}>Run progress</p>
                  <h2>Phases &amp; objectives</h2>
                </div>
                <span>{dashboard.phases.length} phases</span>
              </div>
              <div className={styles.phaseGrid}>
                {dashboard.phases.map((phase) => (
                  <article key={phase.phaseId} className={styles.phase}>
                    <header>
                      <strong>{phase.phaseId}</strong>
                      <span>{phase.status}</span>
                    </header>
                    {phase.objectives.length === 0 ? <p>No objectives.</p> : null}
                    {phase.objectives.map((objective) => (
                      <div key={objective.objectiveId} className={styles.objective}>
                        <span>{objective.objectiveId}</span>
                        <strong>
                          {objective.progress} / {objective.target}
                        </strong>
                        <small>{objective.status}</small>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <p className={styles.eyebrow}>Typed runtime</p>
                  <h2>Active effects</h2>
                </div>
                <span>{dashboard.activeEffects.length}</span>
              </div>
              {dashboard.activeEffects.length === 0 ? <p>No active effect references.</p> : null}
              <div className={styles.itemList}>
                {dashboard.activeEffects.map((effect, index) => (
                  <div key={`${effect.referenceKey ?? 'effect'}-${index}`}>
                    <strong>{effect.type ?? 'effect'}</strong>
                    <span>{effect.referenceKey ?? '—'}</span>
                    <small>{effect.enabled === false ? 'disabled' : 'enabled'}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card} id="event-participants">
              <div className={styles.cardHeading}>
                <div>
                  <p className={styles.eyebrow}>Participation</p>
                  <h2>Participant ledger</h2>
                </div>
                <span>{dashboard.participants.length}</span>
              </div>
              {dashboard.participants.length === 0 ? <p>No participants yet.</p> : null}
              <div className={styles.itemList}>
                {dashboard.participants.map((participant) => (
                  <div key={participant.characterId}>
                    <strong>{participant.characterId.slice(0, 8)}</strong>
                    <span>
                      {participant.contributionCount} contributions ·{' '}
                      {participant.contributionTotal} total
                    </span>
                    <small>
                      {when(participant.lastContributedAt ?? participant.firstParticipatedAt)}
                    </small>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card} id="event-rewards">
              <div className={styles.cardHeading}>
                <div>
                  <p className={styles.eyebrow}>Rewards</p>
                  <h2>Reward claims</h2>
                </div>
                <span>{dashboard.claims.length}</span>
              </div>
              {dashboard.claims.length === 0 ? <p>No reward claims reserved.</p> : null}
              <div className={styles.itemList}>
                {dashboard.claims.map((claim) => (
                  <div key={claim.reservationId}>
                    <strong>{claim.rewardPackageRef}</strong>
                    <span>
                      {claim.executed ? 'executed' : 'reserved'} · character{' '}
                      {claim.characterId.slice(0, 8)}
                    </span>
                    <small>
                      {claim.executedAt ? when(claim.executedAt) : when(claim.reservedAt)}
                    </small>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card} id="event-cleanup">
              <div className={styles.cardHeading}>
                <div>
                  <p className={styles.eyebrow}>Closure</p>
                  <h2>Cleanup requirements</h2>
                </div>
                <span>
                  {cleanupCompleted}/{dashboard.cleanupRequirements.length}
                </span>
              </div>
              {dashboard.cleanupRequirements.length === 0 ? <p>No cleanup requirements.</p> : null}
              <div className={styles.itemList}>
                {dashboard.cleanupRequirements.map((cleanup) => (
                  <div key={`${cleanup.phaseId}-${cleanup.effectOrdinal}`}>
                    <strong>{cleanup.effectType}</strong>
                    <span>
                      {cleanup.referenceKey} · {cleanup.status}
                    </span>
                    {cleanup.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => void completeCleanup(cleanup.phaseId, cleanup.effectOrdinal)}
                        disabled={busy || !operationReady}
                      >
                        Confirm cleanup completed
                      </button>
                    ) : (
                      <small>{when(cleanup.completedAt)}</small>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {dashboard.chronicle ? (
              <section className={styles.card}>
                <div className={styles.cardHeading}>
                  <div>
                    <p className={styles.eyebrow}>Immutable record</p>
                    <h2>Chronicle snapshot</h2>
                  </div>
                </div>
                <pre>{JSON.stringify(dashboard.chronicle, null, 2)}</pre>
              </section>
            ) : null}
          </>
        ) : (
          <section className={styles.emptyOperations}>
            <h2>No run selected</h2>
            <p>{message}</p>
          </section>
        )}
      </div>

      <aside className={styles.operationDock}>
        <section className={styles.dockCard}>
          <div className={styles.dockHeading}>
            <h2>Live monitoring</h2>
            <span data-status={status}>{status || 'idle'}</span>
          </div>
          <div className={styles.metricGrid}>
            <div>
              <strong>{dashboard?.participants.length ?? 0}</strong>
              <span>Participants</span>
            </div>
            <div>
              <strong>{dashboard?.activeEffects.length ?? 0}</strong>
              <span>Active effects</span>
            </div>
            <div>
              <strong>
                {dashboard?.phases.filter((phase) => phase.status === 'active').length ?? 0}
              </strong>
              <span>Active phases</span>
            </div>
            <div>
              <strong>{dashboard?.claims.filter((claim) => claim.executed).length ?? 0}</strong>
              <span>Claims executed</span>
            </div>
          </div>
        </section>

        <section className={styles.dockCard}>
          <div className={styles.dockHeading}>
            <h2>Safe operator actions</h2>
            <span>Confirmed</span>
          </div>
          <label className={styles.approvalField}>
            Operation reason
            <textarea
              value={operationReason}
              maxLength={240}
              onChange={(event) => {
                setOperationReason(event.target.value)
                setOperationConfirmed(false)
              }}
              placeholder="Why is this live Event operation being performed?"
            />
          </label>
          <label className={styles.approvalCheck}>
            <input
              type="checkbox"
              checked={operationConfirmed}
              onChange={(event) => setOperationConfirmed(event.target.checked)}
            />
            Confirm live operation
          </label>

          <div className={styles.actionRow}>
            {status === 'scheduled' ? (
              <button
                type="button"
                onClick={() => void operate('start', 'start')}
                disabled={busy || !operationReady}
              >
                Start due run
              </button>
            ) : null}
            {status === 'live' ? (
              <>
                <button
                  type="button"
                  onClick={() => void operate('pause', 'pause')}
                  disabled={busy || !operationReady}
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => void advancePhase()}
                  disabled={busy || !operationReady}
                >
                  Advance phase
                </button>
                <button
                  type="button"
                  onClick={() => void operate('stop', 'graceful stop')}
                  disabled={busy || !operationReady}
                >
                  Stop / resolve
                </button>
              </>
            ) : null}
            {status === 'paused' ? (
              <>
                <button
                  type="button"
                  onClick={() => void operate('resume', 'resume')}
                  disabled={busy || !operationReady}
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => void operate('stop', 'graceful stop')}
                  disabled={busy || !operationReady}
                >
                  Stop / resolve
                </button>
              </>
            ) : null}
            {status === 'resolving' ? (
              <button
                type="button"
                onClick={() => void operate('end', 'end')}
                disabled={busy || !operationReady}
              >
                End run
              </button>
            ) : null}
            {['scheduled', 'live', 'paused', 'resolving'].includes(status) && canEmergencyStop ? (
              <button
                type="button"
                className={styles.danger}
                onClick={() => void operate('emergency-stop', 'emergency stop')}
                disabled={busy || !operationReady}
              >
                Emergency stop
              </button>
            ) : null}
            {['ended', 'cancelled', 'emergency-stopped'].includes(status) ? (
              <button
                type="button"
                onClick={() => void operate('archive', 'archive')}
                disabled={busy || cleanupPending || !operationReady}
              >
                Archive
              </button>
            ) : null}
          </div>
          {cleanupPending ? (
            <p className={styles.notice}>
              Archive is blocked until every pinned typed cleanup requirement is confirmed.
            </p>
          ) : null}
        </section>

        <section className={styles.dockCard}>
          <div className={styles.dockHeading}>
            <h2>Cleanup status</h2>
            <span>{dashboard?.run.cleanupStatus ?? '—'}</span>
          </div>
          <dl className={styles.compactFacts}>
            <div>
              <dt>Completed</dt>
              <dd>{cleanupCompleted}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>
                {dashboard?.cleanupRequirements.filter((entry) => entry.status === 'pending')
                  .length ?? 0}
              </dd>
            </div>
            <div>
              <dt>Claims</dt>
              <dd>{dashboard?.claims.length ?? 0}</dd>
            </div>
            <div>
              <dt>State version</dt>
              <dd>{dashboard?.run.stateVersion ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </section>
  )
}
