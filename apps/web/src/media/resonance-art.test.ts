import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { P35_REPRESENTATIVE_RESONANCES } from '@aurevane/game-core/combat/resonance'
import { describe, expect, it } from 'vitest'

import { APPROVED_RESONANCE_ART, resonanceArtwork } from './resonance-art'

describe('approved Resonance artwork — first 80 of 136', () => {
  it('maps exactly the 80 approved Resonances to unique committed square WebPs', () => {
    const entries = Object.entries(APPROVED_RESONANCE_ART)
    expect(entries).toHaveLength(80)

    const currentIds = new Set(P35_REPRESENTATIVE_RESONANCES.map((resonance) => resonance.id))
    expect(currentIds.size).toBe(136)

    const hashes = entries.map(([id, src]) => {
      expect(currentIds.has(id)).toBe(true)
      expect(src).toMatch(/^\/media\/art\/resonances\/resonance-[a-z0-9-]+-v\d{2}\.webp$/)
      const file = readFileSync(fileURLToPath(new URL(`../../public${src}`, import.meta.url)))
      expect(file.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(file.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect(file.length).toBeGreaterThan(3_000)
      expect(resonanceArtwork(id)).toBe(src)
      return createHash('sha256').update(file).digest('hex')
    })

    expect(new Set(entries.map(([, src]) => src)).size).toBe(80)
    expect(new Set(hashes).size).toBe(80)
  })

  it('does not claim unapproved Resonance artwork', () => {
    expect(resonanceArtwork('resonance.frostweaver-runeblade.linked-sequence')).toBeNull()
    expect(resonanceArtwork('resonance.unknown.invalid')).toBeNull()
  })
})
