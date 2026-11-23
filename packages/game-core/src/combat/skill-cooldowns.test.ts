import { expect, it } from 'vitest'
import { applySkillCooldown, validateSkillCooldownDefinition } from './skill-cooldowns'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'

it('retains exact large cooldown counters with room for the activation tick', () => {
  const combatant = percentageDotEncounter().tactical.battle.combatants[0]!
  for (const ownerTurns of [100, Number.MAX_SAFE_INTEGER - 1]) {
    const definition = { key: 'test.large-cooldown', ownerTurns }
    expect(validateSkillCooldownDefinition(definition)).toEqual([])
    const result = applySkillCooldown(combatant, definition, {
      actionId: 'test.action',
      definitionVersion: 1,
    })
    expect(result.events[0]).toMatchObject({ ownerTurns, ticksRemaining: ownerTurns + 1 })
  }
  for (const ownerTurns of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER])
    expect(validateSkillCooldownDefinition({ key: 'test.large-cooldown', ownerTurns })).toContain(
      'ownerTurns',
    )
})
