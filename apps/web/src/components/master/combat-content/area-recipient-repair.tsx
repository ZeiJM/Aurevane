'use client'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  withAuthoredAreaRecipients,
  type TargetedEffect,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'

/** Existing incompatible drafts require an explicit authoring choice, never a read migration. */
export function AreaRecipientRepair<T extends TargetedEffect>({
  target,
  effects,
  requiresSelectedUnit,
  onChange,
}: {
  target: CombatTargetSpec
  effects: readonly T[]
  requiresSelectedUnit?: boolean
  onChange(effects: readonly T[]): void
}) {
  const next = withAuthoredAreaRecipients(target, effects, { requiresSelectedUnit })
  if (next === effects) return null
  return (
    <aside role="status">
      <p>
        This area cannot name a primary unit. Apply its ordinary unit effects to units in the shared
        footprint, or choose Single in Range &amp; Area.
      </p>
      <button type="button" onClick={() => onChange(next)}>
        Use area recipients
      </button>
    </aside>
  )
}
