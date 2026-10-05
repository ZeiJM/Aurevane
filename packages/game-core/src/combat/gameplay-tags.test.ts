import { describe, expect, it } from 'vitest'

import {
  P2_3_GUARD_ACTION,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatTargetSpec,
} from './actions'
import {
  combatActionPresentationTags,
  combatantGameplayTags,
  combatStatusPresentationTag,
} from './gameplay-tags'
import { PHASE4_STATUSES } from './status-content'

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
    ).toEqual(['Self/Ally', 'Single', 'Heal [3]'])

    expect(
      tags(
        {
          kind: 'unit',
          teamPolicy: 'any',
          shape: { kind: 'circle', radius: 2 },
        },
        [{ type: 'damage', recipient: 'affected-units', amount: 5, element: 'fire' }],
      ),
    ).toEqual(['Anyone', 'Circle [2]', 'Fire Dmg [5]'])

    expect(
      tags(
        {
          kind: 'ground-tile',
          teamPolicy: 'any',
          shape: { kind: 'line', length: 3 },
        },
        [{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }],
      ),
    ).toEqual(['Ground', 'Line [3]', 'Freeze Ground'])
  })

  it('derives the mature summon label from an empty-tile summon effect', () => {
    expect(
      combatActionPresentationTags({
        target: {
          kind: 'empty-tile',
          teamPolicy: 'ally',
          shape: { kind: 'single' },
          minimumRange: 1,
          maximumRange: 3,
          requiresLineOfSight: true,
          maximumElevationDifference: 0,
          friendlyFire: 'allies-only',
        },
        effects: [{ type: 'summon', recipient: 'selected-tile' }],
      }),
    ).toEqual(['Empty Tile', 'Single', 'Summon'])
  })

  it('derives canonical damage, resource, cleanse, displacement and reaction labels', () => {
    expect(
      tags({ kind: 'unit', teamPolicy: 'enemy' }, [
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
      ]),
    ).toEqual([
      'Enemy',
      'Single',
      'Dmg [4]',
      'Pierce',
      'MP Restore [2] · Self',
      'MP Drain [2]',
      'Cleanse',
      'Pull [2]',
      'HP Leech · Self',
      'MP Leech · Self',
      'Reflect · Self',
      'Vengeance',
      'Copy Buffs · Self',
      'Copy Debuffs',
    ])
  })

  it.each([
    ['amplify', 'Copy Buffs'],
    ['curse', 'Copy Debuffs'],
  ] as const)('derives the real %s clone block label', (mode, label) => {
    expect(
      tags({ kind: 'unit', teamPolicy: 'enemy' }, [
        { type: 'copy-statuses', recipient: 'primary-unit', mode },
      ]),
    ).toEqual(['Enemy', 'Single', label])
  })

  it.each([
    ['guarded', 'Guard'],
    ['exposed', 'Vulnerable'],
    ['inspired', 'Damage Up'],
    ['hexed', 'Healing Down'],
    ['invisible', 'Invisible'],
    ['haste', 'Haste'],
    ['slow', 'Slow'],
    ['lowered-guard', 'Defenseless'],
    ['burn', 'Burn'],
    ['bleed', 'Bleed'],
    ['poison', 'Poison'],
    ['displaced', 'Displaced'],
    ['root', 'Rooted'],
    ['blind', 'Blind'],
    ['mark', 'Marked'],
  ])('maps %s to %s', (statusId, label) => {
    expect(combatStatusPresentationTag(statusId)).toBe(label)
  })
})

describe('current effect-state gameplay tags', () => {
  it('projects current Burn, Bleed and Poison without legacy status rows', () => {
    const tags = combatantGameplayTags(
      {
        statusState: [{ combatantId: 'target', statuses: [] }],
        effectState: {
          ongoingRecovery: [],
          damageHistory: [],
          burn: [
            {
              targetCombatantId: 'target',
              sourceCombatantId: 'actor',
              sourceActionId: 'test.burn',
              profileVersion: 1,
              stage: 0,
            },
          ],
          bleed: [
            {
              targetCombatantId: 'target',
              sourceCombatantId: 'actor',
              sourceActionId: 'test.bleed',
              damagePerTick: 3,
              remainingTicks: 3,
              applicationOrder: 1,
            },
          ],
          poison: [
            {
              targetCombatantId: 'target',
              sourceCombatantId: 'actor',
              sourceActionId: 'test.poison',
              profileVersion: 1,
              movementRemainder: 0,
            },
          ],
        },
      },
      'target',
      { statuses: PHASE4_STATUSES },
    )

    expect(tags).toEqual(expect.arrayContaining(['Scorched', 'Bleeding', 'Poisoned']))
  })


})
