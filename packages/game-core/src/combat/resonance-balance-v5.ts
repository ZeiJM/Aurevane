import type { CombatEffectDefinition } from './actions'
import type { ResonanceDefinition } from './resonance'

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

function statusPotency(statusId: string): number | undefined {
  switch (statusId) {
    case 'guarded':
    case 'exposed':
    case 'inspired':
    case 'summoned':
    case 'warded':
      return 1_200
    case 'mark':
      return 1_300
    case 'hexed':
      return 1_800
    default:
      return undefined
  }
}

function tunePrimaryEffect(effect: CombatEffectDefinition): CombatEffectDefinition {
  switch (effect.type) {
    case 'damage':
      return { ...effect, amount: clamp(effect.amount, 4, 7), durationTurns: 0 }
    case 'healing':
      return { ...effect, amount: clamp(effect.amount, 4, 7), durationTurns: 0 }
    case 'resource-change':
      return {
        ...effect,
        delta: Math.sign(effect.delta || 1) * clamp(Math.abs(effect.delta), 3, 6),
        durationTurns: 0,
      }
    case 'barrier-change':
      return { ...effect, amount: clamp(effect.amount, 4, 7), durationTurns: 0 }
    case 'apply-status': {
      const potencyBasisPoints = statusPotency(effect.statusId)
      return {
        ...effect,
        durationTurns: durationFor(effect),
        ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
      }
    }
    case 'burn':
    case 'poison':
      return { ...effect, power: 4, durationTurns: durationFor(effect) }
    case 'bleed':
      return {
        ...effect,
        damagePerTick: clamp(effect.damagePerTick, 2, 4),
        ticks: clamp(durationFor(effect), 1, 4),
        durationTurns: clamp(durationFor(effect), 1, 4),
      }
    default:
      return { ...effect, durationTurns: durationFor(effect) }
  }
}

function thematicSecondaryEffect(setupDisciplineId: string): CombatEffectDefinition | null {
  switch (setupDisciplineId) {
    case 'aetherist':
      return {
        type: 'resource-change',
        recipient: 'actor',
        resource: 'mp',
        delta: 4,
        durationTurns: 0,
      }
    case 'farstrider':
      return {
        type: 'resource-change',
        recipient: 'actor',
        resource: 'mp',
        delta: 3,
        durationTurns: 0,
      }
    case 'lifebinder':
      return { type: 'healing', recipient: 'actor', amount: 4, durationTurns: 0 }
    case 'shadehand':
    case 'ironfist':
    case 'runeblade':
      return {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'exposed',
        stacks: 1,
        potencyBasisPoints: 1_200,
        durationTurns: 1,
      }
    case 'vanguard':
    case 'bastion':
      return {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'guarded',
        stacks: 1,
        potencyBasisPoints: 1_200,
        durationTurns: 1,
      }
    case 'ravager':
      return {
        type: 'bleed',
        recipient: 'primary-unit',
        damagePerTick: 2,
        ticks: 2,
        durationTurns: 2,
      }
    case 'edgedancer':
    case 'frostweaver':
      return {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'slow',
        stacks: 1,
        durationTurns: 1,
      }
    case 'wildwarden':
      return {
        type: 'resource-change',
        recipient: 'actor',
        resource: 'mp',
        delta: 4,
        durationTurns: 0,
      }
    case 'dawnshield':
      return {
        type: 'remove-status',
        recipient: 'actor',
        statusIds: ['burn', 'bleed', 'poison'],
        durationTurns: 0,
      }
    case 'cinderweaver':
      return {
        type: 'burn',
        recipient: 'primary-unit',
        power: 4,
        durationTurns: 2,
      }
    case 'stormsinger':
      return {
        type: 'resource-change',
        recipient: 'primary-unit',
        resource: 'mp',
        delta: -3,
        durationTurns: 0,
      }
    case 'tidecaller':
      return { type: 'healing', recipient: 'actor', amount: 4, durationTurns: 0 }
    case 'chronist':
      return {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'haste',
        stacks: 1,
        durationTurns: 1,
      }
    default:
      return null
  }
}

function semanticEffectKey(effect: CombatEffectDefinition): string {
  if (effect.type === 'apply-status') return `apply-status:${effect.recipient}:${effect.statusId}`
  if (effect.type === 'resource-change') {
    return `resource-change:${effect.recipient}:${effect.resource}:${Math.sign(effect.delta)}`
  }
  if (effect.type === 'remove-status') return `remove-status:${effect.recipient}`
  return `${effect.type}:${effect.recipient}`
}

function resonanceFlavorLine(definition: ResonanceDefinition): string {
  const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
  const setup = title(definition.trigger.setup.sourceDisciplineId)
  const payoff = title(definition.trigger.payoff.sourceDisciplineId)
  return `${definition.name} carries ${setup} momentum into a ${payoff} response shaped by both Disciplines.`
}

function compactDescription(definition: ResonanceDefinition, effectCount: number): string {
  const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
  const setup = definition.trigger.setup
  const payoff = definition.trigger.payoff
  return `${definition.name} links ${title(setup.sourceDisciplineId)} ${setup.requiredTags.join(' + ')} into a ${title(payoff.sourceDisciplineId)} ${payoff.requiredTags.join(' + ')} follow-through with ${effectCount === 1 ? 'one focused payoff' : 'a paired thematic payoff'}.`
}

function setupUtility(definition: ResonanceDefinition): number {
  return clamp(
    10 +
      definition.trigger.setup.requiredTags.length * 2 +
      definition.trigger.payoff.requiredTags.length,
    10,
    16,
  )
}

function payoffUtility(effects: readonly CombatEffectDefinition[]): number {
  const persistentEffects = effects.filter((effect) => durationFor(effect) > 0).length
  return clamp(22 + effects.length * 4 + persistentEffects * 2, 22, 33)
}

export function rebalanceResonanceDefinition(definition: ResonanceDefinition): ResonanceDefinition {
  const primary = definition.trigger.payoffEffects.map(tunePrimaryEffect)
  const extra = thematicSecondaryEffect(definition.trigger.setup.sourceDisciplineId)
  const payoffEffects =
    extra && !primary.some((effect) => semanticEffectKey(effect) === semanticEffectKey(extra))
      ? [...primary, extra]
      : primary

  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    description: compactDescription(definition, payoffEffects.length),
    flavorLine: resonanceFlavorLine(definition),
    trigger: {
      ...definition.trigger,
      payoffEffects: payoffEffects.slice(0, 3),
      aiSetupUtilityBonus: setupUtility(definition),
      aiPayoffUtilityBonus: payoffUtility(payoffEffects),
    },
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([
          ...definition.authoring.validationTags,
          'owner-rebalance-v5',
          'thematic-resonance-payoff',
          'duration-aware',
        ]),
      ],
    },
  }
}
