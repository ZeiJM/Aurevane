'use client'
import { useRef, useState } from 'react'
import type {
  CombatContentDefinition,
  CompleteCombatContentRecord,
} from '@aurevane/db/combat-content'
import { createRelationshipPowerDraft } from './relationship-power-creation'
import { contentRecordCommand, editableDefinition } from './content-record-workflow'
import { CombatContentAuthoringClientError } from './combat-content-client'

interface Attempt {
  requestId: string
  contentKind: 'essence' | 'resonance'
  definition: CombatContentDefinition
  parentKey: string
  partner: string | null
}
export function NewRelationshipPower({
  parent,
  partner,
  blank,
  recoveryScope,
  disabled,
  onCreated,
  onBusyChange,
}: {
  parent: CompleteCombatContentRecord | null
  partner: string | null
  blank: CombatContentDefinition | null
  recoveryScope: string
  disabled: boolean
  onCreated(record: CompleteCombatContentRecord): void
  onBusyChange(value: boolean): void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retryAvailable, setRetryAvailable] = useState(false)
  const running = useRef(false)
  const attempt = useRef<Attempt | null>(null)
  const kind = partner === null ? 'essence' : 'resonance'
  const label = partner === null ? 'Essence' : 'Resonance'
  const ready = parent?.lifecycle === 'active'
  const storageKey =
    recoveryScope && parent
      ? `master-power-create:v1:${recoveryScope}:${parent.contentKey}:${partner ?? 'essence'}`
      : ''
  async function create() {
    if (!parent || !ready || !blank || disabled || running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setRetryAvailable(false)
    onBusyChange(true)
    let created = false
    let retrying = !!attempt.current
    try {
      if (!attempt.current && storageKey) {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const value = JSON.parse(stored) as Attempt
          if (
            value.parentKey !== parent.contentKey ||
            value.partner !== partner ||
            value.contentKind !== kind ||
            !/^[a-f0-9-]{36}$/i.test(value.requestId) ||
            !value.definition ||
            typeof value.definition !== 'object'
          )
            throw new Error(
              'The pending power creation cannot be recovered. Refresh the workspace.',
            )
          attempt.current = value
          retrying = true
        }
      }
      if (!attempt.current) {
        const requestId = crypto.randomUUID()
        attempt.current = {
          requestId,
          contentKind: kind,
          parentKey: parent.contentKey,
          partner,
          definition: createRelationshipPowerDraft(
            kind,
            blank,
            parent.contentKey,
            partner,
            `${kind}.${requestId}`,
          ),
        }
      }
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(attempt.current))
      const result = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
        action: 'create',
        requestId: attempt.current.requestId,
        contentKind: kind,
        definition: attempt.current.definition,
      })
      created = true
      // A recovered creation receipt can predate a subsequent deletion; open the
      // current record instead of reviving the receipt's original draft body.
      const refreshed = await contentRecordCommand<{ record: CompleteCombatContentRecord | null }>({
        action: 'read',
        contentKey: result.record.contentKey,
      })
      if (
        !refreshed.record ||
        (refreshed.record.contentKey === result.record.contentKey &&
          refreshed.record.lifecycle === 'archived')
      ) {
        attempt.current = null
        if (storageKey) localStorage.removeItem(storageKey)
        throw new Error('The previously created power was deleted. Create a new power to continue.')
      }
      if (
        !refreshed.record ||
        refreshed.record.contentKey !== result.record.contentKey ||
        refreshed.record.lifecycle === 'archived' ||
        refreshed.record.contentKind !== kind
      )
        throw new Error(
          'This power is no longer available. Refresh the Discipline before creating another.',
        )
      const body = editableDefinition(refreshed.record)
      if (
        !body ||
        (kind === 'essence'
          ? body.sourceDisciplineId !== parent.contentKey
          : !Array.isArray(body.disciplinePair) ||
            body.disciplinePair.length !== 2 ||
            !body.disciplinePair.includes(parent.contentKey) ||
            !body.disciplinePair.includes(partner))
      )
        throw new Error('The power relationship changed. Refresh before selecting it.')
      onCreated(refreshed.record)
      attempt.current = null
      if (storageKey) localStorage.removeItem(storageKey)
    } catch (cause) {
      if (
        !retrying &&
        !created &&
        cause instanceof CombatContentAuthoringClientError &&
        ['INVALID_REQUEST', 'STALE_VERSION'].includes(cause.code)
      ) {
        attempt.current = null
        if (storageKey) localStorage.removeItem(storageKey)
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to create this power. Retry to recover the same request.',
      )
      setRetryAvailable(attempt.current !== null)
    } finally {
      running.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={disabled || busy || !ready || !blank}
        onClick={() => void create()}
      >
        {busy ? 'Creating…' : retryAvailable ? 'Retry creation' : `Create new ${label}`}
      </button>
      {!ready ? (
        <p>Commit the Discipline before creating its powers.</p>
      ) : (
        <p>Creates a draft for this relationship and opens its editor.</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
