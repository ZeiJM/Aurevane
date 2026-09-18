import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

export const MASTER_PANEL_ROLES = [
  'game-owner',
  'moderator',
  'content-staff',
  'event-staff',
] as const

export type MasterPanelRole = (typeof MASTER_PANEL_ROLES)[number]

export const DELEGATED_MASTER_PANEL_ROLES = [
  'moderator',
  'content-staff',
  'event-staff',
] as const

export type DelegatedMasterPanelRole = (typeof DELEGATED_MASTER_PANEL_ROLES)[number]

export const MASTER_PANEL_CAPABILITIES = [
  'master.access',
  'staff.manage',
  'content.combat.author',
] as const

export type MasterPanelCapability = (typeof MASTER_PANEL_CAPABILITIES)[number]

const ROLE_CAPABILITIES: Readonly<Record<MasterPanelRole, readonly MasterPanelCapability[]>> = {
  'game-owner': ['master.access', 'staff.manage', 'content.combat.author'],
  moderator: ['master.access'],
  'content-staff': ['master.access', 'content.combat.author'],
  'event-staff': ['master.access'],
}

export interface MasterPanelAccessRecord {
  readonly userId: string
  readonly accessVersion: number
  readonly roles: readonly MasterPanelRole[]
}

export interface MasterPanelAccess extends MasterPanelAccessRecord {
  readonly effectiveCapabilities: readonly MasterPanelCapability[]
}

export interface MasterPanelStaffAccessStore {
  readAccess(userId: string): Promise<MasterPanelAccessRecord | null>
  grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string | null
  }): Promise<number>
  revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string | null
  }): Promise<number>
}

export interface MasterPanelStaffAccessService {
  readAccess(userId: string): Promise<MasterPanelAccess | null>
  requireCapability(userId: string, capability: MasterPanelCapability): Promise<MasterPanelAccess>
  grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note?: string | null
  }): Promise<number>
  revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note?: string | null
  }): Promise<number>
}

export function isMasterPanelRole(value: unknown): value is MasterPanelRole {
  return typeof value === 'string' && (MASTER_PANEL_ROLES as readonly string[]).includes(value)
}

export function isDelegatedMasterPanelRole(value: unknown): value is DelegatedMasterPanelRole {
  return (
    typeof value === 'string' &&
    (DELEGATED_MASTER_PANEL_ROLES as readonly string[]).includes(value)
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

export function effectiveMasterPanelCapabilities(
  roles: readonly MasterPanelRole[],
): readonly MasterPanelCapability[] {
  const capabilities = new Set<MasterPanelCapability>()
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role]) capabilities.add(capability)
  }
  return [...capabilities]
}

export function hasMasterPanelCapability(
  access: MasterPanelAccess,
  capability: MasterPanelCapability,
): boolean {
  return access.effectiveCapabilities.includes(capability)
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note === null || note === undefined) return null
  if (note.trim() !== note || note.length < 1 || note.length > 240) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Staff access notes must be 1–240 characters with no outer whitespace.',
    )
  }
  return note
}

function toAccess(record: MasterPanelAccessRecord): MasterPanelAccess {
  return {
    ...record,
    effectiveCapabilities: effectiveMasterPanelCapabilities(record.roles),
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

  return {
    readAccess,
    requireCapability,

    async grantRole(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      if (input.actorUserId === input.targetUserId) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Game Owner staff grants must target another account.',
        )
      }
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
        note: normalizeNote(input.note),
      })
    },

    async revokeRole(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      if (!isDelegatedMasterPanelRole(input.role)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'The Game Owner identity cannot be revoked through delegated staff controls.',
        )
      }
      return store.revokeRole({
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        role: input.role,
        note: normalizeNote(input.note),
      })
    },
  }
}
