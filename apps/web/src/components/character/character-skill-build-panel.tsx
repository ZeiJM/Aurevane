'use client'

import { CompactSkillEffectSummary } from './compact-skill-effect-summary'
import { skillPreviewEffects } from './skill-effect-preview'

import Image from 'next/image'

import { pv1fSkillByActionId } from '@aurevane/game-core/combat/pv1f-skills'
import {
  DEFAULT_SUPPORT_ACTION_ID,
  SUPPORT_ACTION_IDS,
  type SupportActionId,
} from '@aurevane/game-core/combat/support-actions'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

import { battleSkillArtwork } from '../battle/battle-skill-presentation'
import {
  skillDisplayName,
  skillEffectSummaries,
  skillParameterRows,
  skillTypeDescription,
} from './skill-detail-presentation'
import styles from './character-skill-build-panel.module.css'
import {
  basicActionCharacteristicRows,
  type SkillCharacteristic,
} from './basic-action-presentation'
import { SkillCharacteristicRows } from './skill-characteristic-rows'

interface SkillCatalogEntryView {
  definition: MatureSkillDefinition
  learnedAt: string
  activeSource: boolean
}

interface EquippedSkillView {
  definition: MatureSkillDefinition
  slotIndex: number
  equippedAt: string
}

interface CharacterSkillBuildPanelProps {
  characterId: string
  initialBuildVersion: number
  initialSupportActionId?: SupportActionId
  primaryDiscipline: { id: string; name: string }
  secondaryDiscipline: { id: string; name: string } | null
  initialCapacity: number
  initialLearnedSkills: readonly SkillCatalogEntryView[]
  initialEquippedSkills: readonly EquippedSkillView[]
  initialResonance: AnyResonanceDefinition | null
  initialEssence: EssenceDefinition | null
}

interface SkillCommitResponse {
  context?: {
    build: { buildVersion: number; supportActionId?: SupportActionId }
    disciplineSkills: {
      capacity: number
      learnedSkills: readonly SkillCatalogEntryView[]
      equippedSkills: readonly EquippedSkillView[]
    }
  }
  error?: { message?: string }
}

const PROFILE_PANEL_QUERY = 'profilePanel'
const TECHNIQUES_PANEL = 'techniques'
const MIXED_SOURCE_MAXIMUM = 3
const TECHNIQUES_PER_DISCIPLINE = 8

const DISCIPLINE_PALETTE: Readonly<Record<string, { accent: string; deep: string }>> = {
  vanguard: { accent: '232 119 76', deep: '117 50 31' },
  lifebinder: { accent: '93 207 149', deep: '32 99 67' },
  aetherist: { accent: '160 126 241', deep: '73 47 132' },
  farstrider: { accent: '116 195 104', deep: '51 93 43' },
  shadehand: { accent: '202 104 181', deep: '92 43 83' },
  ironfist: { accent: '229 170 79', deep: '109 70 29' },
}

function paletteFor(disciplineId: string): { accent: string; deep: string } {
  return DISCIPLINE_PALETTE[disciplineId] ?? { accent: '197 158 92', deep: '102 78 41' }
}

function skillPaletteStyle(disciplineId: string): CSSProperties {
  const palette = paletteFor(disciplineId)
  return {
    '--skill-accent': palette.accent,
    '--skill-deep': palette.deep,
  } as CSSProperties
}

function titleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function orderedSkillIds(equippedSkills: readonly EquippedSkillView[]): string[] {
  return [...equippedSkills]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((entry) => entry.definition.id)
}

function sameSelection(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((skillId, index) => skillId === right[index])
}

