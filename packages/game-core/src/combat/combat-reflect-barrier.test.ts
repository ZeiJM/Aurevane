import { expect, it } from 'vitest'
import {
  executeCombatAction,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
import { selectCurrentFinalFacing } from './board'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { capturedResonanceAbilitySource } from './combat-action-source'
import { resolveResonanceForPair } from './resonance'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { applyCommittedReflect } from './combat-reflect'

const hp = (state: CombatEncounterState, id: string) =>
  state.tactical.battle.combatants.find((unit) => unit.id === id)!.hp
function action(effects: CombatActionDefinition['effects']): CombatActionDefinition {
  return {
    id: 'test.barrier-reflect-hit',
    version: 1,
    sourceType: 'test',
    tags: [],
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      friendlyFire: 'all-units',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 5,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects,
  }
}
function cast(
  state: CombatEncounterState,
  effects: CombatActionDefinition['effects'],
  target = 'enemy',
) {
  return executeCombatAction(
    state,
    action(effects),
    { kind: 'unit', combatantId: target },
    PV1F_COMBAT_CONTENT,
  )
}
function prepared(
  current: boolean,
  barrier: number,
  kind: 'full' | 'physical' | 'mystic' = 'full',
) {
  const { reflectBarrierPolicyVersion: _policy, ...base } = percentageDotEncounter()
  void _policy
  let state: CombatEncounterState = {
    ...base,
    modularSkillPolicyVersion: 1,
    ...(current ? { reflectBarrierPolicyVersion: 1 } : {}),
  }
  state = cast(state, [
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'counter',
      stacks: 1,
      durationTurns: 2,
      counter: { kind, basisPoints: 10000 },
    },
  ]).state
  return barrier
    ? grantBarrier(state, 'enemy', 'enemy', 'test.defender-barrier', barrier).state
    : state
}
function returns(events: readonly { event: string; actionId?: string }[]) {
  return events.filter(
    (event) => event.event === 'damage_applied' && event.actionId === 'status.reflect.current.v1',
  )
}

it.each([
  { barrier: 100, amount: 40, targetHp: 1000, currentReturn: 40, oldReturn: 0 },
  { barrier: 15, amount: 40, targetHp: 1000, currentReturn: 40, oldReturn: 25 },
  { barrier: 0, amount: 40, targetHp: 1000, currentReturn: 40, oldReturn: 40 },
  { barrier: 15, amount: 100, targetHp: 5, currentReturn: 20, oldReturn: 5 },
  { barrier: 100, amount: 0, targetHp: 1000, currentReturn: 0, oldReturn: 0 },
])(
  'reflects actual HP plus Barrier damage only for the new policy: $barrier Barrier / $amount hit / $targetHp HP',
  ({ barrier, amount, targetHp, currentReturn, oldReturn }) => {
    for (const current of [false, true]) {
      const initial = prepared(current, barrier)
      const state = {
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy' ? { ...unit, hp: targetHp } : unit,
            ),
          },
        },
      }
      const before = JSON.stringify(state)
      const out = cast(state, [
        { type: 'damage', recipient: 'primary-unit', amount, defenseKind: 'armor' },
      ])
      expect(hp(out.state, 'actor')).toBe(1000 - (current ? currentReturn : oldReturn))
      expect(returns(out.events)).toHaveLength((current ? currentReturn : oldReturn) ? 1 : 0)
      expect(currentBarrierAmount(out.state, 'enemy')).toBe(Math.max(0, barrier - amount))
      expect(out.state.effectState?.damageHistory.some((row) => row.combatantId === 'actor')).toBe(
        false,
      )
      if (barrier >= amount)
        expect(
          out.state.effectState?.damageHistory.some((row) => row.combatantId === 'enemy'),
        ).toBe(false)
      expect(JSON.stringify(state)).toBe(before)
    }
  },
)

it('retains packet family eligibility when separate physical and mystic hits both reach Barrier', () => {
  const out = cast(prepared(true, 100, 'physical'), [
    { type: 'damage', recipient: 'primary-unit', amount: 13, defenseKind: 'armor' },
    { type: 'damage', recipient: 'primary-unit', amount: 17, defenseKind: 'ward' },
  ])
  expect(hp(out.state, 'actor')).toBe(987)
  expect(hp(out.state, 'enemy')).toBe(1000)
  expect(returns(out.events)).toHaveLength(1)
})

it('does not consume Barrier or Reflect a missed hostile packet', () => {
  const state = prepared(true, 100)
  const strike = {
    ...action([{ type: 'damage', recipient: 'primary-unit', amount: 40 }]),
    accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 0 },
  }
  const out = executeCombatAction(
    state,
    strike,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  expect(hp(out.state, 'actor')).toBe(1000)
  expect(hp(out.state, 'enemy')).toBe(1000)
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(100)
  expect(returns(out.events)).toEqual([])
})

