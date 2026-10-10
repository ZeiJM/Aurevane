import { selectCurrentFinalFacing } from './board'
import { executeCombatAction, endCombatTurn, validateCombatEncounterState } from './actions'
import {
  issueCommittedCombatExecution,
  type CommittedCombatExecution,
} from './combat-committed-execution'
import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  finishPv1fTurn,
  hasPv1fTurnActivity,
} from './pv1f-action-economy'
import type { AbilityBehavior } from './combat-definition'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import {
  createCombatNativeAbilityRuntime,
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
  type CombatAbilityCommandInput,
} from './combat-ability-command'

function command(
  ap = 20,
  hp = 20,
  rootBehavior: Partial<AbilityBehavior> = {},
  modifierBehavior: Partial<AbilityBehavior> = {},
): CombatAbilityCommandInput {
  const root = captureCombatAbilitySource(source(rootBehavior))
  const modifier = captureCombatAbilitySource(
    source(
      {
        id: 'bonus',
        mode: 'modifier',
        targeting: null,
        costs: [
          { resource: 'ap', amount: 7 },
          { resource: 'mp', amount: 1 },
          { resource: 'hp', amount: 2 },
        ],
        effects: [
          { id: 'extra', payload: { type: 'damage', recipient: 'primary-unit', amount: 3 } },
        ],
        ...modifierBehavior,
      },
      'modifier-a',
    ),
  )
  let state = preparePv1fTurnEconomy(percentageDotEncounter())
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor'
            ? {
                ...unit,
                hp,
                mp: 10,
                temporaryResources: unit.temporaryResources.map((row) =>
                  row.key === 'pv1f.action-economy' ? { ...row, current: ap } : row,
                ),
              }
            : unit,
        ),
      },
    },
  }
  state = reconcileCombatAbilitySources(state, [root, modifier]) as typeof state
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: root },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
    manualModifiers: [{ sourceInstanceId: 'modifier-a', behaviorId: 'bonus' }],
  }
}

