import type { BattlePresentedStatus } from '@/lib/battle/battle-elevation-effects'

type AmountRow = { label: string; magnitude: string }

function groupedAmount(amount: number, stacks: number, resource: string, bounded = false) {
  const prefix = bounded ? 'up to ' : ''
  if (stacks === 1) return `${prefix}${amount} ${resource}`
  const total = amount * stacks
  return `${Number.isSafeInteger(total) ? `${prefix}${total} ${resource} total` : 'Total unavailable'} · ${prefix}${amount} ${resource} per stack`
}

/** Available instance amounts only; an incoming rate is never used as an HP forecast. */
export function battleEffectAmountInformation(effect: BattlePresentedStatus) {
  const rows: AmountRow[] = []
  const notes: string[] = []
  if (effect.statusId === 'barrier') {
    const barrier = effect.barrier
    if (!barrier) notes.push('Recorded Barrier amount unavailable.')
    else {
      const bounded = barrier.kind === 'grant' && effect.effectStackingPolicyVersion !== 1
      rows.push({
        label: barrier.kind === 'remaining' ? 'Barrier remaining' : 'Barrier gain on activation',
        magnitude: groupedAmount(barrier.amount, effect.stacks, 'HP', bounded),
      })
      if (bounded)
        notes.push('The historical maximum HP cap still applies when this grant activates.')
    }
  } else if (effect.statusId === 'healing' || effect.statusId === 'mp-recovery') {
    const recovery = effect.recovery
    if (!recovery) notes.push('Recorded recovery amount unavailable.')
    else {
      const resource = recovery.resource.toUpperCase()
      if (recovery.basis === 'flat') {
        rows.push({
          label: `Base ${resource} recovery per application`,
          magnitude: groupedAmount(recovery.amountPerApplication, effect.stacks, resource),
        })
        notes.push(
          `Before applicable recovery modifiers. Actual recovery cannot exceed missing ${resource}.`,
        )
      } else {
        if (recovery.capture) {
          rows.push({
            label: `Captured ${resource} recovery per application`,
            magnitude: groupedAmount(
              recovery.capture.amountPerApplication,
              effect.stacks,
              resource,
            ),
          })
          rows.push({
            label: 'Recovery basis',
            magnitude: `${recovery.percent}% of ${recovery.capture.maximumAtCast} maximum ${resource} when used`,
          })
          notes.push(
            `Includes recovery modifiers captured when used. Actual recovery cannot exceed missing ${resource}.`,
          )
        } else {
          rows.push({
            label: 'Recovery basis',
            magnitude: `${recovery.percent}% of maximum ${resource} when used`,
          })
          notes.push('Captured recovery amount unavailable.')
        }
      }
      if (effect.recoverySkipsCurrentTurnEnd)
        notes.push(
          'Skips the current affected-turn end; remaining applications start at a later affected-turn end.',
        )
    }
  }
  return { rows, notes }
}
