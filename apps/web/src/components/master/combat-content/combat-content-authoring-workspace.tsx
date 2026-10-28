'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  type ContentEditorTab,
  type ContentReference,
} from './content-definition-fields'
import {
  contentRecordCommand,
  contentRecordName,
  editableDefinition,
  recordIsDirty,
} from './content-record-workflow'
import {
  loadCompleteContentList,
  disciplineMasteryCommit,
  holdContentCommit,
  disciplineSkillCandidates,
  disciplineSkillIsAvailable,
  withDisciplineSkill,
  adoptCreatedContentIdentity,
  freezeCreationAttempt,
  type ContentCreationAttempt,
  parseWorkspaceRecovery,
  recoveryKey,
  type PendingContentEdit,
  type WorkspaceRecovery,
} from './content-workspace-recovery'
import { CombatContentAuthoringClientError } from './combat-content-client'
import { NewDisciplineSkill } from './new-discipline-skill'
import { DeleteDiscipline } from './delete-discipline'
import { NewRelationshipPower } from './new-relationship-power'
import { disciplineRelationshipCommit } from './relationship-power-creation'
import { skillAccuracyForAuthoring } from '@/lib/skill-accuracy-authoring'
import { ContentRecordModal } from './content-record-modal'
import { UsageBalancePanel } from './usage-balance-panel'
import { DisciplinePlayerGrants } from './discipline-player-grants'
import { RelationshipOverrideFields } from './relationship-override-fields'
import {
  DisciplineRelationshipList,
  withDisciplineRelationship,
} from './discipline-relationship-list'
import type { AuthoredDiscipline } from '@aurevane/game-core/content/authored-content'
import styles from './game-content-workspace.module.css'

import type { AbilityEditorSection } from '@/lib/ability-editor-sections'
export interface CombatContentAuthoringWorkspaceProps {
  initialAbilitySection?: AbilityEditorSection
  readonly categories?: readonly CombatContentEditorDescriptor[]
  readonly initialPage?: CombatContentListPage
  readonly initialRecord?: CompleteCombatContentRecord | null
  readonly references?: readonly ContentReference[]
  readonly tagPresentations?: readonly CombatTagPresentationSnapshot[]
  readonly recoveryScope?: string
}
const categoryOf = (record: Pick<CompleteCombatContentRecord, 'contentKind' | 'contentKey'>) =>
  record.contentKind === 'skill' &&
  (BASIC_SKILL_IDS as readonly string[]).includes(record.contentKey)
    ? 'basic'
    : record.contentKind
export const contentDetailsLabel = (kind?: string) =>
  `${kind === 'discipline' ? 'Discipline' : kind === 'skill' || kind === 'basic' ? 'Skill' : kind === 'essence' ? 'Essence' : kind === 'resonance' ? 'Resonance' : kind === 'tag' ? 'Tag' : kind === 'status' ? 'Status' : kind === 'item' ? 'Item' : 'Content'} Details`

