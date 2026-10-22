'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  validateBasicSkillDefinition,
  parseBasicSkillDefinition,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityNumber, AbilitySelect, AbilityText } from './ability-editor-fields'
import { AbilityPresentationEditor } from './ability-presentation-editor'
import { SkillMediaEditor } from './skill-media-editor'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import { postCombatContentAuthoring } from './combat-content-client'
import {
  nextCombatContentVersion,
  projectPublishedVersionHistory,
  type CombatContentPreviewSummary,
  type CombatContentSemanticDiff,
  type CombatContentValidationResult,
  type CombatContentVersionHistoryEntry,
} from './combat-content-workflow'
import { AbilityPreviewSelector, previewActionSelection } from './ability-preview-selector'
import { CombatContentReviewPanel } from './combat-content-review-panel'
import { AbilityParameters } from '../../character/ability-parameters'
import { abilityBehaviorInformation } from '../../character/ability-detail-presentation'
import { useSkillEffectTimingPolicy } from '../../character/skill-effect-timing-context'
import styles from './combat-content-editor.module.css'
import basicStyles from './basic-content-editor.module.css'

export interface BasicContentEditorOption {
  readonly id: BasicSkillDefinition['id']
  readonly label: string
  readonly currentVersion: number
  readonly versionFloor?: number | null
  readonly baseVersion: number | null
  readonly draftVersion: number | null
  readonly definition: BasicSkillDefinition
  readonly initialDraft?: BasicSkillDefinition
  readonly history: readonly CombatContentVersionHistoryEntry[]
}
interface BasicDraftState {
  readonly currentDefinition: BasicSkillDefinition
  readonly currentVersion: number
  readonly baseVersion: number | null
  readonly history: readonly CombatContentVersionHistoryEntry[]
  readonly diff: CombatContentSemanticDiff | null
  readonly preview: CombatContentPreviewSummary | null
  readonly previewGroup?: string
  readonly definition: BasicSkillDefinition
  readonly draftVersion: number | null
  readonly validation: CombatContentValidationResult | null
  readonly notice: string | null
  readonly error: string | null
}

