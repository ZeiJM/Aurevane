import { readFileSync } from 'node:fs'
import { expect, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { FOUNDATION_DISCIPLINES } from '@aurevane/game-core/character/foundation-disciplines'
import { ADVANCED_DISCIPLINES } from '@aurevane/game-core/character/advanced-disciplines'
import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributes,
} from '@aurevane/game-core/character/creation'
import {
  attributePointPoolForLevel,
  foundationDisciplineAttributePolicy,
  validateAttributeAllocation,
} from '@aurevane/game-core/character/attribute-allocation'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import {
  type CharacterActiveBuildRecord,
  type CharacterBuildRepository,
  type CharacterCommittedBuildSnapshotRecord,
  type CharacterEquippedDisciplineSkillRecord,
  type CharacterLearnedSkillRecord,
  type SaveDisciplineSkillsInput,
  type DisciplineCatalogEntry,
} from '@/server/character/character-build-service'

export const owner = '11111111-1111-4111-8111-111111111111'
export const characterId = '22222222-2222-4222-8222-222222222222'
export const actorId = `character:${characterId}`
export const timestamp = '2026-10-01T00:00:00.000Z'
export type RosterProposalRow = {
  id: string
  beforeVersion: number
  playIdentity?: {
    earnedFourSkillKit: { id: string; contentVersion: number; sourceDisciplineId: string }[]
  }
} & (
  | { kind: 'skill'; after: MatureSkillDefinition }
  | { kind: 'essence'; after: EssenceDefinition }
  | { kind: 'resonance'; after: AnyResonanceDefinition }
  | { kind: 'basic'; after: BasicSkillDefinition }
)
export const rows: RosterProposalRow[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
export const skillRows = rows.filter((row) => row.kind === 'skill')
export const disciplines = [...FOUNDATION_DISCIPLINES, ...ADVANCED_DISCIPLINES]
export type Kit = { name: string; primary: string; secondary: string | null; ids: string[] }
class LocalPublicationStore extends InMemoryCombatContentRepository {
  async getOperatorRole(userId: string) {
    return userId === owner ? ('owner' as const) : null
  }
}
export const store = new LocalPublicationStore()
export const resolver = createCombatContentResolver({
  findCurrentSkill: (key) => store.findPublished(key, 'skill'),
  findSkillVersion: async (key, version) =>
    (await store.listPublishedVersions(key)).find(
      (row) => row.contentKind === 'skill' && row.contentVersion === version,
    ) ?? null,
  findCurrentContent: (key, kind) => store.findPublished(key, kind),
  findContentVersion: async (key, kind, version) =>
    (await store.listPublishedVersions(key)).find(
      (row) => row.contentKind === kind && row.contentVersion === version,
    ) ?? null,
})
let publicationPromise: Promise<void> | undefined
export function publishProposedRoster() {
  return (publicationPromise ??= (async () => {
    const service = createCombatContentAuthoringService({ store, resolver })
    for (const row of rows.filter((row) => row.kind !== 'basic')) {
      const input = {
        actorUserId: owner,
        definition: row.after,
        expectedBaseVersion: row.beforeVersion,
      }
      if (row.kind === 'skill') await service.publishSkill(input)
      else if (row.kind === 'essence') await service.publishEssence(input)
      else await service.publishResonance(input)
    }
  })())
}

export function attributes(primary: string, level: 1 | 100): CharacterAttributes {
  const policy = foundationDisciplineAttributePolicy(primary)!
  const result = { ...policy.baseAttributes }
  if (level === 100) {
    result.vitality = 40
    const core = policy.focusAttributes.find((id) => id !== 'vitality')!
    result[core] = 40
  }
  let remaining =
    attributePointPoolForLevel(level) -
    CHARACTER_ATTRIBUTE_IDS.reduce((sum, id) => sum + result[id], 0)
  while (remaining > 0) {
    for (const id of CHARACTER_ATTRIBUTE_IDS) {
      if (!remaining) break
      // Preserve the explicit Level100 Core40/Vitality40 benchmark.
      if (level === 100 && result[id] >= 40) continue
      if (result[id] >= (policy.attributeCaps[id] ?? 40)) continue
      result[id] += 1
      remaining -= 1
    }
  }
  expect(
    validateAttributeAllocation({ attributes: result, level, policy, requireFullPool: true }),
  ).toEqual([])
  expect(CHARACTER_ATTRIBUTE_IDS.reduce((sum, id) => sum + result[id], 0)).toBe(
    level === 100 ? 135 : 36,
  )
  return result
}
export function fixture(kit: Kit, level: 1 | 100, identity = { owner, characterId }) {
  const { owner, characterId } = identity
  const character: PersistedCharacter = {
    id: characterId,
    userId: owner,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Legal Build',
    nameKey: 'legalbuild',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    attributes: attributes(kit.primary, level),
    level,
    xp: 0,
    progressionCycle: { number: 1 },
    createdAt: timestamp,
    cycleStartedAt: timestamp,
    lastActiveAt: timestamp,
  }
  const catalog: DisciplineCatalogEntry[] = disciplines.map((definition) => ({
    definition: {
      id: definition.id,
      name: definition.name,
      summary: definition.summary,
      definitionVersion: 1,
      enabledForPrimary: true,
      enabledForSecondary: true,
    },
    profile: { disciplineId: definition.id, profileVersion: 1, statOffsets: {} },
    // Committed earned facts in this repository fixture; never Owner testing entitlements.
    masteredAt: timestamp,
  }))
  const primary = catalog.find((entry) => entry.definition.id === kit.primary)!
  const secondary = catalog.find((entry) => entry.definition.id === kit.secondary)
  const build: CharacterActiveBuildRecord = {
    characterId,
    schemaVersion: 4,
    buildVersion: 1,
    primaryDefinition: primary.definition,
    primaryProfile: primary.profile,
    secondaryDefinition: secondary?.definition ?? null,
    primaryAttunementLockedUntil: null,
    secondaryAttunementLockedUntil: null,
    attunementPolicy: {
      version: 1,
      primaryCooldownSeconds: 14400,
      secondaryCooldownSeconds: 14400,
    },
    serverNow: timestamp,
    updatedAt: timestamp,
  }
  // Learning records persist their genuine historic version. New battle admission
  // resolves current publication without rewriting the earned or committed record.
  const learned: CharacterLearnedSkillRecord[] = skillRows
    .filter((row) => [kit.primary, kit.secondary].includes(row.after.sourceDisciplineId))
    .map((row) => ({
      skillId: row.id,
      contentVersion: row.beforeVersion,
      sourceDisciplineId: row.after.sourceDisciplineId,
      learnedAt: timestamp,
    }))
  let equipped: CharacterEquippedDisciplineSkillRecord[] = []
  let snapshot: CharacterCommittedBuildSnapshotRecord | null = null
  const repository: CharacterBuildRepository = {
    findActiveBuild: vi.fn(async () => structuredClone(build)),
    listDisciplines: vi.fn(async () => structuredClone(catalog)),
    listLearnedSkills: vi.fn(async () => structuredClone(learned)),
    listEquippedDisciplineSkills: vi.fn(async () => structuredClone(equipped)),
    loadCommittedBuildSnapshot: vi.fn(async () => structuredClone(snapshot)),
    saveDisciplineSkills: vi.fn(async (input: SaveDisciplineSkillsInput) => {
      if (input.expectedBuildVersion !== build.buildVersion) throw new Error('fixture stale build')
      build.buildVersion += 1
      equipped = input.skills.map((skill, index) => ({
        ...skill,
        slotIndex: index + 1,
        equippedAt: timestamp,
      }))
      const essence = resolveEssenceForBuild(kit.primary, kit.secondary)
      const resonance = resolveResonanceForPair(kit.primary, kit.secondary)
      snapshot = {
        schemaVersion: 4,
        buildVersion: build.buildVersion,
        primary: { disciplineId: kit.primary, definitionVersion: 1, profileVersion: 1 },
        secondary: kit.secondary ? { disciplineId: kit.secondary, definitionVersion: 1 } : null,
        disciplineSkills: equipped.map((skill) => ({
          slotIndex: skill.slotIndex,
          skillId: skill.skillId,
          contentVersion: skill.contentVersion,
          sourceDisciplineId: skill.sourceDisciplineId,
        })),
        extensions: {
          essence: essence ? essenceSnapshotReference(essence) : null,
          resonance: resonance ? resonanceSnapshotReference(resonance) : null,
          equipmentSkills: [],
          supernatural: null,
          prestige: null,
        },
      }
      return { buildVersion: build.buildVersion, replayed: false }
    }),
    changeDisciplines: vi.fn(async () => {
      throw new Error('unexpected change')
    }),
    saveSupportAction: vi.fn(async () => {
      throw new Error('unexpected support change')
    }),
  }
  return { character, repository, learned }
}
