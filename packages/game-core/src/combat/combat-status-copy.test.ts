import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionContext,
  type CombatStatusDefinition,
  type CombatStatusInstance,
} from './actions'
import {
  createPendingBattle,
  startBattle,
  selectFinalFacing,
  advanceBattleRng,
} from './battle-state'
import { createTacticalBattleState } from './board'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
  validateCombatEffectInstanceProvenance,
} from './combat-kernel-types'
import { normalizeCombatEffectState } from './combat-effect-state'

const POSITIVE: CombatStatusDefinition = {
  id: 'test.guard',
  version: 1,
  maximumStacks: 3,
  durationOwnerTurnStarts: 4,
  damageTakenMultiplierBasisPoints: 8_000,
  polarity: 'positive',
  amplifyCopyable: true,
  reactionClass: 'ordinary',
}
const NEGATIVE: CombatStatusDefinition = {
  id: 'test.blind',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 4,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'negative',
  curseCopyable: true,
  reactionClass: 'ordinary',
  blindAccuracyPenaltyBasisPoints: 1_500,
}
const MARK: CombatStatusDefinition = {
  ...NEGATIVE,
  id: 'test.mark',
  blindAccuracyPenaltyBasisPoints: undefined,
  markAccuracyBonusBasisPoints: 1_500,
}
const REFLECT: CombatStatusDefinition = {
  ...POSITIVE,
  id: 'test.reflect',
  maximumStacks: 1,
  damageTakenMultiplierBasisPoints: 10_000,
  reactionClass: 'reactive',
  reflectBasisPoints: 2_500,
}
const CONTENT: CombatContentCatalog = { statuses: [POSITIVE, NEGATIVE, MARK, REFLECT] }
const TARGET = { kind: 'unit' as const, combatantId: 'target' }
function row(
  definition: CombatStatusDefinition,
  patch: Partial<CombatStatusInstance> = {},
): CombatStatusInstance {
  return {
    statusId: definition.id,
    statusVersion: definition.version,
    stacks: 1,
    remainingOwnerTurnStarts: 2,
    sourceCombatantId: 'other',
    ...(definition.markAccuracyBonusBasisPoints !== undefined
      ? { sourceScopedMark: true as const }
      : {}),
    ...patch,
  }
}
function world(
  initial: readonly { combatantId: string; statuses: readonly CombatStatusInstance[] }[] = [],
  accuracy = 10_000,
) {
  const ids = ['actor', 'target', 'other']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:status-copy',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 53,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'target' ? 'enemies' : 'players',
        initiative: 30 - index * 10,
        baseMovementBudget: 3,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 3,
        height: 1,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: ids.map((_, x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, x) => ({
          combatantId,
          position: { x, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        })),
      }),
      initial,
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: `scenario:${combatantId}`, sourceRulesVersion: 2 },
      accuracy,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 20,
      mysticPower: 20,
    })),
  )
}
function attack(): CombatActionDefinition {
  return {
    id: 'test.hit',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
  }
}
function copying(
  mode: 'amplify' | 'curse',
  patch: Partial<CombatActionDefinition> = {},
): CombatActionDefinition {
  // The test-first fixture intentionally describes the new operation before its union exists.
  return {
    ...attack(),
    id: `test.${mode}`,
    cost: { spendsAction: true, mp: 4 },
    ...patch,
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode }],
  } as unknown as CombatActionDefinition
}
function statuses(state: CombatEncounterState, id: string) {
  return state.statusState.find((entry) => entry.combatantId === id)?.statuses ?? []
}
function context(
  actionId = 'test.amplify',
  actorId = 'actor',
  chain = 'chain:copy',
): CombatResolutionContext {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: actionId,
      actionVersion: 1,
      sourceCombatantId: actorId,
      controllerCombatantId: actorId,
      triggerChainId: chain,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: chain }),
  }
}
function origin(targetCombatantId: string, effectOrdinal = 0, chain = 'chain:original') {
  return createCombatEffectInstanceProvenance({
    action: context('test.original', 'other', chain).provenance,
    targetCombatantId,
    effectOrdinal,
    createdRound: 1,
    createdTurn: 1,
  })
}
function advance(state: CombatEncounterState, content = CONTENT) {
  return endCombatTurn(
    {
      ...state,
      tactical: {
        ...state.tactical,
        battle: selectFinalFacing(state.tactical.battle, 'east').state,
      },
    },
    content,
  ).state
}
function cast(
  state: CombatEncounterState,
  mode: 'amplify' | 'curse',
  content = CONTENT,
  ctx?: CombatResolutionContext,
) {
  return executeCombatAction(state, copying(mode), TARGET, content, ctx)
}

