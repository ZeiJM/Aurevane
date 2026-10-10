import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { applySkillCooldown } from './skill-cooldowns'

function fixture() {
  const root = captureCombatAbilitySource(source())
  const a = captureCombatAbilitySource(
    source(
      {
        id: 'bonus',
        mode: 'modifier',
        targeting: null,
        costs: [],
        effects: [{ id: 'a', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } }],
      },
      'a',
    ),
  )
  const b = captureCombatAbilitySource(
    source(
      {
        ...a.definition.behaviors[0]!,
        effects: [{ id: 'b', payload: { type: 'damage', recipient: 'primary-unit', amount: 2 } }],
      },
      'b',
    ),
  )
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    root,
    a,
    b,
  ])
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: root },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  }
}

describe('captured modifier composition', () => {
  it.each([
    'participant-budget',
    'cooldown-active',
    'activation-limit',
    'root-incompatible',
    'insufficient-ap',
    'reaction-budget-exhausted',
    'requirement-not-met',
  ] as const)(
    'committed optional suppression records private %s attribution without paying the candidate',
    (reason) => {
      let input = fixture()
      const root =
        reason === 'root-incompatible'
          ? captureCombatAbilitySource(
              source({
                classification: 'recovery',
                attackFamily: undefined,
                costs: [],
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
                  { id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } },
                ],
              }),
            )
          : input.root.source
      const automatic = captureCombatAbilitySource(
        source(
          {
            id: 'optional',
            activation: 'automatic',
            mode: 'modifier',
            targeting: null,
            costs: reason === 'insufficient-ap' ? [{ resource: 'ap', amount: 101 }] : [],
            cooldown:
              reason === 'cooldown-active' ? { key: 'optional-clock', ownerTurns: 1 } : null,
            activationLimits: reason === 'activation-limit' ? ['once-per-battle'] : [],
            requirements:
              reason === 'requirement-not-met'
                ? {
                    kind: 'all',
                    children: [
                      { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
                      {
                        kind: 'resource-state',
                        subject: 'owner',
                        resource: 'mp',
                        comparison: 'at-least',
                        amount: 21,
                      },
                    ],
                  }
                : { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
            effects: [
              { id: 'extra', payload: { type: 'damage', recipient: 'primary-unit', amount: 2 } },
            ],
          },
          'private-optional-source',
        ),
      )
      const explicit =
        reason === 'participant-budget'
          ? Array.from({ length: 15 }, (_, index) =>
              captureCombatAbilitySource(
                source(
                  {
                    id: 'manual',
                    mode: 'modifier',
                    targeting: null,
                    costs: [],
                    effects: [
                      {
                        id: 'extra',
                        payload: { type: 'damage', recipient: 'primary-unit', amount: 1 },
                      },
                    ],
                  },
                  `manual-${index}`,
                ),
              ),
            )
          : []
      let state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
        root,
        automatic,
        ...explicit,
      ])
      if (reason === 'cooldown-active')
        state = {
          ...state,
          tactical: {
            ...state.tactical,
            battle: {
              ...state.tactical.battle,
              combatants: state.tactical.battle.combatants.map((unit) =>
                unit.id === 'actor'
                  ? applySkillCooldown(
                      unit,
                      { key: 'optional-clock', ownerTurns: 1 },
                      { actionId: 'prior', definitionVersion: 1 },
                    ).combatant
                  : unit,
              ),
            },
          },
        }
      input = {
        ...input,
        state,
        root: { kind: 'canonical', source: root },
        selection: reason === 'root-incompatible' ? ({ kind: 'self' } as never) : input.selection,
        context: combatAbilityCommandContext(state, root),
      }
      if (reason === 'activation-limit') {
        state = JSON.parse(JSON.stringify(commitCombatAbilityCommand(input).state))
        input = { ...input, state, context: combatAbilityCommandContext(state, root) }
      }
      if (reason === 'reaction-budget-exhausted')
        input = {
          ...input,
          context: {
            ...input.context,
            triggerGuard: { ...input.context.triggerGuard, remainingReactionBudget: 0 },
          },
        }
      const command = {
        ...input,
        manualModifiers: explicit.map((source) => ({
          sourceInstanceId: source.sourceInstanceId,
          behaviorId: 'manual',
        })),
      }
      const before = JSON.stringify(command)
      const quote = prepareCombatAbilityCommand(command)
      const diagnostic = [
        {
          sourceInstanceId: automatic.sourceInstanceId,
          abilityId: automatic.abilityId,
          contentVersion: automatic.contentVersion,
          behaviorId: 'optional',
          reason,
        },
      ]
      expect(quote).toHaveProperty('modifierSuppressions', diagnostic)
      expect(JSON.stringify(command)).toBe(before)
      expect(
        quote.participants.some((row) => row.sourceInstanceId === automatic.sourceInstanceId),
      ).toBe(false)
      const out = commitCombatAbilityCommand(command)
      const ownerBefore = command.state.tactical.battle.combatants.find(
        (unit) => unit.id === 'actor',
      )!
      const ownerAfter = out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
      for (const resource of ['ap', 'mp', 'hp'] as const) {
        const beforeValue =
          resource === 'ap'
            ? ownerBefore.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!
                .current
            : ownerBefore[resource]
        const afterValue =
          resource === 'ap'
            ? ownerAfter.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!
                .current
            : ownerAfter[resource]
        expect(afterValue).toBe(
          beforeValue -
            (root.definition.behaviors[0]!.costs.find((cost) => cost.resource === resource)
              ?.amount ?? 0),
        )
      }
      expect(out.resolution!.triggerGuard.remainingReactionBudget).toBe(
        command.context.triggerGuard.remainingReactionBudget,
      )
      expect(out).toHaveProperty('modifierSuppressions', diagnostic)
      expect(out.events).toContainEqual(
        expect.objectContaining({ event: 'combat_action_used', modifierSuppressions: diagnostic }),
      )
      expect(
        out.state.abilityRuntime!.usage.filter((row) =>
          row.key.includes('private-optional-source'),
        ),
      ).toHaveLength(reason === 'activation-limit' ? 1 : 0)
      expect(
        out.events.some(
          (event) =>
            event.event === 'skill_cooldown_started' && event.cooldownKey === 'optional-clock',
        ),
      ).toBe(false)
    },
  )

  it('retains a Resonance modifier packet family without inventing pair Discipline', () => {
    const input = fixture()
    const resonance = captureCombatAbilitySource({
      ...source(
        {
          id: 'bonus',
          mode: 'modifier',
          targeting: null,
          costs: [],
          effects: [
            { id: 'resonant', payload: { type: 'damage', recipient: 'primary-unit', amount: 2 } },
          ],
        },
        'resonance-source',
      ),
      sourceKind: 'resonance',
      sourceDisciplineId: undefined,
    })
    const state = reconcileCombatAbilitySources(input.state, [input.root.source, resonance])
    const quote = prepareCombatAbilityCommand({
      ...input,
      state,
      manualModifiers: [{ sourceInstanceId: 'resonance-source', behaviorId: 'bonus' }],
    })
    expect(quote.action.effectOrigins?.[1]).toMatchObject({
      family: 'resonance',
      sourceInstanceId: 'resonance-source',
      behaviorId: 'bonus',
      effectId: 'resonant',
    })
  })
  it('sorts exact source/behavior blocks independently of request list order', () => {
    const input = fixture(),
      a = { sourceInstanceId: 'a', behaviorId: 'bonus' },
      b = { sourceInstanceId: 'b', behaviorId: 'bonus' }
    const one = prepareCombatAbilityCommand({ ...input, manualModifiers: [b, a] })
    const two = prepareCombatAbilityCommand({ ...input, manualModifiers: [a, b] })
    expect(one.action).toEqual(two.action)
    expect(one.action.effectOrigins!.map((row) => row?.sourceInstanceId)).toEqual([
      'source-a',
      'a',
      'b',
    ])
  })
  it.each([
    [{ sourceInstanceId: 'missing', behaviorId: 'bonus' }],
    [{ sourceInstanceId: 'source-a', behaviorId: 'strike' }],
    [
      { sourceInstanceId: 'a', behaviorId: 'bonus' },
      { sourceInstanceId: 'a', behaviorId: 'bonus' },
    ],
  ])('rejects missing/nonmodifier/duplicate explicit references %j', (...manualModifiers) => {
    const input = fixture(),
      before = JSON.stringify(input)
    expect(() => prepareCombatAbilityCommand({ ...input, manualModifiers })).toThrow(/modifier/)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('rejects a captured but inactive modifier', () => {
    const input = fixture()
    const state = reconcileCombatAbilitySources(input.state, [input.root.source])
    expect(() =>
      prepareCombatAbilityCommand({
        ...input,
        state,
        manualModifiers: [{ sourceInstanceId: 'a', behaviorId: 'bonus' }],
      }),
    ).toThrow(/modifier-source-inactive/)
  })
})
