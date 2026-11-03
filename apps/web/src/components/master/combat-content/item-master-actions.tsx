'use client'
import { useRef, useState } from 'react'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { contentRecordCommand } from './content-record-workflow'
import type { CharacterItemsView } from '@/server/character/character-items-service'
export function ItemMasterActions({
  record,
  disabled,
  onDuplicated,
}: {
  record: CompleteCombatContentRecord
  disabled: boolean
  onDuplicated(record: CompleteCombatContentRecord): void
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [quantity, setQuantity] = useState(1),
    [grant, setGrant] = useState<Record<string, unknown> | null>(null)
  const duplication = useRef<string | null>(null)
  const current = record.current?.definition ?? record.builtinDefinition
  const available = current?.schemaVersion === 2 && current.enabled === true
  const maximum = current?.inventoryCategory === 'gear' ? 1 : 99
  async function duplicate() {
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
      setBusy(false)
    }
  }
  async function testGrant() {
    setBusy(true)
    setMessage('')
    try {
      let request = grant
      if (!request) {
        const response = await fetch('/api/character/items', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error?.message ?? 'Could not load the selected test character.')
        const view = data.view as CharacterItemsView
        request = {
          characterId: view.characterId,
          itemId: record.contentKey,
          quantity: Math.min(quantity, maximum),
          expectedRevision: view.revision,
          catalogueToken: view.catalogueToken,
          requestId: crypto.randomUUID(),
        }
        setGrant(request)
      }
      const response = await fetch('/api/master/combat-content/item-test-grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) setGrant(null)
        throw new Error(data.error?.message ?? 'The test grant failed.')
      }
      setGrant(null)
      setMessage('Item granted to your selected character. Open Arsenal Items to equip it.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not grant the Item. Retry uses the same request.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label="Item authoring actions">
      <button type="button" disabled={disabled || busy} onClick={() => void duplicate()}>
        Duplicate Item
      </button>
      {available ? (
        <>
          <label>
            Test quantity{' '}
            <input
              type="number"
              min={1}
              max={maximum}
              value={quantity}
              disabled={disabled || busy || !!grant}
              onChange={(event) =>
                setQuantity(Math.max(1, Math.min(maximum, Number(event.currentTarget.value) || 1)))
              }
            />
          </label>
          <button type="button" disabled={disabled || busy} onClick={() => void testGrant()}>
            Grant to my selected character
          </button>
        </>
      ) : null}
      {disabled ? (
        <p>Commit or discard local edits before duplicating or granting the saved Item.</p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  )
}
