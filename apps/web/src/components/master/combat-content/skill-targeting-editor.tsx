'use client'

import type {
  CombatFriendlyFirePolicy,
  CombatTargetKind,
  CombatTargetShape,
  CombatTargetSpec,
  CombatTargetTeamPolicy,
} from '@aurevane/game-core/combat/actions'

import styles from './combat-content-editor.module.css'

export interface SkillTargetingEditorProps {
  readonly value: CombatTargetSpec
  readonly onChange: (value: CombatTargetSpec) => void
}

const TARGET_KINDS: readonly { value: CombatTargetKind; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'unit', label: 'Unit' },
  { value: 'ground-tile', label: 'Ground' },
  { value: 'empty-tile', label: 'Empty Tile' },
]

const TEAM_POLICIES: readonly { value: CombatTargetTeamPolicy; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'ally', label: 'Ally' },
  { value: 'enemy', label: 'Enemy' },
  { value: 'any', label: 'Anyone' },
]

const FRIENDLY_FIRE_POLICIES: readonly {
  value: CombatFriendlyFirePolicy
  label: string
}[] = [
  { value: 'enemies-only', label: 'Enemies only' },
  { value: 'allies-only', label: 'Allies only' },
  { value: 'all-units', label: 'All units' },
  { value: 'all-except-actor', label: 'All except actor' },
]

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function shapeForKind(
  kind: CombatTargetShape['kind'],
  current: CombatTargetShape,
): CombatTargetShape {
  if (kind === 'single') return { kind: 'single' }
  if (kind === 'circle') {
    return { kind: 'circle', radius: current.kind === 'circle' ? current.radius : 1 }
  }
  return { kind: 'line', length: current.kind === 'line' ? current.length : 1 }
}

export function SkillTargetingEditor({ value, onChange }: SkillTargetingEditorProps) {
  const shape = value.shape
  const invalidRange = value.minimumRange > value.maximumRange

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Targeting</legend>

      <div className={styles.typedGrid}>
        <label className={styles.field}>
          <span>Target kind</span>
          <select
            aria-label="Target kind"
            value={value.kind}
            onChange={(event) =>
              onChange({
                ...value,
                kind: event.currentTarget.value as CombatTargetKind,
              })
            }
          >
            {TARGET_KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Team policy</span>
          <select
            aria-label="Team policy"
            value={value.teamPolicy}
            onChange={(event) =>
              onChange({
                ...value,
                teamPolicy: event.currentTarget.value as CombatTargetTeamPolicy,
              })
            }
          >
            {TEAM_POLICIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Shape</span>
          <select
            aria-label="Target shape"
            value={shape.kind}
            onChange={(event) =>
              onChange({
                ...value,
                shape: shapeForKind(event.currentTarget.value as CombatTargetShape['kind'], shape),
              })
            }
          >
            <option value="single">Single</option>
            <option value="circle">Circle</option>
            <option value="line">Line</option>
          </select>
        </label>

        {shape.kind === 'circle' ? (
          <label className={styles.field}>
            <span>Circle radius</span>
            <input
              aria-label="Circle radius"
              type="number"
              min={0}
              value={shape.radius}
              onChange={(event) =>
                onChange({
                  ...value,
                  shape: {
                    kind: 'circle',
                    radius: integer(event.currentTarget.value, shape.radius),
                  },
                })
              }
            />
          </label>
        ) : null}

        {shape.kind === 'line' ? (
          <label className={styles.field}>
            <span>Line length</span>
            <input
              aria-label="Line length"
              type="number"
              min={1}
              value={shape.length}
              onChange={(event) =>
                onChange({
                  ...value,
                  shape: {
                    kind: 'line',
                    length: integer(event.currentTarget.value, shape.length),
                  },
                })
              }
            />
          </label>
        ) : null}

        <label className={styles.field}>
          <span>Minimum range</span>
          <input
            aria-label="Minimum range"
            aria-invalid={invalidRange}
            type="number"
            min={0}
            value={value.minimumRange}
            onChange={(event) =>
              onChange({
                ...value,
                minimumRange: integer(event.currentTarget.value, value.minimumRange),
              })
            }
          />
        </label>

        <label className={styles.field}>
          <span>Maximum range</span>
          <input
            aria-label="Maximum range"
            aria-invalid={invalidRange}
            type="number"
            min={0}
            value={value.maximumRange}
            onChange={(event) =>
              onChange({
                ...value,
                maximumRange: integer(event.currentTarget.value, value.maximumRange),
              })
            }
          />
        </label>

        <label className={styles.field}>
          <span>Maximum elevation difference</span>
          <input
            aria-label="Maximum elevation difference"
            type="number"
            min={0}
            value={value.maximumElevationDifference ?? ''}
            placeholder="Unlimited"
            onChange={(event) =>
              onChange({
                ...value,
                maximumElevationDifference:
                  event.currentTarget.value === ''
                    ? null
                    : integer(event.currentTarget.value, value.maximumElevationDifference ?? 0),
              })
            }
          />
        </label>

        <label className={styles.field}>
          <span>Friendly fire</span>
          <select
            aria-label="Friendly fire"
            value={value.friendlyFire}
            onChange={(event) =>
              onChange({
                ...value,
                friendlyFire: event.currentTarget.value as CombatFriendlyFirePolicy,
              })
            }
          >
            {FRIENDLY_FIRE_POLICIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.checkField}>
        <input
          aria-label="Requires line of sight"
          type="checkbox"
          checked={value.requiresLineOfSight}
          onChange={(event) =>
            onChange({
              ...value,
              requiresLineOfSight: event.currentTarget.checked,
            })
          }
        />
        <span>Requires line of sight</span>
      </label>

      {invalidRange ? (
        <p className={styles.inlineError} role="alert">
          Minimum range cannot exceed maximum range.
        </p>
      ) : null}
    </fieldset>
  )
}
