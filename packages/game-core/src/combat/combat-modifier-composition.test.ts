import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand } from './combat-ability-command'

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
