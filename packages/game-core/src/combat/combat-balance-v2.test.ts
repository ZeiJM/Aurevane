import { describe, expect, it } from 'vitest'

import { combatPowerForAp } from './combat-balance-v2'
import { P36_REPRESENTATIVE_ESSENCES } from './essence'
import { latestEnabledMatureSkills } from './mature-skills'
import { P35_REPRESENTATIVE_RESONANCES } from './resonance'

function latestById<T extends { readonly contentVersion: number }>(
  entries: readonly T[],
  id: (entry: T) => string,
): readonly T[] {
  const latest = new Map<string, T>()
  for (const entry of entries) {
    const key = id(entry)
    const previous = latest.get(key)
    if (!previous || entry.contentVersion > previous.contentVersion) latest.set(key, entry)
  }
  return [...latest.values()]
}

function expectPowerMagnitude(value: number) {
  expect(Math.abs(value)).toBeGreaterThanOrEqual(1)
  expect(Math.abs(value)).toBeLessThanOrEqual(20)
}

describe('owner combat rebalance v2', () => {
  it('keeps the AP-driven authored Power projection bounded and monotonic', () => {
    let previous = 0
    for (let ap = 25; ap <= 75; ap += 5) {
      const power = combatPowerForAp(ap)
      expect(power).toBeGreaterThanOrEqual(previous)
      expect(power).toBeGreaterThanOrEqual(1)
      expect(power).toBeLessThanOrEqual(20)
      previous = power
    }
  })

  it('rebalances every current regular Discipline Skill into bounded AP, cooldown, and Power ranges', () => {
    const skills = latestEnabledMatureSkills()
    expect(skills.length).toBe(136)

    for (const skill of skills) {
      expect(skill.apCost).toBeGreaterThanOrEqual(25)
      expect(skill.apCost).toBeLessThanOrEqual(65)
      expect(skill.cooldown.ownerTurns).toBeGreaterThanOrEqual(1)
      expect(skill.cooldown.ownerTurns).toBeLessThanOrEqual(3)
      expect(skill.authoring.validationTags).toContain('owner-combat-rebalance-v2')
      expect(skill.authoring.validationTags).toContain('power-scale-1-20')

      for (const effect of skill.effects) {
        if (effect.type === 'damage' && !('vengeance' in effect && effect.vengeance !== undefined)) {
          expectPowerMagnitude(effect.amount)
        } else if (effect.type === 'healing' || effect.type === 'barrier-change') {
          expectPowerMagnitude(effect.amount)
        } else if (effect.type === 'resource-change') {
          expectPowerMagnitude(effect.delta)
        }
      }
    }
  })

  it('keeps current Essence Skills AP-premium and inside the same bounded authored Power model', () => {
    const essences = latestById(P36_REPRESENTATIVE_ESSENCES, (entry) => entry.essenceId)
    expect(essences).toHaveLength(17)

    for (const essence of essences) {
      expect(essence.skill.apCost).toBeGreaterThanOrEqual(55)
      expect(essence.skill.apCost).toBeLessThanOrEqual(75)
      expect(essence.skill.cooldown.ownerTurns).toBeGreaterThanOrEqual(1)
      expect(essence.skill.cooldown.ownerTurns).toBeLessThanOrEqual(3)
      expect(essence.authoring.validationTags).toContain('owner-combat-rebalance-v2')

      for (const effect of essence.skill.effects) {
        if (effect.type === 'damage' && !('vengeance' in effect && effect.vengeance !== undefined)) {
          expectPowerMagnitude(effect.amount)
        } else if (effect.type === 'healing' || effect.type === 'barrier-change') {
          expectPowerMagnitude(effect.amount)
        } else if (effect.type === 'resource-change') {
          expectPowerMagnitude(effect.delta)
        }
      }
    }
  })

  it('keeps all 136 current Resonances distinct by pair while preserving broad setup/payoff variety', () => {
    const resonances = latestById(P35_REPRESENTATIVE_RESONANCES, (entry) => entry.id)
    expect(resonances).toHaveLength(136)

    const pairs = new Set(resonances.map((entry) => entry.disciplinePair.join('|')))
    expect(pairs.size).toBe(136)

    const signatures = new Set(
      resonances.map((entry) =>
        JSON.stringify([
          entry.trigger.setup.requiredTags,
          entry.trigger.payoff.requiredTags,
          entry.trigger.payoffEffects.map((effect) => effect.type),
        ]),
      ),
    )
    expect(signatures.size).toBeGreaterThan(16)

    for (const resonance of resonances) {
      expect(resonance.authoring.validationTags).toContain('owner-combat-rebalance-v2')
      expect(resonance.authoring.validationTags).toContain('varied-resonance-payoff')
      for (const effect of resonance.trigger.payoffEffects) {
        if (effect.type === 'damage') expectPowerMagnitude(effect.amount)
        else if (effect.type === 'healing' || effect.type === 'barrier-change') {
          expectPowerMagnitude(effect.amount)
        } else if (effect.type === 'resource-change') {
          expectPowerMagnitude(effect.delta)
        }
      }
    }
  })
})
