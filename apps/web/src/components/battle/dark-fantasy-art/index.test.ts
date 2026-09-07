import { describe, expect, it } from 'vitest'

import { battleResonanceArtwork, battleSkillArtwork } from '../battle-skill-presentation'
import { DARK_FANTASY_COMBAT_ARTWORK } from './index'

function decodeWebpDataUrl(dataUrl: string): Buffer {
  expect(dataUrl.startsWith('data:image/webp;base64,')).toBe(true)
  return Buffer.from(dataUrl.slice('data:image/webp;base64,'.length), 'base64')
}

describe('dark-fantasy combat artwork', () => {
  it('ships a distinct valid WebP for every newly authored Technique, Essence, and Resonance', () => {
    const entries = Object.entries(DARK_FANTASY_COMBAT_ARTWORK)
    expect(entries).toHaveLength(39)
    expect(new Set(entries.map(([, artwork]) => artwork)).size).toBe(entries.length)

    for (const [artworkId, artwork] of entries) {
      const bytes = decodeWebpDataUrl(artwork)
      expect(bytes.subarray(0, 4).toString('ascii'), artworkId).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString('ascii'), artworkId).toBe('WEBP')
      expect(bytes.readUInt32LE(4) + 8, artworkId).toBe(bytes.length)
    }
  })

  it('uses the curated dark-fantasy artwork before generated sigils', () => {
    expect(battleSkillArtwork('lifebinder.vital-sever')).toBe(
      DARK_FANTASY_COMBAT_ARTWORK['lifebinder.vital-sever'],
    )
    expect(battleSkillArtwork('essence.aetherist.aether-nova')).toBe(
      DARK_FANTASY_COMBAT_ARTWORK['essence.aetherist.aether-nova'],
    )
    expect(battleResonanceArtwork('resonance.farstrider-shadehand.marked-opening')).toBe(
      DARK_FANTASY_COMBAT_ARTWORK['resonance.farstrider-shadehand.marked-opening'],
    )
  })
})
