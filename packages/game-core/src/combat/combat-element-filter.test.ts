import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  combatAbilityCommandContext,
  materializeCombatAbilityAction,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { executeCombatAction } from './actions'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'

it.each(['ongoing', 'manual', 'automatic'] as const)(
  'filters %s amplification by each Fire/Water packet',
  (activation) => {
    const root = source({ costs: [] })
    const action = {
      ...materializeCombatAbilityAction(root, root.definition.behaviors[0]!),
      effectTimingModes: undefined,
      effectOrigins: undefined,
      effects: [
        {
          type: 'damage' as const,
          recipient: 'primary-unit' as const,
          amount: 10,
          element: 'fire' as const,
        },
        {
          type: 'damage' as const,
          recipient: 'primary-unit' as const,
          amount: 10,
          element: 'water' as const,
        },
      ],
    }
    const modifier = source(
      {
        activation,
        mode: 'modifier',
        targeting: null,
        costs: [],
        requirements:
          activation === 'automatic'
            ? { kind: 'event', eventType: 'combat_action_used', phase: 'before' }
            : null,
        effects: [
          {
            id: 'bonus',
            payload: {
              type: 'damage-bonus',
              recipient: 'actor',
              multiplierBasisPoints: 15000,
              elementFilter: 'fire',
            },
          },
        ],
      },
      'amplifier',
    )
    const state = reconcileCombatAbilitySources(percentageDotEncounter(), [modifier])
    const selection = { kind: 'unit' as const, combatantId: 'enemy' }
    const out =
      activation === 'ongoing'
        ? executeCombatAction(state, action, selection, PV1F_COMBAT_CONTENT)
        : commitCombatAbilityCommand({
            state,
            actorId: 'actor',
            root: {
              kind: 'native',
              action,
              sourceInstanceId: 'native',
              costs: [],
              classification: 'attack',
              attackFamily: 'physical',
            },
            selection,
            content: PV1F_COMBAT_CONTENT,
            context: combatAbilityCommandContext(state, root),
            manualModifiers:
              activation === 'manual'
                ? [{ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'strike' }]
                : undefined,
          })
    expect(
      out.events.filter((event) => event.event === 'damage_applied').map((event) => event.amount),
    ).toEqual([15, 10])
  },
)

it('keeps unfiltered historical damage bonuses on every direct packet', () => {
  const root = source({ costs: [] })
  const bonus = source({
    activation: 'ongoing',
    mode: 'modifier',
    targeting: null,
    costs: [],
    effects: [
      {
        id: 'bonus',
        payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
      },
    ],
  })
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [bonus])
  const action = {
    ...materializeCombatAbilityAction(root, root.definition.behaviors[0]!),
    effectTimingModes: undefined,
    effectOrigins: undefined,
    effects: ['fire', 'water'].map((element) => ({
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 10,
      element: element as 'fire' | 'water',
    })),
  }
  const out = executeCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  expect(
    out.events.filter((event) => event.event === 'damage_applied').map((event) => event.amount),
  ).toEqual([15, 15])
})
it('does not amplify an already captured periodic Burn magnitude again', async () => {
  const { applyCurrentBurnState } = await import('./combat-dots')
  const { finishPv1fTurn } = await import('./pv1f-action-economy')
  const bonus = source({
    activation: 'ongoing',
    mode: 'modifier',
    targeting: null,
    costs: [],
    effects: [
      {
        id: 'bonus',
        payload: {
          type: 'damage-bonus',
          recipient: 'actor',
          multiplierBasisPoints: 15000,
          elementFilter: 'fire',
        },
      },
    ],
  })
  let state = reconcileCombatAbilitySources(percentageDotEncounter(), [bonus])
  state = applyCurrentBurnState(state, 'actor', 'enemy', 'captured-burn', false, undefined, 2, {
    capturedDamage: 100,
    profile: { kind: 'attack-percentage', basisPoints: 1500 },
  })
  const events = []
  while (state.tactical.battle.round === 1) {
    const next = finishPv1fTurn(state as never, 'east')
    state = next.state
    events.push(...(next.events as import('./actions').CombatResolutionEvent[]))
  }
  expect(
    events
      .filter((event) => event.event === 'damage_applied' && event.targetCombatantId === 'enemy')
      .map((event) => (event.event === 'damage_applied' ? event.amount : 0)),
  ).toEqual([15])
})
