'use client'

import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import { isMaterializedCombatEffect } from '@aurevane/game-core/combat/summon-content'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { SkillDetails } from '../../character/skill-details'
import styles from './combat-content-editor.module.css'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
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
import { SkillMediaEditor } from './skill-media-editor'
import { SkillTargetingEditor } from './skill-targeting-editor'

export interface EssenceContentEditorOption {
  readonly id: string
  readonly sourceDisciplineId: string
  readonly label: string
  readonly currentVersion: number
  readonly baseVersion: number | null
  readonly draftVersion: number | null
  readonly derivedTags: readonly string[]
  readonly definition: EssenceDefinition
  readonly initialDraft?: EssenceDefinition
  readonly history: readonly CombatContentVersionHistoryEntry[]
}

export interface EssenceContentEditorProps {
  readonly essences: readonly EssenceContentEditorOption[]
  readonly initialEssenceId?: string
}

interface RollbackTarget {
  readonly essenceId: string
  readonly version: number
}

interface PublishedResponse {
  readonly published: {
    readonly contentVersion: number
    readonly publishedAt: string
    readonly definition: Record<string, unknown>
  }
}

function versionLabel(prefix: 'v' | 'd', version: number | null): string {
  return version === null ? 'None' : `${prefix}${version}`
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The Master Panel could not complete that operation.'
}

