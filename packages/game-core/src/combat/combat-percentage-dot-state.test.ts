import { describe, expect, it } from 'vitest'
import { validateCombatEncounterState } from './actions'
import {
  advanceCurrentBleedEndTurn,
  advanceCurrentBurnEndTurn,
  advanceCurrentPoisonEndTurn,
  advanceCurrentPoisonMovement,
  applyCurrentBleedState,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  currentPoisonEndTurnDamage,
  removeCurrentBleedState,
  removeCurrentBurnState,
  removeCurrentPoisonState,
} from './combat-dots'
import { applyCombatStatusCopies } from './combat-status-copy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'

const captured = (capturedDamage = 40, basisPoints = 1500) => ({
  capturedDamage,
  profile: { kind: 'attack-percentage' as const, basisPoints },
})

describe('percentage DoT application lifetimes', () => {
  it.each([undefined, 0, 5, 1.5, 1])(
    'rejects malformed or missing captured original Poison duration %s in policy 2',
    (originalDurationTurns) => {
      const initial = applyCurrentPoisonState(
        { ...percentageDotEncounter(), dotTriggerPolicyVersion: 2 },
        'actor',
        'enemy',
        'first',
        true,
        undefined,
        3,
        captured(),
      )
      const state = {
        ...initial,
        effectState: {
          ...initial.effectState!,
          poison: initial.effectState!.poison.map((row) => ({ ...row, originalDurationTurns })),
        },
      }
      expect(validateCombatEncounterState(JSON.parse(JSON.stringify(state)))).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'effectState.poison' })]),
      )
    },
  )
  it.each([
    {
      duration: 4,
      percent: 1000,
      expectedDuration: 4,
      expectedPercent: 2000,
      expectedSource: 'actor',
      expectedBasis: 40,
    },
    {
      duration: 1,
      percent: 3000,
      expectedDuration: 3,
      expectedPercent: 3000,
      expectedSource: 'ally',
      expectedBasis: 20,
    },
    {
      duration: 1,
      percent: 1000,
      expectedDuration: 3,
      expectedPercent: 2000,
      expectedSource: 'actor',
      expectedBasis: 40,
    },
    {
      duration: 3,
      percent: 2000,
      expectedDuration: 3,
      expectedPercent: 2000,
      expectedSource: 'actor',
      expectedBasis: 40,
    },
  ])(
    'retains independent duration/percentage maxima on v2 reapplication: $duration turns/$percent bp',
    ({ duration, percent, expectedDuration, expectedPercent, expectedSource, expectedBasis }) => {
      let state = applyCurrentPoisonState(
        { ...percentageDotEncounter(), dotTriggerPolicyVersion: 2 },
        'actor',
        'enemy',
        'first',
        true,
        undefined,
        3,
        captured(40, 2000),
      )
      state = advanceCurrentPoisonMovement(
        advanceCurrentPoisonEndTurn(state, 'enemy'),
        'enemy',
        4,
      ).state
      state = applyCurrentPoisonState(
        state,
        'ally',
        'enemy',
        'second',
        true,
        undefined,
        duration,
        captured(20, percent),
      )
      expect(state.effectState!.poison).toHaveLength(1)
      expect(state.effectState!.poison[0]).toMatchObject({
        originalDurationTurns: expectedDuration,
        remainingTicks: expectedDuration,
        movementRemainder: 0,
        sourceCombatantId: expectedSource,
        percentageDamage: captured(expectedBasis, expectedPercent),
      })
      state = advanceCurrentPoisonEndTurn(state, 'enemy')
      const restored = JSON.parse(JSON.stringify(state))
      expect(validateCombatEncounterState(restored)).toEqual([])
      const refreshed = advanceCurrentPoisonMovement(restored, 'enemy', 5)
      expect(refreshed.triggeredTicks).toBe(0)
      expect(refreshed.state.effectState!.poison[0]!.remainingTicks).toBe(expectedDuration)
    },
  )
  it('copies the captured original duration and counter, then refreshes the copied Poison without damage', () => {
    let state = applyCurrentPoisonState(
      { ...percentageDotEncounter(), dotTriggerPolicyVersion: 2 },
      'actor',
      'enemy',
      'first',
      true,
      undefined,
      4,
      captured(),
    )
    state = advanceCurrentPoisonMovement(
      advanceCurrentPoisonEndTurn(state, 'enemy'),
      'enemy',
      4,
    ).state
    const copied = applyCombatStatusCopies(
      state,
      'enemy',
      'other',
      'copy',
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
      { statuses: [] },
    )
    const receiver = copied.state.effectState!.poison.find(
      (row) => row.targetCombatantId === 'other',
    )!
    expect(receiver).toMatchObject({
      originalDurationTurns: 4,
      remainingTicks: 3,
      movementRemainder: 4,
    })
    const refreshed = advanceCurrentPoisonMovement(copied.state, 'other', 1)
    expect(refreshed.triggeredTicks).toBe(0)
    expect(
      refreshed.state.effectState!.poison.find((row) => row.targetCombatantId === 'other')!
        .remainingTicks,
    ).toBe(4)
  })
  it('replaces Poison across sources with a fresh basis, duration and movement counter', () => {
    let state = applyCurrentPoisonState(
      percentageDotEncounter(),
      'actor',
      'enemy',
      'first',
      true,
      undefined,
      4,
      captured(),
    )
    state = advanceCurrentPoisonMovement(state, 'enemy', 3).state
    state = applyCurrentPoisonState(
      state,
      'ally',
      'enemy',
      'second',
      true,
      undefined,
      2,
      captured(20),
    )
    expect(state.effectState?.poison).toHaveLength(1)
    expect(state.effectState?.poison[0]).toMatchObject({
      sourceCombatantId: 'ally',
      remainingTicks: 2,
      movementRemainder: 0,
      percentageDamage: captured(20),
    })
    expect(currentPoisonEndTurnDamage(state, 'enemy')).toBe(3)
    const moved = advanceCurrentPoisonMovement(state, 'enemy', 5)
    expect(moved.triggeredTicks).toBe(1)
    expect(moved.state.effectState?.poison[0]?.remainingTicks).toBe(2)
    expect(validateCombatEncounterState(moved.state)).toEqual([])
  })

  it('decays Burn by percentage points and replaces the existing application at stage zero', () => {
    const damage = {
      capturedDamage: 40,
      profile: {
        kind: 'attack-percentage' as const,
        basisPoints: 2500,
        decayBasisPointsPerTick: 500,
      },
    }
    let state = applyCurrentBurnState(
      percentageDotEncounter(),
      'actor',
      'enemy',
      'first',
      true,
      undefined,
      3,
      damage,
    )
    const first = advanceCurrentBurnEndTurn(state, 'enemy')
    expect(first.damage).toBe(10)
    expect(advanceCurrentBurnEndTurn(first.state, 'enemy').damage).toBe(8)
    state = applyCurrentBurnState(first.state, 'ally', 'enemy', 'second', true, undefined, 3, {
      ...damage,
      capturedDamage: 20,
    })
    expect(state.effectState?.burn).toHaveLength(1)
    expect(state.effectState?.burn[0]?.stage).toBe(0)
    expect(advanceCurrentBurnEndTurn(state, 'enemy').damage).toBe(5)
  })

  it('keeps five independently captured Bleeds through serialization without the fixed raw cap', () => {
    let state = percentageDotEncounter()
    for (const basis of [20, 30, 40, 50, 1000])
      state = applyCurrentBleedState(
        state,
        'actor',
        'enemy',
        `bleed:${basis}`,
        0,
        3,
        true,
        captured(basis, 2000),
      ) as typeof state
    const restored = JSON.parse(JSON.stringify(state)) as typeof state
    expect(validateCombatEncounterState(restored)).toEqual([])
    const result = advanceCurrentBleedEndTurn(restored, 'enemy')
    expect(result.stacks.map((row) => row.percentageDamage?.capturedDamage)).toEqual([
      20, 30, 40, 50, 1000,
    ])
    expect(result.stacks.map((row) => row.damagePerTick)).toEqual([4, 6, 8, 10, 200])
    expect(result.state.effectState?.bleed).toHaveLength(5)
  })

  it('consumes a zero-HP tick normally and cleanup removes every application', () => {
    let state = applyCurrentPoisonState(
      percentageDotEncounter(),
      'actor',
      'enemy',
      'tiny',
      true,
      undefined,
      1,
      captured(1, 1),
    )
    expect(currentPoisonEndTurnDamage(state, 'enemy')).toBe(0)
    state = advanceCurrentPoisonEndTurn(state, 'enemy')
    expect(state.effectState?.poison).toEqual([])
    state = applyCurrentBurnState(state, 'actor', 'enemy', 'burn', true, undefined, 2, captured())
    state = applyCurrentBleedState(state, 'actor', 'enemy', 'bleed', 0, 2, true, captured())
    state = removeCurrentBleedState(
      removeCurrentBurnState(removeCurrentPoisonState(state, 'enemy'), 'enemy'),
      'enemy',
    )
    expect(state.effectState?.burn).toEqual([])
    expect(state.effectState?.bleed).toEqual([])
  })

  it('copies percentage metadata and remaining lifetime without mutating the donor', () => {
    let state = applyCurrentPoisonState(
      percentageDotEncounter(),
      'ally',
      'actor',
      'donor',
      true,
      undefined,
      3,
      captured(),
    )
    state = applyCurrentPoisonState(
      state,
      'ally',
      'enemy',
      'existing',
      true,
      undefined,
      4,
      captured(20),
    )
    const before = JSON.parse(JSON.stringify(state))
    const copied = applyCombatStatusCopies(
      state,
      'actor',
      'enemy',
      'copy',
      { type: 'copy-statuses', mode: 'curse', recipient: 'primary-unit' },
      { statuses: [] },
    )
    expect(
      copied.state.effectState?.poison.filter((row) => row.targetCombatantId === 'enemy'),
    ).toHaveLength(1)
    expect(
      copied.state.effectState?.poison.find((row) => row.targetCombatantId === 'enemy'),
    ).toMatchObject({ remainingTicks: 3, percentageDamage: captured() })
    expect(
      copied.state.effectState?.poison.find((row) => row.targetCombatantId === 'actor'),
    ).toEqual(state.effectState?.poison.find((row) => row.targetCombatantId === 'actor'))
    expect(state).toEqual(before)
  })

  it('copies progressed Burn and Bleed with their remaining lifetime without a separate stacking policy', () => {
    let state = { ...percentageDotEncounter(), effectStackingPolicyVersion: undefined }
    const damage = {
      capturedDamage: 40,
      profile: {
        kind: 'attack-percentage' as const,
        basisPoints: 2500,
        decayBasisPointsPerTick: 500,
      },
    }
    state = applyCurrentBurnState(
      state,
      'ally',
      'actor',
      'donor',
      true,
      undefined,
      3,
      damage,
    ) as typeof state
    state = advanceCurrentBurnEndTurn(state, 'actor').state as typeof state
    state = applyCurrentBleedState(
      state,
      'ally',
      'actor',
      'bleed',
      0,
      2,
      true,
      captured(40, 2000),
    ) as typeof state
    const copied = applyCombatStatusCopies(
      state,
      'actor',
      'enemy',
      'copy',
      { type: 'copy-statuses', mode: 'curse', recipient: 'primary-unit' },
      { statuses: [] },
    )
    expect(
      copied.state.effectState?.burn.find((row) => row.targetCombatantId === 'enemy'),
    ).toMatchObject({ stage: 1, remainingTicks: 2, percentageDamage: damage })
    expect(advanceCurrentBurnEndTurn(copied.state, 'enemy').damage).toBe(8)
    expect(
      copied.state.effectState?.bleed.find((row) => row.targetCombatantId === 'enemy'),
    ).toMatchObject({ remainingTicks: 2, percentageDamage: captured(40, 2000) })
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(copied.state)))).toEqual([])
  })

  it('rejects malformed captured state and percentage policy mismatches', () => {
    const state = applyCurrentPoisonState(
      percentageDotEncounter(),
      'actor',
      'enemy',
      'poison',
      true,
      undefined,
      4,
      captured(),
    )
    const row = state.effectState!.poison[0]!
    expect(
      validateCombatEncounterState({
        ...state,
        effectState: {
          ...state.effectState!,
          poison: [{ ...row, percentageDamage: captured(-1) }],
        },
      }),
    ).not.toEqual([])
    expect(
      validateCombatEncounterState({ ...state, percentageDotPolicyVersion: undefined }),
    ).not.toEqual([])
  })
})
