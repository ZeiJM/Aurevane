import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { validateAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import {
  activeAbilityForAuthoring,
  activeCombatContentForAuthoring,
  hasInactiveCombatSettings,
} from './combat-ability-authoring-compatibility'

const attack = () =>
  structuredClone(defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability)
function moving() {
  const value = attack()
  return {
    ...value,
    behaviors: value.behaviors.map((group) => ({
      ...group,
      accuracy: { kind: 'fixed' as const, chanceBasisPoints: 7777 },
      effects: [
        {
          id: 'step',
          payload: { type: 'move' as const, recipient: 'actor' as const, maximumTiles: 15 },
        },
      ],
    })),
  }
}
it('projects a pure Move active definition without changing the recoverable enemy-template draft', () => {
  const draft = moving(),
    before = JSON.stringify(draft)
  const active = activeAbilityForAuthoring(draft)
  expect(active.behaviors[0]!.targeting).toMatchObject({
    kind: 'self',
    categories: ['self'],
    minimumRange: 0,
    maximumRange: 0,
    shape: { kind: 'single' },
    requiresLineOfSight: false,
  })
  expect(active.behaviors[0]).not.toHaveProperty('accuracy')
  expect(validateAbilityDefinition(active)).toEqual([])
  expect(JSON.stringify(draft)).toBe(before)
  expect(draft.behaviors[0]!.accuracy?.kind).toBe('fixed')
  expect(draft.behaviors[0]!.targeting!.kind).toBe('unit')
  expect(active.behaviors[0]!.effects).toEqual(draft.behaviors[0]!.effects)
})
it('restores raw aim and accuracy when adding a follow-up after save/reload of the editor draft', () => {
  const draft = JSON.parse(JSON.stringify(moving())) as ReturnType<typeof moving>
  const hit = attack().behaviors[0]!.effects[0]!
  const mixed = {
    ...draft,
    behaviors: draft.behaviors.map((group) => ({ ...group, effects: [...group.effects, hit] })),
  }
  const active = activeAbilityForAuthoring(mixed)
  expect(active.behaviors[0]!.targeting).toEqual(draft.behaviors[0]!.targeting)
  expect(active.behaviors[0]!.accuracy).toEqual(draft.behaviors[0]!.accuracy)
  expect(validateAbilityDefinition(active)).toEqual([])
})
it('preserves selected-target Requirements and their reach even when Move is the only packet', () => {
  const draft = moving()
  const value = {
    ...draft,
    behaviors: draft.behaviors.map((group) => ({
      ...group,
      requirements: {
        kind: 'status-presence' as const,
        subject: 'selected' as const,
        statusId: 'guarded',
        present: true,
      },
    })),
  }
  const active = activeAbilityForAuthoring(value)
  expect(active.behaviors[0]!.targeting).toEqual(value.behaviors[0]!.targeting)
  expect(active.behaviors[0]!.requirements).toEqual(value.behaviors[0]!.requirements)
  expect(active.behaviors[0]).not.toHaveProperty('accuracy')
})
it.each(['skill', 'essence', 'resonance'] as const)(
  'uses the same active %s projection and keeps raw draft recovery separate',
  (kind) => {
    const body = { id: 'test', ability: moving() }
    const draft = kind === 'essence' ? { essenceId: 'test', skill: body } : body
    const before = JSON.stringify(draft)
    expect(hasInactiveCombatSettings(kind, draft)).toBe(true)
    const active = activeCombatContentForAuthoring(kind, draft)
    const owner = 'skill' in active ? active.skill : active
    expect(owner.ability.behaviors[0]).not.toHaveProperty('accuracy')
    expect(JSON.stringify(draft)).toBe(before)
    expect(hasInactiveCombatSettings(kind, active)).toBe(false)
  },
)

import {
  authoringEffectOrderIssue,
  reorderedAuthoringEffects,
  insertAuthoringEffect,
} from './combat-ability-authoring-compatibility'
it('derives Move ordering rejection from the engine and inserts new effects without reordering existing packets', () => {
  const group = attack().behaviors[0]!,
    move = moving().behaviors[0]!.effects[0]!
  const combined = { ...group, effects: [move, ...group.effects] }
  expect(
    authoringEffectOrderIssue(combined, reorderedAuthoringEffects(combined.effects, 0, 1)),
  ).toContain('Move must occur once, first')
  expect(
    authoringEffectOrderIssue(
      combined,
      insertAuthoringEffect(combined.effects, { ...move, id: 'duplicate' }),
    ),
  ).toContain('Move must occur once, first')
  expect(insertAuthoringEffect(group.effects, move)).toEqual([move, ...group.effects])
})

it('keeps Move plus actor-only recovery aimless without deleting either packet', () => {
  const draft = moving()
  const value = {
    ...draft,
    behaviors: draft.behaviors.map((group) => ({
      ...group,
      effects: [
        ...group.effects,
        {
          id: 'heal',
          payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 5 },
        },
      ],
    })),
  }
  const active = activeAbilityForAuthoring(value)
  expect(active.behaviors[0]!.targeting!.kind).toBe('self')
  expect(active.behaviors[0]!.effects).toEqual(value.behaviors[0]!.effects)
})
