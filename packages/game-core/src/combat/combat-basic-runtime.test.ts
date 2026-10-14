import { describe, expect, it } from 'vitest'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  type BasicSkillDefinition,
} from './combat-basic-actions'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  executePv1fAction,
  evaluatePv1fAction,
  executePv1fMovement,
  evaluatePv1fMovement,
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import type { SupportActionId } from './support-actions'

function fixture(
  definitions = defaultBasicSkills(),
  supportActionId: SupportActionId = 'basic.guard',
) {
  const base = percentageDotEncounter()
  const sources = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId,
    definitions,
  })
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      preparePv1fTurnEconomy({
        ...base,
        tactical: {
          ...base.tactical,
          battle: {
            ...base.tactical.battle,
            combatants: base.tactical.battle.combatants.map((unit) =>
              unit.id === 'actor' ? { ...unit, maxHp: 715, hp: 400, maxMp: 15, mp: 3 } : unit,
            ),
          },
        },
      }),
      sources,
    ),
    base.statBridge,
  )
  return { state, sources }
}
function edit(
  id: BasicSkillDefinition['id'],
  update: (row: BasicSkillDefinition) => BasicSkillDefinition,
) {
  return defaultBasicSkills().map((row) => (row.id === id ? update(row) : row))
}
function actor(state: ReturnType<typeof fixture>['state']) {
  return state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
}
function ap(state: ReturnType<typeof fixture>['state']) {
  return actor(state).temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current
}

describe('captured Basic definitions reach the real action facade', () => {
  it('uses edited HP recovery cost, percentage and cooldown while preserving old captures', () => {
    const old = fixture(defaultBasicSkills(), 'basic.recover')
    const next = fixture(
      edit('basic.recover', (row) => ({
        ...row,
        contentVersion: 2,
        ability: {
          ...row.ability,
          behaviors: row.ability.behaviors.map((behavior) => ({
            ...behavior,
            costs: [{ resource: 'ap', amount: 35 }],
            cooldown: { key: 'basic.recovery', ownerTurns: 3 },
            effects: [
              {
                id: 'recovery',
                payload: {
                  type: 'percentage-recovery',
                  recipient: 'actor',
                  resource: 'hp',
                  percentageBasisPoints: 2500,
                },
              },
            ],
          })),
        },
      })),
      'basic.recover',
    )
    const oldCast = executePv1fAction(old.state, 'basic.recover', { kind: 'self' })
    const cast = executePv1fAction(next.state, 'basic.recover', { kind: 'self' })
    expect(actor(oldCast.state).hp).toBe(472)
    expect(ap(oldCast.state)).toBe(50)
    expect(actor(cast.state).hp).toBe(579)
    expect(ap(cast.state)).toBe(65)
    expect(cast.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_started',
        cooldownKey: 'basic.recovery',
        ticksRemaining: 4,
      }),
    )
  })

  it('uses edited MP Recovery and nearest native rounding', () => {
    const { state } = fixture(
      edit('basic.recover.mp', (row) => ({
        ...row,
        contentVersion: 2,
        ability: {
          ...row.ability,
          behaviors: row.ability.behaviors.map((behavior) => ({
            ...behavior,
            costs: [{ resource: 'ap', amount: 40 }],
            effects: [
              {
                id: 'recovery',
                payload: {
                  type: 'percentage-recovery',
                  recipient: 'actor',
                  resource: 'mp',
                  percentageBasisPoints: 3500,
                },
              },
            ],
          })),
        },
      })),
      'basic.recover.mp',
    )
    const cast = executePv1fAction(state, 'basic.recover.mp', { kind: 'self' })
    expect(actor(cast.state).mp).toBe(8)
    expect(ap(cast.state)).toBe(60)
  })

  it('uses edited Guard stacks, duration and cost instead of the fallback', () => {
    const { state } = fixture(
      edit('basic.guard', (row) => ({
        ...row,
        contentVersion: 2,
        ability: {
          ...row.ability,
          behaviors: row.ability.behaviors.map((behavior) => ({
            ...behavior,
            costs: [{ resource: 'ap', amount: 15 }],
            effects: [
              {
                id: 'guard',
                payload: {
                  type: 'apply-status',
                  recipient: 'actor',
                  statusId: 'guarded',
                  stacks: 2,
                  durationTurns: 3,
                },
              },
            ],
          })),
        },
      })),
    )
    const cast = executePv1fAction(state, 'basic.guard', { kind: 'self' })
    expect(ap(cast.state)).toBe(85)
    expect(
      cast.state.statusState.find((row) => row.combatantId === 'actor')!.statuses,
    ).toContainEqual(
      expect.objectContaining({ statusId: 'guarded', stacks: 2, remainingOwnerTurnStarts: 4 }),
    )
  })

  it('keeps stat-derived Basic Attack with edited base power/cost and the committed higher family', () => {
    const { state } = fixture(
      edit('unarmed.basic', (row) => ({
        ...row,
        contentVersion: 2,
        ability: {
          ...row.ability,
          behaviors: row.ability.behaviors.map((behavior) => ({
            ...behavior,
            costs: [{ resource: 'ap', amount: 45 }],
            effects: behavior.effects.map((effect) =>
              effect.payload.type === 'damage'
                ? { ...effect, payload: { ...effect.payload, amount: 17 } }
                : effect,
            ),
          })),
        },
      })),
    )
    const strongerMystic = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'actor' ? { ...row, physicalPower: 20, mysticPower: 100 } : row,
        ),
      },
    }
    const quote = evaluatePv1fAction(strongerMystic, 'basic.attack.unarmed.basic', {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(quote.cost).toBe(45)
    expect(quote.action.tags).toContain('mystic')
    expect(quote.action.effects[0]).toEqual(
      expect.objectContaining({ type: 'damage', amount: 32, defenseKind: 'ward' }),
    )
    const cast = executePv1fAction(strongerMystic, 'basic.attack.unarmed.basic', {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(ap(cast.state)).toBe(55)
    expect(cast.events).toContainEqual(
      expect.objectContaining({
        event: 'combat_action_used',
        actionId: 'basic.attack.unarmed.basic',
      }),
    )
    expect(
      state.capturedAbilitySources!.find((row) => row.abilityId === 'unarmed.basic')!.definition
        .behaviors[0]!.attackFamily,
    ).toBe('physical')
  })

  it('rejects an unequipped or disabled Support without paying', () => {
    const { state } = fixture()
    expect(() => executePv1fAction(state, 'basic.recover.mp', { kind: 'self' })).toThrow(
      /captur|equipped/i,
    )
    const disabled = fixture(edit('basic.guard', (row) => ({ ...row, enabled: false })))
    expect(() => executePv1fAction(disabled.state, 'basic.guard', { kind: 'self' })).toThrow(
      /disabled/i,
    )
    expect(ap(disabled.state)).toBe(100)
  })
})

