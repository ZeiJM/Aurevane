import { pendingCombatStatusRows } from './combat-effect-timing'
import { expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { selectCurrentFinalFacing } from './board'
import { resolveMatureSkillVersion, toCombatActionDefinition } from './mature-skills'
const content = { statuses: [] }
const hexCatalog = {
  statuses: [
    {
      id: 'test.hex',
      version: 1,
      maximumStacks: 3,
      durationOwnerTurnStarts: 10,
      damageTakenMultiplierBasisPoints: 10000,
      gameplayTags: ['Hexed' as const],
    },
  ],
}
function recoveryRecipient(
  current: boolean,
  potencyBasisPoints = 2500,
  stacks = 1,
): CombatEncounterState {
  const state: CombatEncounterState = {
    ...percentageDotEncounter(),
    ...(current ? { healingDownPolicyVersion: 1 as const } : {}),
  }
  const actor = state.tactical.battle.combatants[0]!
  actor.hp = 100
  actor.mp = 0
  actor.maxMp = 200
  const statusRow = {
    combatantId: 'actor',
    statuses: [
      {
        statusId: 'test.hex',
        statusVersion: 1,
        sourceCombatantId: 'enemy',
        stacks,
        remainingOwnerTurnStarts: 10,
        potencyBasisPoints,
      },
    ],
  }
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'actor' ? statusRow : row,
  )
  return state
}
const action: CombatActionDefinition = {
  id: 'test.percentage-recovery',
  version: 1,
  sourceType: 'test',
  tags: [],
  cost: { mp: 0, spendsAction: false },
  requirements: [],
  target: {
    kind: 'self',
    teamPolicy: 'self',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 0,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'allies-only',
  },
  effects: [
    { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10, ticks: 2 },
  ],
}
it.each(['hp', 'mp'] as const)(
  'Healing Down cuts captured %s recovery once across delayed activation and ticks',
  (resource) => {
    const base = {
      ...recoveryRecipient(true),
      effectTimingPolicy: {
        version: 2,
        modes: { healing: 'delayed' as const, 'mp-recovery': 'delayed' as const },
      },
    }
    const skill: CombatActionDefinition = {
      ...action,
      effects: [
        { type: 'percentage-recovery', recipient: 'actor', resource, percent: 10, ticks: 2 },
      ],
    }
    const preview = evaluateCombatAction(base, skill, { kind: 'self' }, hexCatalog)
    const cast = executeCombatAction(base, skill, { kind: 'self' }, hexCatalog)
    const amount = resource === 'hp' ? 75 : 15
    expect(
      cast.state.pendingEffects![0]!.percentageRecoveryByRecipient!.actor!.amountPerApplication,
    ).toBe(amount)
    expect(preview.legal).toBe(true)
    let state = JSON.parse(JSON.stringify(cast.state)) as CombatEncounterState
    state.statusState = state.statusState.map((row) => ({ ...row, statuses: [] }))
    const before = state.tactical.battle.combatants[0]![resource]
    while (state.tactical.battle.round < 5)
      state = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        hexCatalog,
      ).state
    expect(state.tactical.battle.combatants[0]![resource]).toBe(before + 2 * amount)
    expect(validateCombatEncounterState(state)).toEqual([])
  },
)
it.each([
  [2500, 1, 30],
  [1000, 2, 32],
] as const)(
  'cuts flat HP and MP recovery using %i potency/%i applications',
  (potency, stacks, amount) => {
    const state = recoveryRecipient(true, potency, stacks)
    const skill: CombatActionDefinition = {
      ...action,
      effects: [
        { type: 'healing', recipient: 'actor', amount: 40 },
        { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 40 },
      ],
    }
    const result = executeCombatAction(state, skill, { kind: 'self' }, hexCatalog)
    expect(
      evaluateCombatAction(state, skill, { kind: 'self' }, hexCatalog).projectedEffects,
    ).toContainEqual({
      effectType: 'resource-change',
      combatantId: 'actor',
      before: 0,
      after: amount,
    })
    expect(result.state.tactical.battle.combatants[0]!.hp).toBe(100 + amount)
    expect(result.state.tactical.battle.combatants[0]!.mp).toBe(amount)
    const drained = executeCombatAction(
      result.state,
      {
        ...skill,
        effects: [{ type: 'resource-change', recipient: 'actor', resource: 'mp', delta: -10 }],
      },
      { kind: 'self' },
      hexCatalog,
    )
    expect(drained.state.tactical.battle.combatants[0]!.mp).toBe(amount - 10)
  },
)
it('preserves historical MP recovery while HP Healing Down remains active', () => {
  const result = executeCombatAction(
    recoveryRecipient(false),
    {
      ...action,
      effects: [
        { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10 },
        { type: 'percentage-recovery', recipient: 'actor', resource: 'mp', percent: 10 },
      ],
    },
    { kind: 'self' },
    hexCatalog,
  )
  expect(result.state.tactical.battle.combatants[0]!.hp).toBe(175)
  expect(result.state.tactical.battle.combatants[0]!.mp).toBe(20)
})
function end(state: CombatEncounterState) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    content,
  ).state
}
function round(state: CombatEncounterState) {
  const initial = state.tactical.battle.round
  while (state.tactical.battle.round === initial) state = end(state)
  return JSON.parse(JSON.stringify(state)) as CombatEncounterState
}
it('captures recipient maximum once and repeats the same amount without double ticking the caster', () => {
  let state: CombatEncounterState = percentageDotEncounter()
  state.tactical.battle.combatants[0]!.hp = 100
  state = executeCombatAction(state, action, { kind: 'self' }, content).state
  expect(state.tactical.battle.combatants[0]!.hp).toBe(200)
  expect(state.effectState!.ongoingRecovery[0]!.percentageRecovery).toEqual({
    resource: 'hp',
    percent: 10,
    maximumAtCast: 1000,
    amountPerApplication: 100,
  })
  state = round(state)
  expect(state.tactical.battle.combatants[0]!.hp).toBe(200)
  state.tactical.battle.combatants[0]!.maxHp = 2000
  expect(validateCombatEncounterState(state)).toEqual([])
  state = end(state)
  expect(state.tactical.battle.combatants[0]!.hp).toBe(300)
  expect(state.effectState!.ongoingRecovery).toHaveLength(0)
})
it('captures pending recovery at cast, not at activation after max changes', () => {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { healing: 'delayed' } },
  }
  state.tactical.battle.combatants[0]!.hp = 100
  state = executeCombatAction(
    state,
    {
      ...action,
      effects: [
        { type: 'percentage-recovery', recipient: 'actor', resource: 'hp', percent: 10, ticks: 1 },
      ],
    },
    { kind: 'self' },
    content,
  ).state
  expect(state.pendingEffects![0]!.percentageRecoveryByRecipient!.actor!.maximumAtCast).toBe(1000)
  state.tactical.battle.combatants[0]!.maxHp = 2000
  state = round(round(state))
  expect(state.tactical.battle.combatants[0]!.hp).toBe(200)
})
it('caps actual HP and MP gains, never revives and supports zero max MP', () => {
  for (const [resource, before, maximum, expected] of [
    ['hp', 990, 1000, 1000],
    ['mp', 19, 20, 20],
    ['mp', 0, 0, 0],
  ] as const) {
    let state = percentageDotEncounter()
    const actor = state.tactical.battle.combatants[0]!
    actor[resource] = before
    if (resource === 'mp') actor.maxMp = maximum
    state = executeCombatAction(
      state,
      {
        ...action,
        effects: [{ type: 'percentage-recovery', recipient: 'actor', resource, percent: 10 }],
      },
      { kind: 'self' },
      content,
    ).state as typeof state
    expect(state.tactical.battle.combatants[0]![resource]).toBe(expected)
  }
})

