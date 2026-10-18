import {
  percentageDotDescription,
  percentageDotTickDamage,
  percentageDotSequence,
  percentageBasisPointsText,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { statusLabel } from './battle-effect-summary'
import { battleEffectLifetime } from './battle-effect-lifetime'
import { statusPotencyDescription } from '../../lib/status-potency-presentation'
import { blindsideStatusDescription } from '@aurevane/game-core/combat/combat-blindside'
import { airborneDescription } from '@aurevane/game-core/combat/combat-airborne'
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
  suppress: 'SUP',
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
  const profile = effect.percentageDamage?.profile ?? effect.percentageDotProfile
  const lifetime = battleEffectLifetime(effect)
  const stage = effect.percentageDotStage ?? 0
  const profileDescription =
    dot && profile
      ? dot === 'burn' && lifetime.count !== null && lifetime.count !== undefined
        ? ` Remaining tick percentages: ${percentageDotSequence(
            {
              ...profile,
              basisPoints: profile.basisPoints - (profile.decayBasisPointsPerTick ?? 0) * stage,
            },
            lifetime.count,
          )} of HP damage dealt by the granting attack. Decay: ${percentageBasisPointsText(profile.decayBasisPointsPerTick ?? 0)} percentage points per tick.`
        : ` Tick percentage: ${percentageBasisPointsText(profile.basisPoints)}% of HP damage dealt by the granting attack.`
      : ''
  const capturedDescription = effect.percentageDamage
    ? ` Captured attack damage: ${effect.percentageDamage.capturedDamage} HP. Next tick: ${percentageDotTickDamage(effect.percentageDamage.capturedDamage, effect.percentageDamage.profile, effect.percentageDotStage ?? 0)} HP${effect.stacks > 1 ? ' per application' : ''}.`
    : ''
  const identity = {
    ...battleEffectIdentity(effect.statusId),
    ...(effect.statusId === 'suppress'
      ? { label: `Suppress [${(effect.potencyBasisPoints ?? 2500) / 100}%]` }
      : {}),
    description:
      (percentageDescription ??
        (effect.statusId === 'blindside'
          ? blindsideStatusDescription(effect, effect.blindsideActivationPolicyVersion !== 1)
          : effect.statusId === 'airborne'
            ? airborneDescription(
                effect.airbornePolicyVersion !== 1,
                effect.airborneJumpPolicyVersion !== 1,
              )
            : statusPotencyDescription(
                effect.statusId,
                ['wet', 'conductive'].includes(effect.statusId) &&
                  effect.applicationModifiers?.length
                  ? Math.max(
                      ...effect.applicationModifiers.map(
                        (application) => application.potencyBasisPoints ?? 2000,
                      ),
                    )
                  : effect.potencyBasisPoints,
                {
                  legacyHealingDown: effect.healingDownPolicyVersion !== 1,
                  legacyElemental: effect.elementalDamagePolicyVersion == null,
                  explicitElemental: effect.elementalDamagePolicyVersion === 2,
                },
              ))) +
      profileDescription +
      capturedDescription,
  }
  const { applications, count, pending, timing, duration } = battleEffectLifetime(effect)
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
