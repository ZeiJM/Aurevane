import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('server-only', () => ({}))
import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import { defaultCombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { captureBasicSkillSources } from '@aurevane/game-core/combat/combat-basic-actions'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { AbilityDefinitionParameters } from '@/components/character/ability-definition-parameters'
import {
  createCombatContentResolver,
  type PublishedCombatContentCatalogueSnapshot,
} from './combat-content-resolver'
function published(version: number, name: string): CombatContentVersionRecord {
  return {
    id: `00000000-0000-4000-8000-${String(version).padStart(12, '0')}`,
    contentKey: 'tag.percentage-recovery',
    contentKind: 'tag',
    contentVersion: version,
    publishedBy: 'owner',
    publishedAt: '2026-10-22T00:00:00Z',
    definition: {
      schemaVersion: 1,
      id: 'tag.percentage-recovery',
      contentVersion: version,
      enabled: true,
      sortOrder: 0,
      media: {},
      tagId: 'percentage-recovery',
      name,
      description: 'Restore a share of maximum resource.',
      explanation: 'The percentage uses the recipient’s maximum resource.',
    },
  }
}
it('current Tag publication changes actual readers and a new frozen capture while exact old snapshots remain unchanged', async () => {
  const old = published(1, 'Recovery'),
    next = published(2, 'Renewal')
  let snapshot: PublishedCombatContentCatalogueSnapshot = {
    token: 'a'.repeat(32),
    policy: defaultCombatEffectTimingPolicy(),
    publications: [old],
  }
  const resolver = createCombatContentResolver({
    readCatalogueSnapshot: async () => structuredClone(snapshot),
    findCurrentSkill: async () => null,
    findSkillVersion: async () => null,
    findContentVersion: async (key, kind, version) =>
      key === old.contentKey && kind === 'tag'
        ? version === 1
          ? old
          : version === 2
            ? next
            : null
        : null,
  })
  const first = await resolver.captureCurrentCatalogue!()
  const definitions = await first.resolver.resolveCurrentBasicSkillDefinitions!([
    'basic.move',
    'unarmed.basic',
    'basic.recover.mp',
  ])
  const captures = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: 'basic.recover.mp',
    definitions: [...definitions.values()],
  })
  const retained = JSON.stringify(captures)
  const oldMarkup = renderToStaticMarkup(
    <AbilityDefinitionParameters definition={projectPublicCombat(captures[2]!.definition)} />,
  )
  expect(oldMarkup).toContain('Explain Recovery')
  snapshot = { ...snapshot, token: 'b'.repeat(32), publications: [next] }
  const current = await resolver.resolveCurrentBasicSkillDefinitions!(['basic.recover.mp'])
  expect(
    renderToStaticMarkup(
      <AbilityDefinitionParameters
        definition={projectPublicCombat(current.get('basic.recover.mp')!.ability)}
      />,
    ),
  ).toContain('Explain Renewal')
  const second = await resolver.captureCurrentCatalogue!()
  const newer = await second.resolver.resolveCurrentBasicSkillDefinitions!([
    'basic.move',
    'unarmed.basic',
    'basic.recover.mp',
  ])
  const admitted = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: 'basic.recover.mp',
    definitions: [...newer.values()],
  })
  expect(admitted[2]!.definition.tagPresentation?.[0]?.contentVersion).toBe(2)
  expect(JSON.stringify(captures)).toBe(retained)
  expect(
    (await first.resolver.resolveCurrentBasicSkillDefinitions!(['basic.recover.mp'])).get(
      'basic.recover.mp',
    )!.ability.tagPresentation?.[0]?.name,
  ).toBe('Recovery')
  expect(await resolver.resolvePinnedTagPresentation!('tag.percentage-recovery', 1)).toMatchObject({
    name: 'Recovery',
    contentVersion: 1,
  })
  expect(await resolver.resolvePinnedTagPresentation!('tag.percentage-recovery', 999)).toBeNull()
  expect(captures[2]!.definition.behaviors).toEqual(admitted[2]!.definition.behaviors)
})

it('rejects mismatched physical or embedded identity at the exact Tag reader boundary', async () => {
  for (const row of [
    published(2, 'Wrong version'),
    { ...published(1, 'Wrong key'), contentKey: 'tag.damage' },
    {
      ...published(1, 'Wrong embedded identity'),
      definition: {
        ...(published(1, 'Wrong embedded identity').definition as object),
        contentVersion: 2,
      },
    },
  ]) {
    const resolver = createCombatContentResolver({
      findCurrentSkill: async () => null,
      findSkillVersion: async () => null,
      findContentVersion: async () => row,
    })
    expect(await resolver.resolvePinnedTagPresentation!('tag.percentage-recovery', 1)).toBeNull()
  }
})
