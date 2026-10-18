import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { BattlePresentedStatus } from '@/lib/battle/battle-elevation-effects'
import {
  formatBattleEffectPercent as percent,
  multiplyBattleEffectRatio as repeatedRatio,
} from './battle-effect-ratio'

const BASIS = 10_000n
const MAXIMUM = BigInt(Number.MAX_SAFE_INTEGER)

/** Captured multipliers with explicit supported conditions, never a final HP forecast. */
export function battleEffectStrengthInformation(effect: BattlePresentedStatus) {
  const rows: { label: string; magnitude: string }[] = []
  const notes: string[] = []
  const definition = PV1F_COMBAT_CONTENT.statuses.find(
    (row) => row.id === effect.statusId && row.version === effect.statusVersion,
  )
  if (
    !definition ||
    !['inspired', 'suppress', 'reckless', 'fortified', 'warded', 'challenged'].includes(
      effect.statusId,
    )
  )
    return { rows, notes }
  const pending = effect.timingState === 'pending'
  const scope = pending ? 'on activation' : 'from this effect'
  const current = effect.effectStackingPolicyVersion === 1
  const applications = current
    ? (effect.applicationModifiers ?? [
        {
          stacks: effect.stacks,
          potencyBasisPoints: effect.potencyBasisPoints,
          sourceCombatantId: effect.sourceCombatantId,
        },
      ])
    : [
        {
          stacks: 1,
          potencyBasisPoints: effect.potencyBasisPoints,
          sourceCombatantId: effect.sourceCombatantId,
        },
      ]
  function add(direction: 'outgoing' | 'incoming', base: number, inspired = false, qualifier = '') {
    const label = `${direction === 'outgoing' ? 'Outgoing' : 'Incoming'} damage ${scope}${qualifier ? ` ${qualifier}` : ''}`
    let total = BASIS
    let denominator = 1n
    let steps = 0
    try {
      for (const application of applications) {
        const potency = application.potencyBasisPoints
        const value =
          potency === undefined
            ? base
            : base < 10_000
              ? Math.max(0, 10_000 - potency)
              : 10_000 + potency
        if (inspired) {
          for (let i = 0; i < application.stacks; i++) {
            // Bound synchronous rendering even for unusually large, valid captured counts.
            if (++steps > 16_384) throw new RangeError('Unavailable reader total')
            const next = (total * BigInt(value)) / BASIS
            if (next > MAXIMUM) throw new RangeError('Unavailable safe total')
            if (next === total) break
            total = next
          }
        } else [total, denominator] = repeatedRatio(total, denominator, value, application.stacks)
      }
      total /= denominator
      if (total > MAXIMUM) throw new RangeError('Unavailable safe total')
      rows.push({
        label,
        magnitude: percent(total),
      })
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      rows.push({
        label,
        magnitude: 'Unavailable',
      })
      if (!notes.includes('Combined damage multiplier unavailable.'))
        notes.push('Combined damage multiplier unavailable.')
    }
  }
  if (effect.statusId === 'suppress') {
    rows.push({
      label: `Outgoing direct damage ${scope}`,
      magnitude: percent(BigInt(Math.max(0, 10_000 - (effect.potencyBasisPoints ?? 2500)))),
    })
  } else if (effect.statusId === 'inspired') add('outgoing', 11_000, true)
  else
    for (const modifier of definition.damageModifiers ?? [])
      if (modifier.condition.kind === 'always')
        add(modifier.direction, modifier.multiplierBasisPoints)
      else if (
        effect.statusId === 'warded' &&
        modifier.condition.kind === 'opponent-status' &&
        modifier.condition.statusId === 'burn'
      )
        add(modifier.direction, modifier.multiplierBasisPoints, false, 'against burning opponents')
      else if (
        effect.statusId === 'challenged' &&
        modifier.condition.kind === 'opponent-is-source' &&
        !modifier.condition.matches
      ) {
        const source = applications[0]?.sourceCombatantId
        if (
          typeof source === 'string' &&
          source.length > 0 &&
          applications.every((application) => application.sourceCombatantId === source)
        )
          add(
            modifier.direction,
            modifier.multiplierBasisPoints,
            false,
            'against targets other than the source',
          )
        else notes.push('Combined damage depends on which source is attacked.')
      }
  if (effect.statusId === 'warded')
    notes.push('Damage that bypasses incoming protection is unaffected by Burn Ward.')
  if (effect.statusId === 'warded' || effect.statusId === 'challenged')
    notes.push('These multipliers apply only when the stated condition is met.')
  notes.push('Other damage modifiers still apply.')
  return { rows, notes }
}
