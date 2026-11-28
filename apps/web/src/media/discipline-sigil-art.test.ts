import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { DISCIPLINE_SIGIL_ART, disciplineSigilArtwork } from './discipline-sigil-art'

describe('generated Discipline sigil art', () => {
  it('covers every published Discipline exactly once with a real committed WebP', async () => {
    const published = DISCIPLINE_ATLAS.filter(
      (discipline) => discipline.publication === 'published',
    ).map((discipline) => discipline.id)
    const entries = Object.entries(DISCIPLINE_SIGIL_ART)

    expect(entries).toHaveLength(17)
    expect(entries.map(([id]) => id).sort()).toEqual([...published].sort())
    expect(new Set(entries.map(([, src]) => src)).size).toBe(entries.length)

    const hashes = await Promise.all(
      entries.map(async ([id, src]) => {
        expect(src).toBe(`/media/art/discipline-sigils/${id}-sigil-anime-v01.webp`)
        const file = readFileSync(fileURLToPath(new URL(`../../public${src}`, import.meta.url)))
        expect(await sharp(file).metadata()).toMatchObject({
          format: 'webp',
          width: 1024,
          height: 1024,
        })
        return createHash('sha256').update(file).digest('hex')
      }),
    )

    expect(new Set(hashes).size).toBe(entries.length)
    expect(disciplineSigilArtwork('unknown')).toBeNull()
  })
})
