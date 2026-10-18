import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import type { BattlePresentedStatus } from '@/lib/battle/battle-elevation-effects'

type LifetimeInput = Pick<BattlePresentedStatus, 'statusId' | 'statusVersion'> &
  Partial<
    Pick<
      BattlePresentedStatus,
      | 'recoveryApplications'
      | 'durationScope'
      | 'remainingRoundBoundaries'
      | 'remainingOwnerTurnEnds'
      | 'remainingOwnerTurnStarts'
      | 'timingState'
      | 'activationRound'
      | 'stacks'
    >
  >

/** The visible chip and full reader use the same captured clock. */
export function battleEffectLifetime(effect: LifetimeInput) {
  const applications = effect.recoveryApplications
  const count =
    applications ??
    (effect.durationScope === 'rounds'
      ? (effect.remainingRoundBoundaries ?? null)
      : effect.durationScope !== undefined
        ? null
        : (effect.remainingOwnerTurnEnds ?? effect.remainingOwnerTurnStarts))
  const pending = effect.timingState === 'pending'
  const timing = pending
    ? `Pending · Activates at the start of ${effect.activationRound === undefined ? 'the following round' : `round ${effect.activationRound}`}`
    : 'Active'
  let duration: string
  if (applications !== undefined) {
    duration = `${applications} application${applications === 1 ? '' : 's'} remaining${(effect.stacks ?? 1) > 1 ? ' per stack' : ''}${pending ? ` · first on activation${applications > 1 ? '; subsequent applications at affected-turn ends' : ''}` : ' · one per affected-turn end'}.`
  } else if (effect.durationScope === 'battle') {
    duration = 'Until battle ends'
  } else if (effect.durationScope === 'instant') {
    duration = 'One-time effect on activation'
  } else if (effect.durationScope === 'until-spent') {
    duration = 'Until depleted'
  } else if (effect.durationScope === 'until-removed') {
    duration = 'Until removed'
  } else if (effect.durationScope === 'rounds') {
    duration =
      count === null
        ? 'Round duration unavailable'
        : `${count} round ${count === 1 ? 'boundary' : 'boundaries'} remaining`
  } else if (effect.remainingOwnerTurnEnds !== undefined) {
    duration = `${count} turn${count === 1 ? '' : 's'} remaining. Expires after the affected character completes ${count === 1 ? 'that turn' : 'those turns'}.`
  } else {
    // Historical snapshots keep their original counter semantics.
    const definition = PHASE4_STATUSES.find(
      (item) => item.id === effect.statusId && item.version === effect.statusVersion,
    )
    duration = definition?.endOfTurn
      ? `${count} affected-turn-end tick${count === 1 ? '' : 's'} remaining`
      : `${count} affected-unit turn start${count === 1 ? '' : 's'} remaining`
  }
  return { applications, count, pending, timing, duration }
}
