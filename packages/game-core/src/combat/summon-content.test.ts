import { prePercentageRecoverySkill } from './percentage-recovery-history.test-utils'
import { describe, expect, it } from 'vitest'

import { calculateDerivedStats, DERIVED_STAT_RULESET_V5 } from '../character/derived-stats'
import { validateCombatTagPayload } from './combat-tag-registry'
import type { MatureSkillDefinition } from './mature-skills'
import { resolveMatureSkillVersion, validateMatureSkillDefinition } from './mature-skills'
import {
  SUMMON_PROFILE_SCHEMA_VERSION,
  DEFAULT_SUMMON_CORE_ATTRIBUTES,
  withCurrentSummonCoreAttributes,
  validateSummonProfileDefinition,
  type SummonProfileDefinition,
} from './summon-content'

function ability(id: string): SummonProfileDefinition['abilities'][number] {
  return {
    id,
    name: id.endsWith('mend') ? 'Verdant Mend' : 'Thorn Rake',
    description: id.endsWith('mend')
      ? 'Restore an injured ally.'
      : 'Strike a nearby enemy with thorned claws.',
    apCost: 45,
    mpCost: 0,
    tags: id.endsWith('mend') ? ['heal', 'support'] : ['attack', 'melee'],
    target: {
      kind: 'unit',
      teamPolicy: id.endsWith('mend') ? 'ally' : 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 2,
      requiresLineOfSight: true,
      maximumElevationDifference: 0,
      friendlyFire: id.endsWith('mend') ? 'allies-only' : 'enemies-only',
    },
    requirements: [],
    effects: id.endsWith('mend')
      ? [{ type: 'healing', recipient: 'primary-unit', amount: 4, durationTurns: 0 }]
      : [{ type: 'damage', recipient: 'primary-unit', amount: 5, durationTurns: 0 }],
    ai: {
      baseUtility: id.endsWith('mend') ? 64 : 70,
      purposeTags: id.endsWith('mend') ? ['heal', 'support'] : ['damage', 'pressure'],
    },
    media: {
      iconKey: `summon-ability.${id}.icon`,
      audioCueKey: null,
      vfxKey: null,
    },
  }
}

function profile(overrides: Partial<SummonProfileDefinition> = {}): SummonProfileDefinition {
  return {
    schemaVersion: SUMMON_PROFILE_SCHEMA_VERSION,
    id: 'summon.wildwarden.verdant-stalker',
    name: 'Verdant Stalker',
    description: 'A temporary woodland hunter that fights beside the summoner.',
    flavorLine: 'Roots twist into a watchful hunter at your side.',
    portraitKey: 'summon.wildwarden.verdant-stalker.portrait',
    tags: ['summon', 'beast', 'verdant'],
    maxHp: 36,
    maxMp: 12,
    initiative: 28,
    movementBudget: 5,
    stats: {
      accuracy: 6800,
      evasion: 1200,
      armor: 8,
      ward: 6,
      jump: 1,
      physicalPower: 24,
      mysticPower: 18,
    },
    aiProfile: 'standard',
    aiPurposeTags: ['damage', 'support'],
    lifetimeTurns: 5,
    abilities: [
      ability('wildwarden.verdant-stalker.thorn-rake'),
      ability('wildwarden.verdant-stalker.verdant-mend'),
    ],
    ...overrides,
  }
}

