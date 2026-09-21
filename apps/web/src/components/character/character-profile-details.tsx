'use client'

import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import type {
  DerivedStatId,
  DerivedStatSnapshot,
  DerivedStatValue,
} from '@aurevane/game-core/character/derived-stats'
import {
  ATTRIBUTE_PROFILE_HELP,
  DERIVED_STAT_PROFILE_HELP,
} from '@aurevane/game-core/character/profile-stat-content'
import Image from 'next/image'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import styles from './character-profile-details.module.css'

interface CharacterProfileDetailsProps {
  presentationLabel: string
  buildTypeLabel: 'Hybrid Build' | 'Essence Build'
  cycleNumber: number
  attributes: CharacterAttributes
  derived: DerivedStatSnapshot
  attributeResetControl?: ReactNode
}

interface DetailAnchor {
  top: number
  right: number
  bottom: number
  left: number
}

interface DetailContent {
  key: string
  title: string
  eyebrow: string
  body: string
  anchor: DetailAnchor
}

interface PopoverPosition {
  top: number
  left: number
}

type Detail = DetailContent | null

const attributeLabels: Readonly<Record<CharacterAttributeId, string>> = {
  might: 'Might',
  finesse: 'Finesse',
  vitality: 'Vitality',
  agility: 'Agility',
  intellect: 'Intellect',
  resolve: 'Resolve',
}

const attributeDescriptions: Readonly<Record<CharacterAttributeId, string>> = {
  might: 'Force that breaks. Courage that leads.',
  finesse: 'Precision in motion. Mastery in detail.',
  vitality: 'Endurance through all things.',
  agility: 'Swiftness creates new paths.',
  intellect: 'Knowledge reveals the unseen.',
  resolve: 'A steady heart defies the void.',
}

const attributeIconSources: Readonly<Record<CharacterAttributeId, string>> = {
  might: '/media/profile/might.svg',
  finesse: '/media/profile/finesse.svg',
  vitality: '/media/profile/vitality.svg',
  agility: '/media/profile/agility.svg',
  intellect: '/media/profile/intellect.svg',
  resolve: '/media/profile/resolve.svg',
}

const factIconSources = {
  gender: '/media/profile/gender.svg',
  rekindling: '/media/profile/rekindling.svg',
} as const

const ATTRIBUTE_COLORS: Readonly<
  Record<CharacterAttributeId, { solid: string; tint: string; soft: string }>
> = {
  might: { solid: '#b83a36', tint: 'rgba(184, 58, 54, 0.18)', soft: 'rgba(184, 58, 54, 0.08)' },
  finesse: {
    solid: '#53687d',
    tint: 'rgba(83, 104, 125, 0.17)',
    soft: 'rgba(83, 104, 125, 0.07)',
  },
  vitality: {
    solid: '#26874d',
    tint: 'rgba(38, 135, 77, 0.17)',
    soft: 'rgba(38, 135, 77, 0.07)',
  },
  agility: {
    solid: '#b7862f',
    tint: 'rgba(183, 134, 47, 0.18)',
    soft: 'rgba(183, 134, 47, 0.07)',
  },
  intellect: {
    solid: '#7648a8',
    tint: 'rgba(118, 72, 168, 0.17)',
    soft: 'rgba(118, 72, 168, 0.07)',
  },
  resolve: {
    solid: '#2872a8',
    tint: 'rgba(40, 114, 168, 0.17)',
    soft: 'rgba(40, 114, 168, 0.07)',
  },
}

const ATTRIBUTE_STAT_GROUPS: Readonly<Record<CharacterAttributeId, readonly DerivedStatId[]>> = {
  might: ['physicalPower'],
  finesse: ['accuracy', 'criticalChance'],
  vitality: ['maxHp', 'armor'],
  agility: ['initiative', 'movement', 'jump', 'evasion'],
  intellect: ['maxMp', 'mysticPower'],
  resolve: ['ward', 'statusResistance'],
}

const statGlyphs: Readonly<Record<DerivedStatId, string>> = {
  maxHp: '♥',
  maxMp: '◇',
  physicalPower: '⚔',
  mysticPower: '◉',
  armor: '⬟',
  ward: '◇',
  accuracy: '◎',
  evasion: '↗',
  criticalChance: '✷',
  initiative: '⌛',
  movement: '⌁',
  jump: '⇈',
  statusResistance: '❄',
}

