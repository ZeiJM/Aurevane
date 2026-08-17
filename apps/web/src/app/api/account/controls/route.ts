import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import {
  loadPlayerCombatControls,
  savePlayerCombatControls,
} from '@/server/player-profile/player-controls-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new AurevaneError('INVALID_REQUEST', 'The request body must be valid JSON.')
  }
}

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const combatKeybinds = await loadPlayerCombatControls(
      actor,
      createSupabasePlayerProfileRepository(),
    )
    return Response.json(
      { controls: { combatKeybinds } },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = await readJson(request)
    const candidate =
      body && typeof body === 'object' && !Array.isArray(body) && 'combatKeybinds' in body
        ? (body as { combatKeybinds: unknown }).combatKeybinds
        : null
    const combatKeybinds = await savePlayerCombatControls(actor, candidate)
    return Response.json(
      { controls: { combatKeybinds } },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
