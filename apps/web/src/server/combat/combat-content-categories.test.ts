import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { combatContentCategory, COMBAT_CONTENT_CATEGORIES } from './combat-content-categories'

it('describes every stored kind, keeping reserved Basics as skill and blocking opaque authoring', () => {
  expect(COMBAT_CONTENT_CATEGORIES.map((entry) => entry.category)).toEqual([
    'basic',
    'skill',
    'essence',
    'resonance',
    'status',
    'effect-profile',
    'discipline',
    'tag',
    'item',
    'ascension',
    'severence',
  ])
  const basic = defaultBasicSkills()[0]!
  expect(combatContentCategory('skill', basic.id)).toMatchObject({
    category: 'basic',
    storedKind: 'skill',
    identityField: 'id',
    runtime: 'combat',
    publicationBlocker: null,
  })
  expect(combatContentCategory('essence')).toMatchObject({ identityField: 'essenceId' })
  expect(combatContentCategory('invented')).toBeNull()
  expect(combatContentCategory('effect-profile')).toMatchObject({
    identityField: null,
    runtime: 'unsupported',
    authoringBlocker: { code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED' },
  })
})
it.each([
  ['skill', resolveMatureSkillVersion('vanguard.forceful-strike')!],
  ['skill', defaultBasicSkills()[0]!],
  ['essence', currentEssenceDefinitions()[0]!],
  ['resonance', currentResonanceDefinitions()[0]!],
  ['status', PHASE4_STATUSES[0]!],
] as const)(
  'uses the actual %s validators and identity without normalizing the body',
  (kind, definition) => {
    const identity = 'essenceId' in definition ? definition.essenceId : definition.id
    const descriptor = combatContentCategory(kind, identity)!
    const before = JSON.stringify(definition)
    expect(descriptor.parseAuthoring(definition)).toEqual(definition)
    expect(descriptor.parseRetained(definition, identity)).toEqual(definition)
    expect(() => descriptor.parseAuthoring({ arbitrary: { execute: 'unsupported' } })).toThrow()
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it('retains opaque legacy objects through the explicit non-runtime descriptor and blocks new data', () => {
  const descriptor = combatContentCategory('effect-profile')!
  const opaque = { values: [4], id: { incidental: true }, contentVersion: -9 }
  expect(descriptor.parseRetained(opaque, 'owner.profile')).toEqual(opaque)
  expect(() => descriptor.parseAuthoring(opaque)).toThrow(/Effect Profile.*unsupported/i)
  expect(descriptor.publicationBlocker).toEqual(descriptor.authoringBlocker)
})
it.each(['item', 'ascension', 'severence'] as const)(
  'retains the specific unsupported %s capability',
  (kind) => {
    const descriptor = combatContentCategory(kind)!
    expect(descriptor.runtime).toBe('unsupported')
    expect(descriptor.publicationBlocker?.code).toBe(`${kind}-runtime-unsupported`)
    expect(() => descriptor.parseAuthoring({ arbitrary: true })).toThrow()
  },
)

it.each([
  { id: 'tag.damage', description: 'x'.repeat(241) },
  { id: 'tag.00000000-0000-4000-8000-000000000091', description: 'Retained text.' },
])(
  'keeps retained Tag drafts correctable while rejecting noncanonical publication: %j',
  (retained) => {
    const definition = {
      schemaVersion: 1,
      contentVersion: 1,
      name: 'Impact',
      sortOrder: 0,
      enabled: true,
      media: {},
      tagId: 'damage',
      explanation: 'Damage power.',
      ...retained,
    }
    const category = combatContentCategory('tag')!
    expect(category.parseRetained(definition, definition.id)).toEqual(definition)
    expect(category.parseAuthoring(definition)).toEqual(definition)
    expect(() => category.validatePublication!(definition)).toThrow()
    expect(() =>
      category.parsePublished({
        id: 'version',
        contentKey: definition.id,
        contentKind: 'tag',
        contentVersion: 1,
        definition,
        publishedBy: 'owner',
        publishedAt: '2026-10-22T00:00:00Z',
      }),
    ).toThrow()
    const corrected = { ...definition, id: 'tag.damage', description: 'Relative power.' }
    expect(() => category.validatePublication!(corrected)).not.toThrow()
  },
)

it('provides finite editor defaults through the shared descriptor for every creatable category', () => {
  for (const descriptor of COMBAT_CONTENT_CATEGORIES) {
    expect(descriptor).toHaveProperty('editor')
    const editor = descriptor.editor
    expect(editor.label.length).toBeGreaterThan(0)
    if (!editor.defaultDefinition) continue
    expect(() => descriptor.parseAuthoring(editor.defaultDefinition)).not.toThrow()
    expect(JSON.parse(JSON.stringify(editor))).toEqual(editor)
  }
})
