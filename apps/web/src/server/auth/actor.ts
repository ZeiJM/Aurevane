import 'server-only'

import type { AuthenticatedActor } from '@aurevane/game-core/command'
import { AurevaneError } from '@aurevane/game-core/errors'

import { getVerifiedAuthClaims } from '@/lib/supabase/auth'

export async function getAuthenticatedActor(): Promise<AuthenticatedActor> {
  const claims = await getVerifiedAuthClaims()
  const userId = typeof claims?.sub === 'string' ? claims.sub : null

  if (!userId) {
    throw new AurevaneError('UNAUTHENTICATED', 'Authentication required.')
  }

  return { userId }
}