it('captures distinct ally maxima and HP Hex once through all four applications', () => {
  let state: CombatEncounterState = percentageDotEncounter()
  const actor = state.tactical.battle.combatants.find((u) => u.id === 'actor')!
  actor.hp = 100
  const ally = state.tactical.battle.combatants.find((u) => u.id === 'ally')!
  ally.hp = 100
  ally.maxHp = 500
  const hex = {
    id: 'test.hex',
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 10,
    damageTakenMultiplierBasisPoints: 10000,
    gameplayTags: ['Hexed' as const],
  }
  const catalog = { statuses: [hex] }
  state.statusState = state.statusState.map((r) =>
    r.combatantId === 'ally'
      ? {
          ...r,
          statuses: [
            {
              statusId: hex.id,
              statusVersion: 1,
              sourceCombatantId: 'enemy',
              stacks: 1,
              remainingOwnerTurnStarts: 10,
              potencyBasisPoints: 2500,
            },
          ],
        }
      : r,
  )
  const definition: CombatActionDefinition = {
    ...action,
    target: {
      ...action.target,
      geometryVersion: 2,
      kind: 'unit',
      teamPolicy: 'ally',
      shape: { kind: 'all' },
      friendlyFire: 'allies-only',
    },
    effects: [
      {
        type: 'percentage-recovery',
        recipient: 'affected-units',
        resource: 'hp',
        percent: 10,
        ticks: 4,
      },
    ],
  }
  state = executeCombatAction(state, definition, { kind: 'activate' }, catalog).state
  expect(state.tactical.battle.combatants.find((u) => u.id === 'actor')!.hp).toBe(200)
  expect(state.tactical.battle.combatants.find((u) => u.id === 'ally')!.hp).toBe(137)
  state.statusState = state.statusState.map((r) => ({ ...r, statuses: [] }))
  state.tactical.battle.combatants.find((u) => u.id === 'ally')!.maxHp = 2000
  // Follow the real turn boundary resolver, with each target's own turn end.
  for (let step = 0; step < 16; step++) {
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      catalog,
    ).state
    state = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  }
  expect(state.tactical.battle.combatants.find((u) => u.id === 'actor')!.hp).toBe(500)
  expect(state.tactical.battle.combatants.find((u) => u.id === 'ally')!.hp).toBe(248)
  expect(state.effectState!.ongoingRecovery).toHaveLength(0)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('rejects invalid percentage authoring and corrupt saved captures', () => {
  for (const tuning of [
    { percent: 0 },
    { percent: 101 },
    { percent: 1.5 },
    { percent: NaN },
    { ticks: 0 },
    { ticks: 5 },
    { resource: 'sp' },
    { power: 10 },
    { durationTurns: 4 },
  ])
    expect(() =>
      executeCombatAction(
        percentageDotEncounter(),
        {
          ...action,
          effects: [
            {
              type: 'percentage-recovery',
              recipient: 'actor',
              resource: 'hp',
              percent: 10,
              ticks: 2,
              ...tuning,
            },
          ],
        } as CombatActionDefinition,
        { kind: 'self' },
        content,
      ),
    ).toThrow()
  const state = executeCombatAction(
    percentageDotEncounter(),
    action,
    { kind: 'self' },
    content,
  ).state
  state.effectState!.ongoingRecovery[0]!.percentageRecovery!.amountPerApplication = 999
  expect(
    validateCombatEncounterState(state).some((i) => i.field === 'effectState.ongoingRecovery'),
  ).toBe(true)
})
it('does not revive a defeated pending recipient or keep its future recovery', () => {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 2, modes: { healing: 'delayed' } },
  }
  const definition: CombatActionDefinition = {
    ...action,
    target: { ...action.target, kind: 'unit', teamPolicy: 'ally', maximumRange: 5 },
    effects: [
      {
        type: 'percentage-recovery',
        recipient: 'primary-unit',
        resource: 'hp',
        percent: 10,
        ticks: 3,
      },
    ],
  }
  state = executeCombatAction(
    state,
    definition,
    { kind: 'unit', combatantId: 'ally' },
    content,
  ).state
  state.tactical.battle.combatants.find((u) => u.id === 'ally')!.hp = 0
  state = round(round(state))
  expect(state.tactical.battle.combatants.find((u) => u.id === 'ally')!.hp).toBe(0)
  expect(state.pendingEffects).toHaveLength(0)
  expect(state.effectState?.ongoingRecovery ?? []).toHaveLength(0)
})

