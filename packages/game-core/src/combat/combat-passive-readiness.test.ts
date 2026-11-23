import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import {
  createCombatAbilityEventSession,
  captureCombatAbilityMutation,
  processCombatAbilityEvent,
} from './combat-ability-events'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import {
  PV1F_COMBAT_CONTENT,
  executePv1fMovement,
  preparePv1fTurnEconomy,
} from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import type { CombatEncounterState } from './actions'

function fixture() {
  const captured = captureCombatAbilitySource(
    source({
      activation: 'automatic',
      requirementMode: 'simple',
      automaticTrigger: 'requirements-met',
      automaticTarget: { subject: 'selected' },
      requirements: {
        kind: 'status-presence',
        subject: 'owner',
        statusId: 'reckless',
        present: true,
      },
      costs: [{ resource: 'mp', amount: 3 }],
      cooldown: { key: 'passive', ownerTurns: 4 },
      activationLimits: ['once-per-action', 'once-per-round'],
      targeting: { ...source().definition.behaviors[0]!.targeting!, maximumRange: 1 },
    }),
  )
  const base = percentageDotEncounter()
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      statusState: base.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'reckless',
                  statusVersion: 1,
                  sourceCombatantId: 'actor',
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                },
              ],
            }
          : row,
      ),
    },
    [captured],
  )
  return { captured, state }
}
function settle(
  state: CombatEncounterState,
  captured: ReturnType<typeof captureCombatAbilitySource>,
  before = state,
) {
  const context = combatAbilityCommandContext(state, captured)
  const session = createCombatAbilityEventSession(context.triggerGuard, state)
  const mutation = captureCombatAbilityMutation(before, state, 'readiness', session, {
    events: [{ type: 'combatant_displaced', phase: 'after' }],
    triggeringCombatantId: 'ally',
    affectedCombatantIds: ['ally'],
    resourceMutations: [],
  })
  return processCombatAbilityEvent(
    mutation.state,
    mutation.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    (input) =>
      prepareCombatAbilityCommand(input).evaluation.legal
        ? commitCombatAbilityCommand(input)
        : { state: input.state, events: [] },
  )
}
describe('generic automatic passive readiness', () => {
  it.each([
    { trigger: 'requirements-met', ap: 100 },
    { trigger: 'damage-dealt', ap: 100 },
    { trigger: 'requirements-met', ap: 80 },
    { trigger: 'damage-dealt', ap: 80 },
    { trigger: 'modifier', ap: 100 },
  ] as const)(
    'reserves entered-tile AP through nested $trigger commands costing $ap AP',
    ({ trigger, ap }) => {
      const make = (id: string, ap: number) =>
        captureCombatAbilitySource(
          source(
            {
              activation: 'automatic',
              mode: ap > 0 && trigger === 'modifier' ? 'modifier' : 'action',
              requirementMode: 'simple',
              ...(ap > 0 && trigger === 'modifier'
                ? {}
                : {
                    automaticTrigger:
                      ap === 0 || trigger === 'modifier' ? 'requirements-met' : trigger,
                    automaticTarget: {
                      subject: ap === 0 || trigger === 'requirements-met' ? 'selected' : 'affected',
                    },
                  }),
              requirements: null,
              costs: [{ resource: 'ap', amount: ap }],
              cooldown: null,
              activationLimits: ['once-per-action'],
              targeting:
                ap > 0 && trigger === 'modifier'
                  ? null
                  : { ...source().definition.behaviors[0]!.targeting!, maximumRange: 1 },
              effects: [
                { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } },
              ],
            },
            id,
          ),
        )
      const base = preparePv1fTurnEconomy(percentageDotEncounter())
      const walking = reattachStatDrivenCombatBridge(
        reconcileCombatAbilitySources(
          {
            ...base,
            tactical: {
              ...base.tactical,
              placements: base.tactical.placements.map((p) =>
                p.combatantId === 'enemy' ? { ...p, position: { x: 2, y: 0 } } : p,
              ),
            },
          },
          [make('a', 0), make('b', ap)],
        ),
        base.statBridge,
      )
      const result = executePv1fMovement(walking, [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ])
      const affordable = ap <= 80
      expect(
        result.events.filter(
          (e) =>
            e !== null && typeof e === 'object' && 'event' in e && e.event === 'combat_action_used',
        ),
      ).toHaveLength(affordable ? 2 : 1)
      expect(
        result.events.filter(
          (e) =>
            e !== null && typeof e === 'object' && 'event' in e && e.event === 'damage_applied',
        ),
      ).toHaveLength(affordable ? 2 : 1)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'action_economy_spent',
          amount: 20,
          remaining: affordable ? 0 : 80,
        }),
      )
      expect(result.state.tactical.battle.currentTurn!.movementRemaining).toBe(
        base.tactical.battle.currentTurn!.movementRemaining - 1,
      )
    },
  )
  it('fires on an intermediate entered tile even when the path ends outside range', () => {
    const { state, captured } = fixture()
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    const walking = reattachStatDrivenCombatBridge(
      {
        ...state,
        tactical: {
          ...state.tactical,
          placements: state.tactical.placements.map((p) =>
            p.combatantId === 'enemy'
              ? { ...p, position: { x: 2, y: 2 } }
              : p.combatantId === 'other'
                ? { ...p, position: { x: 4, y: 4 } }
                : p.combatantId === 'ally'
                  ? { ...p, position: { x: 0, y: 4 } }
                  : p,
          ),
        },
      },
      base.statBridge,
    )
    const result = executePv1fMovement(walking, [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'combat_action_used', actionId: captured.abilityId }),
    )
  })
  it('settles a Primed requirement at the free prime boundary without an action-use event', () => {
    const { captured } = fixture()
    const passive = captureCombatAbilitySource({
      ...captured,
      sourceInstanceId: 'prime-passive',
      definition: {
        schemaVersion: 1,
        behaviors: [
          {
            ...captured.definition.behaviors[0]!,
            requirements: { kind: 'prime-presence', subject: 'owner', present: true },
          },
        ],
      },
    })
    const controlled = captureCombatAbilitySource(
      source(
        {
          effects: [
            {
              id: 'hit',
              timing: 'controlled',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 1 },
            },
          ],
        },
        'controlled-source',
      ),
    )
    const state = reconcileCombatAbilitySources(percentageDotEncounter(), [passive, controlled])
    const result = primeCombatControlledAbility({
      state,
      actorId: 'actor',
      sourceInstanceId: controlled.sourceInstanceId,
      behaviorId: 'strike',
    })
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'enemy' }),
    )
    expect(result.events.filter((e) => e.event === 'combat_action_used')).toHaveLength(1)
  })
  it('finds a legal enemy without requiring a damage or enemy-turn event', () => {
    const { state, captured } = fixture()
    const result = settle(state, captured)
    expect(result.events.filter((e) => e.event === 'damage_applied')).toMatchObject([
      { targetCombatantId: 'enemy' },
    ])
    expect(result.state.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp).toBe(17)
    expect(settle(result.state, captured).events).toEqual([])
  })
  it('retries when an enemy enters range while the owner requirement remains true', () => {
    const { state, captured } = fixture()
    const far = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((p) =>
          p.combatantId === 'enemy' ? { ...p, position: { x: 4, y: 4 } } : p,
        ),
      },
    }
    const first = settle(far, captured)
    expect(first.events).toEqual([])
    const near = {
      ...first.state,
      tactical: { ...first.state.tactical, placements: state.tactical.placements },
    }
    expect(settle(near, captured, first.state).events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', targetCombatantId: 'enemy' }),
    )
  })
  it.each(['absent', 'pending', 'dead', 'terminal', 'unaffordable'] as const)(
    'does not fire with %s eligibility',
    (reason) => {
      const { state, captured } = fixture()
      const changed: CombatEncounterState = {
        ...state,
        statusState: state.statusState.map((row) =>
          row.combatantId === 'actor'
            ? {
                ...row,
                statuses:
                  reason === 'absent'
                    ? []
                    : row.statuses.map((s) =>
                        reason === 'pending'
                          ? { ...s, timingState: 'pending' as const, activationRound: 2 }
                          : s,
                      ),
              }
            : row,
        ),
        tactical: {
          ...state.tactical,
          battle: {
            ...state.tactical.battle,
            ...(reason === 'terminal'
              ? { lifecycle: 'completed' as const, currentTurn: null }
              : {}),
            combatants: state.tactical.battle.combatants.map((u) =>
              u.id === 'actor'
                ? {
                    ...u,
                    hp: reason === 'dead' ? 0 : u.hp,
                    mp: reason === 'unaffordable' ? 0 : u.mp,
                  }
                : u,
            ),
          },
        },
      }
      expect(settle(changed, captured).events).toEqual([])
    },
  )
})