export function CharacterProfileDetails({
  presentationLabel,
  buildTypeLabel,
  cycleNumber,
  attributes,
  derived,
  attributeResetControl,
}: CharacterProfileDetailsProps) {
  const [detail, setDetail] = useState<Detail>(null)
  const [rekindlingOpen, setRekindlingOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null)
  const popoverRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const dismissDetail = () => {
    setDetail(null)
    setPopoverPosition(null)
    triggerRef.current = null
  }

  const openDetail = (
    trigger: HTMLButtonElement,
    key: string,
    content: Omit<DetailContent, 'key' | 'anchor'>,
  ) => {
    if (detail?.key === key) {
      dismissDetail()
      return
    }

    const rect = trigger.getBoundingClientRect()
    triggerRef.current = trigger
    setPopoverPosition(null)
    setDetail({
      ...content,
      key,
      anchor: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      },
    })
  }

  useLayoutEffect(() => {
    if (!detail || !popoverRef.current) return

    const popover = popoverRef.current.getBoundingClientRect()
    const padding = 12
    const gap = 8
    const maxLeft = Math.max(padding, window.innerWidth - popover.width - padding)

    let left: number
    let top: number

    if (window.innerWidth <= 760) {
      left = Math.min(Math.max(detail.anchor.left, padding), maxLeft)
      const below = detail.anchor.bottom + gap
      const above = detail.anchor.top - popover.height - gap
      top =
        below + popover.height <= window.innerHeight - padding ? below : Math.max(padding, above)
    } else {
      const right = detail.anchor.right + gap
      const leftSide = detail.anchor.left - popover.width - gap

      if (right + popover.width <= window.innerWidth - padding) {
        left = right
      } else if (leftSide >= padding) {
        left = leftSide
      } else {
        left = Math.min(Math.max(detail.anchor.left, padding), maxLeft)
      }

      top = Math.min(
        Math.max(detail.anchor.top, padding),
        Math.max(padding, window.innerHeight - popover.height - padding),
      )
    }

    setPopoverPosition({ top, left })
  }, [detail])

  useEffect(() => {
    if (!rekindlingOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRekindlingOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [rekindlingOpen])

  useEffect(() => {
    if (!detail) return

    const dismiss = () => {
      setDetail(null)
      setPopoverPosition(null)
      triggerRef.current = null
    }

    const closeOnOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (popoverRef.current?.contains(event.target)) return
      if (triggerRef.current?.contains(event.target)) return
      dismiss()
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }

    const closeOnViewportChange = () => dismiss()

    document.addEventListener('pointerdown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportChange)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportChange)
    }
  }, [detail])

  return (
    <div className={styles.details}>
      <div
        className={styles.identityFacts}
        data-profile-facts
        aria-label="Character identity details"
      >
        <div className={styles.identityFact} data-profile-fact>
          <span className={styles.factGlyph} aria-hidden="true">
            <Image
              className={styles.factIcon}
              src={factIconSources.gender}
              width={96}
              height={96}
              sizes="2rem"
              alt=""
            />
          </span>
          <span className={styles.factCopy}>
            <small>Gender</small>
            <strong>{presentationLabel}</strong>
          </span>
        </div>
        <div className={styles.identityFact} data-profile-fact data-build-type={buildTypeLabel}>
          <span className={`${styles.factGlyph} ${styles.buildGlyph}`} aria-hidden="true">
            <span>{buildTypeLabel === 'Hybrid Build' ? '∞' : '✦'}</span>
          </span>
          <span className={styles.factCopy}>
            <small>Build Type</small>
            <strong>{buildTypeLabel}</strong>
          </span>
        </div>
        <button
          type="button"
          className={styles.identityFact}
          data-profile-fact
          aria-haspopup="dialog"
          aria-expanded={rekindlingOpen}
          aria-controls={rekindlingOpen ? 'rekindling-cycle-dialog' : undefined}
          onClick={() => {
            dismissDetail()
            setRekindlingOpen(true)
          }}
        >
          <span className={styles.factGlyph} aria-hidden="true">
            <Image
              className={styles.factIcon}
              src={factIconSources.rekindling}
              width={96}
              height={96}
              sizes="2rem"
              alt=""
            />
          </span>
          <span className={styles.factCopy}>
            <small>Rekindling Cycle</small>
            <strong>{cycleNumber}</strong>
          </span>
        </button>
      </div>

      <section className={styles.section} data-profile-section aria-labelledby="attributes-title">
        <header className={styles.sectionHeader} data-profile-section-header>
          <div className={styles.sectionTitleLine}>
            <span className={styles.sectionMarker} aria-hidden="true">
              ✧
            </span>
            <div>
              <h2 id="attributes-title">Core Attributes</h2>
              <p>Your innate potential, shaping what you can become.</p>
            </div>
            <i aria-hidden="true" />
          </div>
          <small>The sixfold nature endures.</small>
        </header>

        <div className={styles.attributeList}>
          {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
            const color = ATTRIBUTE_COLORS[attributeId]
            const style = {
              '--attribute-color': color.solid,
              '--attribute-tint': color.tint,
              '--attribute-soft': color.soft,
            } as CSSProperties
            return (
              <button
                key={attributeId}
                type="button"
                data-testid={`profile-attribute-${attributeId}`}
                data-attribute={attributeId}
                style={style}
                aria-haspopup="dialog"
                aria-expanded={detail?.key === `attribute:${attributeId}`}
                aria-controls={
                  detail?.key === `attribute:${attributeId}` ? 'profile-detail-popover' : undefined
                }
                onClick={(event) =>
                  openDetail(event.currentTarget, `attribute:${attributeId}`, {
                    eyebrow: 'Core attribute',
                    title: attributeLabels[attributeId],
                    body: ATTRIBUTE_PROFILE_HELP[attributeId],
                  })
                }
              >
                <span className={styles.attributeGlyph} aria-hidden="true">
                  <Image
                    className={styles.attributeIcon}
                    src={attributeIconSources[attributeId]}
                    width={96}
                    height={96}
                    sizes="2.2rem"
                    alt=""
                  />
                </span>
                <span className={styles.attributeName}>{attributeLabels[attributeId]}</span>
                <em>{attributeDescriptions[attributeId]}</em>
                <strong>{attributes[attributeId]}</strong>
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.section} data-profile-section aria-labelledby="derived-title">
        <header className={styles.sectionHeader} data-profile-section-header>
          <div className={styles.sectionTitleLine}>
            <span className={styles.sectionMarker} aria-hidden="true">
              ✧
            </span>
            <div>
              <h2 id="derived-title">Combat &amp; Adventure Stats</h2>
              <p>Capabilities derived from your attributes, refined through experience.</p>
            </div>
            <i aria-hidden="true" />
          </div>
          {attributeResetControl ? (
            <div className={styles.sectionAction}>{attributeResetControl}</div>
          ) : null}
        </header>

        <div className={styles.statGroups} data-profile-stat-groups>
          {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
            const color = ATTRIBUTE_COLORS[attributeId]
            const style = {
              '--attribute-color': color.solid,
              '--attribute-tint': color.tint,
              '--attribute-soft': color.soft,
            } as CSSProperties
            return (
              <section
                className={styles.statGroup}
                key={attributeId}
                data-profile-stat-group={attributeId}
                style={style}
                aria-label={`${attributeLabels[attributeId]} derived statistics`}
              >
                <header>
                  <span className={styles.statGroupIcon} aria-hidden="true">
                    <Image
                      className={styles.attributeIcon}
                      src={attributeIconSources[attributeId]}
                      width={72}
                      height={72}
                      sizes="1.4rem"
                      alt=""
                    />
                  </span>
                  <strong>{attributeLabels[attributeId]}</strong>
                </header>
                <div>
                  {ATTRIBUTE_STAT_GROUPS[attributeId].map((statId) => {
                    const stat = derived.stats[statId]
                    const formattedValue = formatDerivedStat(stat)
                    return (
                      <button
                        key={statId}
                        type="button"
                        data-testid={`derived-stat-${statId}`}
                        aria-label={`${stat.label}, ${formattedValue}. Select for details.`}
                        aria-haspopup="dialog"
                        aria-expanded={detail?.key === `stat:${statId}`}
                        aria-controls={
                          detail?.key === `stat:${statId}` ? 'profile-detail-popover' : undefined
                        }
                        onClick={(event) =>
                          openDetail(event.currentTarget, `stat:${statId}`, {
                            eyebrow: `${attributeLabels[attributeId]} capability`,
                            title: stat.label,
                            body: DERIVED_STAT_PROFILE_HELP[statId],
                          })
                        }
                      >
                        <span aria-hidden="true">{statGlyphs[statId]}</span>
                        <span>{stat.label}</span>
                        <strong>{formattedValue}</strong>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </section>

      {rekindlingOpen ? (
        <div
          className={styles.recordBackdrop}
          role="presentation"
          onPointerDown={() => setRekindlingOpen(false)}
        >
          <section
            id="rekindling-cycle-dialog"
            className={styles.recordDialog}
            data-av-surface="moonstone"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rekindling-cycle-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>Rekindling record</span>
            <h2 id="rekindling-cycle-title">{`Rekindling Cycle ${cycleNumber}`}</h2>
            <p>
              A Rekindling Cycle is the numbered era of this character’s long-term progression
              record. It preserves history across later Rekindlings without mixing separate
              progression eras.
            </p>
            <button type="button" onClick={() => setRekindlingOpen(false)}>
              Close
            </button>
          </section>
        </div>
      ) : null}

      {detail ? (
        <section
          ref={popoverRef}
          id="profile-detail-popover"
          className={styles.detailPopover}
          data-profile-stat-popover="true"
          data-positioned={popoverPosition ? 'true' : 'false'}
          role="dialog"
          aria-labelledby="profile-detail-title"
          style={
            popoverPosition
              ? {
                  top: popoverPosition.top,
                  left: popoverPosition.left,
                }
              : undefined
          }
        >
          <span>{detail.eyebrow}</span>
          <h2 id="profile-detail-title">{detail.title}</h2>
          <p>{detail.body}</p>
        </section>
      ) : null}
    </div>
  )
}

function formatDerivedStat(stat: DerivedStatValue): string {
  if (stat.unit === 'basisPoints') {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(stat.value / 100)}%`
  }
  if (stat.unit === 'steps') return `${stat.value}`
  return new Intl.NumberFormat('en').format(stat.value)
}
