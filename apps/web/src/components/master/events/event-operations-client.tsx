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

  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId) ?? null,
    [runs, selectedRunId],
  )

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

  return (
    <section className={styles.operations}>
      <header className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>Operations console</p>
          <h1>Event runs</h1>
          <p>
            Server-authoritative run state, phase progress, participation, claims, cleanup and
            Chronicle history.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy}>
          Refresh
        </button>
      </header>

      <section className={styles.selector}>
        <label>
          Event Run
          <select
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
        <strong className={styles.status}>{message}</strong>
      </section>

      {dashboard ? (
        <>
          <section className={styles.summaryGrid}>
            <article className={styles.card}>
              <h2>Run state</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{dashboard.run.lifecycleStatus}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{dashboard.run.stateVersion}</dd>
                </div>
                <div>
                  <dt>Scope</dt>
                  <dd>
                    {dashboard.run.scopeType}
                    {dashboard.run.scopeKey ? ` · ${dashboard.run.scopeKey}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Current phase</dt>
                  <dd>{dashboard.run.currentPhaseId ?? '—'}</dd>
                </div>
                <div>
                  <dt>Scheduled</dt>
                  <dd>{when(dashboard.run.scheduledStartAt)}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{when(dashboard.run.startedAt)}</dd>
                </div>
                <div>
                  <dt>Cleanup</dt>
                  <dd>{dashboard.run.cleanupStatus}</dd>
                </div>
              </dl>
            </article>

            <article className={styles.card}>
              <h2>Participants &amp; claims</h2>
              <dl>
                <div>
                  <dt>Participants</dt>
                  <dd>{dashboard.participants.length}</dd>
                </div>
                <div>
                  <dt>Contributions</dt>
                  <dd>
                    {dashboard.participants.reduce(
                      (sum, entry) => sum + entry.contributionCount,
                      0,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Contribution total</dt>
                  <dd>
                    {dashboard.participants.reduce(
                      (sum, entry) => sum + entry.contributionTotal,
                      0,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Claim reservations</dt>
                  <dd>{dashboard.claims.length}</dd>
                </div>
                <div>
                  <dt>Executed claims</dt>
                  <dd>{dashboard.claims.filter((claim) => claim.executed).length}</dd>
                </div>
              </dl>
            </article>
          </section>

          <section className={styles.controls}>
            <h2>Live operation confirmation</h2>
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
            <h2>Lifecycle controls</h2>
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

          <section className={styles.card}>
            <h2>Phases &amp; objectives</h2>
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
            <h2>Active typed effects</h2>
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

          <section className={styles.card}>
            <h2>Participant ledger</h2>
            {dashboard.participants.length === 0 ? <p>No participants yet.</p> : null}
            <div className={styles.itemList}>
              {dashboard.participants.map((participant) => (
                <div key={participant.characterId}>
                  <strong>{participant.characterId.slice(0, 8)}</strong>
                  <span>
                    {participant.contributionCount} contributions · {participant.contributionTotal}{' '}
                    total
                  </span>
                  <small>
                    {when(participant.lastContributedAt ?? participant.firstParticipatedAt)}
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <h2>Reward claims</h2>
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

          <section className={styles.card}>
            <h2>Cleanup</h2>
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
              <h2>Chronicle snapshot</h2>
              <pre>{JSON.stringify(dashboard.chronicle, null, 2)}</pre>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
