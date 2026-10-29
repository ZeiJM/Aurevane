'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
interface Player {
  accountId: string
  characterId?: string
  name: string
}
async function command<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/master/discipline-player-grants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error?.message ?? data.message ?? 'Player grants are unavailable.')
  return data.result as T
}
export function DisciplinePlayerGrants({ disciplineId }: { disciplineId: string }) {
  return <DisciplinePlayerGrantEditor key={disciplineId} disciplineId={disciplineId} />
}
function DisciplinePlayerGrantEditor({ disciplineId }: { disciplineId: string }) {
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<Player[]>([]),
    [selected, setSelected] = useState<Player[]>([]),
    [grants, setGrants] = useState<Player[]>([]),
    [reason, setReason] = useState(''),
    [reasonError, setReasonError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false)
  const active = useRef(false)
  const pending = useRef(false)
  const reasonInput = useRef<HTMLInputElement>(null)
  const reasonId = useId()
  const refresh = useCallback(
    async (after?: string) => {
      const rows = await command<Player[]>({
        operation: 'read',
        disciplineId,
        ...(after ? { after } : {}),
      })
      if (!active.current) return
      setGrants((previous) => (after ? [...previous, ...rows] : rows))
      setMore(rows.length === 100)
    },
    [disciplineId],
  )
  useEffect(() => {
    active.current = true
    void refresh().catch((e) => {
      if (active.current) setError(String(e.message))
    })
    return () => {
      active.current = false
    }
  }, [refresh])
  async function search() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const rows = await command<Player[]>({ operation: 'search', query })
      if (active.current) setResults(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function write(operation: 'grant' | 'revoke', players: Player[]) {
    if (pending.current) return
    setError('')
    setReasonError('')
    const auditReason = reason.trim()
    if (!auditReason) {
      setReasonError(
        operation === 'revoke'
          ? 'Enter a reason to revoke this grant.'
          : 'Enter a reason to grant access.',
      )
      reasonInput.current?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    try {
      await command({
        operation,
        disciplineId,
        accountIds: players.map((p) => p.accountId),
        reason: auditReason,
      })
      if (active.current) {
        setSelected([])
        await refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grant change failed.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <fieldset>
      <legend>Grant to player</legend>
      <p>
        Unlocks selection for verified accounts. Earned Mastery and Skill progression stay separate.
      </p>
      <label>
        Player name
        <input value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={busy || query.trim().length < 2}
        onClick={() => void search()}
      >
        Search players
      </button>
      {results.map((player) => (
        <label key={player.characterId ?? player.accountId}>
          <input
            type="checkbox"
            checked={selected.some((p) => p.accountId === player.accountId)}
            disabled={busy}
            onChange={(event) =>
              setSelected((current) =>
                event.target.checked
                  ? [...current.filter((p) => p.accountId !== player.accountId), player]
                  : current.filter((p) => p.accountId !== player.accountId),
              )
            }
          />
          {player.name}
        </label>
      ))}
      {selected.length > 0 && <p>{selected.map((p) => p.name).join(', ')}</p>}
      <label>
        Reason (required)
        <input
          ref={reasonInput}
          value={reason}
          maxLength={500}
          disabled={busy}
          aria-required="true"
          aria-invalid={Boolean(reasonError)}
          aria-describedby={`${reasonId}-help${reasonError ? ` ${reasonId}-error` : ''}`}
          onChange={(event) => {
            setReason(event.target.value)
            setReasonError('')
          }}
        />
      </label>
      <p id={`${reasonId}-help`}>
        Required when granting or revoking access. Saved in the audit history.
      </p>
      {reasonError && (
        <p id={`${reasonId}-error`} role="alert">
          {reasonError}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !selected.length || selected.length > 50}
        onClick={() => void write('grant', selected)}
      >
        Grant to selected players
      </button>
      <ul>
        {grants.map((player) => (
          <li key={player.accountId}>
            {player.name}{' '}
            <button type="button" disabled={busy} onClick={() => void write('revoke', [player])}>
              Revoke grant
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh(grants.at(-1)?.accountId).catch((e) => setError(e.message))}
        >
          Load more grants
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
