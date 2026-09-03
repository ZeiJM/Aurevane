'use client'

import type { PrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import styles from './character-discipline-build-panel.module.css'

interface DisciplineDefinitionView {
  id: string
  definitionVersion: number
  name: string
  summary: string
  enabledForPrimary: boolean
  enabledForSecondary: boolean
}

interface PrimaryOption {
  definition: DisciplineDefinitionView
  profile: {
    disciplineId: string
    profileVersion: number
    statOffsets: Readonly<Record<string, number | undefined>>
  }
}

interface SecondaryOption extends PrimaryOption {
  masteredAt: string
}

interface AttunementView {
  policy: {
    version: number
    primaryCooldownSeconds: number
    secondaryCooldownSeconds: number
  }
  serverNow: string
  primaryLockedUntil: string | null
  secondaryLockedUntil: string | null
  primaryRemainingSeconds: number
  secondaryRemainingSeconds: number
}

interface CharacterDisciplineBuildPanelProps {
  initialBuildVersion: number
  initialCurrent: PrimaryDisciplinePreview
  initialCurrentSecondary: DisciplineDefinitionView | null
  availablePrimaries: readonly PrimaryOption[]
  availableSecondaries: readonly SecondaryOption[]
  initialAttunement: AttunementView
}

interface BuildPreviewResponse {
  preview?: {
    current: PrimaryDisciplinePreview
    currentSecondary: DisciplineDefinitionView | null
    proposed: PrimaryDisciplinePreview
    proposedSecondary: DisciplineDefinitionView | null
    buildVersion: number
    changes: { primary: boolean; secondary: boolean }
    attunement: AttunementView
  }
  error?: { message?: string }
}

interface BuildCommitResponse {
  context?: {
    build: { buildVersion: number }
    current: PrimaryDisciplinePreview
    currentSecondary: DisciplineDefinitionView | null
    attunement: AttunementView
  }
  error?: { message?: string }
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Ready'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [
    hours > 0 ? `${hours}h` : '',
    minutes > 0 || hours > 0 ? `${minutes}m` : '',
    `${seconds}s`,
  ]
    .filter(Boolean)
    .join(' ')
}

