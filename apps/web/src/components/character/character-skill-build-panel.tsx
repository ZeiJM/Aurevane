'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

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
}

interface SkillCommitResponse {
  context?: {
    build: { buildVersion: number }
    current: { definition: { id: string; name: string } }
    currentSecondary: { id: string; name: string } | null
    disciplineSkills: {
      capacity: number
      learnedSkills: readonly SkillCatalogEntryView[]
      equippedSkills: readonly EquippedSkillView[]
    }
  }
  error?: { message?: string }
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

export function CharacterSkillBuildPanel({
  initialBuildVersion,
  primaryDiscipline,
  secondaryDiscipline,
  initialCapacity,
  initialLearnedSkills,
  initialEquippedSkills,
}: CharacterSkillBuildPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [buildVersion, setBuildVersion] = useState(initialBuildVersion)
  const [capacity, setCapacity] = useState(initialCapacity)
  const [learnedSkills, setLearnedSkills] = useState<readonly SkillCatalogEntryView[]>(
    initialLearnedSkills,
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(
    [...initialEquippedSkills]
      .sort((left, right) => left.slotIndex - right.slotIndex)
      .map((entry) => entry.definition.id),
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const committedIds = useMemo(
    () =>
      [...initialEquippedSkills]
        .sort((left, right) => left.slotIndex - right.slotIndex)
        .map((entry) => entry.definition.id),
    [initialEquippedSkills],
  )

  const dirty =
    committedIds.length !== selectedIds.length ||
    committedIds.some((skillId, index) => skillId !== selectedIds[index])

  function toggle(skill: SkillCatalogEntryView) {
    if (!skill.activeSource || pending) return
    const id = skill.definition.id
    setMessage(null)
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id)
      if (current.length >= capacity) return current
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
        setMessage(body.error?.message ?? 'The Skill loadout could not be saved.')
        return
      }

      setBuildVersion(body.context.build.buildVersion)
      setCapacity(body.context.disciplineSkills.capacity)
      setLearnedSkills(body.context.disciplineSkills.learnedSkills)
      setSelectedIds(
        [...body.context.disciplineSkills.equippedSkills]
          .sort((left, right) => left.slotIndex - right.slotIndex)
          .map((entry) => entry.definition.id),
      )
      setMessage('The Discipline Skill loadout is now committed.')
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
        aria-label={`Manage Discipline Skills. ${selectedIds.length} of ${capacity} equipped.`}
        onClick={() => setOpen(true)}
      >
        <strong>Skills {selectedIds.length}/{capacity}</strong>
        <small>Build v{buildVersion}</small>
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
              <div>
                <span>Authoritative build</span>
                <h2 id="skill-build-heading">Skills</h2>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)}>
                Close
              </button>
            </header>

            <div className={styles.summary}>
              <div>
                <span>Active Disciplines</span>
                <strong>
                  {primaryDiscipline.name}
                  {secondaryDiscipline ? ` + ${secondaryDiscipline.name}` : ' · Pure'}
                </strong>
              </div>
              <div>
                <span>Discipline Skill capacity</span>
                <strong data-testid="skill-capacity">
                  {selectedIds.length} / {capacity}
                </strong>
              </div>
            </div>

            <p className={styles.rule}>
              {secondaryDiscipline
                ? 'Mixed builds may equip six total Discipline Skills across the active pair.'
                : 'Pure builds may equip up to eight learned Skills from the Primary Discipline.'}
              {' '}Other future Skill sources use their own bounded slots and do not consume this cap.
            </p>

            <div className={styles.skillList} data-testid="learned-skill-list">
              {learnedSkills.length === 0 ? (
                <p className={styles.empty}>No learned Discipline Skills are available yet.</p>
              ) : (
                learnedSkills.map((entry) => {
                  const selected = selectedIds.includes(entry.definition.id)
                  const order = selectedIds.indexOf(entry.definition.id)
                  const disabledByCapacity = !selected && selectedIds.length >= capacity
                  return (
                    <article
                      key={`${entry.definition.id}:${entry.definition.contentVersion}`}
                      className={styles.skill}
                      data-active-source={entry.activeSource ? 'true' : 'false'}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!entry.activeSource || pending || disabledByCapacity}
                          onChange={() => toggle(entry)}
                        />
                        <span>
                          <strong>{skillName(entry.definition)}</strong>
                          <small>
                            {titleCase(entry.definition.sourceDisciplineId)} Discipline · {entry.definition.apCost} AP · {entry.definition.cooldown.ownerTurns} owner-turn cooldown
                          </small>
                        </span>
                      </label>
                      <p>
                        {entry.activeSource
                          ? `Learned · content v${entry.definition.contentVersion}`
                          : 'Learned, but its source Discipline is not active in this build.'}
                      </p>
                      {selected ? (
                        <div className={styles.orderControls} aria-label="Skill order controls">
                          <span>Slot {order + 1}</span>
                          <button
                            type="button"
                            onClick={() => move(entry.definition.id, -1)}
                            disabled={order <= 0 || pending}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => move(entry.definition.id, 1)}
                            disabled={order < 0 || order >= selectedIds.length - 1 || pending}
                          >
                            Down
                          </button>
                        </div>
                      ) : null}
                    </article>
                  )
                })
              )}
            </div>

            <div className={styles.extensions}>
              <strong>Build extensions</strong>
              <span>Resonance / Essence — reserved for P3.5–P3.6</span>
              <span>Equipment Skills — reserved</span>
              <span>Supernatural — reserved for later phases</span>
              <span>Prestige — reserved</span>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => setSelectedIds([])}
                disabled={pending || selectedIds.length === 0}
              >
                Clear selection
              </button>
              <button type="button" onClick={() => void save()} disabled={!dirty || pending}>
                {pending ? 'Saving…' : 'Commit Skill loadout'}
              </button>
            </div>

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
