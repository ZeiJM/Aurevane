'use client'

import {
  CHARACTER_ATTRIBUTE_LABELS,
  foundationDisciplineAttributePolicy,
} from '@aurevane/game-core/character/attribute-allocation'
import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import type { PrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import type { DerivedStatUnit } from '@aurevane/game-core/character/derived-stats'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
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
  coreAttributes: CharacterAttributes
}

interface BuildPreviewResponse {
  preview?: {
    current: PrimaryDisciplinePreview
    currentSecondary: DisciplineDefinitionView | null
    proposed: PrimaryDisciplinePreview
    proposedSecondary: DisciplineDefinitionView | null
    currentAttributes: CharacterAttributes
    proposedAttributes: CharacterAttributes
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

type DeltaDirection = 'increase' | 'decrease' | 'neutral'
type DisciplineSlot = 'primary' | 'secondary'

const PROFILE_PANEL_QUERY = 'profilePanel'
const DISCIPLINES_PANEL = 'disciplines'

function focusAttributes(disciplineId: string): readonly CharacterAttributeId[] {
  return foundationDisciplineAttributePolicy(disciplineId)?.focusAttributes ?? []
}

function deltaDirection(current: number, proposed: number): DeltaDirection {
  if (proposed > current) return 'increase'
  if (proposed < current) return 'decrease'
  return 'neutral'
}

function formatDerivedValue(value: number, unit: DerivedStatUnit): string {
  if (unit === 'basisPoints') {
    const percent = value / 100
    return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`
  }
  return value.toLocaleString('en')
}

function FocusBadges({ disciplineId }: { disciplineId: string }) {
  const attributes = focusAttributes(disciplineId)
  if (attributes.length === 0) return null

  return (
    <div className={styles.focusBadges} aria-label="Discipline focus attributes">
      {attributes.map((attributeId) => (
        <span className={styles.focusBadge} key={attributeId}>
          {CHARACTER_ATTRIBUTE_LABELS[attributeId]}
        </span>
      ))}
    </div>
  )
}

interface DisciplineLibraryProps {
  options: readonly { definition: Pick<DisciplineDefinitionView, 'id' | 'name'> }[]
  selectedPrimaryId: string
  selectedSecondaryId: string
  pendingPreview: boolean
  pendingCommit: boolean
  refreshingProfile: boolean
  primaryRemainingSeconds: number
  onSelect: (primaryId: string, secondaryId: string) => void
}

/** Retained as a compatibility export for interaction contracts; Nexus no longer renders the library. */
export function DisciplineLibrary({
  options,
  selectedPrimaryId,
  selectedSecondaryId,
  pendingPreview,
  pendingCommit,
  refreshingProfile,
  primaryRemainingSeconds,
  onSelect,
}: DisciplineLibraryProps) {
  return (
    <section className={styles.roster} aria-label="Primary Discipline library">
      <h3>Discipline library</h3>
      <div className={styles.rosterGrid}>
        {options.map(({ definition }) => (
          <button
            key={definition.id}
            type="button"
            className={styles.disciplineCard}
            data-selected={selectedPrimaryId === definition.id}
            aria-pressed={selectedPrimaryId === definition.id}
            disabled={
              pendingPreview || pendingCommit || refreshingProfile || primaryRemainingSeconds > 0
            }
            onClick={() => onSelect(definition.id, selectedSecondaryId)}
          >
            <FoundationDisciplineSigil disciplineId={definition.id} className={styles.cardSigil} />
            <span className={styles.cardCopy}>
              <strong>{definition.name}</strong>
              <FocusBadges disciplineId={definition.id} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function CharacterDisciplineBuildPanel({
  initialBuildVersion,
  initialCurrent,
  initialCurrentSecondary,
  availablePrimaries,
  availableSecondaries,
  initialAttunement,
  coreAttributes,
}: CharacterDisciplineBuildPanelProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const open = searchParams.get(PROFILE_PANEL_QUERY) === DISCIPLINES_PANEL
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [current, setCurrent] = useState(initialCurrent)
  const [currentSecondary, setCurrentSecondary] = useState(initialCurrentSecondary)
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(initialCurrent.definition.id)
  const [selectedSecondaryId, setSelectedSecondaryId] = useState(initialCurrentSecondary?.id ?? '')
  const [activeSlot, setActiveSlot] = useState<DisciplineSlot>('primary')
  const [preview, setPreview] = useState<BuildPreviewResponse['preview'] | null>(null)
  const [remaining, setRemaining] = useState({
    primary: initialAttunement.primaryRemainingSeconds,
    secondary: initialAttunement.secondaryRemainingSeconds,
  })
  const [pendingPreview, setPendingPreview] = useState(false)
  const [pendingCommit, setPendingCommit] = useState(false)
  const [refreshingProfile, startProfileRefresh] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open || !mounted) return
    dialogRef.current?.focus()
    const trigger = triggerRef.current
    return () => {
      if (trigger?.isConnected) trigger.focus()
    }
  }, [open, mounted])

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
      : [{ definition: current.definition, profile: current.profile }, ...availablePrimaries]
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

  const visiblePrimaryOptions = useMemo(
    () =>
      primaryOptions.filter(
        (entry) => !selectedSecondaryId || entry.definition.id !== selectedSecondaryId,
      ),
    [primaryOptions, selectedSecondaryId],
  )
  const visibleSecondaryOptions = useMemo(
    () => secondaryOptions.filter((entry) => entry.definition.id !== selectedPrimaryId),
    [secondaryOptions, selectedPrimaryId],
  )

  const coreDeltas = useMemo(() => {
    const currentAttributes = preview?.currentAttributes ?? coreAttributes
    const proposedAttributes = preview?.proposedAttributes ?? coreAttributes
    return CHARACTER_ATTRIBUTE_IDS.map((attributeId) => ({
      id: attributeId,
      label: CHARACTER_ATTRIBUTE_LABELS[attributeId],
      current: currentAttributes[attributeId],
      proposed: proposedAttributes[attributeId],
      direction: deltaDirection(currentAttributes[attributeId], proposedAttributes[attributeId]),
    }))
  }, [coreAttributes, preview])

  const adventureDeltas = useMemo(() => {
    const proposed = preview?.proposed ?? current
    return Object.values(current.derived.stats).map((stat) => ({
      id: stat.id,
      label: stat.label,
      unit: stat.unit,
      current: stat.value,
      proposed: proposed.derived.stats[stat.id].value,
      direction: deltaDirection(stat.value, proposed.derived.stats[stat.id].value),
    }))
  }, [current, preview])

  const currentSlotDefinition = activeSlot === 'primary' ? current.definition : currentSecondary
  const proposedSlotDefinition =
    activeSlot === 'primary'
      ? (preview?.proposed.definition ?? current.definition)
      : (preview?.proposedSecondary ?? currentSecondary)
  const secondarySelectable = visibleSecondaryOptions.length > 0 || Boolean(currentSecondary)
  const changedCore = coreDeltas.filter((entry) => entry.direction !== 'neutral').slice(0, 4)
  const changedAdventure = adventureDeltas
    .filter((entry) => entry.direction !== 'neutral')
    .slice(0, Math.max(0, 4 - changedCore.length))

  const commitBlocked = Boolean(
    pendingCommit ||
    refreshingProfile ||
    !preview ||
    (preview.changes.primary && remaining.primary > 0) ||
    (preview.changes.secondary && remaining.secondary > 0),
  )

  function setPanelOpen(nextOpen: boolean) {
    if (!nextOpen && (pendingCommit || refreshingProfile)) return
    const params = new URLSearchParams(searchParams.toString())
    if (nextOpen) {
      params.set(PROFILE_PANEL_QUERY, DISCIPLINES_PANEL)
    } else if (params.get(PROFILE_PANEL_QUERY) === DISCIPLINES_PANEL) {
      params.delete(PROFILE_PANEL_QUERY)
    }
    const query = params.toString()
    const href = query ? `${pathname}?${query}` : pathname
    window.history.replaceState(null, '', href)
  }

  async function previewSelection(primaryDisciplineId: string, secondaryDisciplineId: string) {
    if (secondaryDisciplineId && primaryDisciplineId === secondaryDisciplineId) {
      setMessage('Primary and Secondary Disciplines must be different.')
      return
    }

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

      setBuildVersion(body.context.build.buildVersion)
      setCurrent(body.context.current)
      setCurrentSecondary(body.context.currentSecondary)
      setSelectedPrimaryId(body.context.current.definition.id)
      setSelectedSecondaryId(body.context.currentSecondary?.id ?? '')
      setRemaining({
        primary: body.context.attunement.primaryRemainingSeconds,
        secondary: body.context.attunement.secondaryRemainingSeconds,
      })
      setPreview(null)
      setMessage('Discipline changes committed.')
      startProfileRefresh(() => router.refresh())
    } catch {
      setMessage('The build service could not be reached. Nothing was changed.')
    } finally {
      setPendingCommit(false)
    }
  }

  return (
    <div className={styles.root} data-testid="primary-build-panel">
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Manage Disciplines — Manage Primary Discipline and Secondary Discipline. Current: ${current.definition.name}${
          currentSecondary ? ` plus ${currentSecondary.name}` : ''
        }`}
        onClick={() => setPanelOpen(true)}
      >
        <span className={styles.triggerSigils} aria-hidden="true">
          <FoundationDisciplineSigil
            disciplineId={current.definition.id}
            className={styles.triggerSigil}
          />
        </span>
        <span className={styles.triggerLabel}>Manage Disciplines</span>
        <span className={styles.triggerArrow} aria-hidden="true">
          ›
        </span>
      </button>

      {open && mounted
        ? createPortal(
            <div
              className={styles.backdrop}
              role="presentation"
              onPointerDown={() => setPanelOpen(false)}
            >
              <section
                ref={dialogRef}
                className={styles.dialog}
                data-av-surface="moonstone"
                data-character-concept="editor"
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-labelledby="discipline-build-heading"
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setPanelOpen(false)
                    return
                  }
                  if (event.key !== 'Tab') return
                  const dialog = event.currentTarget
                  const controls = Array.from(
                    dialog.querySelectorAll<HTMLElement>(
                      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
                    ),
                  ).filter((element) => element.getClientRects().length > 0)
                  const first = controls[0]
                  const last = controls.at(-1)
                  if (!first || !last) {
                    event.preventDefault()
                    dialog.focus()
                  } else if (
                    event.shiftKey &&
                    (document.activeElement === first || document.activeElement === dialog)
                  ) {
                    event.preventDefault()
                    last.focus()
                  } else if (
                    !event.shiftKey &&
                    (document.activeElement === last || document.activeElement === dialog)
                  ) {
                    event.preventDefault()
                    first.focus()
                  }
                }}
              >
                <header className={styles.header}>
                  <div className={styles.headerCopy}>
                    <span className={styles.headerIcon} aria-hidden="true">
                      ⚔
                    </span>
                    <div>
                      <h2 id="discipline-build-heading">Discipline Management</h2>
                      <p>Shape your path. Compare the build before you commit.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.close}
                    disabled={pendingCommit || refreshingProfile}
                    onClick={() => setPanelOpen(false)}
                  >
                    <span aria-hidden="true">×</span>
                    Close
                  </button>
                </header>

