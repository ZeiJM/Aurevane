import type { CharacterAttributes } from '@aurevane/game-core/character/creation'
import styles from './character-build-tendencies.module.css'

const axes = [
  {
    attribute: 'might',
    label: 'Damage',
    description: 'Might · physical power',
    color: '#b83a36',
  },
  {
    attribute: 'finesse',
    label: 'Precision',
    description: 'Finesse · accuracy and critical chance',
    color: '#53687d',
  },
  {
    attribute: 'vitality',
    label: 'Defense',
    description: 'Vitality · HP and armor',
    color: '#26874d',
  },
  {
    attribute: 'agility',
    label: 'Mobility',
    description: 'Agility · movement, initiative and evasion',
    color: '#b7862f',
  },
  {
    attribute: 'intellect',
    label: 'Arcane',
    description: 'Intellect · MP and mystic power',
    color: '#7648a8',
  },
  {
    attribute: 'resolve',
    label: 'Tenacity',
    description: 'Resolve · ward and status resistance',
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

export function CharacterBuildTendencies({ attributes }: { attributes: CharacterAttributes }) {
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
        role="img"
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
          return (
            <g key={axis.attribute}>
              <circle
                cx={vertex.x}
                cy={vertex.y}
                r="4"
                fill={axis.color}
                stroke="#f0e4cb"
                strokeWidth="1.5"
              >
                <title>
                  {axis.description}: {attributes[axis.attribute]}
                </title>
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
