import 'server-only'

import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseArenaNpc,
  parseNpcDesignRecord,
  parsePublishedWorldNpc,
  parsePublishedStoryNpc,
  type PublishedWorldNpc,
  type PublishedStoryNpc,
  type ArenaNpc,
  type NpcDesignCommand,
  type NpcDesignRecord,
} from '@aurevane/validation/combat/npc-design'

import { appearanceManifestFromImageUrl } from '@/appearance/appearance-manifest'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSelectedCharacterRpc } from './selected-character-rpc'

function invalidNpcResponse(): never {
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'NPC Design is unavailable right now.')
}

function staffRpc() {
  const client = createSupabaseAdminClient()
  return createSelectedCharacterRpc(async (name, parameters) => {
    const { data, error } = await client.rpc(name, parameters)
    if (error?.code === '42501')
      throw new AurevaneError('FORBIDDEN', 'NPC Design page access is required.')
    if (error?.message === 'NPC_APPEARANCE_ALREADY_ACTIVE')
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Another published NPC already uses this generated look. Change the appearance first.',
      )
    if (error?.code === '23505')
      throw new AurevaneError(
        'INVALID_REQUEST',
        'A published NPC already occupies that world position.',
      )
    if (error?.code === 'PT409')
      throw new AurevaneError('STALE_VERSION', 'This NPC changed. Refresh before editing again.')
    if (error?.message === 'NPC_WORLD_NOT_READY')
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Choose a world position and write a greeting first.',
      )
    if (error?.message === 'NPC_USE_NOT_READY')
      throw new AurevaneError(
        'INVALID_REQUEST',
        'Name the NPC and enable the use you want to publish.',
      )
    if (error?.code === '22023')
      throw new AurevaneError('INVALID_REQUEST', 'The NPC Design change is invalid.')
    if (error) invalidNpcResponse()
    return data as unknown
  })
}

function validNpcPresentation(value: { portraitRef: string | null; imageUrl?: string | null }) {
  return (
    (!value.portraitRef || isStarterCharacterPortraitRef(value.portraitRef)) &&
    (!value.imageUrl || Boolean(appearanceManifestFromImageUrl(value.imageUrl)))
  )
}

function parseRecord(value: unknown): NpcDesignRecord {
  const record = parseNpcDesignRecord(value)
  if (
    !record ||
    ![record.draft, record.arena, record.world, record.story].every(
      (entry) => !entry || validNpcPresentation(entry),
    )
  )
    invalidNpcResponse()
  return record
}

export async function readNpcDesigns(actorUserId: string): Promise<NpcDesignRecord[]> {
  const data = await staffRpc()('read_master_npc_designs_v1', { p_actor_user_id: actorUserId })
  if (!Array.isArray(data)) invalidNpcResponse()
  return data.map(parseRecord)
}

export async function writeNpcDesign(actorUserId: string, command: NpcDesignCommand) {
  if (command.kind === 'save') {
    if (!validNpcPresentation(command.draft)) {
      throw new AurevaneError('INVALID_REQUEST', 'Choose a valid catalog appearance or portrait.')
    }
    const placement = command.draft.world
    if (placement) {
      const [{ resolveSector }, { isWalkable }] = await Promise.all([
        import('@/server/world/world-content'),
        import('@/world/travel'),
      ])
      const sector = resolveSector(placement.sectorId)
      if (!sector?.charted || !isWalkable(sector, placement)) {
        throw new AurevaneError(
          'INVALID_REQUEST',
          'Choose a walkable tile in a charted world sector.',
        )
      }
    }
  }
  const data = await staffRpc()('write_master_npc_design_v1', {
    p_actor_user_id: actorUserId,
    p_id: command.id,
    p_expected_revision: command.revision,
    p_kind: command.kind,
    p_draft: command.kind === 'save' ? command.draft : null,
  })
  return parseRecord(data)
}

export async function readPublishedArenaNpcs(id: string | null = null): Promise<ArenaNpc[]> {
  const { data, error } = await createSupabaseAdminClient().rpc('read_published_arena_npcs_v1', {
    p_id: id,
  })
  // The Hall keeps ordinary practice available while the additive migration rolls out.
  if (error?.code === 'PGRST202' || error?.code === '42883') return []
  if (error || !Array.isArray(data)) invalidNpcResponse()
  return data.map((value) => {
    const npc = parseArenaNpc(value)
    if (!npc || !validNpcPresentation(npc)) invalidNpcResponse()
    return npc
  })
}

export async function readPublishedWorldNpcs(sectorId: string): Promise<PublishedWorldNpc[]> {
  const { data, error } = await createSupabaseAdminClient().rpc('read_published_world_npcs_v1', {
    p_sector_id: sectorId,
  })
  if (error?.code === 'PGRST202' || error?.code === '42883') return []
  if (error || !Array.isArray(data)) invalidNpcResponse()
  return data.map((value) => {
    const npc = parsePublishedWorldNpc(value)
    if (!npc || !validNpcPresentation(npc) || npc.sectorId !== sectorId) invalidNpcResponse()
    return npc
  })
}

export async function readPublishedStoryNpcs(
  actorUserId: string,
  id: string | null = null,
): Promise<PublishedStoryNpc[]> {
  const data = await staffRpc()('read_master_story_npcs_v1', {
    p_actor_user_id: actorUserId,
    p_id: id,
  })
  if (!Array.isArray(data)) invalidNpcResponse()
  return data.map((value) => {
    const npc = parsePublishedStoryNpc(value)
    if (!npc || !validNpcPresentation(npc)) invalidNpcResponse()
    return npc
  })
}
