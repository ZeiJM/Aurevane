import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { chooseBuildAwareRecruitAiDecision } from './recruit-ai-build'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import { createPv1fTemporaryResources, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import {
  constrainResonanceForecastToTarget,
  executeMatureSkillWithResonance,
  resolveResonanceForPair,
  createResonanceCombatState,
} from './resonance'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { P2_3_GUARD_ACTION, type CombatTargetSpec } from './actions'
function state() {
  const s = percentageDotEncounter()
  s.tactical.battle.combatants = s.tactical.battle.combatants.map((c) => ({
    ...c,
    temporaryResources: createPv1fTemporaryResources(10),
  }))
  return s
}
function skill(shape: CombatTargetSpec['shape']): MatureSkillDefinition {
  const base = resolveMatureSkillVersion('wildwarden.thorn-line')!
  return {
    ...base,
    target: {
      ...base.target,
      geometryVersion: 2,
      shape,
      minimumRange: 0,
      maximumRange:
        shape.kind === 'line' ? shape.length : shape.kind === 'circle' ? shape.radius : 0,
      requiresLineOfSight: shape.kind === 'all' ? false : base.target.requiresLineOfSight,
    },
    ai: { ...base.ai, baseUtility: 1000 },
    effects: [{ type: 'damage', recipient: 'affected-units', amount: 10, defenseKind: 'armor' }],
  }
}
describe('shared AI geometry decisions', () => {
  it('chooses the full lane with two enemies and avoids the ally lane', () => {
    const s = state()
    s.tactical.battle.combatants = s.tactical.battle.combatants.map((c) =>
      c.id === 'ally' ? { ...c, teamId: 'enemies' } : c,
    )
    s.tactical.placements = s.tactical.placements.map((p) =>
      p.combatantId === 'ally' ? { ...p, position: { x: 1, y: 0 } } : p,
    )
    const cast = skill({ kind: 'line', length: 3 })
    const decision = chooseBuildAwareRecruitAiDecision({
      state: s,
      tieBreakSeed: 17,
      skillOptions: { committedSkills: [cast] },
    })
    expect(decision.intent).toEqual({
      kind: 'action',
      actionId: cast.id,
      target: { kind: 'direction', direction: 'east' },
    })
  })
  it.each([{ kind: 'circle', radius: 2 }, { kind: 'all' }] as const)(
    'evaluates one %j activation with all recipients',
    (shape) => {
      const s = state()
      if (shape.kind === 'all')
        s.tactical.placements = s.tactical.placements.map((p) =>
          p.combatantId === 'other' ? { ...p, position: { x: 4, y: 4 } } : p,
        )
      const cast = skill(shape)
      expect(
        chooseBuildAwareRecruitAiDecision({
          state: s,
          tieBreakSeed: 17,
          skillOptions: { committedSkills: [cast] },
        }).intent,
      ).toEqual({ kind: 'action', actionId: cast.id, target: { kind: 'activate' } })
    },
  )
  it('does not spend AP on full-health All healing despite authored utility', () => {
    const s = state()
    const base = skill({ kind: 'all' })
    const cast = {
      ...base,
      tags: ['heal'],
      target: { ...base.target, teamPolicy: 'ally' as const, friendlyFire: 'allies-only' as const },
      effects: [{ type: 'healing', recipient: 'affected-units', amount: 10 } as const],
    }
    expect(
      chooseBuildAwareRecruitAiDecision({
        state: s,
        tieBreakSeed: 17,
        skillOptions: { committedSkills: [cast] },
      }).intent,
    ).not.toEqual({ kind: 'action', actionId: cast.id, target: { kind: 'activate' } })
  })
})
describe('area primary target boundaries', () => {
  it.each([{ kind: 'activate' }, { kind: 'direction', direction: 'east' }] as const)(
    'preserves armed historical primary-unit Resonance on %j',
    (selection) => {
      const cast = skill(
        selection.kind === 'activate' ? { kind: 'circle', radius: 2 } : { kind: 'line', length: 3 },
      )
      const forecast = {
        willActivate: true,
        willArm: false,
        willExpireArmedSetup: false,
        bonusEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 6 } as const],
        explanation: null,
      }
      expect(
        constrainResonanceForecastToTarget(forecast, cast, selection, ['enemy', 'other']),
      ).toEqual(
        expect.objectContaining({
          willActivate: false,
          willExpireArmedSetup: false,
          bonusEffects: [],
        }),
      )
    },
  )
  it('rejects primary-unit effects and target requirements in versioned area authoring', () => {
    const target = skill({ kind: 'line', length: 3 }).target
    expect(() =>
      validateCombatActionDefinition(
        {
          ...P2_3_GUARD_ACTION,
          target,
          effects: [{ type: 'damage', recipient: 'primary-unit', amount: 10 }],
        },
        PV1F_COMBAT_CONTENT,
      ),
    ).toThrow(/primary/i)
    expect(() =>
      validateCombatActionDefinition(
        {
          ...P2_3_GUARD_ACTION,
          target,
          requirements: [{ kind: 'target-tag-present', tag: 'Wet' }],
        },
        PV1F_COMBAT_CONTENT,
      ),
    ).toThrow(/primary/i)
  })
})

it('retains the armed setup after actual area execution without a historical primary payoff', () => {
  const s = state()
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder', 1)!
  const base = resolveMatureSkillVersion('vanguard.cleave')!
  const cast = {
    ...base,
    target: { ...base.target, geometryVersion: 2 as const, minimumRange: 0, maximumRange: 1 },
  }
  const armed = {
    ...createResonanceCombatState(resonance),
    armedByActionId: 'lifebinder.mending-light',
  }
  const result = executeMatureSkillWithResonance({
    state: s,
    resonance,
    resonanceState: armed,
    skill: cast,
    combatContext: 'pve',
    selection: { kind: 'activate' },
    content: PV1F_COMBAT_CONTENT,
  })
  expect(result.resonanceState.armedByActionId).toBe(armed.armedByActionId)
  expect(result.events.some((e) => e.event === 'resonance_activated')).toBe(false)
})
it('avoids an allied damaging lane under Anyone friendly fire', () => {
  const s = state()
  const base = skill({ kind: 'line', length: 3 })
  const cast = {
    ...base,
    target: { ...base.target, teamPolicy: 'any' as const, friendlyFire: 'all-units' as const },
  }
  expect(
    chooseBuildAwareRecruitAiDecision({
      state: s,
      tieBreakSeed: 17,
      skillOptions: { committedSkills: [cast] },
    }).intent,
  ).toMatchObject({ target: { kind: 'direction', direction: 'east' } })
})