function policyDuration(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`
  return formatDuration(seconds)
}

export function CharacterDisciplineBuildPanel({
  initialBuildVersion,
  initialCurrent,
  initialCurrentSecondary,
  availablePrimaries,
  availableSecondaries,
  initialAttunement,
}: CharacterDisciplineBuildPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [current, setCurrent] = useState(initialCurrent)
  const [currentSecondary, setCurrentSecondary] = useState(initialCurrentSecondary)
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(initialCurrent.definition.id)
  const [selectedSecondaryId, setSelectedSecondaryId] = useState(initialCurrentSecondary?.id ?? '')
  const [preview, setPreview] = useState<BuildPreviewResponse['preview'] | null>(null)
  const [attunement, setAttunement] = useState(initialAttunement)
  const [remaining, setRemaining] = useState({
    primary: initialAttunement.primaryRemainingSeconds,
    secondary: initialAttunement.secondaryRemainingSeconds,
  })
  const [pendingPreview, setPendingPreview] = useState(false)
  const [pendingCommit, setPendingCommit] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((value) => ({
        primary: Math.max(0, value.primary - 1),
        secondary: Math.max(0, value.secondary - 1),
      }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const primaryOptions = useMemo(() => {
    return availablePrimaries.some((entry) => entry.definition.id === current.definition.id)
      ? availablePrimaries
      : [
          {
            definition: current.definition,
            profile: current.profile,
          },
          ...availablePrimaries,
        ]
  }, [availablePrimaries, current])

  const secondaryOptions = useMemo(() => {
    if (
      !currentSecondary ||
      availableSecondaries.some((entry) => entry.definition.id === currentSecondary.id)
    ) {
      return availableSecondaries
    }
    return [
      {
        definition: currentSecondary,
        profile: current.profile,
        masteredAt: 'committed',
      },
      ...availableSecondaries,
    ]
  }, [availableSecondaries, current.profile, currentSecondary])

  const deltas = useMemo(() => {
    if (!preview) return []
    return Object.values(current.derived.stats)
      .map((stat) => ({
        id: stat.id,
        label: stat.label,
        current: stat.value,
        proposed: preview.proposed.derived.stats[stat.id].value,
      }))
      .filter((entry) => entry.current !== entry.proposed)
  }, [current, preview])

  const commitBlocked = Boolean(
    pendingCommit ||
      !preview ||
      (preview.changes.primary && remaining.primary > 0) ||
      (preview.changes.secondary && remaining.secondary > 0),
  )

  async function previewSelection(primaryDisciplineId: string, secondaryDisciplineId: string) {
    setSelectedPrimaryId(primaryDisciplineId)
    setSelectedSecondaryId(secondaryDisciplineId)
    setMessage(null)

    if (
      primaryDisciplineId === current.definition.id &&
      secondaryDisciplineId === (currentSecondary?.id ?? '')
    ) {
      setPreview(null)
      return
    }

    setPendingPreview(true)
    try {
      const response = await fetch('/api/character/build/disciplines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryDisciplineId,
          secondaryDisciplineId: secondaryDisciplineId || null,
        }),
      })
      const body = (await response.json()) as BuildPreviewResponse
      if (!response.ok || !body.preview) {
        setPreview(null)
        setMessage(body.error?.message ?? 'The Discipline preview is unavailable.')
        return
      }
      setBuildVersion(body.preview.buildVersion)
      setCurrent(body.preview.current)
      setCurrentSecondary(body.preview.currentSecondary)
      setAttunement(body.preview.attunement)
      setRemaining({
        primary: body.preview.attunement.primaryRemainingSeconds,
        secondary: body.preview.attunement.secondaryRemainingSeconds,
      })
      setPreview(body.preview)
    } catch {
      setPreview(null)
      setMessage('The build preview service could not be reached. Nothing was changed.')
    } finally {
      setPendingPreview(false)
    }
  }

  async function commit() {
    if (!preview || commitBlocked) return
    setPendingCommit(true)
    setMessage(null)
    try {
      const response = await fetch('/api/character/build/disciplines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedBuildVersion: buildVersion,
          primaryDisciplineId: preview.proposed.definition.id,
          secondaryDisciplineId: preview.proposedSecondary?.id ?? null,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as BuildCommitResponse
      if (!response.ok || !body.context) {
        setMessage(body.error?.message ?? 'The Discipline build could not be changed.')
        return
      }

      const changedPrimary = preview.changes.primary
      const changedSecondary = preview.changes.secondary
      setBuildVersion(body.context.build.buildVersion)
      setCurrent(body.context.current)
      setCurrentSecondary(body.context.currentSecondary)
      setSelectedPrimaryId(body.context.current.definition.id)
      setSelectedSecondaryId(body.context.currentSecondary?.id ?? '')
      setAttunement(body.context.attunement)
      setRemaining({
        primary: body.context.attunement.primaryRemainingSeconds,
        secondary: body.context.attunement.secondaryRemainingSeconds,
      })
      setPreview(null)

      if (changedPrimary && !changedSecondary) {
        setMessage(
          `${body.context.current.definition.name} is now the committed Primary Discipline.`,
        )
      } else if (!changedPrimary && changedSecondary) {
        setMessage(
          body.context.currentSecondary
            ? `${body.context.currentSecondary.name} is now the committed Secondary Discipline.`
            : 'The Secondary Discipline has been removed.',
        )
      } else {
        setMessage('The Primary and Secondary Discipline changes are now committed.')
      }
      router.refresh()
    } catch {
      setMessage('The build service could not be reached. Nothing was changed.')
    } finally {
      setPendingCommit(false)
    }
  }

  return (
    <div className={styles.root} data-testid="primary-build-panel">
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Manage Primary Discipline and Secondary Discipline. Current: ${current.definition.name}${currentSecondary ? ` plus ${currentSecondary.name}` : ' pure'}, Build v${buildVersion}`}
        onClick={() => setOpen(true)}
      >
        <strong>
          {current.definition.name}
          {currentSecondary ? ` + ${currentSecondary.name}` : ' · Pure'}
        </strong>
        <small>Build v{buildVersion}</small>
      </button>

      {open ? (
        <div className={styles.backdrop} role="presentation" onPointerDown={() => setOpen(false)}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discipline-build-heading"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div>
                <span>Authoritative build</span>
                <h2 id="discipline-build-heading">Disciplines</h2>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)}>
                Close
              </button>
            </header>

            <div className={styles.current}>
              <div>
                <span>Committed Primary</span>
                <strong>{current.definition.name}</strong>
                <p>{current.definition.summary}</p>
                <small>
                  Definition v{current.definition.definitionVersion} · Base profile v
                  {current.profile.profileVersion}
                </small>
              </div>
              <div>
                <span>Committed Secondary</span>
                <strong>{currentSecondary?.name ?? 'None — pure build'}</strong>
                <p>
                  {currentSecondary?.summary ??
                    'No Secondary is equipped. Secondary never contributes a second base-stat profile.'}
                </p>
              </div>
            </div>

            <div className={styles.slots}>
              <label className={styles.selector}>
                <span>Proposed Primary</span>
                <select
                  value={selectedPrimaryId}
                  onChange={(event) =>
                    void previewSelection(event.target.value, selectedSecondaryId)
                  }
                  disabled={pendingPreview || pendingCommit || remaining.primary > 0}
                >
                  {primaryOptions.map((entry) => (
                    <option
                      key={`${entry.definition.id}:${entry.definition.definitionVersion}`}
                      value={entry.definition.id}
                    >
                      {entry.definition.name}
                    </option>
                  ))}
                </select>
                <small data-testid="primary-attunement-status">
                  {remaining.primary > 0
                    ? `Primary locked: ${formatDuration(remaining.primary)} remaining`
                    : `Primary ready · next change locks for ${policyDuration(attunement.policy.primaryCooldownSeconds)}`}
                </small>
              </label>

              <label className={styles.selector}>
                <span>Proposed Secondary</span>
                <select
                  value={selectedSecondaryId}
                  onChange={(event) => void previewSelection(selectedPrimaryId, event.target.value)}
                  disabled={pendingPreview || pendingCommit || remaining.secondary > 0}
                >
                  <option value="">None — pure build</option>
                  {secondaryOptions.map((entry) => (
                    <option
                      key={`${entry.definition.id}:${entry.definition.definitionVersion}`}
                      value={entry.definition.id}
                      disabled={entry.definition.id === selectedPrimaryId}
                    >
                      {entry.definition.name}
                    </option>
                  ))}
                </select>
                <small data-testid="secondary-attunement-status">
                  {remaining.secondary > 0
                    ? `Secondary locked: ${formatDuration(remaining.secondary)} remaining`
                    : `Secondary ready · next change locks for ${policyDuration(attunement.policy.secondaryCooldownSeconds)}`}
                </small>
                {availableSecondaries.length === 0 && !currentSecondary ? (
                  <small>No mastered Secondary Disciplines are available yet.</small>
                ) : null}
              </label>
            </div>

            {pendingPreview ? (
              <p className={styles.status}>Calculating authoritative preview…</p>
            ) : null}

            {preview ? (
              <div className={styles.preview} data-testid="primary-build-preview">
                <div className={styles.previewHeading}>
                  <div>
                    <span>Proposed build</span>
                    <strong>
                      {preview.proposed.definition.name}
                      {preview.proposedSecondary
                        ? ` + ${preview.proposedSecondary.name}`
                        : ' · Pure'}
                    </strong>
                  </div>
                  <small>Build v{buildVersion}</small>
                </div>
                <p>{preview.proposed.definition.summary}</p>
                {preview.proposedSecondary ? <p>{preview.proposedSecondary.summary}</p> : null}

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
                    <p>
                      No Primary base-stat change. Secondary contributes no second base-stat
                      profile.
                    </p>
                  )}
                </div>

                <p className={styles.attributeNote}>
                  Your assigned Might, Finesse, Vitality, Agility, Intellect, and Resolve are
                  preserved exactly. Only the Primary supplies the active Discipline base profile.
                </p>

                <div className={styles.commitment}>
                  <strong>Commitment</strong>
                  <span>Previewing starts no timer.</span>
                  {preview.changes.primary ? (
                    <span>
                      Committing the Primary change starts its independent{' '}
                      {policyDuration(attunement.policy.primaryCooldownSeconds)} lock.
                    </span>
                  ) : null}
                  {preview.changes.secondary ? (
                    <span>
                      Committing the Secondary change starts its independent{' '}
                      {policyDuration(attunement.policy.secondaryCooldownSeconds)} lock.
                    </span>
                  ) : null}
                </div>

                <button type="button" onClick={() => void commit()} disabled={commitBlocked}>
                  {pendingCommit
                    ? 'Committing…'
                    : preview.changes.primary && !preview.changes.secondary
                      ? `Commit ${preview.proposed.definition.name} as Primary`
                      : 'Commit Discipline changes'}
                </button>
              </div>
            ) : null}

            {message ? (
              <p className={styles.status} role="status">
                {message}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  )
}
