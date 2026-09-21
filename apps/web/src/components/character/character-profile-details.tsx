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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import styles from './character-profile-details.module.css'

interface CharacterProfileDetailsProps {
  presentationLabel: string
  buildTypeLabel: 'Resonance Build' | 'Essence Build'
  cycleNumber: number
  attributes: CharacterAttributes
  derived: DerivedStatSnapshot
  attributeResetControl?: ReactNode
}

interface DetailContent {
  title: string
  eyebrow: string
  body: string
}

type Detail = (DetailContent & { anchor: HTMLElement }) | null

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
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)
  const popoverRef = useRef<HTMLElement>(null)

  function openDetail(anchor: HTMLElement, content: DetailContent) {
    setPopoverPosition(null)
    setDetail({ ...content, anchor })
  }

  useEffect(() => {
    if (!detail) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !popoverRef.current?.contains(event.target)) {
        setDetail(null)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null)
    }
    document.addEventListener('pointerdown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [detail])

  useEffect(() => {
    if (!detail) return
    const placePopover = () => {
      const popover = popoverRef.current
      if (!popover || !document.documentElement.contains(detail.anchor)) return

      const anchorRect = detail.anchor.getBoundingClientRect()
      const popoverRect = popover.getBoundingClientRect()
      const inset = 12
      const gap = 8
      let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2
      left = Math.min(
        Math.max(inset, left),
        Math.max(inset, window.innerWidth - popoverRect.width - inset),
      )

      let top = anchorRect.bottom + gap
      if (top + popoverRect.height > window.innerHeight - inset) {
        top = Math.max(inset, anchorRect.top - popoverRect.height - gap)
      }
      setPopoverPosition({ top, left })
    }

    const frame = window.requestAnimationFrame(placePopover)
    window.addEventListener('resize', placePopover)
    window.addEventListener('scroll', placePopover, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', placePopover)
      window.removeEventListener('scroll', placePopover, true)
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
            <span>{buildTypeLabel === 'Resonance Build' ? '∞' : '✦'}</span>
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
          onClick={(event) =>
            openDetail(event.currentTarget, {
              eyebrow: 'Rekindling record',
              title: `Rekindling Cycle ${cycleNumber}`,
              body: 'A Rekindling Cycle is the numbered era of this character’s long-term progression record. It preserves history across later Rekindlings without mixing separate progression eras.',
            })
          }
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
          <span className={`${styles.factCopy} ${styles.cycleCopy}`}>
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
                onClick={(event) =>
                  openDetail(event.currentTarget, {
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
                        onClick={(event) =>
                          openDetail(event.currentTarget, {
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

      {detail ? (
        <section
          ref={popoverRef}
          className={styles.detailPopover}
          data-testid="profile-detail-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="profile-detail-title"
          style={{
            top: popoverPosition?.top ?? 0,
            left: popoverPosition?.left ?? 0,
            visibility: popoverPosition ? 'visible' : 'hidden',
          }}
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
