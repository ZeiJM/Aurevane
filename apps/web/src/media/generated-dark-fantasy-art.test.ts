import { describe, expect, it } from 'vitest'
import { P36_REPRESENTATIVE_ESSENCES } from '@aurevane/game-core/combat/essence'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { P35_REPRESENTATIVE_RESONANCES } from '@aurevane/game-core/combat/resonance'
import {
  DARK_FANTASY_DISCIPLINES,
  darkFantasyResonanceArtwork,
  darkFantasySkillArtwork,
  disciplineSigilDataUrl,
} from './generated-dark-fantasy-art'

describe('complete dark-fantasy artwork coverage', () => {
  it('covers all skills, essences, resonances and class sigils without duplicate sources', () => {
    const skills = latestEnabledMatureSkills().map((skill) => skill.id)
    const essences = P36_REPRESENTATIVE_ESSENCES.filter((x) => x.enabled).map((x) => x.essenceId)
    const resonances = P35_REPRESENTATIVE_RESONANCES.filter((x) => x.enabled).map((x) => x.id)
    const skillArt = skills.map((id) => darkFantasySkillArtwork(id))
    const essenceArt = essences.map((id) => darkFantasySkillArtwork(id))
    const resonanceArt = resonances.map((id) => darkFantasyResonanceArtwork(id))
    const sigils = DARK_FANTASY_DISCIPLINES.map((id) => disciplineSigilDataUrl(id))

    expect(skills).toHaveLength(136)
    expect(essences).toHaveLength(17)
    expect(resonances).toHaveLength(136)
    expect(sigils).toHaveLength(17)
    for (const group of [skillArt, essenceArt, resonanceArt, sigils]) {
      expect(group.every((value) => value?.startsWith('data:image/svg+xml,'))).toBe(true)
      expect(new Set(group).size).toBe(group.length)
    }
  })
})