export function CharacterSkillBuildPanel(props: CharacterSkillBuildPanelProps) {
  const {
    initialBuildVersion,
    primaryDiscipline,
    secondaryDiscipline,
    initialCapacity,
    initialLearnedSkills,
    initialEquippedSkills,
  } = props
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialIds = orderedSkillIds(initialEquippedSkills)
  const initialFocusedId =
    initialIds[0] ?? initialLearnedSkills.find((entry) => entry.activeSource)?.definition.id ?? null
  const open = searchParams.get(PROFILE_PANEL_QUERY) === TECHNIQUES_PANEL
  const buildVersionRef = useRef(initialBuildVersion)
  const pendingRef = useRef(false)
  const [supportActionId, setSupportActionId] = useState(
    props.initialSupportActionId ?? DEFAULT_SUPPORT_ACTION_ID,
  )
  const [committedSupportActionId, setCommittedSupportActionId] = useState(
    props.initialSupportActionId ?? DEFAULT_SUPPORT_ACTION_ID,
  )
  const [focusedSupportActionId, setFocusedSupportActionId] = useState<SupportActionId | null>(null)
  const [capacity, setCapacity] = useState(initialCapacity)
  const [learnedSkills, setLearnedSkills] =
    useState<readonly SkillCatalogEntryView[]>(initialLearnedSkills)
  const [committedIds, setCommittedIds] = useState<string[]>(initialIds)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [focusedSkillId, setFocusedSkillId] = useState<string | null>(initialFocusedId)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [coarsePointer, setCoarsePointer] = useState(false)
  const refreshOnCloseRef = useRef(false)

  const visibleSkills = useMemo(
    () => learnedSkills.filter((entry) => entry.activeSource),
    [learnedSkills],
  )
  const primarySkills = useMemo(
    () =>
      visibleSkills
        .filter((entry) => entry.definition.sourceDisciplineId === primaryDiscipline.id)
        .slice(0, TECHNIQUES_PER_DISCIPLINE),
    [primaryDiscipline.id, visibleSkills],
  )
  const secondarySkills = useMemo(
    () =>
      secondaryDiscipline
        ? visibleSkills
            .filter((entry) => entry.definition.sourceDisciplineId === secondaryDiscipline.id)
            .slice(0, TECHNIQUES_PER_DISCIPLINE)
        : [],
    [secondaryDiscipline, visibleSkills],
  )
  const focusedSkill =
    visibleSkills.find((entry) => entry.definition.id === focusedSkillId) ??
    visibleSkills[0] ??
    null
  const focusedSkillDisciplineName = focusedSkill
    ? focusedSkill.definition.sourceDisciplineId === primaryDiscipline.id
      ? primaryDiscipline.name
      : secondaryDiscipline?.id === focusedSkill.definition.sourceDisciplineId
        ? secondaryDiscipline.name
        : titleCase(focusedSkill.definition.sourceDisciplineId)
    : null
  const focusedCharacteristics: readonly SkillCharacteristic[] = focusedSkill
    ? [
        ...skillParameterRows(focusedSkill.definition).slice(0, 4),
        ['Effects', skillEffectSummaries(focusedSkill.definition)],
        ...skillParameterRows(focusedSkill.definition).slice(4),
      ]
    : []

  useEffect(() => {
    const media = window.matchMedia('(hover: none), (pointer: coarse)')
    const sync = () => setCoarsePointer(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
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

  useEffect(() => {
    if (open || !refreshOnCloseRef.current) return

    // Wait for the history update to commit before refreshing the server summary.
    refreshOnCloseRef.current = false
    router.refresh()
  }, [open, router])

  function setPanelOpen(nextOpen: boolean) {
    if (!nextOpen && pendingRef.current) return

    const params = new URLSearchParams(searchParams.toString())
    if (nextOpen) {
      params.set(PROFILE_PANEL_QUERY, TECHNIQUES_PANEL)
    } else if (params.get(PROFILE_PANEL_QUERY) === TECHNIQUES_PANEL) {
      params.delete(PROFILE_PANEL_QUERY)
    }
    const query = params.toString()
    const href = query ? `${pathname}?${query}` : pathname
    window.history.replaceState(null, '', href)
  }

  function selectedSourceCount(
    sourceDisciplineId: string,
    ids: readonly string[] = selectedIds,
  ): number {
    const selected = new Set(ids)
    return visibleSkills.filter(
      (entry) =>
        selected.has(entry.definition.id) &&
        entry.definition.sourceDisciplineId === sourceDisciplineId,
    ).length
  }

  function mixedSelectionValid(ids: readonly string[]): boolean {
    if (!secondaryDiscipline || ids.length < capacity) return true
    return (
      selectedSourceCount(primaryDiscipline.id, ids) > 0 &&
      selectedSourceCount(secondaryDiscipline.id, ids) > 0
    )
  }

  function nextSelectionFor(skill: SkillCatalogEntryView): string[] {
    const id = skill.definition.id
    if (selectedIds.includes(id)) {
      return selectedIds.filter((candidate) => candidate !== id)
    }
    if (selectedIds.length >= capacity) return selectedIds
    if (
      secondaryDiscipline &&
      selectedSourceCount(skill.definition.sourceDisciplineId) >= MIXED_SOURCE_MAXIMUM
    ) {
      return selectedIds
    }
    return [...selectedIds, id]
  }

  async function commitSelection(
    nextIds: string[],
    successMessage = 'Techniques saved automatically.',
  ) {
    if (pendingRef.current || sameSelection(nextIds, selectedIds)) return
    if (!mixedSelectionValid(nextIds)) {
      setMessage('A full mixed loadout needs at least one Technique from each active Discipline.')
      return
    }

    setSelectedIds(nextIds)
    pendingRef.current = true
    setPending(true)
    setMessage(null)

    try {
      const response = await fetch('/api/character/build/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedBuildVersion: buildVersionRef.current,
          skillIds: nextIds,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as SkillCommitResponse
      if (!response.ok || !body.context) {
        setSelectedIds(committedIds)
        refreshOnCloseRef.current = true
        setMessage(body.error?.message ?? 'The selected Techniques could not be saved.')
        return
      }

      const committed = orderedSkillIds(body.context.disciplineSkills.equippedSkills)
      buildVersionRef.current = body.context.build.buildVersion
      const committedSupport = body.context.build.supportActionId ?? committedSupportActionId
      setSupportActionId(committedSupport)
      setCommittedSupportActionId(committedSupport)
      setCapacity(body.context.disciplineSkills.capacity)
      setLearnedSkills(body.context.disciplineSkills.learnedSkills)
      setCommittedIds(committed)
      setSelectedIds(committed)
      refreshOnCloseRef.current = true
      setMessage(successMessage)
    } catch {
      setSelectedIds(committedIds)
      refreshOnCloseRef.current = true
      setMessage('The save could not be confirmed. Close Techniques to refresh your build.')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  function toggleAndCommit(skill: SkillCatalogEntryView) {
    if (!skill.activeSource || pendingRef.current) return
    setFocusedSupportActionId(null)
    setFocusedSkillId(skill.definition.id)
    setMessage(null)
    const nextIds = nextSelectionFor(skill)
    if (sameSelection(nextIds, selectedIds)) return
    void commitSelection(nextIds)
  }

  async function commitSupportAction(nextId: SupportActionId) {
    setFocusedSupportActionId(nextId)
    if (pendingRef.current || nextId === supportActionId) return
    pendingRef.current = true
    setSupportActionId(nextId)
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/character/build/support-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: props.characterId,
          expectedBuildVersion: buildVersionRef.current,
          supportActionId: nextId,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as SkillCommitResponse
      if (!response.ok || !body.context) {
        setSupportActionId(committedSupportActionId)
        refreshOnCloseRef.current = true
        setMessage(body.error?.message ?? 'The Support Action could not be saved.')
        return
      }
      const committedSupport = body.context.build.supportActionId ?? DEFAULT_SUPPORT_ACTION_ID
      const committed = orderedSkillIds(body.context.disciplineSkills.equippedSkills)
      buildVersionRef.current = body.context.build.buildVersion
      setSupportActionId(committedSupport)
      setCommittedSupportActionId(committedSupport)
      setCapacity(body.context.disciplineSkills.capacity)
      setLearnedSkills(body.context.disciplineSkills.learnedSkills)
      setCommittedIds(committed)
      setSelectedIds(committed)
      refreshOnCloseRef.current = true
      setMessage('Support Action saved for battle slot 3.')
    } catch {
      setSupportActionId(committedSupportActionId)
      refreshOnCloseRef.current = true
      setMessage('The save could not be confirmed. Close Techniques to refresh your build.')
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  function renderSupportActions() {
    return (
      <section className={styles.techniqueGroup} data-support-action-group="true">
        <header>
          <div>
            <span aria-hidden="true">✦</span>
            <h3>Support Action</h3>
          </div>
          <small>Choose one · Battle slot 3</small>
        </header>
        <div className={styles.supportGrid} role="radiogroup" aria-label="Support Action">
          {SUPPORT_ACTION_IDS.map((id) => {
            const selected = supportActionId === id
            const name = pv1fSkillByActionId(id)!.name
            return (
              <article
                className={styles.skill}
                key={id}
                data-selected={selected ? 'true' : 'false'}
                onMouseEnter={() => setFocusedSupportActionId(id)}
                onFocusCapture={() => setFocusedSupportActionId(id)}
              >
                <label>
                  <input
                    type="radio"
                    name={`support-action-${props.characterId}`}
                    checked={selected}
                    disabled={pending}
                    aria-label={name}
                    onChange={() => void commitSupportAction(id)}
                  />
                  <span
                    className={styles.skillArt}
                    data-av-square-media="true"
                    data-av-square-media-fit="contain"
                    aria-hidden="true"
                  >
                    <Image
                      src={battleSkillArtwork(id)}
                      width={160}
                      height={160}
                      unoptimized
                      alt=""
                    />
                    {selected ? <b>✓</b> : null}
                  </span>
                  <strong>{name}</strong>
                  <span className={styles.skillMeta}>
                    {id === 'basic.guard' ? 'Utility' : 'Recovery'}
                  </span>
                </label>
              </article>
            )
          })}
        </div>
      </section>
    )
  }

  function renderTechniqueGroup(
    discipline: { id: string; name: string } | null,
    skills: readonly SkillCatalogEntryView[],
    secondary: boolean,
  ) {
    const locked = secondary && !discipline
    return (
      <section
        className={styles.techniqueGroup}
        data-technique-group="true"
        data-locked={locked ? 'true' : 'false'}
      >
        <header>
          <div>
            <span aria-hidden="true">✦</span>
            <h3>
              {locked
                ? 'Secondary Discipline Techniques'
                : `${discipline?.name ?? 'Discipline'} Techniques`}
            </h3>
          </div>
          <small>{locked ? '0 / 8 unlocked' : `${skills.length} techniques available`}</small>
        </header>
        <div className={styles.skillGrid} data-technique-grid="true">
          {Array.from({ length: TECHNIQUES_PER_DISCIPLINE }, (_, index) => {
            if (locked) {
              return (
                <div
                  className={styles.lockedSkill}
                  data-technique-card="true"
                  key={`locked-${index}`}
                  aria-hidden="true"
                >
                  <span data-technique-art="true">▣</span>
                  <strong>Locked</strong>
                </div>
              )
            }

            const entry = skills[index]
            if (!entry) {
              return (
                <div
                  className={styles.lockedSkill}
                  data-technique-card="true"
                  key={`void-${index}`}
                  aria-hidden="true"
                >
                  <span data-technique-art="true">◇</span>
                  <strong>Unavailable</strong>
                </div>
              )
            }

            const selected = selectedIds.includes(entry.definition.id)
            const sourceCount = selectedSourceCount(entry.definition.sourceDisciplineId)
            const disabledBySource = Boolean(
              secondaryDiscipline && !selected && sourceCount >= MIXED_SOURCE_MAXIMUM,
            )
            const disabledByCapacity = !selected && selectedIds.length >= capacity
            const disabled = pending || disabledByCapacity || disabledBySource
            const label = skillDisplayName(entry.definition)

            return (
              <article
                className={styles.skill}
                data-technique-card="true"
                key={`${entry.definition.id}:${entry.definition.contentVersion}`}
                data-selected={selected ? 'true' : 'false'}
                style={skillPaletteStyle(entry.definition.sourceDisciplineId)}
                onMouseEnter={() => {
                  setFocusedSupportActionId(null)
                  setFocusedSkillId(entry.definition.id)
                }}
                onFocusCapture={() => {
                  setFocusedSupportActionId(null)
                  setFocusedSkillId(entry.definition.id)
                }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    aria-label={`${selected ? 'Unselect' : 'Select'} ${label}`}
                    onClick={(event) => {
                      if (!coarsePointer) return
                      event.preventDefault()
                      toggleAndCommit(entry)
                    }}
                    onChange={() => {
                      if (!coarsePointer) toggleAndCommit(entry)
                    }}
                  />
                  <span
                    className={styles.skillArt}
                    data-technique-art="true"
                    data-av-square-media="true"
                    data-av-square-media-fit="contain"
                    aria-hidden="true"
                  >
                    <Image
                      src={battleSkillArtwork(entry.definition.id)}
                      width={160}
                      height={160}
                      unoptimized
                      alt=""
                    />
                    {selected ? <b>✓</b> : null}
                  </span>
                  <strong>{label}</strong>
                  <span className={styles.skillMeta} data-technique-meta="true">
                    {skillTypeDescription(entry.definition)}
                  </span>
                </label>
              </article>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className={styles.root} data-testid="skill-build-panel">
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Manage Techniques. ${selectedIds.length} of ${capacity} selected.`}
        onClick={() => setPanelOpen(true)}
      >
        <span aria-hidden="true">⚔</span>
        <strong>Manage Techniques</strong>
        <span aria-hidden="true">›</span>
      </button>

      {open && mounted
        ? createPortal(
            <div
              className={styles.backdrop}
              data-techniques-overlay="true"
              role="presentation"
              onPointerDown={() => setPanelOpen(false)}
            >
              <section
                className={styles.dialog}
                data-av-surface="moonstone"
                data-character-concept="editor"
                role="dialog"
                aria-modal="true"
                aria-labelledby="skill-build-heading"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header className={styles.header}>
                  <div className={styles.headingCopy}>
                    <span className={styles.headerIcon} aria-hidden="true">
                      ⚔
                    </span>
                    <div>
                      <h2 id="skill-build-heading">Techniques</h2>
                      <small className={styles.autoSaveNote} data-testid="skill-capacity">
                        Discipline Skills — {selectedIds.length} / {capacity} selected
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.close}
                    disabled={pending}
                    onClick={() => setPanelOpen(false)}
                  >
                    <span aria-hidden="true">×</span>
                    Close
                  </button>
                </header>

                <div className={styles.workspace} data-technique-workspace="true">
                  <section
                    className={styles.techniqueArea}
                    aria-label="Available Techniques"
                    data-testid="learned-skill-list"
                  >
                    {renderTechniqueGroup(primaryDiscipline, primarySkills, false)}
                    {renderTechniqueGroup(secondaryDiscipline, secondarySkills, true)}
                    {renderSupportActions()}
                  </section>

                  <aside
                    className={styles.detailRail}
                    data-av-surface="ink"
                    data-testid="technique-preview"
                  >
                    <section className={styles.selectedTechnique}>
                      <span>
                        {focusedSupportActionId ? 'Support Action Preview' : 'Technique Preview'}
                      </span>
                      {focusedSupportActionId ? (
                        <>
                          <div className={styles.selectedTechniqueHeading}>
                            <span
                              className={styles.detailArt}
                              data-av-square-media="true"
                              data-av-square-media-fit="contain"
                            >
                              <Image
                                src={battleSkillArtwork(focusedSupportActionId)}
                                width={192}
                                height={192}
                                unoptimized
                                alt=""
                              />
                            </span>
                            <div>
                              <strong>{pv1fSkillByActionId(focusedSupportActionId)!.name}</strong>
                              <small>One Support Action, separate from Discipline Skills.</small>
                            </div>
                          </div>
                          <dl className={styles.characteristics}>
                            <SkillCharacteristicRows
                              rows={basicActionCharacteristicRows(focusedSupportActionId)}
                            />
                          </dl>
                        </>
                      ) : focusedSkill ? (
                        <>
                          <div className={styles.selectedTechniqueHeading}>
                            <span
                              className={styles.detailArt}
                              data-av-square-media="true"
                              data-av-square-media-fit="contain"
                            >
                              <Image
                                src={battleSkillArtwork(focusedSkill.definition.id)}
                                width={192}
                                height={192}
                                unoptimized
                                alt=""
                              />
                            </span>
                            <div>
                              <strong>{skillDisplayName(focusedSkill.definition)}</strong>
                              <small>
                                {focusedSkill.definition.flavorLine ??
                                  `${focusedSkillDisciplineName} Technique`}
                              </small>
                            </div>
                          </div>
                          <dl className={styles.characteristics}>
                            {focusedCharacteristics.map(([label, value]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>
                                  {label === 'Effects' && focusedSkill ? (
                                    focusedSkill.definition.effects.length > 0 ? (
                                      <div className={styles.effectSummaryList}>
                                        {focusedSkill.definition.effects.map((effect, index) => (
                                          <CompactSkillEffectSummary
                                            effect={effect}
                                            key={`${index}:${effect.type}`}
                                          />
                                        ))}
                                      </div>
                                    ) : (
                                      'N/A'
                                    )
                                  ) : typeof value === 'string' ? (
                                    value
                                  ) : value.length > 0 ? (
                                    value.join(', ')
                                  ) : (
                                    'N/A'
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          <ul
                            className={styles.effectExplanations}
                            aria-label="Effect explanations"
                          >
                            {skillPreviewEffects(focusedSkill.definition).map((effect) => (
                              <li key={JSON.stringify(effect)}>
                                <strong>{effect.label}</strong> — {effect.explanation}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p>No Technique is available for this build.</p>
                      )}
                    </section>
                  </aside>
                </div>

                <footer className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => void commitSelection([], 'Selections cleared.')}
                    disabled={pending || selectedIds.length === 0}
                  >
                    ↻ Clear Selections
                  </button>
                  {pending ? (
                    <span className={styles.saveState} aria-live="polite">
                      Saving selection…
                    </span>
                  ) : null}
                </footer>

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
