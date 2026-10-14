import { expect, it } from 'vitest'
import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  resolveBattleCapturedSkill,
  selectBattleSkillPreviewIntent,
  selectDirectionalBattleSkillPreviewIntent,
  selectInitialBattleSkillPreviewIntent,
} from './battle-preview-selection'

const legacy = {
  id: 'ability',
  targetKind: 'self' as const,
  targetTeamPolicy: 'self' as const,
  minimumRange: 0,
  maximumRange: 0,
}
const target = {
  ...createPv1fBasicAttackDefinition(1).target,
  geometryVersion: 3 as const,
  categories: ['enemy' as const, 'ground' as const],
  maximumSelections: 3,
  minimumRange: 1,
  maximumRange: 4,
}
const captures = [{ actionId: legacy.id, behaviorId: 'strike', target }]
const selection = {
  actorId: 'actor',
  selectedCombatantId: 'enemy',
  selectedTile: null,
  combatants: [
    { combatantId: 'actor', teamIndex: 0, hp: 100, position: { x: 0, y: 0 } },
    { combatantId: 'enemy', teamIndex: 1, hp: 100, position: { x: 1, y: 0 } },
  ],
}

it('uses exact captured targeting instead of the legacy self envelope', () => {
  const skill = resolveBattleCapturedSkill(legacy, captures)
  expect(skill).toMatchObject({
    targetKind: 'unit',
    targetTeamPolicy: 'enemy',
    minimumRange: 1,
    maximumRange: 4,
    behaviorId: 'strike',
    target,
  })
  expect(selectBattleSkillPreviewIntent(skill!, selection)).toEqual({
    kind: 'action',
    actionId: 'ability',
    behaviorId: 'strike',
    target: { kind: 'unit', combatantId: 'enemy' },
  })
  expect(legacy.targetKind).toBe('self')
})

it('requires an explicit behavior when an ability has multiple Manual actions', () => {
  const choices = [...captures, { ...captures[0]!, behaviorId: 'protect' }]
  expect(resolveBattleCapturedSkill(legacy, choices)).toBeNull()
  expect(resolveBattleCapturedSkill(legacy, choices, 'protect')?.behaviorId).toBe('protect')
  expect(resolveBattleCapturedSkill(legacy, choices, 'removed')).toBeNull()
})

it('preserves historical absence and rejects stale canonical behavior references', () => {
  expect(resolveBattleCapturedSkill(legacy, [])).toBe(legacy)
  expect(resolveBattleCapturedSkill(legacy, [], 'strike')).toBeNull()
  expect(resolveBattleCapturedSkill(legacy, [{ ...captures[0]!, actionId: 'other' }])).toBe(legacy)
})

it('retains the selected behavior in area, directional and initial forecasts', () => {
  for (const shape of [
    { kind: 'line', length: 4 },
    { kind: 'circle', radius: 2 },
    { kind: 'all' },
  ] as const) {
    const skill = resolveBattleCapturedSkill(legacy, [
      { ...captures[0]!, target: { ...target, shape, maximumSelections: 1 } },
    ])!
    expect(selectInitialBattleSkillPreviewIntent(skill, selection)?.behaviorId).toBe('strike')
    expect(
      selectDirectionalBattleSkillPreviewIntent(skill, selection, { x: 1, y: 0 })?.behaviorId,
    ).toBe('strike')
    expect(selectBattleSkillPreviewIntent(skill, selection)?.behaviorId).toBe('strike')
  }
})
