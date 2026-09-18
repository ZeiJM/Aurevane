import 'server-only'

import { isAurevaneError } from '@aurevane/game-core/errors'
import { redirect } from 'next/navigation'

import { getAuthenticatedActor } from '@/server/auth/actor'

import type { MasterPanelCapability } from './staff-access'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'

export async function requireMasterPanelPageAccess(
  capability: MasterPanelCapability = 'master.access',
) {
  try {
    const actor = await getAuthenticatedActor()
    const access = await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      capability,
    )
    return { actor, access } as const
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    if (isAurevaneError(error) && error.code === 'FORBIDDEN') {
      redirect(capability === 'master.access' ? '/game' : '/master')
    }
    throw error
  }
}
