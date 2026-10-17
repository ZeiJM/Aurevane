import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { atlasSectors } from '@/world/atlas'

import {
  resolveChatChannel,
  type ChatChannelRequest,
  type ResolvedChatChannel,
} from './chat-channel'
import { mapChatRpcError } from './chat-errors'

/** Everything the browser receives is plain JSON shaped by the database RPCs. */
export type ChatJson = Record<string, unknown>

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createSupabaseAdminClient().rpc(name, args)
  if (error) mapChatRpcError(error)
  return data as T
}

let townBySector: ReadonlyMap<string, string> | null = null

/** A sector belongs to a village when the atlas marks it with a town (the town and its district). */
export function townIdForSector(sectorId: string | null): string | null {
  if (!sectorId) return null
  if (!townBySector) {
    townBySector = new Map(
      atlasSectors().flatMap((sector) =>
        sector.townId ? [[sector.id, sector.townId] as const] : [],
      ),
    )
  }
  return townBySector.get(sectorId) ?? null
}

export async function currentVillageKey(
  userId: string,
  characterId: string,
): Promise<string | null> {
  const sectorId = await rpc<string | null>('chat_world_sector_v1', {
    p_user_id: userId,
    p_character_id: characterId,
  })
  const townId = townIdForSector(sectorId)
  return townId ? `village:${townId}` : null
}

/** Turns a browser channel request into the canonical key the database authorizes. */
export async function resolveChannel(
  userId: string,
  characterId: string,
  request: ChatChannelRequest,
): Promise<ResolvedChatChannel> {
  const village = request.kind === 'village' ? await currentVillageKey(userId, characterId) : null
  return resolveChatChannel(characterId, request, village)
}

export async function listMessages(
  userId: string,
  characterId: string,
  channelKey: string,
  afterId: number,
) {
  return rpc<ChatJson[]>('chat_list_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_channel_key: channelKey,
    p_after_id: afterId,
    p_limit: 60,
  })
}

export async function sendMessage(
  userId: string,
  characterId: string,
  channelKey: string,
  body: string,
  replyToId: number | null,
) {
  return rpc<ChatJson>('chat_send_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_channel_key: channelKey,
    p_body: body,
    p_reply_to_id: replyToId,
  })
}

export async function markRead(
  userId: string,
  characterId: string,
  channelKey: string,
  lastId: number,
) {
  await rpc('chat_mark_read_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_channel_key: channelKey,
    p_last_id: lastId,
  })
}

export const mentionCandidates = (
  userId: string,
  characterId: string,
  channelKey: string,
  prefix: string,
) =>
  rpc<ChatJson[]>('chat_mention_candidates_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_channel_key: channelKey,
    p_prefix: prefix,
  })

export const getSettings = (userId: string, characterId: string) =>
  rpc<ChatJson>('chat_get_settings_v1', { p_user_id: userId, p_character_id: characterId })

export const setSettings = (userId: string, characterId: string, patch: ChatJson) =>
  rpc<ChatJson>('chat_set_settings_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_patch: patch,
  })

export const getInbox = (userId: string, characterId: string) =>
  rpc<ChatJson>('chat_inbox_v1', { p_user_id: userId, p_character_id: characterId })

export const getFriends = (userId: string, characterId: string) =>
  rpc<ChatJson>('chat_friends_v1', { p_user_id: userId, p_character_id: characterId })

export const requestFriend = (userId: string, characterId: string, name: string) =>
  rpc<ChatJson>('chat_friend_request_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_target_name: name,
  })

export const respondFriend = (
  userId: string,
  characterId: string,
  otherId: string,
  accept: boolean,
) =>
  rpc<ChatJson>('chat_friend_respond_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_other_id: otherId,
    p_accept: accept,
  })

export const removeFriend = (userId: string, characterId: string, otherId: string) =>
  rpc<ChatJson>('chat_friend_remove_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_other_id: otherId,
  })

export const setBlocked = (userId: string, characterId: string, otherId: string, block: boolean) =>
  rpc<ChatJson>('chat_block_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_other_id: otherId,
    p_block: block,
  })

export const createGroup = (
  userId: string,
  characterId: string,
  name: string,
  inviteIds: string[],
) =>
  rpc<ChatJson>('chat_group_create_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_name: name,
    p_invite_ids: inviteIds,
  })

export const inviteToGroup = (
  userId: string,
  characterId: string,
  groupId: string,
  targetId: string,
) =>
  rpc('chat_group_invite_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_group_id: groupId,
    p_target_id: targetId,
  })

export const respondToGroup = (
  userId: string,
  characterId: string,
  groupId: string,
  accept: boolean,
) =>
  rpc('chat_group_respond_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_group_id: groupId,
    p_accept: accept,
  })

export const leaveGroup = (
  userId: string,
  characterId: string,
  groupId: string,
  targetId: string | null,
) =>
  rpc('chat_group_leave_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_group_id: groupId,
    p_target_id: targetId,
  })

export const renameGroup = (userId: string, characterId: string, groupId: string, name: string) =>
  rpc('chat_group_rename_v1', {
    p_user_id: userId,
    p_character_id: characterId,
    p_group_id: groupId,
    p_name: name,
  })

export function requireString(value: unknown, message: string, max = 500): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new AurevaneError('INVALID_REQUEST', message)
  }
  return value
}
