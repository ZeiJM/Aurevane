import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  InMemoryCombatContentRepository,
  type CombatContentRepository,
} from '@aurevane/db/combat-content'
import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import type { CombatContentResolver } from '@/server/combat/combat-content-resolver'

import {
  createCombatContentAuthoringService,
  type CombatContentAuthoringStore,
  type MasterPanelOperatorRole,
} from './combat-content-authoring-service'

const OWNER = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'
const OUTSIDER = '33333333-3333-4333-8333-333333333333'

function staticSkill(
  skillId = 'vanguard.forceful-strike',
  version?: number,
): MatureSkillDefinition {
  const definition = resolveMatureSkillVersion(skillId, version)
  if (!definition) throw new Error(`Missing static Skill ${skillId}@${String(version)}.`)
  return structuredClone(definition)
}

class MemoryAuthoringStore implements CombatContentAuthoringStore {
  readonly repository = new InMemoryCombatContentRepository()
  readonly operators = new Map<string, MasterPanelOperatorRole>()

  async getOperatorRole(userId: string): Promise<MasterPanelOperatorRole | null> {
    return this.operators.get(userId) ?? null
  }

  findDraft: CombatContentRepository['findDraft'] = (contentKey) =>
    this.repository.findDraft(contentKey)
  saveDraft: CombatContentRepository['saveDraft'] = (input) => this.repository.saveDraft(input)
  publish: CombatContentRepository['publish'] = (input) => this.repository.publish(input)
  findPublished: CombatContentRepository['findPublished'] = (contentKey) =>
    this.repository.findPublished(contentKey)
  listPublishedVersions: CombatContentRepository['listPublishedVersions'] = (contentKey) =>
    this.repository.listPublishedVersions(contentKey)
  setCurrentPublication: CombatContentRepository['setCurrentPublication'] = (
    contentKey,
    version,
    actorUserId,
  ) => this.repository.setCurrentPublication(contentKey, version, actorUserId)
}

function resolverFor(store: MemoryAuthoringStore): CombatContentResolver {
  return {
    async resolveCurrentSkillDefinition(skillId) {
      const published = await store.findPublished(skillId)
      if (published)
        return structuredClone(published.definition) as unknown as MatureSkillDefinition
      const fallback = resolveMatureSkillVersion(skillId)
      return fallback ? structuredClone(fallback) : null
    },
    async resolvePinnedSkillDefinition(skillId, version) {
      const published = (await store.listPublishedVersions(skillId)).find(
        (candidate) => candidate.contentVersion === version,
      )
      if (published)
        return structuredClone(published.definition) as unknown as MatureSkillDefinition
      const fallback = resolveMatureSkillVersion(skillId, version)
      return fallback ? structuredClone(fallback) : null
    },
  }
}

function serviceFixture() {
  const store = new MemoryAuthoringStore()
  const service = createCombatContentAuthoringService({ store, resolver: resolverFor(store) })
  return { store, service }
}

function invalidVariant(mutator: (definition: Record<string, unknown>) => void): unknown {
  const definition = structuredClone(staticSkill()) as unknown as Record<string, unknown>
  mutator(definition)
  return definition
}

