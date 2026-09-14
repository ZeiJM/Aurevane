import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  actionDefinitionId,
  assertNever,
  battleId,
  combatantId,
  contentVersion,
  createCombatActionProvenance,
  rulesetVersion,
  statusDefinitionId,
  tacticalEntityId,
  triggerChainId,
  type ActionDefinitionId,
  type BattleId,
  type CombatActionProvenance,
  type CombatActionSourceKind,
  type CombatantId,
  type ContentVersion,
  type RulesetVersion,
  type StatusDefinitionId,
  type TacticalEntityId,
  type TriggerChainId,
} from './combat-kernel-types'

describe('combat kernel identity primitives', () => {
  it('creates strongly typed stable identifiers without changing their persisted value', () => {
    const battle = battleId('battle-123')
    const combatant = combatantId('combatant-456')
    const action = actionDefinitionId('skill.vanguard.forceful-strike')
    const status = statusDefinitionId('status.guarded')
    const entity = tacticalEntityId('entity-objective-a')
    const chain = triggerChainId('trigger-chain-789')

    expect(battle).toBe('battle-123')
    expect(combatant).toBe('combatant-456')
    expect(action).toBe('skill.vanguard.forceful-strike')
    expect(status).toBe('status.guarded')
    expect(entity).toBe('entity-objective-a')
    expect(chain).toBe('trigger-chain-789')

    expectTypeOf(battle).toEqualTypeOf<BattleId>()
    expectTypeOf(combatant).toEqualTypeOf<CombatantId>()
    expectTypeOf(action).toEqualTypeOf<ActionDefinitionId>()
    expectTypeOf(status).toEqualTypeOf<StatusDefinitionId>()
    expectTypeOf(entity).toEqualTypeOf<TacticalEntityId>()
    expectTypeOf(chain).toEqualTypeOf<TriggerChainId>()
  })

  it.each(['', '   ', ' combatant-1', 'combatant-1 '])(
    'rejects unstable or blank persisted identifiers: %j',
    (value) => {
      expect(() => combatantId(value)).toThrow(TypeError)
    },
  )

  it('creates positive safe integer content and ruleset versions', () => {
    const content = contentVersion(3)
    const ruleset = rulesetVersion(2)

    expect(content).toBe(3)
    expect(ruleset).toBe(2)
    expectTypeOf(content).toEqualTypeOf<ContentVersion>()
    expectTypeOf(ruleset).toEqualTypeOf<RulesetVersion>()
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid content versions: %j',
    (value) => {
      expect(() => contentVersion(value)).toThrow(TypeError)
    },
  )
})

describe('combat action provenance', () => {
  it('captures the ruleset, exact action version, controller and trigger chain', () => {
    const provenance = createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: 'skill.ironfist.rising-fist',
      actionVersion: 4,
      sourceCombatantId: 'combatant-attacker',
      controllerCombatantId: 'combatant-attacker',
      triggerChainId: 'chain-001',
    })

    expect(provenance).toEqual({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: 'skill.ironfist.rising-fist',
      actionVersion: 4,
      sourceCombatantId: 'combatant-attacker',
      controllerCombatantId: 'combatant-attacker',
      triggerChainId: 'chain-001',
    })
    expectTypeOf(provenance).toEqualTypeOf<CombatActionProvenance>()
  })

  it('supports non-player action sources without introducing parallel executors', () => {
    const sources: CombatActionProvenance['sourceKind'][] = [
      'basic',
      'discipline-skill',
      'essence',
      'equipment',
      'soulmark',
      'mantle',
      'status-granted',
      'tactical-entity',
      'scenario',
      'temporary-encounter',
      'test',
    ]

    expect(sources).toHaveLength(11)
  })

  it('rejects invalid persisted provenance at the construction boundary', () => {
    expect(() =>
      createCombatActionProvenance({
        rulesetVersion: 0,
        sourceKind: 'discipline-skill',
        actionDefinitionId: 'skill.test',
        actionVersion: 1,
        sourceCombatantId: 'combatant-a',
        controllerCombatantId: 'combatant-a',
        triggerChainId: 'chain-a',
      }),
    ).toThrow(TypeError)

    expect(() =>
      createCombatActionProvenance({
        rulesetVersion: 1,
        sourceKind: 'discipline-skill',
        actionDefinitionId: ' skill.test',
        actionVersion: 1,
        sourceCombatantId: 'combatant-a',
        controllerCombatantId: 'combatant-a',
        triggerChainId: 'chain-a',
      }),
    ).toThrow(TypeError)

    expect(() =>
      createCombatActionProvenance({
        rulesetVersion: 1,
        sourceKind: 'arbitrary-script' as CombatActionSourceKind,
        actionDefinitionId: 'skill.test',
        actionVersion: 1,
        sourceCombatantId: 'combatant-a',
        controllerCombatantId: 'combatant-a',
        triggerChainId: 'chain-a',
      }),
    ).toThrow(TypeError)
  })
})

describe('exhaustiveness guard', () => {
  it('throws a diagnostic error if an allegedly impossible variant reaches runtime', () => {
    expect(() => assertNever('future-effect' as never, 'CombatEffectDefinition')).toThrow(
      'Unhandled CombatEffectDefinition variant: future-effect',
    )
  })
})