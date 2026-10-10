import { describe, expect, it } from 'vitest'
import {
  validateCombatTagPayload,
  combatTagDefinition,
  equipmentArmorAfterPierce,
} from './combat-tag-registry'
import { resolveMatureSkillVersion } from './mature-skills'

describe('implemented combat Tag registry', () => {
  it('future_armor_boundary uses only explicit equipment Armor, never armor/ward', () => {
    expect(equipmentArmorAfterPierce({ equipmentArmor: 40, armor: 999, ward: 999 }, 2500)).toBe(30)
    expect(equipmentArmorAfterPierce({ armor: 40, ward: 99 }, 10000)).toBe(0)
    expect(equipmentArmorAfterPierce({ equipmentArmor: 40 }, 0)).toBe(40)
    expect(() => equipmentArmorAfterPierce({ equipmentArmor: -1 }, 10000)).toThrow()
    expect(() => equipmentArmorAfterPierce({ equipmentArmor: 1 }, 10001)).toThrow()
    expect(
      validateCombatTagPayload({
        type: 'pierce',
        recipient: 'primary-unit',
        amount: 20,
        armorIgnoredBasisPoints: 10000,
      }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'pierce',
        recipient: 'primary-unit',
        amount: 0,
        armorIgnoredBasisPoints: 2500,
      }),
    ).not.toEqual([])
  })

  it('preserves damage1–20 and percentage units while rejecting legacy piercing in canonical payloads', () => {
    expect(
      validateCombatTagPayload({ type: 'damage', recipient: 'primary-unit', amount: 1 }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({ type: 'damage', recipient: 'primary-unit', amount: 20 }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({ type: 'damage', recipient: 'primary-unit', amount: 21 }),
    ).not.toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'damage',
        recipient: 'primary-unit',
        amount: 20,
        piercing: true,
      }),
    ).not.toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'affected-units',
        statusId: 'suppress',
        stacks: 1,
        potencyBasisPoints: 10000,
        durationTurns: 4,
      }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'suppress',
        stacks: 2,
      }),
    ).not.toEqual([])
  })

  it('rejects unsupported recipients, unknown payload keys and fake handlers', () => {
    expect(
      validateCombatTagPayload({
        type: 'displace',
        recipient: 'actor',
        direction: 'pull',
        distance: 1,
      }),
    ).toContainEqual(expect.objectContaining({ code: 'unsupported-recipient' }))
    expect(
      validateCombatTagPayload({
        type: 'damage',
        recipient: 'primary-unit',
        amount: 20,
        script: 'hit()',
      }),
    ).toContainEqual(expect.objectContaining({ code: 'unknown-key' }))
    expect(validateCombatTagPayload({ type: 'teleport', recipient: 'actor' })).toContainEqual(
      expect.objectContaining({ code: 'unsupported-tag' }),
    )
    expect(combatTagDefinition('damage')?.handler).toBe('combat-action')
    expect(combatTagDefinition('teleport')).toBeNull()
  })

  it('rejects unsupported Ongoing attacks and Automatic movement combinations', () => {
    expect(
      validateCombatTagPayload(
        { type: 'damage', recipient: 'affected-units', amount: 1 },
        { activation: 'ongoing', mode: 'modifier' },
      ),
    ).toContainEqual(expect.objectContaining({ code: 'unsupported-combination' }))
    expect(
      validateCombatTagPayload(
        { type: 'return-to-turn-start', recipient: 'actor' },
        { activation: 'automatic', mode: 'action' },
      ),
    ).toContainEqual(expect.objectContaining({ code: 'unsupported-combination' }))
  })

  it.each([
    { type: 'sensory', recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 0 },
    { type: 'copy-statuses', recipient: 'primary-unit', mode: 'copy-everything' },
    {
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'curse',
      allowNoEligibleEffects: 'yes',
    },
    { type: 'return-to-turn-start', recipient: 'actor', anchorMode: 'anywhere' },
    { type: 'apply-status', recipient: 'actor', statusId: 'revealed', stacks: 1 },
    { type: 'healing', recipient: 'actor', amount: 2, power: 20 },
  ])('validates the full implemented payload contract: %j', (payload) => {
    expect(validateCombatTagPayload(payload)).not.toEqual([])
  })

  it('accepts only native whole-percentage recovery in basis points and narrow maintained bonuses', () => {
    expect(
      validateCombatTagPayload({
        type: 'percentage-recovery',
        recipient: 'actor',
        resource: 'hp',
        percentageBasisPoints: 100,
        ticks: 4,
      }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'percentage-recovery',
        recipient: 'actor',
        resource: 'mp',
        percentageBasisPoints: 10000,
      }),
    ).toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'percentage-recovery',
        recipient: 'actor',
        resource: 'hp',
        percentageBasisPoints: 101,
      }),
    ).not.toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'percentage-recovery',
        recipient: 'actor',
        resource: 'hp',
        percent: 100,
      }),
    ).not.toEqual([])
    expect(
      validateCombatTagPayload(
        { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
        { activation: 'ongoing', mode: 'modifier' },
      ),
    ).toEqual([])
    expect(
      validateCombatTagPayload(
        { type: 'damage-bonus', recipient: 'affected-units', multiplierBasisPoints: 11000 },
        { activation: 'ongoing', mode: 'modifier' },
      ),
    ).not.toEqual([])
    expect(combatTagDefinition('damage-bonus')?.runtimeCapability).toBe(
      'maintained-source-resolver-required',
    )
  })

  it('validates nested summon mechanics and rejects unknown nested handlers/keys', () => {
    const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
    expect(
      validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile }),
    ).toEqual([])
    const unknown = JSON.parse(JSON.stringify(profile))
    unknown.abilities[0].effects = [{ type: 'teleport', recipient: 'actor' }]
    expect(
      validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile: unknown }),
    ).not.toEqual([])
    const scripted = JSON.parse(JSON.stringify(profile))
    scripted.stats.script = 1
    expect(
      validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile: scripted }),
    ).toContainEqual(expect.objectContaining({ code: 'unknown-key' }))
    const unbounded = JSON.parse(JSON.stringify(profile))
    unbounded.abilities[0].effects = Array.from({ length: 33 }, () => ({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 1,
    }))
    expect(
      validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile: unbounded }),
    ).not.toEqual([])
  })
})