describe('Amplify Curse active-status copying: public command contract', () => {
  it('copies positive target statuses onto the caster without removing originals', () => {
    const state = world([
      { combatantId: 'target', statuses: [row(POSITIVE, { stacks: 2 }), row(NEGATIVE)] },
    ])
    const before = JSON.stringify(state)
    const result = cast(state, 'amplify')
    expect(statuses(result.state, 'actor')).toEqual([
      row(POSITIVE, { stacks: 2, sourceCombatantId: 'actor' }),
    ])
    expect(statuses(result.state, 'target')).toEqual(statuses(state, 'target'))
    expect(JSON.stringify(state)).toBe(before)
  })
  it('copies negative caster statuses onto the selected target and leaves the caster afflicted', () => {
    const state = world([{ combatantId: 'actor', statuses: [row(POSITIVE), row(NEGATIVE)] }])
    const result = cast(state, 'curse')
    expect(statuses(result.state, 'target')).toEqual([
      row(NEGATIVE, { sourceCombatantId: 'actor' }),
    ])
    expect(statuses(result.state, 'actor')).toEqual(statuses(state, 'actor'))
    expect(result.state.tactical.battle.combatants.map((unit) => unit.hp)).toEqual([100, 100, 100])
  })
  it.each([1, 2, 3, 4])(
    'copies %s remaining owner ticks without refilling the duration',
    (remainingOwnerTurnStarts) => {
      const state = world([
        { combatantId: 'target', statuses: [row(POSITIVE, { remainingOwnerTurnStarts })] },
      ])
      expect(statuses(cast(state, 'amplify').state, 'actor')[0]?.remainingOwnerTurnStarts).toBe(
        remainingOwnerTurnStarts,
      )
    },
  )
  it('merges receiver stacks within the definition cap without shortening its longer duration', () => {
    const state = world([
      {
        combatantId: 'target',
        statuses: [row(POSITIVE, { stacks: 2, remainingOwnerTurnStarts: 1 })],
      },
      {
        combatantId: 'actor',
        statuses: [row(POSITIVE, { stacks: 2, remainingOwnerTurnStarts: 3 })],
      },
    ])
    expect(statuses(cast(state, 'amplify').state, 'actor')).toEqual([
      row(POSITIVE, { stacks: 3, remainingOwnerTurnStarts: 3, sourceCombatantId: 'actor' }),
    ])
  })
  it('does not compound an existing Blind or restart its four-tick definition', () => {
    const state = world([
      { combatantId: 'actor', statuses: [row(NEGATIVE, { remainingOwnerTurnStarts: 1 })] },
      { combatantId: 'target', statuses: [row(NEGATIVE)] },
    ])
    expect(statuses(cast(state, 'curse').state, 'target')).toEqual([
      row(NEGATIVE, { sourceCombatantId: 'actor' }),
    ])
  })
  it('copies a Mark as a relationship owned by the Curse caster, preserving other target sources', () => {
    const state = world([
      { combatantId: 'actor', statuses: [row(MARK)] },
      { combatantId: 'target', statuses: [row(MARK)] },
    ])
    const result = cast(state, 'curse')
    expect(statuses(result.state, 'target').map((entry) => entry.sourceCombatantId)).toEqual([
      'actor',
      'other',
    ])
    expect(statuses(result.state, 'actor')).toEqual(statuses(state, 'actor'))
  })
  it('collapses rebinding-equivalent source Marks to one copy with the longest remaining duration', () => {
    const state = world([
      {
        combatantId: 'actor',
        statuses: [
          row(MARK, { sourceCombatantId: 'target', remainingOwnerTurnStarts: 1 }),
          row(MARK),
        ],
      },
    ])
    expect(statuses(cast(state, 'curse').state, 'target')).toEqual([
      row(MARK, { sourceCombatantId: 'actor' }),
    ])
  })
  it('spends the ordinary action and MP cost once, without consuming hit RNG for automatic copying', () => {
    const state = world([{ combatantId: 'target', statuses: [row(POSITIVE), row(REFLECT)] }])
    const result = cast(state, 'amplify')
    expect(result.state.tactical.battle.currentTurn?.actionState).toBe('spent')
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(16)
    expect(result.events.filter((event) => event.event === 'mp_spent')).toHaveLength(1)
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })
  it('forecasts the actual receiving caster and copied current state without mutating RNG', () => {
    const state = world([{ combatantId: 'target', statuses: [row(POSITIVE, { stacks: 2 })] }])
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, copying('amplify'), TARGET, CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.projectedEffects).toContainEqual(
      expect.objectContaining({ effectType: 'copy-statuses', combatantId: 'actor' }),
    )
    expect(preview.projectedEvents).toContainEqual(
      expect.objectContaining({
        event: 'status_applied',
        targetCombatantId: 'actor',
        sourceCombatantId: 'actor',
        statusId: POSITIVE.id,
        stacks: 2,
        remainingOwnerTurnStarts: 2,
      }),
    )
    expect(JSON.stringify(state)).toBe(before)
  })
  it.each(['amplify', 'curse'] as const)(
    'gates a missed hostile %s copy without avoiding its resource costs',
    (mode) => {
      const donorId = mode === 'amplify' ? 'target' : 'actor'
      const definition = mode === 'amplify' ? POSITIVE : NEGATIVE
      const state = world([{ combatantId: donorId, statuses: [row(definition)] }], 0)
      const action = copying(mode, { accuracyMode: 'per-target' })
      const result = executeCombatAction(state, action, TARGET, CONTENT, context(action.id))
      expect(result.state.statusState).toEqual(state.statusState)
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(
        16,
      )
      expect(result.state.tactical.battle.rng).toEqual(
        advanceBattleRng(state.tactical.battle.rng).state,
      )
      expect(result.events.some((event) => event.event === 'status_applied')).toBe(false)
    },
  )
  it('copies a reactive status without triggering its reaction during the copy', () => {
    const state = world([{ combatantId: 'target', statuses: [row(REFLECT)] }])
    const copied = cast(state, 'amplify')
    expect(statuses(copied.state, 'actor')[0]?.statusId).toBe(REFLECT.id)
    expect(
      copied.events.some(
        (event) => event.event === 'damage_applied' || event.event === 'healing_applied',
      ),
    ).toBe(false)
    const next = advance(copied.state)
    const hit = executeCombatAction(next, attack(), { kind: 'unit', combatantId: 'actor' }, CONTENT)
    expect(hit.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.hp).toBe(80)
    expect(hit.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(95)
  })
  it('expires a one-tick copy through the normal recipient lifecycle', () => {
    const state = world([
      { combatantId: 'target', statuses: [row(POSITIVE, { remainingOwnerTurnStarts: 1 })] },
    ])
    let next = cast(state, 'amplify').state
    for (let index = 0; index < 3; index += 1) next = advance(next)
    expect(statuses(next, 'actor')).toEqual([])
  })
  it('preserves unrelated typed effects, resource history, terrain and temporary Skills', () => {
    const base = world([{ combatantId: 'target', statuses: [row(POSITIVE)] }])
    const effectState = normalizeCombatEffectState({
      damageHistory: [{ combatantId: 'actor', round: 1, amount: 12 }],
      temporarySkills: [
        {
          combatantId: 'target',
          skillId: 'test.temporary',
          contentVersion: 1,
          sourceCombatantId: 'other',
        },
      ],
    })
    const state = { ...base, effectState }
    const result = cast(state, 'amplify')
    expect(result.state.effectState).toBe(effectState)
    expect(result.state.tactical.placements).toEqual(state.tactical.placements)
    expect(result.state.terrainOverlays).toEqual(state.terrainOverlays)
  })
})

