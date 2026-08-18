import { AurevaneError } from '@aurevane/game-core/errors'

import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import {
  claimActiveGameSession,
  readVerifiedGameSessionIdentity,
} from '@/server/account/active-game-session'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function POST() {
  try {
    const identity = readVerifiedGameSessionIdentity(await getVerifiedAuthClaims())
    if (!identity) {
      throw new AurevaneError('UNAUTHENTICATED', 'Authentication required.')
    }

    const replaced = await claimActiveGameSession(identity)
    return Response.json(
      { active: true, replacedPreviousSession: replaced },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
