import {
  percentageDotDescription,
  percentageDotTickDamage,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { combatStatusDetails, PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { statusLabel } from './battle-effect-summary'
import { statusPotencyDescription } from '../../lib/status-potency-presentation'
import { blindsideStatusDescription } from '@aurevane/game-core/combat/combat-blindside'
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
  airborne: 'AIR',
  displaced: 'DIS',
  haste: 'HST',
  burn: 'BUR',
  bleed: 'BLE',
  poison: 'POI',
  slow: 'SLO',
  root: 'ROO',
  reckless: 'REC',
  fortified: 'FOR',
  challenged: 'CHA',
  mark: 'MRK',
  warded: 'WAR',
  blind: 'BLI',
  blindside: 'BLS',
  barrier: 'BAR',
  covert: 'COV',
  revealed: 'REV',
  'mp-drain': 'MPD',
  'mp-recovery': 'MPR',
  healing: 'HPR',
  damage: 'DMG',
  'create-terrain': 'TER',
  displace: 'MOV',
  push: 'PSH',
  pull: 'PLL',
  'barrier-change': 'SHD',
  'return-to-turn-start': 'RET',
  'remove-status': 'CLR',
  'copy-statuses': 'ECP',
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
  const dot =
    effect.statusId === 'burn' || effect.statusId === 'poison' || effect.statusId === 'bleed'
      ? effect.statusId
      : null
  const percentageDescription =
    dot && (effect.percentageDamage || effect.percentageDotProfile)
      ? percentageDotDescription(dot, effect.burnBacklashBasisPoints, {
          legacyTriggers: effect.dotTriggerPolicyVersion === undefined,
          legacyPoisonMovement: effect.dotTriggerPolicyVersion !== 2,
        })
      : null
  const capturedDescription = effect.percentageDamage
    ? ` Captured attack damage: ${effect.percentageDamage.capturedDamage} HP. Next tick: ${percentageDotTickDamage(effect.percentageDamage.capturedDamage, effect.percentageDamage.profile, effect.percentageDotStage ?? 0)} HP${effect.stacks > 1 ? ' per application' : ''}.`
    : ''
  const identity = {
    ...battleEffectIdentity(effect.statusId),
    description:
      (percentageDescription ??
        (effect.statusId === 'blindside'
          ? blindsideStatusDescription(effect, effect.blindsideActivationPolicyVersion !== 1)
          : effect.statusId === 'airborne' && effect.airbornePolicyVersion !== 1
            ? 'Ignore the Frozen Ground AP surcharge. Board bounds, elevation, obstacles, occupancy, Rooted and Movement allowance still apply.'
            : statusPotencyDescription(effect.statusId, effect.potencyBasisPoints, {
                legacyHealingDown: effect.healingDownPolicyVersion !== 1,
              }))) + capturedDescription,
  }
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
    duration = `${applications} application${applications === 1 ? '' : 's'} remaining${pending ? ' · first on activation' : ''}.`
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
  return {
    ...identity,
    ...(applications !== undefined
      ? { label: effect.statusId === 'healing' ? 'HP Recovery' : 'MP Recovery' }
      : {}),
    count,
    counterLabel:
      applications !== undefined
        ? `${applications}×`
        : count === null
          ? duration
          : `${count}${effect.durationScope === 'rounds' ? 'r' : 't'}`,
    timing,
    timingState: pending ? 'pending' : 'active',
    duration,
    explanation: `${identity.kind} · ${identity.description} ${timing} · ${duration} ${effect.stacks} stack${effect.stacks === 1 ? '' : 's'}.`,
  }
}
