import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

export const MASTER_PANEL_ROLES = [
  'game-owner',
  'moderator',
  'content-staff',
  'event-staff',
] as const

export type MasterPanelRole = (typeof MASTER_PANEL_ROLES)[number]

export const DELEGATED_MASTER_PANEL_ROLES = ['moderator', 'content-staff', 'event-staff'] as const

export type DelegatedMasterPanelRole = (typeof DELEGATED_MASTER_PANEL_ROLES)[number]

export const MASTER_PANEL_SPECIAL_CAPABILITIES = [
  'moderation.permanent_ban',
  'content.story_copy',
  'content.production_publish',
  'events.production_publish',
  'events.global_scope',
  'events.reward_titles',
  'events.emergency_stop',
  'balance.edit_selected',
  'support.issue_compensation',
] as const

export type MasterPanelSpecialCapability = (typeof MASTER_PANEL_SPECIAL_CAPABILITIES)[number]

export const MASTER_PANEL_CAPABILITIES = [
  'master.access',
  'staff.manage',
  'content.combat.author',
  ...MASTER_PANEL_SPECIAL_CAPABILITIES,
] as const

export type MasterPanelCapability = (typeof MASTER_PANEL_CAPABILITIES)[number]

export const DELEGATED_MASTER_PANEL_ROLE_DETAILS = [
  {
    id: 'moderator',
    label: 'Moderator',
    description: 'Community safety and moderation surfaces only.',
  },
  {
    id: 'content-staff',
    label: 'Content Staff',
    description: 'Approved content/media authoring, including Combat Content.',
  },
  {
    id: 'event-staff',
    label: 'Event Staff',
    description: 'Persistent live-event operations as those modules arrive.',
  },
] as const satisfies readonly {
  id: DelegatedMasterPanelRole
  label: string
  description: string
}[]

export const MASTER_PANEL_SPECIAL_CAPABILITY_DETAILS = [
  {
    id: 'moderation.permanent_ban',
    label: 'Permanent ban',
    description: 'Allows the future permanent-ban moderation command when that tool exists.',
  },
  {
    id: 'content.story_copy',
    label: 'Story copy',
    description: 'Allows approved story/dialogue copy work without creating another role.',
  },
  {
    id: 'content.production_publish',
    label: 'Content production publish',
    description: 'Allows future approved content publication to Production.',
  },
  {
    id: 'events.production_publish',
    label: 'Event production publish',
    description: 'Allows future approved event publication to Production.',
  },
  {
    id: 'events.global_scope',
    label: 'Global event scope',
    description: 'Allows future event operations to target approved global scope.',
  },
  {
    id: 'events.reward_titles',
    label: 'Event title rewards',
    description: 'Allows future events to attach approved title rewards.',
  },
  {
    id: 'events.emergency_stop',
    label: 'Event emergency stop',
    description: 'Allows the future emergency-stop command for live events.',
  },
  {
    id: 'balance.edit_selected',
    label: 'Selected balance editing',
    description: 'Allows future explicitly scoped balance edits selected by the Owner.',
  },
  {
    id: 'support.issue_compensation',
    label: 'Support compensation',
    description: 'Allows future bounded support compensation commands.',
  },
] as const satisfies readonly {
  id: MasterPanelSpecialCapability
  label: string
  description: string
}[]

const ROLE_CAPABILITIES: Readonly<Record<MasterPanelRole, readonly MasterPanelCapability[]>> = {
  'game-owner': MASTER_PANEL_CAPABILITIES,
  moderator: ['master.access'],
  'content-staff': ['master.access', 'content.combat.author'],
  'event-staff': ['master.access'],
}

export interface MasterPanelAccessRecord {
  readonly userId: string
  readonly accessVersion: number
  readonly roles: readonly MasterPanelRole[]
  readonly specialCapabilities: readonly MasterPanelSpecialCapability[]
}

export interface MasterPanelAccess extends MasterPanelAccessRecord {
  readonly effectiveCapabilities: readonly MasterPanelCapability[]
}

export interface MasterPanelStaffSummary extends MasterPanelAccessRecord {
  readonly email: string | null
}

export interface MasterPanelAccountReference {
  readonly userId: string
  readonly email: string
}

export interface MasterPanelStaffAccessStore {
  readAccess(userId: string): Promise<MasterPanelAccessRecord | null>
  listStaff(actorUserId: string): Promise<readonly MasterPanelStaffSummary[]>
  resolveAccountByEmail(
    actorUserId: string,
    email: string,
  ): Promise<MasterPanelAccountReference | null>
  grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string
  }): Promise<number>
  revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string
  }): Promise<number>
  grantCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    note: string
  }): Promise<number>
  revokeCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    note: string
  }): Promise<number>
}

export interface MasterPanelStaffAccessService {
  readAccess(userId: string): Promise<MasterPanelAccess | null>
  requireCapability(userId: string, capability: MasterPanelCapability): Promise<MasterPanelAccess>
  listStaff(actorUserId: string): Promise<readonly MasterPanelStaffSummary[]>
  resolveAccountByEmail(
    actorUserId: string,
    email: string,
  ): Promise<MasterPanelAccountReference | null>
  grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    reason: string
  }): Promise<number>
  revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    reason: string
  }): Promise<number>
  grantCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    reason: string
  }): Promise<number>
  revokeCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    reason: string
  }): Promise<number>
}

export function isMasterPanelRole(value: unknown): value is MasterPanelRole {
  return typeof value === 'string' && (MASTER_PANEL_ROLES as readonly string[]).includes(value)
}

