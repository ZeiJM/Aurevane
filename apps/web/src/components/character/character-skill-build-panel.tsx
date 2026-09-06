'use client'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { battleResonanceArtwork, battleSkillArtwork } from '../battle/battle-skill-presentation'
import polish from './character-skill-build-panel-polish.module.css'
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

function chipPaletteStyle(disciplineId: string): CSSProperties {
  return { '--chip': paletteFor(disciplineId).accent } as CSSProperties
}

function titleCase(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function skillName(skill: MatureSkillDefinition): string {
  const tail = skill.id.includes('.') ? skill.id.slice(skill.id.indexOf('.') + 1) : skill.id
  return titleCase(tail)
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

export function CharacterSkillBuildPanel({
  initialBuildVersion,
  primaryDiscipline,
  secondaryDiscipline,
  initialCapacity,
  initialLearnedSkills,
  initialEquippedSkills,
  initialResonance,
  initialEssence,
}: CharacterSkillBuildPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialIds = orderedSkillIds(initialEquippedSkills)
  const open = searchParams.get(PROFILE_PANEL_QUERY) === TECHNIQUES_PANEL
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [capacity, setCapacity] = useState(initialCapacity)
  const [learnedSkills, setLearnedSkills] =
    useState<readonly SkillCatalogEntryView[]>(initialLearnedSkills)
  const [committedIds, setCommittedIds] = useState<string[]>(initialIds)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const visibleSkills = useMemo(
    () => learnedSkills.filter((entry) => entry.activeSource),
    [learnedSkills],
  )

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
    const href = (query ? `${pathname}?${query}` : pathname) as Route
    router.replace(href, { scroll: false })
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

  const signatureLabel = initialResonance
    ? 'Build Signature · Resonance'
    : initialEssence
      ? 'Build Signature · Essence Skill'
      : 'Build Signature'

  return (
    <div className={styles.root} data-testid="skill-build-panel">
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Manage Techniques. ${selectedIds.length} of ${capacity} selected.`}
        onClick={() => setPanelOpen(true)}
      >
        <strong>Manage Techniques</strong>
        <small>
          {selectedIds.length} / {capacity}
        </small>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={styles.backdrop}
              data-techniques-overlay="true"
              role="presentation"
              onPointerDown={() => setPanelOpen(false)}
            >
              <section
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="skill-build-heading"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header className={styles.header}>
                  <div className={styles.headingCopy}>
                    <h2 id="skill-build-heading">Techniques</h2>
                  </div>
                  <div className={styles.headerActions}>
                    <div className={polish.counterGroup} data-testid="skill-capacity">
                      {secondaryDiscipline ? (
                        <>
                          <div
                            className={`${styles.capacityBadge} ${polish.capacityBadge}`}
                            style={chipPaletteStyle(primaryDiscipline.id)}
                          >
                            <span className={polish.counterName}>{primaryDiscipline.name}</span>
                            <strong>{primarySelected}</strong>
                            <span>{` / ${capacity}`}</span>
                          </div>
                          <div
                            className={`${styles.capacityBadge} ${polish.capacityBadge}`}
                            style={chipPaletteStyle(secondaryDiscipline.id)}
                          >
                            <span className={polish.counterName}>{secondaryDiscipline.name}</span>
                            <strong>{secondarySelected}</strong>
                            <span>{` / ${capacity}`}</span>
                          </div>
                        </>
                      ) : (
                        <div
                          className={`${styles.capacityBadge} ${polish.capacityBadge}`}
                          style={chipPaletteStyle(primaryDiscipline.id)}
                        >
                          <span className={polish.counterName}>{primaryDiscipline.name}</span>
                          <strong>{selectedIds.length}</strong>
                          <span>{` / ${capacity}`}</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`${styles.close} ${polish.standardButton}`}
                      onClick={() => setPanelOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </header>

                <div className={styles.workspace}>
                  <aside className={styles.buildRail}>
                    <section className={styles.buildCard}>
                      <span className={styles.eyebrow}>Active build</span>
                      <strong className={styles.buildName}>
                        {primaryDiscipline.name}
                        {secondaryDiscipline ? ` + ${secondaryDiscipline.name}` : ''}
                      </strong>
                    </section>

                    {secondaryDiscipline ? (
                      <section
                        className={`${styles.splitCard} ${polish.mixedRuleCard}`}
                        data-testid="mixed-technique-split"
                      >
                        <strong>4 Techniques total</strong>
                        <span>Use a 1–3, 2–2, or 3–1 Discipline split.</span>
                      </section>
                    ) : null}

                    {(initialResonance || initialEssence) && (
                      <section className={`${styles.extensions} ${polish.signatureSection}`}>
                        <span className={styles.eyebrow}>{signatureLabel}</span>
                        {initialResonance ? (
                          <article className={polish.signatureCard}>
                            <span className={polish.signatureArtFrame} aria-hidden="true">
                              <img
                                className={polish.signatureArt}
                                src={battleResonanceArtwork(initialResonance.id)}
                                alt=""
                              />
                            </span>
                            <div className={polish.signatureCopy}>
                              <strong data-testid="active-resonance">
                                {initialResonance.name}
                              </strong>
                              <span className={styles.metaRow}>
                                {initialResonance.disciplinePair.map((disciplineId) => (
                                  <small key={disciplineId} style={chipPaletteStyle(disciplineId)}>
                                    {titleCase(disciplineId)}
                                  </small>
                                ))}
                                <small className={polish.typeChip}>Passive</small>
                              </span>
                              <p>{initialResonance.description}</p>
                            </div>
                          </article>
                        ) : null}
                        {initialEssence ? (
                          <article className={polish.signatureCard}>
                            <span className={polish.signatureArtFrame} aria-hidden="true">
                              <img
                                className={polish.signatureArt}
                                src={battleSkillArtwork(initialEssence.skill.id)}
                                alt=""
                              />
                            </span>
                            <div className={polish.signatureCopy}>
                              <strong data-testid="active-essence">
                                {initialEssence.name}
                              </strong>
                              <span className={styles.metaRow}>
                                <small style={chipPaletteStyle(initialEssence.sourceDisciplineId)}>
                                  {titleCase(initialEssence.sourceDisciplineId)}
                                </small>
                                <small>{initialEssence.skill.apCost} AP</small>
                                <small className={polish.typeChip}>
                                  {cockpitType(initialEssence.skill)}
                                </small>
                              </span>
                              <p>{initialEssence.description}</p>
                            </div>
                          </article>
                        ) : null}
                      </section>
                    )}
                  </aside>

                  <section className={styles.techniqueArea} aria-label="Techniques">
                    <div className={`${styles.techniqueHeading} ${polish.techniqueHeading}`}>
                      <strong>Select your combat loadout</strong>
                    </div>

                    <div className={styles.skillList} data-testid="learned-skill-list">
                      {visibleSkills.length === 0 ? (
                        <p className={styles.empty}>No Techniques are available for this build.</p>
                      ) : (
                        visibleSkills.map((entry) => {
                          const selected = selectedIds.includes(entry.definition.id)
                          const sourceCount = selectedSourceCount(
                            entry.definition.sourceDisciplineId,
                          )
                          const disabledBySource = Boolean(
                            secondaryDiscipline && !selected && sourceCount >= MIXED_SOURCE_MAXIMUM,
                          )
                          const disabledByCapacity = !selected && selectedIds.length >= capacity
                          const disabled = pending || disabledByCapacity || disabledBySource

                          return (
                            <article
                              key={`${entry.definition.id}:${entry.definition.contentVersion}`}
                              className={styles.skill}
                              data-active-source="true"
                              data-selected={selected ? 'true' : 'false'}
                              data-source={entry.definition.sourceDisciplineId}
                              style={skillPaletteStyle(entry.definition.sourceDisciplineId)}
                            >
                              <label className={styles.skillToggle}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={disabled}
                                  onChange={() => toggle(entry)}
                                />
                                <span className={styles.artFrame} aria-hidden="true">
                                  <img
                                    className={styles.skillArt}
                                    src={battleSkillArtwork(entry.definition.id)}
                                    alt=""
                                  />
                                </span>
                                <span className={styles.skillCopy}>
                                  <strong>{skillName(entry.definition)}</strong>
                                  <span className={styles.metaRow}>
                                    <small>{titleCase(entry.definition.sourceDisciplineId)}</small>
                                    <small>{entry.definition.apCost} AP</small>
                                    <small className={polish.typeChip}>
                                      {cockpitType(entry.definition)}
                                    </small>
                                  </span>
                                </span>
                              </label>
                            </article>
                          )
                        })
                      )}
                    </div>
                  </section>
                </div>

                <footer className={`${styles.actions} ${polish.actions}`}>
                  <button
                    type="button"
                    className={`${styles.secondaryAction} ${polish.standardButton}`}
                    onClick={() => {
                      setSelectedIds([])
                      setMessage(null)
                    }}
                    disabled={pending || selectedIds.length === 0}
                  >
                    Clear Selected Techniques
                  </button>
                  <button
                    type="button"
                    className={polish.standardButton}
                    onClick={() => void save()}
                    disabled={!dirty || pending || !mixedSelectionValid}
                  >
                    {pending ? 'Saving…' : 'Commit Selected Techniques'}
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