describe('Status copying: fail-closed eligibility and staged scope', () => {
  it.each(['amplify', 'curse'] as const)(
    'rejects an empty %s donor without spending anything',
    (mode) => {
      const state = world()
      const before = JSON.stringify(state)
      const preview = evaluateCombatAction(state, copying(mode), TARGET, CONTENT)
      expect(preview.legal).toBe(false)
      expect(preview.issues).toContainEqual(
        expect.objectContaining({
          code: 'requirement-not-met',
          message: expect.stringMatching(/eligible/i),
        }),
      )
      expect(() => cast(state, mode)).toThrow(/eligible/i)
      expect(JSON.stringify(state)).toBe(before)
    },
  )
  const excluded = [
    { amplifyCopyable: false },
    { amplifyCopyable: undefined },
    { polarity: undefined },
    { polarity: 'negative' },
    { polarity: 'neutral' },
    { polarity: 'mixed' },
    { reactionClass: 'system' },
    { reactionClass: 'self-cost' },
  ] as const
  it.each(excluded)('does not copy an ineligible positive candidate %j', (patch) => {
    const definition = { ...POSITIVE, ...patch }
    const state = world([{ combatantId: 'target', statuses: [row(definition), row(REFLECT)] }])
    const result = cast(state, 'amplify', { statuses: [definition, REFLECT] })
    expect(statuses(result.state, 'actor').map((entry) => entry.statusId)).toEqual([REFLECT.id])
  })
  it.each(['system', 'self-cost'] as const)(
    'does not Curse a %s penalty even with copy permission set',
    (reactionClass) => {
      const system = {
        ...NEGATIVE,
        id: 'test.penalty',
        blindAccuracyPenaltyBasisPoints: undefined,
        reactionClass,
      }
      const state = world([{ combatantId: 'actor', statuses: [row(system), row(NEGATIVE)] }])
      const result = cast(state, 'curse', { statuses: [system, NEGATIVE] })
      expect(statuses(result.state, 'target').map((entry) => entry.statusId)).toEqual([NEGATIVE.id])
    },
  )
  it.each([{ statusVersion: 2 }, { stacks: 4 }, { remainingOwnerTurnStarts: 5 }])(
    'rejects mismatched donor state %j',
    (patch) => {
      const state = world([{ combatantId: 'target', statuses: [row(POSITIVE, patch)] }])
      expect(() => cast(state, 'amplify')).toThrow()
    },
  )
  it('does not permit copying onto oneself to create stacks', () => {
    const state = world([{ combatantId: 'actor', statuses: [row(POSITIVE)] }])
    expect(
      evaluateCombatAction(
        state,
        copying('amplify'),
        { kind: 'unit', combatantId: 'actor' },
        CONTENT,
      ).legal,
    ).toBe(false)
  })
  it('requires a living, in-range selected donor rather than bypassing normal target legality', () => {
    const state = world([{ combatantId: 'target', statuses: [row(POSITIVE)] }])
    const action = copying('amplify', { target: { ...attack().target, maximumRange: 0 } })
    expect(evaluateCombatAction(state, action, TARGET, CONTENT).legal).toBe(false)
  })
  it('accepts the supported pure unit-copy operation in central authoring', () => {
    expect(() => validateCombatActionDefinition(copying('amplify'), CONTENT)).not.toThrow()
  })
  it.each(['invalid', null, 1])('rejects invalid copy mode %j', (mode) => {
    const action = {
      ...copying('amplify'),
      effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode }],
    } as unknown as CombatActionDefinition
    expect(() => validateCombatActionDefinition(action, CONTENT)).toThrow()
    expect(() => executeCombatAction(world(), action, TARGET, CONTENT)).toThrow()
  })
  it('rejects mixed effect packages until ordered copying has a tested contract', () => {
    const action = {
      ...copying('amplify'),
      effects: [...copying('amplify').effects, ...attack().effects],
    }
    expect(() => validateCombatActionDefinition(action, CONTENT)).toThrow()
  })
  it('rejects area copying in this single-recipient slice', () => {
    const action = copying('amplify', {
      target: { ...attack().target, kind: 'ground-tile', shape: { kind: 'circle', radius: 1 } },
    })
    expect(() => validateCombatActionDefinition(action, CONTENT)).toThrow()
  })
})

