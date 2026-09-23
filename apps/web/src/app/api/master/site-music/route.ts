import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { parseSiteMusicDraft, type SiteMusicTrack } from '@/lib/site-music'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { toServerErrorResponse } from '@/server/http/error-response'
import { createServerMasterPanelStaffAccessService } from '@/server/master/staff-access-server'
import { saveSiteMusicConfig } from '@/server/music/site-music-store'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}

function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fileLabel(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return (withoutExtension || 'Uploaded track').slice(0, 80)
}

async function uploadTrack(form: FormData): Promise<SiteMusicTrack> {
  const file = form.get('file')
  if (!(file instanceof File)) return invalid('Choose an audio file to upload.')
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return invalid('Audio uploads must be between 1 byte and 20 MB.')
  }

  const extension = MIME_EXTENSIONS[file.type]
  if (!extension) {
    return invalid('Use an MP3, M4A/AAC, OGG, WebM, or WAV audio file.')
  }

  const client = createSupabaseAdminClient()
  const objectPath = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('site-music').upload(objectPath, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The audio file could not be uploaded.', {
      cause: error,
    })
  }

  const { data } = client.storage.from('site-music').getPublicUrl(objectPath)
  return {
    label: fileLabel(file.name),
    url: data.publicUrl,
    source: 'upload',
    loop: true,
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedActor()
    await createServerMasterPanelStaffAccessService().requireCapability(
      actor.userId,
      'staff.manage',
    )

    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await request.formData()
      if (form.get('operation') !== 'upload') return invalid('Unsupported upload operation.')
      return Response.json(
        { track: await uploadTrack(form) },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return invalid('Request body must be valid JSON.')
    }
    if (!isRecord(body) || body.operation !== 'save') {
      return invalid('Unsupported site music operation.')
    }
    if (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 1) {
      return invalid('expectedRevision must be a positive integer.')
    }

    const config = await saveSiteMusicConfig({
      actorUserId: actor.userId,
      expectedRevision: body.expectedRevision as number,
      config: parseSiteMusicDraft(body.config),
    })
    return Response.json({ config }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
