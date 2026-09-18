import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import {
  InvalidPublishedCombatContentError,
  createCombatContentResolver,
  deriveSkillPresentationTags,
  type PublishedCombatContentSource,
} from './combat-content-resolver'

class MemoryPublishedCombatContentSource implements PublishedCombatContentSource {
  current = new Map<string, CombatContentVersionRecord>()
  versions = new Map<string, CombatContentVersionRecord>()

  async findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null> {
    return this.current.get(contentKey) ?? null
  }

  async findSkillVersion(
    contentKey: string,
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null> {
    return this.versions.get(`${contentKey}@${contentVersion}`) ?? null
  }
}

const staticSkill = (skillId: string, version?: number): MatureSkillDefinition => {
  const definition = resolveMatureSkillVersion(skillId, version)
  if (!definition) throw new Error(`Missing static test Skill ${skillId}@${String(version)}.`)
  return structuredClone(definition)
}

const publishedSkill = (definition: MatureSkillDefinition): CombatContentVersionRecord => ({
  id: '11111111-1111-4111-8111-111111111111',
  contentKey: definition.id,
  contentKind: 'skill',
  contentVersion: definition.contentVersion,
  definition: structuredClone(definition) as unknown as Readonly<Record<string, unknown>>,
  publishedBy: '22222222-2222-4222-8222-222222222222',
  publishedAt: '2026-09-17T21:45:00.000Z',
})

describe('combat content resolver', () => {
  it('falls back to the current static Skill when no publication exists', async () => {
    const source = new MemoryPublishedCombatContentSource()
    const resolver = createCombatContentResolver(source)

    const definition = await resolver.resolveCurrentSkillDefinition('vanguard.forceful-strike')

    expect(definition?.id).toBe('vanguard.forceful-strike')
    expect(definition?.contentVersion).toBe(3)
  })

  it('prefers the current published Skill over static content', async () => {
    const source = new MemoryPublishedCombatContentSource()
    const definition = {
      ...staticSkill('vanguard.forceful-strike', 2),
      contentVersion: 7,
      apCost: 44,
    } satisfies MatureSkillDefinition
    source.current.set(definition.id, publishedSkill(definition))

    const resolver = createCombatContentResolver(source)
    const resolved = await resolver.resolveCurrentSkillDefinition(definition.id)

    expect(resolved?.contentVersion).toBe(7)
    expect(resolved?.apCost).toBe(44)
  })

  it('resolves an exact historical published Skill version for pinned battles', async () => {
    const source = new MemoryPublishedCombatContentSource()
    const definition = {
      ...staticSkill('vanguard.forceful-strike', 2),
      contentVersion: 6,
      apCost: 41,
    } satisfies MatureSkillDefinition
    source.versions.set(`${definition.id}@6`, publishedSkill(definition))

    const resolver = createCombatContentResolver(source)
    const resolved = await resolver.resolvePinnedSkillDefinition(definition.id, 6)

    expect(resolved?.contentVersion).toBe(6)
    expect(resolved?.apCost).toBe(41)
  })

  it('falls back to an exact static version when no published historical row exists', async () => {
    const source = new MemoryPublishedCombatContentSource()
    const resolver = createCombatContentResolver(source)

    const resolved = await resolver.resolvePinnedSkillDefinition('vanguard.forceful-strike', 2)

    expect(resolved?.contentVersion).toBe(2)
  })

  it('rejects invalid stored definitions instead of silently falling back to static content', async () => {
    const source = new MemoryPublishedCombatContentSource()
    const invalid = {
      ...staticSkill('vanguard.forceful-strike', 2),
      contentVersion: 8,
      apCost: 101,
    } satisfies MatureSkillDefinition
    source.current.set(invalid.id, publishedSkill(invalid))

    const resolver = createCombatContentResolver(source)

    await expect(resolver.resolveCurrentSkillDefinition(invalid.id)).rejects.toBeInstanceOf(
      InvalidPublishedCombatContentError,
    )
  })

  it('rejects stored identity/version mismatches instead of changing requested semantics', async () => {
    const source = new MemoryPublishedCombatContentSource()
    const definition = {
      ...staticSkill('vanguard.forceful-strike', 2),
      contentVersion: 9,
    } satisfies MatureSkillDefinition
    source.current.set(definition.id, {
      ...publishedSkill(definition),
      contentKey: 'vanguard.forceful-strike',
      contentVersion: 10,
    })

    const resolver = createCombatContentResolver(source)

    await expect(resolver.resolveCurrentSkillDefinition(definition.id)).rejects.toBeInstanceOf(
      InvalidPublishedCombatContentError,
    )
  })

  it('derives read-only presentation tags from target/effects instead of stored manual tags', () => {
    const definition = staticSkill('vanguard.forceful-strike', 2)

    expect(deriveSkillPresentationTags(definition)).toEqual(['Enemy', 'Single', 'Dmg'])
  })
})
