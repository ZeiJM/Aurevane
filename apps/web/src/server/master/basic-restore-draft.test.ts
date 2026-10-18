import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  parseBasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  executePv1fAction,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'

vi.mock('server-only', () => ({}))
const owner = '11111111-1111-4111-8111-111111111111'
const outsider = '22222222-2222-4222-8222-222222222222'
class Store extends InMemoryCombatContentRepository {
  async getOperatorRole(userId: string) {
    return userId === owner ? ('owner' as const) : null
  }
}
async function fixture(id = 'basic.guard', withDraft = true) {
  const original = structuredClone(defaultBasicSkills().find((row) => row.id === id)!)
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async (key, version) =>
      (await store.listPublishedVersions(key)).find((row) => row.contentVersion === version) ??
      null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  function edited(name: string, ap: number) {
    const next = structuredClone(original)
    Object.assign(next, {
      name,
      description: `${name} description`,
      battleText: '{actor} uses {ability}.',
    })
    Object.assign(next.ability.behaviors[0]!, { costs: [{ resource: 'ap', amount: ap }] })
    return next
  }
  const first = await service.publishSkill({
    actorUserId: owner,
    definition: edited('First edit', 17),
    expectedBaseVersion: 1,
  })
  const current = await service.publishSkill({
    actorUserId: owner,
    definition: edited('Current edit', 29),
    expectedBaseVersion: 2,
  })
  const draft = withDraft
    ? await service.saveSkillDraft({
        actorUserId: owner,
        definition: edited('Unpublished draft', 11),
        baseVersion: 3,
        expectedDraftVersion: null,
      })
    : null
  async function request(body: Record<string, unknown>, actor = owner) {
    return handleCombatContentAuthoringRequest(
      new Request('https://aurevane.test/api/master/combat-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { getActor: async () => ({ userId: actor }), createService: () => service },
    )
  }
  function restore(overrides: Record<string, unknown> = {}, actor = owner) {
    return request(
      {
        operation: 'restore-basic-draft',
        skillId: id,
        targetVersion: 1,
        expectedBaseVersion: 3,
        expectedDraftVersion: draft?.draftVersion ?? null,
        ...overrides,
      },
      actor,
    )
  }
  async function before() {
    return JSON.stringify({
      draft: await store.findDraft(id),
      current: await store.findPublished(id),
      history: await store.listPublishedVersions(id),
    })
  }
  return {
    original,
    store,
    resolver,
    service,
    first,
    current,
    draft,
    request,
    restore,
    before,
    edited,
  }
}

it.each(
  defaultBasicSkills().flatMap((definition) =>
    [1, 2].map((version) => ({ id: definition.id, version })),
  ),
)(
  'restores complete $id v$version to a draft and publishes a new version without changing old captures',
  async ({ id, version }) => {
    const f = await fixture(id)
    const beforeCurrent = await f.store.findPublished(id)
    const beforeHistory = await f.store.listPublishedVersions(id)
    const support = SUPPORT_ACTION_IDS.find((key) => key === id) ?? 'basic.guard'
    const capture = (definition: ReturnType<typeof parseBasicSkillDefinition>) =>
      captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: support,
        definitions: defaultBasicSkills().map((row) => (row.id === id ? definition : row)),
      })
    const old = capture(parseBasicSkillDefinition(f.current.definition))
    const oldBytes = JSON.stringify(old)
    const response = await f.restore({
      targetVersion: version,
      definition: { id, name: 'Forged replacement' },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    const expected = version === 1 ? f.original : f.first.definition
    expect(body.draft).toMatchObject({
      contentKey: id,
      contentKind: 'skill',
      baseVersion: 3,
      draftVersion: 2,
      updatedBy: owner,
      definition: expected,
    })
    expect(await f.store.findPublished(id)).toEqual(beforeCurrent)
    expect(await f.store.listPublishedVersions(id)).toEqual(beforeHistory)
    const restored = parseBasicSkillDefinition(body.draft.definition)
    expect(f.service.validateSkillDefinition(restored).issues).toEqual([])
    expect(
      f.service.diffSkillDefinitions(f.current.definition, restored).changedPaths.length,
    ).toBeGreaterThan(0)
    const preview = await f.service.previewSkillDefinition({
      actorUserId: owner,
      definition: restored,
      behaviorId: restored.ability.behaviors[0]!.id,
    })
    expect(preview.legal).toBe(true)
    expect(preview.costs?.actionEconomy).toBe(
      restored.ability.behaviors[0]!.costs.find((row) => row.resource === 'ap')!.amount,
    )
    const published = await f.service.publishSkill({
      actorUserId: owner,
      definition: restored,
      expectedBaseVersion: 3,
    })
    expect(published.contentVersion).toBe(4)
    expect(published.definition).toEqual({ ...expected, contentVersion: 4 })
    expect(await f.resolver.resolvePinnedBasicSkillDefinition!(id, 2)).toEqual(f.first.definition)
    expect(await f.resolver.resolvePinnedBasicSkillDefinition!(id, 3)).toEqual(f.current.definition)
    const current = (await f.resolver.resolveCurrentBasicSkillDefinitions!([id])).get(id)!
    expect(current).toEqual(published.definition)
    const next = capture(current)
    expect(next.find((source) => source.abilityId === id)!.contentVersion).toBe(4)
    expect(next.map((source) => source.abilityId)).toEqual(['basic.move', 'unarmed.basic', support])
    expect(JSON.stringify(old)).toBe(oldBytes)
    expect(old.find((source) => source.abilityId === id)!.contentVersion).toBe(3)
    // Editing a returned draft cannot mutate immutable history or the later publication.
    Object.assign(body.draft.definition, { name: 'Changed returned object' })
    expect(await f.store.findPublished(id)).toEqual(published)
    expect((await f.store.listPublishedVersions(id)).slice(0, 2)).toEqual(beforeHistory)
  },
)

it.each([{ expectedBaseVersion: 2 }, { expectedDraftVersion: null }, { expectedDraftVersion: 99 }])(
  'rejects stale restore authority %j without overwriting any saved state',
  async (change) => {
    const f = await fixture()
    const before = await f.before()
    const response = await f.restore(change)
    expect(response.status).toBe(409)
    expect((await response.json()).error.code).toBe('STALE_VERSION')
    expect(await f.before()).toBe(before)
  },
)

it('requires operator authorization before historical reads or draft writes', async () => {
  const f = await fixture()
  const before = await f.before()
  const history = vi.spyOn(f.store, 'listPublishedVersions')
  const save = vi.spyOn(f.store, 'saveDraft')
  expect((await f.restore({}, outsider)).status).toBe(403)
  expect(history).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
  expect(await f.before()).toBe(before)
})

it.each([
  { skillId: 'vanguard.forceful-strike' },
  { contentKind: 'essence' },
  { targetVersion: 0 },
  { targetVersion: 999 },
  { expectedBaseVersion: null },
  { expectedDraftVersion: -1 },
  { expectedDraftVersion: undefined },
])(
  'rejects invalid or unavailable restore request %j without changing saved state',
  async (change) => {
    const f = await fixture()
    const before = await f.before()
    const response = await f.restore(change)
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_REQUEST')
    expect(await f.before()).toBe(before)
  },
)

it.each(['wrong-kind', 'wrong-identity', 'malformed', 'duplicate'] as const)(
  'fails closed on %s historical rows instead of substituting the builtin',
  async (kind) => {
    const f = await fixture()
    const before = await f.before()
    const rows = await f.store.listPublishedVersions(f.original.id)
    const first = structuredClone(rows[0]!)
    if (kind === 'wrong-kind') Object.assign(first, { contentKind: 'essence' })
    if (kind === 'wrong-identity') Object.assign(first.definition, { id: 'basic.recover' })
    if (kind === 'malformed') Object.assign(first.definition, { ability: { behaviors: [] } })
    const spy = vi
      .spyOn(f.store, 'listPublishedVersions')
      .mockResolvedValue(kind === 'duplicate' ? [first, first, rows[1]!] : [first, rows[1]!])
    const response = await f.restore({ targetVersion: 2 })
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('PERSISTENCE_UNAVAILABLE')
    spy.mockRestore()
    expect(await f.before()).toBe(before)
  },
)

it('restores a complete disabled historical record as editable draft without enabling or publishing it', async () => {
  const f = await fixture()
  const rows = await f.store.listPublishedVersions(f.original.id)
  const disabled = { ...rows[0]!, definition: { ...rows[0]!.definition, enabled: false } }
  vi.spyOn(f.store, 'listPublishedVersions').mockResolvedValue([disabled, rows[1]!])
  const response = await f.restore({ targetVersion: 2 })
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.draft.definition).toEqual(disabled.definition)
  expect(f.service.validateSkillDefinition(body.draft.definition).valid).toBe(true)
  expect(await f.store.findPublished(f.original.id)).toEqual(f.current)
})