describe('one atomic captured Ability command', () => {
  it('preview forecasts maintained contributions from the same post-payment state as commit', () => {
    const input = command(20, 20)
    const ongoing = captureCombatAbilitySource(
      source(
        {
          id: 'maintained',
          activation: 'ongoing',
          mode: 'modifier',
          targeting: null,
          costs: [],
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'hp',
            comparison: 'at-most',
            amount: 19,
          },
          effects: [
            {
              id: 'bonus',
              payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
            },
          ],
        },
        'ongoing',
      ),
    )
    const state = reconcileCombatAbilitySources(input.state, [
      ...input.state.capturedAbilitySources!,
      ongoing,
    ])
    const prepared = prepareCombatAbilityCommand({ ...input, state })
    const out = commitCombatAbilityCommand({ ...input, state })
    expect(
      prepared.evaluation.projectedEvents
        .filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.amount : 0)),
    ).toEqual(
      out.events
        .filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.amount : 0)),
    )
  })
  it('reserves the explicit bundle before suppressing an unaffordable optional Automatic modifier', () => {
    const input = command()
    const auto = captureCombatAbilitySource(
      source(
        {
          id: 'auto',
          activation: 'automatic',
          mode: 'modifier',
          targeting: null,
          costs: [{ resource: 'ap', amount: 5 }],
          cooldown: { key: 'auto', ownerTurns: 2 },
          requirements: { kind: 'action', classification: 'attack' },
          effects: [
            { id: 'auto-hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 2 } },
          ],
        },
        'auto-source',
      ),
    )
    const state = reconcileCombatAbilitySources(input.state, [
      ...input.state.capturedAbilitySources!,
      auto,
    ])
    const prepared = prepareCombatAbilityCommand({ ...input, state })
    expect(prepared.participants).toHaveLength(2)
    const out = commitCombatAbilityCommand({ ...input, state })
    expect(out.resolution!.triggerGuard.remainingReactionBudget).toBe(32)
    expect(out.state.abilityRuntime!.usage).toHaveLength(2)
    expect(out.events.filter((e) => e.event === 'skill_cooldown_started')).toEqual([])
    const affordableState = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((u) =>
            u.id === 'actor'
              ? {
                  ...u,
                  temporaryResources: u.temporaryResources.map((r) =>
                    r.key === 'pv1f.action-economy' ? { ...r, current: 25 } : r,
                  ),
                }
              : u,
          ),
        },
      },
    }
    const affordable = commitCombatAbilityCommand({ ...input, state: affordableState })
    expect(affordable.resolution!.triggerGuard.remainingReactionBudget).toBe(31)
    expect(affordable.state.abilityRuntime!.usage).toHaveLength(3)
    expect(readPv1fActionEconomy(affordable.state as never)!.current).toBe(2)
  })
  it.each([false, true])(
    'Water companion requires its own contributing positive loss; gated=%s',
    (gated) => {
      const input = command(
        20,
        20,
        {},
        {
          costs: [],
          effects: [
            {
              id: 'water',
              requirements: gated
                ? {
                    kind: 'resource-state',
                    subject: 'owner',
                    resource: 'mp',
                    comparison: 'at-least',
                    amount: 11,
                  }
                : null,
              payload: { type: 'damage', recipient: 'primary-unit', amount: 3, element: 'water' },
            },
            {
              id: 'drenched',
              payload: {
                type: 'apply-status',
                recipient: 'primary-unit',
                statusId: 'wet',
                stacks: 1,
                durationTurns: 2,
                potencyBasisPoints: 2000,
              },
            },
          ],
        },
      )
      const state = { ...input.state, elementalDamagePolicyVersion: 2 as const }
      const out = commitCombatAbilityCommand({ ...input, state })
      expect(
        out.state.statusState
          .find((r) => r.combatantId === 'enemy')!
          .statuses.some((s) => s.statusId === 'wet'),
      ).toBe(!gated)
    },
  )
  it('one ready shared cooldown key starts once at the longest duration plus1', () => {
    const input = command(
      20,
      20,
      { cooldown: { key: 'shared', ownerTurns: 2 } },
      { cooldown: { key: 'shared', ownerTurns: 4 } },
    )
    const out = commitCombatAbilityCommand(input)
    expect(out.events.filter((e) => e.event === 'skill_cooldown_started')).toEqual([
      expect.objectContaining({ cooldownKey: 'shared', ticksRemaining: 5 }),
    ])
    expect(
      out.state.tactical.battle.combatants
        .find((u) => u.id === 'actor')!
        .temporaryResources.find((r) => r.key === 'p3.skill-cooldown.shared')!.current,
    ).toBe(5)
  })
  it('fixed0 pays both legal participants and consumes both limits', () => {
    const input = command(
      20,
      20,
      { accuracy: { kind: 'fixed', chanceBasisPoints: 0 }, activationLimits: ['once-per-battle'] },
      { activationLimits: ['once-per-battle'] },
    )
    const out = commitCombatAbilityCommand(input)
    expect(out.events.some((e) => e.event === 'damage_applied')).toBe(false)
    expect(out.state.abilityRuntime!.usage).toHaveLength(2)
    expect(readPv1fActionEconomy(out.state as never)!.current).toBe(2)
  })
  it('Manual15000 damage bonus belongs only to this command and makes10→15', () => {
    const input = command(
      50,
      20,
      {},
      {
        costs: [],
        effects: [
          {
            id: 'bonus',
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
          },
        ],
      },
    )
    const out = commitCombatAbilityCommand(input)
    expect(out.events.find((e) => e.event === 'damage_applied')).toMatchObject({ amount: 15 })
    expect(out.state.abilityRuntime!.maintained).toEqual([])
    expect(out.state.statusState).toEqual(input.state.statusState)
    const next = {
      ...input,
      state: out.state,
      manualModifiers: undefined,
      context: combatAbilityCommandContext(
        out.state,
        input.root.kind === 'canonical' ? input.root.source : null!,
      ),
    }
    expect(
      commitCombatAbilityCommand(next).events.find((e) => e.event === 'damage_applied'),
    ).toMatchObject({ amount: 10 })
  })
  it('prepaid delayed command bonus survives JSON restore without payment or later predicate reads', () => {
    const input = command(
      20,
      20,
      {
        effects: [
          {
            id: 'later',
            timing: 'delayed',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
          },
        ],
      },
      {
        costs: [],
        effects: [
          {
            id: 'bonus',
            requirements: {
              kind: 'resource-state',
              subject: 'owner',
              resource: 'mp',
              comparison: 'at-least',
              amount: 10,
            },
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
          },
        ],
      },
    )
    const out = commitCombatAbilityCommand(input)
    expect(out.state.pendingEffects![0]).toHaveProperty('commandDamageBonuses', [
      expect.objectContaining({ sourceInstanceId: 'modifier-a', multiplierBasisPoints: 15000 }),
    ])
    let state = JSON.parse(JSON.stringify(out.state)) as typeof out.state
    const events: (typeof out.events)[number][] = []
    while (state.tactical.battle.round < input.state.tactical.battle.round + 2) {
      const transition = finishPv1fTurn(state as never, 'east')
      state = transition.state
      events.push(...(transition.events as typeof out.events))
    }
    expect(events.find((e) => e.event === 'damage_applied')).toMatchObject({ amount: 15 })
    expect(events.some((e) => ['mp_spent', 'hp_spent', 'ap_spent'].includes(e.event))).toBe(false)
  })
  it('quotes the exact composed action without reserving state, RNG, usage or guard', () => {
    const input = command(),
      before = JSON.stringify(input)
    const prepared = prepareCombatAbilityCommand(input)
    expect(prepared.action.effects).toHaveLength(2)
    expect(prepared.evaluation.legal).toBe(true)
    expect(prepared.costs).toEqual([
      { resource: 'ap', amount: 18 },
      { resource: 'mp', amount: 3 },
      { resource: 'hp', amount: 3 },
    ])
    expect(prepared.participants).toHaveLength(2)
    expect(JSON.stringify(input)).toBe(before)
    const out = commitCombatAbilityCommand(input)
    expect(readPv1fActionEconomy(out.state as never)!.current).toBe(2)
    expect(out.state.tactical.battle.combatants.find((u) => u.id === 'actor')).toMatchObject({
      hp: 17,
      mp: 7,
    })
    for (const event of ['ap_spent', 'mp_spent', 'hp_spent'])
      expect(out.events.filter((e) => e.event === event)).toHaveLength(1)
    expect(
      out.events
        .filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.amount : 0)),
    ).toEqual([10, 3])
    expect(out.state.abilityRuntime!.nextCommandSequence).toBe(2)
  })
  it.each([
    [17, 20, 'insufficient-ap'],
    [20, 3, 'insufficient-hp'],
  ] as const)('rejects combined affordability ap%s hp%s atomically', (ap, hp, code) => {
    const input = command(ap, hp),
      before = JSON.stringify(input)
    expect(prepareCombatAbilityCommand(input).evaluation.issues).toContainEqual(
      expect.objectContaining({ code }),
    )
    expect(() => commitCombatAbilityCommand(input)).toThrow(code)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('HP4 leaves1 and duplicate/stale commands spend0', () => {
    const input = command(20, 4)
    const out = commitCombatAbilityCommand(input)
    expect(out.state.tactical.battle.combatants.find((u) => u.id === 'actor')!.hp).toBe(1)
    const replay = { ...input, state: out.state },
      before = JSON.stringify(out.state)
    expect(() => commitCombatAbilityCommand(replay)).toThrow(/duplicate-command|stale-command/)
    expect(JSON.stringify(out.state)).toBe(before)
  })
  it('does not implicitly attach a Manual modifier', () => {
    const input = { ...command(), manualModifiers: undefined }
    expect(prepareCombatAbilityCommand(input).action.effects).toHaveLength(1)
    expect(prepareCombatAbilityCommand(input).participants).toHaveLength(1)
  })
})

