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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
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
  characterId: string
  initialCurrent: PrimaryDisciplinePreview
  initialCurrentSecondary: DisciplineDefinitionView | null
  availablePrimaries: readonly PrimaryOption[]
  availableSecondaries: readonly SecondaryOption[]
  initialAttunement: AttunementView
  coreAttributes: CharacterAttributes
}

interface BuildPreviewResponse {
  preview?: {
    characterId: string
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
    build: { characterId: string; buildVersion: number }
    current: PrimaryDisciplinePreview
    currentSecondary: DisciplineDefinitionView | null
    attributes: CharacterAttributes
    attunement: AttunementView
  }
  error?: { message?: string }
}

type DeltaDirection = 'increase' | 'decrease' | 'neutral'
type DisciplineSlot = 'primary' | 'secondary'

const PROFILE_PANEL_QUERY = 'profilePanel'
const DISCIPLINES_PANEL = 'disciplines'

export function shouldRunAttunementCountdown(
  open: boolean,
  remaining: { primary: number; secondary: number },
): boolean {
  return open && (remaining.primary > 0 || remaining.secondary > 0)
}

function focusAttributes(disciplineId: string): readonly CharacterAttributeId[] {
  return foundationDisciplineAttributePolicy(disciplineId)?.focusAttributes ?? []
}

function committedDisciplineSummary(summary: string): string {
  return summary.replace(/\s*Focus:\s*[^.]+\.?\s*$/i, '').trim()
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
  synchronizing?: boolean
  pendingCommit: boolean
  refreshingProfile: boolean
  primaryRemainingSeconds: number
  secondaryRemainingSeconds: number
  activeSlot: DisciplineSlot
  onSelect: (primaryId: string, secondaryId: string) => void
}

