import 'server-only'

import {
  capabilitiesForMasterPanelPages,
  isMasterPanelPage,
  type MasterPanelPage,
} from '@/lib/master-panel-pages'
export { capabilitiesForMasterPanelPages } from '@/lib/master-panel-pages'

import { hasMasterPanelCapability } from '@/lib/master-panel-access'
export { hasMasterPanelCapability } from '@/lib/master-panel-access'

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
  'players.manage',
  'moderation.manage',
  'combat.rules',
  'music.manage',
  'world.manage',
  'activity.read',
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
    description: 'Account moderation and any additional pages assigned by the Game Owner.',
  },
  {
    id: 'content-staff',
    label: 'Content Staff',
    description: 'Versioned Game Content authoring and publication.',
  },
  {
    id: 'event-staff',
    label: 'Event Staff',
    description: 'Event definitions, scheduling and live operations with all page tools.',
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

export const DEFAULT_MASTER_PANEL_ROLE_CAPABILITIES: Readonly<
  Record<MasterPanelRole, readonly MasterPanelCapability[]>
> = {
  'game-owner': MASTER_PANEL_CAPABILITIES,
  moderator: capabilitiesForMasterPanelPages(['moderation']),
  'content-staff': capabilitiesForMasterPanelPages(['combat']),
  'event-staff': capabilitiesForMasterPanelPages(['events']),
}

export interface MasterPanelAccessRecord {
  readonly userId: string
  readonly accessVersion: number
  readonly effectiveCapabilities?: readonly MasterPanelCapability[]
  readonly roles: readonly MasterPanelRole[]
  readonly specialCapabilities: readonly MasterPanelSpecialCapability[]
}

export interface MasterPanelAccess extends MasterPanelAccessRecord {
  readonly effectiveCapabilities: readonly MasterPanelCapability[]
}

export interface MasterPanelStaffSummary extends MasterPanelAccessRecord {
  readonly email: string | null
  readonly characterId: string | null
  readonly characterName: string | null
  readonly status: 'active' | 'expired' | 'revoked' | 'unavailable' | 'needs-binding' | 'owner'
  readonly expiresAt: string | null
}
export interface MasterPanelAccountReference {
  readonly userId: string
  readonly email: string
  readonly characters: readonly { characterId: string; name: string; playable: boolean }[]
}
export interface SetCharacterStaffAccessInput {
  readonly actorUserId: string
  readonly targetUserId: string
  readonly targetCharacterId: string
  readonly roles: readonly DelegatedMasterPanelRole[]
  readonly specialCapabilities: readonly MasterPanelSpecialCapability[]
  readonly days: number | null
  readonly expectedVersion: number
  readonly enabled: boolean
}
export interface MasterPanelStaffAccessStore {
  readAccess(userId: string): Promise<MasterPanelAccessRecord | null>
  listStaff(actorUserId: string): Promise<readonly MasterPanelStaffSummary[]>
  resolveIdentity(actorUserId: string, query: string): Promise<MasterPanelAccountReference | null>
  setCharacterAccess(input: SetCharacterStaffAccessInput): Promise<number>
}
export interface MasterPanelStaffAccessService extends MasterPanelStaffAccessStore {
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
): readonly MasterPanelCapability[] {
  const capabilities = new Set<MasterPanelCapability>()
  for (const role of roles) {
    for (const capability of DEFAULT_MASTER_PANEL_ROLE_CAPABILITIES[role])
      capabilities.add(capability)
  }
  return [...capabilities]
}

function toAccess(record: MasterPanelAccessRecord): MasterPanelAccess {
  return {
    ...record,
    effectiveCapabilities:
      record.effectiveCapabilities ?? effectiveMasterPanelCapabilities(record.roles),
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
      throw new AurevaneError(
        'FORBIDDEN',
        'Master Panel access is not available to this character.',
      )
    }
    return access
  }
  return {
    readAccess,
    requireCapability,
    async listStaff(actorUserId) {
      await requireCapability(actorUserId, 'staff.manage')
      return store.listStaff(actorUserId)
    },
    async resolveIdentity(actorUserId, query) {
      await requireCapability(actorUserId, 'staff.manage')
      if (query.trim() !== query || query.length < 1 || query.length > 320) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Enter an exact character name or verified email.',
        )
      }
      return store.resolveIdentity(actorUserId, query)
    },
    async setCharacterAccess(input) {
      await requireCapability(input.actorUserId, 'staff.manage')
      if (input.actorUserId === input.targetUserId) {
        throw new AurevaneError(
          'FORBIDDEN',
          'The protected Game Owner identity cannot be edited here.',
        )
      }
      if (
        !input.targetCharacterId ||
        !Number.isSafeInteger(input.expectedVersion) ||
        input.expectedVersion < 0 ||
        typeof input.enabled !== 'boolean' ||
        input.roles.length === 0 ||
        !input.roles.every(isDelegatedMasterPanelRole) ||
        new Set(input.roles).size !== input.roles.length ||
        !input.specialCapabilities.every(isMasterPanelSpecialCapability) ||
        new Set(input.specialCapabilities).size !== input.specialCapabilities.length ||
        (input.days !== null &&
          (!Number.isSafeInteger(input.days) || input.days <= 0 || input.days > 36500))
      ) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Choose a linked character, permitted role and No Expiry or 1–36500 days.',
        )
      }
      return store.setCharacterAccess(input)
    },
  }
}

export interface MasterPanelRoleDefaults {
  readonly revision: number
  readonly roles: Readonly<Record<DelegatedMasterPanelRole, readonly MasterPanelPage[]>>
}
export interface SaveMasterPanelRoleDefaultsInput {
  readonly actorUserId: string
  readonly expectedRevision: number
  readonly roles: unknown
}
export interface MasterPanelRoleDefaultsStore {
  readRoleDefaults(actorUserId: string): Promise<MasterPanelRoleDefaults>
  saveRoleDefaults(input: SaveMasterPanelRoleDefaultsInput): Promise<MasterPanelRoleDefaults>
}
export function isMasterPanelRoleDefaultsRoles(
  value: unknown,
): value is MasterPanelRoleDefaults['roles'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const roles = value as Record<string, unknown>
  return (
    Object.keys(roles).length === DELEGATED_MASTER_PANEL_ROLES.length &&
    DELEGATED_MASTER_PANEL_ROLES.every((role) => {
      const capabilities = roles[role]
      return (
        Array.isArray(capabilities) &&
        capabilities.every(isMasterPanelPage) &&
        new Set(capabilities).size === capabilities.length
      )
    })
  )
}
export function createMasterPanelRoleDefaultsService(
  accessService: MasterPanelStaffAccessService,
  store: MasterPanelRoleDefaultsStore,
): MasterPanelRoleDefaultsStore {
  async function requireOwner(userId: string) {
    const access = await accessService.readAccess(userId)
    if (!access?.roles.includes('game-owner'))
      throw new AurevaneError('FORBIDDEN', 'Only the Game Owner can change role defaults.')
  }
  return {
    async readRoleDefaults(actorUserId) {
      await requireOwner(actorUserId)
      return store.readRoleDefaults(actorUserId)
    },
    async saveRoleDefaults(input) {
      await requireOwner(input.actorUserId)
      if (
        !Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 1 ||
        !isMasterPanelRoleDefaultsRoles(input.roles)
      ) {
        throw new AurevaneError('INVALID_REQUEST', 'Choose permitted pages for each staff role.')
      }
      return store.saveRoleDefaults(input)
    },
  }
}