it('does not return friendly damage or orphan Barrier absorption receipts', () => {
  let state = cast(
    prepared(true, 0),
    [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'counter',
        stacks: 1,
        durationTurns: 2,
        counter: { kind: 'full', basisPoints: 10000 },
      },
    ],
    'ally',
  ).state
  state = grantBarrier(state, 'ally', 'ally', 'friendly.shield', 100).state
  const friendly = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 40 }], 'ally')
  expect(hp(friendly.state, 'actor')).toBe(1000)
  expect(returns(friendly.events)).toEqual([])
  const orphan = applyCommittedReflect(
    state,
    [
      {
        event: 'barrier_absorbed',
        actionId: 'test.orphan',
        sourceCombatantId: 'actor',
        targetCombatantId: 'enemy',
        amount: 40,
        before: 100,
        after: 60,
      },
    ],
    PV1F_COMBAT_CONTENT,
    { sourceCombatantId: 'actor', actionId: 'test.orphan' },
  )
  expect(orphan.events).toEqual([])
  expect(orphan.state).toBe(state)
})

it('sums matching captured rates once across mixed-family Barrier packets', () => {
  const state = cast(prepared(true, 100, 'physical'), [
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'counter',
      stacks: 1,
      durationTurns: 2,
      counter: { kind: 'mystic', basisPoints: 20000 },
    },
  ]).state
  const out = cast(state, [
    { type: 'damage', recipient: 'primary-unit', amount: 13, defenseKind: 'armor' },
    { type: 'damage', recipient: 'primary-unit', amount: 17, defenseKind: 'ward' },
  ])
  expect(hp(out.state, 'actor')).toBe(953)
  expect(returns(out.events)).toHaveLength(1)
})

it('captures the reported Ultra Instinct Barrier + Full Reflect reaction before the next incoming hit', () => {
  const initial = prepared(true, 0)
  initial.statusState = initial.statusState.map((row) => ({ ...row, statuses: [] }))
  initial.tactical.battle.combatants = initial.tactical.battle.combatants.map((unit) =>
    unit.id === 'enemy' ? { ...unit, hp: 200 } : unit,
  )
  const current = resolveResonanceForPair('wildwarden', 'edgedancer')!
  const ultra = capturedResonanceAbilitySource(
    initial,
    'enemy',
    {
      ...current,
      id: 'resonance.ultra-instinct',
      name: 'Ultra Instinct',
      ability: source({
        id: 'main',
        activation: 'automatic',
        requirementMode: 'simple',
        automaticTrigger: 'damage-taken',
        automaticTarget: { subject: 'owner' },
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        cooldown: null,
        requirements: {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'hp',
          comparison: 'less-than',
          basisPoints: 2500,
        },
        activationLimits: ['once-per-battle'],
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          {
            id: 'barrier',
            timing: 'instant',
            payload: {
              type: 'barrier-change',
              recipient: 'actor',
              amount: 100,
              basis: 'maximum-hp-percent',
              durationTurns: 2,
            },
          },
          {
            id: 'reflect',
            timing: 'instant',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'counter',
              stacks: 1,
              counter: { kind: 'full', basisPoints: 10000 },
              durationTurns: 2,
            },
          },
        ],
      }).definition,
    },
    current.disciplinePair,
  )!
  const incoming = captureCombatAbilitySource(
    source(
      {
        id: 'hit',
        costs: [],
        cooldown: null,
        effects: [
          {
            id: 'damage',
            timing: 'instant',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 20 },
          },
        ],
      },
      'ultra.incoming',
    ),
  )
  const shoot = (state: CombatEncounterState) =>
    commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: incoming },
      selection: { kind: 'unit', combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, incoming),
    })
  const armed = shoot(reconcileCombatAbilitySources(initial, [ultra, incoming]))
  expect(hp(armed.state, 'enemy')).toBe(180)
  expect(currentBarrierAmount(armed.state, 'enemy')).toBe(1000)
  expect(returns(armed.events)).toEqual([])
  const out = shoot(JSON.parse(JSON.stringify(armed.state)))
  expect(hp(out.state, 'enemy')).toBe(180)
  expect(hp(out.state, 'actor')).toBe(980)
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(980)
  expect(returns(out.events)).toHaveLength(1)
})

