import { combatStatusDetails, PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { statusLabel } from './battle-effect-summary'
import { statusPotencyDescription } from '../../lib/status-potency-presentation'
import {
  terrainBattleEffectPresentation,
  type BattlePresentedStatus,
} from '../../lib/battle/battle-elevation-effects'

/** Stable reading codes preserve distinct identities, including historical Mark. */
const identifiers: Readonly<Record<string, string>> = {
  guarded: 'GUA',
  exposed: 'EXP',
  'lowered-guard': 'OFF',
  wet: 'WET',
  frozen: 'FRO',
  conductive: 'CON',
  inspired: 'INS',
  hexed: 'HEX',
  invisible: 'GHO',
  summoned: 'SUM',
  airborne: 'AIR',
  displaced: 'DIS',
  haste: 'HST',
  hastened: 'HSN',
  delayed: 'DEL',
  'borrowed-hour': 'BOR',
  burn: 'BUR',
  bleed: 'BLE',
  poison: 'POI',
  regeneration: 'REG',
  slow: 'SLO',
  root: 'ROO',
  reckless: 'REC',
  fortified: 'FOR',
  challenged: 'CHA',
  marked: 'MK1',
  mark: 'MRK',
  warded: 'WAR',
  blind: 'BLI',
  barrier: 'BAR',
  covert: 'COV',
  revealed: 'REV',
  'mp-drain': 'MPD',
  'mp-recovery': 'MPR',
  healing: 'HPR',
  damage: 'DMG',
  'create-terrain': 'TER',
  displace: 'MOV',
  'barrier-change': 'SHD',
  'return-to-turn-start': 'RET',
  'remove-status': 'CLR',
  'copy-statuses': 'ECP',
  copy: 'CPY',
  'beneficial-copy': 'BCP',
  sensory: 'SEN',
  summon: 'ENT',
}

export function battleEffectIdentity(statusId: string) {
  return {
    ...combatStatusDetails(statusId),
    label: statusLabel(statusId),
    // An unrecognized identity must remain distinguishable without guessing its rules.
    identifier: identifiers[statusId] ?? `id:${statusId}`,
  }
}

export function describeBattleEffect(effect: BattlePresentedStatus) {
  const terrainEffect = terrainBattleEffectPresentation(effect)
  if (terrainEffect)
    return {
      ...terrainEffect,
      count: null,
      counterLabel: terrainEffect.duration,
      timing: 'Active',
      timingState: 'active',
      explanation: `${terrainEffect.kind} · ${terrainEffect.description} Active · ${terrainEffect.duration}.`,
    }
  const identity = {
    ...battleEffectIdentity(effect.statusId),
    description: statusPotencyDescription(effect.statusId, effect.potencyBasisPoints),
  }
  const count =
    effect.durationScope === 'rounds'
      ? (effect.remainingRoundBoundaries ?? null)
      : effect.durationScope !== undefined
        ? null
        : (effect.remainingOwnerTurnEnds ?? effect.remainingOwnerTurnStarts)
  const pending = effect.timingState === 'pending'
  const timing = pending
    ? `Pending · Activates at the start of ${effect.activationRound === undefined ? 'the following round' : `round ${effect.activationRound}`}`
    : 'Active'
  let duration: string
  if (effect.durationScope === 'battle') {
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
    duration =
      definition?.nextRoundInitiative !== undefined
        ? 'Until the next round starts'
        : definition?.endOfTurn
          ? `${count} affected-turn-end tick${count === 1 ? '' : 's'} remaining`
          : `${count} affected-unit turn start${count === 1 ? '' : 's'} remaining`
  }
  return {
    ...identity,
    count,
    counterLabel:
      count === null ? duration : `${count}${effect.durationScope === 'rounds' ? 'r' : 't'}`,
    timing,
    timingState: pending ? 'pending' : 'active',
    duration,
    explanation: `${identity.kind} · ${identity.description} ${timing} · ${duration} ${effect.stacks} stack${effect.stacks === 1 ? '' : 's'}.`,
  }
}
