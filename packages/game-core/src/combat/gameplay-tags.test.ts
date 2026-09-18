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
    ['amplify', 'Amplify'],
    ['curse', 'Curse'],
  ] as const)('derives the real %s clone block label', (mode, label) => {
    expect(
      tags({ kind: 'unit', teamPolicy: 'enemy' }, [
        { type: 'copy-statuses', recipient: 'primary-unit', mode },
      ]),
    ).toEqual(['Enemy', 'Single', label])
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
    ['mark', 'Marked'],
    ['marked', 'Marked'],
  ])('maps %s to %s', (statusId, label) => {
    expect(combatStatusPresentationTag(statusId)).toBe(label)
  })
})

it.each(['regeneration', 'hastened', 'borrowed-hour'])(
  'labels removing historical %s as Dispel',
  (id) => {
    expect(
      tags({ kind: 'unit', teamPolicy: 'enemy' }, [
        { type: 'remove-status', recipient: 'primary-unit', statusIds: [id] },
      ]),
    ).toContain('Dispel')
  },
)

describe('current effect-state gameplay tags', () => {
  it('projects current Burn, Bleed and Poison without legacy status rows', () => {
    const tags = combatantGameplayTags(
      {
        statusState: [{ combatantId: 'target', statuses: [] }],
        effectState: {
          ongoingRecovery: [],
          temporarySkills: [],
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

  it('keeps historical marked and current source-scoped mark as separate definitions', () => {
    const historical = PHASE4_STATUSES.find((status) => status.id === 'marked')
    const current = PHASE4_STATUSES.find((status) => status.id === 'mark')

    expect(historical).toEqual(
      expect.objectContaining({
        version: 1,
        damageTakenMultiplierBasisPoints: 10_000,
        damageModifiers: [expect.objectContaining({ multiplierBasisPoints: 12_000 })],
      }),
    )
    expect(current).toEqual(
      expect.objectContaining({
        version: 1,
        damageTakenMultiplierBasisPoints: 10_000,
        markAccuracyBonusBasisPoints: 1_500,
        reactionClass: 'ordinary',
      }),
    )
    expect(current?.damageModifiers ?? []).toEqual([])
  })
})
