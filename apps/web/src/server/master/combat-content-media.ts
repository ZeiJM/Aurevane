import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  CONTENT_MEDIA_MAX_BYTES,
  type FinalizedContentImage,
  type FinalizedContentAudio,
  type ContentImageCrop,
} from '@aurevane/game-core/combat/content-media'

type NormalizedMedia = {
  bytes: Buffer
  descriptor: Omit<FinalizedContentImage, 'id'> | Omit<FinalizedContentAudio, 'id'>
}
function invalid(message: string): never {
  throw new AurevaneError('INVALID_REQUEST', message)
}

/** Decode bytes on the server; client MIME, dimensions, hashes and previews are never authority. */
export async function normalizeContentMedia(
  input: Buffer,
  contentType: string,
  requestedCrop?: unknown,
): Promise<NormalizedMedia> {
  if (!input.length || input.length > CONTENT_MEDIA_MAX_BYTES)
    invalid('Upload a nonempty file no larger than 2 MiB.')
  if (
    contentType === 'audio/wav' ||
    contentType === 'audio/x-wav' ||
    contentType === 'audio/wave'
  ) {
    if (requestedCrop !== undefined) invalid('Audio does not support image crop.')
    if (
      input.length < 44 ||
      input.toString('ascii', 0, 4) !== 'RIFF' ||
      input.readUInt32LE(4) !== input.length - 8 ||
      input.toString('ascii', 8, 12) !== 'WAVE'
    )
      invalid('The WAV file is truncated or invalid.')
    let format: { channels: 1 | 2; sampleRate: 44100 | 48000; blockAlign: number } | undefined
    let frames: Buffer | undefined
    let offset = 12
    while (offset + 8 <= input.length) {
      const kind = input.toString('ascii', offset, offset + 4)
      const length = input.readUInt32LE(offset + 4)
      const start = offset + 8,
        end = start + length
      if (end > input.length) invalid('The WAV file contains a truncated chunk.')
      if (kind === 'fmt ') {
        if (
          format ||
          length !== 16 ||
          input.readUInt16LE(start) !== 1 ||
          input.readUInt16LE(start + 14) !== 16
        )
          invalid('Only uncompressed PCM16 WAV audio is supported.')
        const channels = input.readUInt16LE(start + 2),
          sampleRate = input.readUInt32LE(start + 4),
          blockAlign = input.readUInt16LE(start + 12)
        if (
          ![1, 2].includes(channels) ||
          ![44100, 48000].includes(sampleRate) ||
          blockAlign !== channels * 2 ||
          input.readUInt32LE(start + 8) !== sampleRate * blockAlign
        )
          invalid('Use PCM16 WAV, mono or stereo, at 44.1 or 48 kHz.')
        format = {
          channels: channels as 1 | 2,
          sampleRate: sampleRate as 44100 | 48000,
          blockAlign,
        }
      } else if (kind === 'data') {
        if (frames) invalid('Use a WAV file with one data chunk.')
        frames = input.subarray(start, end)
      }
      offset = end + (length % 2)
    }
    if (
      offset !== input.length ||
      !format ||
      !frames?.length ||
      frames.length % format.blockAlign !== 0
    )
      invalid('The WAV frame data is incomplete.')
    const durationMs = (frames.length / format.blockAlign / format.sampleRate) * 1000
    if (durationMs > 10000) invalid('Audio must be no longer than 10 seconds.')
    // Normalize to one canonical header and the actual frames; discard arbitrary ancillary metadata.
    const bytes = Buffer.alloc(44 + frames.length)
    bytes.write('RIFF')
    bytes.writeUInt32LE(bytes.length - 8, 4)
    bytes.write('WAVEfmt ', 8)
    bytes.writeUInt32LE(16, 16)
    bytes.writeUInt16LE(1, 20)
    bytes.writeUInt16LE(format.channels, 22)
    bytes.writeUInt32LE(format.sampleRate, 24)
    bytes.writeUInt32LE(format.sampleRate * format.blockAlign, 28)
    bytes.writeUInt16LE(format.blockAlign, 32)
    bytes.writeUInt16LE(16, 34)
    bytes.write('data', 36)
    bytes.writeUInt32LE(frames.length, 40)
    frames.copy(bytes, 44)
    return {
      bytes,
      descriptor: {
        kind: 'audio',
        contentType: 'audio/wav',
        byteLength: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
        durationMs: Math.round(durationMs * 1000) / 1000,
        channels: format.channels,
        sampleRate: format.sampleRate,
      },
    }
  }
  const formats: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/webp': 'webp',
  }
  if (!formats[contentType])
    invalid('This file type is not supported. Choose PNG, JPEG, WebP or PCM16 WAV.')
  try {
    const decoder = sharp(input, { limitInputPixels: 4096 * 4096, failOn: 'warning' })
    const metadata = await decoder.metadata()
    if (metadata.format !== formats[contentType])
      invalid('The image bytes do not match the declared file type.')
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096 ||
      (metadata.pages ?? 1) !== 1
    )
      invalid('Use a single image no larger than 4096 × 4096 pixels.')
    // Orient first so crop coordinates match the browser image preview.
    const oriented = await decoder.rotate().png().toBuffer({ resolveWithObject: true })
    const width = oriented.info.width,
      height = oriented.info.height
    const size = Math.min(width, height)
    const crop = (requestedCrop ?? {
      x: Math.floor((width - size) / 2),
      y: Math.floor((height - size) / 2),
      size,
    }) as ContentImageCrop
    if (
      !crop ||
      typeof crop !== 'object' ||
      Array.isArray(crop) ||
      Object.keys(crop).length !== 3 ||
      ![crop.x, crop.y, crop.size].every(Number.isSafeInteger) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.size < 1 ||
      crop.x + crop.size > width ||
      crop.y + crop.size > height
    )
      invalid('Crop must be a whole-pixel square inside the image.')
    const bytes = await sharp(oriented.data)
      .extract({ left: crop.x, top: crop.y, width: crop.size, height: crop.size })
      .png()
      .toBuffer()
    if (bytes.length > CONTENT_MEDIA_MAX_BYTES)
      invalid('The finalized crop exceeds 2 MiB. Choose a smaller crop.')
    return {
      bytes,
      descriptor: {
        kind: 'image',
        contentType: 'image/png',
        byteLength: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
        width: crop.size,
        height: crop.size,
        sourceWidth: width,
        sourceHeight: height,
        crop,
      },
    }
  } catch (error) {
    if (error instanceof AurevaneError) throw error
    return invalid('The image could not be decoded. Choose a valid PNG, JPEG or WebP file.')
  }
}
