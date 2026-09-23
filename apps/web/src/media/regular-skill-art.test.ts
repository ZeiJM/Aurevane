import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it } from 'vitest'

import { REGULAR_SKILL_ART, regularSkillArtwork } from './regular-skill-art'

describe('approved regular Discipline Skill action art — first 40', () => {
  it('maps exactly the approved 40 current Skills to unique committed WebPs', () => {
    const entries = Object.entries(REGULAR_SKILL_ART)
    expect(entries).toHaveLength(40)

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
    })

    const currentIds = new Set(latestEnabledMatureSkills().map((skill) => skill.id))
    const hashes = entries.map(([id, src]) => {
      expect(currentIds.has(id)).toBe(true)
      expect(src).toMatch(/^\/media\/art\/discipline-skills\/[a-z0-9-]+-v01\.webp$/)
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
    expect(regularSkillArtwork('aetherist.arc-bolt')).toBeNull()
  })
})