/** Library choices immediately submit the edited slot to server authority. */
export function DisciplineLibrary({
  options,
  selectedPrimaryId,
  selectedSecondaryId,
  pendingPreview,
  synchronizing = false,
  pendingCommit,
  refreshingProfile,
  primaryRemainingSeconds,
  secondaryRemainingSeconds,
  activeSlot,
  onSelect,
}: DisciplineLibraryProps) {
  const disabled =
    synchronizing ||
    pendingPreview ||
    pendingCommit ||
    refreshingProfile ||
    (activeSlot === 'primary' ? primaryRemainingSeconds : secondaryRemainingSeconds) > 0
  const selectedId = activeSlot === 'primary' ? selectedPrimaryId : selectedSecondaryId
  return (
    <section
      className={styles.roster}
      aria-label={`${activeSlot === 'primary' ? 'Primary' : 'Secondary'} Discipline library`}
      tabIndex={0}
      aria-busy={synchronizing || pendingPreview || pendingCommit}
    >
      <h3>Discipline library</h3>
      <p className={styles.libraryHint}>
        {synchronizing
          ? 'Refreshing committed Disciplines…'
          : pendingPreview || pendingCommit
            ? `Applying ${activeSlot === 'primary' ? 'Primary' : 'Secondary'} Discipline…`
            : `Choose a ${activeSlot === 'primary' ? 'Primary' : 'Secondary'} Discipline to apply immediately.`}
      </p>
      {options.length === 0 ? (
        <p className={styles.libraryHint}>No eligible Disciplines are available for this slot.</p>
      ) : null}
      {activeSlot === 'secondary' ? (
        <button
          type="button"
          className={styles.clearSecondary}
          disabled={disabled || !selectedSecondaryId}
          onClick={() => onSelect(selectedPrimaryId, '')}
        >
          Remove Secondary Discipline
        </button>
      ) : null}
      <div className={styles.rosterGrid}>
        {options.map(({ definition }) => (
          <button
            key={definition.id}
            type="button"
            className={styles.disciplineCard}
            data-selected={selectedId === definition.id}
            aria-pressed={selectedId === definition.id}
            aria-label={`Select ${definition.name} as ${activeSlot === 'primary' ? 'Primary' : 'Secondary'} Discipline`}
            disabled={disabled}
            onClick={() =>
              activeSlot === 'primary'
                ? onSelect(definition.id, selectedSecondaryId)
                : onSelect(selectedPrimaryId, definition.id)
            }
          >
            <FoundationDisciplineSigil disciplineId={definition.id} className={styles.cardSigil} />
            <span className={styles.cardCopy}>
              <strong>
                {selectedId === definition.id ? <span aria-hidden="true">✓ </span> : null}
                {definition.name}
              </strong>
              <FocusBadges disciplineId={definition.id} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function CharacterDisciplineBuildPanel({
  characterId,
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
  const [current, setCurrent] = useState(initialCurrent)
  const [currentSecondary, setCurrentSecondary] = useState(initialCurrentSecondary)
  const [committedAttributes, setCommittedAttributes] = useState(coreAttributes)
  const [buildVersion, setBuildVersion] = useState<number | null>(null)
  const selectedPrimaryId = current.definition.id
  const selectedSecondaryId = currentSecondary?.id ?? ''
  const [activeSlot, setActiveSlot] = useState<DisciplineSlot>('primary')
  const [slotChosen, setSlotChosen] = useState(false)
  const [lastChange, setLastChange] = useState<BuildPreviewResponse['preview'] | null>(null)
  const [remaining, setRemaining] = useState({
    primary: initialAttunement.primaryRemainingSeconds,
    secondary: initialAttunement.secondaryRemainingSeconds,
  })
  const [synchronizing, setSynchronizing] = useState(open)
  const [synchronizationFailed, setSynchronizationFailed] = useState(false)
  const [pendingPreview, setPendingPreview] = useState(false)
  const [pendingCommit, setPendingCommit] = useState(false)
  const [refreshingProfile, startProfileRefresh] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const countdownActive = shouldRunAttunementCountdown(open, remaining)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const requestRef = useRef<symbol | null>(null)
  const syncRef = useRef<symbol | null>(null)
  const commitCompletionRef = useRef<Promise<unknown> | null>(null)
  const identityRef = useRef({ characterId, pathname, open })
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    setSlotChosen(false)
    setSynchronizing(open)
    setSynchronizationFailed(false)
    if (!open) {
      setLastChange(null)
      setMessage(null)
      setPendingPreview(false)
      setPendingCommit(false)
    }
  }

  useLayoutEffect(() => {
    identityRef.current = { characterId, pathname, open }
    return () => {
      requestRef.current = null
    }
  }, [open, characterId, pathname])

  const synchronizeCommittedBuild = useCallback(async () => {
    const sync = Symbol('committed build refresh')
    syncRef.current = sync
    const isCurrentSync = () =>
      syncRef.current === sync &&
      identityRef.current.characterId === characterId &&
      identityRef.current.pathname === pathname &&
      identityRef.current.open &&
      window.location.pathname === pathname
    try {
      // A reopened dialog must read after any abandoned commit settles.
      await commitCompletionRef.current?.catch(() => undefined)
      if (!isCurrentSync()) return
      const response = await fetch('/api/character/build/disciplines', {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as BuildCommitResponse
      if (!isCurrentSync()) return
      if (!response.ok || !body.context) {
        setSynchronizationFailed(true)
        setMessage(
          body.error?.message ??
            'Committed Disciplines could not be refreshed. Close and reopen to retry.',
        )
        return
      }
      if (body.context.build.characterId !== characterId) {
        setSynchronizationFailed(true)
        setMessage('The selected character changed. Reopen Discipline Management to continue.')
        return
      }
      setBuildVersion(body.context.build.buildVersion)
      setCurrent(body.context.current)
      setCurrentSecondary(body.context.currentSecondary)
      setCommittedAttributes(body.context.attributes)
      setRemaining({
        primary: body.context.attunement.primaryRemainingSeconds,
        secondary: body.context.attunement.secondaryRemainingSeconds,
      })
      setSynchronizationFailed(false)
    } catch {
      if (!isCurrentSync()) return
      setSynchronizationFailed(true)
      setMessage('Committed Disciplines could not be refreshed. Close and reopen to retry.')
    } finally {
      if (isCurrentSync()) {
        syncRef.current = null
        setSynchronizing(false)
      }
    }
  }, [characterId, pathname])

  useEffect(() => {
    let active = true
    if (open)
      queueMicrotask(() => {
        if (active) void synchronizeCommittedBuild()
      })
    return () => {
      active = false
      syncRef.current = null
    }
  }, [open, synchronizeCommittedBuild])

  useEffect(() => {
    if (!open || !mounted) return
    dialogRef.current?.focus()
    const trigger = triggerRef.current
    return () => {
      if (trigger?.isConnected) trigger.focus()
    }
  }, [open, mounted])

  useEffect(() => {
    if (!countdownActive) return

    const timer = window.setInterval(() => {
      setRemaining((value) => {
        const primary = Math.max(0, value.primary - 1)
        const secondary = Math.max(0, value.secondary - 1)
        if (primary === value.primary && secondary === value.secondary) return value
        return { primary, secondary }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countdownActive])

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
    const currentAttributes = lastChange?.currentAttributes ?? committedAttributes
    const proposedAttributes = lastChange?.proposedAttributes ?? committedAttributes
    return CHARACTER_ATTRIBUTE_IDS.map((attributeId) => ({
      id: attributeId,
      label: CHARACTER_ATTRIBUTE_LABELS[attributeId],
      current: currentAttributes[attributeId],
      proposed: proposedAttributes[attributeId],
      direction: deltaDirection(currentAttributes[attributeId], proposedAttributes[attributeId]),
    }))
  }, [committedAttributes, lastChange])

  const adventureDeltas = useMemo(() => {
    const baseline = lastChange?.current ?? current
    const proposed = lastChange?.proposed ?? current
    return Object.values(baseline.derived.stats).map((stat) => ({
      id: stat.id,
      label: stat.label,
      unit: stat.unit,
      current: stat.value,
      proposed: proposed.derived.stats[stat.id].value,
      direction: deltaDirection(stat.value, proposed.derived.stats[stat.id].value),
    }))
  }, [current, lastChange])

  const currentSlotDefinition = activeSlot === 'primary' ? current.definition : currentSecondary
  const primarySlotSelected = slotChosen && activeSlot === 'primary'
  const secondarySlotSelected = slotChosen && activeSlot === 'secondary'
  const changedCore = coreDeltas.filter((entry) => entry.direction !== 'neutral')
  const changedAdventure = adventureDeltas
    .filter((entry) => entry.direction !== 'neutral')
    .slice(0, Math.max(0, 6 - changedCore.length))

  function selectSlot(slot: DisciplineSlot) {
    setActiveSlot(slot)
    setSlotChosen(true)
  }

  function setPanelOpen(nextOpen: boolean) {
    if (!nextOpen && (requestRef.current || refreshingProfile)) return
    if (!nextOpen) {
      setLastChange(null)
      setMessage(null)
    }
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

  async function applySelection(primaryDisciplineId: string, secondaryDisciplineId: string) {
    if (
      requestRef.current ||
      refreshingProfile ||
      synchronizing ||
      synchronizationFailed ||
      !open ||
      buildVersion === null ||
      (activeSlot === 'primary' ? remaining.primary : remaining.secondary) > 0
    )
      return
    if (secondaryDisciplineId && primaryDisciplineId === secondaryDisciplineId) {
      setMessage('Primary and Secondary Disciplines must be different.')
      return
    }
    if (
      primaryDisciplineId === current.definition.id &&
      secondaryDisciplineId === (currentSecondary?.id ?? '')
    )
      return

    const selection =
      activeSlot === 'primary'
        ? { primaryDisciplineId }
        : { secondaryDisciplineId: secondaryDisciplineId || null }

    const request = Symbol('discipline change')
    requestRef.current = request
    const isCurrentRequest = () =>
      requestRef.current === request &&
      identityRef.current.characterId === characterId &&
      identityRef.current.pathname === pathname &&
      identityRef.current.open &&
      window.location.pathname === pathname
    setMessage(null)
    setPendingCommit(true)
    let commitStarted = false
    try {
      // The synchronized context already supplies the expected version. PUT remains authoritative
      // for identity, attunement, compatibility, allocation, and stale-version checks.
      commitStarted = true
      const commitCompletion = fetch('/api/character/build/disciplines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedCharacterId: characterId,
          expectedBuildVersion: buildVersion,
          ...selection,
          idempotencyKey: crypto.randomUUID(),
        }),
      }).then(async (response) => ({
        response,
        body: (await response.json()) as BuildCommitResponse,
      }))
      commitCompletionRef.current = commitCompletion
      const { response: committedResponse, body: committedBody } = await commitCompletion
      if (!isCurrentRequest()) return
      if (!committedResponse.ok || !committedBody.context) {
        setMessage(committedBody.error?.message ?? 'The Discipline build could not be changed.')
        setSynchronizing(true)
        void synchronizeCommittedBuild()
        return
      }
      const context = committedBody.context
      if (context.build.characterId !== characterId) {
        setMessage('The selected character changed. Reopen Discipline Management to continue.')
        return
      }
      setBuildVersion(context.build.buildVersion)
      setCommittedAttributes(context.attributes)
      setCurrent(context.current)
      setCurrentSecondary(context.currentSecondary)
      setRemaining({
        primary: context.attunement.primaryRemainingSeconds,
        secondary: context.attunement.secondaryRemainingSeconds,
      })
      setLastChange({
        characterId,
        current,
        currentSecondary,
        currentAttributes: committedAttributes,
        buildVersion,
        changes: {
          primary: current.definition.id !== context.current.definition.id,
          secondary: (currentSecondary?.id ?? null) !== (context.currentSecondary?.id ?? null),
        },
        attunement: context.attunement,
        proposed: context.current,
        proposedAttributes: context.attributes,
        proposedSecondary: context.currentSecondary,
      })
      setMessage('Discipline changes committed.')
      startProfileRefresh(() => router.refresh())
    } catch {
      if (!isCurrentRequest()) return
      setMessage(
        commitStarted
          ? 'The build service could not confirm the change. Refresh to check your committed Disciplines.'
          : 'The build service could not be reached. Nothing was changed.',
      )
      if (commitStarted) {
        setSynchronizing(true)
        void synchronizeCommittedBuild()
      }
    } finally {
      if (isCurrentRequest()) {
        requestRef.current = null
        setPendingPreview(false)
        setPendingCommit(false)
      }
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
                      <p>Shape your path. Choose a slot, then select a Discipline to apply it.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.close}
                    disabled={pendingPreview || pendingCommit || refreshingProfile}
                    onClick={() => setPanelOpen(false)}
                  >
                    <span aria-hidden="true">×</span>
                    Close
                  </button>
                </header>

                <div className={styles.managementBody}>
                  <DisciplineLibrary
                    options={
                      activeSlot === 'primary' ? visiblePrimaryOptions : visibleSecondaryOptions
                    }
                    selectedPrimaryId={selectedPrimaryId}
                    selectedSecondaryId={selectedSecondaryId}
                    pendingPreview={pendingPreview}
                    synchronizing={synchronizing}
                    pendingCommit={pendingCommit}
                    refreshingProfile={refreshingProfile || synchronizationFailed}
                    primaryRemainingSeconds={remaining.primary}
                    secondaryRemainingSeconds={remaining.secondary}
                    activeSlot={activeSlot}
                    onSelect={(primaryId, secondaryId) => {
                      setSlotChosen(true)
                      void applySelection(primaryId, secondaryId)
                    }}
                  />
                  <div className={styles.disciplineDetail}>
                    <section className={styles.committedSection} aria-label="Currently committed">
                      <div className={styles.sectionTitle}>
                        <h3>
                          {synchronizing
                            ? 'Loading Committed Disciplines…'
                            : synchronizationFailed
                              ? 'Committed Disciplines Unavailable'
                              : 'Currently Committed'}
                        </h3>
                        <span>Click a card to edit its slot</span>
                      </div>
                      <div className={styles.current}>
                        <button
                          type="button"
                          className={styles.currentDiscipline}
                          data-av-surface="ink"
                          data-active={primarySlotSelected}
                          aria-pressed={primarySlotSelected}
                          aria-label="Edit Primary Discipline"
                          disabled={
                            pendingPreview ||
                            pendingCommit ||
                            refreshingProfile ||
                            synchronizing ||
                            synchronizationFailed
                          }
                          onClick={() => selectSlot('primary')}
                        >
                          <FoundationDisciplineSigil
                            disciplineId={current.definition.id}
                            className={styles.currentSigil}
                          />
                          <div>
                            <span>Primary Discipline</span>
                            <strong>{current.definition.name}</strong>
                            <p>{committedDisciplineSummary(current.definition.summary)}</p>
                            <small>
                              {primarySlotSelected ? '✓ Editing Primary' : 'Click to edit Primary'}
                            </small>
                          </div>
                        </button>
                        {currentSecondary ? (
                          <button
                            type="button"
                            className={styles.currentDiscipline}
                            data-av-surface="ink"
                            data-active={secondarySlotSelected}
                            aria-pressed={secondarySlotSelected}
                            aria-label="Edit Secondary Discipline"
                            disabled={
                              pendingPreview ||
                              pendingCommit ||
                              refreshingProfile ||
                              synchronizing ||
                              synchronizationFailed
                            }
                            onClick={() => selectSlot('secondary')}
                          >
                            <FoundationDisciplineSigil
                              disciplineId={currentSecondary.id}
                              className={styles.currentSigil}
                            />
                            <div>
                              <span>Secondary Discipline</span>
                              <strong>{currentSecondary.name}</strong>
                              <p>{committedDisciplineSummary(currentSecondary.summary)}</p>
                              <small>
                                {secondarySlotSelected
                                  ? '✓ Editing Secondary'
                                  : 'Click to edit Secondary'}
                              </small>
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.currentDiscipline}
                            data-active={secondarySlotSelected}
                            aria-pressed={secondarySlotSelected}
                            aria-label="Edit Secondary Discipline"
                            disabled={
                              pendingPreview ||
                              pendingCommit ||
                              refreshingProfile ||
                              synchronizing ||
                              synchronizationFailed
                            }
                            onClick={() => selectSlot('secondary')}
                            data-av-surface="ink"
                            data-locked="true"
                          >
                            <span className={styles.currentLock} aria-hidden="true">
                              ▣
                            </span>
                            <div>
                              <span>Secondary Discipline</span>
                              <strong>None</strong>
                              <p>A second discipline awaits.</p>
                              <small>
                                {secondarySlotSelected
                                  ? '✓ Editing Secondary'
                                  : 'Click to edit Secondary'}
                              </small>
                            </div>
                          </button>
                        )}
                      </div>
                    </section>

                    <section
                      className={styles.comparisonGrid}
                      data-testid="primary-build-preview"
                      aria-label="Selected Discipline and change impact"
                    >
                      <article className={styles.previewCard}>
                        <header>
                          <span>{`Selected ${activeSlot === 'primary' ? 'Primary' : 'Secondary'}`}</span>
                          <b>
                            {synchronizing
                              ? '● Refreshing'
                              : synchronizationFailed
                                ? '● Last known'
                                : '● Committed'}
                          </b>
                        </header>
                        <div className={styles.previewIdentity}>
                          <div>
                            <strong>{currentSlotDefinition?.name ?? 'None'}</strong>
                            {currentSlotDefinition ? (
                              <FocusBadges disciplineId={currentSlotDefinition.id} />
                            ) : (
                              <small>No Secondary Discipline committed.</small>
                            )}
                          </div>
                        </div>
                        <div className={styles.statRows}>
                          {CHARACTER_ATTRIBUTE_IDS.map((id) => (
                            <div className={styles.statValue} key={id}>
                              <span>{CHARACTER_ATTRIBUTE_LABELS[id]}</span>
                              <strong>{committedAttributes[id]}</strong>
                            </div>
                          ))}
                        </div>
                      </article>

                      <aside className={styles.impactPanel} aria-label="Change Impact">
                        <header>
                          <span>Change Impact</span>
                          {lastChange ? <small>Last successful change</small> : null}
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
                            <p>
                              {lastChange
                                ? 'No stat changes in the last successful change.'
                                : 'Select a Discipline to see the change impact.'}
                            </p>
                          ) : null}
                        </div>
                      </aside>
                    </section>

                    {pendingPreview || pendingCommit ? (
                      <p className={styles.status} role="status">
                        Applying Discipline change…
                      </p>
                    ) : null}
                    {message ? (
                      <p className={styles.status} role="status">
                        {message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
