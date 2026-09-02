'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

import artworkFitStyles from './battle-skill-artwork-fit.module.css'
import styles from './battle-skill-command.module.css'

export type BattleCommandSlot = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'

export interface BattleSkillSelectorOption {
  id: string
  label: string
  cost: string
  artworkSrc: string
}

export interface BattleSkillSelectorConfig {
  categoryLabel: string
  selectedId: string
  options: readonly BattleSkillSelectorOption[]
  onSelect: (id: string) => void
}

export function BattleSkillCommand({
  slot,
  hotkey,
  label,
  cost,
  artworkSrc,
  active,
  disabled,
  onActivate,
  selector,
}: {
  slot: BattleCommandSlot
  hotkey: string
  label: string
  cost: string
  artworkSrc: string
  active: boolean
  disabled: boolean
  onActivate: () => void
  selector?: BattleSkillSelectorConfig
}) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectorStyle, setSelectorStyle] = useState<CSSProperties>({})
  const artworkRef = useRef<HTMLButtonElement | null>(null)
  const selectorRef = useRef<HTMLDivElement | null>(null)
  const canSwap = Boolean(selector && selector.options.length > 1)

  const closeSelector = useCallback((restoreFocus = false) => {
    setSelectorOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => artworkRef.current?.focus())
  }, [])

  const positionSelector = useCallback(() => {
    if (!selectorOpen || !artworkRef.current || !selectorRef.current) return
    const anchor = artworkRef.current.getBoundingClientRect()
    const popup = selectorRef.current.getBoundingClientRect()
    const edge = 8
    const gap = 8
    const left = Math.min(
      Math.max(edge, anchor.right - popup.width),
      Math.max(edge, window.innerWidth - popup.width - edge),
    )
    const roomBelow = window.innerHeight - anchor.bottom - edge
    const mobile = window.matchMedia('(max-width: 580px)').matches
    const openAbove = mobile || roomBelow < popup.height + gap
    const top = openAbove
      ? Math.max(edge, anchor.top - popup.height - gap)
      : Math.min(window.innerHeight - popup.height - edge, anchor.bottom + gap)
    setSelectorStyle({ left, top })
  }, [selectorOpen])

  useLayoutEffect(() => {
    positionSelector()
  }, [positionSelector, selector?.selectedId])

  useEffect(() => {
    if (!selectorOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (!target) return
      if (selectorRef.current?.contains(target) || artworkRef.current?.contains(target)) return
      closeSelector()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeSelector(true)
    }
    const onViewportChange = () => positionSelector()

    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeSelector, positionSelector, selectorOpen])

  useEffect(() => {
    if (!selectorOpen) return
    const selected = selectorRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
    window.requestAnimationFrame(() => selected?.focus())
  }, [selectorOpen])

  return (
    <article className={styles.shell} data-command-card={slot}>
      <button
        type="button"
        className={styles.action}
        data-active={active || undefined}
        data-battle-active={active || undefined}
        data-battle-command={slot}
        data-command-slot={slot}
        data-action-cost={cost}
        disabled={disabled}
        onClick={onActivate}
        aria-label={`${label}, ${cost}`}
      >
        <span className={styles.hotkey}>{hotkey}</span>
        <strong>{label}</strong>
        <small>{cost}</small>
        {!canSwap ? (
          <span
            className={`${styles.artwork} ${artworkFitStyles.frame}`}
            data-battle-command-artwork="static"
            aria-hidden="true"
          >
            <img src={artworkSrc} alt="" />
          </span>
        ) : null}
      </button>

      {canSwap && selector ? (
        <button
          ref={artworkRef}
          type="button"
          className={`${styles.artworkTrigger} ${artworkFitStyles.frame}`}
          data-battle-command-artwork="selector"
          aria-haspopup="listbox"
          aria-expanded={selectorOpen}
          aria-label={`Choose ${selector.categoryLabel} skill. ${label} selected.`}
          onClick={() => setSelectorOpen((open) => !open)}
        >
          <img src={artworkSrc} alt="" aria-hidden="true" />
          <span aria-hidden="true">⌄</span>
        </button>
      ) : null}

      {selectorOpen && selector && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={selectorRef}
              className={styles.selector}
              style={selectorStyle}
              role="listbox"
              aria-label={`${selector.categoryLabel} skills`}
            >
              <span className={styles.selectorHeading}>{selector.categoryLabel}</span>
              {selector.options.map((option) => {
                const selected = option.id === selector.selectedId
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={styles.selectorOption}
                    data-selected={selected || undefined}
                    onClick={() => {
                      selector.onSelect(option.id)
                      closeSelector(true)
                    }}
                  >
                    <img src={option.artworkSrc} alt="" aria-hidden="true" />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.cost}</small>
                    </span>
                    <b aria-hidden="true">{selected ? '✓' : ''}</b>
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </article>
  )
}