function withBeforeAction(input: CombatAbilityCommandInput, cost = 5): CombatAbilityCommandInput {
  const automatic = captureCombatAbilitySource(
    source(
      {
        id: 'before',
        activation: 'automatic',
        classification: 'utility',
        attackFamily: undefined,
        costs: [{ resource: 'ap', amount: cost }],
        cooldown: { key: 'before', ownerTurns: 2 },
        requirements: {
          kind: 'all',
          children: [
            { kind: 'action', classification: 'attack' },
            { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
          ],
        },
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
        effects: [{ id: 'own-heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
      'before-source',
    ),
  )
  return {
    ...input,
    state: reconcileCombatAbilitySources(input.state, [
      ...input.state.capturedAbilitySources!,
      automatic,
    ]),
  }
}

describe('committed before-action orchestration', () => {
  it('root30 plus paid-state before5 leaves65; one use/payment/sequence per command', () => {
    const input = withBeforeAction({
      ...command(100, 20, {
        costs: [{ resource: 'ap', amount: 30 }],
        cooldown: { key: 'root', ownerTurns: 2 },
      }),
      manualModifiers: undefined,
    })
    const before = JSON.stringify(input)
    expect(prepareCombatAbilityCommand(input).costs).toEqual([{ resource: 'ap', amount: 30 }])
    expect(JSON.stringify(input)).toBe(before)
    const out = commitCombatAbilityCommand(input)
    expect(readPv1fActionEconomy(out.state as never)!.current).toBe(65)
    expect(
      out.events
        .filter((e) => e.event === 'ap_spent')
        .map((e) => (e.event === 'ap_spent' ? e.amount : 0)),
    ).toEqual([30, 5])
    expect(out.events.filter((e) => e.event === 'combat_action_used')).toHaveLength(2)
    expect(out.state.abilityRuntime!.usage).toHaveLength(2)
    expect(out.state.abilityRuntime!.nextCommandSequence).toBe(2)
    expect(out.resolution!.triggerGuard.remainingReactionBudget).toBe(31)
    expect(
      out.events
        .filter((e) => e.event === 'healing_applied' || e.event === 'damage_applied')
        .map((e) => e.event),
    ).toEqual(['healing_applied', 'damage_applied'])
    expect(hasPv1fTurnActivity(out.state as never)).toBe(true)
  })
  it('an unaffordable before child spends0 and its parent settles normally', () => {
    const input = withBeforeAction({
      ...command(30, 20, { costs: [{ resource: 'ap', amount: 30 }] }),
      manualModifiers: undefined,
    })
    const out = commitCombatAbilityCommand(input)
    expect(out.state.abilityRuntime!.usage).toHaveLength(1)
    expect(out.events.filter((e) => e.event === 'combat_action_used')).toHaveLength(1)
    expect(out.events.filter((e) => e.event === 'skill_cooldown_started')).toHaveLength(0)
    expect(out.events.find((e) => e.event === 'damage_applied')).toMatchObject({
      targetCombatantId: 'enemy',
      amount: 10,
    })
  })
  it('before children never inherit explicit Manual modifiers', () => {
    const input = withBeforeAction(command(100, 20, { costs: [{ resource: 'ap', amount: 30 }] }))
    const out = commitCombatAbilityCommand(input)
    expect(readPv1fActionEconomy(out.state as never)!.current).toBe(58)
    expect(
      out.events
        .filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.amount : 0)),
    ).toEqual([10, 3])
    expect(out.events.filter((e) => e.event === 'healing_applied')).toHaveLength(1)
    expect(out.state.abilityRuntime!.usage).toHaveLength(3)
  })
  it('invalid bundle never reaches a hook or changes its authoritative input', () => {
    const input = withBeforeAction(command(10, 20)),
      before = JSON.stringify(input)
    expect(() => commitCombatAbilityCommand(input)).toThrow('insufficient-ap')
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('engine-issued committed admission', () => {
  it('rejects forged and JSON-restored capabilities before native RNG', () => {
    const input = command(),
      prepared = prepareCombatAbilityCommand(input)
    for (const token of [
      {} as CommittedCombatExecution,
      JSON.parse(
        JSON.stringify(
          issueCommittedCombatExecution(
            input.state,
            input.actorId,
            prepared.action,
            input.selection,
            prepared.context,
            true,
          ),
        ),
      ),
    ]) {
      const snapshot = JSON.stringify(input.state)
      expect(() =>
        executeCombatAction(input.state, prepared.action, input.selection, input.content, {
          ...prepared.context,
          committedExecution: token,
        }),
      ).toThrow('invalid-committed-execution-authority')
      expect(JSON.stringify(input.state)).toBe(snapshot)
    }
  })
  it.each(['action', 'selection', 'actor', 'turn', 'provenance'] as const)(
    'rejects a mismatched %s binding',
    (mismatch) => {
      const input = command(),
        prepared = prepareCombatAbilityCommand(input)
      const token = issueCommittedCombatExecution(
        input.state,
        input.actorId,
        prepared.action,
        input.selection,
        prepared.context,
        true,
      )
      const action =
        mismatch === 'action' ? { ...prepared.action, id: 'replacement' } : prepared.action
      const selection =
        mismatch === 'selection' ? { kind: 'unit' as const, combatantId: 'other' } : input.selection
      const context = {
        ...prepared.context,
        committedExecution: token,
        provenance: {
          ...prepared.context.provenance,
          ...(mismatch === 'actor'
            ? { sourceCombatantId: 'enemy' as typeof prepared.context.provenance.sourceCombatantId }
            : {}),
          ...(mismatch === 'provenance'
            ? { actionVersion: 2 as typeof prepared.context.provenance.actionVersion }
            : {}),
        },
      }
      const state =
        mismatch === 'turn'
          ? {
              ...input.state,
              tactical: {
                ...input.state.tactical,
                battle: {
                  ...input.state.tactical.battle,
                  turnNumber: input.state.tactical.battle.turnNumber + 1,
                },
              },
            }
          : input.state
      expect(() => executeCombatAction(state, action, selection, input.content, context)).toThrow(
        'invalid-committed-execution-authority',
      )
    },
  )
  it('an issued capability settles once and cannot execute again', () => {
    const input = { ...command(), manualModifiers: undefined },
      prepared = prepareCombatAbilityCommand(input)
    const token = issueCommittedCombatExecution(
      input.state,
      input.actorId,
      prepared.action,
      input.selection,
      prepared.context,
      true,
    )
    const context = { ...prepared.context, committedExecution: token }
    const out = executeCombatAction(
      input.state,
      prepared.action,
      input.selection,
      input.content,
      context,
    )
    expect(out.events.filter((e) => e.event === 'combat_action_used')).toHaveLength(0)
    expect(() =>
      executeCombatAction(out.state, prepared.action, input.selection, input.content, context),
    ).toThrow('invalid-committed-execution-authority')
  })
})

it('an off-turn child effect gate captures its own pre-payment owner, never its parent owner', () => {
  const input = {
    ...command(100, 20, { costs: [{ resource: 'ap', amount: 30 }] }),
    manualModifiers: undefined,
  }
  const template = source(
    {
      id: 'counter',
      activation: 'automatic',
      costs: [{ resource: 'mp', amount: 5 }],
      automaticTarget: { subject: 'triggering' },
      requirements: {
        kind: 'all',
        children: [
          { kind: 'action', classification: 'attack' },
          { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
          {
            kind: 'resource-state',
            subject: 'triggering',
            resource: 'ap',
            comparison: 'at-most',
            amount: 70,
          },
        ],
      },
      effects: [
        {
          id: 'counter-hit',
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'mp',
            comparison: 'at-least',
            amount: 20,
          },
          payload: { type: 'damage', recipient: 'primary-unit', amount: 1 },
        },
      ],
    },
    'enemy-before',
  )
  const automatic = captureCombatAbilitySource({ ...template, ownerCombatantId: 'enemy' })
  const state = reconcileCombatAbilitySources(input.state, [
    ...input.state.capturedAbilitySources!,
    automatic,
  ])
  const out = commitCombatAbilityCommand({ ...input, state })
  expect(
    out.events
      .filter((e) => e.event === 'damage_applied')
      .map((e) => (e.event === 'damage_applied' ? e.targetCombatantId : null)),
  ).toEqual(['actor', 'enemy'])
  expect(out.state.tactical.battle.combatants.find((u) => u.id === 'enemy')!.mp).toBe(15)
  expect(out.events.filter((e) => e.event === 'combat_action_used')).toHaveLength(2)
})

function interruptedFire(
  delayed = false,
  killActor = false,
  extraEffects: AbilityBehavior['effects'] = [],
): CombatAbilityCommandInput {
  const input = {
    ...command(100, 20, {
      costs: [
        { resource: 'ap', amount: 30 },
        { resource: 'hp', amount: 1 },
      ],
      cooldown: { key: 'root-fire', ownerTurns: 2 },
      effects: [
        {
          id: 'fire-hit',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10, element: 'fire' },
        },
        {
          id: 'cleanse',
          timing: delayed ? 'delayed' : 'instant',
          payload: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
        },
        {
          id: 'gated-heal',
          requirements: {
            kind: 'resource-state',
            subject: 'owner',
            resource: 'hp',
            comparison: 'at-least',
            amount: 20,
          },
          payload: { type: 'healing', recipient: 'actor', amount: 1 },
        },
        ...extraEffects,
      ],
    }),
    manualModifiers: undefined,
  }
  const killer = captureCombatAbilitySource({
    ...source(
      {
        id: 'before-kill',
        activation: 'automatic',
        automaticTarget: { subject: killActor ? 'triggering' : 'selected' },
        costs: [],
        activationLimits: ['once-per-action'],
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        effects: [
          { id: 'kill', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
        ],
      },
      'before-killer',
    ),
    abilityId: 'child.kill',
    ownerCombatantId: killActor ? 'enemy' : 'actor',
  })
  const state = reconcileCombatAbilitySources(
    {
      ...input.state,
      elementalDamagePolicyVersion: 2 as const,
      tactical: {
        ...input.state.tactical,
        battle: {
          ...input.state.tactical.battle,
          combatants: input.state.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' && !killActor ? { ...unit, hp: 10 } : unit,
          ),
        },
      },
      statusState: input.state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'frozen',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'actor',
                },
              ],
            }
          : row,
      ),
    },
    [...input.state.capturedAbilitySources!, killer],
  )
  return { ...input, state }
}
describe('paid interrupted native settlement', () => {
  it('target defeat retains one paid attempt and the independent Fire actor cleanse with locked gates', () => {
    const input = interruptedFire(),
      out = commitCombatAbilityCommand(input)
    expect(out.events.filter((e) => e.event === 'combat_action_interrupted')).toEqual([
      {
        event: 'combat_action_interrupted',
        actionId: 'test.ability',
        actorId: 'actor',
        reason: 'selection-invalid',
      },
    ])
    expect(out.state.statusState.find((row) => row.combatantId === 'actor')!.statuses).toEqual([])
    expect(out.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBe(20)
    expect(readPv1fActionEconomy(out.state as never)!.current).toBe(70)
    expect(out.state.abilityRuntime!.nextCommandSequence).toBe(2)
    expect(out.state.abilityRuntime!.usage).toHaveLength(2)
    expect(hasPv1fTurnActivity(out.state as never)).toBe(true)
    expect(
      out.events.filter((e) => e.event === 'combat_action_used' && e.actionId === 'test.ability'),
    ).toHaveLength(1)
    expect(
      out.events.filter(
        (e) => e.event === 'combat_accuracy_resolved' && e.actionId === 'test.ability',
      ),
    ).toEqual([])
    expect(
      out.events.filter((e) => e.event === 'damage_applied' && e.actionId === 'test.ability'),
    ).toEqual([])
    expect(out.events.filter((e) => e.event === 'status_removed')).toHaveLength(1)
    expect(out.state.pendingEffects ?? []).toEqual([])
  })
  it('a genuine delayed actor cleanse keeps its original ordinal/origin and schedules no target payload', () => {
    const input = interruptedFire(true),
      out = commitCombatAbilityCommand(input)
    expect(out.state.pendingEffects).toHaveLength(1)
    expect(out.state.pendingEffects![0]).toMatchObject({
      actorId: 'actor',
      recipientIds: ['actor'],
      effect: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
      effectOrigin: { sourceInstanceId: 'source-a', behaviorId: 'strike', effectId: 'cleanse' },
    })
    expect(out.events.filter((e) => e.event === 'effect_pending')).toHaveLength(1)
    expect(
      out.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.map((row) => row.statusId),
    ).toEqual(['frozen'])
  })
})

it('same-owner same-Ability outcome children retain their own original status provenance', () => {
  const input = {
    ...command(100, 20, {
      costs: [],
      effects: [
        { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } },
        {
          id: 'parent-buff',
          payload: { type: 'apply-status', recipient: 'actor', statusId: 'inspired', stacks: 1 },
        },
      ],
    }),
    manualModifiers: undefined,
  }
  const child = captureCombatAbilitySource(
    source(
      {
        id: 'after-buff',
        activation: 'automatic',
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        activationLimits: ['once-per-action'],
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
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'after' },
        effects: [
          {
            id: 'child-buff',
            payload: { type: 'apply-status', recipient: 'actor', statusId: 'inspired', stacks: 1 },
          },
        ],
      },
      'after-source',
    ),
  )
  const state = reconcileCombatAbilitySources(input.state, [
    ...input.state.capturedAbilitySources!,
    child,
  ])
  const out = commitCombatAbilityCommand({ ...input, state })
  const inspired = out.state.statusState
    .find((row) => row.combatantId === 'actor')!
    .statuses.find((row) => row.statusId === 'inspired')!
  expect(inspired.stacks).toBe(2)
  expect(inspired.provenance?.effectOrdinal).toBe(0)
  expect(
    out.events
      .filter((row) => row.event === 'status_applied')
      .map((row) => row.effectOrigin?.effectId),
  ).toEqual(['parent-buff', 'child-buff'])
})