it('keeps copied Reflect effective through reload and a real turn transition with both sides shielded', () => {
  let state = cast(prepared(true, 0), [
    { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' },
  ]).state
  expect(state.statusState.find((row) => row.combatantId === 'actor')!.statuses).toContainEqual(
    expect.objectContaining({ statusId: 'counter', counter: { kind: 'full', basisPoints: 10000 } }),
  )
  state = grantBarrier(
    grantBarrier(state, 'actor', 'actor', 'copy.actor-shield', 50).state,
    'enemy',
    'enemy',
    'copy.enemy-shield',
    50,
  ).state
  state = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
  const out = cast(
    JSON.parse(JSON.stringify(state)),
    [{ type: 'damage', recipient: 'primary-unit', amount: 40 }],
    'actor',
  )
  expect(hp(out.state, 'actor')).toBe(1000)
  expect(hp(out.state, 'enemy')).toBe(1000)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(10)
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(10)
  expect(returns(out.events)).toHaveLength(1)
})

it('absorbs a return with attacker Barrier without recursively returning it', () => {
  let state = cast(
    prepared(true, 100),
    [
      {
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'counter',
        stacks: 1,
        durationTurns: 2,
        counter: { kind: 'full', basisPoints: 10000 },
      },
    ],
    'actor',
  ).state
  state = grantBarrier(state, 'actor', 'actor', 'test.attacker-barrier', 30).state
  const out = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 40 }])
  expect(hp(out.state, 'actor')).toBe(990)
  expect(hp(out.state, 'enemy')).toBe(1000)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(0)
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(60)
  expect(returns(out.events)).toHaveLength(1)
})

it('settles a lethal return through attacker Barrier and advances its defeated turn once', () => {
  const initial = grantBarrier(
    prepared(true, 100),
    'actor',
    'actor',
    'lethal.return-shield',
    30,
  ).state
  const state = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 5 } : unit,
        ),
      },
    },
  }
  const out = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 40 }])
  expect(hp(out.state, 'actor')).toBe(0)
  expect(hp(out.state, 'enemy')).toBe(1000)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(0)
  expect(currentBarrierAmount(out.state, 'enemy')).toBe(60)
  expect(out.events.filter((event) => event.event === 'turn_started')).toHaveLength(1)
  expect(out.state.tactical.battle.currentTurn!.combatantId).toBe('enemy')
  expect(returns(out.events)).toHaveLength(1)
})

it('returns eligible sourced periodic damage absorbed by Barrier after JSON reload', () => {
  let state = prepared(true, 100)
  state = {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              ...row.statuses,
              {
                statusId: 'test.reflect-tick',
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'actor',
                remainingOwnerTurnStarts: 2,
              },
            ],
          }
        : row,
    ),
  }
  const content = {
    statuses: [
      ...PV1F_COMBAT_CONTENT.statuses,
      {
        id: 'test.reflect-tick',
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 2,
        damageTakenMultiplierBasisPoints: 10000,
        endOfTurn: { type: 'damage' as const, amount: 10 },
      },
    ],
  }
  const events: ReturnType<typeof endCombatTurn>['events'][number][] = []
  for (let turn = 0; turn < 2; turn++) {
    const out = endCombatTurn(
      {
        ...JSON.parse(JSON.stringify(state)),
        tactical: selectCurrentFinalFacing(state.tactical, 'west').state,
      },
      content,
    )
    state = out.state
    events.push(...out.events)
  }
  expect(hp(state, 'enemy')).toBe(1000)
  expect(hp(state, 'actor')).toBe(990)
  expect(returns(events)).toHaveLength(1)
})

it('retains Barrier receipts when an Endure burst earns a Full Reflect return', () => {
  let state = cast(
    prepared(true, 100),
    [
      {
        type: 'endure',
        recipient: 'actor',
        durationTurns: 1,
        releaseBasisPoints: 10000,
        radiusTiles: 5,
        targetTeams: 'enemies',
      },
    ],
    'actor',
  ).state
  state = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
  state = cast(state, [{ type: 'damage', recipient: 'primary-unit', amount: 20 }], 'actor').state
  const events: ReturnType<typeof endCombatTurn>['events'][number][] = []
  for (
    let turn = 0;
    turn < 8 &&
    state.statusState.some((row) => row.statuses.some((status) => status.statusId === 'endure'));
    turn++
  ) {
    const out = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    )
    state = out.state
    events.push(...out.events)
  }
  expect(events).toContainEqual(
    expect.objectContaining({
      event: 'barrier_absorbed',
      actionId: 'status.endure.release',
      targetCombatantId: 'enemy',
      amount: 20,
    }),
  )
  expect(hp(state, 'actor')).toBe(960)
  expect(returns(events)).toHaveLength(1)
})
