import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it } from 'vitest'

import { REGULAR_SKILL_ART, regularSkillArtwork } from './regular-skill-art'

describe('approved regular Discipline Skill action art — complete 136', () => {
  it('maps all 136 current regular Skills to unique committed WebPs', () => {
    const entries = Object.entries(REGULAR_SKILL_ART)
    expect(entries).toHaveLength(136)

    const counts = entries.reduce<Record<string, number>>((result, [id]) => {
      const discipline = id.split('.')[0]!
      result[discipline] = (result[discipline] ?? 0) + 1
      return result
    }, {})
    expect(counts).toEqual({
      vanguard: 8,
      farstrider: 8,
      shadehand: 8,
      lifebinder: 8,
      ironfist: 8,
      aetherist: 8,
      chronist: 8,
      bastion: 8,
      ravager: 8,
      edgedancer: 8,
      wildwarden: 8,
      runeblade: 8,
      dawnshield: 8,
      cinderweaver: 8,
      frostweaver: 8,
      stormsinger: 8,
      tidecaller: 8,
    })

    const currentIds = new Set(latestEnabledMatureSkills().map((skill) => skill.id))
    expect(currentIds.size).toBe(136)
    expect(new Set(entries.map(([id]) => id))).toEqual(currentIds)
    const hashes = entries.map(([id, src]) => {
      expect(currentIds.has(id)).toBe(true)
      expect(src).toMatch(/^\/media\/art\/discipline-skills\/[a-z0-9-]+-v\d{2}\.webp$/)
      const file = readFileSync(fileURLToPath(new URL(`../../public${src}`, import.meta.url)))
      expect(file.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(file.length).toBeGreaterThan(3_000)
      expect(regularSkillArtwork(id)).toBe(src)
      return createHash('sha256').update(file).digest('hex')
    })

    expect(new Set(entries.map(([, src]) => src)).size).toBe(entries.length)
    expect(new Set(hashes).size).toBe(entries.length)
    expect(regularSkillArtwork('lifebinder.vital-sever')).toBe(
      '/media/art/discipline-skills/lifebinder-vital-sever-anime-v01.webp',
    )
    expect(regularSkillArtwork('ironfist.rising-fist')).toBe(
      '/media/art/discipline-skills/ironfist-rising-fist-anime-v01.webp',
    )
    expect(regularSkillArtwork('aetherist.arc-bolt')).toBe(
      '/media/art/discipline-skills/aetherist-arc-bolt-anime-v01.webp',
    )
    expect(regularSkillArtwork('aetherist.overchannel')).toBe(
      '/media/art/discipline-skills/aetherist-overchannel-anime-v01.webp',
    )
    expect(regularSkillArtwork('chronist.temporal-bolt')).toBe(
      '/media/art/discipline-skills/chronist-temporal-bolt-anime-v01.webp',
    )
    expect(regularSkillArtwork('chronist.stolen-moment')).toBe(
      '/media/art/discipline-skills/chronist-stolen-moment-anime-v01.webp',
    )
    expect(regularSkillArtwork('bastion.shield-bash')).toBe(
      '/media/art/discipline-skills/bastion-shield-bash-anime-v01.webp',
    )
    expect(regularSkillArtwork('bastion.steady-footing')).toBe(
      '/media/art/discipline-skills/bastion-steady-footing-anime-v01.webp',
    )
    expect(regularSkillArtwork('ravager.frenzy')).toBe(
      '/media/art/discipline-skills/ravager-frenzy-anime-v01.webp',
    )
    expect(regularSkillArtwork('edgedancer.lunge')).toBe(
      '/media/art/discipline-skills/edgedancer-lunge-anime-v01.webp',
    )
    expect(regularSkillArtwork('edgedancer.finishing-thrust')).toBe(
      '/media/art/discipline-skills/edgedancer-finishing-thrust-anime-v01.webp',
    )
    expect(regularSkillArtwork('wildwarden.snare')).toBe(
      '/media/art/discipline-skills/wildwarden-snare-anime-v01.webp',
    )
    expect(regularSkillArtwork('wildwarden.close-quarry')).toBe(
      '/media/art/discipline-skills/wildwarden-close-quarry-anime-v01.webp',
    )
    expect(regularSkillArtwork('runeblade.arc-edge')).toBe(
      '/media/art/discipline-skills/runeblade-arc-edge-anime-v01.webp',
    )
    expect(regularSkillArtwork('runeblade.rune-mending')).toBe(
      '/media/art/discipline-skills/runeblade-rune-mending-anime-v01.webp',
    )
    expect(regularSkillArtwork('dawnshield.radiant-strike')).toBe(
      '/media/art/discipline-skills/dawnshield-radiant-strike-anime-v01.webp',
    )
    expect(regularSkillArtwork('dawnshield.last-light')).toBe(
      '/media/art/discipline-skills/dawnshield-last-light-anime-v01.webp',
    )
    expect(regularSkillArtwork('cinderweaver.cinder-bolt')).toBe(
      '/media/art/discipline-skills/cinderweaver-cinder-bolt-anime-v01.webp',
    )
    expect(regularSkillArtwork('cinderweaver.blistering-heat')).toBe(
      '/media/art/discipline-skills/cinderweaver-blistering-heat-anime-v01.webp',
    )
    expect(regularSkillArtwork('frostweaver.ice-lance')).toBe(
      '/media/art/discipline-skills/frostweaver-ice-lance-anime-v01.webp',
    )
    expect(regularSkillArtwork('frostweaver.brittle-ice')).toBe(
      '/media/art/discipline-skills/frostweaver-brittle-ice-anime-v01.webp',
    )
    expect(regularSkillArtwork('stormsinger.arc-spark')).toBe(
      '/media/art/discipline-skills/stormsinger-arc-spark-anime-v01.webp',
    )
    expect(regularSkillArtwork('stormsinger.storm-breath')).toBe(
      '/media/art/discipline-skills/stormsinger-storm-breath-anime-v01.webp',
    )
    expect(regularSkillArtwork('tidecaller.water-lance')).toBe(
      '/media/art/discipline-skills/tidecaller-water-lance-anime-v01.webp',
    )
    expect(regularSkillArtwork('tidecaller.crushing-wave')).toBe(
      '/media/art/discipline-skills/tidecaller-crushing-wave-anime-v01.webp',
    )
    expect(regularSkillArtwork('future.skill')).toBeNull()
  })
})