it('a before counter defeats the paid root actor without actor packets or a root hit draw', () => {
  const input = interruptedFire(false, true),
    out = commitCombatAbilityCommand(input)
  expect(out.events.filter((e) => e.event === 'combat_action_interrupted')).toEqual([
    {
      event: 'combat_action_interrupted',
      actionId: 'test.ability',
      actorId: 'actor',
      reason: 'actor-unavailable',
    },
  ])
  const actor = out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
  expect(actor.hp).toBe(0)
  expect(out.state.tactical.battle.currentTurn?.combatantId).not.toBe('actor')
  expect(out.state.tactical.battle.rng.draws).toBe(input.state.tactical.battle.rng.draws + 1)
  expect(actor.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current).toBe(
    70,
  )
  expect(actor.temporaryResources.find((row) => row.key === 'pv1f.activity-turn')!.current).toBe(
    input.state.tactical.battle.turnNumber,
  )
  expect(out.state.abilityRuntime!.nextCommandSequence).toBe(2)
  expect(out.state.abilityRuntime!.usage).toHaveLength(2)
  expect(
    out.events.filter((e) => e.event === 'status_removed' && e.actionId === 'test.ability'),
  ).toEqual([])
  expect(
    out.events
      .filter((e) => e.event === 'combat_accuracy_resolved')
      .map((e) => (e.event === 'combat_accuracy_resolved' ? e.actionId : null)),
  ).toEqual(['child.kill'])
  expect(
    out.events.filter(
      (e) => e.event === 'combat_critical_resolved' && e.actionId === 'test.ability',
    ),
  ).toEqual([])
  expect(out.state.pendingEffects ?? []).toEqual([])
})
it('an interrupted actor cannot gain hit-dependent Blindside', () => {
  const input = interruptedFire(false, false, [
    {
      id: 'blindside',
      payload: { type: 'apply-status', recipient: 'actor', statusId: 'blindside', stacks: 1 },
    },
  ])
  const out = commitCombatAbilityCommand(input)
  expect(out.events.some((e) => e.event === 'status_applied' && e.statusId === 'blindside')).toBe(
    false,
  )
  expect(
    out.state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((row) => row.statusId === 'blindside'),
  ).toBe(false)
})

