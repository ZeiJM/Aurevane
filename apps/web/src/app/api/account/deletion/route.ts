import { AurevaneError } from '@aurevane/game-core/errors'

import {
  cancelAccountDeletion,
  getAccountDeletionState,
  requestAccountDeletion,
} from '@/server/account/account-deletion-service'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const pending = await getAccountDeletionState(actor.userId)
    return Response.json({ pending }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    const body = await request.json()
    const password =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).password
        : null

    if (typeof password !== 'string') {
      throw new AurevaneError('INVALID_REQUEST', 'Enter your current account password to continue.')
    }

    const pending = await requestAccountDeletion(actor.userId, password)
    return Response.json({ pending }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function DELETE() {
  try {
    const actor = await getAuthenticatedActor()
    const cancelled = await cancelAccountDeletion(actor.userId)
    return Response.json({ cancelled }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
