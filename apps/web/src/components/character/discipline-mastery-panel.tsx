'use client'
import { useState } from 'react'
import { ADVANCED_DISCIPLINES } from '@aurevane/game-core/character/advanced-disciplines'
import type { DisciplineMasteryProgress } from '@/server/character/discipline-mastery-service'
import styles from './discipline-mastery-panel.module.css'
const stages = ['', 'Initiate', 'Practiced', 'Adept', 'Expert', 'Master']
const name = (id: string) => id[0]!.toUpperCase() + id.slice(1)
export function DisciplineMasteryPanel() {
  const [progress, setProgress] = useState<DisciplineMasteryProgress[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function load() {
    if (pending || progress) return
    setPending(true)
    try {
      const response = await fetch('/api/character/mastery', { cache: 'no-store' })
      const body = (await response.json()) as {
        progress?: DisciplineMasteryProgress[]
        error?: { message?: string }
      }
      if (!response.ok || !body.progress)
        throw new Error(body.error?.message ?? 'Mastery is temporarily unavailable.')
      setProgress(body.progress)
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Mastery is temporarily unavailable.')
    } finally {
      setPending(false)
    }
  }
  return (
    <details
      className={styles.panel}
      onToggle={(event) => {
        if (event.currentTarget.open) void load()
      }}
    >
      <summary>Mastery &amp; unlocks</summary>
      <p>
        Mastery Trials in the Battle Hall award up to 50 XP for a qualifying victory. Stages:
        Practiced 100 · Adept 300 · Expert 600 · Master 1,000.
      </p>
      <p>
        Advanced libraries teach four Skills at Initiate, two more at Practiced and the final two at
        Adept. Master also requires demonstrating all eight regular Skills across qualifying
        victories and enables Secondary use. Existing testing-period Mastery grants let you try all
        active Disciplines immediately.
      </p>
      {pending ? <p role="status">Loading Mastery…</p> : null}
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}
      <div className={styles.rows}>
        {progress?.map((row) => {
          const definition = ADVANCED_DISCIPLINES.find(
            (discipline) => discipline.id === row.disciplineId,
          )
          return (
            <div key={row.disciplineId} className={styles.row}>
              <div>
                <strong>{name(row.disciplineId)}</strong>
                <span>{row.unlocked ? `${stages[row.stage]} · ${row.xp}/1,000 XP` : 'Locked'}</span>
              </div>
              <progress
                aria-label={`${name(row.disciplineId)} Mastery`}
                value={row.xp}
                max={1000}
              />
              {!row.unlocked && definition ? (
                <small>
                  Requires{' '}
                  {definition.prerequisites
                    .map(
                      (requirement) =>
                        `${name(requirement.disciplineId)} ${stages[requirement.minimumStage]}`,
                    )
                    .join(' + ')}
                  .
                </small>
              ) : (
                <small>
                  {row.demonstratedSkillCount}/8 Skills demonstrated in qualifying victories.
                </small>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}
