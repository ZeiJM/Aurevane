'use client'

import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import type {
  DerivedStatSnapshot,
  DerivedStatValue,
} from '@aurevane/game-core/character/derived-stats'
import {
  ATTRIBUTE_PROFILE_HELP,
  DERIVED_STAT_PROFILE_GROUPS,
  DERIVED_STAT_PROFILE_HELP,
} from '@aurevane/game-core/character/profile-stat-content'
import { useEffect, useState, type CSSProperties } from 'react'

import styles from './character-profile-details.module.css'

interface CharacterProfileDetailsProps {
  presentationLabel: string
  pronounLabel: string
  cycleNumber: number
  attributes: CharacterAttributes
  derived: DerivedStatSnapshot
}

type Detail = { title: string; eyebrow: string; body: string } | null

type AttributeSource = {
  id: CharacterAttributeId
  weight: number
}

const attributeLabels = {
  might: 'Might',
  finesse: 'Finesse',
  vitality: 'Vitality',
  agility: 'Agility',
  intellect: 'Intellect',
  resolve: 'Resolve',
} as const

const ATTRIBUTE_COLORS: Readonly<
  Record<CharacterAttributeId, { solid: string; tint: string; soft: string }>
> = {
  might: { solid: '#ff756e', tint: 'rgba(255, 117, 110, 0.28)', soft: 'rgba(255, 117, 110, 0.12)' },
  finesse: {
    solid: '#d7dde6',
    tint: 'rgba(215, 221, 230, 0.24)',
    soft: 'rgba(215, 221, 230, 0.10)',
  },
  vitality: {
    solid: '#78e183',
    tint: 'rgba(120, 225, 131, 0.28)',
    soft: 'rgba(120, 225, 131, 0.12)',
  },
  agility: {
    solid: '#f6df67',
    tint: 'rgba(246, 223, 103, 0.28)',
    soft: 'rgba(246, 223, 103, 0.12)',
  },
  intellect: {
    solid: '#ca8dff',
    tint: 'rgba(202, 141, 255, 0.28)',
    soft: 'rgba(202, 141, 255, 0.12)',
  },
  resolve: {
    solid: '#78b0ff',
    tint: 'rgba(120, 176, 255, 0.28)',
    soft: 'rgba(120, 176, 255, 0.12)',
  },
}

const DERIVED_STAT_GROUP_ORDER = {
  vitals: 0,
  tempo: 1,
  offense: 2,
  defense: 3,
} as const

const orderedDerivedStatGroups = [...DERIVED_STAT_PROFILE_GROUPS].sort(
  (left, right) => DERIVED_STAT_GROUP_ORDER[left.id] - DERIVED_STAT_GROUP_ORDER[right.id],
)

