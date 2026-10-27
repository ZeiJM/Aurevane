import 'server-only'

import { isAurevaneError } from '@aurevane/game-core/errors'
import { redirect } from 'next/navigation'

import { getAuthenticatedActor } from '@/server/auth/actor'

import {
  MASTER_PANEL_PAGES,
  isMasterPanelPage,
  type MasterPanelPage,
} from '@/lib/master-panel-pages'
import type { MasterPanelCapability } from './staff-access'
import { createServerMasterPanelStaffAccessService } from './staff-access-server'

export async function requireMasterPanelPageAccess(
  pageOrCapability: MasterPanelCapability | MasterPanelPage = 'master.access',
) {
  const capability = isMasterPanelPage(pageOrCapability)
    ? MASTER_PANEL_PAGES.find((page) => page.id === pageOrCapability)!.capabilities[0]
    : pageOrCapability
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