it.each([0, 25])(
  'bounds a zero-AP offensive Basic Move, including a miss; positive AP %s repeats',
  (cost) => {
    const definitions = edit('basic.move', (row) => ({
      ...row,
      execution: { kind: 'basic-move', costBasis: 'flat' },
      ability: {
        ...row.ability,
        behaviors: row.ability.behaviors.map((behavior) => ({
          ...behavior,
          costs: cost ? [{ resource: 'ap', amount: cost }] : [],
          classification: 'attack',
          attackFamily: 'physical',
          accuracy: { kind: 'fixed', chanceBasisPoints: 0 },
          targeting: {
            ...behavior.targeting!,
            kind: 'unit',
            categories: ['enemy'],
            teamPolicy: 'enemy',
            friendlyFire: 'enemies-only',
            maximumRange: 3,
          },
          effects: [
            ...behavior.effects,
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } },
          ],
        })),
      },
    }))
    const { state, sources } = fixture(definitions)
    const initial = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((row) =>
          row.combatantId === 'enemy'
            ? { ...row, position: { x: 3, y: 1 } }
            : row.combatantId === 'other'
              ? { ...row, position: { x: 4, y: 4 } }
              : row,
        ),
      },
    }
    const source = sources[0]!
    const input = {
      state: initial,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source },
      selection: { kind: 'unit' as const, combatantId: 'enemy' },
      movementPath: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(initial, source),
    }
    expect(() => commitCombatAbilityCommand({ ...input, movementPath: [] })).toThrow()
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const cast = commitCombatAbilityCommand(input)
    expect(cast.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(1000)
    const repeated = {
      ...input,
      state: cast.state,
      movementPath: [
        { x: 2, y: 1 },
        { x: 1, y: 1 },
      ],
      context: combatAbilityCommandContext(cast.state, source),
    }
    expect(prepareCombatAbilityCommand(repeated).evaluation.legal).toBe(cost > 0)
    if (cost)
      expect(
        commitCombatAbilityCommand(repeated).state.tactical.battle.currentTurn!.movementRemaining,
      ).toBe(2)
    else expect(() => commitCombatAbilityCommand(repeated)).toThrow()
  },
)

