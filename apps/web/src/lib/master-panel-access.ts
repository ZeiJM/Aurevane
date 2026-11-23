import type { MasterPanelAccess, MasterPanelCapability } from '@/server/master/staff-access'

// Presentation checks only the supplied snapshot. Protected operations re-read live access.
export function hasMasterPanelCapability(
  access: MasterPanelAccess,
  capability: MasterPanelCapability,
): boolean {
  return (
    access.effectiveCapabilities.includes(capability) &&
    (capability !== 'staff.manage' || access.roles.includes('game-owner'))
  )
}

import { MASTER_PANEL_PAGES, type MasterPanelPage } from './master-panel-pages'
export { MASTER_PANEL_PAGES, type MasterPanelPage } from './master-panel-pages'
export function hasMasterPanelPageAccess(
  access: MasterPanelAccess,
  page: MasterPanelPage,
): boolean {
  const definition = MASTER_PANEL_PAGES.find((item) => item.id === page)
  return Boolean(definition && hasMasterPanelCapability(access, definition.capabilities[0]))
}
