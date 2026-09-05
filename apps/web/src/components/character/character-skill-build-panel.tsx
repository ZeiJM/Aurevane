'use client'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'

import { battleSkillArtwork } from '../battle/battle-skill-presentation'
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
  const initialIds = orderedSkillIds(initialEquippedSkills)
  const [open, setOpen] = useState(false)
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [capacity, setCapacity] = useState(initialCapacity)
  const [learnedSkills, setLearnedSkills] =
    useState<readonly SkillCatalogEntryView[]>(initialLearnedSkills)
  const [committedIds, setCommittedIds] = useState<string[]>(initialIds)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const dirty =
    committedIds.length !== selectedIds.length ||
    committedIds.some((skillId, index) => skillId !== selectedIds[index])

  function selectedSourceCount(sourceDisciplineId: string): number {
    const selected = new Set(selectedIds)
    return learnedSkills.filter(
      (entry) =>
        selected.has(entry.definition.id) &&
        entry.definition.sourceDisciplineId === sourceDisciplineId,
    ).length
  }

  function toggle(skill: SkillCatalogEntryView) {
    if (!skill.activeSource || pending) return
    const id = skill.definition.id
    setMessage(null)
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id)
      if (current.length >= capacity) return current
      if (secondaryDiscipline) {
        const selected = new Set(current)
        const sameSourceCount = learnedSkills.filter(
          (entry) =>
            selected.has(entry.definition.id) &&
            entry.definition.sourceDisciplineId === skill.definition.sourceDisciplineId,
        ).length
        if (sameSourceCount >= 2) return current
      }
      return [...current, id]
    })
  }

  function move(skillId: string, delta: -1 | 1) {
    setSelectedIds((current) => {
      const index = current.indexOf(skillId)
      const target = index + delta
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })
  }

  async function save() {
    if (!dirty || pending) return
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
        setMessage(body.error?.message ?? 'The tagged Techniques could not be saved.')
        return
      }

      const nextIds = orderedSkillIds(body.context.disciplineSkills.equippedSkills)
      setBuildVersion(body.context.build.buildVersion)
      setCapacity(body.context.disciplineSkills.capacity)
      setLearnedSkills(body.context.disciplineSkills.learnedSkills)
      setCommittedIds(nextIds)
      setSelectedIds(nextIds)
      setMessage('Tagged Techniques committed.')
      router.refresh()
    } catch {
      setMessage('The build service could not be reached. Nothing was changed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.root} data-testid="skill-build-panel">
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-label={`Tag Techniques. ${selectedIds.length} of ${capacity} tagged.`}
        onClick={() => setOpen(true)}
      >
        <strong>Tag Techniques</strong>
        <small>
          {selectedIds.length} / {capacity} tagged
        </small>
      </button>

      {open ? (
        <div className={styles.backdrop} role="presentation" onPointerDown={() => setOpen(false)}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-build-heading"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div className={styles.headingCopy}>
                <span>Authoritative build</span>
                <h2 id="skill-build-heading">Techniques</h2>
                <p>Shape the four combat Techniques that appear in your battle cockpit.</p>
              </div>
              <div className={styles.headerActions}>
                <div className={styles.capacityBadge} data-testid="skill-capacity">
                  <strong>{selectedIds.length}</strong>
                  <span>/ {capacity} tagged</span>
                </div>
                <button type="button" className={styles.close} onClick={() => setOpen(false)}>
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
                    {secondaryDiscipline ? ` + ${secondaryDiscipline.name}` : ' · Pure'}
                  </strong>
                  <div className={styles.disciplineChips}>
                    <span
                      data-discipline={primaryDiscipline.id}
                      style={chipPaletteStyle(primaryDiscipline.id)}
                    >
                      {primaryDiscipline.name}
                    </span>
                    {secondaryDiscipline ? (
                      <span
                        data-discipline={secondaryDiscipline.id}
                        style={chipPaletteStyle(secondaryDiscipline.id)}
                      >
                        {secondaryDiscipline.name}
                      </span>
                    ) : (
                      <span data-pure="true" style={{ '--chip': '202 169 104' } as CSSProperties}>
                        Pure build
                      </span>
                    )}
                  </div>
                  <p className={styles.rule}>
                    {secondaryDiscipline
                      ? `Tag four total: up to two from ${primaryDiscipline.name} and two from ${secondaryDiscipline.name}.`
                      : `Tag up to four learned ${primaryDiscipline.name} Techniques.`}
                  </p>
                </section>

                {secondaryDiscipline ? (
                  <section className={styles.splitCard} data-testid="mixed-technique-split">
                    <div>
                      <span>{primaryDiscipline.name}</span>
                      <strong>{selectedSourceCount(primaryDiscipline.id)} / 2</strong>
                    </div>
                    <div>
                      <span>{secondaryDiscipline.name}</span>
                      <strong>{selectedSourceCount(secondaryDiscipline.id)} / 2</strong>
                    </div>
                  </section>
                ) : null}

                {(initialResonance || initialEssence) && (
                  <section className={styles.extensions}>
                    <span className={styles.eyebrow}>Granted identity</span>
                    {initialResonance ? (
                      <div className={styles.identityItem}>
                        <strong data-testid="active-resonance">{initialResonance.name}</strong>
                        <span>Resonance · outside tagged slots</span>
                      </div>
                    ) : null}
                    {initialEssence ? (
                      <div className={styles.identityItem}>
                        <strong data-testid="active-essence">{initialEssence.name}</strong>
                        <span>Essence · outside tagged slots</span>
                      </div>
                    ) : null}
                  </section>
                )}

                <section className={styles.tipCard}>
                  <span>Battle sync</span>
                  <p>
                    Technique artwork here is pulled from the same battle artwork resolver as the
                    cockpit.
                  </p>
                </section>
              </aside>

              <section className={styles.techniqueArea} aria-label="Learned Techniques">
                <div className={styles.techniqueHeading}>
                  <div>
                    <span>Learned Techniques</span>
                    <strong>Select and order your combat loadout</strong>
                  </div>
                  <small>Click a card to tag or untag it.</small>
                </div>

                <div className={styles.skillList} data-testid="learned-skill-list">
                  {learnedSkills.length === 0 ? (
                    <p className={styles.empty}>
                      No learned Discipline Techniques are available yet.
                    </p>
                  ) : (
                    learnedSkills.map((entry) => {
                      const selected = selectedIds.includes(entry.definition.id)
                      const order = selectedIds.indexOf(entry.definition.id)
                      const sourceCount = selectedSourceCount(entry.definition.sourceDisciplineId)
                      const disabledBySource = Boolean(
                        secondaryDiscipline && !selected && sourceCount >= 2,
                      )
                      const disabledByCapacity = !selected && selectedIds.length >= capacity
                      const disabled =
                        !entry.activeSource || pending || disabledByCapacity || disabledBySource

                      return (
                        <article
                          key={`${entry.definition.id}:${entry.definition.contentVersion}`}
                          className={styles.skill}
                          data-active-source={entry.activeSource ? 'true' : 'false'}
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
                              {selected ? <em>{order + 1}</em> : null}
                            </span>
                            <span className={styles.skillCopy}>
                              <strong>{skillName(entry.definition)}</strong>
                              <span className={styles.metaRow}>
                                <small>{titleCase(entry.definition.sourceDisciplineId)}</small>
                                <small>{entry.definition.apCost} AP</small>
                                <small>{entry.definition.cooldown.ownerTurns}T CD</small>
                              </span>
                              <span className={styles.learnedState}>
                                {entry.activeSource
                                  ? `Learned · v${entry.definition.contentVersion}`
                                  : 'Inactive Discipline'}
                              </span>
                            </span>
                          </label>

                          {selected ? (
                            <div
                              className={styles.orderControls}
                              aria-label="Technique order controls"
                            >
                              <span>Tag {order + 1}</span>
                              <button
                                type="button"
                                aria-label={`Move ${skillName(entry.definition)} earlier`}
                                title="Move earlier"
                                onClick={() => move(entry.definition.id, -1)}
                                disabled={order <= 0 || pending}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${skillName(entry.definition)} later`}
                                title="Move later"
                                onClick={() => move(entry.definition.id, 1)}
                                disabled={order < 0 || order >= selectedIds.length - 1 || pending}
                              >
                                ↓
                              </button>
                            </div>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </div>
              </section>
            </div>

            <footer className={styles.actions}>
              <div className={styles.actionStatus}>
                <strong>{dirty ? 'Unsaved loadout changes' : 'Loadout synchronized'}</strong>
                <span>Build v{buildVersion}</span>
              </div>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => setSelectedIds([])}
                disabled={pending || selectedIds.length === 0}
              >
                Clear tags
              </button>
              <button type="button" onClick={() => void save()} disabled={!dirty || pending}>
                {pending ? 'Saving…' : 'Commit tagged Techniques'}
              </button>
            </footer>

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
