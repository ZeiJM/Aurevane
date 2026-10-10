import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  finishPv1fTurn,
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