it('skipped interrupted actor status packets do not reattribute an existing status', () => {
  const input = interruptedFire(false, false, [
    {
      id: 'blindside',
      payload: { type: 'apply-status', recipient: 'actor', statusId: 'blindside', stacks: 1 },
    },
    {
      id: 'locked-out',
      requirements: {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'hp',
        comparison: 'at-least',
        amount: 1000,
      },
      payload: { type: 'apply-status', recipient: 'actor', statusId: 'inspired', stacks: 1 },
    },
  ])
  const state = {
    ...input.state,
    statusState: input.state.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              ...row.statuses,
              {
                statusId: 'blindside',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
              {
                statusId: 'inspired',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
            ].sort((a, b) => (a.statusId < b.statusId ? -1 : a.statusId > b.statusId ? 1 : 0)),
          }
        : row,
    ),
  }
  const out = commitCombatAbilityCommand({ ...input, state })
  const statuses = out.state.statusState.find((row) => row.combatantId === 'actor')!.statuses
  expect(statuses.map((row) => [row.statusId, row.stacks, row.provenance])).toEqual([
    ['blindside', 1, undefined],
    ['inspired', 1, undefined],
  ])
})
it('a before child hides the original primary without fallback or root accuracy', () => {
  const input = {
    ...command(100, 20, { costs: [{ resource: 'ap', amount: 30 }] }),
    manualModifiers: undefined,
  }
  const hide = captureCombatAbilitySource({
    ...source(
      {
        id: 'hide',
        activation: 'automatic',
        classification: 'utility',
        attackFamily: undefined,
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
        costs: [],
        activationLimits: ['once-per-action'],
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        effects: [
          {
            id: 'hide',
            payload: { type: 'apply-status', recipient: 'actor', statusId: 'invisible', stacks: 1 },
          },
        ],
      },
      'hide-source',
    ),
    abilityId: 'child.hide',
    ownerCombatantId: 'enemy',
  })
  const state = reconcileCombatAbilitySources(input.state, [
    ...input.state.capturedAbilitySources!,
    hide,
  ])
  const out = commitCombatAbilityCommand({ ...input, state })
  expect(out.events.filter((row) => row.event === 'combat_action_interrupted')).toEqual([
    {
      event: 'combat_action_interrupted',
      actionId: 'test.ability',
      actorId: 'actor',
      reason: 'selection-invalid',
    },
  ])
  expect(readPv1fActionEconomy(out.state as never)!.current).toBe(70)
  expect(
    out.events.filter(
      (row) => row.event === 'combat_accuracy_resolved' && row.actionId === 'test.ability',
    ),
  ).toEqual([])
  expect(
    out.events.filter((row) => row.event === 'damage_applied' && row.actionId === 'test.ability'),
  ).toEqual([])
})

