// Actual production store and migration functions behind the mounted browser.
// Only the selected local identity and PostgREST transport are fixture boundaries.
import { createCombatContentTestDatabase } from '../../../../packages/db/src/test-support/combat-content-test-database'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  RpcCombatContentAuthoringStore,
  type CombatAuthoringRpc,
} from '@/server/master/supabase-combat-content-authoring-store'
import {
  RpcPublishedCombatContentSource,
  createCombatContentResolver,
} from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import { createCombatContentRecordCommand } from '@/server/master/combat-content-record-command'
import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'
import { createSelectedCharacterRpc } from '@/server/master/selected-character-rpc'
const actorUserId = '00000000-0000-4000-8000-000000000001'
export async function createBasicEditorServiceFixture() {
  const database = await createCombatContentTestDatabase()
  await database.exec(
    `insert into auth.users(id,email,email_confirmed_at) values('${actorUserId}','original-browser@example.test',now()); insert into app_private.master_panel_role_assignments(user_id,role) values('${actorUserId}','game-owner');`,
  )
  const rpc: CombatAuthoringRpc = async (name, parameters) => {
    const keys = Object.keys(parameters)
    if (![name, ...keys].every((value) => /^[a-z_][a-z0-9_]*$/u.test(value)))
      throw new Error('Invalid fixture RPC identifier')
    const call = `public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')})`
    try {
      const tabular = ['read_master_panel_operator_v1', 'read_combat_content_version_v1'].includes(
        name,
      )
      const rows = (
        await database.query<Record<string, unknown>>(
          tabular ? `select * from ${call}` : `select ${call} value`,
          Object.values(parameters),
        )
      ).rows
      return { data: JSON.parse(JSON.stringify(tabular ? rows : rows[0]?.value)), error: null }
    } catch (error) {
      return {
        data: null,
        error: { code: (error as { code?: string }).code, message: (error as Error).message },
      }
    }
  }
  const store = new RpcCombatContentAuthoringStore(
    createSelectedCharacterRpc(rpc, {
      getActor: async () => ({ userId: actorUserId }),
      loadSelection: async () => null,
    }),
    actorUserId,
  )
  const resolver = createCombatContentResolver(new RpcPublishedCombatContentSource(rpc))
  const service = createCombatContentAuthoringService({ store, resolver })
  service.recordCommand = createCombatContentRecordCommand(store, service, actorUserId)
  const requests: unknown[] = []
  return {
    options: await Promise.all(defaultBasicSkills().map((basic) => store.readRecord(basic.id))),
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
        originals: defaultBasicSkills(),
        records: await Promise.all(defaultBasicSkills().map((basic) => store.readRecord(basic.id))),
      }
    },
    async close() {
      await database.close()
    },
  }
}
