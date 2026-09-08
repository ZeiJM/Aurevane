'use client'

import { CHARACTER_ATTRIBUTE_LABELS } from '@aurevane/game-core/character/attribute-allocation'
import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

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
type SaveMode = 'spend' | 'reset'

const PROFILE_PANEL_QUERY = 'profilePanel'
const RESET_ATTRIBUTES_PANEL = 'reset-attributes'

export function CharacterAttributeAllocationPanel({
  initialAllocation,
  focusAttributes,
}: CharacterAttributeAllocationPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const resetOpen = searchParams.get(PROFILE_PANEL_QUERY) === RESET_ATTRIBUTES_PANEL
  const [allocation, setAllocation] = useState(initialAllocation)
  const [spendDraft, setSpendDraft] = useState<CharacterAttributes>(initialAllocation.attributes)
  const [resetDraft, setResetDraft] = useState<CharacterAttributes>(initialAllocation.attributes)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const spentSpendDraft = useMemo(() => spent(spendDraft), [spendDraft])
  const spendAvailable = Math.max(0, allocation.pointPool - spentSpendDraft)
  const hasSpendChanges = CHARACTER_ATTRIBUTE_IDS.some(
    (id) => spendDraft[id] !== allocation.attributes[id],
  )
  const canSaveSpend =
    hasSpendChanges && spentSpendDraft > allocation.spentPoints && spendAvailable >= 0

  const spentResetDraft = useMemo(() => spent(resetDraft), [resetDraft])
  const resetAvailable = Math.max(0, allocation.pointPool - spentResetDraft)
  const hasResetChanges = CHARACTER_ATTRIBUTE_IDS.some(
    (id) => resetDraft[id] !== allocation.attributes[id],
  )
  const canSaveReset = hasResetChanges && resetAvailable === 0 && allocation.resetRemaining > 0

  useEffect(() => {
    if (resetOpen) setResetDraft(allocation.attributes)
  }, [resetOpen, allocation.attributes])

  useEffect(() => {
    if (!resetOpen) return

    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && saveState !== 'saving') setPanelOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
    // setPanelOpen intentionally reads the current URL state; resetOpen is the lifecycle boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetOpen, saveState])

  function setPanelOpen(nextOpen: boolean) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextOpen) {
      params.set(PROFILE_PANEL_QUERY, RESET_ATTRIBUTES_PANEL)
    } else if (params.get(PROFILE_PANEL_QUERY) === RESET_ATTRIBUTES_PANEL) {
      params.delete(PROFILE_PANEL_QUERY)
    }
    const query = params.toString()
    const href = (query ? `${pathname}?${query}` : pathname) as Route
    router.replace(href, { scroll: false })
  }

  function changeSpendAttribute(attributeId: CharacterAttributeId) {
    setMessage(null)
    setSpendDraft((current) => {
      if (spent(current) >= allocation.pointPool) return current
      return { ...current, [attributeId]: current[attributeId] + 1 }
    })
  }

  function changeResetAttribute(attributeId: CharacterAttributeId, delta: number) {
    setResetDraft((current) => {
      const nextValue = current[attributeId] + delta
      if (nextValue < 1) return current
      if (delta > 0 && spent(current) >= allocation.pointPool) return current
      return { ...current, [attributeId]: nextValue }
    })
  }

  function openReset() {
    setMessage(null)
    setResetDraft(allocation.attributes)
    setPanelOpen(true)
  }

  async function persist(mode: SaveMode, attributes: CharacterAttributes) {
    const response = await fetch('/api/character/attributes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, attributes, idempotencyKey: crypto.randomUUID() }),
    })
    const body = (await response.json()) as {
      allocation?: AttributeAllocationState
      error?: { message?: string }
    }
    if (!response.ok || !body.allocation) {
      throw new Error(body.error?.message ?? 'The attribute change could not be saved.')
    }
    return body.allocation
  }

  async function saveSpend() {
    if (!canSaveSpend || saveState === 'saving') return
    setSaveState('saving')
    setMessage(null)
    try {
      const next = await persist('spend', spendDraft)
      setAllocation(next)
      setSpendDraft(next.attributes)
      setResetDraft(next.attributes)
      setMessage('Attribute points assigned.')
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The attribute change could not be saved.',
      )
    } finally {
      setSaveState('idle')
    }
  }

  async function saveReset() {
    if (!canSaveReset || saveState === 'saving') return
    setSaveState('saving')
    setMessage(null)
    try {
      const next = await persist('reset', resetDraft)
      setAllocation(next)
      setSpendDraft(next.attributes)
      setResetDraft(next.attributes)
      setMessage('Attributes reset successfully.')
      setPanelOpen(false)
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The attribute reset could not be saved.',
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
            Level {allocation.level} · {spendAvailable} point{spendAvailable === 1 ? '' : 's'}{' '}
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
          const canIncrease = spentSpendDraft < allocation.pointPool
          return (
            <div className={styles.attribute} key={attributeId}>
              <div>
                <span>{CHARACTER_ATTRIBUTE_LABELS[attributeId]}</span>
                {isFocus ? <small>Primary focus</small> : null}
              </div>
              <div className={styles.controls}>
                <strong>{spendDraft[attributeId]}</strong>
                <button
                  type="button"
                  onClick={() => changeSpendAttribute(attributeId)}
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
        <button
          type="button"
          className={styles.resetButton}
          onClick={openReset}
          disabled={allocation.resetRemaining <= 0 || saveState === 'saving'}
        >
          Reset Stats
        </button>
        <button type="button" onClick={saveSpend} disabled={!canSaveSpend || saveState === 'saving'}>
          {saveState === 'saving' ? 'Saving…' : 'Assign Points'}
        </button>
      </div>

      {message ? <p className={styles.message}>{message}</p> : null}

      {resetOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={styles.backdrop}
              role="presentation"
              onPointerDown={() => {
                if (saveState !== 'saving') setPanelOpen(false)
              }}
            >
              <section
                className={styles.resetDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reset-attributes-heading"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header className={styles.resetHeader}>
                  <div>
                    <span>Full redistribution</span>
                    <h2 id="reset-attributes-heading">Reset Stats</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setPanelOpen(false)}
                    disabled={saveState === 'saving'}
                  >
                    Close
                  </button>
                </header>

                <div className={styles.resetMeta}>
                  <div>
                    <span>Available pool</span>
                    <strong>{allocation.pointPool} points</strong>
                  </div>
                  <div>
                    <span>Resets remaining</span>
                    <strong>{allocation.resetRemaining} / 5</strong>
                  </div>
                  <div>
                    <span>Refresh</span>
                    <strong>{resetRenewalLabel(allocation.resetRenewsAt)}</strong>
                  </div>
                </div>

                <p className={styles.notice}>
                  Starting attributes are unlocked in this window. Redistribute the entire pool
                  before confirming; a successful confirmation consumes one reset.
                </p>

                <div className={`${styles.grid} ${styles.resetGrid}`}>
                  {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
                    const isFocus = focusAttributes.includes(attributeId)
                    return (
                      <div className={styles.attribute} key={attributeId}>
                        <div>
                          <span>{CHARACTER_ATTRIBUTE_LABELS[attributeId]}</span>
                          {isFocus ? <small>Primary focus</small> : null}
                        </div>
                        <div className={styles.controls}>
                          <button
                            type="button"
                            onClick={() => changeResetAttribute(attributeId, -1)}
                            disabled={resetDraft[attributeId] <= 1 || saveState === 'saving'}
                            aria-label={`Decrease ${CHARACTER_ATTRIBUTE_LABELS[attributeId]}`}
                          >
                            −
                          </button>
                          <strong>{resetDraft[attributeId]}</strong>
                          <button
                            type="button"
                            onClick={() => changeResetAttribute(attributeId, 1)}
                            disabled={spentResetDraft >= allocation.pointPool || saveState === 'saving'}
                            aria-label={`Increase ${CHARACTER_ATTRIBUTE_LABELS[attributeId]}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className={styles.resetBalance}>
                  <span>Points still to assign</span>
                  <strong>{resetAvailable}</strong>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setPanelOpen(false)}
                    disabled={saveState === 'saving'}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveReset}
                    disabled={!canSaveReset || saveState === 'saving'}
                  >
                    {saveState === 'saving' ? 'Saving…' : 'Confirm Reset'}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}

function spent(attributes: CharacterAttributes): number {
  return CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + attributes[id], 0)
}

function resetRenewalLabel(renewsAt: string | null): string {
  if (!renewsAt) return 'Starts on next reset'
  const date = new Date(renewsAt)
  if (Number.isNaN(date.getTime())) return 'Refresh date unavailable'
  return `Refreshes ${date.toLocaleDateString()}`
}
