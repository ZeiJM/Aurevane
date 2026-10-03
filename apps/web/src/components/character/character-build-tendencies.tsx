'use client'

import type { CharacterAttributes } from '@aurevane/game-core/character/creation'
import type { ProfileDetailContent } from './character-profile-details'
import styles from './character-build-tendencies.module.css'

const axes = [
  {
    attribute: 'might',
    label: 'Damage',
    description: 'Might · physical power',
    help: 'Favors characters who overwhelm opponents with strong physical attacks.',
    color: '#b83a36',
  },
  {
    attribute: 'finesse',
    label: 'Precision',
    description: 'Finesse · accuracy and critical chance',
    help: 'Favors characters who rely on accurate strikes and critical hits.',
    color: '#53687d',
  },
  {
    attribute: 'vitality',
    label: 'Defense',
    description: 'Vitality · HP and armor',
    help: 'Favors durable frontline characters who can withstand physical punishment.',
    color: '#26874d',
  },
  {
    attribute: 'agility',
    label: 'Mobility',
    description: 'Agility · movement, initiative and evasion',
    help: 'Favors agile characters who act early, reposition and evade attacks.',
    color: '#b7862f',
  },
  {
    attribute: 'intellect',
    label: 'Arcane',
    description: 'Intellect · MP and mystic power',
    help: 'Favors spellcasters who draw on deep MP reserves and mystic power.',
    color: '#7648a8',
  },
  {
    attribute: 'resolve',
    label: 'Tenacity',
    description: 'Resolve · ward and status resistance',
    help: 'Favors steadfast characters who resist mystic attacks and hostile status effects.',
    color: '#2872a8',
  },
] as const

export function coreStatTendencies(attributes: CharacterAttributes): readonly number[] {
  const values = axes.map(({ attribute }) => Math.max(0, attributes[attribute]))
  const highest = Math.max(1, ...values)
  return values.map((value) => value / highest)
}

function point(index: number, radius: number) {
  const angle = (index * Math.PI) / 3 - Math.PI / 2
  return { x: 180 + Math.cos(angle) * radius, y: 180 + Math.sin(angle) * radius }
}

export function CharacterBuildTendencies({
  attributes,
  onAxisSelect,
}: {
  attributes: CharacterAttributes
  onAxisSelect?: (anchor: Element, content: ProfileDetailContent) => void
}) {
  const values = coreStatTendencies(attributes)
  const shape = values
    .map((value, index) => {
      const p = point(index, 105 * value)
      return `${p.x},${p.y}`
    })
    .join(' ')
  return (
    <section
      className={styles.panel}
      data-testid="profile-build-tendencies"
      aria-labelledby="build-tendencies-heading"
    >
      <h2 id="build-tendencies-heading">Build Tendencies</h2>
      <p>Relative core-stat emphasis</p>
      <svg
        viewBox="0 0 360 360"
        role="group"
        aria-labelledby="build-tendencies-title build-tendencies-description"
      >
        <title id="build-tendencies-title">Character core-stat tendencies</title>
        <desc id="build-tendencies-description">
          Each axis follows one Core Stat, scaled to the character’s highest Core Stat. This shows
          build emphasis, not predicted damage or skill effectiveness.{' '}
          {axes.map(({ attribute, label }) => `${label}: ${attributes[attribute]}`).join('; ')}.
        </desc>
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <circle key={level} cx="180" cy="180" r={105 * level} className={styles.ring} />
        ))}
        <circle cx="180" cy="180" r="110" className={styles.outerRing} />
        {axes.map((axis, index) => {
          const end = point(index, 105)
          return (
            <line
              key={axis.attribute}
              x1="180"
              y1="180"
              x2={end.x}
              y2={end.y}
              className={styles.spoke}
            />
          )
        })}
        <polygon points={shape} className={styles.shape} />
        {axes.map((axis, index) => {
          const vertex = point(index, values[index] * 105)
          const label = point(index, 140)
          const end = point(index, 105)
          const openAxis = (anchor: Element) =>
            onAxisSelect?.(anchor, {
              eyebrow: 'Build tendency',
              title: axis.label,
              body: axis.help,
            })
          return (
            <g
              key={axis.attribute}
              className={styles.axis}
              role="button"
              tabIndex={0}
              aria-label={`About ${axis.label} tendency`}
              aria-haspopup="dialog"
              onClick={(event) => openAxis(event.currentTarget)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openAxis(event.currentTarget)
                }
              }}
            >
              <line x1="180" y1="180" x2={end.x} y2={end.y} className={styles.axisHitTarget} />
              <rect
                x={label.x - 48}
                y={label.y - 14}
                width="96"
                height="44"
                rx="4"
                className={styles.labelHitTarget}
              />
              <circle
                cx={vertex.x}
                cy={vertex.y}
                r="4"
                fill={axis.color}
                stroke="#f0e4cb"
                strokeWidth="1.5"
              >
                <title>{`${axis.description}: ${attributes[axis.attribute]}`}</title>
              </circle>
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.label}
              >
                {axis.label}
              </text>
              <text x={label.x} y={label.y + 16} textAnchor="middle" className={styles.value}>
                {attributes[axis.attribute]}
              </text>
            </g>
          )
        })}
      </svg>
      <small>Each axis reflects its related Core Stat, relative to your highest stat.</small>
    </section>
  )
}
