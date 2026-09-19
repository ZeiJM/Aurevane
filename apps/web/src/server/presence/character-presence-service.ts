import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'

export interface OnlineCharacter {
  characterId: string
  name: string
  level: number
  lastSeenAt: string
  portraitRef: string | null
  disciplineId: string | null
  secondaryDisciplineId: string | null
  personalTitle: string | null
  imageUrl: string | null
}

export interface CharacterPresenceDirectoryEntry {
  characterId: string
  name: string
  level: number
  lastSeenAt: string | null
  portraitRef: string | null
  disciplineId: string | null
  secondaryDisciplineId: string | null
  personalTitle: string | null
  imageUrl: string | null
  isOnline: boolean
}

function onlineNameBucket(name: string): number {
  if (/^[A-Za-z]/.test(name)) return 0
  if (/^\d/.test(name)) return 1
  return 2
}

function compareOnlineCharacters(left: OnlineCharacter, right: OnlineCharacter): number {
  const bucketDifference = onlineNameBucket(left.name) - onlineNameBucket(right.name)
  if (bucketDifference !== 0) return bucketDifference

  const nameDifference = left.name.localeCompare(right.name, undefined, {
    sensitivity: 'base',
    numeric: true,
  })
  if (nameDifference !== 0) return nameDifference
  return left.characterId.localeCompare(right.characterId)
}

function parseOnlineCharacters(data: unknown[]): OnlineCharacter[] {
  const base: OnlineCharacter[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const candidate = row as Record<string, unknown>
    const level = candidate.character_level
    if (
      typeof candidate.character_id === 'string' &&
      typeof candidate.character_name === 'string' &&
      typeof level === 'number' &&
      Number.isSafeInteger(level) &&
      typeof candidate.last_seen_at === 'string'
    ) {
      base.push({
        characterId: candidate.character_id,
        name: candidate.character_name,
        level,
        lastSeenAt: candidate.last_seen_at,
        portraitRef: null,
        disciplineId: null,
        secondaryDisciplineId: null,
        personalTitle: null,
        imageUrl: null,
      })
    }
  }
  return base
}

export async function touchCharacterPresence(userId: string, characterId: string): Promise<string> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('touch_character_presence_v1', {
    p_user_id: userId,
    p_character_id: characterId,
  })
  if (error || typeof data !== 'string') {
    if (error?.message.includes('CHARACTER_NOT_PLAYABLE')) {
      throw new AurevaneError('FORBIDDEN', 'That character is not available to this account.')
    }
    throw unavailable()
  }
  return data
}

export async function countOnlineCharacters(): Promise<number> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_online_characters_v1')
  if (error || !Array.isArray(data)) throw unavailable()
  return parseOnlineCharacters(data).length
}

interface PublicCharacterIdentity {
  portraitRef: string | null
  disciplineId: string | null
  secondaryDisciplineId: string | null
  personalTitle: string | null
}

async function loadPublicCharacterIdentityMap(
  characterIds: readonly string[],
): Promise<ReadonlyMap<string, PublicCharacterIdentity>> {
  if (characterIds.length === 0) return new Map()

  const supabase = createSupabaseAdminClient()
  const [{ data: identities, error: identityError }, { data: builds, error: buildError }] =
    await Promise.all([
      supabase
        .from('characters')
        .select('id, portrait_ref, personal_title')
        .in('id', [...characterIds]),
      supabase.rpc('get_character_public_active_disciplines_v1', {
        p_character_ids: [...characterIds],
      }),
    ])

  const buildMap = new Map<
    string,
    { disciplineId: string | null; secondaryDisciplineId: string | null }
  >()
  if (!buildError && Array.isArray(builds)) {
    for (const row of builds) {
      if (!row || typeof row !== 'object' || typeof row.character_id !== 'string') continue
      buildMap.set(row.character_id, {
        disciplineId:
          typeof row.primary_discipline_id === 'string' ? row.primary_discipline_id : null,
        secondaryDisciplineId:
          typeof row.secondary_discipline_id === 'string' ? row.secondary_discipline_id : null,
      })
    }
  }

  const identityMap = new Map<string, PublicCharacterIdentity>()
  if (!identityError && Array.isArray(identities)) {
    for (const row of identities) {
      if (!row || typeof row.id !== 'string') continue
      const build = buildMap.get(row.id)
      identityMap.set(row.id, {
        portraitRef: typeof row.portrait_ref === 'string' ? row.portrait_ref : null,
        disciplineId: build?.disciplineId ?? null,
        secondaryDisciplineId: build?.secondaryDisciplineId ?? null,
        personalTitle: typeof row.personal_title === 'string' ? row.personal_title : null,
      })
    }
  }

  return identityMap
}

export async function listOnlineCharacters(): Promise<OnlineCharacter[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_online_characters_v1')
  if (error || !Array.isArray(data)) throw unavailable()

  const base = parseOnlineCharacters(data)
  if (base.length === 0) return base
  const ids = base.map((row) => row.characterId)

  // Public online identity is deliberately shallow: portrait/title plus the current committed
  // Primary/Secondary Discipline pair only. Never expose stats, skills, account identifiers,
  // currencies, inventory, progression, or other private build data.
  const [identityMap, imageMap] = await Promise.all([
    loadPublicCharacterIdentityMap(ids),
    loadPublicCharacterProfileImageMap(ids).catch(() => new Map<string, string>()),
  ])

  return base
    .map((row) => {
      const identity = identityMap.get(row.characterId)
      return {
        ...row,
        portraitRef: identity?.portraitRef ?? null,
        disciplineId: identity?.disciplineId ?? null,
        secondaryDisciplineId: identity?.secondaryDisciplineId ?? null,
        personalTitle: identity?.personalTitle ?? null,
        imageUrl: imageMap.get(row.characterId) ?? null,
      }
    })
    .sort(compareOnlineCharacters)
}

export async function listCharacterPresenceDirectory(): Promise<CharacterPresenceDirectoryEntry[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('list_character_presence_directory_v1')
  if (error || !Array.isArray(data)) throw unavailable()

  const base: CharacterPresenceDirectoryEntry[] = []
  for (const row of data) {
    if (
      row &&
      typeof row === 'object' &&
      typeof row.character_id === 'string' &&
      typeof row.character_name === 'string' &&
      Number.isSafeInteger(row.character_level) &&
      (row.last_seen_at === null || typeof row.last_seen_at === 'string') &&
      typeof row.is_online === 'boolean'
    ) {
      base.push({
        characterId: row.character_id,
        name: row.character_name,
        level: row.character_level,
        lastSeenAt: row.last_seen_at,
        portraitRef: null,
        disciplineId: null,
        secondaryDisciplineId: null,
        personalTitle: null,
        imageUrl: null,
        isOnline: row.is_online,
      })
    }
  }

  if (base.length === 0) return base
  const ids = base.map((row) => row.characterId)

  const [identityMap, imageMap] = await Promise.all([
    loadPublicCharacterIdentityMap(ids),
    loadPublicCharacterProfileImageMap(ids).catch(() => new Map<string, string>()),
  ])

  return base.map((row) => {
    const identity = identityMap.get(row.characterId)
    return {
      ...row,
      portraitRef: identity?.portraitRef ?? null,
      disciplineId: identity?.disciplineId ?? null,
      secondaryDisciplineId: identity?.secondaryDisciplineId ?? null,
      personalTitle: identity?.personalTitle ?? null,
      imageUrl: imageMap.get(row.characterId) ?? null,
    }
  })
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Online presence is unavailable right now.')
}
