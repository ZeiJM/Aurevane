'use client'

import {
  CHARACTER_ATTRIBUTE_IDS,
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
import { useEffect, useState } from 'react'

import styles from './character-profile-details.module.css'

interface CharacterProfileDetailsProps {
  slotIndex: number
  presentationLabel: string
  pronounLabel: string
  cycleNumber: number
  attributes: CharacterAttributes
  derived: DerivedStatSnapshot
}

type Detail = { title: string; eyebrow: string; body: string } | null

const attributeLabels = {
  might: 'Might',
  finesse: 'Finesse',
  vitality: 'Vitality',
  agility: 'Agility',
  intellect: 'Intellect',
  resolve: 'Resolve',
} as const

export function CharacterProfileDetails({
  slotIndex,
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
        <button
          type="button"
          onClick={() =>
            setDetail({
              eyebrow: 'Character record',
              title: `Slot ${slotIndex + 1}`,
              body: 'A slot is this character’s place on your account roster. Slots keep separate characters, progression, identity, and battle state from one another.',
            })
          }
        >
          <span>Roster slot</span>
          <strong>{slotIndex + 1}</strong>
        </button>
        <div>
          <span>Presentation</span>
          <strong>{presentationLabel}</strong>
        </div>
        <div>
          <span>Pronouns</span>
          <strong>{pronounLabel}</strong>
        </div>
        <button
          type="button"
          onClick={() =>
            setDetail({
              eyebrow: 'Progression record',
              title: `Cycle ${cycleNumber}`,
              body: 'A progression cycle is the numbered era of this character’s long-term progression record. It lets future progression resets or major seasonal rules preserve history without mixing separate progression eras.',
            })
          }
        >
          <span>Progression cycle</span>
          <strong>{cycleNumber}</strong>
        </button>
      </div>

      <section className={styles.section} aria-labelledby="attributes-title">
        <header>
          <div>
            <span>Core attributes</span>
            <h2 id="attributes-title">Character strengths</h2>
          </div>
          <small>Select any attribute for battle-system details.</small>
        </header>
        <div className={styles.attributeGrid}>
          {CHARACTER_ATTRIBUTE_IDS.map((attributeId) => (
            <button
              key={attributeId}
              type="button"
              data-testid={`profile-attribute-${attributeId}`}
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
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="derived-title">
        <header>
          <div>
            <span>Combat &amp; adventure stats</span>
            <h2 id="derived-title">Current values</h2>
          </div>
          <small>Select a stat to see what it means in combat.</small>
        </header>
        <div className={styles.statGroups}>
          {DERIVED_STAT_PROFILE_GROUPS.map((group) => (
            <section className={styles.statGroup} key={group.id} aria-label={group.label}>
              <h3>{group.label}</h3>
              <div>
                {group.statIds.map((statId) => {
                  const stat = derived.stats[statId]
                  return (
                    <button
                      key={statId}
                      type="button"
                      data-testid={`derived-stat-${statId}`}
                      onClick={() =>
                        setDetail({
                          eyebrow: group.label,
                          title: stat.label,
                          body: DERIVED_STAT_PROFILE_HELP[statId],
                        })
                      }
                    >
                      <span>{stat.label}</span>
                      <strong>{formatDerivedStat(stat)}</strong>
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

function formatDerivedStat(stat: DerivedStatValue): string {
  if (stat.unit === 'basisPoints') {
    return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(stat.value / 100)}%`
  }
  if (stat.unit === 'steps') return `${stat.value}`
  return new Intl.NumberFormat('en').format(stat.value)
}
