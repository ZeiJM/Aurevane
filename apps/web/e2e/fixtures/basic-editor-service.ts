// Local acceptance transport. No account, hosted database or production route is created.
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  parseBasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'

const actorUserId = '11111111-1111-4111-8111-111111111111'
class Store extends InMemoryCombatContentRepository {
  async getOperatorRole(id: string) {
    return id === actorUserId ? ('owner' as const) : null
  }
}
export async function createBasicEditorServiceFixture() {
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async (key, version) =>
      (await store.listPublishedVersions(key)).find((row) => row.contentVersion === version) ??
      null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  const basics = defaultBasicSkills()
  for (const basic of basics) {
    const definition = structuredClone(basic)
    Object.assign(definition, { name: `Current ${basic.name}` })
    Object.assign(definition.ability.behaviors[0]!, { costs: [{ resource: 'ap', amount: 29 }] })
    await service.publishSkill({ actorUserId, definition, expectedBaseVersion: 1 })
  }
  const initial = await resolver.resolveCurrentBasicSkillDefinitions!(basics.map((row) => row.id))
  const oldCaptures = captureBasicSkillSources({
    ownerCombatantId: 'local-actor',
    supportActionId: 'basic.guard',
    definitions: [...initial.values()],
  })
  const oldCaptureBytes = JSON.stringify(oldCaptures)
  const requests: unknown[] = []
  return {
    options: basics.map((basic) => ({
      id: basic.id,
      label: basic.name,
      definition: initial.get(basic.id),
      currentVersion: 2,
      baseVersion: 2,
      draftVersion: null,
      history: [
        {
          contentVersion: 2,
          source: 'published',
          current: true,
          publishedAt: '2026-10-18T02:00:00Z',
        },
        { contentVersion: 1, source: 'static-baseline', current: false, publishedAt: null },
      ],
    })),
    async request(request: Request) {
      requests.push(await request.clone().json())
      return handleCombatContentAuthoringRequest(request, {
        getActor: async () => ({ userId: actorUserId }),
        createService: () => service,
      })
    },
    async inspect() {
      return {
        requests,
        records: await Promise.all(
          basics.map(async (basic) => ({
            id: basic.id,
            current: await store.findPublished(basic.id),
            draft: await store.findDraft(basic.id),
            history: await store.listPublishedVersions(basic.id),
          })),
        ),
        oldCapturesUnchanged: JSON.stringify(oldCaptures) === oldCaptureBytes,
        oldVersions: oldCaptures.map((row) => row.contentVersion),
        currentDefinitions: await Promise.all(
          basics.map(async (basic) =>
            parseBasicSkillDefinition((await store.findPublished(basic.id))!.definition),
          ),
        ),
      }
    },
  }
}
