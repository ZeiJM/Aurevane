import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { normalizeContentMedia } from './combat-content-media'

vi.mock('server-only', () => ({}))

function wav(seconds = 1): Buffer {
  const frames = 44100 * seconds
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(44100, 24)
  bytes.writeUInt32LE(88200, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  return bytes
}
describe('server content media byte authority', () => {
  it('decodes real image bytes and finalizes the real requested crop with a recomputed checksum', async () => {
    const input = await sharp({
      create: { width: 8, height: 4, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer()
    const media = await normalizeContentMedia(input, 'image/png', { x: 2, y: 0, size: 4 })
    expect(media.descriptor).toMatchObject({
      kind: 'image',
      contentType: 'image/png',
      width: 4,
      height: 4,
      crop: { x: 2, y: 0, size: 4 },
    })
    const output = await sharp(media.bytes).metadata()
    expect([output.width, output.height]).toEqual([4, 4])
    expect(media.descriptor.checksum).toBe(createHash('sha256').update(media.bytes).digest('hex'))
    expect(media.descriptor.byteLength).toBe(media.bytes.length)
  })
  it('rejects mismatched MIME, malformed image bytes, out-of-image and fractional crops', async () => {
    const input = await sharp({ create: { width: 8, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer()
    await expect(normalizeContentMedia(input, 'image/jpeg')).rejects.toThrow(/type/i)
    await expect(normalizeContentMedia(Buffer.from('<svg/>'), 'image/png')).rejects.toThrow()
    for (const crop of [
      { x: 6, y: 0, size: 4 },
      { x: -1, y: 0, size: 4 },
      { x: 0.5, y: 0, size: 4 },
    ])
      await expect(normalizeContentMedia(input, 'image/png', crop)).rejects.toThrow(/crop/i)
  })
  it('validates actual PCM16 frame duration and preserves playable bytes', async () => {
    const input = wav()
    const media = await normalizeContentMedia(input, 'audio/wav')
    expect(media.descriptor).toMatchObject({
      kind: 'audio',
      contentType: 'audio/wav',
      durationMs: 1000,
      channels: 1,
      sampleRate: 44100,
    })
    expect(media.bytes).toEqual(input)
  })
  it('rejects truncated, oversized, compressed, mislabeled and excessive duration audio', async () => {
    await expect(normalizeContentMedia(wav().subarray(0, 100), 'audio/wav')).rejects.toThrow()
    const compressed = wav()
    compressed.writeUInt16LE(3, 20)
    await expect(normalizeContentMedia(compressed, 'audio/wav')).rejects.toThrow(/PCM16/)
    await expect(normalizeContentMedia(wav(), 'audio/mpeg')).rejects.toThrow(/supported/i)
    await expect(normalizeContentMedia(wav(11), 'audio/wav')).rejects.toThrow(/10 seconds/)
    await expect(
      normalizeContentMedia(Buffer.alloc(2 * 1024 * 1024 + 1), 'audio/wav'),
    ).rejects.toThrow(/2 MiB/)
  })
})
it('rejects malformed finalized media in actual Skill and auxiliary authoring', async () => {
  const { validateSkillDefinition } = await import('./combat-content-authoring-validation')
  const { defaultBasicSkills } = await import('@aurevane/game-core/combat/combat-basic-actions')
  const { latestEnabledMatureSkills } = await import('@aurevane/game-core/combat/mature-skills')
  for (const original of [...defaultBasicSkills(), latestEnabledMatureSkills()[0]!]) {
    const result = validateSkillDefinition({
      ...original,
      media: { ...original.media, artwork: { id: 'ticket-only' } },
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.path.includes('media.artwork'))).toBe(true)
  }
})
