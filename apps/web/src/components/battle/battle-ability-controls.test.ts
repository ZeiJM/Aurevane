import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { battleCapturedSpecialAction, battleSkillCastMode } from './battle-captured-action-cost'
import {
  resolveBattleCapturedSkill,
  battleSkillTargetSpec,
  selectInitialBattleSkillPreviewIntent,
  type BattleCapturedActionTarget,
} from './battle-preview-selection'
import type { BattleRuntime } from './battle-runtime'

const runtime: BattleRuntime = {
  kind: 'pve',
  playerName: 'Wayfarer',
  playerLevel: 1,
  playerPortraitAssetId: 'character.portrait.starter.wayfarer-01',
  playerProfileImageUrl: null,
  resonance: {
    id: 'resonance.wildwarden-edgedancer',
    contentVersion: 7,
    name: 'Pinned Resonance',
    description: '',
  },
}
const group = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
const capture: BattleCapturedActionTarget = {
  ownerCombatantId: 'actor',
  actionId: runtime.resonance!.id,
  behaviorId: 'release',
  classification: 'recovery',
  costs: [
    { resource: 'ap', amount: 11 },
    { resource: 'mp', amount: 2 },
  ],
  cooldown: { key: 'shared-pair', ownerTurns: 3 },
  controlled: { phase: 'primed', canPrime: false, canCancel: true },
  target: {
    ...group.targeting!,
    kind: 'self',
    categories: ['self'],
    teamPolicy: 'self',
    friendlyFire: 'allies-only',
    minimumRange: 0,
    maximumRange: 0,
  },
}
it('uses the owner captured group for special targeting and keeps the selected behavior in the actual intent', () => {
  const special = battleCapturedSpecialAction(runtime, [capture], 'actor')!
  expect(special.kind).toBe('resonance')
  expect(special.category).toBe('heal')
  const descriptor = resolveBattleCapturedSkill(special.skill, [capture])!
  expect(descriptor.costs).toEqual(capture.costs)
  expect(descriptor.controlled).toEqual(capture.controlled)
  expect(
    selectInitialBattleSkillPreviewIntent(descriptor, {
      actorId: 'actor',
      selectedCombatantId: null,
      selectedTile: null,
      combatants: [{ combatantId: 'actor', teamIndex: 0, hp: 50, position: { x: 0, y: 0 } }],
    }),
  ).toEqual({
    kind: 'action',
    actionId: runtime.resonance!.id,
    behaviorId: 'release',
    target: { kind: 'self' },
  })
})
it('does not expose another controlled unit’s special reference or invent passive casts', () => {
  expect(battleCapturedSpecialAction(runtime, [capture], 'other')).toBeUndefined()
  expect(battleCapturedSpecialAction(runtime, [capture], null)).toBeUndefined()
  expect(battleCapturedSpecialAction(runtime, [], 'actor')).toBeUndefined()
})
it('requires explicit choice for multiple special commands and preserves each captured geometry', () => {
  const choices = [capture, { ...capture, behaviorId: 'other', target: group.targeting! }]
  const special = battleCapturedSpecialAction(runtime, choices, 'actor')!
  expect(resolveBattleCapturedSkill(special.skill, choices)).toBeNull()
  expect(resolveBattleCapturedSkill(special.skill, choices, 'other')?.target).toEqual(
    group.targeting,
  )
})
it('preserves each selected Resonance group classification and modifier root facts', () => {
  const choices = [
    capture,
    {
      ...capture,
      behaviorId: 'hit',
      classification: 'attack' as const,
      target: group.targeting!,
      modifierRoot: {
        classification: 'attack' as const,
        targetKind: 'unit' as const,
        persistentGround: false,
        hasPrimaryRecipient: true,
      },
    },
  ]
  const special = battleCapturedSpecialAction(runtime, choices, 'actor')!
  expect(resolveBattleCapturedSkill(special.skill, choices, 'release')?.classification).toBe(
    'recovery',
  )
  expect(resolveBattleCapturedSkill(special.skill, choices, 'hit')?.classification).toBe('attack')
  expect(resolveBattleCapturedSkill(special.skill, choices, 'hit')?.modifierRoot).toEqual({
    classification: 'attack',
    targetKind: 'unit',
    persistentGround: false,
    hasPrimaryRecipient: true,
  })
})

it('uses the explicitly selected special group category and fails closed for a removed choice', () => {
  const choices = [
    capture,
    { ...capture, behaviorId: 'hit', classification: 'attack' as const, target: group.targeting! },
  ]
  expect(battleCapturedSpecialAction(runtime, choices, 'actor', undefined, 'hit')?.category).toBe(
    'attack',
  )
  expect(
    battleCapturedSpecialAction(runtime, choices, 'actor', undefined, 'release')?.category,
  ).toBe('heal')
  expect(
    battleCapturedSpecialAction(runtime, choices, 'actor', undefined, 'removed'),
  ).toBeUndefined()
})

it('applies Airborne elevation only to the selected captured Attack Skill group', () => {
  const skill = {
    id: 'special',
    targetKind: 'unit' as const,
    targetTeamPolicy: 'enemy' as const,
    minimumRange: 1,
    maximumRange: 4,
    target: { ...group.targeting!, maximumElevationDifference: 1 },
  }
  expect(
    battleSkillTargetSpec({ ...skill, classification: 'attack' }, true)?.maximumElevationDifference,
  ).toBe(3)
  expect(
    battleSkillTargetSpec({ ...skill, classification: 'recovery' }, true)
      ?.maximumElevationDifference,
  ).toBe(1)
  expect(
    battleSkillTargetSpec({ ...skill, classification: 'utility' }, true)
      ?.maximumElevationDifference,
  ).toBe(1)
  expect(
    battleSkillTargetSpec({ ...skill, classification: 'attack' }, false)
      ?.maximumElevationDifference,
  ).toBe(1)
  expect(
    battleSkillTargetSpec(
      { ...skill, id: 'basic.attack.unarmed.basic', classification: 'attack' },
      true,
    )?.maximumElevationDifference,
  ).toBe(1)
})
it.each(['automatic', 'ongoing', 'manual'] as const)(
  'treats %s modifier-only definitions as information instead of cast commands',
  (activation) => {
    const skill = {
      definition: {
        ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
        ability: {
          schemaVersion: 1 as const,
          behaviors: [{ ...group, activation, mode: 'modifier' as const, targeting: null }],
        },
      },
    }
    expect(battleSkillCastMode(skill).canCast).toBe(false)
    expect(battleSkillCastMode(skill).label).toBe(
      activation === 'manual' ? 'Modifier' : activation === 'ongoing' ? 'Ongoing' : 'Automatic',
    )
    expect(battleSkillCastMode({}).canCast).toBe(true)
  },
)

it('does not offer a noncast Essence in the active special action selector', () => {
  const definition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    ability: {
      schemaVersion: 1 as const,
      behaviors: [
        { ...group, activation: 'ongoing' as const, mode: 'modifier' as const, targeting: null },
      ],
    },
  }
  const essence = {
    id: definition.id,
    contentVersion: definition.contentVersion,
    name: 'Pinned Essence',
    description: '',
    cooldownOwnerTurns: null,
    apCost: 15,
    mpCost: 0,
    targetKind: 'unit' as const,
    targetTeamPolicy: 'enemy' as const,
    minimumRange: 1,
    maximumRange: 1,
    tags: [],
    effectDescriptions: [],
    requirementDescriptions: [],
    definition,
  }
  expect(
    battleCapturedSpecialAction({ ...runtime, resonance: null, essence }, [], 'actor'),
  ).toBeUndefined()
})
