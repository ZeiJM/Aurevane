'use client'

import type { AbilityTargeting } from '@aurevane/game-core/combat/combat-definition'
import {
  combatTargetCategories,
  maximumSupportedCombatRange,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

export function AbilityTargetingEditor({
  value,
  onChange,
}: {
  value: AbilityTargeting
  onChange: (value: AbilityTargeting) => void
}) {
  const categories = combatTargetCategories(value)
  const independent = value.geometryVersion === 3
  const area = value.shape.kind !== 'single'
  const all = value.shape.kind === 'all'
  return (
    <fieldset className={styles.typedGroup}>
      <legend>Group targeting</legend>
      <div className={styles.typedGrid}>
        <AbilitySelect
          label="Target rules"
          value={independent ? 'independent categories' : 'team targeting'}
          options={['team targeting', 'independent categories']}
          onChange={(mode) => {
            const next = { ...value }
            if (mode === 'independent categories')
              onChange({ ...next, geometryVersion: 3, categories })
            else {
              delete next.categories
              onChange({ ...next, geometryVersion: 2 })
            }
          }}
        />
        <AbilitySelect
          label="Target kind"
          value={value.kind}
          options={['self', 'unit', 'ground-tile', 'empty-tile']}
          onChange={(kind) => onChange({ ...value, kind })}
        />
        {!independent ? (
          <AbilitySelect
            label="Team policy"
            value={value.teamPolicy}
            options={['self', 'ally', 'enemy', 'any']}
            onChange={(teamPolicy) => onChange({ ...value, teamPolicy })}
          />
        ) : null}
        <AbilitySelect
          label="Target shape"
          value={value.shape.kind}
          options={['single', 'line', 'circle', 'all']}
          onChange={(kind) => {
            const shape =
              kind === 'line'
                ? ({ kind, length: 1 } as const)
                : kind === 'circle'
                  ? ({ kind, radius: 1 } as const)
                  : { kind }
            onChange({
              ...value,
              shape,
              ...(kind === 'all'
                ? { minimumRange: 0, maximumRange: 0, requiresLineOfSight: false }
                : kind !== 'single'
                  ? { minimumRange: 0, maximumRange: 1 }
                  : {}),
            })
          }}
        />
        {value.shape.kind === 'line' || value.shape.kind === 'circle' ? (
          <AbilityNumber
            label="Shape reach"
            min={1}
            max={5}
            value={value.shape.kind === 'line' ? value.shape.length : value.shape.radius}
            onChange={(reach) =>
              onChange({
                ...value,
                shape:
                  value.shape.kind === 'line'
                    ? { kind: 'line', length: reach }
                    : { kind: 'circle', radius: reach },
                minimumRange: 0,
                maximumRange: reach,
              })
            }
          />
        ) : null}
        {!all && !area ? (
          <>
            <AbilityNumber
              label="Minimum range"
              value={value.minimumRange}
              max={maximumSupportedCombatRange()}
              onChange={(minimumRange) => onChange({ ...value, minimumRange })}
            />
            <AbilityNumber
              label="Maximum range"
              value={value.maximumRange}
              max={maximumSupportedCombatRange()}
              onChange={(maximumRange) => onChange({ ...value, maximumRange })}
            />
          </>
        ) : null}
        <AbilityNumber
          label="Maximum selections"
          value={value.maximumSelections}
          min={1}
          max={area ? 1 : independent ? 3 : 16}
          onChange={(maximumSelections) => onChange({ ...value, maximumSelections })}
        />
        <AbilitySelect
          label="Ground affected teams"
          value={value.friendlyFire}
          options={['enemies-only', 'allies-only', 'all-units', 'all-except-actor']}
          onChange={(friendlyFire) => onChange({ ...value, friendlyFire })}
        />
        <AbilitySelect
          label="Elevation limit"
          value={value.maximumElevationDifference === null ? 'unlimited' : 'bounded'}
          options={['bounded', 'unlimited']}
          onChange={(mode) =>
            onChange({ ...value, maximumElevationDifference: mode === 'unlimited' ? null : 0 })
          }
        />
        {value.maximumElevationDifference !== null ? (
          <AbilityNumber
            label="Maximum elevation difference"
            value={value.maximumElevationDifference}
            onChange={(maximumElevationDifference) =>
              onChange({ ...value, maximumElevationDifference })
            }
          />
        ) : null}
      </div>
      {independent ? (
        <div className={styles.typedGrid}>
          {(['self', 'ally', 'enemy', 'ground'] as const).map((category) => (
            <label className={styles.checkField} key={category}>
              <input
                aria-label={`Target category ${category}`}
                type="checkbox"
                checked={categories.includes(category)}
                onChange={(event) =>
                  onChange({
                    ...value,
                    categories: event.currentTarget.checked
                      ? [...categories, category]
                      : categories.filter((entry) => entry !== category),
                  })
                }
              />
              {category}
            </label>
          ))}
        </div>
      ) : null}
      {!all ? (
        <label className={styles.checkField}>
          <input
            aria-label="Requires line of sight"
            type="checkbox"
            checked={value.requiresLineOfSight}
            onChange={(event) =>
              onChange({ ...value, requiresLineOfSight: event.currentTarget.checked })
            }
          />
          Requires line of sight
        </label>
      ) : null}
    </fieldset>
  )
}
