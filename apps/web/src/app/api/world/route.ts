import { AurevaneError } from '@aurevane/game-core/errors'
import { cookies } from 'next/headers'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { SELECTED_CHARACTER_COOKIE } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'
import { attackWorldPlayer } from '@/server/world/world-battle'
import { commitWorldCommand, readWorld } from '@/server/world/world-repository'
import { isWorldUuid, parseWorldCommand } from '@/world/command'
import { worldRefreshResponse } from '@/world/presence'

export const dynamic = 'force-dynamic'
let lastSlowApprovalAt = -Infinity
async function identity() {
  const actor = await getAuthenticatedActor()
  const characterId = (await cookies()).get(SELECTED_CHARACTER_COOKIE)?.value
  if (!isWorldUuid(characterId) || characterId !== characterId.toLowerCase())
    throw new AurevaneError('FORBIDDEN', 'Select a character to enter the world.')
  // The cookie supplies an address only. Every World read/command (including
  // Attack) enters read_world_state_v1, which checks ownership and pending
  // deletion before any world-state initialization, response or mutation.
  return { userId: actor.userId, characterId }
}
const json = (view: unknown) =>
  Response.json(view, { headers: { 'Cache-Control': 'private, no-store' } })
export async function GET(request?: Request) {
  try {
    const actor = await identity()
    const view = (await readWorld(actor.userId, actor.characterId)).view
    return json(worldRefreshResponse(view, request?.url ?? '/api/world'))
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
export async function POST(request: Request) {
  const startedAt = performance.now()
  let identityAt: number | null = null
  let intentKind: string | null = null
  const finish = (response: Response) => {
    if (identityAt === null || intentKind === null) return response
    const endedAt = performance.now()
    const identityMs = Math.max(0, identityAt - startedAt)
    const commandMs = Math.max(0, endedAt - identityAt)
    const totalMs = Math.max(0, endedAt - startedAt)
    response.headers.set(
      'Server-Timing',
      `identity;dur=${identityMs.toFixed(1)}, command;dur=${commandMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
    )
    // Timings only: never log tokens, identities, locations, targets or response bodies.
    // Sample slow approvals/conflicts once per30s per server instance.
    if ((totalMs >= 600 || response.status === 409) && Date.now() - lastSlowApprovalAt >= 30000) {
      lastSlowApprovalAt = Date.now()
      console.warn('World approval timing', {
        intent: intentKind,
        status: response.status,
        identityMs,
        commandMs,
        totalMs,
      })
    }
    return response
  }
  try {
    const actor = await identity()
    identityAt = performance.now()
    if (!request.headers.get('content-type')?.includes('application/json'))
      throw new AurevaneError('INVALID_REQUEST', 'Send a JSON travel command.')
    const body = await request.text()
    if (body.length > 4096)
      throw new AurevaneError('INVALID_REQUEST', 'The travel command is too large.')
    let value: unknown
    try {
      value = JSON.parse(body)
    } catch {
      throw new AurevaneError('INVALID_REQUEST', 'The travel command is invalid.')
    }
    const command = parseWorldCommand(value)
    if (!command) throw new AurevaneError('INVALID_REQUEST', 'The travel command is invalid.')
    intentKind = command.intent.kind
    if (command.characterId !== actor.characterId)
      throw new AurevaneError('STALE_VERSION', 'Your selected character changed. Refresh the map.')
    if (command.intent.kind === 'attack') {
      const receipt = await attackWorldPlayer(
        actor.userId,
        actor.characterId,
        command.intent.targetId,
        command.expectedVersion,
      )
      return finish(
        json(
          request.headers.get('x-world-response') === 'movement'
            ? receipt
            : (await readWorld(actor.userId, actor.characterId)).view,
        ),
      )
    }
    return finish(
      json(
        await commitWorldCommand(
          actor.userId,
          actor.characterId,
          command,
          request.headers.get('x-world-response') === 'movement' &&
            ['walk', 'autopath', 'tick', 'stop'].includes(command.intent.kind),
        ),
      ),
    )
  } catch (error) {
    return finish(toServerErrorResponse(error))
  }
}
