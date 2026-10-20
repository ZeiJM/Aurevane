import { expect, it } from 'vitest'
import { defaultBasicSkills } from '../combat/combat-basic-actions'
import { COMBAT_TAG_REGISTRY } from '../combat/combat-tag-registry'
import {
  parseNoncombatContentDefinition,
  noncombatPublicationBlocker,
  type NoncombatContentKind,
} from './authored-content'
const common = {
  schemaVersion: 1,
  id: 'draft.test',
  contentVersion: 1,
  name: 'Authored intent',
  description: 'A finite authoring intent.',
  sortOrder: 0,
  enabled: true,
  media: { artworkId: 'art.original' },
}
const item = {
  ...common,
  itemClass: 'consumable',
  usage: 'active',
  equipmentSlot: null,
  acquisition: 'unimplemented',
  requirements: null,
  ability: null,
}
const discipline = {
  ...common,
  core: { might: 8, finesse: 4, vitality: 7, agility: 4, intellect: 4, resolve: 4 },
  focus: ['might', 'vitality'],
  enabledForPrimary: true,
  enabledForSecondary: true,
  linkedSkills: [],
  unlock: { kind: 'unavailable' },
}
const transformation = (kind: 'ascension' | 'severence') => ({
  ...common,
  formName: 'Future form',
  requirements: null,
  ability: null,
  transformation: { kind, description: 'An authored form intent.' },
})
it.each([
  ['item', item],
  ['discipline', discipline],
  [
    'tag',
    { ...common, tagId: COMBAT_TAG_REGISTRY[0]!.id, explanation: 'Registry-owned behavior.' },
  ],
  ['ascension', transformation('ascension')],
  ['severence', transformation('severence')],
] as const)(
  'round-trips finite %s drafts independently and returns a specific runtime blocker',
  (kind, definition) => {
    const parsed = parseNoncombatContentDefinition(kind, definition)
    expect(parsed).toEqual(definition)
    expect(parsed).not.toBe(definition)
    expect(noncombatPublicationBlocker(kind)).toMatchObject({ code: `${kind}-runtime-unsupported` })
  },
)
it('future Ability and nested Requirements reuse the implemented grammar without activating any runtime', () => {
  const ability = defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability
  expect(ability).toBeDefined()
  const definition = {
    ...item,
    ability,
    requirements: {
      kind: 'all',
      children: [
        {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'hp',
          comparison: 'at-most',
          basisPoints: 5000,
        },
        { kind: 'prime-presence', subject: 'owner', present: true },
      ],
    },
  }
  expect(parseNoncombatContentDefinition('item', definition)).toEqual(definition)
  expect(() =>
    parseNoncombatContentDefinition('item', {
      ...definition,
      ability: { schemaVersion: 1, behaviors: [{ execute: 'grant()' }] },
    }),
  ).toThrow()
  expect(() =>
    parseNoncombatContentDefinition('item', {
      ...definition,
      requirements: { kind: 'all', children: [{ kind: 'script' }] },
    }),
  ).toThrow()
})
it.each([
  ['item', { ...item, itemClass: null }],
  ['item', { ...item, equipmentSlot: 'weapon' }],
  ['item', { ...item, inventory: { owned: true } }],
  ['discipline', { ...discipline, core: { ...discipline.core, might: 9 } }],
  ['discipline', { ...discipline, focus: ['might', 'might'] }],
  ['tag', { ...common, tagId: 'not-registered', explanation: 'Unknown handler.' }],
  [
    'ascension',
    {
      ...transformation('ascension'),
      transformation: { kind: 'severence', description: 'Wrong form.' },
    },
  ],
  ['severence', { ...transformation('severence'), grantPower: 100 }],
] as const)('rejects unsupported %s authoring payload', (kind, definition) =>
  expect(() => parseNoncombatContentDefinition(kind as NoncombatContentKind, definition)).toThrow(),
)
it.each(['', ' ', '\u2003', 'bad\u0007text', ' padded'])(
  'rejects blank, control or untrimmed display text %j',
  (name) => expect(() => parseNoncombatContentDefinition('item', { ...item, name })).toThrow(),
)
