import { describe, expect, it } from 'vitest'

import {
  P2_3_GUARD_ACTION,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatTargetSpec,
} from './actions'
import { combatActionPresentationTags, combatStatusPresentationTag } from './gameplay-tags'

function tags(
  target: Partial<CombatTargetSpec>,
  effects: readonly (CombatEffectDefinition | Record<string, unknown>)[],
): readonly string[] {
  return combatActionPresentationTags({
    ...P2_3_GUARD_ACTION,
    target: { ...P2_3_GUARD_ACTION.target, ...target },
    effects,
  } as unknown as CombatActionDefinition)
}

// prettier-ignore
describe('compact combat presentation tags', () => {
  it('derives canonical target, shape, recovery, elemental, terrain and copy labels', () => {
    expect(
      tags(
        {
          kind: 'unit',
          teamPolicy: 'ally',
          minimumRange: 0,
          maximumRange: 3,
          shape: { kind: 'single' },
        },
        [{ type: 'healing', recipient: 'primary-unit', amount: 3, ticks: 3 }],
      ),
    ).toEqual(['Self/Ally', 'Single', 'Heal 3'])

    expect(
      tags(
        {
          kind: 'unit',
          teamPolicy: 'any',
          shape: { kind: 'circle', radius: 2 },
        },
        [
          { type: 'damage', recipient: 'affected-units', amount: 5, element: 'fire' },
          { type: 'copy', recipient: 'primary-unit' },
        ],
      ),
    ).toEqual(['Anyone', 'Circle 2', 'Fire Dmg', 'Copy'])

    expect(
      tags(
        {
          kind: 'ground-tile',
          teamPolicy: 'any',
          shape: { kind: 'line', length: 3 },
        },
        [{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }],
      ),
    ).toEqual(['Ground', 'Line 3', 'Freeze Ground'])
  })

  it('derives canonical damage, resource, cleanse, displacement and reaction labels', () => {
    expect(
      tags(
        { kind: 'unit', teamPolicy: 'enemy' },
        [
          { type: 'damage', recipient: 'primary-unit', amount: 4, piercing: true },
          { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 2, ticks: 2 },
          { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: -2 },
          { type: 'remove-status', recipient: 'primary-unit', statusIds: ['poison'] },
          { type: 'displace', recipient: 'primary-unit', direction: 'pull', distance: 2 },
          { type: 'absorb-hp', recipient: 'actor' },
          { type: 'absorb-mp', recipient: 'actor' },
          { type: 'reflect', recipient: 'actor' },
          { type: 'vengeance', recipient: 'primary-unit' },
          { type: 'amplify', recipient: 'actor' },
          { type: 'curse', recipient: 'primary-unit' },
        ],
      ),
    ).toEqual([
      'Enemy',
      'Single',
      'Dmg',
      'Pierce',
      'MP Rec 2 · Self',
      'MP Drain',
      'Cleanse',
      'Pull 2',
      'Absorb HP · Self',
      'Absorb MP · Self',
      'Reflect · Self',
      'Vengeance',
      'Amplify · Self',
      'Curse',
    ])
  })

  it.each([
    ['guarded', 'Guard'],
    ['exposed', 'Expose'],
    ['inspired', 'Inspire'],
    ['hexed', 'Hex'],
    ['invisible', 'Ghost'],
    ['summoned', 'Summon'],
    ['haste', 'Haste'],
    ['slow', 'Slow'],
    ['lowered-guard', 'Off-guard'],
    ['burn', 'Burn (Scorched)'],
    ['bleed', 'Bleed (Bleeding)'],
    ['poison', 'Poison (Poisoned)'],
    ['displaced', 'Displaced'],
    ['root', 'Root'],
    ['blind', 'Blind'],
  ])('maps %s to %s', (statusId, label) => {
    expect(combatStatusPresentationTag(statusId)).toBe(label)
  })
})