export function isDelegatedMasterPanelRole(value: unknown): value is DelegatedMasterPanelRole {
  return (
    typeof value === 'string' && (DELEGATED_MASTER_PANEL_ROLES as readonly string[]).includes(value)
  )
}

export function isMasterPanelSpecialCapability(
  value: unknown,
): value is MasterPanelSpecialCapability {
  return (
    typeof value === 'string' &&
    (MASTER_PANEL_SPECIAL_CAPABILITIES as readonly string[]).includes(value)
  )
}

export function masterPanelRoleLabel(role: MasterPanelRole): string {
  switch (role) {
    case 'game-owner':
      return 'GAME OWNER'
    case 'moderator':
      return 'MODERATOR'
    case 'content-staff':
      return 'CONTENT STAFF'
    case 'event-staff':
      return 'EVENT STAFF'
  }
}

export function masterPanelAuthorityLabel(roles: readonly MasterPanelRole[]): string {
  if (roles.includes('game-owner')) return 'WORLDWRIGHT · GAME OWNER'
  return roles.map(masterPanelRoleLabel).join(' · ')
}

export function effectiveMasterPanelCapabilities(
  roles: readonly MasterPanelRole[],
  specialCapabilities: readonly MasterPanelSpecialCapability[] = [],
): readonly MasterPanelCapability[] {
  const capabilities = new Set<MasterPanelCapability>()
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role]) capabilities.add(capability)
  }
  for (const capability of specialCapabilities) capabilities.add(capability)
  return [...capabilities]
}

export function hasMasterPanelCapability(
  access: MasterPanelAccess,
  capability: MasterPanelCapability,
): boolean {
  return access.effectiveCapabilities.includes(capability)
}

function requiredReason(reason: string): string {
  if (reason.trim() !== reason || reason.length < 3 || reason.length > 240) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Staff authority changes require a 3–240 character reason with no outer whitespace.',
    )
  }
  return reason
}

function validEmail(email: string): boolean {
  return (
    email.trim() === email &&
    email.length >= 3 &&
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
}

function toAccess(record: MasterPanelAccessRecord): MasterPanelAccess {
  return {
    ...record,
    effectiveCapabilities: effectiveMasterPanelCapabilities(
      record.roles,
      record.specialCapabilities,
    ),
  }
}

export function createMasterPanelStaffAccessService(
  store: MasterPanelStaffAccessStore,
): MasterPanelStaffAccessService {
  async function readAccess(userId: string): Promise<MasterPanelAccess | null> {
    const record = await store.readAccess(userId)
    return record ? toAccess(record) : null
  }

  async function requireCapability(
    userId: string,
    capability: MasterPanelCapability,
  ): Promise<MasterPanelAccess> {
    const access = await readAccess(userId)
    if (!access || !hasMasterPanelCapability(access, capability)) {
      throw new AurevaneError('FORBIDDEN', 'Master Panel access is not available to this account.')
    }
    return access
  }

  function assertDifferentAccount(actorUserId: string, targetUserId: string): void {
    if (actorUserId === targetUserId) {
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Game Owner staff authority changes must target another account.',
      )
    }
  }

  function hasDelegatedRole(access: MasterPanelAccess | null): boolean {
    return access?.roles.some(isDelegatedMasterPanelRole) ?? false
  }

  return {
    readAccess,
    requireCapability,

    async listStaff(actorUserId) {
      await requireCapability(actorUserId, 'staff.manage')
      return store.listStaff(actorUserId)
    },

    async resolveAccountByEmail(actorUserId, email) {
      await requireCapability(actorUserId, 'staff.manage')
      if (!validEmail(email)) {
        throw new AurevaneError('INVALID_REQUEST', 'Enter a valid exact account email address.')
      }
      return store.resolveAccountByEmail(actorUserId, email)
    },

    async grantRole(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      assertDifferentAccount(input.actorUserId, input.targetUserId)
      if (!isDelegatedMasterPanelRole(input.role)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Only Moderator, Content Staff, or Event Staff can be delegated here.',
        )
      }
      return store.grantRole({
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        role: input.role,
        note: requiredReason(input.reason),
      })
    },

    async revokeRole(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      assertDifferentAccount(input.actorUserId, input.targetUserId)
      if (!isDelegatedMasterPanelRole(input.role)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'The Game Owner identity cannot be revoked through delegated staff controls.',
        )
      }

      const targetAccess = await readAccess(input.targetUserId)
      if (
        targetAccess?.roles.includes(input.role) &&
        targetAccess.specialCapabilities.length > 0 &&
        !targetAccess.roles.some((role) => role !== input.role && isDelegatedMasterPanelRole(role))
      ) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Revoke special capabilities before removing this account’s final delegated staff role.',
        )
      }

      return store.revokeRole({
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        role: input.role,
        note: requiredReason(input.reason),
      })
    },

    async grantCapability(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      assertDifferentAccount(input.actorUserId, input.targetUserId)
      if (!isMasterPanelSpecialCapability(input.capability)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Only approved special capabilities can be delegated.',
        )
      }
      if (!hasDelegatedRole(await readAccess(input.targetUserId))) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Grant a delegated staff role before adding special capabilities.',
        )
      }
      return store.grantCapability({
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        capability: input.capability,
        note: requiredReason(input.reason),
      })
    },

    async revokeCapability(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      assertDifferentAccount(input.actorUserId, input.targetUserId)
      if (!isMasterPanelSpecialCapability(input.capability)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Root Master Panel capabilities are never ordinary special grants.',
        )
      }
      return store.revokeCapability({
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        capability: input.capability,
        note: requiredReason(input.reason),
      })
    },
  }
}
