import { attackTagDescription } from '@aurevane/game-core/combat/combat-attack-tags'
import { counterDescription } from '@aurevane/game-core/combat/combat-counter'
import { endureDescription } from '../../lib/combat-effect-descriptions'
import { mechanicText, mechanicTag, type MechanicTextPart } from './mechanic-text'
import { canonicalPeriodicGroundExplanation } from './canonical-periodic-ground-explanation'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  canonicalStatusExplanation,
  type CanonicalStatusExplanationOptions,
} from './canonical-status-explanation'
import type { CompactSkillEffectSummaryParts } from './skill-detail-presentation'

/** Plain canonical prose; exact values stay in the shared Effects presentation. */
export function canonicalEffectExplanation(
  effect: MatureSkillEffectDefinition,
  options: CanonicalStatusExplanationOptions,
): {
  description: string
  descriptionParts?: readonly MechanicTextPart[]
  parts?: Partial<CompactSkillEffectSummaryParts>
  structuredTiming?: boolean
} | null {
  const periodicGround = canonicalPeriodicGroundExplanation(effect, options)
  if (periodicGround) return periodicGround
  const recipient =
    effect.recipient === 'actor'
      ? 'yourself'
      : effect.recipient === 'affected-units'
        ? 'each affected unit'
        : 'the selected unit'
  const recovery =
    effect.type === 'healing' ||
    effect.type === 'percentage-recovery' ||
    (effect.type === 'resource-change' && effect.delta >= 0)
  const applications = recovery ? (effect.ticks ?? 1) : 1
  const schedule: Partial<CompactSkillEffectSummaryParts> | undefined =
    applications > 1
      ? {
          // These are applications, not full turns of an active status.
          ...(effect.type === 'percentage-recovery' ? { duration: null } : {}),
          details: [
            { label: 'Applications', value: String(applications) },
            { label: 'First', value: 'On activation' },
            { label: 'Then', value: 'End of each recipient turn that starts after activation' },
          ],
        }
      : undefined
  switch (effect.type) {
    case 'weak-point':
    case 'spike':
    case 'ruin':
      return {
        description: attackTagDescription(effect),
        parts: { target: undefined, timing: undefined, duration: null },
      }
    case 'endure':
      return { description: endureDescription(effect) }
    case 'apply-status':
      if (effect.statusId === 'counter' && effect.counter)
        return { description: counterDescription(effect.counter) }
      return canonicalStatusExplanation(effect, options)
    case 'healing':
      return {
        description: `Restore HP to ${recipient}, without exceeding the maximum. Recovery cannot revive a defeated unit.`,
        parts: schedule,
      }
    case 'resource-change':
      return effect.delta < 0
        ? {
            description:
              effect.basis === 'maximum-mp-percent'
                ? `Remove ${Math.abs(effect.delta)}% of ${recipient === 'yourself' ? 'your' : `${recipient}’s`} maximum MP, down to a minimum of zero.`
                : `Remove MP from ${recipient}, down to a minimum of zero.`,
          }
        : {
            description: `Restore MP to ${recipient}, without exceeding the maximum. Recovery cannot revive a defeated unit.`,
            parts: schedule,
          }
    case 'percentage-recovery': {
      const resource = effect.resource.toUpperCase()
      const reduction =
        effect.resource === 'hp' || !options.legacyHealingDown
          ? ' Healing Down reduces recovery.'
          : ''
      return {
        description: `Restore ${resource} based on the recipient’s maximum when this Skill is used.${reduction} Cannot exceed the maximum or revive a defeated unit.`,
        parts: schedule,
      }
    }
    case 'barrier-change':
      return {
        description:
          effect.basis === 'maximum-hp-percent'
            ? `Gain a share of maximum HP as protection. It absorbs damage before HP; Pierce breaks it.`
            : `Grant damage-absorbing Barrier to ${recipient}.`,
      }
    case 'displace':
      return {
        ...mechanicText`${effect.direction === 'pull' ? 'Pull' : 'Push'} ${recipient} ${effect.direction === 'pull' ? 'toward you' : 'away from you'}. Stops before occupied, blocked or unreachable tiles. Pull never enters your tile. ${mechanicTag('rooted')} prevents displacement.`,
      }
    case 'sensory':
      if (effect.increasedDamageTakenBasisPoints !== undefined)
        return {
          ...mechanicText`Reveal ${recipient} on a successful hit against ${mechanicTag('invisible')}, ${mechanicTag('covert')} or armed Reversal. Remove both concealments, disarm Reversal with Reversal Strain, and apply Revealed: take ${String(effect.increasedDamageTakenBasisPoints / 100)}% more damage; incoming attacks have 100% Accuracy.`,
          parts: {
            details: [
              { label: 'Revealed', value: `${effect.revealedDurationOwnerTurnStarts} turns` },
            ],
          },
        }
      return {
        ...mechanicText`Attempt Reveal on ${recipient}. A successful hit against ${mechanicTag('covert')} removes eligible positive statuses and ${mechanicTag('covert')}, then applies Revealed. Otherwise Reveal has no effect.`,
        parts: {
          details: [
            {
              label: 'Revealed',
              value: `${effect.revealedDurationOwnerTurnStarts} owner-turn ${effect.revealedDurationOwnerTurnStarts === 1 ? 'start' : 'starts'}`,
            },
          ],
        },
      }
    default:
      return null
  }
}
