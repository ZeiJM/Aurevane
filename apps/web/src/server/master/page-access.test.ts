import { vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { expect, it } from 'vitest'
import { hasMasterPanelPageAccess } from '@/lib/master-panel-access'
import { capabilitiesForMasterPanelPages, isMasterPanelRoleDefaultsRoles } from './staff-access'
it('grants all tools for a page and never delegates protected Owner management', () => {
  const tools = capabilitiesForMasterPanelPages(['events', 'moderation', 'activity'])
  expect(tools).toEqual(
    expect.arrayContaining([
      'master.access',
      'events.author',
      'events.operate',
      'events.production_publish',
      'events.global_scope',
      'events.emergency_stop',
      'moderation.manage',
      'moderation.permanent_ban',
      'activity.read',
    ]),
  )
  expect(tools).not.toContain('staff.manage')
  expect(
    hasMasterPanelPageAccess(
      {
        userId: 'u',
        accessVersion: 1,
        roles: ['moderator'],
        specialCapabilities: [],
        effectiveCapabilities: tools,
      },
      'activity',
    ),
  ).toBe(true)
})
it('accepts named pages only in role defaults and excludes the Owner page', () => {
  expect(
    isMasterPanelRoleDefaultsRoles({
      moderator: ['moderation', 'activity'],
      'content-staff': ['combat'],
      'event-staff': ['events'],
    }),
  ).toBe(true)
  for (const page of ['staff', 'staff.manage', 'content.production_publish', 'master.access'])
    expect(
      isMasterPanelRoleDefaultsRoles({ moderator: [page], 'content-staff': [], 'event-staff': [] }),
    ).toBe(false)
})
