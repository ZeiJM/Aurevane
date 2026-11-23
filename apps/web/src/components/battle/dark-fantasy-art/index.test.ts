import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { battleResonanceArtwork, battleSkillArtwork } from '../battle-skill-presentation'
import { DARK_FANTASY_COMBAT_ARTWORK } from './index'

describe('dark-fantasy combat artwork', () => {
  it('ships a distinct valid static WebP for every newly authored Technique, Essence, and Resonance', () => {
    const entries = Object.entries(DARK_FANTASY_COMBAT_ARTWORK)
    expect(entries).toHaveLength(39)
    expect(new Set(entries.map(([, artwork]) => artwork)).size).toBe(entries.length)

    for (const [artworkId, artwork] of entries) {
      expect(artwork.startsWith('/media/skills/dark-fantasy/'), artworkId).toBe(true)
      expect(artwork.endsWith('.webp'), artworkId).toBe(true)
      const bytes = readFileSync(resolve(process.cwd(), 'public', artwork.slice(1)))
      expect(bytes.subarray(0, 4).toString('ascii'), artworkId).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString('ascii'), artworkId).toBe('WEBP')
      expect(bytes.readUInt32LE(4) + 8, artworkId).toBe(bytes.length)
    }
  })

  it('prefers approved Skill and Resonance art over legacy dark-fantasy assets', () => {
    const skill = battleSkillArtwork('lifebinder.vital-sever')
    const essence = battleSkillArtwork('essence.aetherist.aether-nova')
    const resonance = battleResonanceArtwork('resonance.farstrider-shadehand.marked-opening')

    expect(skill).toBe('/media/art/discipline-skills/lifebinder-vital-sever-v01.webp')
    expect(essence).toBe('/media/art/essence-skills/aetherist-aether-nova-v01.webp')
    expect(resonance).toBe(
      '/media/art/resonances/resonance-farstrider-shadehand-marked-opening-v01.webp',
    )

    expect(skill).not.toBe(DARK_FANTASY_COMBAT_ARTWORK['lifebinder.vital-sever'])
    expect(essence).not.toBe(DARK_FANTASY_COMBAT_ARTWORK['essence.aetherist.aether-nova'])
    expect(resonance).not.toBe(
      DARK_FANTASY_COMBAT_ARTWORK['resonance.farstrider-shadehand.marked-opening'],
    )
  })
})
