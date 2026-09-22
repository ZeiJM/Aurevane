import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'
import { P36_REPRESENTATIVE_ESSENCES } from '@aurevane/game-core/combat/essence'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { P35_REPRESENTATIVE_RESONANCES } from '@aurevane/game-core/combat/resonance'
import { describe, expect, it } from 'vitest'

import {
  DARK_FANTASY_DISCIPLINES,
  darkFantasyResonanceArtwork,
  darkFantasySkillArtwork,
  disciplineSigilDataUrl,
} from './generated-dark-fantasy-art'

function decodedSvg(source: string | null): string {
  expect(source).toMatch(/^data:image\/svg\+xml,/)
  return decodeURIComponent(source!.slice('data:image/svg+xml,'.length))
}

function expectSquareMaster(source: string | null, kind: string): void {
  const svg = decodedSvg(source)
  expect(svg).toContain('width="512"')
  expect(svg).toContain('height="512"')
  expect(svg).toContain('viewBox="0 0 128 128"')
  expect(svg).toContain(`data-art-kind="${kind}"`)
}

function expectStaticSigil(source: string | null, disciplineId: string): string {
  expect(source).toBe(`/media/art/discipline-sigils/${disciplineId}-sigil-v01.webp`)
  const fileUrl = new URL(`../../public${source}`, import.meta.url)
  expect(existsSync(fileUrl)).toBe(true)
  const bytes = readFileSync(fileUrl)
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP')
  return createHash('sha256').update(bytes).digest('hex')
}

describe('complete dark-fantasy artwork coverage', () => {
  it('covers every published Discipline, regular Skill, Essence and Resonance with unique art', () => {
    const publishedDisciplines = DISCIPLINE_ATLAS.filter(
      (discipline) => discipline.publication === 'published',
    ).map((discipline) => discipline.id)
    const skills = latestEnabledMatureSkills().map((skill) => skill.id)
    const essences = [
      ...new Map(
        P36_REPRESENTATIVE_ESSENCES.filter((x) => x.enabled).map((x) => [x.essenceId, x]),
      ).keys(),
    ]
    const resonances = P35_REPRESENTATIVE_RESONANCES.filter((x) => x.enabled).map((x) => x.id)
    const skillArt = skills.map((id) => darkFantasySkillArtwork(id))
    const essenceArt = essences.map((id) => darkFantasySkillArtwork(id))
    const resonanceArt = resonances.map((id) => darkFantasyResonanceArtwork(id))
    const sigils = DARK_FANTASY_DISCIPLINES.map((id) => disciplineSigilDataUrl(id))
    const allArtwork = [...skillArt, ...essenceArt, ...resonanceArt, ...sigils]

    expect([...DARK_FANTASY_DISCIPLINES].sort()).toEqual([...publishedDisciplines].sort())
    expect(skills).toHaveLength(136)
    expect(essences).toHaveLength(17)
    expect(resonances).toHaveLength(136)
    expect(sigils).toHaveLength(17)
    expect(allArtwork).toHaveLength(306)
    expect(allArtwork.every(Boolean)).toBe(true)
    expect(new Set(allArtwork).size).toBe(allArtwork.length)
  })

  it('emits true 1:1 HQ masters with the requested category-specific visual contracts', () => {
    const skill = darkFantasySkillArtwork('runeblade.aether-cut')
    const essence = darkFantasySkillArtwork('essence.cinderweaver.phoenix-wake')
    const resonance = darkFantasyResonanceArtwork('resonance.aetherist-vanguard.spellsteel-rhythm')
    const sigil = disciplineSigilDataUrl('vanguard')

    expectSquareMaster(skill, 'discipline-skill-action')
    expectSquareMaster(essence, 'essence-skill-action')
    expectSquareMaster(resonance, 'resonance-crest')
    expectStaticSigil(sigil, 'vanguard')

    expect(decodedSvg(skill)).toContain('data-action-figure="true"')
    expect(decodedSvg(essence)).toContain('data-action-figure="true"')
    expect(decodedSvg(resonance)).toContain('data-spiritual-harmony="true"')
    expect(sigil).toBe('/media/art/discipline-sigils/vanguard-sigil-v01.webp')
  })

  it('keeps every category square and unique across the full 306-asset suite', () => {
    const skills = latestEnabledMatureSkills().map((skill) => darkFantasySkillArtwork(skill.id))
    const essences = [
      ...new Map(
        P36_REPRESENTATIVE_ESSENCES.filter((x) => x.enabled).map((x) => [x.essenceId, x]),
      ).values(),
    ].map((essence) => darkFantasySkillArtwork(essence.essenceId))
    const resonances = P35_REPRESENTATIVE_RESONANCES.filter((x) => x.enabled).map((resonance) =>
      darkFantasyResonanceArtwork(resonance.id),
    )
    const sigils = DARK_FANTASY_DISCIPLINES.map((id) => disciplineSigilDataUrl(id))

    for (const source of skills) expectSquareMaster(source, 'discipline-skill-action')
    for (const source of essences) expectSquareMaster(source, 'essence-skill-action')
    for (const source of resonances) expectSquareMaster(source, 'resonance-crest')
    const sigilHashes = DARK_FANTASY_DISCIPLINES.map((id, index) =>
      expectStaticSigil(sigils[index]!, id),
    )
    expect(new Set(sigilHashes).size).toBe(sigils.length)
  })
})
