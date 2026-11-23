import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { validateCombatTagPayload, equipmentArmorAfterPierce } from './combat-tag-registry'
import { synchronizeCombatInitiative } from './actions-legacy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { resolveMatureSkillVersion, validateMatureSkillDefinition } from './mature-skills'
import { validateSummonProfileDefinition } from './summon-content'
import { selectCurrentFinalFacing } from './board'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import { applyCurrentBurnState, advanceCurrentBurnEndTurn } from './combat-dots'
import { parsePercentageBasisPoints, percentageBasisPointsText } from './combat-percentage-dots'

function action(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.percent999',
    version: 1,
    sourceType: 'test',
    tags: [],
    requirements: [],
    cost: { spendsAction: false, mp: 0 },
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    effects,
    effectTimingModes: effects.map(() => 'instant'),
  }
}
function encounter(): CombatEncounterState {
  return { ...percentageDotEncounter(), effectTimingPolicy: { version: 1, modes: {} } }
}
function cast(
  state: CombatEncounterState,
  effects: readonly CombatEffectDefinition[],
  target = 'enemy',
) {
  return executeCombatAction(
    state,
    action(effects),
    { kind: 'unit', combatantId: target },
    PV1F_COMBAT_CONTENT,
  ).state
}
const hp = (state: CombatEncounterState, id = 'enemy') =>
  state.tactical.battle.combatants.find((unit) => unit.id === id)!.hp
function reload(state: CombatEncounterState) {
  const restored = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  expect(validateCombatEncounterState(restored)).toEqual([])
  return restored
}

