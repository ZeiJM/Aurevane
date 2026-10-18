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
    case 'apply-status':
      return canonicalStatusExplanation(effect, options)
    case 'healing':
      return {
        description: `Restore HP to ${recipient}, without exceeding the maximum. Recovery cannot revive a defeated unit.`,
        parts: schedule,
      }
    case 'resource-change':
      return effect.delta < 0
        ? { description: `Remove MP from ${recipient}, without going below zero.` }
        : {
            description: `Restore MP to ${recipient}, without exceeding the maximum. Recovery cannot revive a defeated unit.`,
            parts: schedule,
          }
    case 'percentage-recovery': {
      const resource = effect.resource.toUpperCase()
      const captured =
        effect.resource === 'hp' || !options.legacyHealingDown
          ? 'The maximum and Healing Down adjustment are captured when cast'
          : 'The maximum is captured when cast'
      return {
        description: `Restore the displayed share of maximum ${resource} to ${recipient}. ${captured}; actual gains cap at the current maximum. Recovery cannot revive a defeated unit.`,
        parts: schedule,
      }
    }
    case 'barrier-change':
      return { description: `Grant damage-absorbing Barrier to ${recipient}.` }
    case 'displace':
      return {
        ...mechanicText`${effect.direction === 'pull' ? 'Pull' : 'Push'} ${recipient} ${effect.direction === 'pull' ? 'toward you' : 'away from you'}, up to the displayed distance. Stops before occupied, blocked or illegal-elevation tiles. Pull never enters your tile. ${mechanicTag('rooted')} prevents displacement. Failure grants no refund.`,
      }
    case 'sensory':
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