it('creates the first draft from history when no draft exists', async () => {
  const f = await fixture('basic.guard', false)
  const response = await f.restore({ targetVersion: 2 })
  expect(response.status).toBe(200)
  expect((await response.json()).draft).toMatchObject({
    definition: f.first.definition,
    baseVersion: 3,
    draftVersion: 1,
  })
  expect(await f.store.findPublished(f.original.id)).toEqual(f.current)
})

it('enforces operator authority when the restore service is called directly', async () => {
  const f = await fixture()
  const before = await f.before()
  await expect(
    f.service.restoreBasicSkillDraft({
      actorUserId: outsider,
      skillId: f.original.id,
      targetVersion: 1,
      expectedBaseVersion: 3,
      expectedDraftVersion: 1,
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(await f.before()).toBe(before)
})

it('does not overwrite a draft written after the history read but before save', async () => {
  const f = await fixture()
  const save = f.store.saveDraft.bind(f.store)
  vi.spyOn(f.store, 'saveDraft').mockImplementationOnce(async (input) => {
    await save({
      ...input,
      definition: { ...f.original, name: 'Concurrent draft' },
      expectedDraftVersion: 1,
    })
    return save(input)
  })
  const response = await f.restore()
  expect(response.status).toBe(409)
  expect((await f.store.findDraft(f.original.id))!.definition.name).toBe('Concurrent draft')
  expect(await f.store.findPublished(f.original.id)).toEqual(f.current)
})

it('keeps a publication racing the restore safe through the later ordinary publish CAS', async () => {
  const f = await fixture()
  const save = f.store.saveDraft.bind(f.store)
  vi.spyOn(f.store, 'saveDraft').mockImplementationOnce(async (input) => {
    await f.service.publishSkill({
      actorUserId: owner,
      definition: f.edited('Concurrent publication', 23),
      expectedBaseVersion: 3,
    })
    return save(input)
  })
  const response = await f.restore({ targetVersion: 2 })
  expect(response.status).toBe(200)
  const restored = (await response.json()).draft
  expect(restored.baseVersion).toBe(3)
  const current = await f.store.findPublished(f.original.id)
  expect(current).toMatchObject({
    contentVersion: 4,
    definition: { name: 'Concurrent publication' },
  })
  await expect(
    f.service.publishSkill({
      actorUserId: owner,
      definition: restored.definition,
      expectedBaseVersion: restored.baseVersion,
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(await f.store.findPublished(f.original.id)).toEqual(current)
})

it('executes the restored published Guard price in a new capture while an old capture keeps its price', async () => {
  const f = await fixture()
  const state = (definition: ReturnType<typeof parseBasicSkillDefinition>) => {
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    return reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(
        base,
        captureBasicSkillSources({
          ownerCombatantId: 'actor',
          supportActionId: 'basic.guard',
          definitions: defaultBasicSkills().map((row) =>
            row.id === definition.id ? definition : row,
          ),
        }),
      ),
      base.statBridge,
    )
  }
  const old = state(parseBasicSkillDefinition(f.current.definition))
  const before = JSON.stringify(old)
  const response = await f.restore({ targetVersion: 2 })
  expect(response.status).toBe(200)
  const published = await f.service.publishSkill({
    actorUserId: owner,
    definition: (await response.json()).draft.definition,
    expectedBaseVersion: 3,
  })
  const fresh = state(parseBasicSkillDefinition(published.definition))
  const ap = (value: typeof old) =>
    value.tactical.battle.combatants
      .find((row) => row.id === 'actor')!
      .temporaryResources!.find((row) => row.key === 'pv1f.action-economy')!.current
  const oldResult = executePv1fAction(old, 'basic.guard', { kind: 'self' })
  const freshResult = executePv1fAction(fresh, 'basic.guard', { kind: 'self' })
  expect(ap(oldResult.state)).toBe(71)
  expect(ap(freshResult.state)).toBe(83)
  expect(
    freshResult.state.statusState.find((row) => row.combatantId === 'actor')!.statuses,
  ).toContainEqual(expect.objectContaining({ statusId: 'guarded' }))
  expect(JSON.stringify(old)).toBe(before)
})
