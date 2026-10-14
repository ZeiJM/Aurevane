import { expect, it } from 'vitest'
import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  resolveBattleCapturedSkill,
  selectBattleSkillPreviewIntent,
  selectDirectionalBattleSkillPreviewIntent,
  selectInitialBattleSkillPreviewIntent,
  selectBattleSkillMovementCommitIntent,
  bindBattleSkillMovement,
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

it('retains saved Move routing and overall costs without inventing movement on historical actions', () => {
  const move = { maximumTiles: 2, conditional: true }
  const costs = [
    { resource: 'ap' as const, amount: 100 },
    { resource: 'mp' as const, amount: 2 },
  ]
  const captured = resolveBattleCapturedSkill(legacy, [{ ...captures[0]!, move, costs }])
  expect(captured).toMatchObject({ move, costs })
  expect(resolveBattleCapturedSkill(legacy, [])).not.toHaveProperty('move')
})

it('selects the follow-up from the planned origin and retains its original target and reference-only path', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]
  const captured = resolveBattleCapturedSkill(legacy, [
    {
      ...captures[0]!,
      target: { ...target, maximumRange: 1, maximumSelections: 1 },
      move: { maximumTiles: 2, conditional: false },
      costs: [{ resource: 'ap', amount: 100 }],
    },
  ])!
  const planned = { ...captured, movementPath: path }
  const context = {
    ...selection,
    combatants: [
      selection.combatants[0]!,
      { ...selection.combatants[1]!, position: { x: 3, y: 0 } },
    ],
  }
  expect(selectBattleSkillPreviewIntent(captured, context)).toBeNull()
  const intent = selectBattleSkillPreviewIntent(planned, context)
  expect(intent).toMatchObject({
    actionId: 'ability',
    behaviorId: 'strike',
    movementPath: path,
    target: { kind: 'unit', combatantId: 'enemy' },
  })
  expect(
    selectBattleSkillPreviewIntent(planned, {
      ...context,
      selectedCombatantId: null,
      selectedTile: { x: 2, y: 1 },
    }),
  ).toMatchObject({ movementPath: path, target: { kind: 'tile', position: { x: 2, y: 1 } } })
  expect(context.combatants[0]!.position).toEqual({ x: 0, y: 0 })
  path[1]!.y = 1
  expect(intent!.movementPath![1]).toEqual({ x: 1, y: 0 })
})

it('preserves movement in Self/area/directional previews and permits only conditional stationary selection', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]
  const self = { ...legacy, move: { maximumTiles: 2, conditional: false }, movementPath: path }
  expect(selectInitialBattleSkillPreviewIntent(self, selection)).toMatchObject({
    movementPath: path,
    target: { kind: 'self' },
  })
  expect(selectInitialBattleSkillPreviewIntent({ ...self, movementPath: [] }, selection)).toBeNull()
  expect(
    selectInitialBattleSkillPreviewIntent(
      { ...self, move: { maximumTiles: 2, conditional: true }, movementPath: [] },
      selection,
    ),
  ).toMatchObject({ target: { kind: 'self' } })
  const area = {
    ...self,
    target: { ...target, shape: { kind: 'line' as const, length: 2 }, maximumSelections: 1 },
  }
  expect(selectDirectionalBattleSkillPreviewIntent(area, selection, { x: 1, y: 0 })).toMatchObject({
    movementPath: path,
    target: { kind: 'direction', direction: 'east' },
  })
})

it('does not reuse a selected route after a remote version, action, group or owner change', () => {
  const skill = { ...legacy, behaviorId: 'strike', move: { maximumTiles: 2, conditional: false } }
  const draft = {
    battleVersion: 4,
    actorId: 'actor',
    actionId: 'ability',
    behaviorId: 'strike',
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  }
  expect(
    selectInitialBattleSkillPreviewIntent(
      bindBattleSkillMovement(skill, draft, 4, 'actor'),
      selection,
    )?.movementPath,
  ).toEqual(draft.path)
  for (const [changedSkill, version, actorId] of [
    [skill, 5, 'actor'],
    [{ ...skill, id: 'other' }, 4, 'actor'],
    [{ ...skill, behaviorId: 'other' }, 4, 'actor'],
    [skill, 4, 'ally'],
  ] as const) {
    expect(
      selectInitialBattleSkillPreviewIntent(
        bindBattleSkillMovement(changedSkill, draft, version, actorId),
        selection,
      ),
    ).toBeNull()
  }
  expect(
    selectInitialBattleSkillPreviewIntent(
      bindBattleSkillMovement(skill, null, 4, 'actor'),
      selection,
    ),
  ).toBeNull()
})

it('keeps mixed Self/enemy Move targets open even when the initial forecast selects Self', () => {
  const skill = {
    ...legacy,
    move: { maximumTiles: 2, conditional: false },
    movementPath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    target: {
      ...target,
      kind: 'self' as const,
      categories: ['self' as const, 'enemy' as const],
      minimumRange: 0,
      maximumRange: 1,
      maximumSelections: 1,
    },
  }
  const context = {
    ...selection,
    selectedCombatantId: null,
    combatants: [
      selection.combatants[0]!,
      { ...selection.combatants[1]!, position: { x: 2, y: 0 } },
    ],
  }
  expect(selectInitialBattleSkillPreviewIntent(skill, context)?.target).toEqual({ kind: 'self' })
  expect(selectBattleSkillMovementCommitIntent(skill, context)).toBeNull()
  expect(
    selectBattleSkillPreviewIntent(skill, { ...context, selectedCombatantId: 'enemy' }),
  ).toMatchObject({
    target: { kind: 'unit', combatantId: 'enemy' },
    movementPath: skill.movementPath,
  })
  expect(
    selectBattleSkillMovementCommitIntent(
      {
        ...skill,
        target: { ...skill.target, categories: ['self'] },
      },
      context,
    ),
  ).toMatchObject({ target: { kind: 'self' }, movementPath: skill.movementPath })
})
