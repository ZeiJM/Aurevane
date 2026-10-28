import { expect, it } from 'vitest'
import {
  AUTHORABLE_EFFECT_TAGS,
  createAuthorableEffectPayload,
  effectAuthoringIssue,
  effectAuthoringTag,
} from './combat-effect-authoring'
import {
  COMBAT_TAG_REGISTRY,
  SUPPORTED_COMBAT_STATUS_IDS,
  validateCombatTagPayload,
} from './combat-tag-registry'
import { latestEnabledMatureSkills } from './mature-skills'

it('exposes each implemented handler and each supported status as an individual choice', () => {
  for (const tag of COMBAT_TAG_REGISTRY)
    expect(AUTHORABLE_EFFECT_TAGS.some((choice) => choice.opcode === tag.id)).toBe(true)
  for (const status of SUPPORTED_COMBAT_STATUS_IDS)
    expect(AUTHORABLE_EFFECT_TAGS.some((choice) => choice.statusId === status)).toBe(true)
  for (const id of [
    'damage',
    'pierce',
    'vengeance',
    'hp-recovery',
    'mp-recovery',
    'copy-buffs',
    'copy-debuffs',
    'cleanse',
    'dispel',
    'conditional-cleanse',
    'push',
    'pull',
  ])
    expect(AUTHORABLE_EFFECT_TAGS.some((choice) => choice.id === id)).toBe(true)
  expect(new Set(AUTHORABLE_EFFECT_TAGS.map((tag) => tag.id)).size).toBe(
    AUTHORABLE_EFFECT_TAGS.length,
  )
  expect(AUTHORABLE_EFFECT_TAGS.some((tag) => tag.statusId === 'regeneration')).toBe(false)
})
it('builds independent executable payloads and identifies their exact authoring variant', () => {
  const summonProfile = latestEnabledMatureSkills().find(
    (skill) => skill.summonProfile,
  )?.summonProfile
  for (const tag of AUTHORABLE_EFFECT_TAGS) {
    const payload = createAuthorableEffectPayload(tag.id, { summonProfile })
    if (tag.unavailableReason) {
      expect(payload).toBeNull()
      expect(
        effectAuthoringIssue(tag.id, { activation: 'manual', mode: 'action' }, { summonProfile }),
      ).toBe(tag.unavailableReason)
      continue
    }
    expect(payload, tag.id).not.toBeNull()
    expect(validateCombatTagPayload(payload), tag.id).toEqual([])
    expect(effectAuthoringTag(payload!).id, tag.id).toBe(tag.id)
  }
  const first = createAuthorableEffectPayload('copy-buffs')!
  expect(first).not.toBe(createAuthorableEffectPayload('copy-buffs'))
  expect(createAuthorableEffectPayload('vengeance')).toMatchObject({
    type: 'damage',
    amount: 0,
    vengeance: { maximumDamage: 20 },
  })
})
it('explains unsupported activation combinations and missing Summon context', () => {
  expect(effectAuthoringIssue('copy-buffs', { activation: 'ongoing', mode: 'modifier' })).toMatch(
    /does not support|only/i,
  )
  expect(effectAuthoringIssue('summon', { activation: 'manual', mode: 'action' })).toMatch(
    /profile/i,
  )
  expect(effectAuthoringIssue('damage', { activation: 'manual', mode: 'action' })).toBeNull()
})

it('identifies retained native Barrier-shattering damage as Pierce without reinterpreting its payload', () => {
  const payload = {
    type: 'damage' as const,
    recipient: 'primary-unit' as const,
    amount: 8,
    shattersBarrier: true,
  }
  expect(effectAuthoringTag(payload).id).toBe('pierce')
  expect(payload).toEqual({
    type: 'damage',
    recipient: 'primary-unit',
    amount: 8,
    shattersBarrier: true,
  })
})
