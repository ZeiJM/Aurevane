import type { MatureSkillDefinition, MatureSkillEffectDefinition } from './mature-skills'
import type { EssenceDefinition } from './essence'
import { isPercentageDotEffect, percentageDotTickDamage } from './combat-percentage-dots'

const profiles: Readonly<
  Record<string, { type: 'burn' | 'poison' | 'bleed'; basisPoints: number; ticks: number }>
> = {
  'ravager.gash': { type: 'bleed', basisPoints: 2000, ticks: 3 },
  'edgedancer.severing-cut': { type: 'bleed', basisPoints: 1500, ticks: 3 },
  'wildwarden.venom-shot': { type: 'poison', basisPoints: 1500, ticks: 4 },
  'cinderweaver.cinder-bolt': { type: 'burn', basisPoints: 2500, ticks: 3 },
  'cinderweaver.flame-burst': { type: 'burn', basisPoints: 2000, ticks: 3 },
  'cinderweaver.ember-line': { type: 'burn', basisPoints: 2000, ticks: 3 },
  'cinderweaver.blistering-heat': { type: 'burn', basisPoints: 1500, ticks: 3 },
  'essence.ravager.red-tempest': { type: 'bleed', basisPoints: 2000, ticks: 3 },
  'essence.cinderweaver.phoenix-wake': { type: 'burn', basisPoints: 2500, ticks: 3 },
}

/** Convert only an unconverted current definition; custom percentage authoring is already current. */
export function createPercentageDotSkillVersion(
  definition: MatureSkillDefinition,
): MatureSkillDefinition | null {
  const row = profiles[definition.id]
  if (
    !row ||
    !definition.effects.some((effect) => effect.type === row.type && !isPercentageDotEffect(effect))
  )
    return null
  const addedAttack =
    definition.id === 'cinderweaver.blistering-heat' &&
    !definition.effects.some((effect) => effect.type === 'damage')
  const effects: MatureSkillEffectDefinition[] = definition.effects.map((effect) => {
    if (effect.type !== row.type || isPercentageDotEffect(effect)) return effect
    const rest = { ...effect }
    delete rest.power
    const damageProfile = {
      kind: 'attack-percentage' as const,
      basisPoints: row.basisPoints,
      ...(row.type === 'burn' ? { decayBasisPointsPerTick: 500 } : {}),
    }
    if (rest.type === 'bleed') {
      const { damagePerTick, ...bleed } = rest
      void damagePerTick
      return { ...bleed, ticks: row.ticks, durationTurns: row.ticks, damageProfile }
    }
    return { ...rest, durationTurns: row.ticks, damageProfile }
  })
  if (addedAttack)
    effects.unshift({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 6,
      element: 'fire',
      durationTurns: 0,
    })
  return {
    ...definition,
    contentVersion: definition.contentVersion + 1,
    effects,
    ...(addedAttack
      ? {
          apCost: 50,
          mpCost: 3,
          tags: [
            ...definition.tags.filter((tag) => tag !== 'cockpit:defense'),
            'attack',
            'mystic',
            'cockpit:attack',
          ],
        }
      : {}),
    ...(definition.effectDescriptions
      ? {
          effectDescriptions: [
            ...(addedAttack ? [null] : []),
            ...definition.effectDescriptions.map((description, index) =>
              definition.effects[index]?.type === row.type ? null : description,
            ),
          ],
        }
      : {}),
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, 'attack-percentage-dots']),
      ],
    },
  }
}

export function createPercentageDotEssenceVersion(
  definition: EssenceDefinition,
): EssenceDefinition | null {
  const skill = createPercentageDotSkillVersion(definition.skill)
  if (!skill) return null
  return {
    ...definition,
    contentVersion: skill.contentVersion,
    skill,
    authoring: {
      ...definition.authoring,
      validationTags: [
        ...new Set([...definition.authoring.validationTags, 'attack-percentage-dots']),
      ],
    },
  }
}

/** Authored-power estimate for balance reports; runtime captures actual committed hostile HP loss. */
export function estimatedPercentageDotTotal(
  effect: MatureSkillEffectDefinition,
  capturedBasis: number,
): number | null {
  if (effect.type === 'summon' || !isPercentageDotEffect(effect)) return null
  const ticks = effect.type === 'bleed' ? effect.ticks : effect.durationTurns!
  return Array.from({ length: ticks }, (_, stage) =>
    percentageDotTickDamage(
      capturedBasis,
      effect.damageProfile,
      effect.type === 'burn' ? stage : 0,
    ),
  ).reduce((sum, amount) => sum + amount, 0)
}
