'use client'
import { useRef, useState } from 'react'
import type {
  ActiveModerationBan,
  ActiveModerationBans,
  ModerationPlayer,
  ModerationRecord,
} from '@/master/moderation'
import styles from './moderation-workspace.module.css'

function timestamp(value: string) {
  return new Date(value).toLocaleString()
}
function remainingBanHours(expiresAt: string): string {
  return String(Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / 3600000)))
}
export function ModerationWorkspace({
  initialBans = { bans: [], nextCursor: null },
}: {
  initialBans?: ActiveModerationBans
}) {
  const [activeBans, setActiveBans] = useState(initialBans)
  const [query, setQuery] = useState(''),
    [players, setPlayers] = useState<ModerationPlayer[]>([])
  const [selected, setSelected] = useState<ModerationPlayer | null>(null),
    [record, setRecord] = useState<ModerationRecord | null>(null)
  const [duration, setDuration] = useState('24'),
    [unit, setUnit] = useState('60'),
    [permanent, setPermanent] = useState(false),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const mutationPending = useRef(false)
  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/master/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error?.message ?? 'Moderation is unavailable.')
    return payload
  }
  async function search() {
    const sequence = ++requestSequence.current
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await post({ operation: 'search', query })
      if (sequence === requestSequence.current) setPlayers(payload.players)
    } catch (caught) {
      if (sequence === requestSequence.current)
        setError(caught instanceof Error ? caught.message : 'Search failed.')
    } finally {
      if (sequence === requestSequence.current) setPending(false)
    }
  }
  async function refreshBans(append = false) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const payload = await post({
        operation: 'active',
        after: append ? activeBans.nextCursor : null,
      })
      setActiveBans(
        append
          ? {
              ...payload.active,
              bans: [
                ...new Map(
                  [...activeBans.bans, ...payload.active.bans].map((ban: ActiveModerationBan) => [
                    ban.userId,
                    ban,
                  ]),
                ).values(),
              ],
            }
          : payload.active,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Active bans could not be refreshed.')
    } finally {
      setPending(false)
    }
  }
  async function liftBan(ban: Pick<ActiveModerationBan, 'userId' | 'revision' | 'protected'>) {
    if (pending || mutationPending.current || ban.protected) return
    mutationPending.current = true
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await post({
        operation: 'lift',
        targetUserId: ban.userId,
        expectedRevision: ban.revision,
      })
      if (record?.userId === ban.userId) setRecord(payload.record)
      setActiveBans((current) => ({
        ...current,
        bans: current.bans.filter((row) => row.userId !== ban.userId),
      }))
      setConfirmed(false)
      setReason('')
      setNotice('Ban lifted.')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Ban could not be lifted. Refresh before retrying.',
      )
    } finally {
      mutationPending.current = false
      setPending(false)
    }
  }
  async function choose(player: ModerationPlayer, refresh = false) {
    const sequence = ++requestSequence.current
    setSelected(player)
    if (!refresh) setRecord(null)
    setConfirmed(false)
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await post({ operation: 'read', targetUserId: player.userId })
      if (sequence !== requestSequence.current) return
      setRecord(payload.record)
      setPermanent(payload.record.permanent)
      setReason('')
      setDuration(payload.record.expiresAt ? remainingBanHours(payload.record.expiresAt) : '24')
      setUnit('60')
    } catch (caught) {
      if (sequence === requestSequence.current)
        setError(caught instanceof Error ? caught.message : 'Player could not be loaded.')
    } finally {
      if (sequence === requestSequence.current) setPending(false)
    }
  }
  const minutes = Number(duration) * Number(unit)
  const validDuration =
    permanent || (Number.isSafeInteger(minutes) && minutes >= 1 && minutes <= 52560000)
  const editable = !!record && !record.protected && !selected?.protected
  async function save() {
    if (
      !selected ||
      !record ||
      !confirmed ||
      !editable ||
      !reason.trim() ||
      !validDuration ||
      pending ||
      mutationPending.current
    )
      return
    mutationPending.current = true
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await post({
        operation: 'write',
        targetUserId: selected.userId,
        expectedRevision: record.revision,
        action: record.active ? 'edit' : 'ban',
        reason,
        minutes: permanent ? null : minutes,
        permanent,
        confirmed,
      })
      setRecord(payload.record)
      setPermanent(payload.record.permanent)
      setConfirmed(false)
      setReason('')
      setNotice('Ban saved. Duration starts from this save.')
      try {
        setActiveBans((await post({ operation: 'active' })).active)
      } catch {
        setError('Ban saved, but the active list could not refresh. Use Refresh bans to reload it.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ban could not be saved.')
    } finally {
      mutationPending.current = false
      setPending(false)
    }
  }
  async function loadOlder() {
    if (!selected || !record?.nextCursor || pending) return
    const sequence = requestSequence.current
    setPending(true)
    setError(null)
    try {
      const payload = await post({
        operation: 'read',
        targetUserId: selected.userId,
        before: record.nextCursor,
      })
      if (sequence !== requestSequence.current) return
      const older = payload.record as ModerationRecord
      if (older.revision !== record.revision)
        throw new Error('Moderation changed. Refresh this player before loading older history.')
      setRecord({
        ...record,
        history: [...record.history, ...older.history],
        nextCursor: older.nextCursor,
      })
    } catch (caught) {
      if (sequence === requestSequence.current)
        setError(caught instanceof Error ? caught.message : 'Older history could not be loaded.')
    } finally {
      if (sequence === requestSequence.current) setPending(false)
    }
  }
  return (
    <div className={styles.workspace}>
      <section className={styles.directory} aria-labelledby="moderation-search-title">
        <h2 id="moderation-search-title">Find a player</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void search()
          }}
        >
          <label htmlFor="moderation-query">Character name</label>
          <div className={styles.search}>
            <input
              id="moderation-query"
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
            <button disabled={pending || query.trim().length < 2}>Search</button>
          </div>
        </form>
        <p className={styles.hint}>Bans apply to the verified account and all its characters.</p>
        <div className={styles.results}>
          {players.map((player) => (
            <button
              type="button"
              key={player.characterId}
              aria-pressed={selected?.characterId === player.characterId}
              disabled={pending}
              onClick={() => void choose(player)}
            >
              <strong>{player.name}</strong>
              {player.protected && <span>Protected Owner</span>}
            </button>
          ))}
          {!pending && players.length === 0 && (
            <p>Search by at least two characters. Up to 20 matches.</p>
          )}
        </div>
      </section>
      <section
        className={styles.detail}
        aria-labelledby="moderation-detail-title"
        aria-busy={pending}
      >
        <div className={styles.heading}>
          <h2 id="moderation-detail-title">{selected?.name ?? 'Active bans'}</h2>
          {!selected && (
            <button type="button" disabled={pending} onClick={() => void refreshBans()}>
              Refresh bans
            </button>
          )}
          {selected && (
            <div className={styles.actions}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setSelected(null)
                  setRecord(null)
                  setNotice(null)
                }}
              >
                Active bans
              </button>
              <button type="button" disabled={pending} onClick={() => void choose(selected, true)}>
                Refresh player
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {pending && <p role="status">Loading moderation…</p>}
        {!selected && (
          <>
            {activeBans.bans.length ? (
              <ul className={styles.activeBans}>
                {activeBans.bans.map((ban) => (
                  <li key={ban.userId}>
                    <div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void choose({
                            userId: ban.userId,
                            characterId: ban.characterId ?? '',
                            name: ban.name,
                            protected: ban.protected,
                          })
                        }
                      >
                        {ban.name}
                      </button>
                      <p>{ban.permanent ? 'Permanent' : `Until ${timestamp(ban.expiresAt!)}`}</p>
                      <p>{ban.reason}</p>
                    </div>
                    <button
                      type="button"
                      disabled={pending || ban.protected}
                      aria-label={`Lift ban for ${ban.name}`}
                      onClick={() => void liftBan(ban)}
                    >
                      Lift ban
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No active bans.</p>
            )}
            {activeBans.nextCursor && (
              <button type="button" disabled={pending} onClick={() => void refreshBans(true)}>
                Load more bans
              </button>
            )}
          </>
        )}
        {record && (
          <>
            <p className={styles.status}>
              {record.protected
                ? 'Protected account'
                : record.active
                  ? record.permanent
                    ? 'Permanently banned'
                    : `Banned until ${timestamp(record.expiresAt!)}`
                  : 'No active ban'}
            </p>
            {editable && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void save()
                }}
              >
                <fieldset disabled={pending}>
                  <legend>{record.active ? 'Edit or extend ban' : 'Apply a ban'}</legend>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={permanent}
                      onChange={(event) => {
                        setPermanent(event.target.checked)
                        setConfirmed(false)
                      }}
                    />
                    Permanent ban
                  </label>
                  {!permanent && (
                    <div className={styles.duration}>
                      <label htmlFor="ban-duration">
                        Duration
                        <input
                          id="ban-duration"
                          type="number"
                          min="1"
                          step="1"
                          value={duration}
                          onChange={(event) => {
                            setDuration(event.target.value)
                            setConfirmed(false)
                          }}
                        />
                      </label>
                      <label htmlFor="ban-duration-unit">
                        Unit
                        <select
                          id="ban-duration-unit"
                          aria-label="Duration unit"
                          value={unit}
                          onChange={(event) => {
                            setUnit(event.target.value)
                            setConfirmed(false)
                          }}
                        >
                          <option value="1">Minutes</option>
                          <option value="60">Hours</option>
                          <option value="1440">Days</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {!validDuration && (
                    <p className={styles.error}>
                      Enter a whole duration from 1 minute to 100 years.
                    </p>
                  )}
                  <p className={styles.hint}>
                    The duration begins when saved. To extend a ban, enter its complete new
                    remaining duration.
                  </p>
                  <label htmlFor="ban-reason">
                    Reason
                    <textarea
                      id="ban-reason"
                      rows={3}
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value)
                        setConfirmed(false)
                      }}
                      required
                    />
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    Confirm this account moderation change.
                  </label>
                  <div className={styles.actions}>
                    <button disabled={!confirmed || !reason.trim() || !validDuration}>
                      {record.active ? 'Save ban changes' : 'Apply ban'}
                    </button>
                    {record.active && (
                      <button type="button" disabled={pending} onClick={() => void liftBan(record)}>
                        Lift ban
                      </button>
                    )}
                  </div>
                </fieldset>
              </form>
            )}
            <h3>
              History <small>Newest first</small>
            </h3>
            <ol className={styles.history}>
              {record.history.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>
                      {entry.action === 'ban'
                        ? 'Ban applied'
                        : entry.action === 'edit'
                          ? 'Ban edited'
                          : 'Ban lifted'}
                    </strong>
                    <span>{entry.actor}</span>
                    <time dateTime={entry.occurredAt}>{timestamp(entry.occurredAt)}</time>
                  </div>
                  <p>{entry.reason}</p>
                  <small>
                    {entry.until === 'Permanent' || entry.until === 'Lifted'
                      ? entry.until
                      : `Until ${timestamp(entry.until)}`}
                  </small>
                </li>
              ))}
            </ol>
            {record.nextCursor && (
              <button type="button" disabled={pending} onClick={() => void loadOlder()}>
                Load older history
              </button>
            )}
            {record.history.length === 0 && <p>No moderation actions recorded.</p>}
          </>
        )}
      </section>
    </div>
  )
}
