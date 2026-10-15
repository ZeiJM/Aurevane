import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import {
  P36_REPRESENTATIVE_ESSENCES,
  resolveEssenceForBuild,
} from '@aurevane/game-core/combat/essence'
import {
  P35_REPRESENTATIVE_RESONANCES,
  resolveResonanceForPair,
} from '@aurevane/game-core/combat/resonance'
import {
  createCombatContentResolver,
  RpcPublishedCombatContentSource,
} from './combat-content-resolver'

const token = 'a'.repeat(32)
const policy = { version: 7, modes: {} }
function row(kind: string, key: string, definition: object, version: number) {
  return {
    id: `version:${key}`,
    content_key: key,
    content_kind: kind,
    content_version: version,
    definition: structuredClone(definition),
    published_by: 'owner',
    published_at: '2026-10-15T10:00:00Z',
  }
}
function fixture(
  data: unknown = { token, policy, publications: [] },
  error: { code: string; message: string } | null = null,
) {
  const rpc = vi.fn(async () => ({ data: structuredClone(data), error }))
  const resolver = createCombatContentResolver(new RpcPublishedCombatContentSource(rpc))
  return { resolver, rpc }
}
it('enumerates the complete current builtin ability catalogue without guessed per-key reads', async () => {
  const { resolver, rpc } = fixture()
  expect(resolver.resolveCurrentCatalogue).toBeTypeOf('function')
  const catalogue = await resolver.resolveCurrentCatalogue!()
  const expected = [
    ...defaultBasicSkills().map((d) => d.id),
    ...latestEnabledMatureSkills().map((d) => d.id),
    ...new Set(P36_REPRESENTATIVE_ESSENCES.map((d) => d.essenceId)),
    ...new Set(P35_REPRESENTATIVE_RESONANCES.map((d) => d.id)),
  ].sort()
  expect(catalogue.entries.map((entry) => entry.contentKey)).toEqual(expected)
  expect(new Set(catalogue.entries.map((entry) => entry.contentKey)).size).toBe(expected.length)
  expect(catalogue).toMatchObject({ token, policy })
  expect(rpc).toHaveBeenCalledExactlyOnceWith('read_combat_content_catalogue_v1', {})
  for (const entry of catalogue.entries) {
    expect(entry.source).toBe('builtin')
    if (entry.category === 'essence')
      expect(entry.contentVersion).toBe(
        resolveEssenceForBuild(entry.definition.sourceDisciplineId, null)!.contentVersion,
      )
    if (entry.category === 'resonance')
      expect(entry.contentVersion).toBe(
        resolveResonanceForPair(...entry.definition.disciplinePair)!.contentVersion,
      )
  }
})
it('overlays actual Owner choices, including custom identities, older current pointers and disabled records, without rewriting history', async () => {
  const skill = structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike', 2)!)
  const custom = {
    ...structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike')!),
    id: 'owner.unique-strike',
    contentVersion: 73,
    name: 'Owner unique strike',
  }
  const basic = { ...defaultBasicSkills()[0]!, contentVersion: 40, name: 'Owner Step' }
  const essence = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const changedEssence = {
    ...essence,
    contentVersion: 81,
    skill: { ...essence.skill, contentVersion: 81 },
    enabled: false,
  }
  const resonance = structuredClone(resolveResonanceForPair('vanguard', 'lifebinder')!)
  const changedResonance = { ...resonance, contentVersion: 82, name: 'Owner resonance' }
  const data = {
    token,
    policy,
    publications: [
      row('skill', skill.id, skill, 2),
      row('skill', custom.id, custom, 73),
      row('skill', basic.id, basic, 40),
      row('essence', essence.essenceId, changedEssence, 81),
      row('resonance', resonance.id, changedResonance, 82),
      row('status', 'owner.status', { id: 'owner.status', values: [3] }, 1),
      row('effect-profile', 'owner.profile', { id: 'owner.profile', values: [4] }, 1),
    ],
  }
  const before = JSON.stringify(data)
  const { resolver } = fixture(data)
  const first = await resolver.resolveCurrentCatalogue!()
  expect(first.entries.find((e) => e.contentKey === skill.id)).toMatchObject({
    source: 'published',
    contentVersion: 2,
    category: 'skill',
  })
  expect(first.entries.find((e) => e.contentKey === custom.id)).toMatchObject({
    source: 'published',
    definition: { name: 'Owner unique strike' },
  })
  expect(first.entries.find((e) => e.contentKey === basic.id)).toMatchObject({
    category: 'basic',
    contentVersion: 40,
    definition: { name: 'Owner Step' },
  })
  expect(first.entries.find((e) => e.contentKey === essence.essenceId)).toMatchObject({
    category: 'essence',
    contentVersion: 81,
    definition: { enabled: false },
  })
  expect(first.entries.find((e) => e.contentKey === resonance.id)).toMatchObject({
    category: 'resonance',
    contentVersion: 82,
  })
  expect(first.entries.find((e) => e.contentKey === 'owner.status')).toMatchObject({
    category: 'status',
    definition: { values: [3] },
  })
  expect(first.entries.find((e) => e.contentKey === 'owner.profile')).toMatchObject({
    category: 'effect-profile',
  })
  const mutable = first.entries.find((e) => e.contentKey === custom.id)!
  Object.assign(mutable.definition, { name: 'Local draft edit' })
  expect(
    (await resolver.resolveCurrentCatalogue!()).entries.find((e) => e.contentKey === custom.id)
      ?.definition,
  ).toMatchObject({ name: 'Owner unique strike' })
  expect(JSON.stringify(data)).toBe(before)
})
it.each([
  null,
  { token, policy },
  { token: 'bad', policy, publications: [] },
  { token, policy: { version: 0, modes: {} }, publications: [] },
  { token, policy: { version: 7, modes: { invented: 'controlled' } }, publications: [] },
  { token, policy, publications: [row('unknown', 'owner.bad', {}, 1)] },
  {
    token,
    policy,
    publications: [
      row('skill', 'owner.mismatch', resolveMatureSkillVersion('vanguard.forceful-strike')!, 7),
    ],
  },
  {
    token,
    policy,
    publications: [
      row(
        'skill',
        'owner.invalid',
        { id: 'owner.invalid', ability: { schemaVersion: 1, behaviors: [] } },
        1,
      ),
    ],
  },
  {
    token,
    policy,
    publications: [
      row('status', 'duplicate.key', {}, 1),
      row('effect-profile', 'duplicate.key', {}, 2),
    ],
  },
])(
  'fails closed on an incomplete or invalid catalogue rather than silently returning builtin defaults: %j',
  async (data) => {
    const { resolver } = fixture(data)
    await expect(resolver.resolveCurrentCatalogue!()).rejects.toThrow()
  },
)
it('fails closed when the new snapshot RPC is unavailable', async () => {
  const { resolver } = fixture(null, { code: 'PGRST202', message: 'function not found' })
  await expect(resolver.resolveCurrentCatalogue!()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
it('rejects non-text stored kinds at the transport boundary without coercing them', async () => {
  const source = new RpcPublishedCombatContentSource(async () => ({
    data: {
      token,
      policy,
      publications: [{ ...row('status', 'owner.status', {}, 1), content_kind: ['status'] }],
    },
    error: null,
  }))
  await expect(source.readCatalogueSnapshot()).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
