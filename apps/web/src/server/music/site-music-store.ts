import 'server-only'

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
  revision: number | string
  updated_at: string
}

function parseRow(row: SiteMusicRow): SiteMusicConfig {
  const revision = typeof row.revision === 'string' ? Number(row.revision) : row.revision
  return parseSiteMusicConfig({
    enabled: row.enabled,
    defaultTrack: row.default_track,
    routeOverrides: row.route_overrides,
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
      .select('enabled, default_track, route_overrides, revision, updated_at')
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
  const config = parseSiteMusicDraft(input.config)
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new AurevaneError('INVALID_REQUEST', 'expectedRevision must be a positive integer.')
  }

  const client = createSupabaseAdminClient()
  const nextRevision = input.expectedRevision + 1
  const { data, error } = await client
    .from('site_music_configuration')
    .update({
      enabled: config.enabled,
      default_track: config.defaultTrack,
      route_overrides: config.routeOverrides,
      revision: nextRevision,
      updated_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('singleton_id', true)
    .eq('revision', input.expectedRevision)
    .select('enabled, default_track, route_overrides, revision, updated_at')
    .maybeSingle()

  if (error) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Site music changes could not be saved right now.',
      { cause: error },
    )
  }
  if (!data) {
    throw new AurevaneError(
      'STALE_VERSION',
      'The site music configuration changed. Refresh and try again.',
    )
  }

  return parseRow(data as SiteMusicRow)
}
