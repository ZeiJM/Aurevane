import { AurevaneError } from '@aurevane/game-core/errors'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'
import { attackWorldPlayer } from '@/server/world/world-battle'
import { commitWorldCommand, readWorld } from '@/server/world/world-repository'
import { parseWorldCommand } from '@/world/command'

export const dynamic = 'force-dynamic'
async function identity() {
  const actor = await getAuthenticatedActor()
  const character = await loadSelectedCharacter(actor)
  if (!character) throw new AurevaneError('FORBIDDEN', 'Select a character to enter the world.')
  return { userId: actor.userId, characterId: character.id }
}
const json = (view: unknown) =>
  Response.json(view, { headers: { 'Cache-Control': 'private, no-store' } })
export async function GET() {
  try {
    const actor = await identity()
    return json((await readWorld(actor.userId, actor.characterId)).view)
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
export async function POST(request: Request) {
  try {
    const actor = await identity()
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
    if (command.characterId !== actor.characterId)
      throw new AurevaneError('STALE_VERSION', 'Your selected character changed. Refresh the map.')
    return json(
      command.intent.kind === 'attack'
        ? await attackWorldPlayer(
            actor.userId,
            actor.characterId,
            command.intent.targetId,
            command.expectedVersion,
          )
        : await commitWorldCommand(actor.userId, actor.characterId, command),
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
