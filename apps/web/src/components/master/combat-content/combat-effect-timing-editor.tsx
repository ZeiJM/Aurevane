'use client'
import Link from 'next/link'
import {
  captureCombatTagPresentation,
  type CombatTagPresentationSnapshot,
} from '@aurevane/game-core/combat/combat-tag-registry'
import type { AuthoredTag } from '@aurevane/game-core/content/authored-content'
import { useEffect, useState, type FormEvent } from 'react'
import {
  CONTROLLED_COMBAT_TIMING_TAGS,
  combatEffectTimingMode,
  type CombatEffectTimingPolicy,
  type CombatEffectTimingMode,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { OperationalDialog } from '../operational-dialog'
import { MasterHelp } from '../master-help'
import dynamic from 'next/dynamic'
const ContentRecordModal = dynamic(() =>
  import('./content-record-modal').then((module) => module.ContentRecordModal),
)
import {
  parseWorkspaceRecovery,
  recoveryKey,
  type PendingContentEdit,
} from './content-workspace-recovery'
import { EFFECT_RULE_ROWS } from './effect-rule-rows'
import styles from './combat-effect-timing-editor.module.css'

type UsedBy = Readonly<Record<string, readonly { contentKey: string; name: string }[]>>
export function CombatEffectTimingEditor({
  initialPolicy,
  usedBy = {},
  effectUsedBy,
  tagPresentations = [],
  canEditWording = false,
  recoveryScope,
}: {
  initialPolicy: CombatEffectTimingPolicy
  usedBy?: UsedBy
  effectUsedBy?: UsedBy
  tagPresentations?: readonly CombatTagPresentationSnapshot[]
  canEditWording?: boolean
  recoveryScope?: string
}) {
  const [policy, setPolicy] = useState(initialPolicy)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('name-asc')
  const [wording, setWording] = useState(tagPresentations)
  const [descriptionKey, setDescriptionKey] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, PendingContentEdit>>({})
  const [recoveryReady, setRecoveryReady] = useState(!recoveryScope)
  const storageKey = recoveryScope ? recoveryKey(`${recoveryScope}:tag-wording`) : null
  useEffect(() => {
    let live = true
    queueMicrotask(() => {
      if (!live) return
      if (storageKey) {
        try {
          setPending(parseWorkspaceRecovery(sessionStorage.getItem(storageKey))?.edits ?? {})
        } catch {
          /* Storage is optional; keep the in-memory editor usable. */
        }
      }
      setRecoveryReady(true)
    })
    return () => {
      live = false
    }
  }, [storageKey])
  useEffect(() => {
    if (!storageKey || !recoveryReady) return
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          schema: 1,
          category: 'tag',
          selectedKey: descriptionKey,
          tab: 'Parameters',
          search: '',
          sort: 'name-asc',
          listScroll: 0,
          editorScroll: 0,
          edits: pending,
          newDefinition: null,
        }),
      )
    } catch {
      /* Keep the live draft if browser storage is unavailable. */
    }
  }, [storageKey, recoveryReady, pending, descriptionKey])
  const label = (id: string) =>
    wording.find((row) => row.tagId === id)?.name ??
    EFFECT_RULE_ROWS.find((row) => row.id === id)!.label
  const timingOrder = ['instant', 'next-round', 'delayed', 'controlled']
  const modeFor = (row: (typeof EFFECT_RULE_ROWS)[number]) =>
    row.timingTag ? combatEffectTimingMode(policy, row.timingTag) : 'instant'
  const rows = EFFECT_RULE_ROWS.filter(
    (row) =>
      `${label(row.id)} ${row.id}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || modeFor(row) === filter),
  ).toSorted((a, b) => {
    const order = sort.startsWith('timing')
      ? timingOrder.indexOf(modeFor(a)) - timingOrder.indexOf(modeFor(b))
      : label(a.id).localeCompare(label(b.id))
    return (order || label(a.id).localeCompare(label(b.id))) * (sort.endsWith('desc') ? -1 : 1)
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/master/combat-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      })
      const body = (await response.json()) as {
        policy?: CombatEffectTimingPolicy
        error?: { message?: string }
      }
      if (!response.ok || !body.policy)
        throw new Error(body.error?.message ?? 'Timing changes could not be saved.')
      setPolicy(body.policy)
      setMessage('Timing updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Timing changes could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className={styles.editor} onSubmit={publish}>
      <div className={styles.heading}>
        <h2>Effect tags</h2>
        <MasterHelp label="Effect timing help">
          <p>
            Normal effects activate at the next global round; Delayed effects activate one round
            later. Instant effects apply immediately. Controlled primes a compatible whole Manual
            action for a later release. Existing battles retain their saved rules.
          </p>
          <p>
            Tags that use the same engine operation share timing. Changing a shared timing updates
            its matching rows here. Descriptions are edited independently for each tag.
          </p>
          <p>
            Display order: Instant, Normal, Delayed, Controlled. Sorting does not change execution
            order. Used by reflects the loaded catalogue; Save Changes checks current compatibility
            again.
          </p>
          <p>
            Controlled requires a compatible Manual action. Summon and persistent Ground need
            dedicated release targeting before they can use Controlled.
          </p>
        </MasterHelp>
      </div>
      <div className={styles.controls}>
        <label>
          Search effect tags
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
        </label>
        <label>
          Filter timing
          <select value={filter} onChange={(event) => setFilter(event.currentTarget.value)}>
            <option value="all">All timings</option>
            {timingOrder.map((value, index) => (
              <option key={value} value={value}>
                {['Instant', 'Normal', 'Delayed', 'Controlled'][index]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort effect tags
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="timing-asc">Timing first–last</option>
            <option value="timing-desc">Timing last–first</option>
          </select>
        </label>
      </div>
      <div className={styles.rules} data-edit-wording={canEditWording || undefined}>
        <table>
          <thead>
            <tr>
              <th scope="col">Effect tag</th>
              <th scope="col">Timing</th>
              <th scope="col">Used by</th>
              {canEditWording ? <th scope="col">Description</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const users =
                effectUsedBy && row.id !== 'ground-area'
                  ? (effectUsedBy[row.id] ?? [])
                  : (usedBy[row.id] ?? [])
              return (
                <tr key={row.id}>
                  <th scope="row">
                    <label htmlFor={row.editableTiming ? row.controlId : undefined}>
                      {label(row.id)}
                    </label>
                  </th>
                  <td>
                    {row.editableTiming && row.timingTag ? (
                      <select
                        id={row.controlId}
                        value={modeFor(row)}
                        disabled={saving}
                        title="Timing is shared by tags using the same engine operation."
                        onChange={(event) =>
                          setPolicy({
                            ...policy,
                            modes: {
                              ...policy.modes,
                              [row.timingTag!]: event.currentTarget.value as CombatEffectTimingMode,
                            },
                          })
                        }
                      >
                        <option value="instant">Instant</option>
                        <option value="next-round">Normal</option>
                        <option value="delayed">Delayed</option>
                        <option
                          value="controlled"
                          disabled={!CONTROLLED_COMBAT_TIMING_TAGS.includes(row.timingTag)}
                        >
                          Controlled
                        </option>
                      </select>
                    ) : (
                      <span>{row.id === 'revealed' ? 'Uses Reveal timing' : 'Instant'}</span>
                    )}
                  </td>
                  <td>
                    {users.length ? (
                      <OperationalDialog
                        id={`rule-definitions-${row.id}`}
                        title={`${label(row.id)} definitions`}
                        trigger={`${users.length} current definitions`}
                      >
                        <ul>
                          {users.map((item) => (
                            <li key={item.contentKey}>
                              <Link
                                href={`/master/combat-content?contentKey=${encodeURIComponent(item.contentKey)}&tab=effects`}
                                target="_blank"
                                rel="noopener"
                                aria-label={`Edit ${item.name} effects (opens a new tab)`}
                              >
                                {item.name} ↗
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </OperationalDialog>
                    ) : (
                      'No current definitions'
                    )}
                  </td>
                  {canEditWording ? (
                    <td>
                      {row.id !== 'ground-area' ? (
                        <button
                          type="button"
                          disabled={!recoveryReady}
                          aria-label={`Edit ${label(row.id)} descriptions`}
                          onClick={() => setDescriptionKey(`tag.${row.id}`)}
                        >
                          Edit descriptions
                        </button>
                      ) : (
                        <span>Area policy</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <p role="status">{message}</p>
      {Object.keys(pending).length ? (
        <p>
          {Object.keys(pending).length} uncommitted description{' '}
          {Object.keys(pending).length === 1 ? 'draft' : 'drafts'}. Closing an editor keeps your
          wording.
        </p>
      ) : null}
      {descriptionKey ? (
        <ContentRecordModal
          key={descriptionKey}
          contentKey={descriptionKey}
          choices={[]}
          pending={pending[descriptionKey] ?? null}
          onClose={() => setDescriptionKey(null)}
          onChange={(key, edit) =>
            setPending((previous) => {
              const next = { ...previous }
              if (edit) next[key] = edit
              else delete next[key]
              return next
            })
          }
          onSaved={(record) => {
            if (!record.current) return
            const snapshot = captureCombatTagPresentation(
              record.current.definition as unknown as AuthoredTag,
            )
            setWording((previous) => [
              ...previous.filter((item) => item.tagId !== snapshot.tagId),
              snapshot,
            ])
          }}
        />
      ) : null}
    </form>
  )
}
