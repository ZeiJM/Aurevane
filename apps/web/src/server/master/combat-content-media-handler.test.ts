import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { handleContentMediaUpload, serveContentMedia } from './combat-content-media-handler'
import { createHash } from 'node:crypto'
import { AurevaneError } from '@aurevane/game-core/errors'
const bytes = Buffer.from(
  '524946462600000057415645666d7420100000000100010044ac0000885801000200100064617461020000000000',
  'hex',
)
const id = '00000000-0000-4000-8000-000000000012'
const descriptor = {
  id,
  kind: 'audio' as const,
  contentType: 'audio/wav' as const,
  byteLength: bytes.length,
  checksum: createHash('sha256').update(bytes).digest('hex'),
  channels: 1 as const,
  sampleRate: 44100 as const,
  durationMs: 0.023,
}
function upload() {
  const body = new FormData()
  body.set('file', new File([bytes], 'sound.wav', { type: 'audio/wav' }))
  return new Request('https://local/api/master/combat-content/media', { method: 'POST', body })
}
describe('actual media HTTP transport', () => {
  it('requires authority before reading bytes or issuing finalized references', async () => {
    let finalizations = 0
    const response = await handleContentMediaUpload(upload(), {
      authorize: async () => {
        throw new AurevaneError('FORBIDDEN', 'Denied')
      },
      finalize: async () => {
        finalizations++
        return descriptor
      },
    })
    expect(response.status).toBe(403)
    expect(finalizations).toBe(0)
  })
  it('sends normalized actual bytes into the finalizer and returns its immutable identity', async () => {
    let observed: Buffer | undefined
    const response = await handleContentMediaUpload(upload(), {
      authorize: async () => {},
      finalize: async (normalized) => {
        observed = normalized.bytes
        return descriptor
      },
    })
    expect(response.status).toBe(200)
    expect(observed).toEqual(bytes)
    expect(await response.json()).toEqual({ media: descriptor })
  })
  it('rejects altered server metadata even when immutable bytes and hash match', async () => {
    const response = await handleContentMediaUpload(upload(), {
      authorize: async () => {},
      finalize: async () => ({ ...descriptor, channels: 2 }),
    })
    expect(response.status).toBe(503)
  })
  it('requires a complete finalized descriptor; a URL or ticket is insufficient', async () => {
    const response = await handleContentMediaUpload(upload(), {
      authorize: async () => {},
      finalize: async () => ({ url: '/arbitrary', token: 'ticket' }),
    })
    expect(response.status).toBe(503)
  })
  it('serves immutable exact bytes only after the authoritative reader grants reachability', async () => {
    const request = new Request(`https://local/api/content-media/${id}`)
    expect((await serveContentMedia(request, id, async () => null)).status).toBe(404)
    const response = await serveContentMedia(request, id, async () => ({
      descriptor,
      bytes: bytes.toString('base64'),
    }))
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(response.headers.get('Cache-Control')).toContain('immutable')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('ETag')).toBe(`"${descriptor.checksum}"`)
  })
  it('does not cache staff-only preview bytes publicly and refuses corrupt storage bytes', async () => {
    const request = new Request(`https://local/api/content-media/${id}`)
    const preview = await serveContentMedia(
      request,
      id,
      async () => ({ descriptor, bytes: bytes.toString('base64') }),
      true,
    )
    expect(preview.headers.get('Cache-Control')).toBe('private, no-store')
    expect(
      (await serveContentMedia(request, id, async () => ({ descriptor, bytes: 'YQ==' }))).status,
    ).toBe(503)
  })
})