describe('Status copying: K3 lineage and deterministic identity', () => {
  it('uses distinct copied-instance identities for multiple statuses in one block', () => {
    const originalGuard = row(POSITIVE, { provenance: origin('target', 0) })
    const originalReflect = row(REFLECT, { provenance: origin('target', 1) })
    const state = world([{ combatantId: 'target', statuses: [originalReflect, originalGuard] }])
    const ctx = context()
    const result = cast(state, 'amplify', CONTENT, ctx)
    const copies = statuses(result.state, 'actor')
    expect(copies).toHaveLength(2)
    expect(new Set(copies.map((entry) => entry.provenance?.instanceId)).size).toBe(2)
    expect(copies.map((entry) => entry.provenance?.copiedFromInstanceId)).toEqual([
      originalGuard.provenance?.instanceId,
      originalReflect.provenance?.instanceId,
    ])
    for (const entry of copies) {
      expect(entry.provenance).toMatchObject({
        targetCombatantId: 'actor',
        effectOrdinal: 0,
        action: ctx.provenance,
      })
      expect(validateCombatEffectInstanceProvenance(entry.provenance)).toEqual([])
    }
    expect(result.resolution?.provenance).toEqual(ctx.provenance)
    expect(result.resolution?.triggerGuard).toEqual(ctx.triggerGuard)
    expect(statuses(result.state, 'target')).toEqual(statuses(state, 'target'))
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
  })
  it('records the prior recipient instance as inherited lineage when stacks merge', () => {
    const receiver = row(POSITIVE, { provenance: origin('actor', 0, 'chain:receiver') })
    const donor = row(POSITIVE, { provenance: origin('target') })
    const state = world([
      { combatantId: 'actor', statuses: [receiver] },
      { combatantId: 'target', statuses: [donor] },
    ])
    expect(
      statuses(cast(state, 'amplify', CONTENT, context()).state, 'actor')[0]?.provenance,
    ).toMatchObject({
      copiedFromInstanceId: donor.provenance?.instanceId,
      inheritedFromInstanceId: receiver.provenance?.instanceId,
    })
  })
  it('does not reuse a donor provenance object when no K3 command context is supplied', () => {
    const state = world([
      { combatantId: 'target', statuses: [row(POSITIVE, { provenance: origin('target') })] },
    ])
    const result = cast(state, 'amplify')
    expect(statuses(result.state, 'actor')[0]).not.toHaveProperty('provenance')
    expect(result).not.toHaveProperty('resolution')
  })
  it('does not invent an original instance ID for historical donors with no provenance', () => {
    const state = world([{ combatantId: 'target', statuses: [row(POSITIVE)] }])
    const copied = statuses(cast(state, 'amplify', CONTENT, context()).state, 'actor')[0]
    expect(copied?.provenance).toBeDefined()
    expect(copied?.provenance).not.toHaveProperty('copiedFromInstanceId')
  })
  it('extends deterministic provenance with a validated child-copy ordinal', () => {
    const input = {
      action: context().provenance,
      targetCombatantId: 'actor',
      effectOrdinal: 0,
      createdRound: 1,
      createdTurn: 1,
      copyOrdinal: 1,
    }
    const copied = createCombatEffectInstanceProvenance(input)
    expect(copied).toMatchObject({ copyOrdinal: 1 })
    expect(copied.instanceId).toBe(
      `effect-copy:${JSON.stringify([
        input.action.triggerChainId,
        input.action.actionDefinitionId,
        input.effectOrdinal,
        input.targetCombatantId,
        input.copyOrdinal,
      ])}`,
    )
    expect(validateCombatEffectInstanceProvenance(copied)).toEqual([])
    expect(
      validateCombatEffectInstanceProvenance({ ...copied, copyOrdinal: 2 }).length,
    ).toBeGreaterThan(0)
  })
  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid copy ordinal %s',
    (copyOrdinal) => {
      const input = {
        action: context().provenance,
        targetCombatantId: 'actor',
        effectOrdinal: 0,
        createdRound: 1,
        createdTurn: 1,
        copyOrdinal,
      }
      expect(() => createCombatEffectInstanceProvenance(input)).toThrow()
    },
  )
  it('preserves the exact historical provenance shape without a copy ordinal', () => {
    const value = origin('target')
    expect(value.instanceId).toBe('effect:chain:original:test.original:0:target')
    expect(value).not.toHaveProperty('copyOrdinal')
    expect(validateCombatEffectInstanceProvenance(value)).toEqual([])
  })
})
