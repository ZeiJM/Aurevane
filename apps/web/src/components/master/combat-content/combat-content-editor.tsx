'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { useMemo, useState } from 'react'

import styles from './combat-content-editor.module.css'
import { SkillEconomyEditor, type SkillEconomyDraft } from './skill-economy-editor'
import { SkillTargetingEditor } from './skill-targeting-editor'

export interface CombatContentEditorSkillOption {
  readonly id: string
  readonly sourceDisciplineId: string
  readonly label: string
  readonly currentVersion: number
  readonly baseVersion: number | null
  readonly draftVersion: number | null
  readonly derivedTags: readonly string[]
  readonly definition?: MatureSkillDefinition
}

export interface CombatContentEditorProps {
  readonly skills: readonly CombatContentEditorSkillOption[]
  readonly initialSkillId?: string
}

function titleIdentity(value: string): string {
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function initialSelection(
  skills: readonly CombatContentEditorSkillOption[],
  initialSkillId: string | undefined,
): CombatContentEditorSkillOption | null {
  return (
    (initialSkillId ? skills.find((skill) => skill.id === initialSkillId) : null) ??
    skills[0] ??
    null
  )
}

function versionLabel(prefix: 'v' | 'd', version: number | null): string {
  return version === null ? 'None' : `${prefix}${version}`
}

export function CombatContentEditor({ skills, initialSkillId }: CombatContentEditorProps) {
  const first = initialSelection(skills, initialSkillId)
  const [disciplineId, setDisciplineId] = useState(first?.sourceDisciplineId ?? '')
  const [skillId, setSkillId] = useState(first?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, MatureSkillDefinition>>(() =>
    Object.fromEntries(
      skills.flatMap((skill) =>
        skill.definition ? [[skill.id, structuredClone(skill.definition)] as const] : [],
      ),
    ),
  )

  const disciplineIds = useMemo(
    () => [...new Set(skills.map((skill) => skill.sourceDisciplineId))],
    [skills],
  )
  const disciplineSkills = useMemo(
    () => skills.filter((skill) => skill.sourceDisciplineId === disciplineId),
    [disciplineId, skills],
  )
  const selectedSkill =
    disciplineSkills.find((skill) => skill.id === skillId) ?? disciplineSkills[0] ?? null
  const selectedDraft = selectedSkill ? (drafts[selectedSkill.id] ?? selectedSkill.definition) : null

  function updateSelectedDraft(next: MatureSkillDefinition) {
    if (!selectedSkill) return
    setDrafts((current) => ({ ...current, [selectedSkill.id]: next }))
  }

  function changeDiscipline(nextDisciplineId: string) {
    setDisciplineId(nextDisciplineId)
    const nextSkill = skills.find((skill) => skill.sourceDisciplineId === nextDisciplineId)
    setSkillId(nextSkill?.id ?? '')
  }

  if (!first) {
    return (
      <section className={styles.empty} aria-labelledby="combat-content-heading">
        <p className={styles.eyebrow}>Combat Content</p>
        <h1 id="combat-content-heading">Skill authoring</h1>
        <p>No authorable Skills are available.</p>
      </section>
    )
  }

  if (!selectedSkill) {
    throw new Error('Master Panel Skill selection must resolve inside the selected Discipline.')
  }

  return (
    <section className={styles.editor} aria-labelledby="combat-content-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Combat Content</p>
          <h1 id="combat-content-heading">Skill authoring</h1>
          <p className={styles.lead}>
            Edit typed, versioned combat content through the protected validation and publication
            workflow.
          </p>
        </div>
        <div className={styles.status} data-validation-state="not-validated">
          <span>Validation</span>
          <strong>Not validated</strong>
        </div>
      </header>

      <div className={styles.selectorGrid}>
        <label className={styles.field}>
          <span>Discipline</span>
          <select
            aria-label="Discipline"
            value={disciplineId}
            onChange={(event) => changeDiscipline(event.currentTarget.value)}
          >
            {disciplineIds.map((id) => (
              <option key={id} value={id}>
                {titleIdentity(id)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Skill</span>
          <select
            aria-label="Skill"
            value={selectedSkill.id}
            onChange={(event) => setSkillId(event.currentTarget.value)}
          >
            {disciplineSkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.versionGrid} aria-label="Content version state">
        <div>
          <span>Current version</span>
          <strong>{versionLabel('v', selectedSkill.currentVersion)}</strong>
        </div>
        <div>
          <span>Draft version</span>
          <strong>{versionLabel('d', selectedSkill.draftVersion)}</strong>
        </div>
        <div>
          <span>Base version</span>
          <strong>{versionLabel('v', selectedSkill.baseVersion)}</strong>
        </div>
      </div>

      <section className={styles.workspace} aria-labelledby="draft-workspace-heading">
        <div>
          <p className={styles.sectionLabel}>Draft workspace</p>
          <h2 id="draft-workspace-heading">{selectedSkill.label}</h2>
          <code>{selectedSkill.id}</code>
        </div>

        {selectedDraft ? (
          <div className={styles.authoringStack}>
            <SkillTargetingEditor
              value={selectedDraft.target}
              onChange={(target) => updateSelectedDraft({ ...selectedDraft, target })}
            />
            <SkillEconomyEditor
              value={{
                apCost: selectedDraft.apCost,
                mpCost: selectedDraft.mpCost,
                accuracyMode: selectedDraft.accuracyMode,
                accuracyModifierBasisPoints: selectedDraft.accuracyModifierBasisPoints,
              }}
              onChange={(economy: SkillEconomyDraft) =>
                updateSelectedDraft({ ...selectedDraft, ...economy })
              }
            />
          </div>
        ) : (
          <p className={styles.placeholder}>
            This Skill has not loaded an editable typed definition yet.
          </p>
        )}
      </section>

      <section className={styles.tags} aria-labelledby="derived-tags-heading">
        <div>
          <p className={styles.sectionLabel}>Read-only projection</p>
          <h2 id="derived-tags-heading">Derived tags</h2>
        </div>
        <output className={styles.tagList} data-derived-tags="readonly">
          {selectedSkill.derivedTags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </output>
      </section>

      <footer className={styles.workflow}>
        <div>
          <p className={styles.sectionLabel}>Authoring workflow</p>
          <p>Workflow actions unlock as their bounded implementation tasks land.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" disabled>
            Validate
          </button>
          <button type="button" disabled>
            Diff
          </button>
          <button type="button" disabled>
            Preview
          </button>
          <button type="button" disabled>
            Publish
          </button>
          <button type="button" disabled>
            Rollback
          </button>
        </div>
      </footer>
    </section>
  )
}