describe('Combat v5.1 summon content', () => {
  it('accepts absent or boolean neverMoves and rejects malformed values', () => {
    expect(validateSummonProfileDefinition(profile())).toEqual([])
    expect(validateSummonProfileDefinition(profile({ neverMoves: true }))).toEqual([])
    expect(validateSummonProfileDefinition(profile({ neverMoves: false }))).toEqual([])
    expect(
      validateSummonProfileDefinition(profile({ neverMoves: 'true' as unknown as boolean })),
    ).toContain('neverMoves')
  })

  it('accepts a five-turn summon profile with one or two authored abilities', () => {
    expect(validateSummonProfileDefinition(profile())).toEqual([])
    expect(
      validateSummonProfileDefinition(
        profile({ abilities: [ability('wildwarden.verdant-stalker.thorn-rake')] }),
      ),
    ).toEqual([])
  })

  it('rejects zero or more than two authored abilities', () => {
    expect(validateSummonProfileDefinition(profile({ abilities: [] }))).toContain('abilities')
    expect(
      validateSummonProfileDefinition(
        profile({
          abilities: [
            ability('wildwarden.verdant-stalker.thorn-rake'),
            ability('wildwarden.verdant-stalker.verdant-mend'),
            ability('wildwarden.verdant-stalker.third'),
          ],
        }),
      ),
    ).toContain('abilities')
  })

  it('allows each summon to author its own positive lifetime while keeping five turns as the standard', () => {
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 5 }))).toEqual([])
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 3 }))).toEqual([])
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 8 }))).toEqual([])
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 0 }))).toContain(
      'lifetimeTurns',
    )
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: -1 }))).toContain(
      'lifetimeTurns',
    )
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 2.5 }))).toContain(
      'lifetimeTurns',
    )
  })

  it('keeps real Summon while removing historical Renewing Herbs protection', () => {
    const currentDefinition = prePercentageRecoverySkill('wildwarden.renewing-herbs')
    if (!currentDefinition) throw new Error('Expected current Renewing Herbs.')
    const historical = resolveMatureSkillVersion(
      'wildwarden.renewing-herbs',
      currentDefinition.contentVersion - 1,
    )
    if (!historical) throw new Error('Expected historical Renewing Herbs.')

    expect(currentDefinition.authoring.validationTags).toContain('owner-rebalance-v5-1')
    expect(currentDefinition.target.kind).toBe('empty-tile')
    expect(currentDefinition.effects).toEqual([
      expect.objectContaining({ type: 'summon', recipient: 'selected-tile' }),
    ])
    expect(currentDefinition.summonProfile).toMatchObject({
      name: 'Verdant Stalker',
      lifetimeTurns: 5,
    })
    expect(currentDefinition.summonProfile?.abilities).toHaveLength(2)

    expect(historical.summonProfile).toBeUndefined()
    expect(historical.effects).not.toContainEqual(
      expect.objectContaining({ type: 'apply-status', statusId: 'summoned' }),
    )
    expect(historical.effects).toContainEqual(expect.objectContaining({ type: 'healing' }))
  })

  it('requires summon effects and profiles to appear together on empty-ground Skills', () => {
    const base = resolveMatureSkillVersion('wildwarden.renewing-herbs')
    if (!base) throw new Error('Expected current Renewing Herbs.')

    const summonEffect = {
      type: 'summon',
      recipient: 'selected-tile',
      durationTurns: 0,
    } as const

    const valid = {
      ...base,
      target: {
        ...base.target,
        kind: 'empty-tile',
        teamPolicy: 'ally',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: true,
        maximumElevationDifference: 0,
        friendlyFire: 'allies-only',
      },
      effects: [summonEffect],
      summonProfile: profile(),
    } as unknown as MatureSkillDefinition

    expect(validateMatureSkillDefinition(valid)).toEqual([])

    expect(
      validateMatureSkillDefinition({
        ...valid,
        summonProfile: undefined,
      } as unknown as MatureSkillDefinition),
    ).toContain('summonProfile')

    expect(
      validateMatureSkillDefinition({
        ...valid,
        effects: [{ type: 'healing', recipient: 'actor', amount: 4, durationTurns: 0 }],
      } as unknown as MatureSkillDefinition),
    ).toContain('summonProfile')

    expect(
      validateMatureSkillDefinition({
        ...valid,
        target: { ...valid.target, kind: 'ground-tile' },
      } as unknown as MatureSkillDefinition),
    ).toContain('target.kind')
  })
})

