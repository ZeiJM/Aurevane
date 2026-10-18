import { expect, it, vi } from 'vitest'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
  PV1F_GUARD_ACTION,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { projectBattleCommandQuote } from './battle-command-quote'

vi.mock('server-only', () => ({}))

function fixture(hidden = false) {
  const root = captureCombatAbilitySource(
    source({
      costs: [
        { resource: 'ap', amount: 2 },
        { resource: 'mp', amount: 3 },
        { resource: 'hp', amount: 1 },
      ],
      cooldown: { key: 'shared-clock', ownerTurns: 2 },
    }),
  )
  const manual = captureCombatAbilitySource({
    ...source(
      {
        id: 'extra',
        mode: 'modifier',
        targeting: null,
        costs: [
          { resource: 'ap', amount: 1 },
          { resource: 'mp', amount: 2 },
          { resource: 'hp', amount: 2 },
        ],
        cooldown: { key: 'shared-clock', ownerTurns: 4 },
        effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } }],
      },
      'manual',
    ),
    abilityId: 'owned.manual',
    contentVersion: 7,
  })
  const automatic = captureCombatAbilitySource({
    ...source(
      {
        id: 'reaction',
        activation: 'automatic',
        mode: 'modifier',
        targeting: null,
        requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
        costs: [
          { resource: 'ap', amount: 1 },
          { resource: 'mp', amount: 1 },
          { resource: 'hp', amount: 1 },
        ],
        cooldown: hidden ? { key: 'shared-clock', ownerTurns: 5 } : null,
        effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } }],
      },
      'private-automatic',
    ),
    abilityId: 'hidden.identity',
    sourceKind: hidden ? 'scenario' : 'essence',
  })
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  base.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp = 20
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [root, manual, automatic]),
    base.statBridge,
  )
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    manualModifiers: [{ sourceInstanceId: 'manual', behaviorId: 'extra' }],
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  }
  return { state, input }
}

it('projects exact atomic payment and one shared clock without settling a preview', () => {
  const { state, input } = fixture()
  const before = JSON.stringify(state)
  const prepared = prepareCombatAbilityCommand(input)
  expect(prepared.evaluation.legal).toBe(true)
  const quote = projectBattleCommandQuote(state, 'actor', { quote: prepared })
  expect(quote.commandCosts).toEqual([
    { resource: 'ap', amount: 4 },
    { resource: 'mp', amount: 6 },
    { resource: 'hp', amount: 4 },
  ])
  expect(quote.commandCooldowns).toEqual([
    {
      actionId: 'test.ability',
      contentVersion: 1,
      behaviorId: 'strike',
      role: 'root',
      ownerTurns: 4,
      ticksRemaining: 0,
    },
  ])
  expect(JSON.stringify(state)).toBe(before)
  const committed = commitCombatAbilityCommand(input)
  expect(readPv1fActionEconomy(committed.state as typeof state)!.current).toBe(96)
  expect(committed.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBe(16)
  expect(committed.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(14)
  expect(committed.events.filter((event) => event.event === 'skill_cooldown_started')).toHaveLength(
    1,
  )
})
it('retains hidden Automatic totals and shared duration without projecting private identities', () => {
  const { state, input } = fixture(true)
  const quote = projectBattleCommandQuote(state, 'actor', {
    quote: prepareCombatAbilityCommand(input),
  })
  expect(quote.commandCosts).toEqual([
    { resource: 'ap', amount: 4 },
    { resource: 'mp', amount: 6 },
    { resource: 'hp', amount: 4 },
  ])
  expect(quote.commandCooldowns).toEqual([
    {
      actionId: 'test.ability',
      contentVersion: 1,
      behaviorId: 'strike',
      role: 'root',
      ownerTurns: 5,
      ticksRemaining: 0,
    },
  ])
  expect(JSON.stringify(quote)).not.toMatch(
    /hidden.identity|private-automatic|sourceInstanceId|shared-clock|participants|suppressions|accuracy/,
  )
})
it('uses trusted native AP and authored MP with explicit zero HP', () => {
  const { state } = fixture()
  const quote = projectBattleCommandQuote(state, 'actor', {
    native: {
      action: { ...PV1F_GUARD_ACTION, cost: { ...PV1F_GUARD_ACTION.cost, mp: 3 } },
      apCost: 17,
    },
  })
  expect(quote.commandCosts).toEqual([
    { resource: 'ap', amount: 17 },
    { resource: 'mp', amount: 3 },
    { resource: 'hp', amount: 0 },
  ])
})
