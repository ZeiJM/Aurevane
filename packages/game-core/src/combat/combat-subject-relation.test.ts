import { describe, expect, it } from 'vitest'
import {
  evaluateAbilityRequirements,
  evaluateAutomaticRequirementTrigger,
  validateAbilityRequirements,
  type RequirementNode,
  type AbilityRequirementSubject,
} from './combat-requirements'
import { validateAbilityDefinition } from './combat-definition'
import {
  combatAbilitySubject,
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  captureCombatAbilityEventFrame,
  combatAbilityFrameRequirements,
  createCombatAbilityEventSession,
} from './combat-ability-events'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { advanceRosterTurns } from './roster-outcome.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { source } from './combat-behavior.test-utils'

const relation = (
  value: 'same-unit' | 'ally' | 'enemy',
  subject: AbilityRequirementSubject = 'triggering',
  otherSubject: AbilityRequirementSubject = 'owner',
): Extract<RequirementNode, { kind: 'subject-relation' }> => ({
  kind: 'subject-relation',
  subject,
  otherSubject,
  relation: value,
})
const ownerRelation = relation('same-unit')

describe('native subject relations', () => {
  it('accepts only typed relations and existing subject roles', () => {
    for (const value of ['same-unit', 'ally', 'enemy'] as const)
      for (const subject of ['owner', 'selected', 'affected', 'triggering'] as const)
        expect(validateAbilityRequirements(relation(value, subject))).toEqual([])
    for (const invalid of [
      { ...relation('ally'), relation: 'neutral' },
      { ...relation('ally'), subject: 'arbitrary' },
      { ...relation('ally'), otherSubject: 'arbitrary' },
      { ...relation('ally'), combatantId: 'actor' },
      { kind: 'subject-relation', subject: 'owner', relation: 'ally' },
    ])
      expect(validateAbilityRequirements(invalid)).not.toEqual([])
  })
  it('compares native identity and teams, with ally excluding Self', () => {
    const state = percentageDotEncounter(),
      owner = combatAbilitySubject(state, 'actor')
    expect(owner).toMatchObject({ combatantId: 'actor', teamId: 'players' })
    for (const [id, same, ally, enemy] of [
      ['actor', true, false, false],
      ['ally', false, true, false],
      ['enemy', false, false, true],
    ] as const) {
      const context = { owner, triggering: combatAbilitySubject(state, id) }
      for (const [value, expected] of [
        ['same-unit', same],
        ['ally', ally],
        ['enemy', enemy],
      ] as const)
        expect(evaluateAbilityRequirements(relation(value), context)).toBe(expected)
    }
  })
  it('fails closed on absent identity/team and ambiguous affected roles', () => {
    for (const triggering of [
      null,
      {},
      { combatantId: 'ally' },
      { combatantId: '', teamId: 'players' },
    ])
      expect(
        evaluateAbilityRequirements(relation('ally'), {
          owner: { combatantId: 'actor', teamId: 'players' },
          triggering,
        }),
      ).toBe(false)
    const state = percentageDotEncounter(),
      context = combatAbilityCommandContext(state, source())
    const frame = captureCombatAbilityEventFrame(
      state,
      state,
      'plural',
      createCombatAbilityEventSession(context.triggerGuard),
      {
        events: [{ type: 'damage_applied', phase: 'after' }],
        affectedCombatantIds: ['ally', 'enemy'],
        resourceMutations: [],
      },
    )
    expect(
      evaluateAbilityRequirements(
        relation('ally', 'affected'),
        combatAbilityFrameRequirements(frame, 'actor', frame.events[0]),
      ),
    ).toBe(false)
  })
  it('anchors either nonowner role in every Automatic branch and does not invent an event pulse', () => {
    const base = source({ activation: 'automatic', automaticTarget: { subject: 'triggering' } })
      .definition.behaviors[0]!
    const event = { kind: 'event', eventType: 'damage_applied', phase: 'after' }
    for (const requirements of [
      relation('enemy'),
      relation('enemy', 'owner', 'selected'),
      { kind: 'any', children: [event, relation('ally')] },
    ])
      expect(
        validateAbilityDefinition({ schemaVersion: 1, behaviors: [{ ...base, requirements }] }),
      ).toContainEqual(expect.objectContaining({ code: 'automatic-state-anchor-required' }))
    expect(
      validateAbilityDefinition({
        schemaVersion: 1,
        behaviors: [
          { ...base, requirements: { kind: 'all', children: [event, relation('enemy')] } },
        ],
      }),
    ).toEqual([])
    expect(
      evaluateAutomaticRequirementTrigger(
        ownerRelation,
        {
          owner: { combatantId: 'actor', teamId: 'players' },
          triggering: { combatantId: 'actor', teamId: 'players' },
        },
        true,
      ),
    ).toEqual({ holds: true, stateTruth: true, eventMatched: false, stateEntered: false })
  })
  it('freezes native frame identity/team independently from later encounter mutation', () => {
    const state = percentageDotEncounter(),
      context = combatAbilityCommandContext(state, source())
    const frame = captureCombatAbilityEventFrame(
      state,
      state,
      'own',
      createCombatAbilityEventSession(context.triggerGuard),
      {
        events: [{ type: 'combat_action_used', phase: 'after' }],
        triggeringCombatantId: 'actor',
        affectedCombatantIds: [],
        resourceMutations: [],
      },
    )
    const before = combatAbilityFrameRequirements(frame, 'actor', frame.events[0])
    expect(before.triggering).toMatchObject({ combatantId: 'actor', teamId: 'players' })
    state.tactical.battle.combatants[0]!.teamId = 'changed'
    expect(combatAbilityFrameRequirements(frame, 'actor', frame.events[0]).triggering).toEqual(
      before.triggering,
    )
    expect(Object.isFrozen(frame.subjects[0]!.after)).toBe(true)
  })
  it('native commands reward owner events and reject unrelated same-Discipline actions after restore', () => {
    const root = captureCombatAbilitySource(
      source({ costs: [{ resource: 'ap', amount: 20 }] }, 'root'),
    )
    const foreign = captureCombatAbilitySource({
      ...root,
      sourceInstanceId: 'foreign',
      ownerCombatantId: 'enemy',
    })
    const passive = captureCombatAbilitySource(
      source(
        {
          id: 'react',
          activation: 'automatic',
          classification: 'utility',
          attackFamily: undefined,
          costs: [{ resource: 'mp', amount: 1 }],
          cooldown: null,
          activationLimits: ['once-per-owner-turn'],
          requirements: {
            kind: 'all',
            children: [
              { kind: 'event', eventType: 'combat_action_used', phase: 'after' },
              { kind: 'action', classification: 'attack', sourceDisciplineId: 'vanguard' },
              ownerRelation,
            ],
          },
          targeting: {
            kind: 'self',
            teamPolicy: 'self',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 0,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            friendlyFire: 'allies-only',
            maximumSelections: 1,
          },
          effects: [
            {
              id: 'rebate',
              payload: { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 3 },
            },
          ],
        },
        'passive',
      ),
    )
    const initial = reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(percentageDotEncounter()),
      [root, foreign, passive],
    )
    initial.tactical.battle.combatants[0]!.mp = 10
    const command = (
      state: typeof initial,
      actorId: string,
      captured: typeof root,
      targetId: string,
    ) => ({
      state,
      actorId,
      root: { kind: 'canonical' as const, source: captured },
      selection: { kind: 'unit' as const, combatantId: targetId },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    })
    const own = commitCombatAbilityCommand(command(initial, 'actor', root, 'enemy'))
    expect(own.state.tactical.battle.combatants[0]!.mp).toBe(12)
    const restored = JSON.parse(JSON.stringify(own.state)) as typeof initial
    expect(
      commitCombatAbilityCommand(command(restored, 'actor', root, 'enemy')).state.tactical.battle
        .combatants[0]!.mp,
    ).toBe(12)
    const enemyTurn = advanceRosterTurns(initial, 1)
    expect(enemyTurn.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(
      commitCombatAbilityCommand(command(enemyTurn, 'enemy', foreign, 'actor')).state.tactical
        .battle.combatants[0]!.mp,
    ).toBe(10)
  })
})
