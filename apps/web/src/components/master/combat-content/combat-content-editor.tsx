'use client'

import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import styles from './combat-content-editor.module.css'
import { postCombatContentAuthoring } from './combat-content-client'
import { CombatContentReviewPanel } from './combat-content-review-panel'
import {
  emptyCombatContentReview,
  invalidateCombatContentReview,
  nextCombatContentVersion,
  projectPublishedVersionHistory,
  projectRollbackVersionHistory,
  type CombatContentPreviewSummary,
  type CombatContentReviewState,
  type CombatContentSemanticDiff,
  type CombatContentValidationResult,
  type CombatContentVersionHistoryEntry,
} from './combat-content-workflow'
import { SkillEconomyEditor, type SkillEconomyDraft } from './skill-economy-editor'
import { SkillEffectListEditor } from './skill-effect-list-editor'
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
  readonly history?: readonly CombatContentVersionHistoryEntry[]
}

export interface CombatContentEditorProps {
  readonly skills: readonly CombatContentEditorSkillOption[]
  readonly initialSkillId?: string
}

interface RollbackTarget {
  readonly skillId: string
  readonly version: number
}

interface PublishedResponse {
  readonly published: {
    readonly contentVersion: number
    readonly publishedAt: string
    readonly definition: Record<string, unknown>
  }
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

function fallbackHistory(skill: CombatContentEditorSkillOption): readonly CombatContentVersionHistoryEntry[] {
  return [
    {
      contentVersion: skill.currentVersion,
      source: 'static-baseline',
      current: true,
      publishedAt: null,
    },
  ]
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The Master Panel could not complete that operation.'
}

export function CombatContentEditor({ skills, initialSkillId }: CombatContentEditorProps) {
  const router = useRouter()
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
  const [reviews, setReviews] = useState<Record<string, CombatContentReviewState>>({})
  const [histories, setHistories] = useState<
    Record<string, readonly CombatContentVersionHistoryEntry[]>
  >(() =>
    Object.fromEntries(
      skills.map((skill) => [skill.id, skill.history ?? fallbackHistory(skill)] as const),
    ),
  )
  const [busySkillId, setBusySkillId] = useState<string | null>(null)
  const [publishConfirmationSkillId, setPublishConfirmationSkillId] = useState<string | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [notices, setNotices] = useState<Record<string, string | null>>({})
  const draftRevision = useRef<Record<string, number>>({})

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
  const selectedReview = selectedSkill
    ? (reviews[selectedSkill.id] ?? emptyCombatContentReview())
    : emptyCombatContentReview()
  const selectedHistory = selectedSkill
    ? (histories[selectedSkill.id] ?? fallbackHistory(selectedSkill))
    : []
  const selectedCurrentVersion =
    selectedHistory.find((entry) => entry.current)?.contentVersion ??
    selectedSkill?.currentVersion ??
    1
  const selectedNextVersion = selectedSkill
    ? nextCombatContentVersion(selectedCurrentVersion, selectedHistory)
    : 1
  const busy = selectedSkill ? busySkillId === selectedSkill.id : false
  const displayedTags =
    selectedReview.validation?.valid === true
      ? selectedReview.validation.derivedTags
      : (selectedSkill?.derivedTags ?? [])

  function clearTransientReview(skillIdToClear: string) {
    setPublishConfirmationSkillId((current) => (current === skillIdToClear ? null : current))
    setRollbackTarget((current) => (current?.skillId === skillIdToClear ? null : current))
    setErrors((current) => ({ ...current, [skillIdToClear]: null }))
    setNotices((current) => ({ ...current, [skillIdToClear]: null }))
  }

  function updateSelectedDraft(next: MatureSkillDefinition) {
    if (!selectedSkill) return
    const id = selectedSkill.id
    draftRevision.current[id] = (draftRevision.current[id] ?? 0) + 1
    setDrafts((current) => ({ ...current, [id]: next }))
    setReviews((current) => ({
      ...current,
      [id]: invalidateCombatContentReview(current[id] ?? emptyCombatContentReview()),
    }))
    clearTransientReview(id)
  }

  function selectSkill(nextSkillId: string) {
    setSkillId(nextSkillId)
    setPublishConfirmationSkillId(null)
    setRollbackTarget(null)
  }

  function changeDiscipline(nextDisciplineId: string) {
    setDisciplineId(nextDisciplineId)
    const nextSkill = skills.find((skill) => skill.sourceDisciplineId === nextDisciplineId)
    selectSkill(nextSkill?.id ?? '')
  }

  async function validateSelected() {
    if (!selectedSkill || !selectedDraft) return
    const id = selectedSkill.id
    const revision = draftRevision.current[id] ?? 0
    setBusySkillId(id)
    setErrors((current) => ({ ...current, [id]: null }))
    setNotices((current) => ({ ...current, [id]: null }))
    try {
      const response = await postCombatContentAuthoring<{
        validation: CombatContentValidationResult
      }>({
        operation: 'validate',
        definition: selectedDraft,
      })
      if ((draftRevision.current[id] ?? 0) !== revision) return
      setReviews((current) => ({
        ...current,
        [id]: {
          validation: response.validation,
          diff: null,
          preview: null,
        },
      }))
    } catch (error) {
      if ((draftRevision.current[id] ?? 0) === revision) {
        setErrors((current) => ({ ...current, [id]: messageFrom(error) }))
      }
    } finally {
      setBusySkillId((current) => (current === id ? null : current))
    }
  }

  async function diffSelected() {
    if (!selectedSkill || !selectedDraft || !selectedSkill.definition) return
    const id = selectedSkill.id
    const review = reviews[id] ?? emptyCombatContentReview()
    if (review.validation?.valid !== true) return
    const revision = draftRevision.current[id] ?? 0
    setBusySkillId(id)
    setErrors((current) => ({ ...current, [id]: null }))
    try {
      const response = await postCombatContentAuthoring<{ diff: CombatContentSemanticDiff }>({
        operation: 'diff',
        before: selectedSkill.definition,
        after: selectedDraft,
      })
      if ((draftRevision.current[id] ?? 0) !== revision) return
      setReviews((current) => ({
        ...current,
        [id]: {
          validation: current[id]?.validation ?? review.validation,
          diff: response.diff,
          preview: null,
        },
      }))
    } catch (error) {
      if ((draftRevision.current[id] ?? 0) === revision) {
        setErrors((current) => ({ ...current, [id]: messageFrom(error) }))
      }
    } finally {
      setBusySkillId((current) => (current === id ? null : current))
    }
  }

  async function previewSelected() {
    if (!selectedSkill || !selectedDraft) return
    const id = selectedSkill.id
    const review = reviews[id] ?? emptyCombatContentReview()
    if (review.validation?.valid !== true || review.diff === null) return
    const revision = draftRevision.current[id] ?? 0
    setBusySkillId(id)
    setErrors((current) => ({ ...current, [id]: null }))
    try {
      const response = await postCombatContentAuthoring<{
        preview: CombatContentPreviewSummary
      }>({
        operation: 'preview',
        definition: selectedDraft,
      })
      if ((draftRevision.current[id] ?? 0) !== revision) return
      setReviews((current) => ({
        ...current,
        [id]: {
          validation: current[id]?.validation ?? review.validation,
          diff: current[id]?.diff ?? review.diff,
          preview: response.preview,
        },
      }))
    } catch (error) {
      if ((draftRevision.current[id] ?? 0) === revision) {
        setErrors((current) => ({ ...current, [id]: messageFrom(error) }))
      }
    } finally {
      setBusySkillId((current) => (current === id ? null : current))
    }
  }

  async function publishSelected() {
    if (!selectedSkill || !selectedDraft) return
    const id = selectedSkill.id
    const review = reviews[id] ?? emptyCombatContentReview()
    if (
      review.validation?.valid !== true ||
      review.diff === null ||
      review.diff.changedPaths.length === 0 ||
      review.preview === null
    ) {
      return
    }

    setBusySkillId(id)
    setErrors((current) => ({ ...current, [id]: null }))
    try {
      const response = await postCombatContentAuthoring<PublishedResponse>({
        operation: 'publish',
        definition: selectedDraft,
        expectedBaseVersion: selectedCurrentVersion,
      })
      setHistories((current) => ({
        ...current,
        [id]: projectPublishedVersionHistory(current[id] ?? selectedHistory, {
          contentVersion: response.published.contentVersion,
          publishedAt: response.published.publishedAt,
        }),
      }))
      setReviews((current) => ({ ...current, [id]: emptyCombatContentReview() }))
      setPublishConfirmationSkillId(null)
      setNotices((current) => ({
        ...current,
        [id]: `Published immutable v${response.published.contentVersion}. Refreshing authoritative content…`,
      }))
      router.refresh()
    } catch (error) {
      setErrors((current) => ({ ...current, [id]: messageFrom(error) }))
    } finally {
      setBusySkillId((current) => (current === id ? null : current))
    }
  }

  async function rollbackSelected() {
    if (!selectedSkill || !rollbackTarget || rollbackTarget.skillId !== selectedSkill.id) return
    const id = selectedSkill.id
    const targetVersion = rollbackTarget.version
    setBusySkillId(id)
    setErrors((current) => ({ ...current, [id]: null }))
    try {
      await postCombatContentAuthoring<{ ok: true }>({
        operation: 'rollback',
        skillId: id,
        targetVersion,
      })
      setHistories((current) => ({
        ...current,
        [id]: projectRollbackVersionHistory(current[id] ?? selectedHistory, targetVersion),
      }))
      setReviews((current) => ({ ...current, [id]: emptyCombatContentReview() }))
      setRollbackTarget(null)
      setPublishConfirmationSkillId(null)
      setNotices((current) => ({
        ...current,
        [id]: `Current publication repointed to v${targetVersion}; immutable history was preserved. Refreshing…`,
      }))
      router.refresh()
    } catch (error) {
      setErrors((current) => ({ ...current, [id]: messageFrom(error) }))
    } finally {
      setBusySkillId((current) => (current === id ? null : current))
    }
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
        <div
          className={styles.status}
          data-validation-state={
            selectedReview.validation === null
              ? 'not-validated'
              : selectedReview.validation.valid
                ? 'valid'
                : 'invalid'
          }
        >
          <span>Validation</span>
          <strong>
            {selectedReview.validation === null
              ? 'Not validated'
              : selectedReview.validation.valid
                ? 'Validated'
                : 'Invalid'}
          </strong>
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
            onChange={(event) => selectSkill(event.currentTarget.value)}
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
          <strong>{versionLabel('v', selectedCurrentVersion)}</strong>
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
            <SkillEffectListEditor
              value={selectedDraft.effects}
              onChange={(effects) => updateSelectedDraft({ ...selectedDraft, effects })}
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
          {displayedTags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </output>
      </section>

      <CombatContentReviewPanel
        contentKey={selectedSkill.id}
        baseVersion={selectedCurrentVersion}
        nextVersion={selectedNextVersion}
        validation={selectedReview.validation}
        diff={selectedReview.diff}
        preview={selectedReview.preview}
        history={selectedHistory}
        busy={busy}
        publishConfirmationOpen={publishConfirmationSkillId === selectedSkill.id}
        rollbackTargetVersion={
          rollbackTarget?.skillId === selectedSkill.id ? rollbackTarget.version : null
        }
        errorMessage={errors[selectedSkill.id] ?? null}
        noticeMessage={notices[selectedSkill.id] ?? null}
        onValidate={() => void validateSelected()}
        onDiff={() => void diffSelected()}
        onPreview={() => void previewSelected()}
        onRequestPublish={() => setPublishConfirmationSkillId(selectedSkill.id)}
        onConfirmPublish={() => void publishSelected()}
        onCancelPublish={() => setPublishConfirmationSkillId(null)}
        onRequestRollback={(version) => setRollbackTarget({ skillId: selectedSkill.id, version })}
        onConfirmRollback={() => void rollbackSelected()}
        onCancelRollback={() => setRollbackTarget(null)}
      />
    </section>
  )
}
