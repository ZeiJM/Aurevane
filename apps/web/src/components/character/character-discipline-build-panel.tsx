'use client'

import {
  CHARACTER_ATTRIBUTE_LABELS,
  foundationDisciplineAttributePolicy,
} from '@aurevane/game-core/character/attribute-allocation'
import type { PrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { FoundationDisciplineSigil } from './foundation-discipline-sigil'
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

const PROFILE_PANEL_QUERY = 'profilePanel'
const DISCIPLINES_PANEL = 'disciplines'

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

function focusLabel(disciplineId: string): string {
  const policy = foundationDisciplineAttributePolicy(disciplineId)
  if (!policy) return 'Authored identity'
  return policy.focusAttributes.map((id) => CHARACTER_ATTRIBUTE_LABELS[id]).join(' + ')
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const open = searchParams.get(PROFILE_PANEL_QUERY) === DISCIPLINES_PANEL
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

  useEffect(() => {
    if (!open) return

    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [open])

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

  function setPanelOpen(nextOpen: boolean) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextOpen) {
      params.set(PROFILE_PANEL_QUERY, DISCIPLINES_PANEL)
    } else if (params.get(PROFILE_PANEL_QUERY) === DISCIPLINES_PANEL) {
      params.delete(PROFILE_PANEL_QUERY)
    }
    const query = params.toString()
    const href = (query ? `${pathname}?${query}` : pathname) as Route
    router.replace(href, { scroll: false })
  }

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
        onClick={() => setPanelOpen(true)}
      >
        <FoundationDisciplineSigil
          disciplineId={current.definition.id}
          className={styles.triggerSigil}
        />
        <span className={styles.triggerCopy}>
          <span>Discipline Management</span>
          <strong>
            {current.definition.name}
            {currentSecondary ? ` + ${currentSecondary.name}` : ' · Pure'}
          </strong>
        </span>
        <span className={styles.triggerAction}>Open ›</span>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={styles.backdrop}
              role="presentation"
              onPointerDown={() => setPanelOpen(false)}
            >
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
                    <h2 id="discipline-build-heading">Discipline Management</h2>
                    <p>Choose identity first. Review every server-calculated change before committing.</p>
                  </div>
                  <button type="button" className={styles.close} onClick={() => setPanelOpen(false)}>
                    Close
                  </button>
                </header>

                <div className={styles.current}>
                  <div className={styles.currentDiscipline}>
                    <FoundationDisciplineSigil
                      disciplineId={current.definition.id}
                      className={styles.currentSigil}
                    />
                    <div>
                      <span>Committed Primary</span>
                      <strong>{current.definition.name}</strong>
                      <small className={styles.focus}>Focus · {focusLabel(current.definition.id)}</small>
                      <p>{current.definition.summary}</p>
                      <small>
                        Definition v{current.definition.definitionVersion} · Base profile v
                        {current.profile.profileVersion}
                      </small>
                    </div>
                  </div>
                  <div className={styles.currentDiscipline}>
                    {currentSecondary ? (
                      <FoundationDisciplineSigil
                        disciplineId={currentSecondary.id}
                        className={styles.currentSigil}
                      />
                    ) : (
                      <span className={styles.pureSigil} aria-hidden="true">◇</span>
                    )}
                    <div>
                      <span>Committed Secondary</span>
                      <strong>{currentSecondary?.name ?? 'None — pure build'}</strong>
                      {currentSecondary ? (
                        <small className={styles.focus}>Identity · {focusLabel(currentSecondary.id)}</small>
                      ) : null}
                      <p>
                        {currentSecondary?.summary ??
                          'No Secondary is equipped. Secondary never contributes a second base-stat profile.'}
                      </p>
                    </div>
                  </div>
                </div>

                <section className={styles.roster} aria-labelledby="foundation-roster-heading">
                  <div className={styles.rosterHeading}>
                    <div>
                      <span>Foundation identities</span>
                      <h3 id="foundation-roster-heading">Choose a proposed Primary</h3>
                    </div>
                    <small>Focus stats remain Discipline-uncapped</small>
                  </div>
                  <div className={styles.rosterGrid}>
                    {primaryOptions.map((entry) => {
                      const selected = entry.definition.id === selectedPrimaryId
                      return (
                        <button
                          key={`roster:${entry.definition.id}:${entry.definition.definitionVersion}`}
                          type="button"
                          className={styles.disciplineCard}
                          data-selected={selected ? 'true' : 'false'}
                          aria-pressed={selected}
                          onClick={() =>
                            void previewSelection(entry.definition.id, selectedSecondaryId)
                          }
                          disabled={pendingPreview || pendingCommit || remaining.primary > 0}
                        >
                          <FoundationDisciplineSigil
                            disciplineId={entry.definition.id}
                            className={styles.cardSigil}
                          />
                          <span>
                            <strong>{entry.definition.name}</strong>
                            <small>{focusLabel(entry.definition.id)}</small>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>

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
                      <div className={styles.proposedIdentity}>
                        <FoundationDisciplineSigil
                          disciplineId={preview.proposed.definition.id}
                          className={styles.previewSigil}
                        />
                        <div>
                          <span>Proposed build</span>
                          <strong>
                            {preview.proposed.definition.name}
                            {preview.proposedSecondary
                              ? ` + ${preview.proposedSecondary.name}`
                              : ' · Pure'}
                          </strong>
                        </div>
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
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}