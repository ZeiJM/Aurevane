import 'server-only'

import { isAurevaneError } from '@aurevane/game-core/errors'
import { redirect } from 'next/navigation'

import { getAuthenticatedActor } from '@/server/auth/actor'

import { createServerCombatContentAuthoringService } from './combat-content-authoring-server'

export async function requireMasterPanelPageAccess() {
  try {
    const actor = await getAuthenticatedActor()
    const role = await createServerCombatContentAuthoringService(actor.userId).requireOperator(
      actor.userId,
    )
    return { actor, role } as const
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    if (isAurevaneError(error) && error.code === 'FORBIDDEN') redirect('/game')
    throw error
  }
}