export function EssenceContentEditor({ essences, initialEssenceId }: EssenceContentEditorProps) {
  const router = useRouter()
  const first =
    (initialEssenceId ? essences.find((essence) => essence.id === initialEssenceId) : null) ??
    essences[0] ??
    null
  const [essenceId, setEssenceId] = useState(first?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, EssenceDefinition>>(() =>
    Object.fromEntries(
      essences.map((essence) => [
        essence.id,
        structuredClone(essence.initialDraft ?? essence.definition),
      ]),
    ),
  )
  const [reviews, setReviews] = useState<Record<string, CombatContentReviewState>>({})
  const [histories, setHistories] = useState<
    Record<string, readonly CombatContentVersionHistoryEntry[]>
  >(() => Object.fromEntries(essences.map((essence) => [essence.id, essence.history])))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [publishConfirmationId, setPublishConfirmationId] = useState<string | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [notices, setNotices] = useState<Record<string, string | null>>({})
  const draftRevision = useRef<Record<string, number>>({})

  const selected = essences.find((essence) => essence.id === essenceId) ?? first
  const selectedDraft = selected ? drafts[selected.id] : null
  const selectedReview = selected
    ? (reviews[selected.id] ?? emptyCombatContentReview())
    : emptyCombatContentReview()
  const selectedHistory = selected ? (histories[selected.id] ?? selected.history) : []
  const selectedCurrentVersion =
    selectedHistory.find((entry) => entry.current)?.contentVersion ?? selected?.currentVersion ?? 1
  const selectedNextVersion = selected
    ? nextCombatContentVersion(selectedCurrentVersion, selectedHistory)
    : 1
  const busy = selected ? busyId === selected.id : false
  const displayedTags =
    selectedReview.validation?.valid === true
      ? selectedReview.validation.derivedTags
      : (selected?.derivedTags ?? [])

  const disciplineOptions = useMemo(
    () => [...essences].sort((left, right) => left.label.localeCompare(right.label)),
    [essences],
  )

  function updateDraft(next: EssenceDefinition) {
    if (!selected) return
    const id = selected.id
    draftRevision.current[id] = (draftRevision.current[id] ?? 0) + 1
    setDrafts((current) => ({ ...current, [id]: next }))
    setReviews((current) => ({
      ...current,
      [id]: invalidateCombatContentReview(current[id] ?? emptyCombatContentReview()),
    }))
    setErrors((current) => ({ ...current, [id]: null }))
    setNotices((current) => ({ ...current, [id]: null }))
    setPublishConfirmationId(null)
    setRollbackTarget(null)
  }

  async function validateSelected() {
    if (!selected || !selectedDraft) return
    const revision = draftRevision.current[selected.id] ?? 0
    setBusyId(selected.id)
    setErrors((current) => ({ ...current, [selected.id]: null }))
    try {
      const response = await postCombatContentAuthoring<{
        validation: CombatContentValidationResult
      }>({
        operation: 'validate',
        contentKind: 'essence',
        definition: selectedDraft,
      })
      if ((draftRevision.current[selected.id] ?? 0) !== revision) return
      setReviews((current) => ({
        ...current,
        [selected.id]: { validation: response.validation, diff: null, preview: null },
      }))
    } catch (error) {
      if ((draftRevision.current[selected.id] ?? 0) === revision) {
        setErrors((current) => ({ ...current, [selected.id]: messageFrom(error) }))
      }
    } finally {
      setBusyId((current) => (current === selected.id ? null : current))
    }
  }

  async function diffSelected() {
    if (!selected || !selectedDraft || selectedReview.validation?.valid !== true) return
    const revision = draftRevision.current[selected.id] ?? 0
    setBusyId(selected.id)
    try {
      const response = await postCombatContentAuthoring<{ diff: CombatContentSemanticDiff }>({
        operation: 'diff',
        before: selected.definition,
        after: selectedDraft,
      })
      if ((draftRevision.current[selected.id] ?? 0) !== revision) return
      setReviews((current) => ({
        ...current,
        [selected.id]: {
          validation: current[selected.id]?.validation ?? selectedReview.validation,
          diff: response.diff,
          preview: null,
        },
      }))
    } catch (error) {
      setErrors((current) => ({ ...current, [selected.id]: messageFrom(error) }))
    } finally {
      setBusyId((current) => (current === selected.id ? null : current))
    }
  }

  async function previewSelected() {
    if (!selected || !selectedDraft || selectedReview.validation?.valid !== true) return
    if (selectedReview.diff === null) return
    const revision = draftRevision.current[selected.id] ?? 0
    setBusyId(selected.id)
    try {
      const response = await postCombatContentAuthoring<{
        preview: CombatContentPreviewSummary
      }>({
        operation: 'preview',
        definition: selectedDraft.skill,
      })
      if ((draftRevision.current[selected.id] ?? 0) !== revision) return
      setReviews((current) => ({
        ...current,
        [selected.id]: {
          validation: current[selected.id]?.validation ?? selectedReview.validation,
          diff: current[selected.id]?.diff ?? selectedReview.diff,
          preview: response.preview,
        },
      }))
    } catch (error) {
      setErrors((current) => ({ ...current, [selected.id]: messageFrom(error) }))
    } finally {
      setBusyId((current) => (current === selected.id ? null : current))
    }
  }

  async function publishSelected() {
    if (!selected || !selectedDraft) return
    if (
      selectedReview.validation?.valid !== true ||
      selectedReview.diff === null ||
      selectedReview.diff.changedPaths.length === 0 ||
      selectedReview.preview === null
    ) {
      return
    }

    setBusyId(selected.id)
    try {
      const response = await postCombatContentAuthoring<PublishedResponse>({
        operation: 'publish',
        contentKind: 'essence',
        definition: selectedDraft,
        expectedBaseVersion: selectedCurrentVersion,
      })
      setHistories((current) => ({
        ...current,
        [selected.id]: projectPublishedVersionHistory(current[selected.id] ?? selectedHistory, {
          contentVersion: response.published.contentVersion,
          publishedAt: response.published.publishedAt,
        }),
      }))
      setReviews((current) => ({ ...current, [selected.id]: emptyCombatContentReview() }))
      setPublishConfirmationId(null)
      setNotices((current) => ({
        ...current,
        [selected.id]: `Published immutable v${response.published.contentVersion}. Refreshing authoritative content…`,
      }))
      router.refresh()
    } catch (error) {
      setErrors((current) => ({ ...current, [selected.id]: messageFrom(error) }))
    } finally {
      setBusyId((current) => (current === selected.id ? null : current))
    }
  }

  async function rollbackSelected() {
    if (!selected || !rollbackTarget || rollbackTarget.essenceId !== selected.id) return
    const targetVersion = rollbackTarget.version
    setBusyId(selected.id)
    try {
      await postCombatContentAuthoring<{ ok: true }>({
        operation: 'rollback',
        contentKind: 'essence',
        contentKey: selected.id,
        sourceDisciplineId: selected.sourceDisciplineId,
        targetVersion,
      })
      setHistories((current) => ({
        ...current,
        [selected.id]: projectRollbackVersionHistory(
          current[selected.id] ?? selectedHistory,
          targetVersion,
        ),
      }))
      setReviews((current) => ({ ...current, [selected.id]: emptyCombatContentReview() }))
      setRollbackTarget(null)
      setPublishConfirmationId(null)
      router.refresh()
    } catch (error) {
      setErrors((current) => ({ ...current, [selected.id]: messageFrom(error) }))
    } finally {
      setBusyId((current) => (current === selected.id ? null : current))
    }
  }

  if (!first || !selected || !selectedDraft) {
    return (
      <section className={styles.empty}>
        <p className={styles.eyebrow}>Combat Content</p>
        <h1>Essence authoring</h1>
        <p>No authorable Essences are available.</p>
      </section>
    )
  }

  const skill = selectedDraft.skill

  return (
    <section className={styles.editor} aria-labelledby="essence-content-heading">
      <aside className={styles.skillBrowser}>
        <header className={styles.skillBrowserHeader}>
          <div>
            <p className={styles.eyebrow}>Essences</p>
            <strong>{essences.length} available</strong>
          </div>
          <span>Pure builds</span>
        </header>

        <label className={styles.field}>
          <span>Essence</span>
          <select
            aria-label="Essence"
            value={selected.id}
            onChange={(event) => {
              setEssenceId(event.currentTarget.value)
              setPublishConfirmationId(null)
              setRollbackTarget(null)
            }}
          >
            {disciplineOptions.map((essence) => (
              <option key={essence.id} value={essence.id}>
                {essence.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.skillList} aria-label="Essence browser">
          {disciplineOptions.map((essence) => (
            <button
              className={styles.skillRow}
              data-selected={essence.id === selected.id || undefined}
              key={essence.id}
              type="button"
              onClick={() => setEssenceId(essence.id)}
            >
              <span>
                <strong>{essence.label}</strong>
                <small>{essence.sourceDisciplineId}</small>
              </span>
              <em>v{essence.currentVersion}</em>
            </button>
          ))}
        </div>
      </aside>

      <div className={styles.editorMain}>
        <header className={styles.header}>
          <div className={styles.skillGlyph} aria-hidden="true">
            ✦
          </div>
          <div className={styles.headerIdentity}>
            <p className={styles.eyebrow}>Combat Content</p>
            <h1 id="essence-content-heading">Essence authoring</h1>
            <div className={styles.skillIdentity}>
              <strong>{selected.label}</strong>
              <code>{selected.id}</code>
            </div>
          </div>
        </header>

        <div className={styles.versionGrid} aria-label="Essence version state">
          <div>
            <span>Current version</span>
            <strong>{versionLabel('v', selectedCurrentVersion)}</strong>
          </div>
          <div>
            <span>Draft version</span>
            <strong>{versionLabel('d', selected.draftVersion)}</strong>
          </div>
          <div>
            <span>Base version</span>
            <strong>{versionLabel('v', selected.baseVersion)}</strong>
          </div>
        </div>

        <section className={styles.workspace}>
          <div className={styles.workspaceHeading}>
            <p className={styles.sectionLabel}>Draft workspace</p>
            <h2>{selected.label}</h2>
          </div>

          <div className={styles.authoringStack}>
            <fieldset className={styles.typedGroup}>
              <legend>Presentation</legend>
              <label className={styles.field}>
                <span>Flavor line</span>
                <input
                  aria-label="Essence flavor line"
                  maxLength={160}
                  value={selectedDraft.flavorLine ?? ''}
                  onChange={(event) =>
                    updateDraft({ ...selectedDraft, flavorLine: event.currentTarget.value })
                  }
                />
                <small className={styles.fieldHint}>
                  Presentation only. The nested Skill remains the authoritative mechanic.
                </small>
              </label>
              <BattleFlavorTemplateHelp
                value={selectedDraft.flavorLine ?? ''}
                ability={selectedDraft.name}
                onChange={(flavorLine) => updateDraft({ ...selectedDraft, flavorLine })}
              />
            </fieldset>

            <SkillTargetingEditor
              value={skill.target}
              onChange={(target) => updateDraft({ ...selectedDraft, skill: { ...skill, target } })}
            />
            <SkillEconomyEditor
              value={{
                apCost: skill.apCost,
                mpCost: skill.mpCost,
                accuracyMode: skill.accuracyMode,
                accuracyModifierBasisPoints: skill.accuracyModifierBasisPoints,
                cooldown: skill.cooldown,
              }}
              cooldownLockedByRequirement={skill.requirements.length > 0}
              onChange={(economy: SkillEconomyDraft) =>
                updateDraft({
                  ...selectedDraft,
                  skill: {
                    ...skill,
                    ...economy,
                    cooldown:
                      skill.requirements.length > 0
                        ? null
                        : {
                            key: skill.id,
                            ownerTurns: economy.cooldown?.ownerTurns ?? 1,
                          },
                  },
                })
              }
            />
            <SkillMediaEditor
              value={skill.media}
              onChange={(media) => updateDraft({ ...selectedDraft, skill: { ...skill, media } })}
            />
            <SkillEffectListEditor
              value={skill.effects.filter(isMaterializedCombatEffect)}
              effectDescriptions={skill.effectDescriptions}
              onChange={(effects, effectDescriptions) =>
                updateDraft({
                  ...selectedDraft,
                  skill: {
                    ...skill,
                    effects,
                    effectDescriptions,
                  },
                })
              }
            />
          </div>
        </section>

        <section className={styles.tags}>
          <div>
            <p className={styles.sectionLabel}>Read-only projection</p>
            <h2>Derived tags</h2>
          </div>
          <output className={styles.tagList} data-derived-tags="readonly">
            {displayedTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </output>
        </section>

        {skill ? (
          <section className={styles.tags} aria-label="Player-facing Skill information">
            <div>
              <p className={styles.sectionLabel}>Read-only draft projection</p>
              <h2>Skill information</h2>
            </div>
            <SkillDetails skill={skill} expanded />
          </section>
        ) : null}

        <CombatContentReviewPanel
          contentKey={selected.id}
          baseVersion={selectedCurrentVersion}
          nextVersion={selectedNextVersion}
          validation={selectedReview.validation}
          diff={selectedReview.diff}
          preview={selectedReview.preview}
          history={selectedHistory}
          busy={busy}
          publishConfirmationOpen={publishConfirmationId === selected.id}
          rollbackTargetVersion={
            rollbackTarget?.essenceId === selected.id ? rollbackTarget.version : null
          }
          errorMessage={errors[selected.id] ?? null}
          noticeMessage={notices[selected.id] ?? null}
          onValidate={() => void validateSelected()}
          onDiff={() => void diffSelected()}
          onPreview={() => void previewSelected()}
          onRequestPublish={() => setPublishConfirmationId(selected.id)}
          onConfirmPublish={() => void publishSelected()}
          onCancelPublish={() => setPublishConfirmationId(null)}
          onRequestRollback={(version) => setRollbackTarget({ essenceId: selected.id, version })}
          onConfirmRollback={() => void rollbackSelected()}
          onCancelRollback={() => setRollbackTarget(null)}
        />
      </div>
    </section>
  )
}
