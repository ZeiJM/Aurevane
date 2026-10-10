import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT, finishPv1fTurn } from './pv1f-action-economy'
import { source } from './combat-behavior.test-utils'
import { P35_REPRESENTATIVE_RESONANCES } from './resonance'
import { convertV5ResonanceToV2 } from './resonance-v2'
import {
  activateCombatAbility,
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  materializeCombatAbilityAction,
} from './combat-behavior-runtime'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CombatActionSourceType } from './actions'
import {
  canonicalCombatActionSourceKind,
  capturedResonanceAbilitySource,
} from './combat-action-source'
import type { CombatActionSourceKind } from './combat-kernel-types'

describe('canonical combat action source mapping', () => {
  it.each([
    ['basic-attack', 'basic'],
    ['basic-action', 'basic'],
    ['discipline-skill', 'discipline-skill'],
    ['scenario', 'scenario'],
    ['test', 'test'],
  ] as const)('maps current action source %s into kernel source %s', (source, expected) => {
    const canonical = canonicalCombatActionSourceKind(source)

    expect(canonical).toBe(expected)
    expectTypeOf(canonical).toEqualTypeOf<CombatActionSourceKind>()
  })

  it('covers every current persisted source type', () => {
    const currentSources: readonly CombatActionSourceType[] = [
      'basic-attack',
      'basic-action',
      'discipline-skill',
      'scenario',
      'test',
    ]

    expect(currentSources.map(canonicalCombatActionSourceKind)).toEqual([
      'basic',
      'basic',
      'discipline-skill',
      'scenario',
      'test',
    ])
  })
})

describe('canonical Resonance capture admission', () => {
  const variants = [
    P35_REPRESENTATIVE_RESONANCES[0]!,
    convertV5ResonanceToV2(P35_REPRESENTATIVE_RESONANCES[0]!),
  ]
  it.each(variants)(
    'captures and commits exact V1/V2 identity with truthful origin $id',
    (legacy) => {
      const state = preparePv1fTurnEconomy(percentageDotEncounter())
      const definition = {
        ...legacy,
        ability: source({
          effects: [
            {
              id: 'later',
              timing: 'delayed',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
            },
          ],
        }).definition,
      }
      const captured = capturedResonanceAbilitySource(
        state,
        'actor',
        definition,
        legacy.disciplinePair,
      )!
      expect(captured.sourceKind).toBe('resonance')
      expect(captured.sourceDisciplineId).toBeUndefined()
      expect(Object.isFrozen(captured.definition)).toBe(true)
      expect(
        materializeCombatAbilityAction(captured, captured.definition.behaviors[0]!)
          .effectOrigins?.[0]?.family,
      ).toBe('resonance')
      const active = reconcileCombatAbilitySources(state, [captured])
      const restored = JSON.parse(JSON.stringify(active))
      const pinned = capturedResonanceAbilitySource(
        restored,
        'actor',
        { ...definition, ability: null, enabled: false } as never,
        legacy.disciplinePair,
      )!
      expect(pinned).toEqual(captured)
      expect(Object.isFrozen(pinned.definition)).toBe(true)
      const input = {
        state: restored,
        actorId: 'actor',
        source: pinned,
        selection: { kind: 'unit' as const, combatantId: 'enemy' },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(restored, pinned),
      }
      const out = activateCombatAbility(input)
      expect(
        out.state.tactical.battle.combatants
          .find((unit) => unit.id === 'actor')
          ?.temporaryResources.find((row) => row.key === 'pv1f.action-economy')?.current,
      ).toBe(89)
      expect(out.state.abilityRuntime?.usage).toHaveLength(1)
      expect(out.state.pendingEffects?.[0]?.effectOrigin).toMatchObject({
        family: 'resonance',
        sourceInstanceId: captured.sourceInstanceId,
        contentId: legacy.id,
        contentVersion: legacy.contentVersion,
      })
      let settling = JSON.parse(JSON.stringify(out.state))
      const events: { event: string; amount?: number }[] = []
      while (settling.tactical.battle.round < state.tactical.battle.round + 2) {
        const turn = finishPv1fTurn(settling, 'east')
        settling = turn.state
        events.push(...(turn.events as typeof events))
      }
      expect(events.find((event) => event.event === 'damage_applied')?.amount).toBe(10)
      expect(
        events.some((event) => ['ap_spent', 'mp_spent', 'hp_spent'].includes(event.event)),
      ).toBe(false)
      expect(() =>
        activateCombatAbility({ ...input, state: reconcileCombatAbilitySources(active, []) }),
      ).toThrow('inactive')
    },
  )
  it('rejects malformed, disabled, missing-owner and mismatched pair/version records', () => {
    const state = preparePv1fTurnEconomy(percentageDotEncounter()),
      legacy = variants[0]!
    const definition = { ...legacy, ability: source().definition }
    expect(() =>
      capturedResonanceAbilitySource(state, 'absent', definition, legacy.disciplinePair),
    ).toThrow('owner-unavailable')
    expect(() =>
      capturedResonanceAbilitySource(
        state,
        'actor',
        { ...definition, ability: null } as never,
        legacy.disciplinePair,
      ),
    ).toThrow('ability')
    expect(() =>
      capturedResonanceAbilitySource(
        state,
        'actor',
        { ...definition, enabled: false },
        legacy.disciplinePair,
      ),
    ).toThrow('disabled')
    expect(() =>
      capturedResonanceAbilitySource(state, 'actor', definition, ['chronist', 'vanguard']),
    ).toThrow('pair-mismatch')
    const captured = capturedResonanceAbilitySource(
      state,
      'actor',
      definition,
      legacy.disciplinePair,
    )!
    const active = reconcileCombatAbilitySources(state, [captured])
    expect(() =>
      capturedResonanceAbilitySource(
        active,
        'actor',
        { ...definition, contentVersion: definition.contentVersion + 1 },
        legacy.disciplinePair,
      ),
    ).toThrow('version-mismatch')
    expect(() =>
      capturedResonanceAbilitySource(active, 'actor', definition, ['chronist', 'vanguard']),
    ).toThrow('pair-mismatch')
    expect(capturedResonanceAbilitySource(state, 'actor', legacy, legacy.disciplinePair)).toBeNull()
  })
})
