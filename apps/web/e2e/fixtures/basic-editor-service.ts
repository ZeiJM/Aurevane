// Disposable acceptance transport: real authoring service and repository with a
// complete-record adapter. Physical SQL locking/ACL is covered by the DB gates.
import {
  InMemoryCombatContentRepository,
  type CompleteCombatContentRecord,
  type CompleteCombatContentVersion,
  type CombatContentVersionRecord,
  type CompleteCombatContentWrite,
} from '@aurevane/db/combat-content'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  parseBasicSkillDefinition,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'
import { createCombatContentRecordCommand } from '@/server/master/combat-content-record-command'
import type { RpcCombatContentAuthoringStore } from '@/server/master/supabase-combat-content-authoring-store'
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
  // Record genuine publications in this disposable repository. Builtin v1 has
  // no invented history row; unchanged v2 is the physical restore source.
  for (const basic of basics) {
    await service.publishSkill({ actorUserId, definition: basic, expectedBaseVersion: 1 })
    const definition = structuredClone(basic)
    Object.assign(definition, { name: `Current ${basic.name}` })
    Object.assign(definition.ability.behaviors[0]!, { costs: [{ resource: 'ap', amount: 29 }] })
    await service.publishSkill({ actorUserId, definition, expectedBaseVersion: 2 })
  }
  const revisions = new Map(basics.map((row) => [row.id as string, 3]))
  const consumed = new Map<string, number>()
  const restored = new Map<string, number>()
  const attribution = new Map<
    string,
    Pick<CompleteCombatContentVersion, 'authoredBy' | 'authoredAt' | 'restoredFrom' | 'restoredBy'>
  >()
  function version(row: CombatContentVersionRecord): CompleteCombatContentVersion {
    return {
      ...row,
      authoredBy: row.publishedBy,
      authoredAt: row.publishedAt,
      restoredFrom: null,
      restoredBy: null,
      ...attribution.get(`${row.contentKey}:${row.contentVersion}`),
    }
  }
  async function readRecord(key: string): Promise<CompleteCombatContentRecord> {
    const builtin = basics.find((row) => row.id === key)
    if (!builtin) throw new AurevaneError('INVALID_REQUEST', 'Unknown Basic fixture record.')
    const current = (await store.findPublished(key))!,
      rawDraft = await store.findDraft(key)
    const draft = rawDraft && consumed.get(key) !== rawDraft.draftVersion ? rawDraft : null
    return {
      contentKey: key,
      contentKind: 'skill',
      lifecycle: 'active',
      revision: revisions.get(key)!,
      versionFloor: current.contentVersion,
      createdBy: actorUserId,
      createdAt: current.publishedAt,
      builtin: { contentVersion: 1, name: builtin.name },
      builtinDefinition: structuredClone(builtin) as unknown as Record<string, unknown>,
      current: version(current),
      history: (await store.listPublishedVersions(key)).map(version),
      draft: draft
        ? {
            ...draft,
            restoredFrom: restored.get(key) ?? null,
            restoredBy: restored.has(key) ? actorUserId : null,
          }
        : null,
      links: [],
      usedBy: [],
    }
  }
  const adapter = {
    readRecord,
    async listRecords() {
      return {
        records: await Promise.all(
          basics.map(async (basic) => {
            const record = await readRecord(basic.id)
            return {
              contentKey: basic.id,
              contentKind: 'skill',
              lifecycle: 'active',
              revision: record.revision,
              name: String(record.draft?.definition.name ?? record.current!.definition.name),
            }
          }),
        ),
        nextCursor: null,
      }
    },
    async writeRecord(key: string, command: CompleteCombatContentWrite) {
      const record = await readRecord(key)
      if (!('expectedRevision' in command) || command.expectedRevision !== record.revision)
        throw new AurevaneError('STALE_VERSION', 'Record changed. Refresh and retry.')
      const rawDraft = await store.findDraft(key)
      if (command.action === 'save') {
        await service.saveSkillDraft({
          actorUserId,
          definition: command.definition,
          baseVersion: record.current!.contentVersion,
          expectedDraftVersion: rawDraft?.draftVersion ?? null,
        })
        restored.delete(key)
      } else if (command.action === 'restore') {
        // Match production's physical-only restore boundary before invoking the real service.
        if (!record.history.some((row) => row.contentVersion === command.sourceVersion))
          throw new AurevaneError('INVALID_REQUEST', 'That recorded publication is unavailable.')
        await service.restoreBasicSkillDraft({
          actorUserId,
          skillId: key,
          targetVersion: command.sourceVersion,
          expectedBaseVersion: record.current!.contentVersion,
          expectedDraftVersion: rawDraft?.draftVersion ?? null,
        })
        restored.set(key, command.sourceVersion)
      } else throw new AurevaneError('INVALID_REQUEST', 'Unsupported fixture mutation.')
      revisions.set(key, record.revision + 1)
      return readRecord(key)
    },
    async publishSaved(
      record: CompleteCombatContentRecord,
      draftVersion: number,
      baseVersion: number | null,
    ) {
      const fresh = await readRecord(record.contentKey),
        draft = fresh.draft
      if (
        !draft ||
        draft.draftVersion !== draftVersion ||
        draft.baseVersion !== baseVersion ||
        fresh.current!.contentVersion !== baseVersion
      )
        throw new AurevaneError('STALE_VERSION', 'Saved revision changed. Refresh and retry.')
      const published = await service.publishSkill({
        actorUserId,
        definition: draft.definition,
        expectedBaseVersion: baseVersion,
      })
      const source = draft.restoredFrom
        ? fresh.history.find((row) => row.contentVersion === draft.restoredFrom)
        : null
      attribution.set(`${record.contentKey}:${published.contentVersion}`, {
        authoredBy: source?.authoredBy ?? draft.updatedBy,
        authoredAt: source?.authoredAt ?? draft.updatedAt,
        restoredFrom: draft.restoredFrom,
        restoredBy: draft.restoredBy,
      })
      // Legacy in-memory repository retains draft bytes; this adapter exposes the
      // accepted consumed-draft envelope without pretending to exercise SQL.
      consumed.set(record.contentKey, draft.draftVersion)
      revisions.set(record.contentKey, fresh.revision + 1)
      return readRecord(record.contentKey)
    },
  }
  service.recordCommand = createCombatContentRecordCommand(
    adapter as unknown as RpcCombatContentAuthoringStore,
    service,
    actorUserId,
  )
  const initial = await resolver.resolveCurrentBasicSkillDefinitions!(basics.map((row) => row.id))
  const oldCaptures = captureBasicSkillSources({
    ownerCombatantId: 'local-actor',
    supportActionId: 'basic.guard',
    definitions: [...initial.values()],
  })
  const oldCaptureBytes = JSON.stringify(oldCaptures),
    requests: unknown[] = []
  return {
    options: await Promise.all(basics.map((basic) => readRecord(basic.id))),
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
          basics.map(async (basic) => ({ id: basic.id, ...(await readRecord(basic.id)) })),
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
