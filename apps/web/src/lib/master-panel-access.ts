import type { MasterPanelAccess, MasterPanelCapability } from '@/server/master/staff-access'

// Presentation checks only the supplied snapshot. Protected operations re-read live access.
export function hasMasterPanelCapability(
  access: MasterPanelAccess,
  capability: MasterPanelCapability,
): boolean {
  return access.effectiveCapabilities.includes(capability)
}
