'use client'

import { useEffect, useState } from 'react'
import type { BalanceOutcomes, UsageBalanceReport } from '@/master/usage-balance'
import styles from './usage-balance-panel.module.css'

function label(value: string): string {
  return value
    .split(/[._-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
function source(value: BalanceOutcomes['source']): string {
  return value === 'pvp' ? 'PvP' : 'AI · Battle Hall recruits'
}
function rates(row: BalanceOutcomes): string {
  return row.appearances
    ? [row.wins, row.losses, row.draws]
        .map((count) => `${Math.round((count / row.appearances) * 1000) / 10}%`)
        .join(' / ')
    : 'No completed sample'
}
function day(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}
function CountBar({
  value,
  maximum,
  tone = 'equipped',
}: {
  value: number
  maximum: number
  tone?: 'equipped' | 'uses'
}) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <span
        data-tone={tone}
        style={{ width: `${maximum > 0 ? Math.min(100, (value / maximum) * 100) : 0}%` }}
      />
    </span>
  )
}
function OutcomeBar({ row }: { row: BalanceOutcomes }) {
  if (!row.appearances) return null
  return (
    <div className={styles.outcomes} data-chart="outcomes" aria-hidden="true">
      {(['wins', 'losses', 'draws'] as const).map((kind) => (
        <span
          key={kind}
          data-outcome={kind}
          style={{ width: `${(row[kind] / row.appearances) * 100}%` }}
        />
      ))}
    </div>
  )
}
export function UsageBalanceReportView({ report }: { report: UsageBalanceReport }) {
  const { current, coverage } = report
  const hasSample = coverage.collectedBattles > 0
  const equippedMaximum = Math.max(0, ...report.skills.map((skill) => skill.equippedPlayers))
  const usesMaximum = Math.max(0, ...report.skills.map((skill) => skill.actualUses))
  const pairMaximum = Math.max(0, ...report.pairs.map((pair) => pair.players))
  if (report.subjectKind === 'unsupported')
    return (
      <div className={styles.panel}>
        <h3>Usage &amp; Balance</h3>
        <p className={styles.note}>
          Usage reporting covers Discipline builds and equipped Discipline Skills. This content kind
          has no supported usage receipts.
        </p>
      </div>
    )
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>
        <h3>Usage &amp; Balance</h3>
        <span>Snapshot {day(report.asOf)} · UTC</span>
      </div>
      {report.subjectKind === 'discipline' && (
        <div className={styles.metrics} data-chart="adoption">
          <div>
            <strong>{current.primaryPlayers}</strong>
            <span>Primary players</span>
            <small>{current.primaryCharacters} characters</small>
            {current.totalPlayers > 0 ? (
              <meter
                aria-label="Primary players"
                value={current.primaryPlayers}
                min={0}
                max={current.totalPlayers}
              />
            ) : (
              <small>No current player sample</small>
            )}
          </div>
          <div>
            <strong>{current.secondaryPlayers}</strong>
            <span>Secondary players</span>
            <small>{current.secondaryCharacters} characters</small>
            {current.totalPlayers > 0 ? (
              <meter
                aria-label="Secondary players"
                value={current.secondaryPlayers}
                min={0}
                max={current.totalPlayers}
              />
            ) : null}
          </div>
          <div>
            <strong>{current.totalPlayers}</strong>
            <span>Current players</span>
            <small>{current.totalCharacters} characters in roster</small>
          </div>
        </div>
      )}
      {(coverage.rosterTruncated || coverage.battlesTruncated) && (
        <p role="status" className={styles.notice}>
          Partial sample: {coverage.rosterTruncated ? 'first 50,000 current characters; ' : ''}
          {coverage.battlesTruncated ? 'latest 10,000 completed battles selected week.' : ''} Counts
          and rates describe only this bounded sample.
        </p>
      )}
      <section>
        <h4>Selected week · completed battles</h4>
        <p className={styles.note}>
          {day(report.weekStartsAt)} to {day(report.weekEndsAt)} (exclusive), UTC ·{' '}
          {coverage.collectedBattles} eligible completed battles across all builds.
        </p>
        <div className={styles.sourceGrid}>
          {report.weekly.map((row) => (
            <article key={row.source}>
              <h5>{source(row.source)}</h5>
              <OutcomeBar row={row} />
              <strong>{hasSample ? rates(row) : 'Awaiting eligible completed battles'}</strong>
              <span>Win / loss / draw</span>
              <p>
                {row.wins} wins · {row.losses} losses · {row.draws} draws
              </p>
              <small>{row.appearances} player appearances · each participant counts once</small>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h4>Skills · equipped and actually used</h4>
        {report.skills.length ? (
          <>
            <p className={styles.note}>
              Each column uses its own count scale; equipment and casts measure different things.
            </p>
            <ul className={styles.skillCharts} data-chart="skills">
              <li className={styles.chartHead} aria-hidden="true">
                <span>Skill</span>
                <span>Equipped players · current</span>
                <span>Uses · completed battles selected week</span>
              </li>
              {report.skills.map((skill) => (
                <li key={skill.skillId}>
                  <strong>
                    {skill.name === skill.skillId ? label(skill.skillId) : skill.name}
                  </strong>
                  <div>
                    <span className={styles.chartValue}>
                      <span>Equipped players</span>
                      <b>{skill.equippedPlayers}</b>
                    </span>
                    <CountBar value={skill.equippedPlayers} maximum={equippedMaximum} />
                  </div>
                  <div>
                    <span className={styles.chartValue}>
                      <span>Uses selected week</span>
                      <b>{hasSample ? skill.actualUses : 'Unavailable'}</b>
                    </span>
                    {hasSample ? (
                      <CountBar value={skill.actualUses} maximum={usesMaximum} tone="uses" />
                    ) : null}
                    {hasSample && skill.actualUses === 0 ? (
                      <small className={styles.indicator}>No recorded use selected week</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <details>
              <summary>Exact Skill counts</summary>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Equipped players</th>
                      <th>Characters</th>
                      <th>Uses selected week</th>
                      <th>Battles used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.skills.map((skill) => (
                      <tr key={skill.skillId}>
                        <th scope="row">
                          {skill.name === skill.skillId ? label(skill.skillId) : skill.name}
                          {hasSample && skill.actualUses === 0 && (
                            <small className={styles.indicator}>
                              No recorded use selected week
                            </small>
                          )}
                        </th>
                        <td>{skill.equippedPlayers}</td>
                        <td>{skill.equippedCharacters}</td>
                        <td>{hasSample ? skill.actualUses : 'Unavailable'}</td>
                        <td>{hasSample ? skill.usedBattles : 'Unavailable'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className={styles.note}>
            No linked Discipline Skills in the current catalogue or committed loadouts.
          </p>
        )}
        <p className={styles.note}>
          {hasSample
            ? 'Actual uses count committed Skill action receipts in eligible completed battles, including private actions only as anonymous totals. Equipped counts are current; they are not historical exposure.'
            : 'Actual-use data unavailable until an eligible completed battle is collected.'}{' '}
          At most 200 Skills are shown. Qualifying manual and automatic Skill actions are included.
          Essence and Resonance activations are separate and are not counted here.
        </p>
      </section>
      <div className={styles.sourceGrid}>
        {report.subjectKind === 'discipline' && (
          <section>
            <h4>Common current pairs</h4>
            {report.pairs.length ? (
              <ol className={styles.rows} data-chart="pairs">
                {report.pairs.map((pair) => (
                  <li key={`${pair.primary}:${pair.secondary}`}>
                    <span>
                      {label(pair.primary)} +{' '}
                      {pair.secondary ? label(pair.secondary) : 'None (Essence)'}
                    </span>
                    <strong>
                      {pair.players} players · {pair.characters} characters
                    </strong>
                    <CountBar value={pair.players} maximum={pairMaximum} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.note}>No matching current pair sample.</p>
            )}
          </section>
        )}
        <section>
          <h4>Observed player matchups</h4>
          {report.matchups.length ? (
            <ol className={styles.rows}>
              {report.matchups.map((row) => (
                <li key={`${row.source}:${row.opponent}`}>
                  <span>
                    {label(row.opponent)} · {source(row.source)}
                  </span>
                  <OutcomeBar row={row} />
                  <strong>{rates(row)}</strong>
                  <small>
                    {row.appearances} opposing-player pairings · {row.wins} W / {row.losses} L /{' '}
                    {row.draws} D
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.note}>
              No eligible player matchup sample. AI recruits have no captured Discipline build, so
              AI matchup-by-Discipline is unavailable.
            </p>
          )}
        </section>
      </div>
      <details className={styles.methodology}>
        <summary>How these numbers are counted</summary>
        <p className={styles.note}>
          Current players = distinct accounts with committed builds; characters are counted
          separately. Pending deletions are excluded.
        </p>
        <p className={styles.notice}>
          Historical battles are unavailable: older saves do not prove test exclusion. New
          production battles exclude registered testers, preview/local games and explicit test mode.{' '}
          {coverage.collectionStartedAt
            ? `Collection started ${day(coverage.collectionStartedAt)}; selected week may be partial.`
            : 'Awaiting eligible completed battles.'}
        </p>
        <p className={styles.note}>
          Rates use completed player appearances with this Discipline in either slot, or this Skill
          equipped. Draws remain in the denominator. Small or incomplete samples do not establish
          strength.
        </p>
      </details>
    </div>
  )
}
export function UsageBalancePanel({ contentKey }: { contentKey: string }) {
  const [result, setResult] = useState<{
    contentKey: string
    revision: number
    week: string | undefined
    report?: UsageBalanceReport
    error?: string
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const [selection, setSelection] = useState<{ contentKey: string; week: string }>()
  const week = selection?.contentKey === contentKey && selection.week ? selection.week : undefined
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void fetch(
      `/api/master/combat-content/usage-balance?contentKey=${encodeURIComponent(contentKey)}${week ? `&week=${encodeURIComponent(week)}` : ''}`,
      { cache: 'no-store', credentials: 'same-origin', signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Usage & Balance could not be loaded. Check page access or try again.')
        const data = (await response.json()) as UsageBalanceReport
        if (active) setResult({ contentKey, revision, week, report: data })
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof Error && error.name === 'AbortError'))
          setResult({
            contentKey,
            revision,
            week,
            error: error instanceof Error ? error.message : 'Usage & Balance could not be loaded.',
          })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [contentKey, revision, week])
  const current =
    result?.contentKey === contentKey && result.revision === revision && result.week === week
      ? result
      : null
  return (
    <div aria-label="Usage & Balance">
      <div className={styles.refresh}>
        <label>
          Week
          <select
            value={week ?? ''}
            onChange={(event) => setSelection({ contentKey, week: event.target.value })}
          >
            <option value="">Current week</option>
            {(result?.contentKey === contentKey ? (result.report?.availableWeeks ?? []) : []).map(
              (value) => (
                <option key={value} value={value}>
                  Week of {value} · UTC
                </option>
              ),
            )}
          </select>
        </label>
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          Refresh counts
        </button>
      </div>
      {current?.error ? (
        <p role="alert">{current.error}</p>
      ) : current?.report?.contentKey === contentKey ? (
        <UsageBalanceReportView report={current.report} />
      ) : (
        <p role="status">Loading usage and balance…</p>
      )}
    </div>
  )
}