it('actual atomic HP payment triggers a state entry once without damage or truth rollback', () => {
  const input = {
    ...command(100, 20, { costs: [{ resource: 'hp', amount: 1 }] }),
    manualModifiers: undefined,
  }
  const heal = captureCombatAbilitySource({
    ...source(
      {
        id: 'low-hp',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        requirements: {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'hp',
          comparison: 'at-most',
          amount: 19,
        },
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
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
      'low-source',
    ),
    abilityId: 'child.heal',
  })
  const state = reconcileCombatAbilitySources(input.state, [
    ...input.state.capturedAbilitySources!,
    heal,
  ])
  const out = commitCombatAbilityCommand({ ...input, state })
  const actor = out.state.tactical.battle.combatants.find((row) => row.id === 'actor')!
  expect(actor.hp).toBe(20)
  expect(actor.mp).toBe(9)
  expect(
    out.events.filter((row) => row.event === 'healing_applied' && row.actionId === 'child.heal'),
  ).toHaveLength(1)
  expect(
    out.events.filter((row) => row.event === 'damage_applied' && row.targetCombatantId === 'actor'),
  ).toEqual([])
  expect(
    out.state.abilityRuntime!.conditionTruth!.find((row) => row.sourceInstanceId === 'low-source')!
      .holds,
  ).toBe(false)
})

it('actual native down/up/down packets queue two exact crossings before any outcome child', () => {
  const input = {
    ...command(100, 100, {
      costs: [],
      effects: [
        { id: 'down-one', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
        { id: 'up', payload: { type: 'healing', recipient: 'primary-unit', amount: 20 } },
        { id: 'down-two', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
      ],
    }),
    manualModifiers: undefined,
  }
  const heal = captureCombatAbilitySource({
    ...source(
      {
        id: 'cross',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        requirements: {
          kind: 'resource-threshold-crossing',
          subject: 'owner',
          resource: 'hp',
          direction: 'below',
          thresholdBasisPoints: 5900,
        },
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
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
      'cross-source',
    ),
    abilityId: 'child.heal',
    ownerCombatantId: 'enemy',
  })
  const state = reconcileCombatAbilitySources(
    {
      ...input.state,
      tactical: {
        ...input.state.tactical,
        battle: {
          ...input.state.tactical.battle,
          combatants: input.state.tactical.battle.combatants.map((row) =>
            row.id === 'enemy' ? { ...row, hp: 600 } : row,
          ),
        },
      },
    },
    [...input.state.capturedAbilitySources!, heal],
  )
  const before = JSON.stringify(state),
    preview = prepareCombatAbilityCommand({ ...input, state })
  expect(preview.evaluation.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const out = commitCombatAbilityCommand({ ...input, state })
  expect(
    out.events
      .filter((row) => row.event === 'damage_applied' || row.event === 'healing_applied')
      .map((row) => row.actionId),
  ).toEqual(['test.ability', 'test.ability', 'test.ability', 'child.heal', 'child.heal'])
  const enemy = out.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!
  expect(enemy.hp).toBe(582)
  expect(enemy.mp).toBe(18)
})

it('native Reflect precedes queued damage children and consumes their shared guard', () => {
  const input = {
    ...command(100, 100, {
      costs: [],
      effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } }],
    }),
    manualModifiers: undefined,
  }
  const heal = captureCombatAbilitySource({
    ...source(
      {
        id: 'after-hit',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        activationLimits: ['once-per-action'],
        requirements: { kind: 'event', eventType: 'damage_applied', phase: 'after' },
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
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
      'reflect-child',
    ),
    abilityId: 'child.heal',
    ownerCombatantId: 'enemy',
  })
  const state = reconcileCombatAbilitySources(
    {
      ...input.state,
      statusState: input.state.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'test.reflect',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'enemy',
                },
              ],
            }
          : row,
      ),
    },
    [...input.state.capturedAbilitySources!, heal],
  )
  const content = {
    ...PV1F_COMBAT_CONTENT,
    statuses: [
      ...PV1F_COMBAT_CONTENT.statuses,
      {
        id: 'test.reflect',
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 2,
        damageTakenMultiplierBasisPoints: 10000,
        polarity: 'positive' as const,
        reactionClass: 'reactive' as const,
        reflectBasisPoints: 2500,
      },
    ],
  }
  const out = commitCombatAbilityCommand({ ...input, state, content })
  expect(
    out.events
      .filter((row) => row.event === 'damage_applied' || row.event === 'healing_applied')
      .map((row) => row.actionId),
  ).toEqual(['test.ability', 'status.reflect.current.v1', 'child.heal'])
  expect(out.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBe(95)
  expect(out.resolution!.triggerGuard.remainingReactionBudget).toBe(30)
})