describe('Core-authored summon snapshots', () => {
  it('derives every combat stat through the shared current character formulas and preserves hidden metadata', () => {
    const legacy = profile()
    const before = JSON.stringify(legacy)
    const core = { might: 12, finesse: 30, vitality: 40, agility: 60, intellect: 50, resolve: 20 }
    const current = withCurrentSummonCoreAttributes(legacy, core)
    const expected = calculateDerivedStats(
      { level: 1, attributes: core },
      DERIVED_STAT_RULESET_V5,
    ).stats
    expect(current).toMatchObject({
      coreAttributes: core,
      derivedStatRulesVersion: 5,
      maxHp: expected.maxHp.value,
      maxMp: expected.maxMp.value,
      initiative: expected.initiative.value,
      movementBudget: expected.movement.value,
      stats: {
        accuracy: expected.accuracy.value,
        evasion: expected.evasion.value,
        armor: expected.armor.value,
        ward: expected.ward.value,
        jump: expected.jump.value,
        physicalPower: expected.physicalPower.value,
        mysticPower: expected.mysticPower.value,
        criticalChance: expected.criticalChance.value,
        statusResistance: expected.statusResistance.value,
      },
      portraitKey: legacy.portraitKey,
      tags: legacy.tags,
      aiProfile: legacy.aiProfile,
      aiPurposeTags: legacy.aiPurposeTags,
      abilities: legacy.abilities,
    })
    core.vitality = 1
    expect(current.coreAttributes?.vitality).toBe(40)
    expect(JSON.stringify(legacy)).toBe(before)
    expect(validateSummonProfileDefinition(current)).toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'summon',
        recipient: 'selected-tile',
        profile: JSON.parse(JSON.stringify(current)),
      }),
    ).toEqual([])
  })

  it('keeps legacy captures literal and converts only through the explicit helper', () => {
    const legacy = profile()
    expect(validateSummonProfileDefinition(legacy)).toEqual([])
    expect(legacy).not.toHaveProperty('coreAttributes')
    const converted = withCurrentSummonCoreAttributes(legacy)
    expect(converted.coreAttributes).toEqual(DEFAULT_SUMMON_CORE_ATTRIBUTES)
    expect(converted.maxHp).not.toBe(legacy.maxHp)
    expect(withCurrentSummonCoreAttributes(converted)).toEqual(converted)
  })

  it('rejects incomplete, invalid or mismatched Core captures', () => {
    const current = withCurrentSummonCoreAttributes(profile())
    expect(validateSummonProfileDefinition({ ...current, maxHp: current.maxHp + 1 })).toContain(
      'maxHp',
    )
    expect(
      validateSummonProfileDefinition({ ...current, derivedStatRulesVersion: undefined }),
    ).toContain('derivedStatRulesVersion')
    expect(validateSummonProfileDefinition({ ...current, coreAttributes: undefined })).toContain(
      'coreAttributes',
    )
    expect(() =>
      withCurrentSummonCoreAttributes(profile(), { ...DEFAULT_SUMMON_CORE_ATTRIBUTES, might: 61 }),
    ).toThrow(/might/)
    expect(() =>
      withCurrentSummonCoreAttributes(profile(), { ...DEFAULT_SUMMON_CORE_ATTRIBUTES, resolve: 0 }),
    ).toThrow(/resolve/)
    expect(
      validateSummonProfileDefinition({
        ...current,
        coreAttributes: { ...current.coreAttributes!, might: 1.5 },
      }),
    ).toContain('coreAttributes')
    const extraCore = { ...current, coreAttributes: { ...current.coreAttributes!, script: 1 } }
    expect(
      validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile: extraCore }),
    ).not.toEqual([])
  })

  it('accepts optional nonnegative HP costs and rejects invalid costs', () => {
    for (const hpCost of [undefined, 0, 35, 1000]) {
      const authored = profile({
        abilities: [{ ...ability('test.strike'), ...(hpCost === undefined ? {} : { hpCost }) }],
      })
      expect(validateSummonProfileDefinition(authored)).toEqual([])
      expect(
        validateCombatTagPayload({ type: 'summon', recipient: 'selected-tile', profile: authored }),
      ).toEqual([])
    }
    for (const hpCost of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        validateSummonProfileDefinition(
          profile({ abilities: [{ ...ability('test.strike'), hpCost }] }),
        ),
      ).toContain('abilities')
    }
  })
})
