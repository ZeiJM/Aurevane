import {
  latestEnabledMatureSkills,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  CURRENT_BURN_DAMAGE_BY_STAGE,
  CURRENT_POISON_DAMAGE,
} from '@aurevane/game-core/combat/combat-dots'
import { standardSkillDamageScaling } from '@aurevane/game-core/combat/damage-scaling'
import type { CombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'

export interface MagnitudeBand {
  family: string
  unit: string
  count: number
  minimum: number | null
  lowerQuartile: number | null
  upperQuartile: number | null
  maximum: number | null
}

interface MagnitudeGroup {
  readonly effects: readonly (CombatTagPayload | MatureSkillEffectDefinition)[]
  readonly shape?: MatureSkillDefinition['target']['shape']
}

/** One observation per authored effect (or command total), never per affected target. */
export function techniqueMagnitudeBands(
  skills: readonly MatureSkillDefinition[] = latestEnabledMatureSkills(),
): readonly MagnitudeBand[] {
  const families = [
    ['Direct damage / hit', 'base damage'],
    ['Direct damage / command', 'base damage'],
    ['Power coefficient / hit', '% Power'],
    ['HP recovery / application', '% maximum HP'],
    ['MP recovery / application', '% maximum MP'],
    ['Healing / application', 'HP'],
    ['Multi-application healing / effect', 'total HP'],
    ['MP restore / application', 'MP'],
    ['MP drain / effect', 'MP'],
    ['Barrier / effect', 'Barrier'],
    ['Displacement', 'tiles'],
    ['DOT damage / tick', 'HP'],
    ['DOT attack damage (%)', '% attack HP damage'],
    ['Finite DOT duration', 'ticks'],
    ['Circle size', 'radius in tiles'],
    ['Line size', 'tiles'],
  ] as const
  const samples = new Map<string, number[]>(families.map(([family]) => [family, []]))
  const add = (family: string, value: number) => samples.get(family)!.push(value)
  const groups = skills
    .filter((skill) => skill.enabled)
    .flatMap<MagnitudeGroup>((skill) =>
      skill.ability
        ? skill.ability.behaviors.map((group) => ({
            effects: group.effects.map((effect) => effect.payload),
            shape: group.targeting?.shape,
          }))
        : [{ effects: skill.effects, shape: skill.target.shape }],
    )
  for (const group of groups) {
    const damage = group.effects.filter(
      (effect) => effect.type === 'damage' || effect.type === 'pierce',
    )
    if (damage.length) {
      add(
        'Direct damage / command',
        damage.reduce((total, effect) => total + effect.amount, 0),
      )
      for (const effect of damage) {
        if (effect.type === 'damage' && effect.vengeance) continue
        add(
          'Power coefficient / hit',
          (effect.scaling ?? standardSkillDamageScaling('physical-power')).coefficientBasisPoints /
            100,
        )
      }
    }
    if (group.shape?.kind === 'circle') add('Circle size', group.shape.radius)
    if (group.shape?.kind === 'line') add('Line size', group.shape.length)
    for (const effect of group.effects) {
      switch (effect.type) {
        case 'damage':
        case 'pierce':
          add('Direct damage / hit', effect.amount)
          break
        case 'percentage-recovery':
          add(
            `${effect.resource.toUpperCase()} recovery / application`,
            'percentageBasisPoints' in effect ? effect.percentageBasisPoints / 100 : effect.percent,
          )
          break
        case 'healing':
          add('Healing / application', effect.amount)
          if ((effect.ticks ?? 1) > 1)
            add('Multi-application healing / effect', effect.amount * effect.ticks!)
          break
        case 'resource-change':
          add(
            effect.delta < 0 ? 'MP drain / effect' : 'MP restore / application',
            Math.abs(effect.delta),
          )
          break
        case 'barrier-change':
          add('Barrier / effect', effect.amount)
          break
        case 'displace':
          add('Displacement', effect.distance)
          break
        case 'bleed':
          if (effect.damageProfile)
            add('DOT attack damage (%)', effect.damageProfile.basisPoints / 100)
          else add('DOT damage / tick', effect.damagePerTick)
          add('Finite DOT duration', effect.ticks)
          break
        case 'burn':
          if (effect.damageProfile) {
            const ticks = effect.durationTurns ?? 3
            for (let stage = 0; stage < ticks; stage++)
              add(
                'DOT attack damage (%)',
                (effect.damageProfile.basisPoints -
                  (effect.damageProfile.decayBasisPointsPerTick ?? 0) * stage) /
                  100,
              )
            add('Finite DOT duration', ticks)
            break
          }
          CURRENT_BURN_DAMAGE_BY_STAGE.forEach((amount) => add('DOT damage / tick', amount))
          add('Finite DOT duration', CURRENT_BURN_DAMAGE_BY_STAGE.length)
          break
        case 'poison':
          if (effect.damageProfile) {
            add('DOT attack damage (%)', effect.damageProfile.basisPoints / 100)
            add('Finite DOT duration', effect.durationTurns ?? 4)
            break
          }
          add('DOT damage / tick', CURRENT_POISON_DAMAGE)
          break
      }
    }
  }
  return families.map(([family, unit]) => {
    const sorted = samples.get(family)!.sort((a, b) => a - b)
    const quartile = (fraction: number) =>
      sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null
    return {
      family,
      unit,
      count: sorted.length,
      minimum: sorted[0] ?? null,
      lowerQuartile: quartile(0.25),
      upperQuartile: quartile(0.75),
      maximum: sorted.at(-1) ?? null,
    }
  })
}