it.each([1, 2, 4])(
  'reports all %i pending recovery applications and an instantaneous activation',
  (ticks) => {
    const initial = {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 2, modes: { healing: 'delayed' as const } },
    }
    const cast = executeCombatAction(
      initial,
      {
        ...action,
        effects: [
          {
            type: 'percentage-recovery',
            recipient: 'actor',
            resource: 'hp',
            percent: 10,
            ticks,
            durationTurns: ticks - 1,
          },
        ],
      },
      { kind: 'self' },
      content,
    )
    expect(pendingCombatStatusRows(cast.state)[0]!.status).toMatchObject({
      remainingOwnerTurnStarts: ticks,
      durationScope: 'instant',
    })
  },
)

it.each(['pve', 'pvp'] as const)(
  'Healing Down cuts actual Fieldcraft HP and MP in %s',
  (context) => {
    const skill = toCombatActionDefinition(
      resolveMatureSkillVersion('farstrider.fieldcraft')!,
      context,
    )
    const state = recoveryRecipient(true, 1400)
    const actor = state.tactical.battle.combatants[0]!
    actor.maxHp = 100
    actor.hp = 20
    actor.maxMp = 20
    const baseline = executeCombatAction(
      { ...state, statusState: state.statusState.map((row) => ({ ...row, statuses: [] })) },
      skill,
      { kind: 'self' },
      hexCatalog,
    )
    const result = executeCombatAction(state, skill, { kind: 'self' }, hexCatalog)
    const restored = baseline.state.tactical.battle.combatants[0]!
    const reduced = result.state.tactical.battle.combatants[0]!
    expect(restored.hp - actor.hp).toBeGreaterThan(0)
    expect(restored.mp).toBeGreaterThan(0)
    expect(reduced.hp - actor.hp).toBe(Math.floor((restored.hp - actor.hp) * 0.86))
    expect(reduced.mp).toBe(Math.floor(restored.mp * 0.86))
    expect(reduced.mp).toBeLessThan(restored.mp)
  },
)
it('Healing Down reduces flat periodic MP, rounds down and keeps resource caps', () => {
  let state = recoveryRecipient(true)
  const skill: CombatActionDefinition = {
    ...action,
    effects: [{ type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 3, ticks: 2 }],
  }
  state = executeCombatAction(state, skill, { kind: 'self' }, hexCatalog).state
  expect(state.tactical.battle.combatants[0]!.mp).toBe(2)
  while (state.tactical.battle.round < 3)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      hexCatalog,
    ).state
  expect(state.tactical.battle.combatants[0]!.mp).toBe(4)
  state.tactical.battle.combatants[0]!.mp = 199
  const capped = executeCombatAction(
    state,
    {
      ...skill,
      effects: [{ type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 3 }],
    },
    { kind: 'self' },
    hexCatalog,
  )
  expect(capped.state.tactical.battle.combatants[0]!.mp).toBe(200)
})
