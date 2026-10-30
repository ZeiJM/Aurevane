'use client'
import { useEffect, useRef, useState } from 'react'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { ContentDefinitionFields, type ContentReference } from './content-definition-fields'
import {
  contentRecordCommand,
  contentRecordName,
  editableDefinition,
  recordIsDirty,
} from './content-record-workflow'
import type { PendingContentEdit } from './content-workspace-recovery'
import styles from './game-content-workspace.module.css'
import { skillAccuracyForAuthoring } from '@/lib/skill-accuracy-authoring'

/** Edits live in the parent recovery map, not the lifetime of a dialog. */
export function ContentRecordModal({
  contentKey,
  choices,
  pending,
  onChange,
  onClose,
  onSaved,
  availableInDiscipline,
  onAvailabilityChange,
  disciplineSettingsDisabled = false,
  masteryStage,
  onMasteryChange,
  onCommitStart,
  onCommitRelated,
}: {
  contentKey: string
  choices: readonly ContentReference[]
  pending: PendingContentEdit | null
  onChange(key: string, edit: PendingContentEdit | null): void
  onClose(): void
  onSaved(record: CompleteCombatContentRecord): void
  availableInDiscipline?: boolean
  onAvailabilityChange?(available: boolean): void
  disciplineSettingsDisabled?: boolean
  masteryStage?: number
  onMasteryChange?(value: number): void
  onCommitStart?(): () => void
  onCommitRelated?(): Promise<boolean | void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [record, setRecord] = useState<CompleteCombatContentRecord | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingMedia, setPendingMedia] = useState(false)
  const committing = useRef(false)
  const latest = useRef({ pending, onChange })
  useEffect(() => {
    latest.current = { pending, onChange }
  }, [pending, onChange])
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    let live = true
    contentRecordCommand<{ record: CompleteCombatContentRecord | null }>({
      action: 'read',
      contentKey,
    })
      .then((result) => {
        if (!live) return
        if (!result.record) throw new Error('This content is no longer available.')
        setRecord(result.record)
      })
      .catch((cause) => {
        if (live) setError(cause instanceof Error ? cause.message : 'Unable to open the editor.')
      })
    return () => {
      live = false
      previous?.focus()
    }
  }, [contentKey])
  const rawDefinition = pending?.definition ?? (record ? editableDefinition(record) : null)
  const definition =
    record && rawDefinition
      ? skillAccuracyForAuthoring(record.contentKind, rawDefinition)
      : rawDefinition
  const stale = !!record && !!pending && pending.revision !== record.revision
  async function commit() {
    if (committing.current || pendingMedia || !record || !definition || stale) return
    setBusy(true)
    committing.current = true
    setError('')
    setNotice('')
    let finishCommit: (() => void) | undefined
    try {
      finishCommit = onCommitStart?.()
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
        action: 'commit',
        contentKey,
        expectedRevision: record.revision,
        definition,
      })
      const edit = latest.current.pending
      const changedWhileSaving =
        !!edit && JSON.stringify(edit.definition) !== JSON.stringify(definition)
      onChange(
        contentKey,
        changedWhileSaving && recordIsDirty(result.record, edit.definition)
          ? { revision: result.record.revision, definition: edit.definition }
          : null,
      )
      setRecord(result.record)
      onSaved(result.record)
      let relatedPending = false
      try {
        relatedPending = (await onCommitRelated?.()) === true
      } catch (cause) {
        throw new Error(
          `Skill saved; the discipline settings are still uncommitted. ${cause instanceof Error ? cause.message : 'Review the discipline and retry Commit Now.'}`,
        )
      }
      setNotice(
        changedWhileSaving
          ? 'Saved; newer edits remain uncommitted.'
          : relatedPending
            ? 'Saved; discipline edits remain uncommitted.'
            : 'Changes committed and available to the game.',
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to commit this skill. Your edits are retained.',
      )
    } finally {
      finishCommit?.()
      committing.current = false
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby="content-skill-editor-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.modalFrame}>
        <header className={styles.modalHeading}>
          <div>
            <span className={styles.eyebrow}>
              {record?.contentKind === 'tag'
                ? 'Effect description'
                : record?.contentKind === 'resonance'
                  ? 'Resonance'
                  : record?.contentKind === 'essence'
                    ? 'Essence'
                    : 'Skill'}{' '}
              editor
            </span>
            <h2 id="content-skill-editor-title">
              {definition ? contentRecordName(definition) : 'Loading…'}
            </h2>
          </div>
          <button
            autoFocus
            type="button"
            aria-label={
              contentKey.startsWith('tag.') ? 'Close description editor' : 'Close skill editor'
            }
            onClick={onClose}
          >
            Close
          </button>
        </header>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        <div className={styles.modalBody}>
          {stale && record ? (
            <div className={styles.error} role="alert">
              Saved settings changed since these edits were recovered. Review before replacing them.
              <div className={styles.actions}>
                <button onClick={() => onChange(contentKey, null)}>Use saved settings</button>
                <button
                  onClick={() =>
                    onChange(contentKey, {
                      revision: record.revision,
                      definition: pending!.definition,
                    })
                  }
                >
                  Keep my recovered edits
                </button>
              </div>
            </div>
          ) : null}
          {availableInDiscipline !== undefined && onAvailabilityChange ? (
            <label>
              <input
                type="checkbox"
                checked={availableInDiscipline}
                disabled={disciplineSettingsDisabled}
                onChange={(event) => onAvailabilityChange(event.currentTarget.checked)}
              />
              Available in this Discipline
            </label>
          ) : null}
          {availableInDiscipline !== false && masteryStage !== undefined && onMasteryChange ? (
            <label>
              Required mastery stage
              <input
                type="number"
                min={1}
                max={5}
                step={1}
                value={masteryStage}
                disabled={disciplineSettingsDisabled}
                onChange={(event) => onMasteryChange(Number(event.currentTarget.value))}
              />
            </label>
          ) : null}
          {record && definition ? (
            <fieldset disabled={!!record.authoringBlocker || record.lifecycle === 'archived'}>
              <ContentDefinitionFields
                kind={record.contentKind}
                value={definition}
                tab="Parameters"
                choices={choices}
                onPendingMediaChange={setPendingMedia}
                onChange={(next) => {
                  const edit =
                    recordIsDirty(record, next) || committing.current
                      ? { revision: pending?.revision ?? record.revision, definition: next }
                      : null
                  latest.current.pending = edit
                  onChange(contentKey, edit)
                }}
              />
            </fieldset>
          ) : (
            <p role="status">Loading saved settings…</p>
          )}
        </div>
        <footer className={styles.modalFooter}>
          <span role={pendingMedia ? 'status' : undefined}>
            {pendingMedia
              ? 'Preparing selected media. Wait for upload to finish, or retry or cancel if it fails.'
              : 'Closing keeps your uncommitted edits.'}
          </span>
          <button
            type="button"
            className={styles.commit}
            disabled={
              busy ||
              pendingMedia ||
              !record ||
              !definition ||
              stale ||
              (record?.contentKind === 'tag' &&
                !record.draft &&
                !!definition &&
                !recordIsDirty(record, definition)) ||
              !!record?.authoringBlocker ||
              record?.lifecycle === 'archived'
            }
            onClick={() => void commit()}
          >
            {busy ? 'Committing…' : 'Commit Now'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
