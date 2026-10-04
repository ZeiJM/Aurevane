import { describe, expect, it } from 'vitest'
import type { CombatEncounterState } from './actions'
import {
  advanceCurrentBurnEndTurn,
  advanceCurrentPoisonEndTurn,
  advanceCurrentPoisonMovement,
  applyCurrentBleedState,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  currentPoisonEndTurnDamage,
  validateCombatDotState,
} from './combat-dots'
import { normalizeCombatEffectState } from './combat-effect-state'
import { conditionalDamageMultiplier } from './damage-modifiers'
import { applyCombatStatusCopies, attachCombatStatusCopyProvenance } from './combat-status-copy'
import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
} from './combat-kernel-types'

function world(current = true): CombatEncounterState {
  return {
    ...(current ? { effectStackingPolicyVersion: 1 } : {}),
    tactical: {
      battle: {
        round: 1,
        turnNumber: 1,
        combatants: [
          { id: 'actor', hp: 100, maxHp: 100 },
          { id: 'target', hp: 100, maxHp: 100 },
        ],
      },
    },
    statusState: ['actor', 'target'].map((combatantId) => ({ combatantId, statuses: [] })),
    effectState: normalizeCombatEffectState(undefined),
  } as unknown as CombatEncounterState
}

describe('unlimited independent DoT applications', () => {
  it('handles the largest valid neutral application count without iterating over each stack', () => {
    const state = world()
    state.statusState[0]!.statuses = [
      {
        statusId: 'neutral',
        statusVersion: 1,
        stacks: Number.MAX_SAFE_INTEGER,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: 'actor',
      },
    ]
    const content = {
      statuses: [
        {
          id: 'neutral',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 2,
          damageTakenMultiplierBasisPoints: 10_000,
          damageModifiers: [
            {
              direction: 'outgoing' as const,
              multiplierBasisPoints: 10_000,
              condition: { kind: 'always' as const },
            },
          ],
        },
      ],
    }
    expect(conditionalDamageMultiplier(state, 'actor', 'target', content)).toBe(10_000)
    const growing = {
      statuses: [
        {
          ...content.statuses[0]!,
          damageModifiers: [
            {
              direction: 'outgoing' as const,
              multiplierBasisPoints: 11_000,
              condition: { kind: 'always' as const },
            },
          ],
        },
      ],
    }
    expect(() => conditionalDamageMultiplier(state, 'actor', 'target', growing)).toThrow(
      'exact calculation capacity',
    )
  })
  it('combines every distinct Inspired status under current policy, retaining the legacy first status rule', () => {
    const state = world()
    state.statusState[0]!.statuses = ['first', 'second'].map((statusId) => ({
      statusId,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'actor',
    }))
    const content = {
      statuses: ['first', 'second'].map((id) => ({
        id,
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 2,
        damageTakenMultiplierBasisPoints: 10_000,
        gameplayTags: ['Inspired' as const],
      })),
    }
    expect(conditionalDamageMultiplier(state, 'actor', 'target', content)).toBe(12_100)
    expect(
      conditionalDamageMultiplier(
        { ...state, effectStackingPolicyVersion: undefined },
        'actor',
        'target',
        content,
      ),
    ).toBe(11_000)
  })

  it('adds copied ordinary stacks beyond authored caps only under current policy and rejects overflow', () => {
    const content = {
      statuses: [
        {
          id: 'buff',
          version: 1,
          maximumStacks: 3,
          damageTakenMultiplierBasisPoints: 10_000,
          durationOwnerTurnStarts: 3,
          polarity: 'positive' as const,
          amplifyCopyable: true,
        },
      ],
    }
    const donor = {
      statusId: 'buff',
      statusVersion: 1,
      stacks: 6,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'target',
    }
    const previous = { ...donor, stacks: 5, sourceCombatantId: 'actor' }
    const state = {
      ...world(),
      statusState: [
        { combatantId: 'actor', statuses: [previous] },
        { combatantId: 'target', statuses: [donor] },
      ],
    }
    const effect = {
      type: 'copy-statuses' as const,
      recipient: 'primary-unit' as const,
      mode: 'amplify' as const,
    }
    const copied = applyCombatStatusCopies(state, 'actor', 'target', 'copy', effect, content).state
    expect(copied.statusState[0]!.statuses[0]!.stacks).toBe(11)
    expect(copied.statusState[1]!.statuses).toEqual([donor])
    expect(() =>
      applyCombatStatusCopies(
        { ...state, effectStackingPolicyVersion: undefined },
        'actor',
        'target',
        'copy',
        effect,
        content,
      ),
    ).toThrow()
    const overflow = {
      ...state,
      statusState: [
        { combatantId: 'actor', statuses: [{ ...previous, stacks: Number.MAX_SAFE_INTEGER }] },
        { combatantId: 'target', statuses: [donor] },
      ],
    }
    expect(() =>
      applyCombatStatusCopies(overflow, 'actor', 'target', 'copy', effect, content),
    ).toThrow('safe integer')
    const legacy = {
      ...state,
      effectStackingPolicyVersion: undefined,
      statusState: [
        { combatantId: 'actor', statuses: [{ ...previous, stacks: 2 }] },
        { combatantId: 'target', statuses: [{ ...donor, stacks: 3 }] },
      ],
    }
    expect(
      applyCombatStatusCopies(legacy, 'actor', 'target', 'copy', effect, content).state
        .statusState[0]!.statuses[0]!.stacks,
    ).toBe(3)
  })

  it('preserves receiver and donor application magnitudes in copied damage modifiers', () => {
    const state = world()
    const donor = {
      statusId: 'buff',
      statusVersion: 1,
      stacks: 2,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'target',
      potencyBasisPoints: 500,
      applicationModifiers: [
        { stacks: 1, sourceCombatantId: 'target', potencyBasisPoints: 2000 },
        { stacks: 1, sourceCombatantId: 'target', potencyBasisPoints: 500 },
      ],
    }
    const previous = {
      ...donor,
      stacks: 1,
      sourceCombatantId: 'actor',
      potencyBasisPoints: 1000,
      applicationModifiers: [{ stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 1000 }],
    }
    state.statusState = [
      { combatantId: 'actor', statuses: [previous] },
      { combatantId: 'target', statuses: [donor] },
    ]
    const content = {
      statuses: [
        {
          id: 'buff',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 3,
          damageTakenMultiplierBasisPoints: 10_000,
          polarity: 'positive' as const,
          amplifyCopyable: true,
          damageModifiers: [
            {
              direction: 'outgoing' as const,
              multiplierBasisPoints: 11000,
              condition: { kind: 'always' as const },
            },
          ],
        },
      ],
    }
    const copied = applyCombatStatusCopies(
      state,
      'actor',
      'target',
      'copy',
      {
        type: 'copy-statuses',
        recipient: 'primary-unit',
        mode: 'amplify',
        beneficialEffects: true,
      },
      content,
    ).state
    expect(copied.statusState[0]!.statuses[0]!.applicationModifiers).toEqual([
      { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 1000 },
      { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 2000 },
      { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 500 },
    ])
    expect(conditionalDamageMultiplier(copied, 'actor', 'target', content)).toBe(13860)
    expect(copied.statusState[1]!.statuses).toEqual([donor])
  })

  it('copies all source-scoped Mark donors into the caster relationship under current policy', () => {
    const state = world()
    const first = {
      statusId: 'mark',
      statusVersion: 1,
      stacks: 2,
      sourceScopedMark: true as const,
      sourceCombatantId: 'actor',
      remainingOwnerTurnStarts: 2,
      potencyBasisPoints: 300,
    }
    const second = {
      ...first,
      sourceCombatantId: 'target',
      stacks: 5,
      remainingOwnerTurnStarts: 3,
      potencyBasisPoints: 800,
    }
    const previous = { ...first, stacks: 1 }
    state.statusState = [
      { combatantId: 'actor', statuses: [first, second] },
      { combatantId: 'target', statuses: [previous] },
    ]
    const content = {
      statuses: [
        {
          id: 'mark',
          version: 1,
          maximumStacks: 1,
          durationOwnerTurnStarts: 3,
          damageTakenMultiplierBasisPoints: 10_000,
          polarity: 'negative' as const,
          curseCopyable: true,
          markAccuracyBonusBasisPoints: 300,
        },
      ],
    }
    const copied = applyCombatStatusCopies(
      state,
      'actor',
      'target',
      'curse',
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
      content,
    ).state
    const received = copied.statusState[1]!.statuses[0]!
    expect(received.stacks).toBe(8)
    expect(received.remainingOwnerTurnStarts).toBe(3)
    expect(received.applicationModifiers).toEqual([
      { stacks: 1, sourceCombatantId: 'actor', potencyBasisPoints: 300 },
      { stacks: 2, sourceCombatantId: 'actor', potencyBasisPoints: 300 },
      { stacks: 5, sourceCombatantId: 'actor', potencyBasisPoints: 800 },
    ])
    expect(copied.statusState[0]!.statuses).toEqual([first, second])
  })

  it('copies repeated recovery applications and leaves existing recipient lineage intact', () => {
    const provenance = createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: 'copy',
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'copy-chain',
    })
    const context = {
      provenance,
      triggerGuard: createCombatTriggerGuard({ triggerChainId: 'copy-chain' }),
    }
    const lineage = (id: string, ordinal: number) =>
      createCombatEffectInstanceProvenance({
        action: provenance,
        targetCombatantId: id,
        effectOrdinal: ordinal,
        createdRound: 1,
        createdTurn: 1,
      })
    const state = world()
    const old = {
      kind: 'hp' as const,
      sourceCombatantId: 'actor',
      targetCombatantId: 'actor',
      sourceActionId: 'healing',
      amountPerTick: 5,
      remainingFutureTicks: 2,
      provenance: lineage('actor', 0),
    }
    const donors = [2, 7, 11, 13].map((amountPerTick, index) => ({
      ...old,
      amountPerTick,
      targetCombatantId: 'target',
      sourceCombatantId: 'target',
      provenance: lineage('target', index),
    }))
    state.effectState!.ongoingRecovery = [old, ...donors]
    const effect = {
      type: 'copy-statuses' as const,
      recipient: 'primary-unit' as const,
      mode: 'amplify' as const,
      beneficialEffects: true,
    }
    const copied = applyCombatStatusCopies(state, 'actor', 'target', 'copy', effect, {
      statuses: [],
    }).state
    const attributed = attachCombatStatusCopyProvenance(
      state,
      copied,
      'actor',
      'target',
      effect,
      { statuses: [] },
      context,
    )
    const rows = attributed.effectState!.ongoingRecovery.filter(
      (row) => row.targetCombatantId === 'actor',
    )
    expect(rows.map((row) => row.amountPerTick)).toEqual([5, 2, 7, 11, 13])
    expect(rows[0]!.provenance).toEqual(old.provenance)
    expect(rows.slice(1).map((row) => row.provenance?.copiedFromInstanceId)).toEqual(
      donors.map((row) => row.provenance.instanceId),
    )
    expect(new Set(rows.map((row) => row.provenance?.instanceId)).size).toBe(5)
  })

  it('assigns distinct Curse lineage to each copied application without reattributing recipient effects', () => {
    const provenance = createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: 'curse',
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'curse-chain',
    })
    const context = {
      provenance,
      triggerGuard: createCombatTriggerGuard({ triggerChainId: 'curse-chain' }),
    }
    let state = world()
    for (let i = 0; i < 2; i += 1) {
      state = applyCurrentPoisonState(state, 'actor', 'actor', `poison:${i}`, true, 2 + i, 2)
      state = applyCurrentBurnState(state, 'actor', 'actor', `burn:${i}`, true, 2 + i, 2)
    }
    state = applyCurrentPoisonState(state, 'actor', 'target', 'old-poison', true, 8, 2)
    state = applyCurrentBurnState(state, 'actor', 'target', 'old-burn', true, 8, 2)
    const effects = state.effectState!
    effects.poison = effects.poison.map((row, index) => ({
      ...row,
      provenance: createCombatEffectInstanceProvenance({
        action: provenance,
        targetCombatantId: row.targetCombatantId,
        effectOrdinal: index + 10,
        createdRound: 1,
        createdTurn: 1,
      }),
    }))
    effects.burn = effects.burn.map((row, index) => ({
      ...row,
      provenance: createCombatEffectInstanceProvenance({
        action: provenance,
        targetCombatantId: row.targetCombatantId,
        effectOrdinal: index + 20,
        createdRound: 1,
        createdTurn: 1,
      }),
    }))
    const effect = {
      type: 'copy-statuses' as const,
      recipient: 'primary-unit' as const,
      mode: 'curse' as const,
    }
    const copied = applyCombatStatusCopies(state, 'actor', 'target', 'curse', effect, {
      statuses: [],
    }).state
    const attributed = attachCombatStatusCopyProvenance(
      state,
      copied,
      'actor',
      'target',
      effect,
      { statuses: [] },
      context,
    )
    const originals = [...effects.poison, ...effects.burn].filter(
      (row) => row.targetCombatantId === 'target',
    )
    const recipients = [...attributed.effectState!.poison, ...attributed.effectState!.burn].filter(
      (row) => row.targetCombatantId === 'target',
    )
    expect(
      recipients
        .filter((row) => row.sourceActionId.startsWith('old-'))
        .map((row) => row.provenance),
    ).toEqual(originals.map((row) => row.provenance))
    const transfers = recipients.filter((row) => row.sourceActionId === 'curse')
    const donors = [...effects.poison, ...effects.burn].filter(
      (row) => row.targetCombatantId === 'actor',
    )
    expect(transfers.map((row) => row.provenance?.copiedFromInstanceId)).toEqual(
      donors.map((row) => row.provenance!.instanceId),
    )
    expect(new Set(transfers.map((row) => row.provenance?.instanceId)).size).toBe(4)
    expect(transfers.every((row) => row.provenance?.inheritedFromInstanceId === undefined)).toBe(
      true,
    )
  })

  it('honors an explicitly authored four-turn Burn with default power', () => {
    let state = applyCurrentBurnState(world(), 'actor', 'target', 'burn-four', false, undefined, 4)
    const damage: number[] = []
    for (let i = 0; i < 4; i += 1) {
      expect(validateCombatDotState(state)).toEqual([])
      const tick = advanceCurrentBurnEndTurn(state, 'target')
      damage.push(tick.damage)
      state = tick.state
    }
    expect(damage).toEqual([4, 3, 2, 1])
    expect(state.effectState!.burn).toEqual([])
  })

  it('retains every Bleed, Poison and Burn application beyond historical caps', () => {
    let state = world()
    for (let i = 0; i < 6; i += 1) {
      state = applyCurrentBleedState(state, 'actor', 'target', `bleed:${i}`, 2, 4)
      state = applyCurrentPoisonState(state, 'actor', 'target', `poison:${i}`, true, i + 1, 4)
      state = applyCurrentBurnState(state, 'actor', 'target', `burn:${i}`, true, i + 1, 4)
    }
    expect(state.effectState?.bleed).toHaveLength(6)
    expect(state.effectState?.poison).toHaveLength(6)
    expect(state.effectState?.burn).toHaveLength(6)
    expect(currentPoisonEndTurnDamage(state, 'target')).toBe(21)
    expect(validateCombatDotState(state)).toEqual([])
  })

  it('preserves mixed potency, lifetime and independent movement counters', () => {
    let state = applyCurrentPoisonState(world(), 'actor', 'target', 'old', true, 9, 1)
    state = advanceCurrentPoisonMovement(state, 'target', 3).state
    state = applyCurrentPoisonState(state, 'actor', 'target', 'new', true, 2, 3)
    const moved = advanceCurrentPoisonMovement(state, 'target', 2)
    expect(moved.ticks.map((row) => [row.instance.sourceActionId, row.triggeredTicks])).toEqual([
      ['old', 1],
      ['new', 0],
    ])
    expect(moved.state.effectState?.poison.map((row) => row.movementRemainder)).toEqual([0, 2])
    state = advanceCurrentPoisonEndTurn(moved.state, 'target')
    expect(
      state.effectState?.poison.map((row) => [row.sourceActionId, row.remainingTicks]),
    ).toEqual([['new', 2]])
    state = applyCurrentBurnState(state, 'actor', 'target', 'short', true, 8, 1)
    state = applyCurrentBurnState(state, 'actor', 'target', 'long', true, 3, 3)
    const first = advanceCurrentBurnEndTurn(state, 'target')
    expect(first.ticks.map((row) => [row.instance.sourceActionId, row.damage])).toEqual([
      ['short', 8],
      ['long', 3],
    ])
    const second = advanceCurrentBurnEndTurn(first.state, 'target')
    expect(second.ticks.map((row) => [row.instance.sourceActionId, row.damage])).toEqual([
      ['long', 2],
    ])
  })

  it('retains legacy replacement and maximum-three Bleed behavior', () => {
    let state = world(false)
    for (let i = 0; i < 5; i += 1) {
      state = applyCurrentBleedState(state, 'actor', 'target', `bleed:${i}`, 2, 4)
      state = applyCurrentPoisonState(state, 'actor', 'target', `poison:${i}`)
      state = applyCurrentBurnState(state, 'actor', 'target', `burn:${i}`)
    }
    expect(state.effectState?.bleed).toHaveLength(3)
    expect(state.effectState?.poison).toHaveLength(1)
    expect(state.effectState?.burn).toHaveLength(1)
    expect(validateCombatDotState(state)).toEqual([])
  })

  it('Curse copies all eligible applications with exact power and remaining lifetime', () => {
    let state = world()
    for (let i = 0; i < 5; i += 1) {
      state = applyCurrentBleedState(state, 'actor', 'actor', `bleed:${i}`, i + 1, 3, true)
      state = applyCurrentPoisonState(state, 'actor', 'actor', `poison:${i}`, true, i + 1, 3)
      state = applyCurrentBurnState(state, 'actor', 'actor', `burn:${i}`, true, i + 1, 3)
    }
    state = advanceCurrentPoisonMovement(state, 'actor', 2).state
    state = advanceCurrentPoisonEndTurn(state, 'actor')
    state = advanceCurrentBurnEndTurn(state, 'actor').state
    const donor = {
      ...state.effectState!,
      poison: state.effectState!.poison.map((row) => ({ ...row })),
      burn: state.effectState!.burn.map((row) => ({ ...row })),
    }
    const copied = applyCombatStatusCopies(
      state,
      'actor',
      'target',
      'curse',
      {
        type: 'copy-statuses',
        recipient: 'primary-unit',
        mode: 'curse',
      },
      { statuses: [] },
    ).state
    const effects = copied.effectState!
    expect(
      effects.poison
        .filter((row) => row.targetCombatantId === 'target')
        .map((row) => [row.damagePerTick, row.remainingTicks, row.movementRemainder]),
    ).toEqual(
      donor!.poison.map((row) => [row.damagePerTick, row.remainingTicks, row.movementRemainder]),
    )
    expect(
      effects.burn
        .filter((row) => row.targetCombatantId === 'target')
        .map((row) => [row.basePower, row.remainingTicks, row.stage]),
    ).toEqual(donor!.burn.map((row) => [row.basePower, row.remainingTicks, row.stage]))
    expect(effects.bleed.filter((row) => row.targetCombatantId === 'target')).toHaveLength(5)
    expect(effects.poison.filter((row) => row.targetCombatantId === 'actor')).toEqual(donor!.poison)
    expect(effects.burn.filter((row) => row.targetCombatantId === 'actor')).toEqual(donor!.burn)
    expect(validateCombatDotState(copied)).toEqual([])
  })

  it('fails closed for malformed and duplicate application orders', () => {
    const state = applyCurrentPoisonState(world(), 'actor', 'target', 'poison')
    const row = state.effectState!.poison[0]!
    for (const order of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      const malformed = {
        ...state,
        effectState: { ...state.effectState!, poison: [{ ...row, applicationOrder: order }] },
      }
      expect(validateCombatDotState(malformed)).not.toEqual([])
    }
    expect(
      validateCombatDotState({
        ...state,
        effectState: { ...state.effectState!, poison: [row, row] },
      }),
    ).not.toEqual([])
  })
})
