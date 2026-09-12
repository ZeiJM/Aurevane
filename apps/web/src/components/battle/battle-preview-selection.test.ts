import { expect, it } from 'vitest'
import { isCurrentBattlePreview, battleIntentTileKey } from './battle-preview-selection'

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
