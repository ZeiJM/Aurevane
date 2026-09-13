import { expect, it } from 'vitest'
import {
  isCurrentBattlePreview,
  battleIntentTileKey,
  selectBattleSkillPreviewIntent,
} from './battle-preview-selection'

const barrier = {
  id: 'lifebinder.barrier',
  targetKind: 'unit' as const,
  targetTeamPolicy: 'ally' as const,
  minimumRange: 1,
  maximumRange: 3,
}
const combatants = [
  { combatantId: 'actor', teamIndex: 0, hp: 100, position: { x: 0, y: 0 } },
  { combatantId: 'ally', teamIndex: 0, hp: 100, position: { x: 0, y: 2 } },
  { combatantId: 'enemy', teamIndex: 1, hp: 100, position: { x: 1, y: 0 } },
  { combatantId: 'far', teamIndex: 0, hp: 100, position: { x: 0, y: 4 } },
  { combatantId: 'defeated', teamIndex: 0, hp: 0, position: { x: 1, y: 1 } },
]
const selection = {
  actorId: 'actor',
  selectedCombatantId: null,
  selectedTile: null,
  combatants,
}

it('previews a Discipline skill for the explicitly selected in-range ally', () => {
  expect(
    selectBattleSkillPreviewIntent(barrier, { ...selection, selectedCombatantId: 'ally' }),
  ).toEqual({
    kind: 'action',
    actionId: 'lifebinder.barrier',
    target: { kind: 'unit', combatantId: 'ally' },
  })
})

it('does not replace an absent, hostile, defeated or out-of-range ally selection with a guessed target', () => {
  for (const selectedCombatantId of [null, 'actor', 'enemy', 'far', 'defeated']) {
    expect(
      selectBattleSkillPreviewIntent(barrier, { ...selection, selectedCombatantId }),
    ).toBeNull()
  }
})

it('automatically previews self Skills and Essences without changing unit-target contracts', () => {
  expect(
    selectBattleSkillPreviewIntent(
      {
        ...barrier,
        id: 'essence.last-bastion',
        targetKind: 'self',
        targetTeamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
      },
      selection,
    ),
  ).toEqual({
    kind: 'action',
    actionId: 'essence.last-bastion',
    target: { kind: 'self' },
  })
  expect(selectBattleSkillPreviewIntent({ ...barrier, minimumRange: 0 }, selection)).toEqual({
    kind: 'action',
    actionId: 'lifebinder.barrier',
    target: { kind: 'unit', combatantId: 'actor' },
  })
  expect(selectBattleSkillPreviewIntent(barrier, selection)).toBeNull()
})

it('requires an explicit enemy selection and keeps ground intent as a tile', () => {
  const attack = { ...barrier, id: 'arcanist.aether-cut', targetTeamPolicy: 'enemy' as const }
  expect(selectBattleSkillPreviewIntent(attack, selection)).toBeNull()
  expect(
    selectBattleSkillPreviewIntent(attack, { ...selection, selectedCombatantId: 'enemy' }),
  ).toEqual({
    kind: 'action',
    actionId: 'arcanist.aether-cut',
    target: { kind: 'unit', combatantId: 'enemy' },
  })
  const ground = { ...attack, targetKind: 'ground-tile' as const }
  expect(selectBattleSkillPreviewIntent(ground, selection)).toBeNull()
  expect(
    selectBattleSkillPreviewIntent(ground, { ...selection, selectedTile: { x: 2, y: 1 } }),
  ).toEqual({
    kind: 'action',
    actionId: 'arcanist.aether-cut',
    target: { kind: 'tile', position: { x: 2, y: 1 } },
  })
  expect(
    selectBattleSkillPreviewIntent(ground, { ...selection, selectedTile: { x: 4, y: 1 } }),
  ).toBeNull()
})

it('does not offer an occupied tile to Skills that explicitly require empty ground', () => {
  const blink = { ...barrier, id: 'example.blink', targetKind: 'empty-tile' as const }
  expect(
    selectBattleSkillPreviewIntent(blink, { ...selection, selectedTile: { x: 1, y: 0 } }),
  ).toBeNull()
  expect(
    selectBattleSkillPreviewIntent(blink, { ...selection, selectedTile: { x: 1, y: 2 } }),
  ).toEqual({
    kind: 'action',
    actionId: 'example.blink',
    target: { kind: 'tile', position: { x: 1, y: 2 } },
  })
})

it('only commits the exact accepted intent, version and newest preview sequence', () => {
  const intent = {
    kind: 'action' as const,
    actionId: 'frostweaver.chilling-mist',
    target: { kind: 'tile' as const, position: { x: 1, y: 2 } },
  }
  const ready = { intent, version: 4, sequence: 8 }
  expect(isCurrentBattlePreview(ready, intent, 4, 8)).toBe(true)
  expect(isCurrentBattlePreview(null, intent, 4, 8)).toBe(false)
  expect(
    isCurrentBattlePreview(
      ready,
      { ...intent, target: { kind: 'tile', position: { x: 2, y: 2 } } },
      4,
      8,
    ),
  ).toBe(false)
  expect(isCurrentBattlePreview(ready, intent, 5, 8)).toBe(false)
  expect(isCurrentBattlePreview(ready, intent, 4, 9)).toBe(false)
})

it('ties quick confirmation to the actual tile across move, unit, self and ground selections', () => {
  const placements = [
    { combatantId: 'actor', position: { x: 0, y: 0 } },
    { combatantId: 'enemy', position: { x: 1, y: 0 } },
  ]
  expect(
    battleIntentTileKey(
      { kind: 'action', actionId: 'mist', target: { kind: 'tile', position: { x: 2, y: 0 } } },
      placements,
      'actor',
    ),
  ).toBe('2:0')
  expect(
    battleIntentTileKey(
      { kind: 'action', actionId: 'guard', target: { kind: 'self' } },
      placements,
      'actor',
    ),
  ).toBe('0:0')
  expect(
    battleIntentTileKey(
      { kind: 'action', actionId: 'attack', target: { kind: 'unit', combatantId: 'enemy' } },
      placements,
      'actor',
    ),
  ).toBe('1:0')
  expect(
    battleIntentTileKey(
      {
        kind: 'move',
        path: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ],
      },
      placements,
      'actor',
    ),
  ).toBe('0:1')
  expect(battleIntentTileKey(null, placements, 'actor')).toBeUndefined()
})
