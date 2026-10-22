import 'server-only'
import { createHash } from 'node:crypto'
import {
  CONTENT_MEDIA_MAX_BYTES,
  isFinalizedContentMedia,
} from '@aurevane/game-core/combat/content-media'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { AurevaneError } from '@aurevane/game-core/errors'
import { toServerErrorResponse } from '../http/error-response'
import { normalizeContentMedia } from './combat-content-media'

interface UploadDependencies {
  authorize(): Promise<unknown>
  finalize(media: Awaited<ReturnType<typeof normalizeContentMedia>>): Promise<unknown>
}
function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}
function unavailable(): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Finalized media is unavailable. Please retry.',
  )
}

export async function handleContentMediaUpload(
  request: Request,
  dependencies: UploadDependencies,
): Promise<Response> {
  try {
    await dependencies.authorize()
    const reader = request.body?.getReader()
    if (!reader) invalid('Choose an image or PCM16 WAV file.')
    let length = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > CONTENT_MEDIA_MAX_BYTES + 65536) {
        await reader.cancel()
        invalid('Upload a file no larger than 2 MiB.')
      }
      chunks.push(chunk.value)
    }
    let form: FormData
    try {
      form = await new Response(Buffer.concat(chunks), {
        headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' },
      }).formData()
    } catch {
      return invalid('The upload must contain a file and optional crop.')
    }
    if (
      [...form.keys()].some((key) => !['file', 'crop'].includes(key)) ||
      form.getAll('file').length !== 1 ||
      form.getAll('crop').length > 1
    )
      invalid('The upload must contain one file and optional crop.')
    const file = form.get('file')
    if (!(file instanceof File)) invalid('Choose an image or PCM16 WAV file.')
    let crop: unknown
    if (form.has('crop')) {
      try {
        crop = JSON.parse(String(form.get('crop')))
      } catch {
        return invalid('Crop must contain valid image coordinates.')
      }
    }
    const normalized = await normalizeContentMedia(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      crop,
    )
    const media = await dependencies.finalize(normalized)
    if (
      !isFinalizedContentMedia(media) ||
      media.checksum !== normalized.descriptor.checksum ||
      media.byteLength !== normalized.bytes.length ||
      media.kind !== normalized.descriptor.kind
    )
      unavailable()
    return Response.json(
      { media: projectPublicCombat(media) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}

export async function serveContentMedia(
  request: Request,
  id: string,
  read: (id: string) => Promise<unknown>,
  preview = false,
): Promise<Response> {
  try {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(id))
      return new Response(null, { status: 404 })
    const value = await read(id)
    if (!value)
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    if (
      typeof value !== 'object' ||
      !('descriptor' in value) ||
      !('bytes' in value) ||
      !isFinalizedContentMedia(value.descriptor) ||
      value.descriptor.id !== id ||
      typeof value.bytes !== 'string'
    )
      unavailable()
    const bytes = Buffer.from(value.bytes, 'base64')
    const descriptor = value.descriptor
    if (
      bytes.length !== descriptor.byteLength ||
      createHash('sha256').update(bytes).digest('hex') !== descriptor.checksum
    )
      unavailable()
    const etag = `"${descriptor.checksum}"`
    const headers = {
      'Content-Type': descriptor.contentType,
      'Cache-Control': preview ? 'private, no-store' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      ETag: etag,
    }
    if (!preview && request.headers.get('If-None-Match') === etag)
      return new Response(null, { status: 304, headers })
    return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } })
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
