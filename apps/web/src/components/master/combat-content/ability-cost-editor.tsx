'use client'

import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { AbilityNumber } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

type Costs = AbilityBehavior['costs']
/** AP is explicit. Optional resources retain their independent amounts and payment order. */
export function AbilityCostEditor({
  costs,
  onChange,
  apLabel = 'AP cost',
  apBounds,
  mpMaximum,
}: {
  costs: Costs
  apLabel?: string
  apBounds?: { minimum: number; maximum: number }
  mpMaximum?: number
  onChange(costs: Costs): void
}) {
  function set(resource: 'ap' | 'mp' | 'hp', amount: number) {
    const index = costs.findIndex((cost) => cost.resource === resource)
    onChange(
      index < 0
        ? [...costs, { resource, amount }]
        : costs.map((cost, ordinal) => (ordinal === index ? { ...cost, amount } : cost)),
    )
  }
  return (
    <>
      <AbilityNumber
        label={apLabel}
        min={apBounds?.minimum ?? 0}
        max={apBounds?.maximum}
        value={costs.find((cost) => cost.resource === 'ap')?.amount ?? 0}
        onChange={(amount) => set('ap', amount)}
      />
      {(['mp', 'hp'] as const).map((resource) => {
        const cost = costs.find((row) => row.resource === resource)
        return cost ? (
          <div className={styles.field} key={resource}>
            <AbilityNumber
              label={`${resource.toUpperCase()} cost`}
              value={cost.amount}
              max={resource === 'mp' ? mpMaximum : undefined}
              onChange={(amount) => set(resource, amount)}
            />
            <button
              type="button"
              onClick={() => onChange(costs.filter((row) => row.resource !== resource))}
            >
              Remove {resource.toUpperCase()} cost
            </button>
          </div>
        ) : (
          <button key={resource} type="button" onClick={() => set(resource, 1)}>
            Add {resource.toUpperCase()} cost
          </button>
        )
      })}
      {costs.some((cost) => cost.resource === 'hp') ? (
        <p className={styles.fieldHint}>
          HP is paid when the ability activates and must leave the caster with at least 1 HP. HP and
          MP costs can be combined.
        </p>
      ) : null}
    </>
  )
}
