'use client'

import { useRef, useState, type FormEvent } from 'react'
import type {
  MasterPlayerSearchResult,
  MasterPlayerView,
  PlayerCorrection,
  PlayerRecoveryResult,
} from '@/master/players'
import {
  PlayerCorrectionForm,
  PlayerCorrectionReview,
  playerContentLabel,
  playerLabel,
} from './player-correction-form'
import styles from './players-workspace.module.css'
import { MasterHelp } from './master-help'

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/master/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(
      result.error?.message ?? 'Player support is unavailable. Refresh and try again.',
    )
  return result as T
}
type Review =
  | { kind: 'edit'; command: PlayerCorrection; requestKey: string }
  | { kind: 'recover'; requestKey: string }
export function PlayersWorkspace({
  initialPlayer = null,
}: {
  initialPlayer?: MasterPlayerView | null
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MasterPlayerSearchResult[] | null>(null)
  const [player, setPlayer] = useState(initialPlayer)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Player support is unavailable.')
    } finally {
      setBusy(false)
    }
  }
  function search(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      const result = await request<{ players: MasterPlayerSearchResult[] }>({
        operation: 'search',
        query,
      })
      setResults(result.players)
    })
  }
  function select(characterId: string) {
    void run(async () => {
      const result = await request<{ player: MasterPlayerView }>({ operation: 'read', characterId })
      setPlayer(result.player)
      setReview(null)
      setConfirmed(false)
      requestAnimationFrame(() => heading.current?.focus())
    })
  }
  function preview(next: Review) {
    setReview(next)
    setConfirmed(false)
    requestAnimationFrame(() => reviewHeading.current?.focus())
  }
  function save() {
    if (!player || !review || !confirmed) return
    void run(async () => {
      if (review.kind === 'edit') {
        const result = await request<{ player: MasterPlayerView }>({
          operation: 'edit',
          characterId: player.characterId,
          fingerprint: player.fingerprint,
          requestKey: review.requestKey,
          command: review.command,
          confirmed: true,
        })
        setPlayer(result.player)
        setNotice('Correction saved. Calculated values have been refreshed.')
      } else if (player.battle) {
        const result = await request<PlayerRecoveryResult>({
          operation: 'recover',
          characterId: player.characterId,
          battleSessionId: player.battle.battleSessionId,
          expectedVersion: player.battle.version,
          participantIds: player.battle.participants.map((row) => row.characterId),
          requestKey: review.requestKey,
          confirmed: true,
        })
        // Keep the same reviewed request for network retries until the authoritative response.
        setReview(null)
        setConfirmed(false)
        setNotice(
          result.outcome === 'NoContest'
            ? 'Encounter ended: No contest · No rewards. Every participant can return.'
            : 'The encounter had already ended. Its result was preserved.',
        )
        const refreshed = await request<{ player: MasterPlayerView }>({
          operation: 'read',
          characterId: player.characterId,
        })
        setPlayer(refreshed.player)
      }
      setReview(null)
      setConfirmed(false)
      requestAnimationFrame(() => heading.current?.focus())
    })
  }
  return (
    <div className={styles.workspace} aria-busy={busy}>
      <section className={`${styles.card} ${styles.searchPane}`} data-player-pane="search">
        <h2>
          Find a player{' '}
          <MasterHelp label="Player search">
            Search by character name. Viewing a player does not change their progress.
          </MasterHelp>
        </h2>
        <form className={styles.search} onSubmit={search}>
          <label>
            Character name
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              minLength={2}
              maxLength={48}
              required
              disabled={busy}
            />
          </label>
          <button disabled={busy} type="submit">
            Find players
          </button>
        </form>
        {results ? (
          <ul className={styles.results}>
            {results.length ? (
              results.map((row) => (
                <li key={row.characterId}>
                  <div>
                    <strong>{row.name}</strong>
                    <span>
                      Level {row.level} · Slot {row.slotIndex + 1}
                      {row.deletionPending ? ' · Deletion pending' : ''}
                    </span>
                    <span>{row.verifiedEmail ?? 'No verified email available'}</span>
                  </div>
                  <button disabled={busy} onClick={() => select(row.characterId)}>
                    Inspect {row.name}
                  </button>
                </li>
              ))
            ) : (
              <li>No matching characters. Try a more specific name.</li>
            )}
          </ul>
        ) : null}
      </section>
      <section className={`${styles.card} ${styles.detailsPane}`} data-player-pane="details">
        {error ? (
          <p className={styles.message} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className={styles.message} role="status">
            {notice}
          </p>
        ) : null}
        {player ? (
          <>
            <div className={styles.heading}>
              <div className={styles.identity}>
                <h2 ref={heading} tabIndex={-1}>
                  {player.name}
                </h2>
                <p>
                  Level {player.facts.level} · {player.facts.xp} XP · Cycle {player.facts.cycle}
                </p>
                <span>{player.verifiedEmail ?? 'No verified email available'}</span>
              </div>
              <button disabled={busy} onClick={() => select(player.characterId)}>
                Refresh player
              </button>
            </div>
            <dl className={styles.facts}>
              <div>
                <dt>Primary / Secondary</dt>
                <dd>
                  {playerContentLabel(
                    player,
                    player.facts.build.primary.disciplineId,
                    'Discipline',
                  )}{' '}
                  /{' '}
                  {playerContentLabel(
                    player,
                    player.facts.build.secondary?.disciplineId,
                    'Discipline',
                  )}
                </dd>
              </div>
              <div>
                <dt>Resonance</dt>
                <dd>
                  {playerContentLabel(
                    player,
                    player.facts.build.extensions.resonance?.resonanceId,
                    'Resonance',
                  )}
                </dd>
              </div>
              <div>
                <dt>Essence</dt>
                <dd>
                  {playerContentLabel(
                    player,
                    player.facts.build.extensions.essence?.essenceId,
                    'Essence',
                  )}
                </dd>
              </div>
              <div>
                <dt>Support action</dt>
                <dd>
                  {player.facts.build.supportActionId === 'basic.guard'
                    ? 'Guard'
                    : player.facts.build.supportActionId === 'basic.recover'
                      ? 'Recover HP'
                      : 'Recover MP'}
                </dd>
              </div>
              <div>
                <dt>Calculated maximum resources</dt>
                <dd>
                  {player.calculated.maxHp} HP · {player.calculated.maxMp} MP
                </dd>
              </div>
              <div>
                <dt>World position</dt>
                <dd>
                  {player.world?.position
                    ? `${player.world.position.sectorId} · ${player.world.position.x}, ${player.world.position.y}`
                    : 'No saved position'}
                </dd>
              </div>
              <div>
                <dt>Saved loadouts</dt>
                <dd>{player.savedLoadouts.map((row) => row.name).join(', ') || 'None'}</dd>
              </div>
            </dl>
            {player.deletionPending ? (
              <p role="status">Deletion pending. Gameplay corrections are unavailable.</p>
            ) : null}
            {review ? (
              <section className={styles.review}>
                <h3 tabIndex={-1} ref={reviewHeading}>
                  {review.kind === 'edit' ? 'Review correction' : 'Confirm all participants'}
                </h3>
                {review.kind === 'edit' ? (
                  <PlayerCorrectionReview player={player} command={review.command} />
                ) : (
                  <>
                    <p>
                      This whole encounter will end as <strong>No contest · No rewards</strong>.
                    </p>
                    <ul>
                      {player.battle?.participants.map((row) => (
                        <li key={row.characterId}>
                          <strong>{row.name}</strong>
                        </li>
                      ))}
                    </ul>
                    <p>
                      No participant receives a win, defeat reward, trial benefit or resource
                      refund.
                    </p>
                  </>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  {review.kind === 'edit'
                    ? `I confirm this correction for ${player.name}.`
                    : 'I confirm ending the encounter for every participant listed above.'}
                </label>
                <div className={styles.actions}>
                  <button disabled={busy || !confirmed} onClick={save}>
                    {review.kind === 'edit'
                      ? 'Save confirmed correction'
                      : 'End encounter without rewards'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setReview(null)
                      setConfirmed(false)
                    }}
                  >
                    Cancel review
                  </button>
                </div>
              </section>
            ) : null}
            <div hidden={!!review}>
              <PlayerCorrectionForm
                key={player.fingerprint}
                player={player}
                navigationDisabled={busy || !!review}
                encounter={
                  player.battle ? (
                    <section className={styles.encounter}>
                      <h3>Active encounter · {player.battle.lifecycle}</h3>
                      <p>
                        Participants: {player.battle.participants.map((row) => row.name).join(', ')}
                      </p>
                      <ul>
                        {player.battle.combatants.map((unit) => (
                          <li key={unit.id}>
                            <strong>
                              {player.battle?.participants.find(
                                (row) =>
                                  unit.id === `character:${row.characterId}` ||
                                  unit.id === row.characterId,
                              )?.name ?? playerLabel(unit.id)}
                            </strong>
                            : {unit.hp} HP · {unit.mp} MP · {unit.ap ?? '—'} AP
                            {unit.statuses.length
                              ? ` · ${unit.statuses.map(playerLabel).join(', ')}`
                              : ''}
                          </li>
                        ))}
                      </ul>
                      <details>
                        <summary>Recent actions</summary>
                        <ol>
                          {player.battle.recentActions.map((action, index) => (
                            <li key={index}>{playerLabel(action)}</li>
                          ))}
                        </ol>
                      </details>
                      <p>
                        Recovery ends this entire encounter for every listed participant. It gives
                        no rewards or refunds and preserves World progress.
                      </p>
                      <button
                        type="button"
                        disabled={busy || !!review}
                        onClick={() =>
                          preview({ kind: 'recover', requestKey: crypto.randomUUID() })
                        }
                      >
                        Review encounter recovery
                      </button>
                    </section>
                  ) : (
                    <p>No active encounter.</p>
                  )
                }
                disabled={busy || !!review || player.deletionPending || !!player.battle}
                onReview={(command) =>
                  preview({ kind: 'edit', command, requestKey: crypto.randomUUID() })
                }
              />
            </div>
          </>
        ) : (
          <p>Select a player to inspect their character and review a correction.</p>
        )}
      </section>
    </div>
  )
}
