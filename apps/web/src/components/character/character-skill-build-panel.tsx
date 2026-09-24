'use client'

import Image from 'next/image'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { battleSkillArtwork } from '../battle/battle-skill-presentation'
import { SkillDetails } from './skill-details'
import { skillDisplayName } from './skill-detail-presentation'
import styles from './character-skill-build-panel.module.css'

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
  primaryDiscipline: { id: string; name: string }
  secondaryDiscipline: { id: string; name: string } | null
  initialCapacity: number
  initialLearnedSkills: readonly SkillCatalogEntryView[]
  initialEquippedSkills: readonly EquippedSkillView[]
  initialResonance: ResonanceDefinition | null
  initialEssence: EssenceDefinition | null
}

interface SkillCommitResponse {
  context?: {
    build: { buildVersion: number }
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

function cockpitType(skill: MatureSkillDefinition): string {
  const cockpitTag = skill.tags.find((tag) => tag.startsWith('cockpit:'))
  return cockpitTag ? titleCase(cockpitTag.slice('cockpit:'.length)) : 'Technique'
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
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [capacity, setCapacity] = useState(initialCapacity)
  const [learnedSkills, setLearnedSkills] =
    useState<readonly SkillCatalogEntryView[]>(initialLearnedSkills)
  const [committedIds, setCommittedIds] = useState<string[]>(initialIds)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [focusedSkillId, setFocusedSkillId] = useState<string | null>(initialFocusedId)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [refreshOnClose, setRefreshOnClose] = useState(false)

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

  function setPanelOpen(nextOpen: boolean) {
    if (!nextOpen && pending) return

    const params = new URLSearchParams(searchParams.toString())
    if (nextOpen) {
      params.set(PROFILE_PANEL_QUERY, TECHNIQUES_PANEL)
    } else if (params.get(PROFILE_PANEL_QUERY) === TECHNIQUES_PANEL) {
      params.delete(PROFILE_PANEL_QUERY)
    }
    const query = params.toString()
    const href = query ? `${pathname}?${query}` : pathname
    window.history.replaceState(null, '', href)

    if (!nextOpen && refreshOnClose) {
      setRefreshOnClose(false)
      router.refresh()
    }
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

  async function commitSelection(nextIds: string[], successMessage = 'Techniques saved automatically.') {
    if (pending || sameSelection(nextIds, selectedIds)) return
    if (!mixedSelectionValid(nextIds)) {
      setMessage('A full mixed loadout needs at least one Technique from each active Discipline.')
      return
    }

    setSelectedIds(nextIds)
    setPending(true)
    setMessage(null)

    try {
      const response = await fetch('/api/character/build/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedBuildVersion: buildVersion,
          skillIds: nextIds,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as SkillCommitResponse
      if (!response.ok || !body.context) {
        setSelectedIds(committedIds)
        setMessage(body.error?.message ?? 'The selected Techniques could not be saved.')
        return
      }

      const committed = orderedSkillIds(body.context.disciplineSkills.equippedSkills)
      setBuildVersion(body.context.build.buildVersion)
      setCapacity(body.context.disciplineSkills.capacity)
      setLearnedSkills(body.context.disciplineSkills.learnedSkills)
      setCommittedIds(committed)
      setSelectedIds(committed)
      setRefreshOnClose(true)
      setMessage(successMessage)
    } catch {
      setSelectedIds(committedIds)
      setMessage('The build service could not be reached. Nothing was changed.')
    } finally {
      setPending(false)
    }
  }

  function toggleAndCommit(skill: SkillCatalogEntryView) {
    if (!skill.activeSource || pending) return
    setFocusedSkillId(skill.definition.id)
    setMessage(null)
    const nextIds = nextSelectionFor(skill)
    if (sameSelection(nextIds, selectedIds)) return
    void commitSelection(nextIds)
  }

  function renderTechniqueGroup(
    discipline: { id: string; name: string } | null,
    skills: readonly SkillCatalogEntryView[],
    secondary: boolean,
  ) {
    const locked = secondary && !discipline
    return (
      <section className={styles.techniqueGroup} data-locked={locked ? 'true' : 'false'}>
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
        <div className={styles.skillGrid}>
          {Array.from({ length: TECHNIQUES_PER_DISCIPLINE }, (_, index) => {
            if (locked) {
              return (
                <div className={styles.lockedSkill} key={`locked-${index}`} aria-hidden="true">
                  <span>▣</span>
                  <strong>Locked</strong>
                </div>
              )
            }

            const entry = skills[index]
            if (!entry) {
              return (
                <div className={styles.lockedSkill} key={`void-${index}`} aria-hidden="true">
                  <span>◇</span>
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
                key={`${entry.definition.id}:${entry.definition.contentVersion}`}
                data-selected={selected ? 'true' : 'false'}
                style={skillPaletteStyle(entry.definition.sourceDisciplineId)}
                onMouseEnter={() => setFocusedSkillId(entry.definition.id)}
                onFocusCapture={() => setFocusedSkillId(entry.definition.id)}
              >
                <label
                  onClick={(event) => {
                    setFocusedSkillId(entry.definition.id)
                    if (coarsePointer) event.preventDefault()
                  }}
                  onDoubleClick={(event) => {
                    if (!coarsePointer) return
                    event.preventDefault()
                    toggleAndCommit(entry)
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    aria-label={`${selected ? 'Unselect' : 'Select'} ${label}`}
                    onChange={() => {
                      if (!coarsePointer) toggleAndCommit(entry)
                    }}
                  />
                  <span
                    className={styles.skillArt}
                    data-av-square-media="true"
                    data-av-square-media-fit="contain"
                    aria-hidden="true"
                  >
                    <Image
                      src={battleSkillArtwork(entry.definition.id)}
                      width={96}
                      height={96}
                      unoptimized
                      alt=""
                    />
                    {selected ? <b>✓</b> : null}
                  </span>
                  <strong>{label}</strong>
                  <span className={styles.skillMeta}>
                    {entry.definition.apCost} AP · {cockpitType(entry.definition)}
                    {entry.definition.mpCost ? ` · ${entry.definition.mpCost} MP` : ''}
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
                      <p>Choose your active techniques. Changes save automatically.</p>
                      <small className={styles.autoSaveNote}>
                        {selectedIds.length} / {capacity} selected
                        {coarsePointer ? ' · tap to preview, double tap to select' : ''}
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

                <div className={styles.workspace}>
                  <section
                    className={styles.techniqueArea}
                    aria-label="Available Techniques"
                    data-testid="learned-skill-list"
                  >
                    {renderTechniqueGroup(primaryDiscipline, primarySkills, false)}
                    {renderTechniqueGroup(secondaryDiscipline, secondarySkills, true)}
                  </section>

                  <aside className={styles.detailRail} data-av-surface="ink">
                    <section className={styles.selectedTechnique}>
                      <span>Technique Preview</span>
                      {focusedSkill ? (
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
                                {focusedSkill.definition.apCost} AP · {cockpitType(focusedSkill.definition)}
                                {focusedSkill.definition.mpCost
                                  ? ` · ${focusedSkill.definition.mpCost} MP`
                                  : ''}
                              </small>
                            </div>
                          </div>
                          <SkillDetails skill={focusedSkill.definition} expanded />
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
                  <span className={styles.saveState} aria-live="polite">
                    {pending ? 'Saving selection…' : 'Selections save automatically'}
                  </span>
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
