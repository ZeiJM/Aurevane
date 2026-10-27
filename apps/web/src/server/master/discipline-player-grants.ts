import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createSelectedCharacterRpc } from './selected-character-rpc'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'

export interface DisciplineGrantDependencies {
  getActor(): Promise<{ userId: string }>
  requireAccess(userId: string): Promise<unknown>
  rpc(
    name: string,
    args: Readonly<Record<string, unknown>>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>
}
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Review the Discipline, verified recipients and reason.',
  )
}
const stableId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+([._-][a-z0-9]+)*$/u.test(value)
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iu.test(value)
export async function handleDisciplinePlayerGrants(
  request: Request,
  dependencies?: DisciplineGrantDependencies,
): Promise<Response> {
  try {
    const deps = dependencies ?? {
      getActor: getAuthenticatedActor,
      requireAccess: (userId: string) =>
        createServerMasterPanelStaffAccessService().requireCapability(
          userId,
          'content.combat.author',
        ),
      rpc: createSelectedCharacterRpc((name, args) => createSupabaseAdminClient().rpc(name, args)),
    }
    if (request.method !== 'POST') invalid()
    const actor = await deps.getActor()
    await deps.requireAccess(actor.userId)
    let input: unknown
    try {
      input = await request.json()
    } catch {
      invalid()
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
    const body = input as Record<string, unknown>
    let name: string
    const args: Record<string, unknown> = { p_actor_user_id: actor.userId }
    let allowed: string[]
    if (body.operation === 'search') {
      allowed = ['operation', 'query']
      if (typeof body.query !== 'string' || body.query.trim().length < 2 || body.query.length > 80)
        invalid()
      name = 'search_discipline_grant_players_v1'
      args.p_query = body.query.trim()
    } else if (body.operation === 'read') {
      allowed = ['operation', 'disciplineId', 'after']
      if (!stableId(body.disciplineId) || (body.after != null && !uuid(body.after))) invalid()
      name = 'read_discipline_player_grants_v1'
      args.p_discipline_id = body.disciplineId
      args.p_after = body.after ?? null
    } else if (body.operation === 'grant' || body.operation === 'revoke') {
      allowed = ['operation', 'disciplineId', 'accountIds', 'reason']
      if (
        !stableId(body.disciplineId) ||
        !Array.isArray(body.accountIds) ||
        body.accountIds.length < 1 ||
        body.accountIds.length > 50 ||
        !body.accountIds.every(uuid) ||
        typeof body.reason !== 'string' ||
        !body.reason.trim() ||
        body.reason.trim().length > 500
      )
        invalid()
      name = 'write_discipline_player_grants_v1'
      args.p_discipline_id = body.disciplineId
      args.p_account_ids = [...new Set(body.accountIds)]
      args.p_action = body.operation
      args.p_reason = body.reason.trim()
    } else invalid()
    if (Object.keys(body).some((key) => !allowed.includes(key))) invalid()
    const result = await deps.rpc(name, args)
    if (result.error) {
      if (result.error.message.includes('MASTER_FORBIDDEN'))
        throw new AurevaneError('FORBIDDEN', 'Game Content access is required.')
      if (result.error.message.includes('DISCIPLINE_GRANT_'))
        throw new AurevaneError(
          'INVALID_REQUEST',
          'The selected Discipline or recipient is unavailable. Refresh and try again.',
        )
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'Player grants are temporarily unavailable.',
      )
    }
    return Response.json(
      { result: result.data },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
