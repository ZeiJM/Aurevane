import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatContentCatalog,
  type CombatResolutionContext,
} from './actions'
import { createPendingBattle, startBattle, selectFinalFacing } from './battle-state'
import { createTacticalBattleState } from './board'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'
import {
  advanceCurrentPoisonMovement,
  currentPoisonInstance,
  removeCurrentPoisonState,
} from './combat-dots'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
} from './combat-kernel-types'

const TARGET = { kind: 'unit' as const, combatantId: 'target' }
const CONTENT: CombatContentCatalog = {
  statuses: [
    {
      id: 'test.negative',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 3,
      damageTakenMultiplierBasisPoints: 10_000,
      polarity: 'negative',
      reactionClass: 'ordinary',
      curseCopyable: true,
    },
  ],
}
function world(accuracy = 10_000): CombatEncounterState {
  const ids = ['actor', 'target', 'other']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:poison-copy',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 53,
      combatants: ids.map((id, i) => ({
        id,
        teamId: id === 'target' ? 'enemies' : 'players',
        initiative: 30 - i * 10,
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
function action(mode: 'curse' | 'amplify' = 'curse'): CombatActionDefinition {
  return {
    id: `test.${mode}`,
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
    cost: { spendsAction: true, mp: 4 },
    requirements: [],
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode }],
  }
}
function poisonAction(flag: unknown = true): CombatActionDefinition {
  // An untrusted authored field exercises runtime validation before its production type exists.
  const effect = {
    type: 'poison' as const,
    recipient: 'primary-unit' as const,
    ...(flag === undefined ? {} : { curseCopyable: flag }),
  }
  return {
    ...action(),
    id: 'test.poison',
    cost: { spendsAction: false, mp: 0 },
    effects: [effect],
  } as unknown as CombatActionDefinition
}
function context(
  actionId = 'test.curse',
  actorId = 'actor',
  chain = 'chain:curse',
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
function poison(state: CombatEncounterState, id = 'actor', counter = 0, flag: unknown = true) {
  const result = executeCombatAction(
    state,
    poisonAction(flag),
    { kind: 'unit', combatantId: id },
    CONTENT,
  )
  return advanceCurrentPoisonMovement(result.state, id, counter).state
}
function instance(state: CombatEncounterState, id = 'actor') {
  const found = currentPoisonInstance(state, id)
  if (!found) throw new Error(`Missing fixture Poison for ${id}`)
  return found
}
function cast(
  state: CombatEncounterState,
  ctx?: CombatResolutionContext,
  mode: 'curse' | 'amplify' = 'curse',
) {
  return executeCombatAction(state, action(mode), TARGET, CONTENT, ctx)
}
function advance(state: CombatEncounterState) {
  return endCombatTurn(
    {
      ...state,
      tactical: {
        ...state.tactical,
        battle: selectFinalFacing(state.tactical.battle, 'east').state,
      },
    },
    CONTENT,
  ).state
}
function withOrigin(state: CombatEncounterState, id: string, chain: string) {
  const provenance = createCombatEffectInstanceProvenance({
    action: context('test.original', 'other', chain).provenance,
    targetCombatantId: id,
    effectOrdinal: 0,
    createdRound: 1,
    createdTurn: 1,
  })
  return {
    ...state,
    effectState: {
      ...state.effectState!,
      poison: state.effectState!.poison.map((entry) =>
        entry.targetCombatantId === id
          ? { ...entry, sourceCombatantId: 'other', sourceActionId: 'test.original', provenance }
          : entry,
      ),
    },
  }
}

describe('Curse Poison: explicit authored and persisted copy policy', () => {
  it.each([true, false])('preserves explicit Poison copy permission %s', (flag) => {
    expect(instance(poison(world(), 'actor', 0, flag))).toHaveProperty('curseCopyable', flag)
  })
  it('keeps the exact old Poison shape when copy permission is omitted', () => {
    // Explicit undefined must not be replaced by the helper default.
    const unflagged = {
      ...action(),
      id: 'test.poison',
      cost: { spendsAction: false, mp: 0 },
      effects: [{ type: 'poison' as const, recipient: 'primary-unit' as const }],
    }
    const result = executeCombatAction(
      world(),
      unflagged,
      { kind: 'unit', combatantId: 'actor' },
      CONTENT,
    )
    expect(instance(result.state)).toEqual({
      targetCombatantId: 'actor',
      sourceCombatantId: 'actor',
      sourceActionId: 'test.poison',
      profileVersion: 1,
      movementRemainder: 0,
    })
  })
  it('reapplication replaces copy permission instead of retaining a previous opt-in', () => {
    expect(instance(poison(poison(world()), 'actor', 0, false))).toHaveProperty(
      'curseCopyable',
      false,
    )
  })
  const malformed = [null, 0, 1, 'true', {}, [], NaN]
  it.each(malformed)(
    'rejects malformed authored copy permission %j at both action boundaries',
    (flag) => {
      const definition = poisonAction(flag)
      expect(() => validateCombatActionDefinition(definition, CONTENT)).toThrow()
      expect(() => evaluateCombatAction(world(), definition, TARGET, CONTENT)).toThrow()
      expect(() => executeCombatAction(world(), definition, TARGET, CONTENT)).toThrow()
    },
  )
  it.each(malformed)('rejects malformed persisted Poison copy permission %j', (flag) => {
    const state = poison(world())
    const changed = {
      ...state,
      effectState: {
        ...state.effectState!,
        poison: state.effectState!.poison.map((entry) => ({ ...entry, curseCopyable: flag })),
      },
    } as unknown as CombatEncounterState
    expect(validateCombatEncounterState(changed).length).toBeGreaterThan(0)
    expect(() => cast(changed)).toThrow()
  })
})

describe('Curse Poison: real command and saved-state behavior', () => {
  it.each([0, 1, 2, 3, 4])(
    'copies current movement counter %s and keeps the original',
    (counter) => {
      const state = poison(world(), 'actor', counter)
      const before = JSON.stringify(state)
      const result = cast(state)
      expect(instance(result.state, 'target')).toMatchObject({
        movementRemainder: counter,
        sourceCombatantId: 'actor',
        sourceActionId: 'test.curse',
        profileVersion: 1,
        curseCopyable: true,
      })
      expect(instance(result.state)).toBe(instance(state))
      expect(JSON.stringify(state)).toBe(before)
      expect(result.events.some((event) => event.event === 'damage_applied')).toBe(false)
      expect(validateCombatEncounterState(result.state)).toEqual([])
    },
  )
  const pairs = [0, 1, 2, 3, 4].flatMap((donor) =>
    [0, 1, 2, 3, 4].map((receiver) => ({ donor, receiver })),
  )
  it.each(pairs)(
    'reapplication keeps one recipient instance and its own counter: %j',
    ({ donor, receiver }) => {
      const state = poison(poison(world(), 'actor', donor), 'target', receiver, false)
      const result = cast(state, context())
      expect(
        result.state.effectState?.poison.filter((entry) => entry.targetCombatantId === 'target'),
      ).toHaveLength(1)
      expect(instance(result.state, 'target')).toMatchObject({
        movementRemainder: receiver,
        sourceCombatantId: 'actor',
        sourceActionId: 'test.curse',
        curseCopyable: true,
      })
      expect(instance(result.state).movementRemainder).toBe(donor)
    },
  )
  it('does not copy an explicitly excluded Poison', () => {
    const state = poison(world(), 'actor', 4, false)
    expect(evaluateCombatAction(state, action(), TARGET, CONTENT).legal).toBe(false)
    expect(() => cast(state)).toThrow()
  })
  it('does not infer copy eligibility for historical Poison lacking metadata', () => {
    const state = poison(world())
    const { curseCopyable: ignored, ...old } = { ...instance(state), curseCopyable: true }
    void ignored
    const historical = { ...state, effectState: { ...state.effectState!, poison: [old] } }
    expect(evaluateCombatAction(historical, action(), TARGET, CONTENT).legal).toBe(false)
  })
  it('never treats Poison as an Amplify-positive effect', () => {
    const state = poison(world(), 'target', 4)
    expect(evaluateCombatAction(state, action('amplify'), TARGET, CONTENT).legal).toBe(false)
    expect(() => cast(state, undefined, 'amplify')).toThrow()
  })
  it('rejects self-copy without spending resources', () => {
    const state = poison(world())
    const before = JSON.stringify(state)
    expect(() =>
      executeCombatAction(state, action(), { kind: 'unit', combatantId: 'actor' }, CONTENT),
    ).toThrow()
    expect(JSON.stringify(state)).toBe(before)
  })
  it('does not roll or mutate state while previewing a legal Poison-only Curse', () => {
    const state = poison(world(), 'actor', 4)
    const before = JSON.stringify(state)
    const result = evaluateCombatAction(state, action(), TARGET, CONTENT)
    expect(result.legal).toBe(true)
    expect(
      result.projectedEffects.some(
        (effect) => effect.effectType === 'copy-statuses' && effect.combatantId === 'target',
      ),
    ).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('spends normal resources on a missed Curse but preserves both Poison histories', () => {
    const state = withOrigin(
      poison(poison(world(0), 'actor', 4), 'target', 2),
      'target',
      'chain:existing',
    )
    const rolled = { ...action(), accuracyMode: 'per-target' as const }
    const result = executeCombatAction(state, rolled, TARGET, CONTENT, context())
    expect(result.state.effectState?.poison).toEqual(state.effectState?.poison)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(16)
  })
  it('keeps Automatic Hit automatic for Poison copying', () => {
    const state = poison(world(0))
    const result = executeCombatAction(
      state,
      { ...action(), accuracyMode: 'automatic' },
      TARGET,
      CONTENT,
    )
    expect(instance(result.state, 'target').movementRemainder).toBe(0)
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })
  it('rebinds source and preserves immediate donor plus prior receiver lineage', () => {
    let state = poison(poison(world(), 'actor', 4), 'target', 2)
    state = withOrigin(withOrigin(state, 'actor', 'chain:donor'), 'target', 'chain:receiver')
    const donor = instance(state)
    const receiver = instance(state, 'target')
    const result = cast(state, context())
    expect(instance(result.state, 'target').provenance).toMatchObject({
      effectOrdinal: 0,
      copyOrdinal: 0,
      copiedFromInstanceId: donor.provenance?.instanceId,
      inheritedFromInstanceId: receiver.provenance?.instanceId,
      action: { sourceCombatantId: 'actor', actionDefinitionId: 'test.curse' },
    })
    expect(instance(result.state)).toBe(donor)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('never reuses the donor provenance after copying without a context', () => {
    const state = withOrigin(poison(world(), 'actor', 4), 'actor', 'chain:donor')
    expect(instance(cast(state).state, 'target')).not.toHaveProperty('provenance')
  })
  it('assigns distinct ordinals when the same Curse copies an ordinary status and Poison', () => {
    const base = poison(world(), 'actor', 4)
    const state = {
      ...base,
      statusState: base.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'test.negative',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'other',
                },
              ],
            }
          : row,
      ),
    }
    const result = cast(state, context())
    const status = result.state.statusState.find((row) => row.combatantId === 'target')?.statuses[0]
    const copied = instance(result.state, 'target')
    expect(status?.provenance?.copyOrdinal).toBe(0)
    expect(copied.provenance).toMatchObject({ copyOrdinal: 1, effectOrdinal: 0 })
    expect(copied.provenance?.instanceId).not.toBe(status?.provenance?.instanceId)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('round-trips counters, policy and lineage through saved JSON', () => {
    const result = cast(poison(world(), 'actor', 4), context())
    const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    expect(restored).toEqual(result.state)
    expect(instance(restored, 'target')).toHaveProperty('curseCopyable', true)
  })
  it('continues the copied movement counter at the existing five-tile threshold', () => {
    const copied = cast(poison(world(), 'actor', 4), context()).state
    const advanced = advanceCurrentPoisonMovement(copied, 'target', 1)
    expect(advanced.triggeredTicks).toBe(1)
    expect(instance(advanced.state, 'target').movementRemainder).toBe(0)
    expect(instance(advanced.state).movementRemainder).toBe(4)
  })
  it('uses the existing periodic tick after copy, without immediate extra damage', () => {
    let state = cast(poison(world(), 'actor', 4), context()).state
    expect(state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(100)
    state = advance(advance(state))
    expect(state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(98)
    expect(instance(state, 'target').movementRemainder).toBe(4)
  })
  it('removes a copied Poison using the existing removal path', () => {
    const copied = cast(poison(world()), context()).state
    const cleared = removeCurrentPoisonState(copied, 'target')
    expect(currentPoisonInstance(cleared, 'target')).toBeNull()
    expect(currentPoisonInstance(cleared, 'actor')).not.toBeNull()
  })
})
