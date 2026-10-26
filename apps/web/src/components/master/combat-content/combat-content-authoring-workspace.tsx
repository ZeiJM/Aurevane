'use client'
import { useMemo, useRef, useState } from 'react'
import type { CombatTagPresentationSnapshot } from '@aurevane/game-core/combat/combat-tag-registry'
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
  objectValue,
  type ContentEditorTab,
  type ContentReference,
} from './content-definition-fields'
import {
  contentRecordCommand,
  contentRecordName,
  editableDefinition,
  recordIsDirty,
} from './content-record-workflow'
import { ContentHistory } from './content-history'
import { readableContentReference } from './content-reference-label'
import { MasterHelp } from '../master-help'
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
}: CombatContentAuthoringWorkspaceProps) {
  const [record, setRecord] = useState(initialRecord)
  const [parentKey, setParentKey] = useState<string | null>(null)
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
  const latestEdit = useRef<CombatContentDefinition | null>(null)
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
  const choices = useMemo(
    () => [
      ...new Map(
        [
          ...references,
          ...page.records.map((row) => ({ ...row, name: row.name ?? row.contentKey })),
          ...linkChoices,
        ].map((row) => [row.contentKey, row]),
      ).values(),
    ],
    [references, page.records, linkChoices],
  )
  function change(next: CombatContentDefinition) {
    editRevision.current++
    latestEdit.current = next
    setError('')
    setNotice('')
    if (newDefinition) setNewDefinition(next)
    else {
      setDefinition(next)
      if (record) {
        if (recordIsDirty(record, next)) localEdits.current.set(record.contentKey, next)
        else localEdits.current.delete(record.contentKey)
        setLocalDirtyKeys((old) => ({ ...old, [record.contentKey]: recordIsDirty(record, next) }))
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
      let result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>(command)
      if (command.action === 'create' && result.record.draft) {
        const created = result.record
        const keepLocal = revision !== editRevision.current && latestEdit.current !== null
        if (keepLocal) {
          // Creation assigns the identity; queued edits still belong to that
          // saved record, including an Essence's nested executable Skill.
          const local: CombatContentDefinition = {
            ...latestEdit.current,
            id: created.contentKey,
            ...(created.contentKind === 'essence'
              ? {
                  essenceId: created.contentKey,
                  skill: { ...objectValue(latestEdit.current!.skill), id: created.contentKey },
                }
              : {}),
          }
          latestEdit.current = local
          if (recordIsDirty(created, local)) localEdits.current.set(created.contentKey, local)
          else localEdits.current.delete(created.contentKey)
          setLocalDirtyKeys((old) => ({
            ...old,
            [created.contentKey]: recordIsDirty(created, local),
          }))
        }
        // Adopt the durable draft before the separate commit request. A retry
        // must commit this identity rather than create another child/parent link.
        accept(created, keepLocal)
        setPage({
          records: [
            {
              contentKey: created.contentKey,
              contentKind: created.contentKind,
              lifecycle: created.lifecycle,
              revision: created.revision,
              name: contentRecordName(created.draft!.definition),
            },
          ],
          nextCursor: null,
        })
        setSearch('')
        setLifecycle('')
        setAppliedBrowse(JSON.stringify({ search: '', sort, lifecycle: '' }))
        try {
          result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
            action: 'commit',
            contentKey: created.contentKey,
            expectedRevision: created.revision,
            definition: created.draft!.definition,
          })
        } catch (cause) {
          throw new Error(
            `Created item saved; commit not confirmed. Refresh saved state before retrying. ${cause instanceof Error ? cause.message : 'The commit response is unavailable.'}`,
          )
        }
      }
      const newerEdits = revision !== editRevision.current
      if (newerEdits && latestEdit.current) {
        // A newer value may equal the old saved record, so its dirty-map entry
        // can disappear while the request is pending. Compare it to the new
        // response rather than using dirty-map presence as the editor value.
        const local = latestEdit.current
        const stillDirty = recordIsDirty(result.record, local)
        if (stillDirty) localEdits.current.set(result.record.contentKey, local)
        else localEdits.current.delete(result.record.contentKey)
        setLocalDirtyKeys((old) => ({ ...old, [result.record.contentKey]: stillDirty }))
      }
      accept(result.record, newerEdits)
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
      'Content committed.',
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
              <div className={styles.recordHeading}>
                {parentKey && record?.contentKey !== parentKey ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void read(parentKey)
                      setParentKey(null)
                    }}
                  >
                    Back to Discipline
                  </button>
                ) : null}
                <h2>{contentRecordName(activeDefinition)}</h2>
                <MasterHelp label="Committing content">
                  Commit Now applies the complete record to the game. Existing battles keep their
                  recorded rules.
                </MasterHelp>
              </div>
              <div className={`${styles.actions} ${styles.savebar}`}>
                <span className={styles.status} role="status" aria-label="Content version state">
                  {newDefinition
                    ? 'New content'
                    : dirty
                      ? 'Unsaved changes'
                      : record?.draft
                        ? 'Uncommitted changes'
                        : 'Current'}
                </span>
                {newDefinition ? (
                  <>
                    <button disabled={busy} onClick={() => void create()}>
                      Commit Now
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
                      Cancel new content
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy || readOnly || !!activeDescriptor?.publicationBlocker}
                      title={
                        readOnly
                          ? (record?.authoringBlocker?.message ?? 'This content is archived.')
                          : activeDescriptor?.publicationBlocker?.message
                      }
                      onClick={() =>
                        void mutate(
                          {
                            action: 'commit',
                            contentKey: record!.contentKey,
                            expectedRevision: record!.revision,
                            definition,
                          },
                          'Changes committed and available to the game.',
                        )
                      }
                    >
                      Commit Now
                    </button>
                  </>
                )}
              </div>
              {record?.authoringBlocker || activeDescriptor?.publicationBlocker ? (
                <p role="note">
                  {record?.authoringBlocker?.message ??
                    activeDescriptor?.publicationBlocker?.message}
                </p>
              ) : null}
              <div className={styles.tabs} role="group" aria-label="Editor sections">
                {(
                  [
                    'Parameters',
                    ...(record?.contentKind === 'discipline' ||
                    (newDefinition && category === 'discipline')
                      ? (['Skills', 'Resonances'] as const)
                      : []),
                    'Text',
                    'History',
                    'Identity & Relations',
                  ] as const
                ).map((section) => (
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
              <div className={styles.editorBody}>
                {tab === 'History' && record ? (
                  <ContentHistory
                    record={record}
                    busy={busy}
                    readOnly={readOnly}
                    dirty={dirty}
                    choices={choices}
                    onRestore={(sourceVersion, sourceKind) =>
                      void mutate(
                        {
                          action: 'restore',
                          contentKey: record.contentKey,
                          expectedRevision: record.revision,
                          sourceVersion,
                          ...(sourceKind ? { sourceKind } : {}),
                        },
                        'Previous settings loaded. Review them, then Commit Now to apply.',
                      )
                    }
                  />
                ) : tab === 'Identity & Relations' ? null : (
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
                {tab === 'Resonances' && record?.contentKind === 'discipline' ? (
                  <div className={styles.relatedActions}>
                    {(
                      definition?.resonanceSelections as { resonanceId: string }[] | undefined
                    )?.map(({ resonanceId }) => (
                      <button
                        type="button"
                        key={resonanceId}
                        disabled={busy}
                        onClick={() => {
                          setParentKey(record.contentKey)
                          void read(resonanceId)
                        }}
                      >
                        Edit {readableContentReference(resonanceId, choices, 'resonance')}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!newDefinition && record ? (
                  <>
                    {tab === 'Identity & Relations' ? (
                      <section aria-label="Identity and relationships">
                        <h3>Used in</h3>
                        {record.usedBy.length ? (
                          record.usedBy.map((use, index) => (
                            <p key={`${use.kind}:${use.key}:${index}`}>
                              {readableContentReference(use.key, choices, use.kind)}
                            </p>
                          ))
                        ) : (
                          <p>No recorded references.</p>
                        )}
                        {record.usedByTruncated ? (
                          <p>Additional references exist; archive still checks all dependencies.</p>
                        ) : null}
                      </section>
                    ) : null}
                    {record.contentKind === 'discipline' && tab === 'Skills' ? (
                      <>
                        <h3>Skills in this Discipline</h3>
                        {record.links.map((key) => (
                          <p key={key}>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setParentKey(record.contentKey)
                                void read(key)
                              }}
                            >
                              {readableContentReference(key, choices, 'skill')}
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
                          Add Skill
                        </button>
                      </>
                    ) : null}
                    {tab === 'Identity & Relations' ? (
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
                    ) : null}
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <p>Select a record or create new content.</p>
          )}
        </div>
      </div>
    </section>
  )
}