describe('999 percent effect potency', () => {
  it.each([
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'inspired',
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints: 99900,
    },
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'warded',
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints: 99900,
    },
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'conductive',
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints: 99900,
    },
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'suppress',
      stacks: 1,
      durationTurns: 2,
      potencyBasisPoints: 99900,
    },
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'wet',
      stacks: 1,
      durationTurns: 2,
      initiativeReductionBasisPoints: 99900,
    },
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'fortified',
      stacks: 1,
      durationTurns: 2,
      defenseIncreaseBasisPoints: 99900,
    },
    {
      type: 'percentage-recovery',
      recipient: 'actor',
      resource: 'hp',
      percentageBasisPoints: 99900,
      ticks: 2,
      durationTurns: 1,
    },
    {
      type: 'resource-change',
      recipient: 'primary-unit',
      resource: 'mp',
      basis: 'maximum-mp-percent',
      delta: -999,
      ticks: 1,
    },
    {
      type: 'barrier-change',
      recipient: 'actor',
      basis: 'maximum-hp-percent',
      amount: 999,
      durationTurns: 2,
    },
    {
      type: 'burn',
      recipient: 'primary-unit',
      damageProfile: {
        kind: 'attack-percentage',
        basisPoints: 99900,
        decayBasisPointsPerTick: 49900,
      },
      durationTurns: 2,
      backlashBasisPoints: 99900,
    },
    { type: 'pierce', recipient: 'primary-unit', amount: 10, armorIgnoredBasisPoints: 99900 },
    { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 109900 },
    {
      type: 'damage',
      recipient: 'primary-unit',
      amount: 10,
      facingModifiersBasisPoints: { front: 10000, side: 99900, rear: 99900 },
    },
  ])('accepts maximum authorable potency through canonical validation: %j', (payload) => {
    expect(validateCombatTagPayload(payload)).toEqual([])
  })

  it('accepts999 in mature native percentage Barrier and Drain definitions without widening ordinary Power', () => {
    const barrier = resolveMatureSkillVersion('lifebinder.barrier')!
    expect(validateMatureSkillDefinition(barrier)).toEqual([])
    expect(
      validateMatureSkillDefinition({
        ...barrier,
        effects: barrier.effects.map((effect) =>
          effect.type === 'barrier-change'
            ? { ...effect, basis: 'maximum-hp-percent', amount: 999 }
            : effect,
        ),
      }),
    ).toEqual([])
    const drain = resolveMatureSkillVersion('vanguard.forceful-strike')!
    expect(
      validateMatureSkillDefinition({
        ...drain,
        effects: [
          {
            type: 'resource-change',
            recipient: 'primary-unit',
            resource: 'mp',
            basis: 'maximum-mp-percent',
            delta: -999,
            ticks: 1,
            durationTurns: 0,
          },
        ],
      }),
    ).toEqual([])
    const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
    expect(validateSummonProfileDefinition({ ...profile, potencyBasisPoints: 99900 })).toEqual([])
    expect(validateSummonProfileDefinition({ ...profile, potencyBasisPoints: 100000 })).toEqual([])
    for (const potencyBasisPoints of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(validateSummonProfileDefinition({ ...profile, potencyBasisPoints })).toContain(
        'potencyBasisPoints',
      )
  })

  it('accepts Mark and Blind999 modifiers while actual hit probability stays within zero and100%', () => {
    const mark = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === 'mark')!
    expect(() =>
      validateCombatStatusDefinition({ ...mark, markAccuracyBonusBasisPoints: 99900 }),
    ).not.toThrow()
    const blind = {
      ...mark,
      id: 'test.blind',
      markAccuracyBonusBasisPoints: undefined,
      blindAccuracyPenaltyBasisPoints: 99900,
    }
    expect(() => validateCombatStatusDefinition(blind)).not.toThrow()
    const content = { statuses: [...PV1F_COMBAT_CONTENT.statuses, blind] }
    let state = cast(encounter(), [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'mark',
        stacks: 1,
        potencyBasisPoints: 99900,
        durationTurns: 2,
      },
    ])
    const attack = {
      ...action([{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 }]),
      accuracyMode: 'per-target' as const,
    }
    expect(
      evaluateCombatAction(state, attack, { kind: 'unit', combatantId: 'enemy' }, content)
        .targetHitChances?.[0]?.hitChanceBasisPoints,
    ).toBe(10000)
    state = executeCombatAction(
      state,
      action([
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId: blind.id,
          stacks: 1,
          potencyBasisPoints: 99900,
          durationTurns: 2,
        },
      ]),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    ).state
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'enemy' ? { ...row, statuses: [] } : row,
    )
    expect(
      evaluateCombatAction(state, attack, { kind: 'unit', combatantId: 'enemy' }, content)
        .targetHitChances?.[0]?.hitChanceBasisPoints,
    ).toBe(0)
  })

  it('releases Endure999 from real captured incoming HP damage', () => {
    let state = cast(encounter(), [
      {
        type: 'endure',
        recipient: 'actor',
        durationTurns: 1,
        releaseBasisPoints: 99900,
        radiusTiles: 3,
        targetTeams: 'enemies',
      },
    ])
    const finish = () => {
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        PV1F_COMBAT_CONTENT,
      ).state
    }
    finish()
    state = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 20 }], 'actor')
    while (state.tactical.battle.currentTurn?.combatantId !== 'actor') finish()
    finish()
    expect(hp(state, 'actor')).toBe(980)
    expect(hp(state)).toBe(801)
    expect(hp(state, 'other')).toBe(801)
    reload(state)
  })

  it('applies and restores Damage Up999 before actual damage settlement', () => {
    let state = cast(encounter(), [
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        durationTurns: 2,
        potencyBasisPoints: 99900,
      },
    ])
    state = reload(state)
    state = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 10 }])
    expect(hp(state)).toBe(891)
  })

  it('floors Ward999 reduction at zero instead of healing the enemy', () => {
    let state = applyCurrentBurnState(encounter(), 'enemy', 'actor', 'test.burn', undefined, 1, 2)
    state = cast(state, [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'warded',
        stacks: 1,
        durationTurns: 2,
        potencyBasisPoints: 99900,
      },
    ])
    state = reload(cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 10 }]))
    expect(hp(state)).toBe(1000)
  })

  it('uses Conductive999 in Storm damage and preserves the authored status through reload', () => {
    let state = { ...encounter(), elementalDamagePolicyVersion: 2 as const }
    state = cast(state, [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'conductive',
        stacks: 1,
        durationTurns: 2,
        potencyBasisPoints: 99900,
      },
    ]) as typeof state
    state = reload(
      cast(reload(state), [
        { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'storm' },
      ]),
    ) as typeof state
    expect(hp(state)).toBe(891)
  })

  it('keeps Drenched999 Storm potency distinct from its999 initiative reduction after reload', () => {
    let state: CombatEncounterState = {
      ...encounter(),
      elementalDamagePolicyVersion: 2,
      dynamicInitiativePolicyVersion: 1,
    }
    state = reload(
      cast(state, [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'wet',
          stacks: 1,
          durationTurns: 2,
          potencyBasisPoints: 99900,
          initiativeReductionBasisPoints: 99900,
        },
      ]),
    )
    state = synchronizeCombatInitiative(state)
    expect(
      state.tactical.battle.activeInitiativeModifiers?.find((row) => row.combatantId === 'enemy')
        ?.amount,
    ).toBe(-30)
    state = reload(
      cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 10, element: 'storm' }]),
    )
    expect(hp(state)).toBe(891)
    expect(
      state.statusState
        .find((row) => row.combatantId === 'enemy')
        ?.statuses.find((row) => row.statusId === 'wet')?.potencyBasisPoints,
    ).toBe(99900)
  })

  it('uses999% authored facing and floors999% Pierce armor removal at zero', () => {
    let state = encounter()
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((row) =>
          row.combatantId === 'enemy' ? { ...row, facing: 'east' as const } : row,
        ),
      },
    }
    state = reload(
      cast(state, [
        {
          type: 'damage',
          recipient: 'primary-unit',
          amount: 10,
          facingModifiersBasisPoints: { front: 10000, side: 99900, rear: 99900 },
        },
      ]),
    )
    expect(hp(state)).toBe(901)
    expect(equipmentArmorAfterPierce({ equipmentArmor: 40 }, 99900)).toBe(0)
  })

  it('settles999% Burn backlash from the actual damage dealt by its bearer', () => {
    let state = applyCurrentBurnState(
      { ...encounter(), dotTriggerPolicyVersion: 2 },
      'enemy',
      'actor',
      'test.burn-backlash999',
      true,
      undefined,
      2,
      { capturedDamage: 10, profile: { kind: 'attack-percentage', basisPoints: 1000 } },
      99900,
    )
    state = reload(cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 10 }]))
    expect(hp(state)).toBe(990)
    expect(hp(state, 'actor')).toBe(901)
  })

  it('applies999% scheduled Burn to HP across real turn endings and reloads', () => {
    let state = applyCurrentBurnState(
      encounter(),
      'actor',
      'enemy',
      'test.burn-ticks999',
      true,
      undefined,
      2,
      {
        capturedDamage: 10,
        profile: { kind: 'attack-percentage', basisPoints: 99900, decayBasisPointsPerTick: 49900 },
      },
    )
    const finish = () => {
      state = reload(
        endCombatTurn(
          { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
          PV1F_COMBAT_CONTENT,
        ).state,
      )
    }
    while (state.tactical.battle.currentTurn?.combatantId !== 'enemy') finish()
    finish()
    expect(hp(state)).toBe(901)
    while (state.tactical.battle.currentTurn?.combatantId !== 'enemy') finish()
    finish()
    expect(hp(state)).toBe(851)
    expect(state.effectState?.burn).toEqual([])
  })

  it('stores recovery999 while capping actual HP and MP and flooring Drain at zero', () => {
    let state = encounter()
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? { ...unit, hp: 1, mp: 1 } : unit,
          ),
        },
      },
    }
    state = reload(
      cast(state, [
        {
          type: 'percentage-recovery',
          recipient: 'actor',
          resource: 'hp',
          percent: 999,
          ticks: 2,
          durationTurns: 1,
        },
        {
          type: 'percentage-recovery',
          recipient: 'actor',
          resource: 'mp',
          percent: 999,
          ticks: 2,
          durationTurns: 1,
        },
        {
          type: 'resource-change',
          recipient: 'primary-unit',
          resource: 'mp',
          basis: 'maximum-mp-percent',
          delta: -999,
          ticks: 1,
        },
      ]),
    )
    expect(hp(state, 'actor')).toBe(1000)
    expect(state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(20)
    expect(state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(0)
    expect(
      state.effectState?.ongoingRecovery.map((row) => row.percentageRecovery?.percent),
    ).toEqual([999, 999])
  })

  it.each(['suppress', 'hexed', 'fortified'])(
    'keeps %s999 reductions nonnegative at actual settlement',
    (statusId) => {
      let state = cast(encounter(), [
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId,
          stacks: 1,
          durationTurns: 2,
          ...(statusId === 'fortified'
            ? { defenseIncreaseBasisPoints: 99900 }
            : { potencyBasisPoints: 99900 }),
        },
      ])
      if (statusId === 'hexed') {
        state = {
          ...state,
          healingDownPolicyVersion: 1,
          tactical: {
            ...state.tactical,
            battle: {
              ...state.tactical.battle,
              combatants: state.tactical.battle.combatants.map((unit) =>
                unit.id === 'actor' ? { ...unit, hp: 500, mp: 1 } : unit,
              ),
            },
          },
        }
        state = reload(
          cast(state, [
            {
              type: 'percentage-recovery',
              recipient: 'actor',
              resource: 'hp',
              percent: 999,
              ticks: 1,
            },
            {
              type: 'percentage-recovery',
              recipient: 'actor',
              resource: 'mp',
              percent: 999,
              ticks: 1,
            },
          ]),
        )
        expect(hp(state, 'actor')).toBe(500)
        expect(state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(1)
      } else {
        state = reload(cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 10 }]))
        expect(hp(state)).toBe(1000)
      }
    },
  )

  it('returns Reflect999 from captured actual damage while preserving HP floors', () => {
    let state = cast(encounter(), [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'counter',
        stacks: 1,
        durationTurns: 2,
        counter: { kind: 'full', basisPoints: 99900 },
      },
    ])
    state = reload(cast(reload(state), [{ type: 'damage', recipient: 'primary-unit', amount: 10 }]))
    expect(hp(state)).toBe(990)
    expect(hp(state, 'actor')).toBe(901)
  })

  it('uses Ruin999 per actual target debuff', () => {
    let state = cast(encounter(), [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'root',
        stacks: 1,
        durationTurns: 2,
      },
    ])
    state = reload(
      cast(state, [
        { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 99900 },
        { type: 'damage', recipient: 'primary-unit', amount: 10 },
      ]),
    )
    expect(hp(state)).toBe(891)
  })

  it.each([
    {
      resource: 'hp' as const,
      rate: 99900,
      potencyBasisPoints: undefined,
      expectedHp: 589,
      expectedMp: 0,
    },
    {
      resource: 'mp' as const,
      rate: 99900,
      potencyBasisPoints: undefined,
      expectedHp: 490,
      expectedMp: 20,
    },
    {
      resource: 'hp' as const,
      rate: 1000,
      potencyBasisPoints: 2500,
      expectedHp: 491,
      expectedMp: 0,
    },
    {
      resource: 'mp' as const,
      rate: 1000,
      potencyBasisPoints: 2500,
      expectedHp: 490,
      expectedMp: 1,
    },
  ])(
    'settles captured $resource Leech rate $rate without changing old catalogue authority',
    ({ resource, rate, potencyBasisPoints, expectedHp, expectedMp }) => {
      const id = resource === 'hp' ? 'absorb-hp' : 'absorb-mp'
      const content = {
        ...PV1F_COMBAT_CONTENT,
        statuses: [
          ...PV1F_COMBAT_CONTENT.statuses,
          {
            id,
            version: 1,
            maximumStacks: 1,
            durationOwnerTurnStarts: 2,
            damageTakenMultiplierBasisPoints: 10000,
            polarity: 'positive' as const,
            reactionClass: 'reactive' as const,
            ...(resource === 'hp' ? { absorbHpBasisPoints: rate } : { absorbMpBasisPoints: rate }),
          },
        ],
      }
      let state = encounter()
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          battle: {
            ...state.tactical.battle,
            combatants: state.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy' ? { ...unit, hp: 500, mp: 0 } : unit,
            ),
          },
        },
      }
      state = executeCombatAction(
        state,
        action([
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: id,
            stacks: 1,
            durationTurns: 2,
            ...(potencyBasisPoints === undefined ? {} : { potencyBasisPoints }),
          },
        ]),
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ).state
      state = executeCombatAction(
        state,
        action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }]),
        { kind: 'unit', combatantId: 'enemy' },
        content,
      ).state
      expect(validateCombatEncounterState(JSON.parse(JSON.stringify(state)))).toEqual([])
      expect(hp(state)).toBe(expectedHp)
      expect(state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.mp).toBe(
        expectedMp,
      )
    },
  )

  it('captures and restores a999% Barrier without changing maximum HP', () => {
    const state = reload(
      cast(encounter(), [
        {
          type: 'barrier-change',
          recipient: 'actor',
          basis: 'maximum-hp-percent',
          amount: 999,
          durationTurns: 2,
        },
      ]),
    )
    expect(state.effectState?.barriers?.[0]?.amount).toBe(9990)
    expect(hp(state, 'actor')).toBe(1000)
  })

  it('settles two high percentage Burn stages with positive authored decay', () => {
    let state = applyCurrentBurnState(
      encounter(),
      'actor',
      'enemy',
      'test.burn999',
      true,
      undefined,
      2,
      {
        capturedDamage: 10,
        profile: { kind: 'attack-percentage', basisPoints: 99900, decayBasisPointsPerTick: 49900 },
      },
      99900,
    )
    state = reload(state)
    const first = advanceCurrentBurnEndTurn(state, 'enemy')
    expect(first.damage).toBe(99)
    const second = advanceCurrentBurnEndTurn(reload(first.state), 'enemy')
    expect(second.damage).toBe(50)
    expect(second.state.effectState?.burn).toEqual([])
    expect(parsePercentageBasisPoints('999')).toBe(99900)
    expect(percentageBasisPointsText(99900)).toBe('999')
    expect(() => parsePercentageBasisPoints('1000')).toThrow()
  })
})
