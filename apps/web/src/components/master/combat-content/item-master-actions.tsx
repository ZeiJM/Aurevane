'use client'
import { useEffect, useRef, useState } from 'react'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { contentRecordCommand } from './content-record-workflow'
import type { CharacterItemsView } from '@/server/character/character-items-service'
import type { ItemGrantCharacter, ItemGrantRequest, ItemGrantTarget } from '@/master/item-grant'
import styles from './item-master-actions.module.css'
import {
  TARGET_ITEM_GRANT_ENDPOINT as targetEndpoint,
  SELF_ITEM_GRANT_ENDPOINT as selfEndpoint,
  itemGrantRecoveryKey,
  parsePreparedItemGrant,
  type PreparedItemGrant as PreparedGrant,
} from './item-grant-recovery'

type TargetGrant = Extract<ItemGrantRequest, { action: 'grant' }>
export function ItemMasterActions({
  record,
  disabled,
  onDuplicated,
  recoveryScope = '',
}: {
  record: CompleteCombatContentRecord
  disabled: boolean
  onDuplicated(record: CompleteCombatContentRecord): void
  recoveryScope?: string
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [quantity, setQuantity] = useState(1),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<readonly ItemGrantCharacter[]>([]),
    [selected, setSelected] = useState<ItemGrantCharacter | null>(null),
    [grant, setGrant] = useState<PreparedGrant | null>(null),
    [recovering, setRecovering] = useState(!!recoveryScope)
  const duplication = useRef<string | null>(null)
  const working = useRef(false)
  const pendingGrant = useRef<PreparedGrant | null>(null)
  const uncertain = useRef(false)
  const recovered = useRef(!recoveryScope)
  const recoveryKey = itemGrantRecoveryKey(recoveryScope)
  useEffect(() => {
    if (!recoveryKey) return
    let mounted = true
    // Browser storage becomes available after hydration; commands stay blocked
    // until this restoration callback completes for this mounted toolbar.
    void Promise.resolve().then(() => {
      if (!mounted) return
      try {
        const raw = window.sessionStorage.getItem(recoveryKey)
        const saved = parsePreparedItemGrant(raw)
        if (raw && !saved) throw new Error('The saved grant request could not be restored.')
        pendingGrant.current = saved
        uncertain.current = !!saved
        setGrant(saved)
        if (saved)
          setMessage(
            `A previous grant for ${saved.itemName} to ${saved.recipient} needs an explicit retry.`,
          )
        recovered.current = true
        setRecovering(false)
      } catch {
        setMessage(
          'Could not restore the pending Item grant. Restore session storage and reload before granting.',
        )
      }
    })
    return () => {
      mounted = false
    }
  }, [recoveryKey])
  const current = record.current?.definition ?? record.builtinDefinition
  const available = current?.schemaVersion === 2 && current.enabled === true
  const maximum = current?.inventoryCategory === 'gear' ? 1 : 99
  const unresolved = !!query.trim() && !selected
  function rememberGrant(next: PreparedGrant | null) {
    if (recoveryKey) {
      try {
        const raw = window.sessionStorage.getItem(recoveryKey)
        const saved = parsePreparedItemGrant(raw)
        if (raw && !saved) throw new Error('Invalid pending grant')
        if (next) {
          if (saved && saved.body.requestId !== next.body.requestId) {
            pendingGrant.current = saved
            uncertain.current = true
            setGrant(saved)
            throw new Error('Another grant is pending')
          }
          window.sessionStorage.setItem(recoveryKey, JSON.stringify(next))
        } else if (saved?.body.requestId === pendingGrant.current?.body.requestId) {
          // A late response from an unmounted toolbar must not erase a newer receipt.
          window.sessionStorage.removeItem(recoveryKey)
        }
      } catch {
        if (next && !pendingGrant.current)
          throw new Error(
            'Could not preserve the Item grant request. Enable session storage before granting; no grant was sent.',
          )
        throw new Error(
          'Could not preserve the Item grant request. Restore session storage, then retry the same pending request.',
        )
      }
    }
    pendingGrant.current = next
    setGrant(next)
    if (!next) uncertain.current = false
  }
  async function duplicate() {
    if (disabled || !recovered.current || working.current || pendingGrant.current) return
    working.current = true
    setBusy(true)
    setMessage('')
    try {
      const { record: copy } = await contentRecordCommand<{ record: CompleteCombatContentRecord }>({
        action: 'duplicate',
        sourceKey: record.contentKey,
        expectedSourceRevision: record.revision,
        requestId: duplication.current ?? (duplication.current = crypto.randomUUID()),
      })
      duplication.current = null
      onDuplicated(copy)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not duplicate Item.')
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  async function search() {
    if (
      disabled ||
      !recovered.current ||
      working.current ||
      pendingGrant.current ||
      query.trim().length < 2
    )
      return
    working.current = true
    setBusy(true)
    setMessage('')
    setSelected(null)
    setResults([])
    try {
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: query.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not find characters.')
      const characters = data.characters as readonly ItemGrantCharacter[]
      setResults(characters)
      setMessage(characters.length ? 'Choose a matching character.' : 'No characters found.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not find characters.')
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  async function testGrant() {
    if (
      !recovered.current ||
      working.current ||
      (!pendingGrant.current && (disabled || !available))
    )
      return
    if (!pendingGrant.current && unresolved) {
      setMessage('Find and select a character before granting this Item.')
      return
    }
    working.current = true
    setBusy(true)
    setMessage('')
    const retryingUncertain = uncertain.current
    try {
      let request = pendingGrant.current
      if (!request) {
        let view: ItemGrantTarget | CharacterItemsView
        if (selected) {
          const response = await fetch(targetEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read', characterId: selected.characterId }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error?.message ?? 'Could not load this character.')
          view = data as ItemGrantTarget
          if (view.target.characterId !== selected.characterId)
            throw new Error('The selected character changed. Find the character again.')
        } else {
          const response = await fetch('/api/character/items', { cache: 'no-store' })
          const data = await response.json()
          if (!response.ok)
            throw new Error(data.error?.message ?? 'Could not load your selected character.')
          view = data.view as CharacterItemsView
        }
        if (view.battleLocked)
          throw new Error('Items cannot change during a pending or active battle.')
        const body: Omit<TargetGrant, 'action'> = {
          characterId: 'target' in view ? view.target.characterId : view.characterId,
          itemId: record.contentKey,
          quantity: Math.min(quantity, maximum),
          expectedRevision: view.revision,
          catalogueToken: view.catalogueToken,
          requestId: crypto.randomUUID(),
        }
        request = {
          endpoint: selected ? targetEndpoint : selfEndpoint,
          body: selected ? { action: 'grant', ...body } : body,
          recipient: 'target' in view ? view.target.name : 'your selected character',
          itemName: String(current?.name ?? record.contentKey),
        }
        // The immutable request survives network/5xx uncertainty. A retry sends
        // this exact endpoint and body, without another read or a new receipt ID.
        rememberGrant(request)
      }
      const response = await fetch(request.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      })
      if (response.status >= 400 && response.status < 500 && !retryingUncertain) rememberGrant(null)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message ?? 'The Item grant failed.')
      rememberGrant(null)
      setMessage(`Item granted to ${request.recipient}: ${request.itemName}.`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not grant the Item.'
      if (pendingGrant.current) uncertain.current = true
      setMessage(
        pendingGrant.current
          ? `${detail} Outcome uncertain; restore the original account and selected character, then Retry grant with the same request.`
          : detail,
      )
    } finally {
      working.current = false
      setBusy(false)
    }
  }
  return (
    <section aria-label="Item authoring actions" className={styles.actions} aria-busy={busy}>
      <div className={styles.toolbar}>
        <button
          type="button"
          disabled={disabled || recovering || busy || !!grant}
          onClick={() => void duplicate()}
        >
          Duplicate Item
        </button>
        {available || grant ? (
          <>
            <label className={styles.character}>
              Character
              <input
                aria-label="Character"
                type="search"
                value={query}
                maxLength={80}
                placeholder="My selected character"
                disabled={disabled || recovering || busy || !!grant}
                onChange={(event) => {
                  if (disabled || working.current || pendingGrant.current) return
                  setQuery(event.currentTarget.value)
                  setSelected(null)
                  setResults([])
                  setMessage('')
                }}
              />
            </label>
            <button
              type="button"
              disabled={disabled || recovering || busy || !!grant || query.trim().length < 2}
              onClick={() => void search()}
            >
              Find
            </button>
            <label className={styles.quantity}>
              Quantity
              <input
                aria-label="Quantity"
                type="number"
                step={1}
                min={1}
                max={grant ? 99 : maximum}
                value={grant?.body.quantity ?? Math.min(quantity, maximum)}
                disabled={disabled || recovering || busy || !!grant}
                onChange={(event) => {
                  if (disabled || working.current || pendingGrant.current) return
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(maximum, Math.trunc(Number(event.currentTarget.value)) || 1),
                    ),
                  )
                }}
              />
            </label>
            <button
              type="button"
              disabled={recovering || busy || (!grant && (disabled || unresolved))}
              onClick={() => void testGrant()}
            >
              {grant ? 'Retry grant' : 'Grant Item'}
            </button>
            <span
              className={styles.recipient}
              title={selected?.characterId}
              aria-label={
                selected
                  ? `Recipient: ${selected.name}, character ID ${selected.characterId}`
                  : undefined
              }
            >
              {grant
                ? `Pending: ${grant.itemName} → ${grant.recipient}`
                : selected
                  ? `To: ${selected.name}`
                  : query.trim()
                    ? 'Select a matching character'
                    : 'My selected character'}
            </span>
          </>
        ) : null}
      </div>
      {results.length > 0 && !selected ? (
        <label className={styles.matches}>
          Matching characters
          <select
            aria-label="Matching characters"
            value=""
            disabled={disabled || recovering || busy || !!grant}
            onChange={(event) => {
              if (disabled || working.current || pendingGrant.current) return
              setSelected(
                results.find((character) => character.characterId === event.currentTarget.value) ??
                  null,
              )
              setMessage('')
            }}
          >
            <option value="">Choose a character</option>
            {results.map((character) => (
              <option key={character.characterId} value={character.characterId}>
                {character.name} · {character.characterId}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {disabled ? (
        <p className={styles.notice}>
          Commit or discard local edits before duplicating or making a new grant.
        </p>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className={styles.notice}>
          {message}
        </p>
      ) : null}
    </section>
  )
}