/** Every auxiliary record is authorable independently of the player's selected support slot. */
export function BasicContentEditor({
  basics,
  initialBasicId,
}: {
  basics: readonly BasicContentEditorOption[]
  initialBasicId?: string
}) {
  const router = useRouter()
  const [publishConfirmationId, setPublishConfirmationId] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; version: number } | null>(null)
  const [selectedId, setSelectedId] = useState(initialBasicId ?? basics[0]?.id ?? '')
  const [records, setRecords] = useState<Record<string, BasicDraftState>>(() =>
    Object.fromEntries(
      basics.map((option) => [
        option.id,
        {
          definition: structuredClone(option.initialDraft ?? option.definition),
          currentDefinition: structuredClone(option.definition),
          currentVersion: option.currentVersion,
          baseVersion: option.baseVersion,
          history: option.history,
          diff: null,
          preview: null,
          draftVersion: option.draftVersion,
          validation: null,
          notice: null,
          error: null,
        },
      ]),
    ),
  )
  const revisions = useRef<Record<string, number>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const policy = useSkillEffectTimingPolicy()
  const selected = basics.find((option) => option.id === selectedId) ?? basics[0]
  const record = selected ? records[selected.id] : undefined
  if (!selected || !record)
    return <section className={styles.empty}>No Basic Skills are available.</section>
  const draft = record.definition
  const issues = validateBasicSkillDefinition(draft)
  const busy = busyId !== null
  const selection = previewActionSelection(draft, record.previewGroup)

  function update(next: BasicSkillDefinition) {
    if (!selected) return
    const id = selected.id
    revisions.current[id] = (revisions.current[id] ?? 0) + 1
    setPublishConfirmationId(null)
    setRestoreTarget(null)
    setRecords((current) => ({
      ...current,
      [id]: {
        ...current[id]!,
        definition: next,
        validation: null,
        diff: null,
        preview: null,
        notice: null,
        error: null,
      },
    }))
  }
  function choosePreviewGroup(behaviorId: string) {
    if (!selected || busy || !selection.groups.some((group) => group.id === behaviorId)) return
    const id = selected.id
    revisions.current[id] = (revisions.current[id] ?? 0) + 1
    setRecords((current) => ({
      ...current,
      [id]: { ...current[id]!, previewGroup: behaviorId, preview: null, notice: null, error: null },
    }))
    setPublishConfirmationId(null)
    setRestoreTarget(null)
  }
  async function restoreDraft() {
    if (!selected || !record || busyId !== null || restoreTarget?.id !== selected.id) return
    const id = selected.id
    const version = restoreTarget.version
    const revision = revisions.current[id] ?? 0
    setBusyId(id)
    setRecords((current) => ({ ...current, [id]: { ...current[id]!, error: null, notice: null } }))
    try {
      const response = await postCombatContentAuthoring<{
        draft: { definition: unknown; baseVersion: number; draftVersion: number }
      }>({
        operation: 'restore-basic-draft',
        skillId: id,
        targetVersion: version,
        expectedBaseVersion: record.currentVersion,
        expectedDraftVersion: record.draftVersion,
      })
      const restored = parseBasicSkillDefinition(response.draft.definition)
      if (
        restored.id !== id ||
        restored.contentVersion !== version ||
        response.draft.baseVersion !== record.currentVersion ||
        response.draft.draftVersion !== (record.draftVersion ?? 0) + 1
      ) {
        throw new Error('The server returned a different Basic Skill draft. Refresh and retry.')
      }
      const unchanged = (revisions.current[id] ?? 0) === revision
      setRecords((current) => ({
        ...current,
        [id]: {
          ...current[id]!,
          definition: unchanged ? restored : current[id]!.definition,
          baseVersion: response.draft.baseVersion,
          draftVersion: response.draft.draftVersion,
          validation: null,
          diff: null,
          preview: null,
          notice: unchanged
            ? `Restored v${version} to a draft. Review and publish to apply it.`
            : `Restored v${version} to a saved draft; newer edits are still unsaved.`,
        },
      }))
      setPublishConfirmationId(null)
      setRestoreTarget(null)
    } catch (error) {
      setRecords((current) => ({
        ...current,
        [id]: {
          ...current[id]!,
          error: error instanceof Error ? error.message : 'The Basic Skill could not be restored.',
        },
      }))
    } finally {
      setBusyId(null)
    }
  }
  async function run(operation: 'validate' | 'save-draft' | 'diff' | 'preview' | 'publish') {
    if (!selected || !record || busyId !== null) return
    const id = selected.id
    if (
      (operation === 'diff' || operation === 'preview' || operation === 'publish') &&
      record.validation?.valid !== true
    )
      return
    if (
      (operation === 'preview' || operation === 'publish') &&
      (!record.diff || !selection.available)
    )
      return
    if (
      operation === 'publish' &&
      (!record.diff?.changedPaths.length ||
        record.preview?.legal !== true ||
        record.preview.behaviorId !== selection.behaviorId)
    )
      return
    const revision = revisions.current[id] ?? 0
    setBusyId(id)
    setRecords((current) => ({ ...current, [id]: { ...current[id]!, error: null, notice: null } }))
    try {
      if (operation === 'validate') {
        const response = await postCombatContentAuthoring<{
          validation: CombatContentValidationResult
        }>({ operation, definition: draft })
        if ((revisions.current[id] ?? 0) === revision)
          setRecords((current) => ({
            ...current,
            [id]: {
              ...current[id]!,
              validation: response.validation,
              diff: null,
              preview: null,
              notice: response.validation.valid ? 'Definition valid.' : null,
            },
          }))
      } else if (operation === 'save-draft') {
        const response = await postCombatContentAuthoring<{ draft: { draftVersion: number } }>({
          operation,
          definition: draft,
          baseVersion: record.baseVersion,
          expectedDraftVersion: record.draftVersion,
        })
        const unchanged = (revisions.current[id] ?? 0) === revision
        setRecords((current) => ({
          ...current,
          [id]: {
            ...current[id]!,
            draftVersion: response.draft.draftVersion,
            notice: unchanged
              ? 'Draft saved.'
              : 'Earlier draft saved; newer edits are still unsaved.',
          },
        }))
      } else if (operation === 'diff') {
        const response = await postCombatContentAuthoring<{ diff: CombatContentSemanticDiff }>({
          operation,
          before: record.currentDefinition,
          after: draft,
        })
        if ((revisions.current[id] ?? 0) === revision)
          setRecords((current) => ({
            ...current,
            [id]: { ...current[id]!, diff: response.diff, preview: null },
          }))
      } else if (operation === 'preview') {
        const response = await postCombatContentAuthoring<{ preview: CombatContentPreviewSummary }>(
          { operation, definition: draft, behaviorId: selection.behaviorId },
        )
        if ((revisions.current[id] ?? 0) === revision)
          setRecords((current) => ({
            ...current,
            [id]: { ...current[id]!, preview: response.preview },
          }))
      } else {
        const response = await postCombatContentAuthoring<{
          published: { contentVersion: number; publishedAt: string; definition: unknown }
        }>({ operation, definition: draft, expectedBaseVersion: record.currentVersion })
        const published = parseBasicSkillDefinition(response.published.definition)
        const unchanged = (revisions.current[id] ?? 0) === revision
        setRecords((current) => ({
          ...current,
          [id]: {
            ...current[id]!,
            definition: unchanged ? published : current[id]!.definition,
            currentDefinition: published,
            currentVersion: response.published.contentVersion,
            baseVersion: response.published.contentVersion,
            history: projectPublishedVersionHistory(current[id]!.history, response.published),
            validation: null,
            diff: null,
            preview: null,
            notice: unchanged
              ? `Published immutable v${response.published.contentVersion}.`
              : `Published earlier draft as v${response.published.contentVersion}; newer edits are still unpublished.`,
          },
        }))
        setPublishConfirmationId(null)
        router.refresh()
      }
    } catch (error) {
      if (
        ['validate', 'diff', 'preview'].includes(operation) &&
        (revisions.current[id] ?? 0) !== revision
      )
        return
      setRecords((current) => ({
        ...current,
        [id]: {
          ...current[id]!,
          error:
            error instanceof Error
              ? error.message
              : 'The Master Panel could not complete that operation.',
        },
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section
      className={`${styles.editor} ${basicStyles.editor}`}
      aria-labelledby="basic-content-heading"
    >
      <aside className={`${styles.skillBrowser} ${basicStyles.browser}`}>
        <header className={styles.skillBrowserHeader}>
          <div>
            <p className={styles.eyebrow}>Basic & auxiliary</p>
            <strong>{basics.length} Skills</strong>
          </div>
        </header>
        <label className={styles.field}>
          <span>Basic Skill</span>
          <select
            aria-label="Basic Skill"
            value={selected.id}
            onChange={(event) => {
              setRestoreTarget(null)
              setSelectedId(event.currentTarget.value)
            }}
          >
            {basics.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.fieldHint}>
          Edit each auxiliary Skill here. Your equipped support choice is set in your character
          loadout.
        </p>
        <div className={styles.skillList} aria-label="Basic Skill browser">
          {basics.map((option) => (
            <button
              className={styles.skillRow}
              type="button"
              key={option.id}
              data-selected={option.id === selected.id}
              aria-pressed={option.id === selected.id}
              onClick={() => {
                setRestoreTarget(null)
                setSelectedId(option.id)
              }}
            >
              <span>
                <strong>{option.label}</strong>
                <small>{option.id}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className={styles.editorMain}>
        <header className={`${styles.header} ${basicStyles.panel}`}>
          <div>
            <p className={styles.eyebrow}>Combat Content</p>
            <h1 id="basic-content-heading">Basic Skill authoring</h1>
            <p>{draft.name}</p>
          </div>
        </header>
        <section
          className={`${styles.workspace} ${basicStyles.panel}`}
          aria-label="Basic Skill draft"
        >
          <div className={styles.typedGrid}>
            <AbilityText
              label="Basic Skill name"
              value={draft.name}
              maxLength={120}
              onChange={(name) => update({ ...draft, name })}
            />
            <label className={styles.field}>
              <span>Description</span>
              <textarea
                aria-label="Basic Skill description"
                value={draft.description}
                maxLength={12000}
                onChange={(event) => update({ ...draft, description: event.currentTarget.value })}
              />
            </label>
            <AbilityText
              label="Basic Skill in-battle text"
              value={draft.battleText ?? ''}
              maxLength={12000}
              onChange={(battleText) => update({ ...draft, battleText })}
            />
            <label className={styles.field}>
              <span>Enabled</span>
              <input
                type="checkbox"
                aria-label="Basic Skill enabled"
                checked={draft.enabled}
                onChange={(event) => update({ ...draft, enabled: event.currentTarget.checked })}
              />
            </label>
          </div>
          <BattleFlavorTemplateHelp
            value={draft.battleText ?? ''}
            ability={draft.name}
            onChange={(battleText) => update({ ...draft, battleText })}
          />
          <fieldset className={styles.typedGroup}>
            <legend>Execution</legend>
            {draft.execution.kind === 'basic-move' ? (
              <AbilitySelect
                label="Move cost basis"
                value={draft.execution.costBasis}
                options={['flat', 'per-terrain-point']}
                onChange={(costBasis) =>
                  update({ ...draft, execution: { kind: 'basic-move', costBasis } })
                }
              />
            ) : draft.execution.kind === 'basic-attack' ? (
              <>
                <AbilityNumber
                  label="Higher Power scaling (%)"
                  value={draft.execution.scalingBasisPoints / 100}
                  max={100}
                  step={0.01}
                  onChange={(value) =>
                    update({
                      ...draft,
                      execution: {
                        kind: 'basic-attack',
                        scalingBasisPoints: Math.round(value * 100),
                      },
                    })
                  }
                />
                <p className={styles.fieldHint}>
                  Uses the higher committed Physical or Mystic Power; Physical wins ties.
                </p>
              </>
            ) : (
              <AbilitySelect
                label="Recovery rounding"
                value={draft.execution.recoveryRounding ?? 'floor'}
                options={['nearest', 'floor']}
                onChange={(recoveryRounding) =>
                  update({ ...draft, execution: { kind: 'basic-action', recoveryRounding } })
                }
              />
            )}
          </fieldset>
          <AbilityDefinitionEditor
            value={draft.ability}
            allowEffectDescriptions={false}
            onChange={(ability) => update({ ...draft, ability })}
          />
          <AbilityPresentationEditor
            definition={draft}
            name={draft.name}
            value={draft.presentation}
            onChange={(presentation) => update({ ...draft, presentation })}
          />
          <SkillMediaEditor value={draft.media} onChange={(media) => update({ ...draft, media })} />
        </section>
        <section
          className={`${styles.tags} ${basicStyles.panel} ${basicStyles.report}`}
          aria-label="Basic Skill definition report"
        >
          <h2>Skill information</h2>
          {issues.length ? (
            <div role="status">
              <p>Correct the definition to view its Skill information.</p>
              <ul>
                {issues.map((issue, index) => (
                  <li key={`${issue.path}:${index}`}>
                    {issue.path}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            draft.ability.behaviors.map((behavior, index) => (
              <section
                key={behavior.id}
                aria-label={`Manual Action ${index + 1}`}
                data-ability-behavior={behavior.id}
              >
                {draft.ability.behaviors.length > 1 ? <h3>Manual Action {index + 1}</h3> : null}
                <AbilityParameters
                  characteristicsClassName={basicStyles.characteristics}
                  effectExplanationsClassName={basicStyles.explanations}
                  report={abilityBehaviorInformation(behavior, {
                    basic: draft,
                    timingPolicy: policy,
                  })}
                />
              </section>
            ))
          )}
        </section>
        <CombatContentReviewPanel
          className={basicStyles.panel}
          contentKey={selected.id}
          baseVersion={record.currentVersion}
          nextVersion={nextCombatContentVersion(
            record.currentVersion,
            record.history,
            selected.versionFloor,
          )}
          validation={record.validation}
          diff={record.diff}
          preview={record.preview}
          previewAvailable={selection.available}
          previewSelectionControl={
            <AbilityPreviewSelector
              selection={selection}
              busy={busy}
              onChange={choosePreviewGroup}
            />
          }
          draftActions={
            <button type="button" disabled={busy} onClick={() => void run('save-draft')}>
              Save draft
            </button>
          }
          history={[
            ...record.history.filter((entry) => entry.current),
            ...record.history
              .filter((entry) => !entry.current)
              .sort((left, right) => right.contentVersion - left.contentVersion)
              .slice(0, 2),
          ]}
          rollbackEnabled={false}
          onRequestRestoreDraft={(version) => {
            if (
              busy ||
              !record.history.some((entry) => entry.contentVersion === version && !entry.current)
            )
              return
            setPublishConfirmationId(null)
            setRestoreTarget({ id: selected.id, version })
          }}
          busy={busy}
          publishConfirmationOpen={publishConfirmationId === selected.id}
          rollbackTargetVersion={null}
          errorMessage={record.error}
          noticeMessage={record.notice}
          onValidate={() => void run('validate')}
          onDiff={() => void run('diff')}
          onPreview={() => void run('preview')}
          onRequestPublish={() => {
            setRestoreTarget(null)
            setPublishConfirmationId(selected.id)
          }}
          onConfirmPublish={() => void run('publish')}
          onCancelPublish={() => setPublishConfirmationId(null)}
          onRequestRollback={() => {}}
          onConfirmRollback={() => {}}
          onCancelRollback={() => {}}
        />
        {restoreTarget?.id === selected.id ? (
          <section className={styles.confirmation} aria-label="Confirm restore to draft">
            <p className={styles.sectionLabel}>Restore v{restoreTarget.version} to draft</p>
            <p>
              This replaces the saved draft with the complete selected version. Published versions
              and active battles stay unchanged. Review the restored draft before publishing it.
            </p>
            <div className={styles.confirmationActions}>
              <button type="button" disabled={busy} onClick={() => void restoreDraft()}>
                Confirm restore to draft
              </button>
              <button type="button" disabled={busy} onClick={() => setRestoreTarget(null)}>
                Cancel restore
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  )
}
