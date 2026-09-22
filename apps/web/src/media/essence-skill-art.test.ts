import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { describe, expect, it } from 'vitest'

import { ESSENCE_SKILL_ART, essenceSkillArtwork } from './essence-skill-art'

describe('approved Discipline Essence action art', () => {
  it('covers every published Discipline Essence exactly once with a real committed WebP', () => {
    const currentEssenceIds = DISCIPLINE_ATLAS.filter(
      (discipline) => discipline.publication === 'published',
    ).map((discipline) => resolveEssenceForBuild(discipline.id, null)?.essenceId)

    expect(currentEssenceIds.every(Boolean)).toBe(true)

    const entries = Object.entries(ESSENCE_SKILL_ART)
    expect(entries).toHaveLength(17)
    expect(entries.map(([id]) => id).sort()).toEqual(
      currentEssenceIds.filter((id): id is string => Boolean(id)).sort(),
    )
    expect(new Set(entries.map(([, src]) => src)).size).toBe(entries.length)

    const hashes = entries.map(([id, src]) => {
      expect(src).toMatch(/^\/media\/art\/essence-skills\/[a-z0-9-]+-v01\.webp$/)
      const file = readFileSync(fileURLToPath(new URL(`../../public${src}`, import.meta.url)))
      expect(file.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(file.length).toBeGreaterThan(5_000)
      expect(essenceSkillArtwork(id)).toBe(src)
      return createHash('sha256').update(file).digest('hex')
    })

    expect(new Set(hashes).size).toBe(entries.length)
    expect(essenceSkillArtwork('essence.unknown.missing')).toBeNull()
  })
})
