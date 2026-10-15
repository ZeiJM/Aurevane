'use client'

import { useRef, useState } from 'react'
import {
  validateBasicSkillDefinition,
  type BasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityNumber, AbilitySelect, AbilityText } from './ability-editor-fields'
import { SkillMediaEditor } from './skill-media-editor'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import { postCombatContentAuthoring } from './combat-content-client'
import type {
  CombatContentValidationResult,
  CombatContentVersionHistoryEntry,
} from './combat-content-workflow'
import { AbilityParameters } from '../../character/ability-parameters'
import { abilityBehaviorInformation } from '../../character/ability-detail-presentation'
import { useSkillEffectTimingPolicy } from '../../character/skill-effect-timing-context'
import styles from './combat-content-editor.module.css'

export interface BasicContentEditorOption {
  readonly id: BasicSkillDefinition['id']
  readonly label: string
  readonly currentVersion: number
  readonly baseVersion: number | null
  readonly draftVersion: number | null
  readonly definition: BasicSkillDefinition
  readonly initialDraft?: BasicSkillDefinition
  readonly history: readonly CombatContentVersionHistoryEntry[]
}
interface BasicDraftState {
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
  const [selectedId, setSelectedId] = useState(initialBasicId ?? basics[0]?.id ?? '')
  const [records, setRecords] = useState<Record<string, BasicDraftState>>(() =>
    Object.fromEntries(
      basics.map((option) => [
        option.id,
        {
          definition: structuredClone(option.initialDraft ?? option.definition),
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

  function update(next: BasicSkillDefinition) {
    if (!selected) return
    const id = selected.id
    revisions.current[id] = (revisions.current[id] ?? 0) + 1
    setRecords((current) => ({
      ...current,
      [id]: { ...current[id]!, definition: next, validation: null, notice: null, error: null },
    }))
  }
  async function run(operation: 'validate' | 'save-draft') {
    if (!selected || !record || busyId !== null) return
    const id = selected.id
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
            [id]: { ...current[id]!, validation: response.validation },
          }))
      } else {
        const response = await postCombatContentAuthoring<{ draft: { draftVersion: number } }>({
          operation,
          definition: draft,
          baseVersion: selected.baseVersion,
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
      }
    } catch (error) {
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
    <section className={styles.editor} aria-labelledby="basic-content-heading">
      <aside className={styles.skillBrowser}>
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
            onChange={(event) => setSelectedId(event.currentTarget.value)}
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
              onClick={() => setSelectedId(option.id)}
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
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Combat Content</p>
            <h1 id="basic-content-heading">Basic Skill authoring</h1>
            <p>{draft.name}</p>
          </div>
        </header>
        <section className={styles.workspace} aria-label="Basic Skill draft">
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
          <SkillMediaEditor value={draft.media} onChange={(media) => update({ ...draft, media })} />
        </section>
        <section className={styles.tags} aria-label="Basic Skill definition report">
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
                  report={abilityBehaviorInformation(behavior, {
                    basic: draft,
                    timingPolicy: policy,
                  })}
                />
              </section>
            ))
          )}
        </section>
        <section className={styles.reviewPanel} aria-label="Basic Skill draft review">
          <div className={styles.reviewActions}>
            <button type="button" disabled={busy} onClick={() => void run('validate')}>
              Validate
            </button>
            <button type="button" disabled={busy} onClick={() => void run('save-draft')}>
              Save draft
            </button>
          </div>
          {record.validation ? (
            <div role="status">
              {record.validation.valid ? (
                'Definition valid.'
              ) : (
                <ul>
                  {record.validation.issues.map((issue, index) => (
                    <li key={`${issue.path}:${index}`}>
                      {issue.path}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          {record.notice ? <p role="status">{record.notice}</p> : null}
          {record.error ? <p role="alert">{record.error}</p> : null}
        </section>
      </div>
    </section>
  )
}
