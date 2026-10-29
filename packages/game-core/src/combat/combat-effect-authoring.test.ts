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

it('exposes current individual tags while retaining legacy engine support', () => {
  for (const tag of COMBAT_TAG_REGISTRY.filter(
    (tag) => !['healing', 'damage-bonus'].includes(tag.id),
  ))
    expect(AUTHORABLE_EFFECT_TAGS.some((choice) => choice.opcode === tag.id)).toBe(true)
  for (const status of SUPPORTED_COMBAT_STATUS_IDS.filter(
    (id) => !['blindside', 'revealed'].includes(id),
  ))
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

it('replaces the retired Chilled companion with a configurable Conditional Cleanse in packet modifiers', () => {
  const combination = { activation: 'manual' as const, mode: 'modifier' as const }
  expect(effectAuthoringIssue('conditional-cleanse', combination)).toBeNull()
  const payload = createAuthorableEffectPayload('conditional-cleanse', { combination })
  expect(payload).toEqual({
    type: 'remove-status',
    recipient: 'actor',
    statusIds: ['frozen'],
    removalMode: 'specified',
    target: 'self',
  })
  expect(validateCombatTagPayload(payload, combination)).toEqual([])
  expect(
    validateCombatTagPayload({ ...payload, recipient: 'primary-unit' }, combination),
  ).not.toEqual([])
  expect(
    validateCombatTagPayload({ ...payload, statusIds: ['frozen', 'burn'] }, combination),
  ).not.toEqual([])
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

it('offers one current Blindside, Reveal and Damage Up without obsolete authoring choices', () => {
  for (const id of [
    'healing',
    'damage-bonus',
    'status:blindside',
    'status:revealed',
    'cleanse-chilled',
  ]) {
    expect(AUTHORABLE_EFFECT_TAGS.some((tag) => tag.id === id)).toBe(false)
    expect(createAuthorableEffectPayload(id)).toBeNull()
  }
  expect(
    AUTHORABLE_EFFECT_TAGS.filter((tag) => tag.label === 'Blindside').map((tag) => tag.id),
  ).toEqual(['status:blindside-vulnerability'])
  expect(
    AUTHORABLE_EFFECT_TAGS.filter((tag) => tag.label === 'Damage Up').map((tag) => tag.id),
  ).toEqual(['status:inspired'])
  expect(SUPPORTED_COMBAT_STATUS_IDS).toContain('revealed')
  expect(SUPPORTED_COMBAT_STATUS_IDS).toContain('blindside')
})
it.each(['manual', 'ongoing'] as const)(
  'authors Damage Up for %s modifiers with its existing activation semantics',
  (activation) => {
    const combination = { activation, mode: 'modifier' as const }
    expect(effectAuthoringIssue('status:inspired', combination)).toBeNull()
    const payload = createAuthorableEffectPayload('status:inspired', { combination })
    expect(payload).toEqual({
      type: 'damage-bonus',
      recipient: 'actor',
      multiplierBasisPoints: 11250,
    })
    expect(validateCombatTagPayload(payload, combination)).toEqual([])
    expect(effectAuthoringTag(payload!)).toMatchObject({
      id: 'status:inspired',
      label: 'Damage Up',
    })
    expect(createAuthorableEffectPayload('status:inspired')).toMatchObject({
      type: 'apply-status',
      statusId: 'inspired',
    })
  },
)

it('preserves the existing automatic modifier restriction for Damage Up', () => {
  const combination = { activation: 'automatic', mode: 'modifier' } as const
  expect(createAuthorableEffectPayload('status:inspired', { combination })).toMatchObject({
    type: 'apply-status',
    statusId: 'inspired',
  })
  expect(effectAuthoringIssue('status:inspired', combination)).toContain(
    'Packet modifiers permit only required elemental companion statuses',
  )
})
