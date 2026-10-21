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
  'events.author',
  'events.operate',
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
  'event-staff': ['master.access', 'events.author', 'events.operate'],
}

export interface MasterPanelAccessRecord {
  readonly userId: string
  readonly characterId: string
  readonly accessVersion: number
  readonly roles: readonly MasterPanelRole[]
  readonly specialCapabilities: readonly MasterPanelSpecialCapability[]
}

export interface MasterPanelAccess extends MasterPanelAccessRecord {
  readonly effectiveCapabilities: readonly MasterPanelCapability[]
}

export interface MasterPanelStaffSummary extends Omit<MasterPanelAccessRecord, 'characterId'> {
  readonly characterId: string | null
  readonly characterName: string | null
  readonly email: string | null
  readonly status: 'owner' | 'active' | 'expired' | 'revoked' | 'needs-binding'
  readonly expiresAt: string | null
}

export interface MasterPanelAccountReference {
  readonly userId: string
  readonly email: string
  readonly characters: readonly {
    readonly id: string
    readonly name: string
    readonly playable: boolean
  }[]
}

export interface CharacterAccessAssignment {
  readonly actorUserId: string
  readonly targetCharacterId: string
  readonly roles: readonly DelegatedMasterPanelRole[]
  readonly specialCapabilities: readonly MasterPanelSpecialCapability[]
  readonly days: number | null
  readonly bindLegacy: boolean
  readonly expectedAccessVersion: number | null
}

export interface CharacterAccessRevocation {
  readonly actorUserId: string
  readonly targetCharacterId: string
  readonly expectedAccessVersion: number | null
}

export interface MasterPanelStaffAccessStore {
  readAccess(userId: string): Promise<MasterPanelAccessRecord | null>
  listStaff(actorUserId: string): Promise<readonly MasterPanelStaffSummary[]>
  resolveAccounts(
    actorUserId: string,
    query: string,
  ): Promise<readonly MasterPanelAccountReference[]>
  setCharacterAccess(input: CharacterAccessAssignment): Promise<number>
  revokeCharacterAccess(input: CharacterAccessRevocation): Promise<number>
  revokeLegacyAccess(input: {
    actorUserId: string
    targetUserId: string
    expectedAccessVersion: number | null
  }): Promise<number>
}

export interface MasterPanelStaffAccessService extends Omit<
  MasterPanelStaffAccessStore,
  'readAccess'
> {
  readAccess(userId: string): Promise<MasterPanelAccess | null>
  requireCapability(userId: string, capability: MasterPanelCapability): Promise<MasterPanelAccess>
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

export function createMasterPanelStaffAccessService(
  store: MasterPanelStaffAccessStore,
): MasterPanelStaffAccessService {
  async function readAccess(userId: string): Promise<MasterPanelAccess | null> {
    const record = await store.readAccess(userId)
    return record
      ? {
          ...record,
          effectiveCapabilities: effectiveMasterPanelCapabilities(
            record.roles,
            record.specialCapabilities,
          ),
        }
      : null
  }

  async function requireCapability(
    userId: string,
    capability: MasterPanelCapability,
  ): Promise<MasterPanelAccess> {
    const access = await readAccess(userId)
    if (!access || !hasMasterPanelCapability(access, capability)) {
      throw new AurevaneError(
        'FORBIDDEN',
        'Master Panel access is not available to this character.',
      )
    }
    return access
  }

  function invalid(message: string): never {
    throw new AurevaneError('INVALID_REQUEST', message)
  }

  return {
    readAccess,
    requireCapability,
    async listStaff(actorUserId) {
      await requireCapability(actorUserId, 'staff.manage')
      return store.listStaff(actorUserId)
    },
    async resolveAccounts(actorUserId, query) {
      await requireCapability(actorUserId, 'staff.manage')
      if (query.trim() !== query || query.length < 1 || query.length > 320) {
        invalid('Enter an exact character name or verified account email.')
      }
      return store.resolveAccounts(actorUserId, query)
    },
    async setCharacterAccess(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      if (!input.roles.length || !input.roles.every(isDelegatedMasterPanelRole)) {
        invalid('Choose one or more approved delegated roles.')
      }
      if (!input.specialCapabilities.every(isMasterPanelSpecialCapability)) {
        invalid('Choose approved special permissions.')
      }
      if (
        input.days !== null &&
        (!Number.isSafeInteger(input.days) || input.days <= 0 || input.days > 2147483647)
      ) {
        invalid('Expiry must be No Expiry or a positive whole number of days.')
      }
      return store.setCharacterAccess(input)
    },
    async revokeLegacyAccess(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      return store.revokeLegacyAccess(input)
    },
    async revokeCharacterAccess(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      return store.revokeCharacterAccess(input)
    },
  }
}
