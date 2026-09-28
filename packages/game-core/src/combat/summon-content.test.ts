import { describe, expect, it } from 'vitest'

import type { MatureSkillDefinition } from './mature-skills'
import { resolveMatureSkillVersion, validateMatureSkillDefinition } from './mature-skills'
import {
  SUMMON_PROFILE_SCHEMA_VERSION,
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

  it('requires the current summon lifetime to be exactly five turns', () => {
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 4 }))).toContain(
      'lifetimeTurns',
    )
    expect(validateSummonProfileDefinition(profile({ lifetimeTurns: 6 }))).toContain(
      'lifetimeTurns',
    )
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
