import { expect, it, vi } from 'vitest'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
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
      row(
        'status',
        'owner.status',
        { ...PHASE4_STATUSES[0], id: 'owner.status', contentVersion: 1 },
        1,
      ),
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
    definition: { ...PHASE4_STATUSES[0], id: 'owner.status', contentVersion: 1 },
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
it('retains a disabled legacy Skill without enabling it or resurrecting its builtin', async () => {
  const definition = {
    ...structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike')!),
    enabled: false,
  }
  const { resolver } = fixture({
    token,
    policy,
    publications: [row('skill', definition.id, definition, definition.contentVersion)],
  })
  expect(
    (await resolver.resolveCurrentCatalogue!()).entries.find(
      (entry) => entry.contentKey === definition.id,
    ),
  ).toMatchObject({ source: 'published', definition })
  expect(definition.enabled).toBe(false)
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

it('captures one immutable catalogue generation for policy and every current admission lookup', async () => {
  const skill = structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike')!)
  const basic = structuredClone(defaultBasicSkills()[0]!)
  const essence = structuredClone(resolveEssenceForBuild('vanguard', null)!)
  const resonance = structuredClone(resolveResonanceForPair('vanguard', 'lifebinder')!)
  const definitions = [
    row('skill', skill.id, skill, skill.contentVersion),
    row('skill', basic.id, basic, basic.contentVersion),
    row('essence', essence.essenceId, essence, essence.contentVersion),
    row('resonance', resonance.id, resonance, resonance.contentVersion),
  ]
  const data = {
    token,
    policy: { version: 8, tagAuthority: 'global', modes: { healing: 'controlled' } },
    publications: definitions,
  }
  const resolver = createCombatContentResolver(
    new RpcPublishedCombatContentSource(async (name, args) => {
      if (name === 'read_current_discipline_selection_v1')
        return {
          data: {
            selectionVersion: 1,
            catalogueToken: token,
            essence:
              args.p_secondary_discipline_id === null
                ? {
                    essenceId: essence.essenceId,
                    contentVersion: essence.contentVersion,
                    sourceDisciplineId: 'vanguard',
                    skillId: essence.skill.id,
                    skillContentVersion: essence.skill.contentVersion,
                  }
                : null,
            resonance:
              args.p_secondary_discipline_id === null
                ? null
                : {
                    resonanceId: resonance.id,
                    contentVersion: resonance.contentVersion,
                    disciplinePair: resonance.disciplinePair,
                  },
          },
          error: null,
        }
      return { data: structuredClone(data), error: null }
    }),
  )
  expect(resolver.captureCurrentCatalogue).toBeTypeOf('function')
  const captured = await resolver.captureCurrentCatalogue!()
  data.policy.version = 9
  data.publications = []
  expect(captured.policy).toMatchObject({ version: 8, tagAuthority: 'global' })
  expect(await captured.resolver.resolveCurrentSkillDefinition(skill.id)).toEqual(skill)
  expect(
    (await captured.resolver.resolveCurrentBasicSkillDefinitions!([basic.id])).get(basic.id),
  ).toEqual(basic)
  expect(await captured.resolver.resolveCurrentEssenceDefinition!('vanguard', null)).toEqual(
    essence,
  )
  expect(
    await captured.resolver.resolveCurrentResonanceDefinition!('vanguard', 'lifebinder'),
  ).toEqual(resonance)
  expect(
    await captured.resolver.resolvePinnedSkillDefinition(skill.id, skill.contentVersion),
  ).toEqual(skill)
  expect((await captured.resolver.resolveCurrentCatalogue!()).policy.version).toBe(8)
})

const futureItem = {
  schemaVersion: 1,
  id: 'future.item',
  contentVersion: 1,
  name: 'Field kit',
  description: 'Authored field kit intent.',
  sortOrder: 0,
  enabled: true,
  media: {},
  requirements: null,
  ability: null,
  itemClass: 'consumable',
  usage: 'active',
  equipmentSlot: null,
  acquisition: 'unimplemented',
}
it('recognized noncombat snapshots validate strictly before deliberate combat-only projection', async () => {
  const source = new RpcPublishedCombatContentSource(async () => ({
    data: {
      token,
      policy,
      publications: [row('item', 'future.item', futureItem, 1)],
      archivedKeys: [],
    },
    error: null,
  }))
  expect((await source.readCatalogueSnapshot()).publications).toHaveLength(1)
  const catalogue = await createCombatContentResolver(source).resolveCurrentCatalogue!()
  expect(catalogue.entries.some((e) => e.contentKey === 'future.item')).toBe(false)
  for (const definition of [
    { ...futureItem, itemClass: 'arbitrary' },
    { ...futureItem, quantity: 100 },
    { ...futureItem, requirements: { kind: 'execute', script: 'grant()' } },
    { ...futureItem, name: '   ' },
  ]) {
    await expect(
      fixture({ token, policy, publications: [row('item', 'future.item', definition, 1)] }).resolver
        .resolveCurrentCatalogue!(),
    ).rejects.toThrow()
  }
})
it('archived builtin identities cannot resurrect in current catalogue or captured current reads but exact pins remain available', async () => {
  const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
  const source = new RpcPublishedCombatContentSource(async (name) => ({
    data:
      name === 'read_combat_content_catalogue_v1'
        ? { token, policy, publications: [], archivedKeys: [skill.id] }
        : [row('skill', skill.id, skill, skill.contentVersion)],
    error: null,
  }))
  const resolver = createCombatContentResolver(source)
  expect(
    (await resolver.resolveCurrentCatalogue!()).entries.some((e) => e.contentKey === skill.id),
  ).toBe(false)
  const captured = await resolver.captureCurrentCatalogue!()
  await expect(captured.resolver.resolveCurrentSkillDefinition(skill.id)).rejects.toThrow(
    /archived/i,
  )
  expect(
    await captured.resolver.resolvePinnedSkillDefinition(skill.id, skill.contentVersion),
  ).toMatchObject({ id: skill.id })
})
it.each(['discipline', 'tag', 'ascension', 'severence'])(
  'strict %s snapshot cannot become a combat entry',
  async (kind) => {
    const common = {
      schemaVersion: 1,
      id: `future.${kind}`,
      contentVersion: 1,
      name: 'Draft intent',
      description: 'A meaningful supported intent.',
      sortOrder: 0,
      enabled: true,
      media: {},
    }
    const definition =
      kind === 'discipline'
        ? {
            ...common,
            core: { might: 8, finesse: 4, vitality: 7, agility: 4, intellect: 4, resolve: 4 },
            focus: ['might', 'vitality'],
            enabledForPrimary: true,
            enabledForSecondary: true,
            linkedSkills: [],
            unlock: { kind: 'unavailable' },
          }
        : kind === 'tag'
          ? { ...common, tagId: 'damage', explanation: 'Damage uses configured power.' }
          : {
              ...common,
              formName: 'Unbound form',
              requirements: null,
              ability: null,
              transformation: { kind, description: 'Authored transformation intent.' },
            }
    expect(
      (
        await fixture({ token, policy, publications: [row(kind, common.id, definition, 1)] })
          .resolver.resolveCurrentCatalogue!()
      ).entries.some((e) => e.contentKey === common.id),
    ).toBe(false)
    await expect(
      fixture({
        token,
        policy,
        publications: [row(kind, common.id, { ...definition, runtime: 'enable' }, 1)],
      }).resolver.resolveCurrentCatalogue!(),
    ).rejects.toThrow()
  },
)
