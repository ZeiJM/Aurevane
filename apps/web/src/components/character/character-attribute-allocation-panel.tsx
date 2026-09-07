'use client'

import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import { CHARACTER_ATTRIBUTE_LABELS } from '@aurevane/game-core/character/attribute-allocation'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import styles from './character-attribute-allocation-panel.module.css'

interface AttributeAllocationState {
  attributes: CharacterAttributes
  level: number
  pointPool: number
  spentPoints: number
  unspentPoints: number
  resetWindowStartedAt: string | null
  resetUsed: number
  resetRemaining: number
  resetRenewsAt: string | null
  serverNow: string
}

interface CharacterAttributeAllocationPanelProps {
  initialAllocation: AttributeAllocationState
  focusAttributes: readonly CharacterAttributeId[]
}

type SaveState = 'idle' | 'saving'

export function CharacterAttributeAllocationPanel({
  initialAllocation,
  focusAttributes,
}: CharacterAttributeAllocationPanelProps) {
  const router = useRouter()
  const [allocation, setAllocation] = useState(initialAllocation)
  const [draft, setDraft] = useState<CharacterAttributes>(initialAllocation.attributes)
  const [resetMode, setResetMode] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const spentDraft = useMemo(
    () => CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + draft[id], 0),
    [draft],
  )
  const availableDraft = Math.max(0, allocation.pointPool - spentDraft)
  const hasChanges = CHARACTER_ATTRIBUTE_IDS.some((id) => draft[id] !== allocation.attributes[id])
  const canSaveSpend =
    !resetMode && hasChanges && spentDraft > allocation.spentPoints && availableDraft >= 0
  const canSaveReset =
    resetMode && hasChanges && availableDraft === 0 && allocation.resetRemaining > 0

  function changeAttribute(attributeId: CharacterAttributeId, delta: number) {
    setMessage(null)
    setDraft((current) => {
      const nextValue = current[attributeId] + delta
      if (nextValue < 1) return current
      if (delta > 0 && spent(current) >= allocation.pointPool) return current
      if (!resetMode && delta < 0) return current
      return { ...current, [attributeId]: nextValue }
    })
  }

  function beginReset() {
    setMessage(null)
    setDraft(allocation.attributes)
    setResetMode(true)
  }

  function cancelReset() {
    setMessage(null)
    setDraft(allocation.attributes)
    setResetMode(false)
  }

  async function save() {
    const mode = resetMode ? 'reset' : 'spend'
    if ((mode === 'reset' && !canSaveReset) || (mode === 'spend' && !canSaveSpend)) return
    setSaveState('saving')
    setMessage(null)
    try {
      const response = await fetch('/api/character/attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, attributes: draft, idempotencyKey: crypto.randomUUID() }),
      })
      const body = (await response.json()) as {
        allocation?: AttributeAllocationState
        error?: { message?: string }
      }
      if (!response.ok || !body.allocation) {
        throw new Error(body.error?.message ?? 'The attribute change could not be saved.')
      }

      setAllocation(body.allocation)
      setDraft(body.allocation.attributes)
      setResetMode(false)
      setMessage(mode === 'reset' ? 'Attributes reset successfully.' : 'Attribute points assigned.')
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The attribute change could not be saved.',
      )
    } finally {
      setSaveState('idle')
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="attribute-allocation-title">
      <header className={styles.header}>
        <div>
          <h2 id="attribute-allocation-title">Attribute Points</h2>
          <p>
            Level {allocation.level} · {availableDraft} point{availableDraft === 1 ? '' : 's'}{' '}
            available
          </p>
        </div>
        <div className={styles.resetSummary}>
          <strong>{allocation.resetRemaining} / 5 resets</strong>
          <span>{resetRenewalLabel(allocation.resetRenewsAt)}</span>
        </div>
      </header>

      <div className={styles.grid}>
        {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
          const isFocus = focusAttributes.includes(attributeId)
          const canDecrease = resetMode && draft[attributeId] > 1
          const canIncrease = spentDraft < allocation.pointPool
          return (
            <div className={styles.attribute} key={attributeId}>
              <div>
                <span>{CHARACTER_ATTRIBUTE_LABELS[attributeId]}</span>
                {isFocus ? <small>Primary focus</small> : null}
              </div>
              <div className={styles.controls}>
                {resetMode ? (
                  <button
                    type="button"
                    onClick={() => changeAttribute(attributeId, -1)}
                    disabled={!canDecrease || saveState === 'saving'}
                    aria-label={`Decrease ${CHARACTER_ATTRIBUTE_LABELS[attributeId]}`}
                  >
                    −
                  </button>
                ) : null}
                <strong>{draft[attributeId]}</strong>
                <button
                  type="button"
                  onClick={() => changeAttribute(attributeId, 1)}
                  disabled={!canIncrease || saveState === 'saving'}
                  aria-label={`Increase ${CHARACTER_ATTRIBUTE_LABELS[attributeId]}`}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.actions}>
        {resetMode ? (
          <>
            <button
              type="button"
              className={styles.secondary}
              onClick={cancelReset}
              disabled={saveState === 'saving'}
            >
              Cancel Reset
            </button>
            <button type="button" onClick={save} disabled={!canSaveReset || saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving…' : 'Confirm Reset'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.secondary}
              onClick={beginReset}
              disabled={allocation.resetRemaining <= 0 || saveState === 'saving'}
            >
              Reset Attributes
            </button>
            <button type="button" onClick={save} disabled={!canSaveSpend || saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving…' : 'Assign Points'}
            </button>
          </>
        )}
      </div>

      {resetMode ? (
        <p className={styles.notice}>
          Reset mode unlocks the full pool, including starting attributes. Redistribute all{' '}
          {allocation.pointPool} points before confirming. This uses 1 reset.
        </p>
      ) : null}
      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  )
}

function spent(attributes: CharacterAttributes): number {
  return CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + attributes[id], 0)
}

function resetRenewalLabel(renewsAt: string | null): string {
  if (!renewsAt) return '30-day timer starts on your next reset'
  const date = new Date(renewsAt)
  if (Number.isNaN(date.getTime())) return 'Refresh date unavailable'
  return `Refreshes ${date.toLocaleDateString()}`
}