it.each([false, true])(
  'real delayed settlement retains causal action facts and original action limit; prior hit %s',
  (priorHit) => {
    const input = {
      ...command(100, 100, {
        costs: [{ resource: 'ap', amount: 10 }],
        effects: [
          ...(priorHit
            ? [
                {
                  id: 'now',
                  payload: {
                    type: 'damage' as const,
                    recipient: 'primary-unit' as const,
                    amount: 1,
                  },
                },
              ]
            : []),
          {
            id: 'later',
            timing: 'next-round',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 20 },
          },
        ],
      }),
      manualModifiers: undefined,
    }
    const reaction = captureCombatAbilitySource({
      ...source(
        {
          id: 'pending-reactor',
          activation: 'automatic',
          classification: 'recovery',
          attackFamily: undefined,
          costs: [{ resource: 'mp', amount: 1 }],
          activationLimits: ['once-per-action'],
          requirements: {
            kind: 'all',
            children: [
              { kind: 'action', classification: 'attack' },
              { kind: 'event', eventType: 'damage_applied', phase: 'after' },
            ],
          },
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
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
        },
        'pending-reactor',
      ),
      abilityId: 'pending.child',
    })
    const state = reconcileCombatAbilitySources(input.state, [
      ...input.state.capturedAbilitySources!,
      reaction,
    ])
    const committed = commitCombatAbilityCommand({ ...input, state })
    expect(committed.events.filter((event) => event.event === 'combat_action_used')).toHaveLength(
      priorHit ? 2 : 1,
    )
    expect(
      committed.state.pendingEffects![0]!.abilityCommandFacts?.actionFacts?.classification,
    ).toBe('attack')
    let live = JSON.parse(JSON.stringify(committed.state)) as typeof committed.state
    const events: (typeof committed.events)[number][] = []
    while (live.tactical.battle.round === state.tactical.battle.round) {
      const out = finishPv1fTurn(live as never, 'west')
      live = out.state
      events.push(...(out.events as typeof committed.events))
    }
    expect(
      events.filter((event) => event.event === 'damage_applied').map((event) => event.actionId),
    ).toEqual(['test.ability'])
    expect(
      events.filter((event) => event.event === 'combat_action_used').map((event) => event.actionId),
    ).toEqual(priorHit ? [] : ['pending.child'])
    expect(
      events.filter((event) => event.event === 'ap_spent' || event.event === 'hp_spent'),
    ).toHaveLength(0)
    expect(events.filter((event) => event.event === 'mp_spent')).toEqual(
      priorHit ? [] : [expect.objectContaining({ amount: 1 })],
    )
    expect(live.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(101)
    expect(live.abilityRuntime!.usage.filter((row) => row.key.includes('source-a'))).toHaveLength(1)
  },
)

it('terminal delayed enemy defeat prevents the incoming Automatic turn action and AP reset', () => {
  const base = command(100, 100, {
    costs: [{ resource: 'ap', amount: 10 }],
    targeting: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'circle', radius: 2 },
      minimumRange: 0,
      maximumRange: 2,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      maximumSelections: 1,
    },
    effects: [
      {
        id: 'end',
        timing: 'next-round',
        payload: { type: 'damage', recipient: 'affected-units', amount: 20 },
      },
    ],
  })
  const reaction = captureCombatAbilitySource({
    ...source(
      {
        id: 'incoming',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        requirements: {
          kind: 'all',
          children: [
            { kind: 'event', eventType: 'turn_started', phase: 'after' },
            {
              kind: 'resource-state',
              subject: 'owner',
              resource: 'ap',
              comparison: 'at-least',
              amount: 100,
            },
          ],
        },
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
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
      'terminal-incoming',
    ),
    abilityId: 'terminal.child',
  })
  const state = reconcileCombatAbilitySources(
    {
      ...base.state,
      tactical: {
        ...base.state.tactical,
        battle: {
          ...base.state.tactical.battle,
          combatants: base.state.tactical.battle.combatants.map((unit) =>
            unit.teamId === 'enemies' ? { ...unit, hp: 10 } : unit,
          ),
        },
      },
    },
    [...base.state.capturedAbilitySources!, reaction],
  )
  let live = commitCombatAbilityCommand({
    ...base,
    state,
    selection: { kind: 'activate' },
    manualModifiers: undefined,
  }).state
  const events: ReturnType<typeof commitCombatAbilityCommand>['events'][number][] = []
  while (
    live.tactical.battle.lifecycle === 'active' &&
    live.tactical.battle.round === state.tactical.battle.round
  ) {
    const out = finishPv1fTurn(live as never, 'west')
    live = out.state
    events.push(...(out.events as typeof events))
  }
  expect(live.tactical.battle.lifecycle).toBe('completed')
  expect(live.tactical.battle.currentTurn).toBeNull()
  expect(
    events.some(
      (event) => event.event === 'combat_action_used' && event.actionId === 'terminal.child',
    ),
  ).toBe(false)
  expect(
    live.tactical.battle.combatants
      .find((unit) => unit.id === 'actor')!
      .temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current,
  ).toBe(90)
})

