import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it } from 'vitest'

import { REGULAR_SKILL_ART, regularSkillArtwork } from './regular-skill-art'

describe('approved regular Discipline Skill action art — first 88', () => {
  it('maps exactly the approved 88 current Skills to unique committed WebPs', () => {
    const entries = Object.entries(REGULAR_SKILL_ART)
    expect(entries).toHaveLength(88)

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
    })

    const currentIds = new Set(latestEnabledMatureSkills().map((skill) => skill.id))
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
      '/media/art/discipline-skills/lifebinder-vital-sever-v01.webp',
    )
    expect(regularSkillArtwork('ironfist.rising-fist')).toBe(
      '/media/art/discipline-skills/ironfist-rising-fist-v01.webp',
    )
    expect(regularSkillArtwork('aetherist.arc-bolt')).toBe(
      '/media/art/discipline-skills/aetherist-arc-bolt-v01.webp',
    )
    expect(regularSkillArtwork('aetherist.overchannel')).toBe(
      '/media/art/discipline-skills/aetherist-overchannel-v01.webp',
    )
    expect(regularSkillArtwork('chronist.temporal-bolt')).toBe(
      '/media/art/discipline-skills/chronist-temporal-bolt-v01.webp',
    )
    expect(regularSkillArtwork('chronist.stolen-moment')).toBe(
      '/media/art/discipline-skills/chronist-stolen-moment-v01.webp',
    )
    expect(regularSkillArtwork('bastion.shield-bash')).toBe(
      '/media/art/discipline-skills/bastion-shield-bash-v02.webp',
    )
    expect(regularSkillArtwork('bastion.steady-footing')).toBe(
      '/media/art/discipline-skills/bastion-steady-footing-v02.webp',
    )
    expect(regularSkillArtwork('ravager.frenzy')).toBe(
      '/media/art/discipline-skills/ravager-frenzy-v01.webp',
    )
    expect(regularSkillArtwork('edgedancer.lunge')).toBe(
      '/media/art/discipline-skills/edgedancer-lunge-v01.webp',
    )
    expect(regularSkillArtwork('edgedancer.finishing-thrust')).toBe(
      '/media/art/discipline-skills/edgedancer-finishing-thrust-v01.webp',
    )
    expect(regularSkillArtwork('wildwarden.snare')).toBe(
      '/media/art/discipline-skills/wildwarden-snare-v01.webp',
    )
    expect(regularSkillArtwork('wildwarden.close-quarry')).toBe(
      '/media/art/discipline-skills/wildwarden-close-quarry-v01.webp',
    )
    expect(regularSkillArtwork('runeblade.aether-cut')).toBeNull()
  })
})
