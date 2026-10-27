import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
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
async function fixture(id = 'basic.guard') {
  const original = structuredClone(defaultBasicSkills().find((row) => row.id === id)!)
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async (key, version) =>
      (await store.listPublishedVersions(key)).find((row) => row.contentVersion === version) ??
      null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  const first = await service.publishSkill({
    actorUserId: owner,
    definition: { ...original, name: 'First edit' },
    expectedBaseVersion: 1,
  })
  const current = await service.publishSkill({
    actorUserId: owner,
    definition: { ...original, name: 'Current edit' },
    expectedBaseVersion: 2,
  })
  async function request(actor = owner) {
    return handleCombatContentAuthoringRequest(
      new Request('https://aurevane.test/api/master/combat-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'restore-basic-draft',
          skillId: id,
          targetVersion: 2,
          expectedBaseVersion: 3,
          expectedDraftVersion: null,
        }),
      }),
      { getActor: async () => ({ userId: actor }), createService: () => service },
    )
  }
  return { original, store, resolver, service, first, current, request }
}
it.each(defaultBasicSkills().map((row) => row.id))(
  'retires %s restore without altering current or pinned definitions',
  async (id) => {
    const f = await fixture(id)
    const before = await f.store.listPublishedVersions(id)
    expect((await f.request()).status).toBe(400)
    expect(await f.store.findDraft(id)).toBeNull()
    expect(await f.store.findPublished(id)).toEqual(f.current)
    expect(await f.store.listPublishedVersions(id)).toEqual(before)
    expect(await f.resolver.resolvePinnedBasicSkillDefinition!(id, 2)).toEqual(f.first.definition)
    expect(await f.resolver.resolvePinnedBasicSkillDefinition!(id, 3)).toEqual(f.current.definition)
  },
)
it('requires operator authority even for a retired operation', async () => {
  const f = await fixture()
  const history = vi.spyOn(f.store, 'listPublishedVersions')
  const save = vi.spyOn(f.store, 'saveDraft')
  expect((await f.request(outsider)).status).toBe(403)
  expect(history).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
it('ordinary new commits retain exact definitions needed by existing captures', async () => {
  const f = await fixture()
  const pinned = await f.resolver.resolvePinnedBasicSkillDefinition!('basic.guard', 2)
  const bytes = JSON.stringify(pinned)
  const next = await f.service.publishSkill({
    actorUserId: owner,
    definition: { ...f.original, name: 'New authored settings' },
    expectedBaseVersion: 3,
  })
  expect(next.contentVersion).toBe(4)
  expect(await f.resolver.resolvePinnedBasicSkillDefinition!('basic.guard', 2)).toEqual(pinned)
  expect(JSON.stringify(pinned)).toBe(bytes)
  expect(
    (await f.resolver.resolveCurrentBasicSkillDefinitions!(['basic.guard'])).get('basic.guard'),
  ).toEqual(next.definition)
})
