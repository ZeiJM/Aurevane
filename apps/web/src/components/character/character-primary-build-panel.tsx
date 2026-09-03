'use client'

import type { PrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import styles from './character-primary-build-panel.module.css'

interface PrimaryOption {
  definition: {
    id: string
    definitionVersion: number
    name: string
    summary: string
    enabledForPrimary: boolean
  }
  profile: {
    disciplineId: string
    profileVersion: number
    statOffsets: Readonly<Record<string, number | undefined>>
  }
}

interface CharacterPrimaryBuildPanelProps {
  initialBuildVersion: number
  initialCurrent: PrimaryDisciplinePreview
  availablePrimaries: readonly PrimaryOption[]
}

interface PreviewResponse {
  preview?: {
    current: PrimaryDisciplinePreview
    proposed: PrimaryDisciplinePreview
    buildVersion: number
  }
  error?: { message?: string }
}

interface CommitResponse {
  context?: {
    build: { buildVersion: number }
    current: PrimaryDisciplinePreview
  }
  error?: { message?: string }
}

export function CharacterPrimaryBuildPanel({
  initialBuildVersion,
  initialCurrent,
  availablePrimaries,
}: CharacterPrimaryBuildPanelProps) {
  const router = useRouter()
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [current, setCurrent] = useState(initialCurrent)
  const [selectedId, setSelectedId] = useState(initialCurrent.definition.id)
  const [proposed, setProposed] = useState<PrimaryDisciplinePreview | null>(null)
  const [pendingPreview, setPendingPreview] = useState(false)
  const [pendingCommit, setPendingCommit] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const deltas = useMemo(() => {
    if (!proposed) return []
    return Object.values(current.derived.stats)
      .map((stat) => ({
        id: stat.id,
        label: stat.label,
        current: stat.value,
        proposed: proposed.derived.stats[stat.id].value,
        unit: stat.unit,
      }))
      .filter((entry) => entry.current !== entry.proposed)
  }, [current, proposed])

  async function preview(primaryDisciplineId: string) {
    setSelectedId(primaryDisciplineId)
    setMessage(null)
    if (primaryDisciplineId === current.definition.id) {
      setProposed(null)
      return
    }
    setPendingPreview(true)
    try {
      const response = await fetch('/api/character/build/primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryDisciplineId }),
      })
      const body = (await response.json()) as PreviewResponse
      if (!response.ok || !body.preview) {
        setProposed(null)
        setMessage(body.error?.message ?? 'The Primary preview is unavailable.')
        return
      }
      setBuildVersion(body.preview.buildVersion)
      setCurrent(body.preview.current)
      setProposed(body.preview.proposed)
    } catch {
      setProposed(null)
      setMessage('The Primary preview service could not be reached. Nothing was changed.')
    } finally {
      setPendingPreview(false)
    }
  }

  async function commit() {
    if (!proposed || pendingCommit) return
    setPendingCommit(true)
    setMessage(null)
    try {
      const response = await fetch('/api/character/build/primary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedBuildVersion: buildVersion,
          primaryDisciplineId: proposed.definition.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as CommitResponse
      if (!response.ok || !body.context) {
        setMessage(body.error?.message ?? 'The Primary Discipline could not be changed.')
        return
      }
      setBuildVersion(body.context.build.buildVersion)
      setCurrent(body.context.current)
      setSelectedId(body.context.current.definition.id)
      setProposed(null)
      setMessage(`${body.context.current.definition.name} is now the committed Primary Discipline.`)
      router.refresh()
    } catch {
      setMessage('The build service could not be reached. Nothing was changed.')
    } finally {
      setPendingCommit(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="primary-build-heading" data-testid="primary-build-panel">
      <header className={styles.header}>
        <div>
          <span>Authoritative build</span>
          <h2 id="primary-build-heading">Primary Discipline</h2>
        </div>
        <strong>Build v{buildVersion}</strong>
      </header>

      <div className={styles.current}>
        <span>Committed Primary</span>
        <strong>{current.definition.name}</strong>
        <p>{current.definition.summary}</p>
        <small>
          Definition v{current.definition.definitionVersion} · Base profile v{current.profile.profileVersion}
        </small>
      </div>

      <label className={styles.selector}>
        <span>Proposed Primary</span>
        <select
          value={selectedId}
          onChange={(event) => void preview(event.target.value)}
          disabled={pendingPreview || pendingCommit}
        >
          {availablePrimaries.map((entry) => (
            <option key={`${entry.definition.id}:${entry.definition.definitionVersion}`} value={entry.definition.id}>
              {entry.definition.name}
            </option>
          ))}
        </select>
      </label>

      {pendingPreview ? <p className={styles.status}>Calculating authoritative preview…</p> : null}

      {proposed ? (
        <div className={styles.preview} data-testid="primary-build-preview">
          <div className={styles.previewHeading}>
            <div>
              <span>Proposed profile</span>
              <strong>{proposed.definition.name}</strong>
            </div>
            <small>Profile v{proposed.profile.profileVersion}</small>
          </div>
          <p>{proposed.definition.summary}</p>
          <div className={styles.deltas}>
            {deltas.length > 0 ? (
              deltas.map((entry) => {
                const delta = entry.proposed - entry.current
                return (
                  <div key={entry.id}>
                    <span>{entry.label}</span>
                    <strong>
                      {entry.current} → {entry.proposed}{' '}
                      <em>{delta > 0 ? `+${delta}` : delta}</em>
                    </strong>
                  </div>
                )
              })
            ) : (
              <p>No displayed derived stat changes for this profile.</p>
            )}
          </div>
          <p className={styles.attributeNote}>
            Your assigned Might, Finesse, Vitality, Agility, Intellect, and Resolve are preserved exactly. Only the Primary base profile changes.
          </p>
          <button type="button" onClick={() => void commit()} disabled={pendingCommit}>
            {pendingCommit ? 'Committing…' : `Commit ${proposed.definition.name} as Primary`}
          </button>
        </div>
      ) : null}

      {message ? <p className={styles.status} role="status">{message}</p> : null}
    </section>
  )
}
