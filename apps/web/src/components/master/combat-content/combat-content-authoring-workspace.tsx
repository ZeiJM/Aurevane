'use client'
import { useRef, useState } from 'react'
import {
  captureCombatTagPresentation,
  type CombatTagPresentationSnapshot,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { BASIC_SKILL_IDS } from '@aurevane/game-core/combat/combat-basic-actions'
import type {
  CombatContentDefinition,
  CombatContentListPage,
  CombatContentSort,
  CompleteCombatContentRecord,
} from '@aurevane/db/combat-content'
import type { CombatContentEditorDescriptor } from '@/server/combat/combat-content-editor-defaults'
import {
  ContentDefinitionFields,
  type ContentEditorTab,
  type ContentReference,
} from './content-definition-fields'
import {
  contentRecordCommand,
  contentRecordName,
  editableDefinition,
  recordIsDirty,
  savedPublicationCommand,
} from './content-record-workflow'
import { postCombatContentAuthoring } from './combat-content-client'
import type {
  CombatContentValidationResult,
  CombatContentSemanticDiff,
} from './combat-content-workflow'
import { ContentRecordPreview } from './content-record-preview'
import styles from './game-content-workspace.module.css'
export interface CombatContentAuthoringWorkspaceProps {
  readonly categories?: readonly CombatContentEditorDescriptor[]
  readonly initialPage?: CombatContentListPage
  readonly initialRecord?: CompleteCombatContentRecord | null
  readonly references?: readonly ContentReference[]
  readonly tagPresentations?: readonly CombatTagPresentationSnapshot[]
}
const categoryOf = (record: Pick<CompleteCombatContentRecord, 'contentKind' | 'contentKey'>) =>
  record.contentKind === 'skill' &&
  (BASIC_SKILL_IDS as readonly string[]).includes(record.contentKey)
    ? 'basic'
    : record.contentKind
export function CombatContentAuthoringWorkspace({
  categories = [],
  initialPage = { records: [], nextCursor: null },
  initialRecord = null,
  references = [],
  tagPresentations: initialTagPresentations = [],
}: CombatContentAuthoringWorkspaceProps) {
  const [tagPresentations, setTagPresentations] = useState(initialTagPresentations)
  const [record, setRecord] = useState(initialRecord)
  const [definition, setDefinition] = useState<CombatContentDefinition | null>(
    initialRecord ? editableDefinition(initialRecord) : null,
  )
  const [category, setCategory] = useState(
    initialRecord ? categoryOf(initialRecord) : (categories[0]?.category ?? 'discipline'),
  )
  const [page, setPage] = useState(initialPage)
  const [search, setSearch] = useState(''),
    [sort, setSort] = useState<CombatContentSort>('name-asc'),
    [lifecycle, setLifecycle] = useState('')
  const [validation, setValidation] = useState<CombatContentValidationResult | null>(null),
    [diff, setDiff] = useState<CombatContentSemanticDiff | null>(null)
  const [tab, setTab] = useState<ContentEditorTab>('Parameters'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [newParent, setNewParent] = useState<{
    parentKey: string
    expectedParentRevision: number
  } | null>(null)
  const [newDefinition, setNewDefinition] = useState<CombatContentDefinition | null>(null)
  const [linkSearch, setLinkSearch] = useState(''),
    [linkChoices, setLinkChoices] = useState<ContentReference[]>([])
  const localEdits = useRef(new Map<string, CombatContentDefinition>())
  const [localDirtyKeys, setLocalDirtyKeys] = useState<Record<string, boolean>>({})
  const editRevision = useRef(0)
  const browseRequest = useRef(0)
  const [appliedBrowse, setAppliedBrowse] = useState(
    JSON.stringify({ search: '', sort: 'name-asc', lifecycle: '' }),
  )
  const descriptor = categories.find((row) => row.category === category)
  const activeDescriptor = categories.find(
    (row) => row.category === (newDefinition ? category : record ? categoryOf(record) : category),
  )
  const dirty = !!record && !!definition && recordIsDirty(record, definition)
  const activeDefinition = newDefinition ?? definition
  const choices = [
    ...references,
    ...page.records.map((row) => ({ ...row, name: row.name ?? row.contentKey })),
    ...linkChoices,
  ].filter(
    (row, index, rows) => rows.findIndex((other) => other.contentKey === row.contentKey) === index,
  )
  function change(next: CombatContentDefinition) {
    editRevision.current++
    setValidation(null)
    setDiff(null)
    setError('')
    setNotice('')
    if (newDefinition) setNewDefinition(next)
    else {
      setDefinition(next)
      if (record) {
        localEdits.current.set(record.contentKey, next)
        setLocalDirtyKeys((old) => ({ ...old, [record.contentKey]: true }))
      }
    }
  }
  async function work(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete this operation.')
    } finally {
      setBusy(false)
    }
  }
  function accept(next: CompleteCombatContentRecord, keepLocal = false) {
    setValidation(null)
    setDiff(null)
    setRecord(next)
    setCategory(categoryOf(next))
    setNewDefinition(null)
    setNewParent(null)
    const local = keepLocal ? localEdits.current.get(next.contentKey) : null
    setDefinition(local ?? editableDefinition(next))
    if (!keepLocal) {
      localEdits.current.delete(next.contentKey)
      setLocalDirtyKeys((old) => ({ ...old, [next.contentKey]: false }))
    }
  }
  async function read(key: string) {
    await work(async () => {
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord | null }>({
        action: 'read',
        contentKey: key,
      })
      if (!result.record) throw new Error('This record is no longer available.')
      accept(result.record, true)
      setTab('Parameters')
    })
  }
  async function browse(nextCategory = category, after?: string) {
    const request = ++browseRequest.current
    await work(async () => {
      const selected = categories.find((row) => row.category === nextCategory)
      const result = await contentRecordCommand<CombatContentListPage>({
        action: 'list',
        kind: selected?.storedKind,
        ...(nextCategory === 'basic'
          ? { category: 'basic' }
          : nextCategory === 'skill'
            ? { category: 'discipline-skill' }
            : {}),
        search,
        sort,
        ...(lifecycle ? { lifecycle } : {}),
        ...(after ? { after } : {}),
        limit: 20,
      })
      if (request === browseRequest.current) {
        setPage(result)
        setCategory(nextCategory)
        setAppliedBrowse(JSON.stringify({ search, sort, lifecycle }))
        if (nextCategory !== category) {
          setRecord(null)
          setDefinition(null)
          setNewDefinition(null)
          setTab('Parameters')
        }
      }
    })
  }
  async function mutate(command: Record<string, unknown>, message: string) {
    const revision = editRevision.current
    await work(async () => {
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>(command)
      accept(result.record, revision !== editRevision.current)
      if (
        result.record.contentKind === 'tag' &&
        (command.action === 'publish' || command.action === 'archive')
      ) {
        const published = result.record.current?.definition
        const next =
          result.record.lifecycle !== 'archived' && published?.enabled !== false && published
            ? captureCombatTagPresentation(
                published as Parameters<typeof captureCombatTagPresentation>[0],
              )
            : null
        setTagPresentations((old) => [
          ...old.filter((row) => row.contentKey !== result.record.contentKey),
          ...(next ? [next] : []),
        ])
      }
      setNotice(
        revision !== editRevision.current
          ? 'Saved earlier changes; newer local edits remain unsaved.'
          : message,
      )
      const nextCategory = categoryOf(result.record)
      const isNew = command.action === 'create' || command.action === 'duplicate'
      const nextSearch = isNew ? '' : search,
        nextLifecycle = isNew ? '' : lifecycle
      try {
        const nextPage = await contentRecordCommand<CombatContentListPage>({
          action: 'list',
          kind: result.record.contentKind,
          ...(nextCategory === 'basic'
            ? { category: 'basic' }
            : nextCategory === 'skill'
              ? { category: 'discipline-skill' }
              : {}),
          search: nextSearch,
          sort,
          ...(nextLifecycle ? { lifecycle: nextLifecycle } : {}),
          limit: 20,
        })
        setPage(nextPage)
        setSearch(nextSearch)
        setLifecycle(nextLifecycle)
        setAppliedBrowse(JSON.stringify({ search: nextSearch, sort, lifecycle: nextLifecycle }))
      } catch {
        setPage((old) => ({ ...old, nextCursor: null }))
        setError(
          'The record was saved, but the content list could not refresh. Use Search to reload the list.',
        )
      }
    })
  }
  async function create() {
    if (!newDefinition || !descriptor) return
    await mutate(
      {
        action: 'create',
        requestId: crypto.randomUUID(),
        contentKind: descriptor.storedKind,
        definition: newDefinition,
        ...(newParent ?? {}),
      },
      'Created a saved draft.',
    )
  }
  const readOnly = !!record?.authoringBlocker || record?.lifecycle === 'archived'
  return (
    <section className={styles.workspace} aria-label="Game Content workspace">
      <form
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault()
          if (!newDefinition) void browse()
        }}
      >
        <label>
          Category
          <select
            aria-label="Content category"
            value={category}
            disabled={busy || !!newDefinition}
            onChange={(event) => {
              void browse(event.currentTarget.value as typeof category)
            }}
          >
            {categories.map((entry) => (
              <option key={entry.category} value={entry.category}>
                {entry.group === 'Skills' ? `Skills · ${entry.label}` : entry.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search content
          <input
            type="search"
            maxLength={160}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.currentTarget.value as CombatContentSort)}
          >
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="key-asc">Identity A–Z</option>
            <option value="key-desc">Identity Z–A</option>
          </select>
        </label>
        <label>
          State
          <select value={lifecycle} onChange={(event) => setLifecycle(event.currentTarget.value)}>
            <option value="">All states</option>
            <option value="draft">Drafts</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button disabled={busy || !!newDefinition}>Search</button>
        <button
          type="button"
          disabled={busy || !!newDefinition || !descriptor?.defaultDefinition}
          onClick={() => {
            setNewParent(null)
            setNewDefinition(structuredClone(descriptor!.defaultDefinition!))
            setTab('Parameters')
            setError('')
          }}
        >
          New
        </button>
      </form>
      {error ? (
        <p className={styles.error} role="alert">
          {error} Your local edits are retained.{' '}
          {record && !newDefinition ? (
            <button type="button" disabled={busy} onClick={() => void read(record.contentKey)}>
              Refresh saved state
            </button>
          ) : null}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <div className={styles.columns}>
        <nav aria-label="Content records" className={styles.list}>
          {page.records.map((row) => (
            <button
              type="button"
              key={row.contentKey}
              data-content-key={row.contentKey}
              aria-current={record?.contentKey === row.contentKey && !newDefinition}
              disabled={busy || !!newDefinition}
              onClick={() => void read(row.contentKey)}
            >
              {row.name ?? row.contentKey}
              <small>
                {' '}
                · {row.lifecycle}
                {localDirtyKeys[row.contentKey] ? ' · local edits' : ''}
              </small>
            </button>
          ))}
          {page.records.length === 0 ? <p>No matching records.</p> : null}
          <div className={styles.actions}>
            <button disabled={busy || !!newDefinition} onClick={() => void browse()}>
              First page
            </button>
            <button
              disabled={
                busy ||
                !!newDefinition ||
                !page.nextCursor ||
                appliedBrowse !== JSON.stringify({ search, sort, lifecycle })
              }
              onClick={() => void browse(category, page.nextCursor!)}
            >
              Next page
            </button>
          </div>
        </nav>
        <div className={styles.editor}>
          {activeDefinition ? (
            <>
              <h2>{contentRecordName(activeDefinition)}</h2>
              <div className={`${styles.actions} ${styles.savebar}`}>
                <span className={styles.status} role="status" aria-label="Content version state">
                  {newDefinition
                    ? 'New draft'
                    : dirty
                      ? 'Unsaved changes'
                      : record?.draft
                        ? 'Saved draft'
                        : 'Published'}
                  {!newDefinition && (record?.current || record?.builtin)
                    ? ` · Current v${record?.current?.contentVersion ?? record?.builtin?.contentVersion}`
                    : ''}
                </span>
                {newDefinition ? (
                  <>
                    <button disabled={busy} onClick={() => void create()}>
                      Create draft
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setNewDefinition(null)
                        setNewParent(null)
                        if (record) setCategory(categoryOf(record))
                        setNotice('New draft discarded.')
                      }}
                    >
                      Discard new draft
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy || readOnly}
                      onClick={() =>
                        void mutate(
                          {
                            action: 'save',
                            contentKey: record!.contentKey,
                            expectedRevision: record!.revision,
                            definition,
                          },
                          'Draft saved. Publishing is separate.',
                        )
                      }
                    >
                      Save draft
                    </button>
                    <button
                      disabled={
                        busy ||
                        readOnly ||
                        dirty ||
                        !record?.draft ||
                        !!activeDescriptor?.publicationBlocker
                      }
                      onClick={() =>
                        void mutate(
                          savedPublicationCommand(record!, definition!),
                          'Published the saved complete record.',
                        )
                      }
                    >
                      Publish saved draft
                    </button>
                  </>
                )}
              </div>
              {!newDefinition &&
              record &&
              ['skill', 'essence', 'resonance'].includes(record.contentKind) ? (
                <div className={styles.actions}>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void work(async () => {
                        const revision = editRevision.current
                        const result = await postCombatContentAuthoring<{
                          validation: CombatContentValidationResult
                        }>({ operation: 'validate', contentKind: record.contentKind, definition })
                        if (revision === editRevision.current) setValidation(result.validation)
                      })
                    }
                  >
                    Validate
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void work(async () => {
                        const revision = editRevision.current
                        const result = await postCombatContentAuthoring<{
                          diff: CombatContentSemanticDiff
                        }>({
                          operation: 'diff',
                          before: record.current?.definition ?? record.builtinDefinition ?? {},
                          after: definition,
                        })
                        if (revision === editRevision.current) setDiff(result.diff)
                      })
                    }
                  >
                    Diff
                  </button>
                </div>
              ) : null}
              {validation ? (
                <section
                  aria-label="Validation issues"
                  data-validation-state={validation.valid ? 'valid' : 'invalid'}
                >
                  <strong>
                    {validation.valid ? 'Validated' : 'Resolve compatibility before publishing'}
                  </strong>
                  {validation.issues.map((issue, index) => (
                    <p key={index}>
                      {issue.path}: {issue.message}
                    </p>
                  ))}
                </section>
              ) : null}
              {diff ? (
                <section aria-label="Semantic diff">
                  <h3>Semantic diff</h3>
                  {diff.changedPaths.length ? (
                    diff.changedPaths.map((path) => <p key={path}>{path}</p>)
                  ) : (
                    <p>No semantic changes.</p>
                  )}
                </section>
              ) : null}
              {record?.authoringBlocker || activeDescriptor?.publicationBlocker ? (
                <p role="note">
                  {record?.authoringBlocker?.message ??
                    activeDescriptor?.publicationBlocker?.message}
                </p>
              ) : null}
              <div className={styles.tabs} role="group" aria-label="Editor sections">
                {(['Parameters', 'Text', 'Media', 'History'] as const).map((section) => (
                  <button
                    key={section}
                    disabled={newDefinition !== null && section === 'History'}
                    aria-pressed={tab === section}
                    onClick={() => setTab(section)}
                  >
                    {section}
                  </button>
                ))}
              </div>
              {tab === 'History' && record ? (
                <>
                  <h3>Published history</h3>
                  {record.builtinRestoreVersion ? (
                    <section aria-label="System original">
                      <strong>System original · v{record.builtinRestoreVersion}</strong>
                      <p>
                        Built-in source snapshot. Restoring saves a draft; publication creates a new
                        version.
                      </p>
                      <button
                        disabled={busy || dirty || readOnly}
                        onClick={() =>
                          void mutate(
                            {
                              action: 'restore',
                              contentKey: record.contentKey,
                              expectedRevision: record.revision,
                              sourceVersion: record.builtinRestoreVersion,
                              sourceKind: 'builtin',
                            },
                            'System original restored to a saved draft. Preview and publish when ready.',
                          )
                        }
                      >
                        {`Restore System original v${record.builtinRestoreVersion} to draft`}
                      </button>
                    </section>
                  ) : record.builtin &&
                    !record.history.some(
                      (version) => version.contentVersion === record.builtin!.contentVersion,
                    ) ? (
                    <p>
                      The indexed built-in source is unavailable for restoration on this server.
                      Recorded publications remain available below.
                    </p>
                  ) : null}
                  <ol className={styles.history} aria-label="Publication history">
                    {[
                      ...(record.current ? [record.current] : []),
                      ...record.history
                        .filter(
                          (version) => version.contentVersion !== record.current?.contentVersion,
                        )
                        .toSorted((a, b) => b.contentVersion - a.contentVersion),
                    ]
                      .slice(0, 3)
                      .map((version) => (
                        <li key={version.contentVersion}>
                          <strong>
                            Version {version.contentVersion}
                            {version.contentVersion === record.current?.contentVersion
                              ? ' · current'
                              : ''}
                          </strong>
                          <p>
                            Authored by{' '}
                            {version.restoredSource === 'builtin'
                              ? 'System'
                              : (version.authoredBy ?? 'Unknown')}{' '}
                            {version.authoredAt ?? ''}
                          </p>
                          <p>
                            Published by {version.publishedBy} {version.publishedAt}
                          </p>
                          {version.restoredFrom ? (
                            <p>
                              Restored from{' '}
                              {version.restoredSource === 'builtin' ? 'System original ' : ''}v
                              {version.restoredFrom} by {version.restoredBy}
                            </p>
                          ) : null}
                          <button
                            disabled={busy || dirty || readOnly}
                            onClick={() =>
                              void mutate(
                                {
                                  action: 'restore',
                                  contentKey: record.contentKey,
                                  expectedRevision: record.revision,
                                  sourceVersion: version.contentVersion,
                                },
                                `Version ${version.contentVersion} restored to a saved draft. Preview and publish when ready.`,
                              )
                            }
                          >
                            Restore version {version.contentVersion} to draft
                          </button>
                        </li>
                      ))}
                  </ol>
                  <p>Older snapshots remain retained. Draft saves do not consume history.</p>
                </>
              ) : (
                <fieldset disabled={newDefinition ? busy : readOnly}>
                  <ContentDefinitionFields
                    kind={newDefinition ? descriptor!.storedKind : record!.contentKind}
                    value={activeDefinition}
                    tab={tab}
                    onChange={change}
                    choices={choices}
                  />
                </fieldset>
              )}
              {!newDefinition && record ? (
                <>
                  <details>
                    <summary>Identity and relationships</summary>
                    <p>Stable identity: {record.contentKey}</p>
                    <h4>Used by</h4>
                    {record.usedBy.length ? (
                      record.usedBy.map((use, index) => (
                        <p key={`${use.kind}:${use.key}:${index}`}>
                          {use.kind}: {use.key}
                        </p>
                      ))
                    ) : (
                      <p>No recorded references.</p>
                    )}
                    {record.usedByTruncated ? (
                      <p>Additional references exist; archive still checks all dependencies.</p>
                    ) : null}
                    {record.contentKind === 'discipline' ? (
                      <>
                        <h4>Linked Skills</h4>
                        {record.links.map((key) => (
                          <p key={key}>
                            <button disabled={busy} onClick={() => void read(key)}>
                              {choices.find((row) => row.contentKey === key)?.name ?? key}
                            </button>
                            <button
                              disabled={busy || dirty}
                              onClick={() =>
                                void mutate(
                                  {
                                    action: 'unlink',
                                    contentKey: record.contentKey,
                                    expectedRevision: record.revision,
                                    requestId: crypto.randomUUID(),
                                    childKey: key,
                                  },
                                  'Skill unlinked in the saved draft.',
                                )
                              }
                            >
                              Unlink
                            </button>
                          </p>
                        ))}
                        <label>
                          Find existing Skill
                          <input
                            value={linkSearch}
                            onChange={(event) => setLinkSearch(event.currentTarget.value)}
                          />
                        </label>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void work(async () => {
                              const result = await contentRecordCommand<CombatContentListPage>({
                                action: 'list',
                                kind: 'skill',
                                category: 'discipline-skill',
                                search: linkSearch,
                                sort: 'name-asc',
                                limit: 20,
                              })
                              setLinkChoices(
                                result.records.map((row) => ({
                                  ...row,
                                  name: row.name ?? row.contentKey,
                                })),
                              )
                            })
                          }
                        >
                          Find Skills
                        </button>
                        {linkChoices.map((row) => (
                          <button
                            key={row.contentKey}
                            disabled={busy || dirty || record.links.includes(row.contentKey)}
                            onClick={() =>
                              void mutate(
                                {
                                  action: 'link',
                                  contentKey: record.contentKey,
                                  expectedRevision: record.revision,
                                  requestId: crypto.randomUUID(),
                                  childKey: row.contentKey,
                                },
                                'Skill linked in the saved draft.',
                              )
                            }
                          >
                            Link {row.name}
                          </button>
                        ))}
                        <button
                          disabled={busy || dirty}
                          onClick={() => {
                            const skill = categories.find((row) => row.category === 'skill')!
                            setNewParent({
                              parentKey: record.contentKey,
                              expectedParentRevision: record.revision,
                            })
                            setCategory('skill')
                            setNewDefinition({
                              ...structuredClone(skill.defaultDefinition!),
                              sourceDisciplineId: record.contentKey,
                            })
                            setTab('Parameters')
                          }}
                        >
                          New Skill in this Discipline
                        </button>
                      </>
                    ) : null}
                  </details>
                  <div className={styles.actions}>
                    <button
                      disabled={
                        busy ||
                        dirty ||
                        readOnly ||
                        category === 'basic' ||
                        record.contentKind === 'tag'
                      }
                      onClick={() =>
                        void mutate(
                          {
                            action: 'duplicate',
                            sourceKey: record.contentKey,
                            expectedSourceRevision: record.revision,
                            requestId: crypto.randomUUID(),
                          },
                          'Duplicated into a new saved draft.',
                        )
                      }
                    >
                      Duplicate
                    </button>
                    <button
                      disabled={busy || dirty || readOnly || category === 'basic'}
                      onClick={() =>
                        void mutate(
                          {
                            action: 'archive',
                            contentKey: record.contentKey,
                            expectedRevision: record.revision,
                          },
                          'Archived after checking dependencies.',
                        )
                      }
                    >
                      Archive
                    </button>
                    {dirty ? (
                      <button
                        disabled={busy}
                        onClick={() => {
                          localEdits.current.delete(record.contentKey)
                          setLocalDirtyKeys((old) => ({ ...old, [record.contentKey]: false }))
                          setDefinition(editableDefinition(record))
                          setNotice('Local edits discarded.')
                        }}
                      >
                        Discard local edits
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p>Select a record or create new content.</p>
          )}
        </div>
        <aside className={styles.preview} aria-label="Content previews">
          {activeDefinition ? (
            <ContentRecordPreview
              kind={newDefinition ? descriptor!.storedKind : record!.contentKind}
              working={activeDefinition}
              tagPresentations={tagPresentations}
              saved={newDefinition ? null : (record?.draft?.definition ?? null)}
              current={
                newDefinition
                  ? null
                  : (record?.current?.definition ?? record?.builtinDefinition ?? null)
              }
            />
          ) : null}
        </aside>
      </div>
    </section>
  )
}