export function CharacterProfileDetails({
  presentationLabel,
  pronounLabel,
  cycleNumber,
  attributes,
  derived,
}: CharacterProfileDetailsProps) {
  const [detail, setDetail] = useState<Detail>(null)

  useEffect(() => {
    if (!detail) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [detail])

  return (
    <>
      <div className={styles.identityFacts} aria-label="Character identity details">
        <div>
          <span>Gender</span>
          <strong>{presentationLabel}</strong>
        </div>
        <div>
          <span>Pronouns</span>
          <strong>{pronounLabel}</strong>
        </div>
        <button
          type="button"
          style={{ gridColumn: 'span 2', borderRight: 0 }}
          onClick={() =>
            setDetail({
              eyebrow: 'Rekindling record',
              title: `Rekindling Cycle ${cycleNumber}`,
              body: 'A Rekindling Cycle is the numbered era of this character’s long-term progression record. It preserves history across later Rekindlings without mixing separate progression eras.',
            })
          }
        >
          <span>Rekindling Cycle</span>
          <strong>{cycleNumber}</strong>
        </button>
      </div>

      <section className={styles.section} aria-labelledby="attributes-title">
        <header>
          <h2 id="attributes-title">Core Attributes</h2>
        </header>
        <div className={styles.attributeGrid}>
          {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => {
            const color = ATTRIBUTE_COLORS[attributeId]
            const style = {
              '--attribute-color': color.solid,
              '--attribute-tint': color.tint,
              alignItems: 'center',
            } as CSSProperties
            return (
              <button
                key={attributeId}
                type="button"
                data-testid={`profile-attribute-${attributeId}`}
                data-attribute={attributeId}
                style={style}
                onClick={() =>
                  setDetail({
                    eyebrow: 'Core attribute',
                    title: attributeLabels[attributeId],
                    body: ATTRIBUTE_PROFILE_HELP[attributeId],
                  })
                }
              >
                <span>{attributeLabels[attributeId]}</span>
                <strong>{attributes[attributeId]}</strong>
              </button>
            )
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="derived-title">
        <header>
          <h2 id="derived-title">Combat &amp; Adventure Stats</h2>
        </header>
        <div className={styles.statGroups}>
          {orderedDerivedStatGroups.map((group) => (
            <section className={styles.statGroup} key={group.id} aria-label={group.label}>
              <h3>{group.label}</h3>
              <div>
                {group.statIds.map((statId) => {
                  const stat = derived.stats[statId]
                  const sources = getAttributeSources(stat)
                  const style = {
                    '--lineage-background': createLineageBackground(sources),
                    '--lineage-border': createLineageBorder(sources),
                  } as CSSProperties
                  const lineageLabel = sources.length
                    ? `Influenced by ${sources.map((source) => attributeLabels[source.id]).join(' and ')}`
                    : 'No core attribute influence'

                  return (
                    <button
                      key={statId}
                      type="button"
                      data-testid={`derived-stat-${statId}`}
                      data-source-count={sources.length}
                      style={style}
                      title={lineageLabel}
                      onClick={() =>
                        setDetail({
                          eyebrow: group.label,
                          title: stat.label,
                          body: DERIVED_STAT_PROFILE_HELP[statId],
                        })
                      }
                    >
                      <span className={styles.statLabel}>{stat.label}</span>
                      <strong>{formatDerivedStat(stat)}</strong>
                      {sources.length > 0 ? (
                        <>
                          <span className={styles.lineage} aria-label={lineageLabel}>
                            {sources.map((source) => (
                              <i
                                key={source.id}
                                title={attributeLabels[source.id]}
                                style={
                                  {
                                    '--source-color': ATTRIBUTE_COLORS[source.id].solid,
                                  } as CSSProperties
                                }
                              />
                            ))}
                          </span>
                          <span className={styles.lineageRail} aria-hidden="true">
                            {sources.map((source) => (
                              <i
                                key={source.id}
                                style={
                                  {
                                    '--source-color': ATTRIBUTE_COLORS[source.id].solid,
                                    flexGrow: source.weight,
                                  } as CSSProperties
                                }
                              />
                            ))}
                          </span>
                        </>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      {detail ? (
        <div className={styles.backdrop} role="presentation" onPointerDown={() => setDetail(null)}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-detail-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>{detail.eyebrow}</span>
            <h2 id="profile-detail-title">{detail.title}</h2>
            <p>{detail.body}</p>
            <button type="button" onClick={() => setDetail(null)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}

function getAttributeSources(stat: DerivedStatValue): readonly AttributeSource[] {
  return stat.contributions
    .filter((contribution) => contribution.sourceKind === 'attribute')
    .map((contribution) => {
      const id = contribution.sourceId.replace('character.attribute.', '') as CharacterAttributeId
      return { id, weight: Math.abs(contribution.coefficient) }
    })
    .filter((source) => CHARACTER_ATTRIBUTE_IDS.includes(source.id) && source.weight > 0)
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
}

function createLineageBackground(sources: readonly AttributeSource[]): string {
  if (sources.length === 0) return '#080b10'
  if (sources.length === 1) {
    const color = ATTRIBUTE_COLORS[sources[0].id]
    return `linear-gradient(145deg, ${color.tint} 0%, ${color.soft} 48%, rgba(8, 11, 16, 0.96) 100%)`
  }

  const totalWeight = sources.reduce((total, source) => total + source.weight, 0)
  let cursor = 0
  const stops: string[] = []
  for (const source of sources) {
    const start = cursor
    cursor += (source.weight / totalWeight) * 100
    const end = cursor
    const color = ATTRIBUTE_COLORS[source.id].soft
    stops.push(`${color} ${start.toFixed(1)}%`, `${color} ${end.toFixed(1)}%`)
  }
  return `linear-gradient(135deg, ${stops.join(', ')})`
}

function createLineageBorder(sources: readonly AttributeSource[]): string {
  if (sources.length === 0) return 'var(--av-border)'
  return ATTRIBUTE_COLORS[sources[0].id].solid
}

function formatDerivedStat(stat: DerivedStatValue): string {
  if (stat.unit === 'basisPoints') {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(stat.value / 100)}%`
  }
  if (stat.unit === 'steps') return `${stat.value}`
  return new Intl.NumberFormat('en').format(stat.value)
}