                <section className={styles.committedSection} aria-label="Currently committed">
                  <div className={styles.sectionTitle}>
                    <h3>Currently Committed</h3>
                  </div>
                  <div className={styles.current}>
                    <article className={styles.currentDiscipline} data-av-surface="ink">
                      <FoundationDisciplineSigil
                        disciplineId={current.definition.id}
                        className={styles.currentSigil}
                      />
                      <div>
                        <span>Primary Discipline</span>
                        <strong>{current.definition.name}</strong>
                        <p>{current.definition.summary}</p>
                      </div>
                    </article>
                    {currentSecondary ? (
                      <article className={styles.currentDiscipline} data-av-surface="ink">
                        <FoundationDisciplineSigil
                          disciplineId={currentSecondary.id}
                          className={styles.currentSigil}
                        />
                        <div>
                          <span>Secondary Discipline</span>
                          <strong>{currentSecondary.name}</strong>
                          <p>{currentSecondary.summary}</p>
                        </div>
                      </article>
                    ) : (
                      <article
                        className={styles.currentDiscipline}
                        data-av-surface="ink"
                        data-locked="true"
                      >
                        <span className={styles.currentLock} aria-hidden="true">
                          ▣
                        </span>
                        <div>
                          <span>Secondary Discipline</span>
                          <strong>Locked</strong>
                          <p>A second discipline awaits.</p>
                        </div>
                      </article>
                    )}
                  </div>
                </section>

