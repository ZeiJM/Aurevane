'use client'

import { useRef, useState } from 'react'
import type {
  CompleteCombatContentRecord,
  CombatContentDefinition,
} from '@aurevane/db/combat-content'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { MAX_DISCIPLINE_SKILLS } from '@aurevane/game-core/content/authored-content'
import { CombatContentAuthoringClientError } from './combat-content-client'
import { createDisciplineSkillDraft } from './discipline-skill-creation'
import { contentRecordCommand, editableDefinition } from './content-record-workflow'
import type { ContentReference } from './content-definition-fields'
import styles from './game-content-workspace.module.css'

interface CreationAttempt {
  requestId: string
  parentKey: string
  expectedParentRevision: number
  definition: CombatContentDefinition
}

export function NewDisciplineSkill({
  parent,
  count,
  choices,
  blank,
  disabled,
  recoveryScope,
  onCreated,
  onBusyChange,
}: {
  parent: CompleteCombatContentRecord | null
  count: number
  choices: readonly ContentReference[]
  blank: CombatContentDefinition | null
  disabled: boolean
  recoveryScope: string
  onBusyChange(active: boolean): void
  onCreated(child: CompleteCombatContentRecord, parent: CompleteCombatContentRecord): void
}) {
  const [template, setTemplate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingAttempt, setPendingAttempt] = useState(false)
  const attempt = useRef<CreationAttempt | null>(null)
  const submitting = useRef(false)
  const storageKey =
    recoveryScope && parent ? `master-skill-create:v1:${recoveryScope}:${parent.contentKey}` : ''
  async function create() {
    if (!parent || !blank || submitting.current || disabled || count >= MAX_DISCIPLINE_SKILLS)
      return
    submitting.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    let retrying = attempt.current !== null
    let created = false
    try {
      if (!attempt.current && storageKey) {
        const retained = localStorage.getItem(storageKey)
        if (retained) {
          const value = JSON.parse(retained) as CreationAttempt
          if (
            value.parentKey !== parent.contentKey ||
            !value.requestId ||
            !value.definition ||
            !Number.isSafeInteger(value.expectedParentRevision)
          )
            throw new Error(
              'The pending Skill creation cannot be recovered. Refresh this workspace.',
            )
          attempt.current = value
          retrying = true
        }
      }
      if (!attempt.current) {
        let source = blank
        if (template) {
          const result = await contentRecordCommand<{ record: CompleteCombatContentRecord | null }>(
            { action: 'read', contentKey: template },
          )
          if (
            !result.record ||
            result.record.contentKind !== 'skill' ||
            result.record.lifecycle === 'archived'
          )
            throw new Error('This template is no longer available. Choose another Skill.')
          const body = editableDefinition(result.record)
          if (!body) throw new Error('This template has no editable Skill definition.')
          source = body
        }
        const requestId = crypto.randomUUID()
        attempt.current = {
          requestId,
          parentKey: parent.contentKey,
          expectedParentRevision: parent.revision,
          definition: {
            ...createDisciplineSkillDraft(
              source as unknown as MatureSkillDefinition,
              parent.contentKey,
              `skill.${requestId}`,
            ),
          },
        }
        // Save the exact intent before the request; retries never create a second Skill.
      }
      setPendingAttempt(true)
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(attempt.current))
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
        action: 'create',
        contentKind: 'skill',
        ...attempt.current,
      })
      created = true
      const refreshed = await contentRecordCommand<{ record: CompleteCombatContentRecord | null }>({
        action: 'read',
        contentKey: parent.contentKey,
      })
      if (!refreshed.record)
        throw new Error('Skill created, but its Discipline could not refresh. Retry to recover it.')
      onCreated(result.record, refreshed.record)
      attempt.current = null
      setPendingAttempt(false)
      if (storageKey) localStorage.removeItem(storageKey)
      setTemplate('')
    } catch (cause) {
      if (
        !retrying &&
        !created &&
        cause instanceof CombatContentAuthoringClientError &&
        ['INVALID_REQUEST', 'STALE_VERSION'].includes(cause.code)
      ) {
        attempt.current = null
        setPendingAttempt(false)
        if (storageKey) localStorage.removeItem(storageKey)
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to create the Skill. Retry to recover your request.',
      )
    } finally {
      submitting.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  return (
    <div className={styles.skillCreation}>
      <strong>
        {count}/{MAX_DISCIPLINE_SKILLS} Skills
      </strong>
      <details>
        <summary>New Skill</summary>
        <div className={styles.skillCreationOptions}>
          <label>
            Starting point
            <select
              aria-label="New Skill starting point"
              value={template}
              disabled={disabled || busy || pendingAttempt}
              onChange={(event) => setTemplate(event.currentTarget.value)}
            >
              <option value="">Start blank</option>
              <optgroup label="Use existing Skill as template">
                {choices.map((row) => (
                  <option key={row.contentKey} value={row.contentKey}>
                    {row.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            type="button"
            disabled={disabled || busy || !parent || !blank || count >= MAX_DISCIPLINE_SKILLS}
            onClick={() => void create()}
          >
            {busy ? 'Creating…' : error && pendingAttempt ? 'Retry creation' : 'Create Skill'}
          </button>
          {!parent ? (
            <small>Commit the new Discipline first.</small>
          ) : count >= MAX_DISCIPLINE_SKILLS ? (
            <small>All eight Skill slots are filled.</small>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </div>
      </details>
    </div>
  )
}