it('actual periodic down/up/down ticks capture two owner crossings before child settlement', () => {
  const base = command(100, 100)
  const reaction = captureCombatAbilitySource({
    ...source(
      {
        id: 'tick-cross',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        requirements: {
          kind: 'resource-state',
          subject: 'owner',
          resource: 'hp',
          comparison: 'at-most',
          amount: 90,
        },
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
        effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
      },
      'tick-cross',
    ),
    abilityId: 'tick.child',
  })
  const ids = ['test.tick.1down', 'test.tick.2up', 'test.tick.3down']
  const content = {
    ...PV1F_COMBAT_CONTENT,
    statuses: [
      ...PV1F_COMBAT_CONTENT.statuses,
      ...ids.map((id, index) => ({
        id,
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 2,
        damageTakenMultiplierBasisPoints: 10000,
        polarity: 'negative' as const,
        endOfTurn: { type: index === 1 ? ('healing' as const) : ('damage' as const), amount: 20 },
      })),
    ],
  }
  const state = reconcileCombatAbilitySources(
    {
      ...base.state,
      statusState: base.state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: ids.map((statusId) => ({
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'enemy',
              })),
            }
          : row,
      ),
    },
    [reaction],
  )
  const out = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    content,
    false,
    createCombatNativeAbilityRuntime(state, content),
  )
  expect(
    out.events
      .filter((event) => event.event === 'damage_applied' || event.event === 'healing_applied')
      .map((event) => event.actionId),
  ).toEqual([
    'status.test.tick.1down',
    'status.test.tick.2up',
    'status.test.tick.3down',
    'tick.child',
    'tick.child',
  ])
  expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(82)
  expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(8)
})

it('actual owner status expiry binds the triggering source and affected recipient', () => {
  const base = command(100, 100)
  const reaction = captureCombatAbilitySource({
    ...source(
      {
        id: 'expiry-source',
        activation: 'automatic',
        classification: 'recovery',
        attackFamily: undefined,
        costs: [{ resource: 'mp', amount: 1 }],
        requirements: { kind: 'event', eventType: 'status_expired', phase: 'after' },
        automaticTarget: { subject: 'triggering' },
        targeting: {
          kind: 'unit',
          teamPolicy: 'any',
          friendlyFire: 'all-units',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 4,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          maximumSelections: 1,
        },
        effects: [
          { id: 'heal', payload: { type: 'healing', recipient: 'primary-unit', amount: 1 } },
        ],
      },
      'expiry-source',
    ),
    abilityId: 'expiry.child',
  })
  const state = reconcileCombatAbilitySources(
    {
      ...base.state,
      tactical: {
        ...base.state.tactical,
        battle: {
          ...base.state.tactical.battle,
          combatants: base.state.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 900 } : unit,
          ),
        },
      },
      statusState: base.state.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'frozen',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 1,
                  sourceCombatantId: 'enemy',
                },
              ],
            }
          : row,
      ),
    },
    [reaction],
  )
  const out = finishPv1fTurn(state as never, 'west')
  expect(
    (out.events as ReturnType<typeof commitCombatAbilityCommand>['events']).filter(
      (event) => event.event === 'healing_applied',
    ),
  ).toEqual([
    expect.objectContaining({
      actionId: 'expiry.child',
      targetCombatantId: 'enemy',
      hpBefore: 900,
      hpAfter: 901,
    }),
  ])
  expect(out.state.statusState.find((row) => row.combatantId === 'enemy')!.statuses).toHaveLength(0)
})

it.each([
  null,
  { rootActionId: 'root', actionFacts: { classification: 'attack', tags: [] }, guard: {} },
  { rootActionId: 'root', actionFacts: { classification: 'move', tags: [] } },
  {
    rootActionId: 'root',
    actionFacts: { classification: 'attack', tags: [] },
    selectedCombatantId: 7,
  },
])('actual restored pending validation rejects malformed private command facts %j', (facts) => {
  const input = {
    ...command(100, 100, {
      effects: [
        {
          id: 'later',
          timing: 'next-round',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 20 },
        },
      ],
    }),
    manualModifiers: undefined,
  }
  const out = commitCombatAbilityCommand(input)
  expect(validateCombatEncounterState(out.state)).toEqual([])
  const restored = JSON.parse(JSON.stringify(out.state)) as typeof out.state
  const bad = {
    ...restored,
    pendingEffects: restored.pendingEffects!.map((row) => ({ ...row, abilityCommandFacts: facts })),
  } as typeof out.state
  expect(validateCombatEncounterState(bad)).toContainEqual(
    expect.objectContaining({ field: 'pendingEffects', message: 'Invalid pinned delayed effect.' }),
  )
  expect(() => finishPv1fTurn(bad as never, 'west')).toThrow('Invalid')
})
