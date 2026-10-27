import 'server-only'

import { createSelectedCharacterRpc } from '@/server/master/selected-character-rpc'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createDefaultSiteMusicConfig,
  parseSiteMusicConfig,
  parseSiteMusicDraft,
  type SiteMusicConfig,
  type SiteMusicDraft,
} from '@/lib/site-music'

type SiteMusicRow = {
  enabled: boolean
  default_track: unknown
  route_overrides: unknown
  song_library?: unknown
  revision: number | string
  updated_at: string
}

function parseRow(row: SiteMusicRow): SiteMusicConfig {
  const revision = typeof row.revision === 'string' ? Number(row.revision) : row.revision
  return parseSiteMusicConfig({
    enabled: row.enabled,
    defaultTrack: row.default_track,
    routeOverrides: row.route_overrides,
    songLibrary: row.song_library,
    revision,
    updatedAt: row.updated_at,
  })
}

export async function readSiteMusicConfig(options?: {
  strict?: boolean
}): Promise<SiteMusicConfig> {
  try {
    const client = createSupabaseAdminClient()
    const { data, error } = await client
      .from('site_music_configuration')
      .select('enabled, default_track, route_overrides, song_library, revision, updated_at')
      .eq('singleton_id', true)
      .maybeSingle()

    if (error) throw error
    return data ? parseRow(data as SiteMusicRow) : createDefaultSiteMusicConfig()
  } catch (error) {
    if (options?.strict) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'Site music configuration is unavailable right now.',
        { cause: error },
      )
    }
    return createDefaultSiteMusicConfig()
  }
}

export async function saveSiteMusicConfig(input: {
  actorUserId: string
  expectedRevision: number
  config: SiteMusicDraft
}): Promise<SiteMusicConfig> {
  if (input.config.songLibrary === undefined) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Refresh Site Music before saving; the complete song library is required.',
    )
  }
  const config = parseSiteMusicDraft(input.config)
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new AurevaneError('INVALID_REQUEST', 'expectedRevision must be a positive integer.')
  }

  const client = createSupabaseAdminClient()
  let result
  try {
    result = await createSelectedCharacterRpc((name, params) => client.rpc(name, params))(
      'save_site_music_configuration_v1',
      {
        p_actor_user_id: input.actorUserId,
        p_expected_revision: input.expectedRevision,
        p_config: config,
      },
    )
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Site music configuration is unavailable right now.',
    )
  }
  const { data, error } = result
  if (error?.code === '42501')
    throw new AurevaneError('FORBIDDEN', 'Site Music page access is required.')
  if (error?.code === 'PT409' || error?.code === '40001')
    throw new AurevaneError(
      'STALE_VERSION',
      'The site music configuration changed. Refresh and try again.',
    )
  if (error?.code === '22023')
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Use supported direct audio files and valid music settings.',
    )
  if (error || !data || typeof data !== 'object' || Array.isArray(data))
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Site music changes could not be saved right now.',
    )
  try {
    return parseRow(data as SiteMusicRow)
  } catch {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The saved music configuration is invalid.')
  }
}
