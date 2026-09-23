import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  parseSiteMusicDraft,
  parseSiteMusicUploadMetadata,
  type SiteMusicTrack,
} from '@/lib/site-music'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import { saveSiteMusicConfig } from '@/server/music/site-music-store'

const SITE_MUSIC_BUCKET = 'site-music'

interface SiteMusicUploadTicket {
  bucket: typeof SITE_MUSIC_BUCKET
  path: string
  token: string
  track: SiteMusicTrack
}

function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function createUploadTicket(value: unknown): Promise<SiteMusicUploadTicket> {
  let file
  try {
    file = parseSiteMusicUploadMetadata(value)
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Audio upload metadata is invalid.')
  }

  const client = createSupabaseAdminClient()
  const objectPath = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${file.extension}`
  const { data, error } = await client.storage
    .from(SITE_MUSIC_BUCKET)
    .createSignedUploadUrl(objectPath)

  if (error || !data?.token) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The audio upload could not be prepared right now.',
      { cause: error },
    )
  }

  const { data: publicData } = client.storage.from(SITE_MUSIC_BUCKET).getPublicUrl(objectPath)
  return {
    bucket: SITE_MUSIC_BUCKET,
    path: data.path,
    token: data.token,
    track: {
      label: file.label,
      url: publicData.publicUrl,
      source: 'upload',
      loop: true,
    },
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'staff.manage',
    )

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return invalid('Request body must be valid JSON.')
    }
    if (!isRecord(body)) {
      return invalid('Unsupported site music operation.')
    }

    if (body.operation === 'create-upload') {
      const upload = await createUploadTicket(body.file)
      return Response.json({ upload }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    if (body.operation !== 'save') {
      return invalid('Unsupported site music operation.')
    }
    if (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 1) {
      return invalid('expectedRevision must be a positive integer.')
    }

    let parsedConfig
    try {
      parsedConfig = parseSiteMusicDraft(body.config)
    } catch (error) {
      return invalid(error instanceof Error ? error.message : 'Music configuration is invalid.')
    }

    const config = await saveSiteMusicConfig({
      actorUserId: actor.userId,
      expectedRevision: body.expectedRevision as number,
      config: parsedConfig,
    })
    return Response.json({ config }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
