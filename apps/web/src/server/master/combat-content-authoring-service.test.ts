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
import { resolveEssenceForBuild, type EssenceDefinition } from '@aurevane/game-core/combat/essence'
import {
  resolveResonanceForPair,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
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

function staticEssence(version?: number): EssenceDefinition {
  const definition = resolveEssenceForBuild('vanguard', null, version)
  if (!definition) throw new Error(`Missing static Vanguard Essence@${String(version)}.`)
  return structuredClone(definition)
}

function staticResonance(version?: number): AnyResonanceDefinition {
  const definition = resolveResonanceForPair('lifebinder', 'vanguard', version)
  if (!definition)
    throw new Error(`Missing static Lifebinder/Vanguard Resonance@${String(version)}.`)
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
        baseVersion: 3,
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
      baseVersion: 3,
      expectedDraftVersion: null,
    })

    expect(draft.contentKey).toBe('vanguard.forceful-strike')
    expect(draft.baseVersion).toBe(3)
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

  it('validates per-summon lifetimes and reports summon-profile semantic changes', () => {
    const { service } = serviceFixture()
    const base = staticSkill('wildwarden.renewing-herbs')
    if (!base.summonProfile) throw new Error('Expected current Renewing Herbs summon profile.')

    const threeTurn = {
      ...base,
      summonProfile: {
        ...base.summonProfile,
        lifetimeTurns: 3,
      },
    }
    expect(service.validateSkillDefinition(threeTurn)).toMatchObject({
      valid: true,
      issues: [],
      derivedTags: ['Empty Tile', 'Single', 'Summon'],
    })
    expect(service.diffSkillDefinitions(base, threeTurn).changedPaths).toContain(
      'summonProfile.lifetimeTurns',
    )

    const invalid = {
      ...base,
      summonProfile: {
        ...base.summonProfile,
        lifetimeTurns: 0,
      },
    }
    const validation = service.validateSkillDefinition(invalid)
    expect(validation.valid).toBe(false)
    expect(validation.issues).toContainEqual(expect.objectContaining({ path: 'summonProfile' }))

    const editedAbility = {
      ...base,
      summonProfile: {
        ...base.summonProfile,
        abilities: base.summonProfile.abilities.map((ability, index) =>
          index === 0 ? { ...ability, apCost: ability.apCost + 5 } : ability,
        ),
      },
    }
    expect(service.diffSkillDefinitions(base, editedAbility).changedPaths).toContain(
      'summonProfile.abilities',
    )
  })

  it('accepts aligned presentation-only effect descriptions and rejects malformed copy', () => {
    const { service } = serviceFixture()
    const base = staticSkill()
    const valid: MatureSkillDefinition = {
      ...base,
      effectDescriptions: base.effects.map((_, index) =>
        index === 0 ? 'Custom player-facing wording.' : null,
      ),
    }

    expect(service.validateSkillDefinition(valid)).toMatchObject({ valid: true, issues: [] })

    const invalid = {
      ...base,
      effectDescriptions: ['One line.', 'Extra unmatched line.'],
    } as unknown as MatureSkillDefinition
    const result = service.validateSkillDefinition(invalid)

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'effectDescriptions' }))
  })

  it.each([
    ['amplify', 'Amplify'],
    ['curse', 'Curse'],
  ] as const)('validates a publishable %s clone block with derived tags', (mode, label) => {
    const { service } = serviceFixture()
    const base = staticSkill()
    const definition: MatureSkillDefinition = {
      ...base,
      effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode }],
    }

    expect(service.validateSkillDefinition(definition)).toEqual({
      valid: true,
      issues: [],
      derivedTags: ['Enemy', 'Single', label],
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
        value.effects = [{ type: 'bleed', recipient: 'primary-unit', damagePerTick: 21, ticks: 4 }]
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

  it('accepts registered cross-Skill media hooks and rejects arbitrary media identities', () => {
    const { service } = serviceFixture()
    const validBase = staticSkill()
    const valid: MatureSkillDefinition = {
      ...validBase,
      media: {
        ...validBase.media,
        iconKey: 'skill.lifebinder.mend.icon',
        audioCueKey: 'skill.ironfist.breakfall.audio',
      },
    }
    expect(service.validateSkillDefinition(valid)).toMatchObject({ valid: true, issues: [] })

    for (const [field, value] of [
      ['iconKey', 'skill.unregistered.icon'],
      ['audioCueKey', 'skill.unregistered.audio'],
    ] as const) {
      const invalidBase = staticSkill()
      const invalid: MatureSkillDefinition = {
        ...invalidBase,
        media: { ...invalidBase.media, [field]: value },
      }
      expect(service.validateSkillDefinition(invalid)).toMatchObject({
        valid: false,
        issues: [
          expect.objectContaining({
            path: `media.${field}`,
            code: 'UNKNOWN_MEDIA_HOOK',
          }),
        ],
      })
    }
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

    const baseVersion = staticSkill().contentVersion
    const published = await service.publishSkill({
      actorUserId: OWNER,
      definition: staticSkill(),
      expectedBaseVersion: baseVersion,
    })

    expect(published.contentVersion).toBe(baseVersion + 1)
    expect(published.definition).toMatchObject({
      id: 'vanguard.forceful-strike',
      contentVersion: baseVersion + 1,
    })

    await expect(
      service.publishSkill({
        actorUserId: OWNER,
        definition: staticSkill(),
        expectedBaseVersion: baseVersion,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  })

  it('refuses to publish a definition that fails combat validation', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')
    const invalid = invalidVariant((value) => {
      value.effects = [{ type: 'bleed', recipient: 'primary-unit', damagePerTick: 21, ticks: 4 }]
    })

    await expect(
      service.publishSkill({
        actorUserId: OWNER,
        definition: invalid,
        expectedBaseVersion: staticSkill().contentVersion,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(await store.findPublished('vanguard.forceful-strike')).toBeNull()
  })

  it('rolls back to an immutable DB version or clears the pointer back to static fallback', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')

    const baseVersion = staticSkill().contentVersion
    await service.publishSkill({
      actorUserId: OWNER,
      definition: staticSkill(),
      expectedBaseVersion: baseVersion,
    })
    await service.publishSkill({
      actorUserId: OWNER,
      definition: { ...staticSkill(), apCost: 50 },
      expectedBaseVersion: baseVersion + 1,
    })

    await service.rollbackSkill({
      actorUserId: OWNER,
      skillId: 'vanguard.forceful-strike',
      targetVersion: baseVersion + 1,
    })
    expect((await store.findPublished('vanguard.forceful-strike'))?.contentVersion).toBe(
      baseVersion + 1,
    )

    await service.rollbackSkill({
      actorUserId: OWNER,
      skillId: 'vanguard.forceful-strike',
      targetVersion: baseVersion,
    })
    expect(await store.findPublished('vanguard.forceful-strike')).toBeNull()
    expect(
      (await store.listPublishedVersions('vanguard.forceful-strike')).map(
        (version) => version.contentVersion,
      ),
    ).toEqual([baseVersion + 1, baseVersion + 2])
  })

  it('validates and publishes an Essence as one immutable outer+nested Skill version', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')
    const essence = staticEssence()

    expect(service.validateEssenceDefinition(essence)).toMatchObject({ valid: true, issues: [] })

    const published = await service.publishEssence({
      actorUserId: OWNER,
      definition: {
        ...essence,
        flavorLine: 'Stand unbroken and drive the decisive strike through.',
      },
      expectedBaseVersion: essence.contentVersion,
    })

    expect(published.contentKind).toBe('essence')
    expect(published.contentVersion).toBe(essence.contentVersion + 1)
    expect(published.definition).toMatchObject({
      essenceId: essence.essenceId,
      contentVersion: essence.contentVersion + 1,
      skill: { contentVersion: essence.contentVersion + 1 },
    })

    await service.rollbackEssence({
      actorUserId: OWNER,
      essenceId: essence.essenceId,
      sourceDisciplineId: essence.sourceDisciplineId,
      targetVersion: essence.contentVersion,
    })
    expect(await store.findPublished(essence.essenceId)).toBeNull()
  })

  it('validates shared narration tokens and rejects unknown or malformed templates before publishing', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')
    const valid =
      '{actor} steadies {actor.possessive} hand; {actor.gender:he|she|they} faces {target}.'
    expect(service.validateSkillDefinition({ ...staticSkill(), flavorLine: valid }).valid).toBe(
      true,
    )
    expect(service.validateEssenceDefinition({ ...staticEssence(), flavorLine: valid }).valid).toBe(
      true,
    )
    expect(
      service.validateResonanceDefinition({ ...staticResonance(), flavorLine: valid }).valid,
    ).toBe(true)
    for (const flavorLine of ['{private_build}', '{actor.gender:he|she}', 'Broken {actor']) {
      expect(service.validateSkillDefinition({ ...staticSkill(), flavorLine }).valid).toBe(false)
      expect(service.validateEssenceDefinition({ ...staticEssence(), flavorLine }).valid).toBe(
        false,
      )
      expect(service.validateResonanceDefinition({ ...staticResonance(), flavorLine }).valid).toBe(
        false,
      )
    }
    await expect(
      service.publishSkill({
        actorUserId: OWNER,
        definition: { ...staticSkill(), flavorLine: '{private_build}' },
        expectedBaseVersion: staticSkill().contentVersion,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(await store.findPublished(staticSkill().id)).toBeNull()
  })

  it('validates, publishes, and rolls back Resonance content without mutating history', async () => {
    const { store, service } = serviceFixture()
    store.operators.set(OWNER, 'owner')
    const resonance = staticResonance()

    expect(service.validateResonanceDefinition(resonance)).toMatchObject({
      valid: true,
      issues: [],
    })

    const first = await service.publishResonance({
      actorUserId: OWNER,
      definition: {
        ...resonance,
        flavorLine: 'Mercy opens the line; the blade answers before it closes.',
      },
      expectedBaseVersion: resonance.contentVersion,
    })
    const second = await service.publishResonance({
      actorUserId: OWNER,
      definition: {
        ...resonance,
        flavorLine: 'Restore the opening, then turn it into a Vanguard finishing lane.',
      },
      expectedBaseVersion: first.contentVersion,
    })

    expect(first.contentKind).toBe('resonance')
    expect(second.contentVersion).toBe(first.contentVersion + 1)

    await service.rollbackResonance({
      actorUserId: OWNER,
      resonanceId: resonance.id,
      disciplinePair: resonance.disciplinePair,
      targetVersion: first.contentVersion,
    })
    expect((await store.findPublished(resonance.id))?.contentVersion).toBe(first.contentVersion)
    expect(
      (await store.listPublishedVersions(resonance.id)).map((row) => row.contentVersion),
    ).toEqual([first.contentVersion, second.contentVersion])
  })
})

describe('Combat v5.1 Master authoring bounds', () => {
  it('rejects current range and elevation overflow through the canonical service boundary', () => {
    const { service } = serviceFixture()
    const base = staticSkill()

    const range = service.validateSkillDefinition({
      ...base,
      target: { ...base.target, maximumRange: 6 },
    })
    expect(range.valid).toBe(false)
    expect(range.issues).toContainEqual(expect.objectContaining({ path: 'target.maximumRange' }))

    const elevation = service.validateSkillDefinition({
      ...base,
      target: { ...base.target, maximumElevationDifference: 3 },
    })
    expect(elevation.valid).toBe(false)
    expect(elevation.issues).toContainEqual(
      expect.objectContaining({ path: 'target.maximumElevationDifference' }),
    )
  })
})