                <section className={styles.selectionSection} aria-label="Discipline selection">
                  <div className={styles.selectionControls}>
                    <label
                      className={styles.slotSelector}
                      data-active={activeSlot === 'primary' ? 'true' : 'false'}
                      onFocus={() => setActiveSlot('primary')}
                    >
                      <span>Primary Discipline</span>
                      <select
                        value={selectedPrimaryId}
                        onChange={(event) => {
                          setActiveSlot('primary')
                          void previewSelection(event.target.value, selectedSecondaryId)
                        }}
                        disabled={
                          pendingPreview ||
                          pendingCommit ||
                          refreshingProfile ||
                          remaining.primary > 0
                        }
                      >
                        {visiblePrimaryOptions.map((entry) => (
                          <option
                            key={`${entry.definition.id}:${entry.definition.definitionVersion}`}
                            value={entry.definition.id}
                          >
                            {entry.definition.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      className={styles.slotSelector}
                      data-active={activeSlot === 'secondary' ? 'true' : 'false'}
                      onFocus={() => setActiveSlot('secondary')}
                    >
                      <span>Secondary Discipline</span>
                      <select
                        value={selectedSecondaryId}
                        onChange={(event) => {
                          setActiveSlot('secondary')
                          void previewSelection(selectedPrimaryId, event.target.value)
                        }}
                        disabled={
                          pendingPreview ||
                          pendingCommit ||
                          refreshingProfile ||
                          remaining.secondary > 0 ||
                          !secondarySelectable
                        }
                      >
                        <option value="">None</option>
                        {visibleSecondaryOptions.map((entry) => (
                          <option
                            key={`${entry.definition.id}:${entry.definition.definitionVersion}`}
                            value={entry.definition.id}
                          >
                            {entry.definition.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section
                  className={styles.comparisonGrid}
                  data-testid="primary-build-preview"
                  aria-label="Discipline stat preview"
                >
                  <article className={styles.previewCard}>
                    <header>
                      <span>{`Current ${activeSlot === 'primary' ? 'Primary' : 'Secondary'}`}</span>
                      <b>● Committed</b>
                    </header>
                    <div className={styles.previewIdentity}>
                      {currentSlotDefinition ? (
                        <FoundationDisciplineSigil
                          disciplineId={currentSlotDefinition.id}
                          className={styles.previewSigil}
                        />
                      ) : (
                        <span className={styles.previewLock} aria-hidden="true">
                          ▣
                        </span>
                      )}
                      <div>
                        <strong>{currentSlotDefinition?.name ?? 'Locked'}</strong>
                        {currentSlotDefinition ? (
                          <FocusBadges disciplineId={currentSlotDefinition.id} />
                        ) : (
                          <small>No Secondary Discipline committed.</small>
                        )}
                      </div>
                    </div>
                    <div className={styles.statRows}>
                      {coreDeltas.map((entry) => (
                        <div className={styles.statValue} key={entry.id}>
                          <span>{entry.label}</span>
                          <strong>{entry.current}</strong>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={styles.previewCard}>
                    <header>
                      <span>{`Preview ${activeSlot === 'primary' ? 'Primary' : 'Secondary'}`}</span>
                      <b data-preview="true">● Preview</b>
                    </header>
                    <div className={styles.previewIdentity}>
                      {proposedSlotDefinition ? (
                        <FoundationDisciplineSigil
                          disciplineId={proposedSlotDefinition.id}
                          className={styles.previewSigil}
                        />
                      ) : (
                        <span className={styles.previewLock} aria-hidden="true">
                          ▣
                        </span>
                      )}
                      <div>
                        <strong>{proposedSlotDefinition?.name ?? 'None'}</strong>
                        {proposedSlotDefinition ? (
                          <FocusBadges disciplineId={proposedSlotDefinition.id} />
                        ) : (
                          <small>No Secondary Discipline selected.</small>
                        )}
                      </div>
                    </div>
                    <div className={styles.statRows}>
                      {coreDeltas.map((entry) => (
                        <div
                          className={styles.statValue}
                          data-direction={entry.direction}
                          key={entry.id}
                        >
                          <span>{entry.label}</span>
                          <strong>
                            {entry.proposed}
                            {entry.direction === 'increase'
                              ? ' ▲'
                              : entry.direction === 'decrease'
                                ? ' ▼'
                                : ''}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </article>

                  <aside className={styles.impactPanel}>
                    <header>
                      <span>Change Impact</span>
                    </header>
                    <div className={styles.impactRows}>
                      {changedCore.map((entry) => {
                        const delta = entry.proposed - entry.current
                        return (
                          <div data-direction={entry.direction} key={entry.id}>
                            <strong>
                              {delta > 0 ? '+' : ''}
                              {delta} {entry.label}
                            </strong>
                            <span>
                              {entry.current} → {entry.proposed}
                            </span>
                          </div>
                        )
                      })}
                      {changedAdventure.map((entry) => (
                        <div data-direction={entry.direction} key={entry.id}>
                          <strong>{entry.label}</strong>
                          <span>
                            {formatDerivedValue(entry.current, entry.unit)} →{' '}
                            {formatDerivedValue(entry.proposed, entry.unit)}
                          </span>
                        </div>
                      ))}
                      {changedCore.length === 0 && changedAdventure.length === 0 ? (
                        <p>No stat changes in the current preview.</p>
                      ) : null}
                    </div>
                  </aside>
                </section>

                <footer className={styles.dialogActions}>
                  <button
                    type="button"
                    className={styles.confirmAction}
                    onClick={() => void commit()}
                    disabled={commitBlocked}
                  >
                    <span aria-hidden="true">⚔</span>
                    {pendingCommit ? 'Committing…' : 'Confirm Change'}
                  </button>
                </footer>

                {pendingPreview ? (
                  <p className={styles.status}>Calculating authoritative preview…</p>
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