export function CombatContentAuthoringWorkspace({
  categories = [],
  initialPage = { records: [], nextCursor: null },
  initialRecord = null,
  references = [],
  recoveryScope = '',
  initialAbilitySection,
}: CombatContentAuthoringWorkspaceProps) {
  const [record, setRecord] = useState(initialRecord)
  const [definition, setDefinition] = useState<CombatContentDefinition | null>(
    initialRecord ? editableDefinition(initialRecord) : null,
  )
  const [category, setCategory] = useState(
    initialRecord ? categoryOf(initialRecord) : (categories[0]?.category ?? 'discipline'),
  )
  const [page, setPage] = useState(initialPage)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<CombatContentSort>('name-asc')
  const [tab, setTab] = useState<ContentEditorTab>('Parameters')
  const [working, setWorking] = useState(false)
  const [modalSaving, setModalSaving] = useState(0)
  const busy = working || modalSaving > 0
  const [restoring, setRestoring] = useState(!!recoveryScope)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newDefinition, setNewDefinition] = useState<CombatContentDefinition | null>(null)
  const latestNewDefinition = useRef<CombatContentDefinition | null>(null)
  const [modalKey, setModalKey] = useState<string | null>(null)
  const [modalRelationship, setModalRelationship] = useState<{ partner: string | null } | null>(
    null,
  )
  const [knownReferences, setKnownReferences] = useState<Record<string, ContentReference | null>>(
    {},
  )
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})
  const [pending, setPendingState] = useState<Record<string, PendingContentEdit>>({})
  const pendingRef = useRef(pending)
  const committingKeys = useRef(new Map<string, number>())
  const [conflict, setConflict] = useState(false)
  const listRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const scroll = useRef({ listScroll: 0, editorScroll: 0 })
  const createRequestId = useRef<string | null>(null)
  const createAttempt = useRef<ContentCreationAttempt | null>(null)
  const loadId = useRef(0)
  const hydrated = useRef(false)
  const recoveryWarning = useRef(false)
  const recoverySnapshot = useRef<WorkspaceRecovery | null>(null)
  const persistenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialProps = useRef({ categories, initialPage, initialRecord })
  const storageKey = recoveryKey(recoveryScope)
  const descriptor = categories.find((row) => row.category === category)
  const activeKind = newDefinition ? descriptor?.storedKind : record?.contentKind
  const rawActiveDefinition = newDefinition ?? definition
  const activeDefinition =
    rawActiveDefinition && activeKind
      ? skillAccuracyForAuthoring(activeKind, rawActiveDefinition)
      : rawActiveDefinition
  const readOnly =
    !newDefinition && (!!record?.authoringBlocker || record?.lifecycle === 'archived')
  const dirty = !!record && !!definition && recordIsDirty(record, definition)
  const choices = useMemo(
    () =>
      [
        ...new Map(
          [
            ...references,
            ...Object.values(knownReferences).filter(
              (row): row is ContentReference => row !== null,
            ),
            ...page.records.map((row) => ({ ...row, name: row.name ?? row.contentKey })),
          ].map((row) => [row.contentKey, row]),
        ).values(),
      ]
        .filter((row) => knownReferences[row.contentKey] !== null)
        .map((row) => ({ ...row, name: nameOverrides[row.contentKey] ?? row.name })),
    [references, page.records, nameOverrides, knownReferences],
  )
  function pendingEdit(key: string, edit: PendingContentEdit | null) {
    const next = { ...pendingRef.current }
    if (edit) next[key] = edit
    else delete next[key]
    pendingRef.current = next
    setPendingState(next)
  }
  function remember(next: CompleteCombatContentRecord) {
    const body = editableDefinition(next)
    setKnownReferences((old) => ({
      ...old,
      [next.contentKey]:
        next.lifecycle === 'archived'
          ? null
          : {
              contentKey: next.contentKey,
              contentKind: next.contentKind,
              name: body ? contentRecordName(body) : next.contentKey,
              ...(typeof body?.sourceDisciplineId === 'string'
                ? { sourceDisciplineId: body.sourceDisciplineId }
                : {}),
              ...(Array.isArray(body?.disciplinePair)
                ? { disciplinePair: body.disciplinePair as string[] }
                : {}),
            },
    }))
  }
  function accept(next: CompleteCombatContentRecord) {
    remember(next)
    let local: PendingContentEdit | undefined = pendingRef.current[next.contentKey]
    if (local && (next.lifecycle === 'archived' || !recordIsDirty(next, local.definition))) {
      pendingEdit(next.contentKey, null)
      local = undefined
    }
    setRecord(next)
    setCategory(categoryOf(next))
    setNewDefinition(null)
    latestNewDefinition.current = null
    createRequestId.current = null
    createAttempt.current = null
    setDefinition(local?.definition ?? editableDefinition(next))
    setConflict(!!local && local.revision !== next.revision)
  }
  function change(next: CombatContentDefinition) {
    setError('')
    setNotice('')
    if (newDefinition) {
      latestNewDefinition.current = next
      setNewDefinition(next)
    } else {
      setDefinition(next)
      if (record)
        pendingEdit(
          record.contentKey,
          recordIsDirty(record, next) || committingKeys.current.has(record.contentKey)
            ? {
                revision: pendingRef.current[record.contentKey]?.revision ?? record.revision,
                definition: next,
              }
            : null,
        )
    }
  }
  async function work(fn: () => Promise<void>) {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      await fn()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to complete this operation.')
    } finally {
      setWorking(false)
    }
  }
  async function read(key: string, nextTab: ContentEditorTab = 'Parameters') {
    await work(async () => {
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord | null }>({
        action: 'read',
        contentKey: key,
      })
      if (!result.record) throw new Error('This content is no longer available.')
      accept(result.record)
      setTab(nextTab)
      editorRef.current?.scrollTo({ top: 0 })
    })
  }
  async function list(nextCategory = category, nextSearch = search, nextSort = sort) {
    const selected = categories.find((row) => row.category === nextCategory)
    return loadCompleteContentList((after) =>
      contentRecordCommand<CombatContentListPage>({
        action: 'list',
        kind: selected?.storedKind,
        ...(nextCategory === 'basic'
          ? { category: 'basic' }
          : nextCategory === 'skill'
            ? { category: 'discipline-skill' }
            : {}),
        search: nextSearch,
        sort: nextSort,
        limit: 100,
        ...(after ? { after } : {}),
      }),
    )
  }
  async function browse(nextCategory = category) {
    const id = ++loadId.current
    await work(async () => {
      const result = await list(nextCategory)
      if (id !== loadId.current) return
      setPage(result)
      setCategory(nextCategory)
      if (nextCategory !== category) {
        setRecord(null)
        setDefinition(null)
        setNewDefinition(null)
        setTab('Parameters')
      }
      listRef.current?.scrollTo({ top: 0 })
    })
  }
  async function commitSaved(source: CompleteCombatContentRecord, body: CombatContentDefinition) {
    const finishCommit = holdContentCommit(committingKeys.current, source.contentKey)
    try {
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
        action: 'commit',
        contentKey: source.contentKey,
        expectedRevision: source.revision,
        definition: body,
      })
      const latest = pendingRef.current[source.contentKey]
      if (
        !latest ||
        JSON.stringify(latest.definition) === JSON.stringify(body) ||
        !recordIsDirty(result.record, latest.definition)
      )
        pendingEdit(source.contentKey, null)
      else
        pendingEdit(source.contentKey, {
          revision: result.record.revision,
          definition: latest.definition,
        })
      return result.record
    } finally {
      finishCommit()
    }
  }
  async function commit() {
    if (!activeDefinition || !descriptor || conflict) return
    await work(async () => {
      let saved: CompleteCombatContentRecord
      if (newDefinition) {
        const submitted = structuredClone(newDefinition)
        const retryingUncertainCreation = createAttempt.current !== null
        const attempt = freezeCreationAttempt(
          createAttempt.current,
          createRequestId.current ?? (createRequestId.current = crypto.randomUUID()),
          descriptor.storedKind,
          submitted,
        )
        createAttempt.current = attempt
        flushRecovery()
        let result: { record: CompleteCombatContentRecord }
        try {
          result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
            action: 'create',
            requestId: attempt.requestId,
            contentKind: attempt.contentKind,
            definition: attempt.definition,
          })
        } catch (cause) {
          // Initial authoring validation is definitive: it runs before any record write.
          // An uncertain prior attempt must retain its fingerprint even if a later
          // replay is rejected after the catalogue changes.
          if (
            !retryingUncertainCreation &&
            cause instanceof CombatContentAuthoringClientError &&
            cause.code === 'INVALID_REQUEST'
          ) {
            createAttempt.current = null
            createRequestId.current = null
            flushRecovery()
          }
          throw cause
        }
        // Adopt the assigned identity before committing, so a failed second request cannot duplicate it.
        saved = result.record
        const newer = latestNewDefinition.current
        if (newer) {
          const adopted = adoptCreatedContentIdentity(newer, saved.contentKey, saved.contentKind)
          if (recordIsDirty(saved, adopted))
            pendingEdit(saved.contentKey, { revision: saved.revision, definition: adopted })
        }
        accept(saved)
        const intent = adoptCreatedContentIdentity(submitted, saved.contentKey, saved.contentKind)
        if (saved.draft || recordIsDirty(saved, intent)) saved = await commitSaved(saved, intent)
      } else {
        if (!record) return
        saved = await commitSaved(record, activeDefinition)
      }
      accept(saved)
      setNotice(
        pendingRef.current[saved.contentKey]
          ? 'Saved; newer local edits remain uncommitted.'
          : 'Changes committed and available to the game.',
      )
      try {
        setPage(await list(categoryOf(saved)))
      } catch {
        setError('Content was committed, but the list could not refresh. Your editor is retained.')
      }
    })
  }
  function flushRecovery() {
    if (!storageKey || !hydrated.current || !recoverySnapshot.current) return
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          ...recoverySnapshot.current,
          ...scroll.current,
          edits: pendingRef.current,
          createAttempt: createAttempt.current,
        }),
      )
    } catch {
      if (!recoveryWarning.current) {
        recoveryWarning.current = true
        setError(
          'Browser recovery storage is unavailable or full. Keep this tab open until you commit your edits.',
        )
      }
    }
  }
  function scheduleRecovery() {
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current)
    persistenceTimer.current = setTimeout(flushRecovery, 250)
  }
  useEffect(() => {
    if (!storageKey) {
      hydrated.current = true
      return
    }
    let live = true
    queueMicrotask(async () => {
      if (!live) return
      let saved: WorkspaceRecovery | null = null
      try {
        saved = parseWorkspaceRecovery(sessionStorage.getItem(storageKey))
      } catch {
        if (live)
          setError(
            'Refresh recovery is unavailable in this browser. Keep this tab open until you commit.',
          )
      }
      if (saved) {
        pendingRef.current = saved.edits
        setPendingState(saved.edits)
        setCategory(saved.category as typeof category)
        setSearch(saved.search)
        setSort(saved.sort)
        setTab(saved.tab as ContentEditorTab)
        scroll.current = { listScroll: saved.listScroll, editorScroll: saved.editorScroll }
        setNewDefinition(saved.newDefinition)
        latestNewDefinition.current = saved.newDefinition
        createRequestId.current = saved.newRequestId ?? saved.createAttempt?.requestId ?? null
        createAttempt.current = saved.createAttempt ?? null
        if (!saved.selectedKey) {
          setRecord(null)
          setDefinition(null)
        }
      }
      const props = initialProps.current
      const cat =
        saved?.category ??
        (props.initialRecord
          ? categoryOf(props.initialRecord)
          : (props.categories[0]?.category ?? 'discipline'))
      const selected = props.categories.find((row) => row.category === cat)
      try {
        const result = await loadCompleteContentList((after) =>
          contentRecordCommand<CombatContentListPage>({
            action: 'list',
            kind: selected?.storedKind,
            ...(cat === 'basic'
              ? { category: 'basic' }
              : cat === 'skill'
                ? { category: 'discipline-skill' }
                : {}),
            search: saved?.search ?? '',
            sort: saved?.sort ?? 'name-asc',
            limit: 100,
            ...(after ? { after } : {}),
          }),
        )
        if (!live) return
        setPage(result)
        if (saved?.selectedKey) {
          const response = await contentRecordCommand<{
            record: CompleteCombatContentRecord | null
          }>({ action: 'read', contentKey: saved.selectedKey })
          if (!live) return
          if (response.record) {
            let local: PendingContentEdit | undefined =
              pendingRef.current[response.record.contentKey]
            if (local && !recordIsDirty(response.record, local.definition)) {
              const edits = { ...pendingRef.current }
              delete edits[response.record.contentKey]
              pendingRef.current = edits
              setPendingState(edits)
              local = undefined
            }
            setRecord(response.record)
            setDefinition(local?.definition ?? editableDefinition(response.record))
            setConflict(!!local && local.revision !== response.record.revision)
            if (local) setNotice('Your uncommitted edits were recovered.')
          }
        }
        requestAnimationFrame(() => {
          if (!live) return
          if (listRef.current) listRef.current.scrollTop = scroll.current.listScroll
          if (editorRef.current) editorRef.current.scrollTop = scroll.current.editorScroll
        })
      } catch (cause) {
        if (live)
          setError(cause instanceof Error ? cause.message : 'Unable to restore this workspace.')
      } finally {
        if (live) {
          hydrated.current = true
          setRestoring(false)
        }
      }
    })
    return () => {
      live = false
    }
  }, [storageKey])
  useEffect(() => {
    recoverySnapshot.current = {
      schema: 1,
      category,
      selectedKey: record?.contentKey ?? null,
      tab,
      search,
      sort,
      ...scroll.current,
      edits: pending,
      newDefinition,
      newRequestId: createRequestId.current,
      createAttempt: createAttempt.current,
    }
    if (!storageKey) return
    const timer = setTimeout(() => {
      if (hydrated.current && recoverySnapshot.current) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(recoverySnapshot.current))
        } catch {
          setError(
            'Browser recovery storage is unavailable or full. Keep this tab open until you commit your edits.',
          )
        }
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [storageKey, category, record?.contentKey, tab, search, sort, pending, newDefinition])
  useEffect(() => {
    if (!storageKey) return
    const save = () => {
      if (hydrated.current && recoverySnapshot.current) {
        try {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              ...recoverySnapshot.current,
              ...scroll.current,
              edits: pendingRef.current,
              createAttempt: createAttempt.current,
            }),
          )
        } catch {
          /* The visible editor already reports storage failures. */
        }
      }
    }
    window.addEventListener('pagehide', save)
    window.addEventListener('beforeunload', save)
    return () => {
      save()
      window.removeEventListener('pagehide', save)
      window.removeEventListener('beforeunload', save)
    }
  }, [storageKey])
  const skills =
    activeKind === 'discipline' && activeDefinition
      ? disciplineSkillCandidates(activeDefinition, choices, record?.links ?? [])
      : []
  const disciplineSkillModal =
    !!record &&
    !newDefinition &&
    activeKind === 'discipline' &&
    !!modalKey &&
    skills.includes(modalKey)
  return (
    <section
      className={styles.workspace}
      aria-label="Game Content workspace"
      aria-busy={restoring || busy}
    >
      {restoring ? <p role="status">Restoring your workspace…</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}{' '}
          {record && !newDefinition ? (
            <button
              type="button"
              disabled={restoring || busy}
              onClick={() => void read(record.contentKey, tab)}
            >
              Refresh saved state
            </button>
          ) : null}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      <div className={styles.columns}>
        <aside className={styles.sidebar} aria-label="Content browser">
          <label>
            Category
            <select
              aria-label="Content category"
              value={category}
              disabled={restoring || busy || !!newDefinition}
              onChange={(event) => void browse(event.currentTarget.value as typeof category)}
            >
              {categories.map((row) => (
                <option key={row.category} value={row.category}>
                  {row.group === 'Skills' ? `Skills · ${row.label}` : row.label}
                </option>
              ))}
            </select>
          </label>
          <nav
            ref={listRef}
            aria-label="Content records"
            className={styles.list}
            onScroll={(event) => {
              scroll.current.listScroll = event.currentTarget.scrollTop
              scheduleRecovery()
            }}
          >
            {page.records.map((row) => (
              <button
                type="button"
                key={row.contentKey}
                data-content-key={row.contentKey}
                aria-current={record?.contentKey === row.contentKey && !newDefinition}
                disabled={restoring || busy || !!newDefinition}
                onClick={() => void read(row.contentKey)}
              >
                {row.name ?? row.contentKey}
                {pending[row.contentKey] ? <small>Unsaved edits</small> : null}
              </button>
            ))}
            {!page.records.length ? <p>No matching content.</p> : null}
          </nav>
          <form
            className={styles.toolbar}
            onSubmit={(event) => {
              event.preventDefault()
              void browse()
            }}
          >
            <label>
              Search content
              <input
                type="search"
                disabled={restoring || busy}
                maxLength={160}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </label>
            <div className={styles.searchActions}>
              <label>
                Sort
                <select
                  aria-label="Sort content"
                  disabled={restoring || busy}
                  value={sort}
                  onChange={(event) => setSort(event.currentTarget.value as CombatContentSort)}
                >
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                </select>
              </label>
              <button disabled={restoring || busy || !!newDefinition}>Search</button>
            </div>
            <div className={styles.actions}>
              <div className={styles.commitControls}>
                <button
                  type="button"
                  className={styles.commit}
                  disabled={
                    restoring ||
                    busy ||
                    !activeDefinition ||
                    readOnly ||
                    conflict ||
                    !!descriptor?.publicationBlocker
                  }
                  onClick={() => void commit()}
                >
                  {busy ? 'Working…' : 'Commit Now'}
                </button>
                <span className={styles.saveStatus} role="status" aria-label="Save status">
                  {newDefinition
                    ? 'New content'
                    : dirty
                      ? 'Unsaved changes'
                      : record?.draft
                        ? 'Uncommitted changes'
                        : 'Saved'}
                </span>
              </div>
              {category !== 'tag' && (
                <button
                  type="button"
                  disabled={restoring || busy || !!newDefinition || !descriptor?.defaultDefinition}
                  onClick={() => {
                    createRequestId.current = crypto.randomUUID()
                    createAttempt.current = null
                    const next = structuredClone(descriptor!.defaultDefinition!)
                    latestNewDefinition.current = next
                    setNewDefinition(next)
                    setTab('Parameters')
                    setError('')
                  }}
                >
                  New
                </button>
              )}
            </div>
            {newDefinition ? (
              <button
                type="button"
                disabled={restoring || busy}
                onClick={() => {
                  createRequestId.current = null
                  createAttempt.current = null
                  latestNewDefinition.current = null
                  setNewDefinition(null)
                }}
              >
                Discard new content
              </button>
            ) : null}
          </form>
        </aside>
        <div className={styles.editor}>
          {activeDefinition ? (
            <>
              <header className={styles.recordHeading}>
                <h2>{contentRecordName(activeDefinition)}</h2>
                {!newDefinition && record?.contentKind === 'discipline' && !readOnly ? (
                  <DeleteDiscipline
                    key={record.contentKey}
                    contentKey={record.contentKey}
                    name={contentRecordName(activeDefinition)}
                    disabled={busy || restoring}
                    onBusyChange={setWorking}
                    onDeleted={(keys) => {
                      for (const key of keys) pendingEdit(key, null)
                      setKnownReferences((old) => ({
                        ...old,
                        ...Object.fromEntries(keys.map((key) => [key, null])),
                      }))
                      setPage((old) => ({
                        ...old,
                        records: old.records.filter((row) => !keys.includes(row.contentKey)),
                      }))
                      setRecord(null)
                      setDefinition(null)
                      setModalKey(null)
                      setModalRelationship(null)
                      setConflict(false)
                      if (recoverySnapshot.current)
                        recoverySnapshot.current = {
                          ...recoverySnapshot.current,
                          selectedKey: null,
                          edits: pendingRef.current,
                        }
                      flushRecovery()
                      setNotice('Discipline deleted. Saved battle history is retained.')
                    }}
                  />
                ) : null}
              </header>
              {conflict && record ? (
                <div className={styles.error} role="alert">
                  This content changed after your recovered edits. Review the latest saved settings
                  before committing.
                  <div className={styles.actions}>
                    <button
                      onClick={() => {
                        pendingEdit(record.contentKey, null)
                        setDefinition(editableDefinition(record))
                        setConflict(false)
                      }}
                    >
                      Use saved settings
                    </button>
                    <button
                      onClick={() => {
                        if (definition)
                          pendingEdit(record.contentKey, { revision: record.revision, definition })
                        setConflict(false)
                      }}
                    >
                      Keep my recovered edits
                    </button>
                  </div>
                </div>
              ) : null}
              {record?.authoringBlocker || descriptor?.publicationBlocker ? (
                <p role="note">
                  {record?.authoringBlocker?.message ?? descriptor?.publicationBlocker?.message}
                </p>
              ) : null}
              <div className={styles.tabs} role="group" aria-label="Editor sections">
                {(
                  [
                    'Parameters',
                    ...(activeKind === 'discipline' ? ['Media', 'Skills', 'Resonances'] : []),
                    'Usage & Balance',
                  ] as ContentEditorTab[]
                ).map((section) => (
                  <button
                    key={section}
                    aria-pressed={tab === section}
                    disabled={restoring || busy}
                    onClick={() => setTab(section)}
                  >
                    {section === 'Parameters'
                      ? contentDetailsLabel(category)
                      : section === 'Media' && activeKind === 'discipline'
                        ? 'Artwork'
                        : section}
                  </button>
                ))}
              </div>
              <div
                ref={editorRef}
                className={styles.editorBody}
                onScroll={(event) => {
                  scroll.current.editorScroll = event.currentTarget.scrollTop
                  scheduleRecovery()
                }}
              >
                {tab === 'Usage & Balance' ? (
                  record ? (
                    <UsageBalancePanel contentKey={record.contentKey} />
                  ) : (
                    <p>Commit the new item to see usage statistics.</p>
                  )
                ) : tab === 'Skills' ? (
                  <>
                    <NewDisciplineSkill
                      key={record?.contentKey ?? 'new'}
                      parent={newDefinition ? null : record}
                      count={skills.length}
                      choices={choices.filter(
                        (row) =>
                          row.contentKind === 'skill' &&
                          !(BASIC_SKILL_IDS as readonly string[]).includes(row.contentKey),
                      )}
                      blank={
                        categories.find((row) => row.category === 'skill')?.defaultDefinition ??
                        null
                      }
                      disabled={restoring || busy || readOnly}
                      recoveryScope={recoveryScope}
                      onBusyChange={(active) =>
                        setModalSaving((count) => Math.max(0, count + (active ? 1 : -1)))
                      }
                      onCreated={(child, parent) => {
                        const body =
                          pendingRef.current[parent.contentKey]?.definition ?? activeDefinition
                        remember(child)
                        if (body)
                          pendingEdit(parent.contentKey, {
                            revision: parent.revision,
                            definition: withDisciplineSkill(body, child.contentKey, true),
                          })
                        accept(parent)
                        setTab('Skills')
                        setModalKey(child.contentKey)
                        setModalRelationship(null)
                      }}
                    />
                    <section className={styles.relatedList} aria-label="Discipline skills">
                      {skills.map((key) => (
                        <div key={key}>
                          <button
                            type="button"
                            disabled={restoring || busy}
                            onClick={() => {
                              setModalRelationship(null)
                              setModalKey(key)
                            }}
                          >
                            {choices.find((row) => row.contentKey === key)?.name ?? key}
                            <span aria-hidden="true">Edit →</span>
                          </button>
                          {activeDefinition &&
                          !disciplineSkillIsAvailable(activeDefinition, key) ? (
                            <small>Not available in this Discipline</small>
                          ) : null}
                          {pending[key] ? <small>Uncommitted skill changes</small> : null}
                        </div>
                      ))}
                      {!skills.length ? <p>No Skills yet. Create the first Skill above.</p> : null}
                    </section>
                  </>
                ) : tab === 'Resonances' ? (
                  <section aria-label="Discipline relationships">
                    <fieldset disabled={restoring || readOnly}>
                      <RelationshipOverrideFields
                        value={activeDefinition as unknown as AuthoredDiscipline}
                        onChange={(next) => change(next as unknown as CombatContentDefinition)}
                        choices={choices
                          .filter((row) => row.contentKind === 'discipline')
                          .map((row) => ({ id: row.contentKey, label: row.name }))}
                      />
                    </fieldset>
                    <DisciplineRelationshipList
                      value={activeDefinition as unknown as AuthoredDiscipline}
                      choices={choices}
                      onChange={(next) => change(next as unknown as CombatContentDefinition)}
                      onEdit={(key, partner) => {
                        setModalRelationship({ partner })
                        setModalKey(key)
                      }}
                      renderCreate={(partner, close) => (
                        <NewRelationshipPower
                          parent={newDefinition ? null : record}
                          partner={partner}
                          blank={
                            categories.find(
                              (row) =>
                                row.category === (partner === null ? 'essence' : 'resonance'),
                            )?.defaultDefinition ?? null
                          }
                          recoveryScope={recoveryScope}
                          disabled={restoring || busy || readOnly}
                          onBusyChange={setWorking}
                          onCreated={(child) => {
                            remember(child)
                            change(
                              withDisciplineRelationship(
                                activeDefinition as unknown as AuthoredDiscipline,
                                partner,
                                child.contentKey,
                              ) as unknown as CombatContentDefinition,
                            )
                            close()
                            setModalRelationship({ partner })
                            setModalKey(child.contentKey)
                          }}
                        />
                      )}
                      disabled={restoring || busy || readOnly}
                    />
                  </section>
                ) : (
                  <fieldset disabled={restoring || readOnly}>
                    <ContentDefinitionFields
                      initialAbilitySection={
                        record?.contentKey === initialRecord?.contentKey
                          ? initialAbilitySection
                          : undefined
                      }
                      kind={newDefinition ? descriptor!.storedKind : record!.contentKind}
                      value={activeDefinition}
                      tab="Parameters"
                      onChange={change}
                      choices={choices}
                    />
                    {record?.contentKind === 'discipline' ? (
                      <DisciplinePlayerGrants disciplineId={record.contentKey} />
                    ) : null}
                  </fieldset>
                )}
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              <h2>Your content workspace</h2>
              <p>Select an item from the list to edit it.</p>
            </div>
          )}
        </div>
      </div>
      {modalKey ? (
        <ContentRecordModal
          availableInDiscipline={
            disciplineSkillModal && activeDefinition
              ? disciplineSkillIsAvailable(activeDefinition, modalKey)
              : undefined
          }
          disciplineSettingsDisabled={restoring || working || readOnly}
          onAvailabilityChange={(available) => {
            if (disciplineSkillModal && activeDefinition && !restoring && !working && !readOnly)
              change(withDisciplineSkill(activeDefinition, modalKey, available))
          }}
          masteryStage={
            disciplineSkillModal
              ? ((
                  activeDefinition?.skillStages as
                    { skillId: string; minimumStage: number }[] | undefined
                )?.find((row) => row.skillId === modalKey)?.minimumStage ?? 1)
              : undefined
          }
          onMasteryChange={(stage) => {
            if (disciplineSkillModal && activeDefinition && !restoring && !working && !readOnly)
              change(withDisciplineSkill(activeDefinition, modalKey, true, stage))
          }}
          onCommitStart={() => {
            setModalSaving((count) => count + 1)
            const finishParent =
              (disciplineSkillModal || modalRelationship) && record
                ? holdContentCommit(committingKeys.current, record.contentKey)
                : () => {}
            let active = true
            return () => {
              if (!active) return
              active = false
              finishParent()
              setModalSaving((count) => Math.max(0, count - 1))
            }
          }}
          onCommitRelated={async () => {
            // This closure captures the association reviewed when Commit Now was
            // pressed; newer parent edits are rebased by commitSaved and kept local.
            if ((!disciplineSkillModal && !modalRelationship) || !record || !activeDefinition)
              return !!newDefinition || !!(record && pendingRef.current[record.contentKey])
            const base = editableDefinition(record)
            if (!base) return !!pendingRef.current[record.contentKey]
            const patch = disciplineSkillModal
              ? disciplineMasteryCommit(base, activeDefinition, modalKey)
              : disciplineRelationshipCommit(
                  base,
                  activeDefinition,
                  modalKey,
                  modalRelationship!.partner,
                )
            if (!patch) {
              const local = pendingRef.current[record.contentKey]
              if (local && !recordIsDirty(record, local.definition))
                pendingEdit(record.contentKey, null)
              return !!pendingRef.current[record.contentKey]
            }
            if (conflict) throw new Error('Review the recovered discipline edits first.')
            if (readOnly)
              throw new Error(
                'This discipline is read-only; its availability and mastery remain uncommitted.',
              )
            accept(await commitSaved(record, patch))
            return !!pendingRef.current[record.contentKey]
          }}
          contentKey={modalKey}
          choices={choices}
          pending={pending[modalKey] ?? null}
          onChange={(key, edit) => pendingEdit(key, edit)}
          onClose={() => {
            setModalKey(null)
            setModalRelationship(null)
          }}
          onSaved={(saved) => {
            remember(saved)
            setNameOverrides((old) => ({
              ...old,
              [saved.contentKey]: contentRecordName(
                editableDefinition(saved) ?? { id: saved.contentKey },
              ),
            }))
            if (saved.contentKey === record?.contentKey) accept(saved)
          }}
        />
      ) : null}
    </section>
  )
}
