import { expect, it } from 'vitest'
import * as selection from './battle-preview-selection'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

type Action = Extract<BattleIntent, { kind: 'action' }>
const choice = (id: string, actionId = 'skill', behaviorId = 'strike'): Action => ({
  kind: 'action',
  actionId,
  behaviorId,
  target: { kind: 'unit', combatantId: id },
})
it('tracks selected unit identities at their current tile while Ground stays at its selected tile', () => {
  const targets = [
    { kind: 'unit' as const, combatantId: 'one' },
    { kind: 'tile' as const, position: { x: 1, y: 2 } },
  ]
  expect(selection.battleTargetDraftIncludesTile(targets, 'actor', 'one', { x: 4, y: 5 })).toBe(
    true,
  )
  expect(selection.battleTargetDraftIncludesTile(targets, 'actor', null, { x: 4, y: 5 })).toBe(
    false,
  )
  expect(selection.battleTargetDraftIncludesTile(targets, 'actor', null, { x: 1, y: 2 })).toBe(true)
  expect(
    selection.battleTargetDraftIncludesTile([{ kind: 'self' }], 'actor', 'actor', { x: 3, y: 3 }),
  ).toBe(true)
  expect(
    selection.battleTargetDraftIncludesTile([{ kind: 'self' }], 'actor', 'ally', { x: 3, y: 3 }),
  ).toBe(false)
})
it('collects up to three deliberate distinct targets, removes a repeated choice and preserves the exact group', () => {
  const one = selection.toggleBattleSkillTargetSelection(null, choice('one'), 3, 'actor')
  const saved = JSON.stringify(one)
  const two = selection.toggleBattleSkillTargetSelection(one, choice('two'), 3, 'actor')
  const three = selection.toggleBattleSkillTargetSelection(two, choice('three'), 3, 'actor')
  expect(three).toEqual({
    kind: 'action',
    actionId: 'skill',
    behaviorId: 'strike',
    target: {
      kind: 'selections',
      selections: [choice('one').target, choice('two').target, choice('three').target],
    },
  })
  expect(selection.toggleBattleSkillTargetSelection(three, choice('four'), 3, 'actor')).toEqual(
    three,
  )
  expect(
    selection.toggleBattleSkillTargetSelection(two, choice('one'), 3, 'actor')?.target,
  ).toEqual({ kind: 'selections', selections: [choice('two').target] })
  expect(selection.toggleBattleSkillTargetSelection(one, choice('one'), 3, 'actor')).toBeNull()
  expect(JSON.stringify(one)).toBe(saved)
})
it('starts a fresh selection when the action or explicit Manual group changes', () => {
  const one = selection.toggleBattleSkillTargetSelection(null, choice('one'), 3, 'actor')
  for (const next of [choice('two', 'different'), choice('two', 'skill', 'other-group')])
    expect(selection.toggleBattleSkillTargetSelection(one, next, 3, 'actor')).toEqual({
      ...next,
      target: { kind: 'selections', selections: [next.target] },
    })
})
it('treats Self and that same unit as one selection while Ground remains an explicit tile', () => {
  const self: Action = { ...choice('actor'), target: { kind: 'self' } }
  const one = selection.toggleBattleSkillTargetSelection(null, self, 3, 'actor')
  expect(selection.toggleBattleSkillTargetSelection(one, choice('actor'), 3, 'actor')).toBeNull()
  const tile: Action = { ...self, target: { kind: 'tile', position: { x: 1, y: 2 } } }
  const mixed = selection.toggleBattleSkillTargetSelection(one, tile, 3, 'actor')
  expect(mixed?.target).toEqual({ kind: 'selections', selections: [self.target, tile.target] })
})
