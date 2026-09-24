'use client'

import Image from 'next/image'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import type { FavoriteTechniqueCategory } from '../battle/favorite-technique-storage'
import { battleSkillArtwork } from '../battle/battle-skill-presentation'
import { FavoriteTechniqueButton } from './favorite-technique-button'
import { FoundationDisciplineSigil } from './foundation-discipline-sigil'
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

function favoriteCategory(skill: MatureSkillDefinition): FavoriteTechniqueCategory | null {
  const type = cockpitType(skill).toLowerCase()
  if (type === 'attack') return 'attack'
  if (type === 'defense' || type === 'guard') return 'defense'
  if (type === 'heal' || type === 'recovery') return 'heal'
  return null
}

function orderedSkillIds(equippedSkills: readonly EquippedSkillView[]): string[] {
  return [...equippedSkills]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((entry) => entry.definition.id)
}

export function CharacterSkillBuildPanel(props: CharacterSkillBuildPanelProps) {
  const {
    characterId,
    initialBuildVersion,
    primaryDiscipline,
    secondaryDiscipline,
    initialCapacity,
    initialLearnedSkills,
    initialEquippedSkills,
    initialEssence,
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

  const dirty =
    committedIds.length !== selectedIds.length ||
    committedIds.some((skillId, index) => skillId !== selectedIds[index])

  function setPanelOpen(nextOpen: boolean) {
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

  function selectedSourceCount(sourceDisciplineId: string): number {
    const selected = new Set(selectedIds)
    return visibleSkills.filter(
      (entry) =>
        selected.has(entry.definition.id) &&
        entry.definition.sourceDisciplineId === sourceDisciplineId,
    ).length
  }

  const primarySelected = selectedSourceCount(primaryDiscipline.id)
  const secondarySelected = secondaryDiscipline ? selectedSourceCount(secondaryDiscipline.id) : 0
  const mixedSelectionValid =
    !secondaryDiscipline ||
    selectedIds.length < capacity ||
    (primarySelected > 0 && secondarySelected > 0)

  function toggle(skill: SkillCatalogEntryView) {
    if (!skill.activeSource || pending) return
    const id = skill.definition.id
    setFocusedSkillId(id)
    setMessage(null)
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id)
      if (current.length >= capacity) return current
      if (secondaryDiscipline) {
        const selected = new Set(current)
        const sameSourceCount = visibleSkills.filter(
          (entry) =>
            selected.has(entry.definition.id) &&
            entry.definition.sourceDisciplineId === skill.definition.sourceDisciplineId,
        ).length
        if (sameSourceCount >= MIXED_SOURCE_MAXIMUM) return current
      }
      return [...current, id]
    })
  }

  async function save() {
    if (!dirty || pending) return
    if (!mixedSelectionValid) {
      setMessage('A full mixed loadout needs at least one Technique from each active Discipline.')
      return
    }

    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/character/build/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedBuildVersion: buildVersion,
          skillIds: selectedIds,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as SkillCommitResponse
      if (!response.ok || !body.context) {
        setMessage(body.error?.message ?? 'The selected Techniques could not be saved.')
        return
      }

      const nextIds = orderedSkillIds(body.context.disciplineSkills.equippedSkills)
      setBuildVersion(body.context.build.buildVersion)
      setCapacity(body.context.disciplineSkills.capacity)
      setLearnedSkills(body.context.disciplineSkills.learnedSkills)
      setCommittedIds(nextIds)
      setSelectedIds(nextIds)
      setMessage('Selected Techniques committed.')
      router.refresh()
    } catch {
      setMessage('The build service could not be reached. Nothing was changed.')
    } finally {
      setPending(false)
    }
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
            const category = favoriteCategory(entry.definition)
            const label = skillDisplayName(entry.definition)
            return (
              <article
                className={styles.skill}
                key={`${entry.definition.id}:${entry.definition.contentVersion}`}
                data-selected={selected ? 'true' : 'false'}
                style={skillPaletteStyle(entry.definition.sourceDisciplineId)}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => toggle(entry)}
                  />
                  <span
                    className={styles.skillArt}
                    data-av-square-media="true"
                    data-av-square-media-fit="contain"
                    aria-hidden="true"
                  >
                    <Image
                      src={battleSkillArtwork(entry.definition.id)}
                      width={64}
                      height={64}
                      unoptimized
                      alt=""
                    />
                    {selected ? <b>✓</b> : null}
                  </span>
                  <strong>{label}</strong>
                  <span className={styles.skillMeta}>
                    {cockpitType(entry.definition)} · {entry.definition.apCost} AP
                  </span>
                </label>
                {category ? (
                  <FavoriteTechniqueButton
                    characterId={characterId}
                    techniqueId={entry.definition.id}
                    label={label}
                    category={category}
                    disabled={!selected || pending}
                  />
                ) : null}
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
                      <p>
                        Master your combat techniques. Tick up to {capacity} to form your loadout.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.close}
                    onClick={() => setPanelOpen(false)}
                  >
                    <span aria-hidden="true">×</span>
                    Close
                  </button>
                </header>

                <div className={styles.buildStrip} data-technique-build-strip="true">
                  <div className={styles.buildDiscipline}>
                    <FoundationDisciplineSigil disciplineId={primaryDiscipline.id} />
                    <div>
                      <span>Primary Discipline</span>
                      <strong>{primaryDiscipline.name}</strong>
                    </div>
                  </div>
                  <div className={styles.buildDiscipline} data-locked={!secondaryDiscipline}>
                    {secondaryDiscipline ? (
                      <FoundationDisciplineSigil disciplineId={secondaryDiscipline.id} />
                    ) : (
                      <span className={styles.buildLock} aria-hidden="true">
                        ▣
                      </span>
                    )}
                    <div>
                      <span>Secondary Discipline</span>
                      <strong>{secondaryDiscipline?.name ?? 'Locked'}</strong>
                    </div>
                  </div>
                  <div className={styles.selectedCounter}>
                    <span>Selected Techniques</span>
                    <strong>
                      {selectedIds.length} / {capacity}
                    </strong>
                    <small>Tick techniques below to set your active loadout.</small>
                  </div>
                </div>

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
                    <section className={styles.activeBuild}>
                      <span>Active Build</span>
                      <div>
                        <FoundationDisciplineSigil
                          disciplineId={primaryDiscipline.id}
                          className={styles.detailSigil}
                        />
                        <strong>
                          {primaryDiscipline.name}
                          {secondaryDiscipline ? ` + ${secondaryDiscipline.name}` : ''}
                        </strong>
                        <b>● Live</b>
                      </div>
                    </section>

                    <section className={styles.selectedTechnique}>
                      <span>Selected Technique</span>
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
                                width={80}
                                height={80}
                                unoptimized
                                alt=""
                              />
                            </span>
                            <div>
                              <strong>{skillDisplayName(focusedSkill.definition)}</strong>
                              <small>
                                {cockpitType(focusedSkill.definition)} ·{' '}
                                {focusedSkill.definition.apCost} AP
                                {focusedSkill.definition.mpCost
                                  ? ` · ${focusedSkill.definition.mpCost} MP`
                                  : ''}
                              </small>
                            </div>
                          </div>
                          <SkillDetails skill={focusedSkill.definition} />
                          {favoriteCategory(focusedSkill.definition) ? (
                            <FavoriteTechniqueButton
                              characterId={characterId}
                              techniqueId={focusedSkill.definition.id}
                              label={skillDisplayName(focusedSkill.definition)}
                              category={favoriteCategory(focusedSkill.definition)!}
                              disabled={
                                !selectedIds.includes(focusedSkill.definition.id) || pending
                              }
                            />
                          ) : null}
                        </>
                      ) : (
                        <p>No Technique is available for this build.</p>
                      )}
                    </section>

                    {initialEssence && favoriteCategory(initialEssence.skill) ? (
                      <article className={styles.signatureFavorite}>
                        <div>
                          <span>Build Signature</span>
                          <strong data-testid="active-essence">{initialEssence.name}</strong>
                        </div>
                        <FavoriteTechniqueButton
                          characterId={characterId}
                          techniqueId={initialEssence.skill.id}
                          label={initialEssence.name}
                          category={favoriteCategory(initialEssence.skill)!}
                        />
                      </article>
                    ) : null}
                  </aside>
                </div>

                <footer className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => {
                      setSelectedIds([])
                      setMessage(null)
                    }}
                    disabled={pending || selectedIds.length === 0}
                  >
                    ↻ Clear Selections
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!dirty || pending || !mixedSelectionValid}
                  >
                    <span aria-hidden="true">⚔</span>
                    {pending ? 'Saving…' : 'Commit Techniques'}
                    <span aria-hidden="true">›</span>
                  </button>
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
