import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'

import { getVerifiedAuthClaims } from '@/lib/supabase/auth'
import {
  ensureActiveGameSession,
  readVerifiedGameSessionIdentity,
} from '@/server/account/active-game-session'

export async function getAuthenticatedActor(): Promise<AuthenticatedActor> {
  const claims = await getVerifiedAuthClaims()
  const identity = readVerifiedGameSessionIdentity(claims)

  if (!identity) {
    throw new AurevaneError('UNAUTHENTICATED', 'Authentication required.')
  }

  const current = await ensureActiveGameSession(identity)
  if (!current) {
    throw new AurevaneError(
      'UNAUTHENTICATED',
      'This account continued on another device or login. Sign in here again to take control.',
    )
  }

  return { userId: identity.userId }
}
