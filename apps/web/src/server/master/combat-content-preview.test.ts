import { describe, expect, it } from 'vitest'

import {
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import { previewCombatContentDefinition } from './combat-content-preview'

const PREVIEW_SEED = 0x4d415354

function baseSkill(): MatureSkillDefinition {
  const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
  if (!definition) throw new Error('Expected Forceful Strike v2 fixture.')
  return structuredClone(definition)
}

function withEffects(
  effects: MatureSkillDefinition['effects'],
  extras: Partial<MatureSkillDefinition> = {},
): MatureSkillDefinition {
  return {
    ...baseSkill(),
    ...extras,
    id: extras.id ?? 'master.preview.skill',
    enabled: true,
    effects,
    overrides: {},
  }
}

describe('Master Panel combat content preview', () => {
  it('uses a deterministic isolated fixture and projects canonical targeting, tags, AP and MP', () => {
    const definition = baseSkill()
    const first = previewCombatContentDefinition(definition, { seed: PREVIEW_SEED })
    const second = previewCombatContentDefinition(definition, { seed: PREVIEW_SEED })

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      actionId: definition.id,
      contentVersion: definition.contentVersion,
      legal: true,
      simulation: {
        seed: PREVIEW_SEED,
        actorCombatantId: 'master-preview-actor',
        rngConsumed: false,
      },
      targeting: {
        target: definition.target,
        selection: { kind: 'unit', combatantId: 'master-preview-enemy' },
      },
      costs: {
        actionEconomy: definition.apCost,
        mp: definition.mpCost ?? 0,
        actionEconomyBefore: 100,
        actionEconomyAfter: 100 - definition.apCost,
      },
    })
    expect(first.derivedTags).toEqual(expect.arrayContaining(['Enemy', 'Single']))
    expect(first.projections.effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ effectType: 'damage' })]),
    )
  })

  it('reports authoritative per-target hit chance without consuming a random result', () => {
    const definition: MatureSkillDefinition = {
      ...baseSkill(),
      id: 'master.preview.accuracy',
      accuracyMode: 'per-target',
      accuracyModifierBasisPoints: 0,
      overrides: {},
    }

    const preview = previewCombatContentDefinition(definition, { seed: PREVIEW_SEED })

    expect(preview.accuracy).toMatchObject({
      projectionsAssumeHits: true,
      targetHitChances: [
        {
          targetCombatantId: 'master-preview-enemy',
          hitChanceBasisPoints: expect.any(Number),
        },
      ],
    })
    expect(preview.simulation.rngConsumed).toBe(false)
    expect(JSON.stringify(preview)).not.toContain('rollBasisPoints')
  })

  it('projects current DoT and scheduled recovery effects through the shared combat evaluator', () => {
    const definition = withEffects(
      [
        { type: 'poison', recipient: 'primary-unit' },
        { type: 'bleed', recipient: 'primary-unit', damagePerTick: 2, ticks: 2 },
        { type: 'burn', recipient: 'primary-unit' },
        { type: 'healing', recipient: 'actor', amount: 5, ticks: 3 },
        { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 4, ticks: 2 },
      ],
      { id: 'master.preview.persistence', mpCost: 2 },
    )

    const preview = previewCombatContentDefinition(definition, { seed: PREVIEW_SEED })
    const effectTypes = preview.projections.effects.map((effect) => effect.effectType)

    for (const effectType of ['poison', 'bleed', 'burn', 'healing', 'resource-change']) {
      expect(effectTypes).toContain(effectType)
    }
    expect(preview.projections.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'recovery_scheduled',
          targetCombatantId: 'master-preview-actor',
          resource: 'hp',
          remainingFutureTicks: 2,
        }),
        expect.objectContaining({
          event: 'recovery_scheduled',
          targetCombatantId: 'master-preview-actor',
          resource: 'mp',
          remainingFutureTicks: 1,
        }),
      ]),
    )
  })

  it('projects displacement geometry and a bounded Vengeance basis from the same fixture snapshot', () => {
    const displacement = previewCombatContentDefinition(
      withEffects(
        [
          {
            type: 'displace',
            recipient: 'primary-unit',
            direction: 'push',
            distance: 1,
          },
        ],
        { id: 'master.preview.push' },
      ),
      { seed: PREVIEW_SEED },
    )

    expect(displacement.projections.effects).toContainEqual(
      expect.objectContaining({
        effectType: 'displace',
        combatantId: 'master-preview-enemy',
        before: '3,1',
        after: '4,1',
      }),
    )

    const vengeance = previewCombatContentDefinition(
      withEffects(
        [
          {
            type: 'damage',
            recipient: 'primary-unit',
            amount: 0,
            vengeance: { conversionBasisPoints: 5_000, maximumDamage: 80 },
          },
        ],
        { id: 'master.preview.vengeance' },
      ),
      { seed: PREVIEW_SEED },
    )

    expect(vengeance.vengeanceBasis).toEqual([
      expect.objectContaining({
        sourceCombatantId: 'master-preview-actor',
        windowStartRound: 2,
        windowEndRound: 4,
        rawDamage: 20,
        damageByRound: [
          { round: 2, amount: 8 },
          { round: 3, amount: 12 },
          { round: 4, amount: 20 },
        ],
      }),
    ])
    expect(vengeance.projections.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount: 19 }),
    )
  })

  it('describes Sensory only as a conditional rule and never exposes whether Covert is present', () => {
    const definition = withEffects(
      [
        {
          type: 'sensory',
          recipient: 'primary-unit',
          revealedDurationOwnerTurnStarts: 3,
        },
        { type: 'damage', recipient: 'primary-unit', amount: 4 },
      ],
      { id: 'master.preview.sensory' },
    )

    const preview = previewCombatContentDefinition(definition, { seed: PREVIEW_SEED })

    expect(preview.conditionalEffects).toEqual([
      {
        type: 'sensory',
        condition: 'target-is-covert',
        revealedDurationOwnerTurnStarts: 3,
        description: 'If the target is Covert: purge eligible positive buffs and apply Revealed 3.',
      },
    ])
    expect(JSON.stringify(preview)).not.toContain('conditionMet')
    expect(JSON.stringify(preview)).not.toContain('covertPresent')
    expect(preview.simulation.rngConsumed).toBe(false)
  })
})
