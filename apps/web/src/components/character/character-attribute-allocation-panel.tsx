'use client'

import { CHARACTER_ATTRIBUTE_LABELS } from '@aurevane/game-core/character/attribute-allocation'
import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import type { Route } from 'next'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import styles from './character-attribute-allocation-panel.module.css'

interface AttributeAllocationState {
  characterId: string
  attributes: CharacterAttributes
  baseAttributes: CharacterAttributes
  level: number
  pointPool: number
  personalPointPool: number
  spentPoints: number
  unspentPoints: number
  conversionRequired: boolean
  resetWindowStartedAt: string | null
  resetUsed: number
  resetRemaining: number
  resetRenewsAt: string | null
  serverNow: string
}

interface CharacterAttributeAllocationPanelProps {
  initialAllocation: AttributeAllocationState
  focusAttributes: readonly CharacterAttributeId[]
  attributeCaps: Readonly<Partial<Record<CharacterAttributeId, number>>>
}

type SaveState = 'idle' | 'saving'
type AttributePanelMode = 'spend' | 'reset' | 'convert'

const PROFILE_PANEL_QUERY = 'profilePanel'
const ATTRIBUTE_PANEL = 'attributes'
const ATTRIBUTE_MODE_QUERY = 'attributeMode'

export function CharacterAttributeAllocationPanel({
  initialAllocation,
  focusAttributes,
  attributeCaps,
}: CharacterAttributeAllocationPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [allocation, setAllocation] = useState(initialAllocation)
  const [draft, setDraft] = useState<CharacterAttributes>(initialDraft(initialAllocation))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const requestedOpen = searchParams.get(PROFILE_PANEL_QUERY) === ATTRIBUTE_PANEL
  const requestedReset = requestedOpen && searchParams.get(ATTRIBUTE_MODE_QUERY) === 'reset'
  const forcedMode: AttributePanelMode | null = allocation.conversionRequired
    ? 'convert'
    : allocation.unspentPoints > 0
      ? 'spend'
      : null
  const mode: AttributePanelMode | null = forcedMode ?? (requestedReset ? 'reset' : null)
  const open = mode !== null
  const forced = mode === 'spend' || mode === 'convert'
  const spentDraft = useMemo(
    () => CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + draft[id], 0),
    [draft],
  )
  const availableDraft = Math.max(0, allocation.pointPool - spentDraft)
  const hasChanges = CHARACTER_ATTRIBUTE_IDS.some((id) => draft[id] !== allocation.attributes[id])
  const canSave =
    mode === 'convert'
      ? availableDraft === 0
      : mode === 'reset'
        ? hasChanges && availableDraft === 0 && allocation.resetRemaining > 0
        : mode === 'spend'
          ? hasChanges && spentDraft > allocation.spentPoints && availableDraft === 0
          : false

  const setResetOpen = useCallback(
    (nextOpen: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextOpen) {
        params.set(PROFILE_PANEL_QUERY, ATTRIBUTE_PANEL)
        params.set(ATTRIBUTE_MODE_QUERY, 'reset')
      } else if (params.get(PROFILE_PANEL_QUERY) === ATTRIBUTE_PANEL) {
        params.delete(PROFILE_PANEL_QUERY)
        params.delete(ATTRIBUTE_MODE_QUERY)
      }
      const query = params.toString()
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const closeReset = useCallback(() => {
    if (saveState === 'saving' || forced) return
    setDraft(allocation.attributes)
    setMessage(null)
    setResetOpen(false)
  }, [allocation.attributes, forced, saveState, setResetOpen])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !forced && saveState !== 'saving') closeReset()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeReset, forced, open, saveState])

  useEffect(() => {
    if (mode === 'convert') setDraft({ ...allocation.baseAttributes })
    else if (mode === 'spend') setDraft(allocation.attributes)
  }, [allocation.attributes, allocation.baseAttributes, mode])

  function changeAttribute(attributeId: CharacterAttributeId, delta: number) {
    if (!mode) return
    setMessage(null)
    setDraft((current) => {
      const nextValue = current[attributeId] + delta
      const minimum =
        mode === 'spend'
          ? allocation.attributes[attributeId]
          : allocation.baseAttributes[attributeId]
      const cap = attributeCaps[attributeId]
      if (nextValue < minimum) return current
      if (delta > 0 && cap !== undefined && nextValue > cap) return current
      if (delta > 0 && spent(current) >= allocation.pointPool) return current
      return { ...current, [attributeId]: nextValue }
    })
  }

  function beginReset() {
    if (allocation.resetRemaining <= 0 || forced) return
    setMessage(null)
    setDraft(allocation.attributes)
    setResetOpen(true)
  }

  async function save() {
    if (!mode || !canSave) return
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
        throw new Error(body.error?.message ?? 'The Core Stat change could not be saved.')
      }

      setAllocation(body.allocation)
      setDraft(body.allocation.attributes)
      setMessage(null)
      if (mode === 'reset') setResetOpen(false)
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The Core Stat change could not be saved.',
      )
    } finally {
      setSaveState('idle')
    }
  }

  return (
    <section className={styles.panel} aria-label="Attribute redistribution">
      <button
        type="button"
        className={styles.resetButton}
        onClick={beginReset}
        disabled={allocation.resetRemaining <= 0 || forced || saveState === 'saving'}
      >
        Reset / Redistribute Attributes
      </button>

      {open ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onPointerDown={() => {
            if (!forced) closeReset()
          }}
          data-testid="attribute-allocation-backdrop"
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="attribute-allocation-dialog-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div>
                <span>
                  {mode === 'reset'
                    ? 'Full redistribution'
                    : mode === 'convert'
                      ? 'Core profile conversion'
                      : 'Level gained'}
                </span>
                <h2 id="attribute-allocation-dialog-title">
                  {mode === 'reset' ? 'Redistribute Attributes' : 'Spend Core Stat Points'}
                </h2>
              </div>
              {!forced ? (
                <button
                  type="button"
                  className={styles.close}
                  onClick={closeReset}
                  disabled={saveState === 'saving'}
                >
                  Close
                </button>
              ) : null}
            </header>

            {mode === 'reset' ? (
              <div className={styles.modalMeta}>
                <div>
                  <span>Point pool</span>
                  <strong>{allocation.pointPool}</strong>
                </div>
                <div>
                  <span>Unspent</span>
                  <strong>{availableDraft}</strong>
                </div>
                <div>
                  <span>Resets available</span>
                  <strong>{allocation.resetRemaining} / 5</strong>
                </div>
                <div>
                  <span>Reset refresh</span>
                  <strong>{resetRenewalLabel(allocation.resetRenewsAt)}</strong>
                </div>
              </div>
            ) : (
              <div className={styles.forcedCounter} aria-live="polite">
                <strong>{availableDraft}</strong>
                <span>point{availableDraft === 1 ? '' : 's'} remaining</span>
              </div>
            )}

            <div className={styles.grid}>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
                const isFocus = focusAttributes.includes(attributeId)
                const cap = attributeCaps[attributeId]
                const minimum =
                  mode === 'spend'
                    ? allocation.attributes[attributeId]
                    : allocation.baseAttributes[attributeId]
                const canDecrease = draft[attributeId] > minimum
                const canIncrease =
                  spentDraft < allocation.pointPool &&
                  (cap === undefined || draft[attributeId] < cap)
                return (
                  <div
                    className={styles.attribute}
                    key={attributeId}
                    data-focus={isFocus ? 'true' : 'false'}
                  >
                    <div>
                      <span>{CHARACTER_ATTRIBUTE_LABELS[attributeId]}</span>
                      <small>
                        Base {allocation.baseAttributes[attributeId]}
                        {isFocus ? ' · Primary focus' : cap !== undefined ? ` · Cap ${cap}` : ''}
                      </small>
                    </div>
                    <div className={styles.controls}>
                      {mode !== 'spend' ? (
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

            {message ? (
              <p className={styles.message} role="alert">
                {message}
              </p>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={mode === 'reset' ? styles.confirmReset : styles.spendButton}
                onClick={save}
                disabled={!canSave || saveState === 'saving'}
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : mode === 'reset'
                    ? 'Confirm Redistribution'
                    : mode === 'convert'
                      ? 'Confirm Core Stats'
                      : 'Commit Attribute Points'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function initialDraft(allocation: AttributeAllocationState): CharacterAttributes {
  return allocation.conversionRequired ? { ...allocation.baseAttributes } : allocation.attributes
}

function spent(attributes: CharacterAttributes): number {
  return CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + attributes[id], 0)
}

function resetRenewalLabel(renewsAt: string | null): string {
  if (!renewsAt) return 'Starts on next reset'
  const date = new Date(renewsAt)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleDateString()
}
