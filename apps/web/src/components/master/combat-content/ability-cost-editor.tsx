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
      resource !== 'ap' && amount === 0
        ? costs.filter((cost) => cost.resource !== resource)
        : index < 0
          ? [...costs, { resource, amount }]
          : costs.map((cost, ordinal) => (ordinal === index ? { ...cost, amount } : cost)),
    )
  }
  return (
    <div className={styles.costEditor}>
      <div className={styles.costGrid}>
        <AbilityNumber
          label={apLabel}
          min={apBounds?.minimum ?? 0}
          max={apBounds?.maximum}
          value={costs.find((cost) => cost.resource === 'ap')?.amount ?? 0}
          onChange={(amount) => set('ap', amount)}
        />
        {(['mp', 'hp'] as const).map((resource) => (
          <AbilityNumber
            key={resource}
            label={`${resource.toUpperCase()} cost`}
            value={costs.find((cost) => cost.resource === resource)?.amount ?? 0}
            max={resource === 'mp' ? mpMaximum : undefined}
            onChange={(amount) => set(resource, amount)}
          />
        ))}
      </div>
      <p className={styles.fieldHint}>
        Set MP or HP to 0 for no cost. HP payment must leave the caster with at least 1 HP.
      </p>
    </div>
  )
}
