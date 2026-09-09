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
  attributeCaps: Readonly<Partial<Record<CharacterAttributeId, number>>>
}

type SaveState = 'idle' | 'saving'
type AttributePanelMode = 'spend' | 'reset'

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
  const [draft, setDraft] = useState<CharacterAttributes>(initialAllocation.attributes)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const open = searchParams.get(PROFILE_PANEL_QUERY) === ATTRIBUTE_PANEL
  const resetMode = open && searchParams.get(ATTRIBUTE_MODE_QUERY) === 'reset'
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

  const setPanelOpen = useCallback(
    (nextOpen: boolean, mode: AttributePanelMode = 'spend') => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextOpen) {
        params.set(PROFILE_PANEL_QUERY, ATTRIBUTE_PANEL)
        if (mode === 'reset') params.set(ATTRIBUTE_MODE_QUERY, 'reset')
        else params.delete(ATTRIBUTE_MODE_QUERY)
      } else if (params.get(PROFILE_PANEL_QUERY) === ATTRIBUTE_PANEL) {
        params.delete(PROFILE_PANEL_QUERY)
        params.delete(ATTRIBUTE_MODE_QUERY)
      }
      const query = params.toString()
      const href = (query ? `${pathname}?${query}` : pathname) as Route
      router.replace(href, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const closeManager = useCallback(
    (dismissAutomaticPrompt = true) => {
      if (saveState === 'saving') return
      if (dismissAutomaticPrompt && allocation.unspentPoints > 0) {
        window.sessionStorage.setItem(autoPromptKey(allocation), 'dismissed')
      }
      setDraft(allocation.attributes)
      setMessage(null)
      setPanelOpen(false)
    },
    [allocation, saveState, setPanelOpen],
  )

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && saveState !== 'saving') closeManager(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeManager, open, saveState])

  useEffect(() => {
    if (open || allocation.unspentPoints <= 0) return
    if (window.sessionStorage.getItem(autoPromptKey(allocation)) === 'dismissed') return

    setDraft(allocation.attributes)
    setMessage(null)
    setPanelOpen(true, 'spend')
  }, [allocation, open, setPanelOpen])

  function changeAttribute(attributeId: CharacterAttributeId, delta: number) {
    setMessage(null)
    setDraft((current) => {
      const nextValue = current[attributeId] + delta
      const attributeCap = attributeCaps[attributeId]
      if (nextValue < 1) return current
      if (delta > 0 && attributeCap !== undefined && nextValue > attributeCap) return current
      if (delta > 0 && spent(current) >= allocation.pointPool) return current
      if (!resetMode && delta < 0) return current
      return { ...current, [attributeId]: nextValue }
    })
  }

  function openManager() {
    setMessage(null)
    setDraft(allocation.attributes)
    setPanelOpen(true, 'spend')
  }

  function beginReset() {
    if (allocation.resetRemaining <= 0) return
    setMessage(null)
    setDraft(allocation.attributes)
    setPanelOpen(true, 'reset')
  }

  function cancelReset() {
    setMessage(null)
    setDraft(allocation.attributes)
    setPanelOpen(true, 'spend')
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
      if (mode === 'reset') {
        setMessage('Attributes redistributed successfully.')
        setPanelOpen(false)
      } else if (body.allocation.unspentPoints > 0) {
        setMessage(
          `${body.allocation.unspentPoints} point${body.allocation.unspentPoints === 1 ? '' : 's'} still available.`,
        )
        setPanelOpen(true, 'spend')
      } else {
        setMessage('Attribute points assigned.')
        setPanelOpen(false)
      }
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
      <div className={styles.compactBar}>
        <div>
          <h2 id="attribute-allocation-title">Attribute Management</h2>
          <p>
            {allocation.unspentPoints > 0
              ? `${allocation.unspentPoints} unspent point${allocation.unspentPoints === 1 ? '' : 's'} ready`
              : 'Your current allocation is committed'}
          </p>
        </div>
        <div className={styles.summaryActions}>
          {allocation.unspentPoints > 0 ? (
            <button type="button" className={styles.spendButton} onClick={openManager}>
              Spend {allocation.unspentPoints} Point{allocation.unspentPoints === 1 ? '' : 's'}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.resetButton}
            onClick={beginReset}
            disabled={allocation.resetRemaining <= 0 || saveState === 'saving'}
          >
            Reset / Redistribute Attributes
          </button>
        </div>
      </div>

      {!open && message ? <p className={styles.message}>{message}</p> : null}

      {open ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onPointerDown={() => closeManager(true)}
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
                <span>{resetMode ? 'Full redistribution' : 'Character progression'}</span>
                <h2 id="attribute-allocation-dialog-title">
                  {resetMode ? 'Redistribute Attributes' : 'Spend Attribute Points'}
                </h2>
                <p>
                  Level {allocation.level} · {availableDraft} point
                  {availableDraft === 1 ? '' : 's'} available
                </p>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => closeManager(true)}
                disabled={saveState === 'saving'}
              >
                Close
              </button>
            </header>

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

            <div className={styles.grid}>
              {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
                const isFocus = focusAttributes.includes(attributeId)
                const attributeCap = attributeCaps[attributeId]
                const canDecrease = resetMode && draft[attributeId] > 1
                const canIncrease =
                  spentDraft < allocation.pointPool &&
                  (attributeCap === undefined || draft[attributeId] < attributeCap)
                return (
                  <div
                    className={styles.attribute}
                    key={attributeId}
                    data-focus={isFocus ? 'true' : 'false'}
                  >
                    <div>
                      <span>{CHARACTER_ATTRIBUTE_LABELS[attributeId]}</span>
                      {isFocus ? (
                        <small>Primary focus · uncapped by Discipline</small>
                      ) : attributeCap !== undefined ? (
                        <small>Primary cap {attributeCap}</small>
                      ) : (
                        <small>No Primary cap</small>
                      )}
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

            {resetMode ? (
              <p className={styles.notice}>
                Full redistribution includes the attributes you started the game with. Allocate all{' '}
                {allocation.pointPool} points before confirming. This consumes 1 of your 5 resets
                for the current 30-day window.
              </p>
            ) : (
              <p className={styles.notice}>
                Spend newly earned points here. Existing committed points stay untouched unless you
                enter full redistribution mode.
              </p>
            )}

            {message ? <p className={styles.message}>{message}</p> : null}

            <div className={styles.actions}>
              {resetMode ? (
                <>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={cancelReset}
                    disabled={saveState === 'saving'}
                  >
                    Back to Point Spend
                  </button>
                  <button
                    type="button"
                    className={styles.confirmReset}
                    onClick={save}
                    disabled={!canSaveReset || saveState === 'saving'}
                  >
                    {saveState === 'saving' ? 'Saving…' : 'Confirm Redistribution'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={beginReset}
                    disabled={allocation.resetRemaining <= 0 || saveState === 'saving'}
                  >
                    Reset / Redistribute
                  </button>
                  <button
                    type="button"
                    className={styles.spendButton}
                    onClick={save}
                    disabled={!canSaveSpend || saveState === 'saving'}
                  >
                    {saveState === 'saving' ? 'Saving…' : 'Commit Attribute Points'}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function spent(attributes: CharacterAttributes): number {
  return CHARACTER_ATTRIBUTE_IDS.reduce((total, id) => total + attributes[id], 0)
}

function autoPromptKey(allocation: AttributeAllocationState): string {
  return `aurevane:attribute-prompt:${allocation.characterId}:${allocation.pointPool}:${allocation.spentPoints}`
}

function resetRenewalLabel(renewsAt: string | null): string {
  if (!renewsAt) return 'Starts on next reset'
  const date = new Date(renewsAt)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleDateString()
}
