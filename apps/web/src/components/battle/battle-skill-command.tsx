'use client'

import Image from 'next/image'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { BattleInfoPopover } from './battle-info-popover'

import artworkFitStyles from './battle-skill-artwork-fit.module.css'
import {
  BATTLE_FAVORITE_TECHNIQUE_SELECT_EVENT,
  type BattleFavoriteTechniqueSelectDetail,
} from './favorite-technique-storage'
import styles from './battle-skill-command.module.css'
import { BATTLE_MISSING_ARTWORK } from './battle-skill-presentation'

export type BattleCommandSlot = 'inspect' | 'move' | 'attack' | 'guard' | 'recover' | 'finish'

export interface BattleSkillSelectorOption {
  id: string
  label: string
  cost: string
  artworkSrc: string
  tags?: readonly string[]
}

export interface BattleSkillSelectorConfig {
  categoryLabel: string
  selectedId: string
  options: readonly BattleSkillSelectorOption[]
  onSelect: (id: string) => void
}

function fallbackBrokenArtwork(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget
  if (image.getAttribute('src') === BATTLE_MISSING_ARTWORK) return
  image.onerror = null
  image.src = BATTLE_MISSING_ARTWORK
}

function readFavoriteSelectionDetail(event: Event): BattleFavoriteTechniqueSelectDetail | null {
  if (!(event instanceof CustomEvent)) return null
  const detail: unknown = event.detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const candidate = detail as Partial<BattleFavoriteTechniqueSelectDetail>
  if (
    typeof candidate.categoryLabel !== 'string' ||
    typeof candidate.id !== 'string' ||
    typeof candidate.label !== 'string'
  ) {
    return null
  }
  return {
    categoryLabel: candidate.categoryLabel,
    id: candidate.id,
    label: candidate.label,
  }
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
  tags = [],
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
  tags?: readonly string[]
}) {
  const informationId = useId()
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

  useEffect(() => {
    if (!selector) return

    const applyFavorite = (event: Event) => {
      const detail = readFavoriteSelectionDetail(event)
      if (!detail || detail.categoryLabel !== selector.categoryLabel) return
      const option = selector.options.find(
        (candidate) => candidate.id === detail.id || candidate.label === detail.label,
      )
      if (!option) return

      selector.onSelect(option.id)
      event.preventDefault()
    }

    window.addEventListener(BATTLE_FAVORITE_TECHNIQUE_SELECT_EVENT, applyFavorite)
    return () => window.removeEventListener(BATTLE_FAVORITE_TECHNIQUE_SELECT_EVENT, applyFavorite)
  }, [selector])

  return (
    <article
      className={styles.shell}
      data-command-card={slot}
      data-has-skill-tags={tags.length > 0 || undefined}
    >
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
        <span className={styles.hotkey} data-battle-command-hotkey="true">
          {hotkey}
        </span>
        <strong>{label}</strong>
        <small>{cost}</small>
        {
          <span
            className={`${styles.artwork} ${artworkFitStyles.frame}`}
            data-battle-command-artwork="static"
            aria-hidden="true"
          >
            <Image
              width={64}
              height={64}
              unoptimized
              src={artworkSrc}
              alt=""
              onError={fallbackBrokenArtwork}
            />
          </span>
        }
      </button>

      <BattleInfoPopover
        label={`About ${label}`}
        title={label}
        trigger="ⓘ"
        className={styles.infoTrigger}
      >
        <p>
          <strong>{cost}</strong>
        </p>
        {tags.length > 0 ? (
          <div className={styles.tags} data-battle-skill-tags="details">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : (
          <p>
            {slot === 'inspect'
              ? 'Select a character or tile to inspect it for free.'
              : slot === 'move'
                ? 'Select reachable tiles to preview your path and its AP cost.'
                : 'Choose your final facing on the map, then finish your turn.'}
          </p>
        )}
        {tags.length > 0 ? (
          <p>Select a target to see the projected result before confirming.</p>
        ) : null}
      </BattleInfoPopover>

      {canSwap && selector ? (
        <button
          ref={artworkRef}
          type="button"
          className={styles.artworkTrigger}
          data-battle-skill-selector-category={selector.categoryLabel}
          data-battle-selected-skill-id={selector.selectedId}
          aria-haspopup="listbox"
          aria-expanded={selectorOpen}
          aria-label={`Choose ${selector.categoryLabel} skill. ${label} selected.`}
          onClick={() => setSelectorOpen((open) => !open)}
        >
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
              data-battle-skill-listbox-category={selector.categoryLabel}
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
                    data-battle-skill-option-id={option.id}
                    aria-selected={selected}
                    aria-label={`${option.label} ${option.cost}`}
                    aria-describedby={
                      option.tags?.length ? `${informationId}-${option.id}` : undefined
                    }
                    className={styles.selectorOption}
                    data-selected={selected || undefined}
                    onClick={() => {
                      selector.onSelect(option.id)
                      closeSelector(true)
                    }}
                  >
                    <Image
                      width={64}
                      height={64}
                      unoptimized
                      src={option.artworkSrc}
                      alt=""
                      aria-hidden="true"
                      onError={fallbackBrokenArtwork}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.cost}</small>
                      {option.tags?.length ? (
                        <span
                          id={`${informationId}-${option.id}`}
                          className={styles.tags}
                          data-battle-skill-tags="option"
                        >
                          {option.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </span>
                      ) : null}
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
