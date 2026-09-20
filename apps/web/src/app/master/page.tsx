import { redirect } from 'next/navigation'

import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability } from '@/server/master/staff-access'

export const dynamic = 'force-dynamic'

export default async function MasterPanelPage() {
  const { access } = await requireMasterPanelPageAccess()

  if (hasMasterPanelCapability(access, 'content.combat.author')) {
    redirect('/master/combat-content')
  }
  if (hasMasterPanelCapability(access, 'staff.manage')) {
    redirect('/master/staff')
  }
  if (hasMasterPanelCapability(access, 'events.author')) {
    redirect('/master/events')
  }
  if (hasMasterPanelCapability(access, 'events.operate')) {
    redirect('/master/events/live')
  }

  redirect('/game')
}
