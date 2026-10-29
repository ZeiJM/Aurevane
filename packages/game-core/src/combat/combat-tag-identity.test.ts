import { expect, it } from 'vitest'
import {
  bindCombatTagPresentations,
  captureCombatTagPresentation,
  combatTagPresentationIssues,
  combatEffectTagPresentation,
} from './combat-tag-registry'
import { source } from './combat-behavior.test-utils'
import { assertTagPublicationReady } from '../content/authored-content'
import { combatEffectPresentationId } from './combat-effect-identities'

const wording = (id: string) =>
  captureCombatTagPresentation({
    id: `tag.${id}`,
    contentVersion: 1,
    tagId: id,
    name: id,
    description: `Short ${id}.`,
    explanation: `Full ${id}.`,
  })

it('accepts distinct gameplay variant and status wording without inventing handlers', () => {
  for (const id of [
    'copy-buffs',
    'copy-debuffs',
    'dispel',
    'cleanse',
    'guarded',
    'vengeance',
    'hp-recovery',
    'mp-recovery',
    'push',
    'pull',
  ]) {
    expect(wording(id).tagId).toBe(id)
    expect(combatTagPresentationIssues([wording(id)])).toEqual([])
  }
  expect(() => wording('unimplemented-tag')).toThrow()
})

it('keeps historical and specified removal identities aligned with the actual engine tag', () => {
  expect(
    combatEffectPresentationId({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['guarded'],
    }),
  ).toBe('dispel')
  expect(
    combatEffectPresentationId({
      type: 'remove-status',
      recipient: 'primary-unit',
      statusIds: ['covert'],
    }),
  ).toBe('cleanse')
  expect(
    combatEffectPresentationId({
      type: 'remove-status',
      recipient: 'actor',
      statusIds: ['frozen'],
      removalMode: 'specified',
    }),
  ).toBe('conditional-cleanse')
})

it('prefers exact tag wording and retains historical opcode fallback', () => {
  const buffs = { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' } as const
  const debuffs = { ...buffs, mode: 'curse' } as const
  const rows = ['copy-statuses', 'copy-buffs', 'copy-debuffs'].map(wording)
  expect(combatEffectTagPresentation(rows, buffs)?.tagId).toBe('copy-buffs')
  expect(combatEffectTagPresentation(rows, debuffs)?.tagId).toBe('copy-debuffs')
  expect(combatEffectTagPresentation(rows.slice(0, 1), debuffs)?.tagId).toBe('copy-statuses')
})

it('publishes independent wording records for gameplay tags through the existing authority', () => {
  for (const id of ['dispel', 'copy-buffs', 'copy-debuffs', 'guarded'])
    expect(() =>
      assertTagPublicationReady({
        schemaVersion: 1,
        id: `tag.${id}`,
        contentVersion: 1,
        tagId: id,
        name: id,
        description: 'Short explanation.',
        explanation: 'Full explanation.',
        enabled: true,
        sortOrder: 0,
        media: {},
      }),
    ).not.toThrow()
})

it('accepts only the explicit generated-description tokens and rejects arbitrary placeholders', () => {
  const record = {
    id: 'tag.dispel',
    tagId: 'dispel',
    contentVersion: 1,
    name: 'Dispel',
    description: '{summary}',
    explanation: 'Dispel: {details}',
  }
  expect(captureCombatTagPresentation(record)).toMatchObject({
    compact: '{summary}',
    full: 'Dispel: {details}',
  })
  for (const explanation of ['{unknown}', '<script>x</script>', '{details', '{{details}}'])
    expect(() => captureCombatTagPresentation({ ...record, explanation })).toThrow()
  expect(() => captureCombatTagPresentation({ ...record, description: '{details}' })).toThrow()
  expect(() =>
    captureCombatTagPresentation({ ...record, explanation: 'First paragraph.\nSecond paragraph.' }),
  ).not.toThrow()
})

it('binds the exact variants and status alongside compatible historical opcode wording', () => {
  const definition = source({
    effects: [
      {
        id: 'copy',
        payload: { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' },
      },
      {
        id: 'guard',
        payload: { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
      },
    ],
  }).definition
  const before = JSON.stringify(definition)
  const result = bindCombatTagPresentations(
    definition,
    ['copy-statuses', 'copy-buffs', 'copy-debuffs', 'apply-status', 'guarded', 'exposed'].map(
      wording,
    ),
  )
  expect(result.tagPresentation?.map((row) => row.tagId)).toEqual([
    'copy-statuses',
    'copy-buffs',
    'apply-status',
    'guarded',
  ])
  expect(JSON.stringify(definition)).toBe(before)
  expect(result.behaviors).toEqual(definition.behaviors)
})

it('binds native Skill, nested Essence and both native Resonance formats without changing payloads', () => {
  const effects = [{ type: 'barrier-change', recipient: 'actor', amount: 5 }]
  const skill = { id: 'custom.skill', contentVersion: 2, effects }
  const result = bindCombatTagPresentations(
    {
      skill,
      essence: { id: 'custom.essence', contentVersion: 1, skill },
      oldResonance: {
        id: 'custom.resonance',
        contentVersion: 1,
        trigger: { payoffEffects: effects },
      },
      resonance: { id: 'custom.resonance', contentVersion: 2, trigger: { resultEffects: effects } },
    },
    [wording('barrier'), wording('damage')],
  )
  for (const row of [result.skill, result.essence.skill, result.oldResonance, result.resonance])
    expect(row).toHaveProperty('tagPresentation', [wording('barrier')])
  expect(result.skill.effects).toEqual(effects)
  expect(skill).not.toHaveProperty('tagPresentation')
})

it('binds native summon wording without requiring a fabricated materialized summon payload', () => {
  const definition = {
    id: 'native.summon',
    contentVersion: 1,
    effects: [{ type: 'summon' as const, recipient: 'selected-tile' as const }],
  }
  expect(combatEffectPresentationId(definition.effects[0]!)).toBe('summon')
  expect(bindCombatTagPresentations(definition, [wording('summon')])).toHaveProperty(
    'tagPresentation',
    [wording('summon')],
  )
})
