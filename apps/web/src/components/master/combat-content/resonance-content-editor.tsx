'use client'

import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import {
  isResonanceDefinitionV2,
  normalizedResonanceMechanics,
} from '@aurevane/game-core/combat/resonance-v2'
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
  type CombatContentReviewState,
  type CombatContentSemanticDiff,
  type CombatContentValidationResult,
  type CombatContentVersionHistoryEntry,
} from './combat-content-workflow'
import { SkillEffectListEditor } from './skill-effect-list-editor'
import { SkillMediaEditor } from './skill-media-editor'

export interface ResonanceContentEditorOption {
  readonly id: string
  readonly label: string
  readonly disciplinePair: readonly [string, string]
  readonly currentVersion: number
  readonly baseVersion: number | null
  readonly draftVersion: number | null
  readonly definition: AnyResonanceDefinition
  readonly initialDraft?: AnyResonanceDefinition
  readonly history: readonly CombatContentVersionHistoryEntry[]
}

export interface ResonanceContentEditorProps {
  readonly resonances: readonly ResonanceContentEditorOption[]
  readonly initialResonanceId?: string
}

interface RollbackTarget {
  readonly resonanceId: string
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

function tagsFromInput(value: string): readonly string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function versionLabel(prefix: 'v' | 'd', version: number | null): string {
  return version === null ? 'None' : `${prefix}${version}`
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The Master Panel could not complete that operation.'
}

export function ResonanceContentEditor({
  resonances,
  initialResonanceId,
}: ResonanceContentEditorProps) {
  const router = useRouter()
  const first =
    (initialResonanceId
      ? resonances.find((resonance) => resonance.id === initialResonanceId)
      : null) ??
    resonances[0] ??
    null
  const [resonanceId, setResonanceId] = useState(first?.id ?? '')
  const [drafts, setDrafts] = useState<Record<string, AnyResonanceDefinition>>(() =>
    Object.fromEntries(
      resonances.map((resonance) => [
        resonance.id,
        structuredClone(resonance.initialDraft ?? resonance.definition),
      ]),
    ),
  )
  const [reviews, setReviews] = useState<Record<string, CombatContentReviewState>>({})
  const [histories, setHistories] = useState<
    Record<string, readonly CombatContentVersionHistoryEntry[]>
  >(() => Object.fromEntries(resonances.map((resonance) => [resonance.id, resonance.history])))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [publishConfirmationId, setPublishConfirmationId] = useState<string | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const draftRevision = useRef<Record<string, number>>({})

  const sortedResonances = useMemo(
    () => [...resonances].sort((left, right) => left.label.localeCompare(right.label)),
    [resonances],
  )
  const selected = resonances.find((resonance) => resonance.id === resonanceId) ?? first
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

  function updateDraft(next: AnyResonanceDefinition) {
    if (!selected) return
    draftRevision.current[selected.id] = (draftRevision.current[selected.id] ?? 0) + 1
    setDrafts((current) => ({ ...current, [selected.id]: next }))
    setReviews((current) => ({
      ...current,
      [selected.id]: invalidateCombatContentReview(
        current[selected.id] ?? emptyCombatContentReview(),
      ),
    }))
    setErrors((current) => ({ ...current, [selected.id]: null }))
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
        contentKind: 'resonance',
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

  async function publishSelected() {
    if (!selected || !selectedDraft) return
    if (
      selectedReview.validation?.valid !== true ||
      selectedReview.diff === null ||
      selectedReview.diff.changedPaths.length === 0
    ) {
      return
    }

    setBusyId(selected.id)
    try {
      const response = await postCombatContentAuthoring<PublishedResponse>({
        operation: 'publish',
        contentKind: 'resonance',
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
      router.refresh()
    } catch (error) {
      setErrors((current) => ({ ...current, [selected.id]: messageFrom(error) }))
    } finally {
      setBusyId((current) => (current === selected.id ? null : current))
    }
  }

  async function rollbackSelected() {
    if (!selected || !rollbackTarget || rollbackTarget.resonanceId !== selected.id) return
    const targetVersion = rollbackTarget.version
    setBusyId(selected.id)
    try {
      await postCombatContentAuthoring<{ ok: true }>({
        operation: 'rollback',
        contentKind: 'resonance',
        contentKey: selected.id,
        disciplinePair: selected.disciplinePair,
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
        <h1>Resonance authoring</h1>
        <p>No authorable Resonances are available.</p>
      </section>
    )
  }

  const draft = selectedDraft
  const pair = draft.disciplinePair
  const mechanics = normalizedResonanceMechanics(draft)
  const setup = mechanics.setup
  const triggerMatcher = mechanics.trigger
  const v2 = isResonanceDefinitionV2(draft)

  function updateSetup(nextSetup: typeof setup) {
    if (isResonanceDefinitionV2(draft)) {
      updateDraft({
        ...draft,
        trigger: { ...draft.trigger, setup: nextSetup },
      })
      return
    }
    if (!nextSetup) return
    updateDraft({
      ...draft,
      trigger: { ...draft.trigger, setup: nextSetup },
    })
  }

  function updateTriggerMatcher(nextTrigger: typeof triggerMatcher) {
    if (isResonanceDefinitionV2(draft)) {
      updateDraft({
        ...draft,
        trigger: { ...draft.trigger, trigger: nextTrigger },
      })
      return
    }
    updateDraft({
      ...draft,
      trigger: { ...draft.trigger, payoff: nextTrigger },
    })
  }

  function updateTriggerUtility(value: number) {
    if (isResonanceDefinitionV2(draft)) {
      updateDraft({
        ...draft,
        trigger: { ...draft.trigger, aiTriggerUtilityBonus: value },
      })
      return
    }
    updateDraft({
      ...draft,
      trigger: { ...draft.trigger, aiPayoffUtilityBonus: value },
    })
  }

  function updateSetupUtility(value: number) {
    if (isResonanceDefinitionV2(draft)) {
      updateDraft({
        ...draft,
        trigger: { ...draft.trigger, aiSetupUtilityBonus: value },
      })
      return
    }
    updateDraft({
      ...draft,
      trigger: { ...draft.trigger, aiSetupUtilityBonus: value },
    })
  }

  function updateResultEffects(effects: Parameters<typeof SkillEffectListEditor>[0]['value']) {
    if (isResonanceDefinitionV2(draft)) {
      updateDraft({
        ...draft,
        trigger: { ...draft.trigger, resultEffects: effects },
      })
      return
    }
    updateDraft({
      ...draft,
      trigger: { ...draft.trigger, payoffEffects: effects },
    })
  }

  return (
    <section className={styles.editor} aria-labelledby="resonance-content-heading">
      <aside className={styles.skillBrowser}>
        <header className={styles.skillBrowserHeader}>
          <div>
            <p className={styles.eyebrow}>Resonances</p>
            <strong>{resonances.length} available</strong>
          </div>
          <span>Dual builds</span>
        </header>

        <label className={styles.field}>
          <span>Resonance</span>
          <select
            aria-label="Resonance"
            value={selected.id}
            onChange={(event) => {
              setResonanceId(event.currentTarget.value)
              setPublishConfirmationId(null)
              setRollbackTarget(null)
            }}
          >
            {sortedResonances.map((resonance) => (
              <option key={resonance.id} value={resonance.id}>
                {resonance.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.skillList} aria-label="Resonance browser">
          {sortedResonances.map((resonance) => (
            <button
              className={styles.skillRow}
              data-selected={resonance.id === selected.id || undefined}
              key={resonance.id}
              type="button"
              onClick={() => setResonanceId(resonance.id)}
            >
              <span>
                <strong>{resonance.label}</strong>
                <small>{resonance.disciplinePair.join(' + ')}</small>
              </span>
              <em>v{resonance.currentVersion}</em>
            </button>
          ))}
        </div>
      </aside>

      <div className={styles.editorMain}>
        <header className={styles.header}>
          <div className={styles.skillGlyph} aria-hidden="true">
            ◈
          </div>
          <div className={styles.headerIdentity}>
            <p className={styles.eyebrow}>Combat Content</p>
            <h1 id="resonance-content-heading">Resonance authoring</h1>
            <div className={styles.skillIdentity}>
              <strong>{selected.label}</strong>
              <code>{selected.id}</code>
            </div>
          </div>
        </header>

        <div className={styles.versionGrid} aria-label="Resonance version state">
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
              <legend>Identity &amp; presentation</legend>
              <div className={styles.typedGrid}>
                <label className={styles.field}>
                  <span>Discipline pair</span>
                  <input
                    aria-label="Resonance Discipline pair"
                    readOnly
                    value={pair.map(titleIdentity).join(' + ')}
                  />
                  <small className={styles.fieldHint}>
                    Identity locked. Create a distinct Resonance for a different pair.
                  </small>
                </label>
                <label className={styles.field}>
                  <span>Flavor line</span>
                  <input
                    aria-label="Resonance flavor line"
                    maxLength={160}
                    value={selectedDraft.flavorLine ?? ''}
                    onChange={(event) =>
                      updateDraft({ ...selectedDraft, flavorLine: event.currentTarget.value })
                    }
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.typedGroup}>
              <legend>Resonance mode</legend>
              <div className={styles.typedGrid}>
                <label className={styles.field}>
                  <span>Mode</span>
                  <select
                    aria-label="Resonance mode"
                    disabled={!v2}
                    value={mechanics.mode}
                    onChange={(event) => {
                      if (!isResonanceDefinitionV2(draft)) return
                      const mode = event.currentTarget.value as 'sequence' | 'immediate'
                      const defaultSetup = {
                        sourceDisciplineId:
                          pair.find(
                            (disciplineId) => disciplineId !== triggerMatcher.sourceDisciplineId,
                          ) ?? pair[0],
                        requiredTags: ['attack'],
                      }
                      updateDraft({
                        ...draft,
                        trigger: {
                          ...draft.trigger,
                          mode,
                          setup: mode === 'immediate' ? null : (setup ?? defaultSetup),
                          aiSetupUtilityBonus:
                            mode === 'immediate'
                              ? 0
                              : Math.max(1, draft.trigger.aiSetupUtilityBonus || 10),
                        },
                      })
                    }}
                  >
                    <option value="sequence">Sequence · Setup → Trigger → Result</option>
                    <option value="immediate">Immediate · Trigger → Result</option>
                  </select>
                  {!v2 ? (
                    <small className={styles.fieldHint}>
                      Historical schema v1 is preserved as a sequence Resonance.
                    </small>
                  ) : null}
                </label>
              </div>
            </fieldset>

            {setup ? (
              <fieldset className={styles.typedGroup}>
                <legend>Setup</legend>
                <div className={styles.typedGrid}>
                  <label className={styles.field}>
                    <span>Setup Discipline</span>
                    <select
                      aria-label="Resonance Setup Discipline"
                      value={setup.sourceDisciplineId}
                      onChange={(event) =>
                        updateSetup({
                          ...setup,
                          sourceDisciplineId: event.currentTarget.value,
                        })
                      }
                    >
                      {pair.map((disciplineId) => (
                        <option key={disciplineId} value={disciplineId}>
                          {titleIdentity(disciplineId)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Required tags</span>
                    <input
                      aria-label="Resonance Setup tags"
                      value={setup.requiredTags.join(', ')}
                      onChange={(event) =>
                        updateSetup({
                          ...setup,
                          requiredTags: tagsFromInput(event.currentTarget.value).slice(0, 2),
                        })
                      }
                    />
                    <small className={styles.fieldHint}>
                      One or two comma-separated canonical Skill tags.
                    </small>
                  </label>
                  <label className={styles.field}>
                    <span>AI setup utility</span>
                    <input
                      aria-label="Resonance AI setup utility"
                      min={0}
                      type="number"
                      value={selectedDraft.trigger.aiSetupUtilityBonus}
                      onChange={(event) => updateSetupUtility(Number(event.currentTarget.value))}
                    />
                  </label>
                </div>
              </fieldset>
            ) : (
              <fieldset className={styles.typedGroup}>
                <legend>Setup</legend>
                <p className={styles.effectNote}>
                  None. This Resonance activates immediately when its Trigger matches, so its Result
                  is intentionally lighter than a comparable sequence Resonance.
                </p>
              </fieldset>
            )}

            <fieldset className={styles.typedGroup}>
              <legend>Trigger</legend>
              <div className={styles.typedGrid}>
                <label className={styles.field}>
                  <span>Trigger Discipline</span>
                  <select
                    aria-label="Resonance Trigger Discipline"
                    value={triggerMatcher.sourceDisciplineId}
                    onChange={(event) =>
                      updateTriggerMatcher({
                        ...triggerMatcher,
                        sourceDisciplineId: event.currentTarget.value,
                      })
                    }
                  >
                    {pair.map((disciplineId) => (
                      <option key={disciplineId} value={disciplineId}>
                        {titleIdentity(disciplineId)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Required tags</span>
                  <input
                    aria-label="Resonance Trigger tags"
                    value={triggerMatcher.requiredTags.join(', ')}
                    onChange={(event) =>
                      updateTriggerMatcher({
                        ...triggerMatcher,
                        requiredTags: tagsFromInput(event.currentTarget.value).slice(0, 2),
                      })
                    }
                  />
                  <small className={styles.fieldHint}>
                    One or two comma-separated canonical Skill tags.
                  </small>
                </label>
                <label className={styles.field}>
                  <span>AI trigger utility</span>
                  <input
                    aria-label="Resonance AI trigger utility"
                    min={0}
                    type="number"
                    value={mechanics.aiTriggerUtilityBonus}
                    onChange={(event) => updateTriggerUtility(Number(event.currentTarget.value))}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.typedGroup}>
              <legend>Result</legend>
              <SkillEffectListEditor
                value={mechanics.resultEffects}
                maxEffects={2}
                onChange={(resultEffects) => updateResultEffects(resultEffects)}
              />
            </fieldset>
            <SkillMediaEditor
              value={selectedDraft.media}
              onChange={(media) => updateDraft({ ...selectedDraft, media })}
            />
          </div>
        </section>

        <CombatContentReviewPanel
          contentKey={selected.id}
          baseVersion={selectedCurrentVersion}
          nextVersion={selectedNextVersion}
          validation={selectedReview.validation}
          diff={selectedReview.diff}
          preview={null}
          previewRequired={false}
          history={selectedHistory}
          busy={busy}
          publishConfirmationOpen={publishConfirmationId === selected.id}
          rollbackTargetVersion={
            rollbackTarget?.resonanceId === selected.id ? rollbackTarget.version : null
          }
          errorMessage={errors[selected.id] ?? null}
          onValidate={() => void validateSelected()}
          onDiff={() => void diffSelected()}
          onPreview={() => undefined}
          onRequestPublish={() => setPublishConfirmationId(selected.id)}
          onConfirmPublish={() => void publishSelected()}
          onCancelPublish={() => setPublishConfirmationId(null)}
          onRequestRollback={(version) => setRollbackTarget({ resonanceId: selected.id, version })}
          onConfirmRollback={() => void rollbackSelected()}
          onCancelRollback={() => setRollbackTarget(null)}
        />
      </div>
    </section>
  )
}