describe('combat content authoring service', () => {
  it('denies users who are not explicit Master Panel operators', async () => {
    const { service } = serviceFixture()

    await expect(
      service.saveSkillDraft({
        actorUserId: OUTSIDER,
        definition: staticSkill(),
        baseVersion: 2,
        expectedDraftVersion: null,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it.each([
    ['owner', OWNER],
    ['content-staff', STAFF],
  ] as const)('allows an explicit %s operator to save a draft', async (role, actorUserId) => {
    const { store, service } = serviceFixture()
    store.operators.set(actorUserId, role)

    const draft = await service.saveSkillDraft({
      actorUserId,
      definition: staticSkill(),
      baseVersion: 2,
      expectedDraftVersion: null,
    })

    expect(draft.contentKey).toBe('vanguard.forceful-strike')
    expect(draft.baseVersion).toBe(2)
    expect(draft.draftVersion).toBe(1)
  })

  it('returns derived presentation tags for a valid Skill definition', () => {
    const { service } = serviceFixture()

    expect(service.validateSkillDefinition(staticSkill())).toEqual({
      valid: true,
      issues: [],
      derivedTags: ['Enemy', 'Single', 'Dmg'],
    })
  })

  it.each([
    [
      'impossible target range',
      (value: Record<string, unknown>) => {
        value.target = { ...(value.target as Record<string, unknown>), maximumRange: -1 }
      },
    ],
    [
      'invalid Push/Pull distance',
      (value: Record<string, unknown>) => {
        value.effects = [
          { type: 'displace', recipient: 'primary-unit', direction: 'push', distance: 0 },
        ]
      },
    ],
    [
      'recovery tick overflow',
      (value: Record<string, unknown>) => {
        value.effects = [{ type: 'healing', recipient: 'primary-unit', amount: 3, ticks: 5 }]
      },
    ],
    [
      'Bleed budget overflow',
      (value: Record<string, unknown>) => {
        value.effects = [{ type: 'bleed', recipient: 'primary-unit', damagePerTick: 6, ticks: 2 }]
      },
    ],
    [
      'invalid Sensory routing',
      (value: Record<string, unknown>) => {
        value.effects = [
          { type: 'sensory', recipient: 'actor', revealedDurationOwnerTurnStarts: 2 },
        ]
      },
    ],
    [
      'invalid Copy targeting',
      (value: Record<string, unknown>) => {
        value.target = {
          kind: 'self',
          teamPolicy: 'self',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'allies-only',
        }
        value.effects = [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' }]
      },
    ],
    [
      'uncapped Vengeance',
      (value: Record<string, unknown>) => {
        value.effects = [
          {
            type: 'damage',
            recipient: 'primary-unit',
            amount: 0,
            vengeance: { conversionBasisPoints: 5000 },
          },
        ]
      },
    ],
    [
      'unknown effect type',
      (value: Record<string, unknown>) => {
        value.effects = [{ type: 'teleport-everyone', recipient: 'primary-unit' }]
      },
    ],
    [
      'manual presentation tags',
      (value: Record<string, unknown>) => {
        value.presentationTags = ['Enemy', 'Single', 'Dmg']
      },
    ],
  ] as const)('rejects %s through the canonical validation boundary', (_label, mutate) => {
    const { service } = serviceFixture()
    const result = service.validateSkillDefinition(invalidVariant(mutate))

    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('rejects nested script-like fields before draft or publish persistence', () => {
    const { service } = serviceFixture()
    const invalid = invalidVariant((value) => {
      value.effects = [
        {
          type: 'damage',
          recipient: 'primary-unit',
          amount: 1,
          script: 'return true',
        },
      ]
    })

    const result = service.validateSkillDefinition(invalid)

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: 'effects[0].script',
        code: 'ARBITRARY_SCRIPT_FIELD',
      }),
    )
  })

  it('authorizes and previews a validated Skill definition without persisting it', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')

    const preview = await service.previewSkillDefinition({
      actorUserId: OWNER,
      definition: staticSkill(),
      seed: 0x4d415354,
    })

    expect(preview).toMatchObject({
      actionId: 'vanguard.forceful-strike',
      legal: true,
      simulation: { seed: 0x4d415354, rngConsumed: false },
    })
    expect(await store.findDraft('vanguard.forceful-strike')).toBeNull()
    expect(await store.findPublished('vanguard.forceful-strike')).toBeNull()
  })

  it('refuses to preview invalid or unauthorized draft content', async () => {
    const { store, service } = serviceFixture()
    const invalid = invalidVariant((value) => {
      value.target = { ...(value.target as Record<string, unknown>), maximumRange: -1 }
    })

    await expect(
      service.previewSkillDefinition({
        actorUserId: OUTSIDER,
        definition: staticSkill(),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    store.operators.set(OWNER, 'owner')
    await expect(
      service.previewSkillDefinition({
        actorUserId: OWNER,
        definition: invalid,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('returns a stable semantic field diff without presentation-only noise', () => {
    const { service } = serviceFixture()
    const before = staticSkill()
    const after = { ...staticSkill(), apCost: 41, nameRef: 'skill.changed.name' }

    expect(service.diffSkillDefinitions(before, after).changedPaths).toEqual(['apCost', 'nameRef'])
  })

  it('publishes the first DB version after the static base and rejects stale republish', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')

    const published = await service.publishSkill({
      actorUserId: OWNER,
      definition: staticSkill(),
      expectedBaseVersion: 2,
    })

    expect(published.contentVersion).toBe(3)
    expect(published.definition).toMatchObject({
      id: 'vanguard.forceful-strike',
      contentVersion: 3,
    })

    await expect(
      service.publishSkill({
        actorUserId: OWNER,
        definition: staticSkill(),
        expectedBaseVersion: 2,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  })

  it('refuses to publish a definition that fails combat validation', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')
    const invalid = invalidVariant((value) => {
      value.effects = [{ type: 'bleed', recipient: 'primary-unit', damagePerTick: 6, ticks: 2 }]
    })

    await expect(
      service.publishSkill({
        actorUserId: OWNER,
        definition: invalid,
        expectedBaseVersion: 2,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(await store.findPublished('vanguard.forceful-strike')).toBeNull()
  })

  it('rolls back to an immutable DB version or clears the pointer back to static fallback', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')

    await service.publishSkill({
      actorUserId: OWNER,
      definition: staticSkill(),
      expectedBaseVersion: 2,
    })
    await service.publishSkill({
      actorUserId: OWNER,
      definition: { ...staticSkill(), apCost: 41 },
      expectedBaseVersion: 3,
    })

    await service.rollbackSkill({
      actorUserId: OWNER,
      skillId: 'vanguard.forceful-strike',
      targetVersion: 3,
    })
    expect((await store.findPublished('vanguard.forceful-strike'))?.contentVersion).toBe(3)

    await service.rollbackSkill({
      actorUserId: OWNER,
      skillId: 'vanguard.forceful-strike',
      targetVersion: 2,
    })
    expect(await store.findPublished('vanguard.forceful-strike')).toBeNull()
    expect(
      (await store.listPublishedVersions('vanguard.forceful-strike')).map(
        (version) => version.contentVersion,
      ),
    ).toEqual([3, 4])
  })
})
