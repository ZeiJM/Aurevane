import type { CombatEffectDefinition } from './actions'
import type { ResonanceDefinition } from './resonance'

function hash(value: string): number {
  let result = 2166136261
  for (const char of value) {
    result ^= char.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function durationFor(effect: CombatEffectDefinition): number {
  if (effect.durationTurns !== undefined) return effect.durationTurns
  switch (effect.type) {
    case 'apply-status':
      return ['root', 'haste', 'hastened', 'delayed'].includes(effect.statusId) ? 1 : 2
    case 'bleed':
      return effect.ticks
    case 'burn':
      return 3
    case 'poison':
      return 4
    default:
      return 0
  }
}

function tunePrimaryEffect(
  effect: CombatEffectDefinition,
  seed: number,
): CombatEffectDefinition {
  const variation = (seed % 3) - 1
  switch (effect.type) {
    case 'damage':
      return {
        ...effect,
        amount: clamp(5 + variation, 3, 8),
        durationTurns: 0,
      }
    case 'healing':
      return {
        ...effect,
        amount: clamp(5 + variation, 3, 8),
        durationTurns: 0,
      }
    case 'resource-change':
      return {
        ...effect,
        delta: Math.sign(effect.delta || 1) * clamp(4 + variation, 2, 7),
        durationTurns: 0,
      }
    case 'barrier-change':
      return {
        ...effect,
        amount: clamp(5 + variation, 3, 8),
        durationTurns: 0,
      }
    case 'apply-status':
      return {
        ...effect,
        durationTurns: durationFor(effect),
        ...(['guarded', 'exposed', 'mark', 'hexed', 'inspired', 'summoned', 'warded'].includes(
          effect.statusId,
        )
          ? { potencyBasisPoints: clamp(1_000 + (seed % 7) * 100, 1_000, 1_800) }
          : {}),
      }
    case 'burn':
    case 'poison':
      return {
        ...effect,
        power: clamp(3 + (seed % 4), 3, 6),
        durationTurns: durationFor(effect),
      }
    case 'bleed':
      return {
        ...effect,
        damagePerTick: clamp(2 + (seed % 3), 2, 4),
        ticks: clamp(durationFor(effect), 1, 4),
        durationTurns: clamp(durationFor(effect), 1, 4),
      }
    default:
      return { ...effect, durationTurns: durationFor(effect) }
  }
}

function secondaryEffect(seed: number): CombatEffectDefinition | null {
  switch (seed % 8) {
    case 0:
      return { type: 'damage', recipient: 'primary-unit', amount: 3 + (seed % 3), durationTurns: 0 }
    case 1:
      return { type: 'healing', recipient: 'actor', amount: 3 + (seed % 3), durationTurns: 0 }
    case 2:
      return {
        type: 'resource-change',
        recipient: 'actor',
        resource: 'mp',
        delta: 3 + (seed % 3),
        durationTurns: 0,
      }
    case 3:
      return {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'guarded',
        stacks: 1,
        potencyBasisPoints: 1_000 + (seed % 5) * 100,
        durationTurns: 1,
      }
    case 4:
      return {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'exposed',
        stacks: 1,
        potencyBasisPoints: 1_000 + (seed % 5) * 100,
        durationTurns: 1,
      }
    case 5:
      return {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'slow',
        stacks: 1,
        durationTurns: 1,
      }
    case 6:
      return {
        type: 'remove-status',
        recipient: 'actor',
        statusIds: ['burn', 'bleed', 'poison'],
        durationTurns: 0,
      }
    default:
      return null
  }
}

function compactDescription(definition: ResonanceDefinition, effectCount: number): string {
  const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
  const setup = definition.trigger.setup
  const payoff = definition.trigger.payoff
  return `${definition.name} links ${title(setup.sourceDisciplineId)} ${setup.requiredTags.join(' + ')} into a ${title(payoff.sourceDisciplineId)} ${payoff.requiredTags.join(' + ')} follow-through with ${effectCount === 1 ? 'one focused payoff' : 'a two-part payoff'}.`
}

export function rebalanceResonanceDefinition(
  definition: ResonanceDefinition,
): ResonanceDefinition {
  const seed = hash(definition.id)
  const primary = definition.trigger.payoffEffects.map((effect, index) =>
    tunePrimaryEffect(effect, seed + index * 17),
  )
  const extra = seed % 3 === 0 ? secondaryEffect(seed >>> 3) : null
  const payoffEffects =
    extra &&
    !primary.some(
      (effect) =>
        effect.type === extra.type &&
        ('statusId' in effect && 'statusId' in extra ? effect.statusId === extra.statusId : false),
    )
      ? [...primary, extra]
      : primary

  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    description: compactDescription(definition, payoffEffects.length),
    trigger: {
      ...definition.trigger,
      payoffEffects: payoffEffects.slice(0, 3),
      aiSetupUtilityBonus: clamp(10 + (seed % 7), 10, 16),
      aiPayoffUtilityBonus: clamp(22 + (seed % 12), 22, 33),
    },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-rebalance-v5',
          'varied-resonance-payoff',
          'duration-aware',
        ]),
      ],
    },
  }
}
