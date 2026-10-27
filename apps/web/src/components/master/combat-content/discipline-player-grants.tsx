'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false)
  const active = useRef(false)
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
    setBusy(true)
    setError('')
    try {
      const rows = await command<Player[]>({ operation: 'search', query })
      if (active.current) setResults(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setBusy(false)
    }
  }
  async function write(operation: 'grant' | 'revoke', players: Player[]) {
    setBusy(true)
    setError('')
    try {
      await command({
        operation,
        disciplineId,
        accountIds: players.map((p) => p.accountId),
        reason,
      })
      if (active.current) {
        setSelected([])
        await refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grant change failed.')
    } finally {
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
        Reason
        <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={busy || !selected.length || selected.length > 50 || !reason.trim()}
        onClick={() => void write('grant', selected)}
      >
        Grant to selected players
      </button>
      <ul>
        {grants.map((player) => (
          <li key={player.accountId}>
            {player.name}{' '}
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => void write('revoke', [player])}
            >
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