it('shares the free offensive Move bound across different Manual groups', () => {
  const definitions = edit('basic.move', (row) => {
    const use = {
      ...row.ability.behaviors[0]!,
      costs: [],
      classification: 'attack' as const,
      attackFamily: 'physical' as const,
      targeting: {
        ...row.ability.behaviors[0]!.targeting!,
        kind: 'unit' as const,
        categories: ['enemy' as const],
        teamPolicy: 'enemy' as const,
        friendlyFire: 'enemies-only' as const,
        maximumRange: 3,
      },
      effects: [
        ...row.ability.behaviors[0]!.effects,
        {
          id: 'hit',
          payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 },
        },
      ],
    }
    return {
      ...row,
      execution: { kind: 'basic-move', costBasis: 'flat' },
      ability: { ...row.ability, behaviors: [use, { ...use, id: 'alternative' }] },
    }
  })
  const { state, sources } = fixture(definitions)
  const initial = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'enemy'
          ? { ...row, position: { x: 3, y: 1 } }
          : row.combatantId === 'other'
            ? { ...row, position: { x: 4, y: 4 } }
            : row,
      ),
    },
  }
  const source = sources[0]!
  const input = {
    state: initial,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source, behaviorId: 'use' },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    movementPath: [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(initial, source),
  }
  const cast = commitCombatAbilityCommand(input)
  const next = {
    ...input,
    state: cast.state,
    root: { ...input.root, behaviorId: 'alternative' },
    movementPath: [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ],
    context: combatAbilityCommandContext(cast.state, source),
  }
  expect(prepareCombatAbilityCommand(next).evaluation.legal).toBe(false)
  expect(() => commitCombatAbilityCommand(next)).toThrow()
})

it('passes a flat Basic Move path through the actual action facade without a surcharge', () => {
  const definitions = edit('basic.move', (row) => ({
    ...row,
    execution: { kind: 'basic-move', costBasis: 'flat' },
    ability: {
      ...row.ability,
      behaviors: row.ability.behaviors.map((behavior) => ({
        ...behavior,
        costs: [{ resource: 'ap', amount: 23 }],
        effects: [
          ...behavior.effects,
          { id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 17 } },
        ],
      })),
    },
  }))
  const { state } = fixture(definitions)
  const options = {
    manualModifiers: [],
    movementPath: [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ],
  }
  const cast = executePv1fAction(state, 'basic.move', { kind: 'self' }, options)
  expect(
    cast.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
  ).toEqual({ x: 1, y: 0 })
  expect(actor(cast.state).hp).toBe(417)
  expect(ap(cast.state)).toBe(77)
  expect(
    cast.events.filter(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        event.event === 'ap_spent',
    ),
  ).toHaveLength(1)
})

describe('captured native Basic Move pricing', () => {
  const path = [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]
  it('uses the captured traversal price and entered-tile cap for quote and payment', () => {
    const old = fixture()
    const edited = fixture(
      edit('basic.move', (row) => ({
        ...row,
        contentVersion: 2,
        ability: {
          ...row.ability,
          behaviors: row.ability.behaviors.map((behavior) => ({
            ...behavior,
            costs: [{ resource: 'ap', amount: 40 }],
            effects: behavior.effects.map((effect) =>
              effect.payload.type === 'move'
                ? { ...effect, payload: { ...effect.payload, maximumTiles: 1 } }
                : effect,
            ),
          })),
        },
      })),
    )
    expect(evaluatePv1fMovement(old.state, path).economyCost).toBe(20)
    expect(evaluatePv1fMovement(edited.state, path).economyCost).toBe(40)
    expect(ap(executePv1fMovement(old.state, path).state)).toBe(80)
    expect(ap(executePv1fMovement(edited.state, path).state)).toBe(60)
    const tooLong = [...path, { x: 2, y: 0 }]
    expect(evaluatePv1fMovement(edited.state, tooLong).movement.legal).toBe(false)
    expect(() => executePv1fMovement(edited.state, tooLong)).toThrow(/cap/i)
    expect(ap(edited.state)).toBe(100)
  })
  it('reports a disabled native Move as illegal without spending', () => {
    const { state } = fixture(edit('basic.move', (row) => ({ ...row, enabled: false })))
    expect(evaluatePv1fMovement(state, path).movement.legal).toBe(false)
    expect(() => executePv1fMovement(state, path)).toThrow(/disabled/i)
    expect(ap(state)).toBe(100)
  })
})

it('quotes a disabled Support as unavailable without failing the availability reader', () => {
  const { state } = fixture(edit('basic.guard', (row) => ({ ...row, enabled: false })))
  const quote = evaluatePv1fAction(state, 'basic.guard', { kind: 'self' })
  expect(quote.evaluation.legal).toBe(false)
  expect(quote.evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'source-disabled' }),
  )
  expect(ap(state)).toBe(100)
})

it('rejects an attached walking path on a historical non-Move action instead of ignoring intent', () => {
  const base = percentageDotEncounter()
  expect(() =>
    evaluatePv1fAction(
      base,
      'basic.guard',
      { kind: 'self' },
      {
        movementPath: [
          { x: 1, y: 1 },
          { x: 1, y: 0 },
        ],
      },
    ),
  ).toThrow(/move|path/i)
})
