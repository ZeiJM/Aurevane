import { expect, it } from 'vitest'
import {
  isCurrentBattlePreview,
  battleIntentTileKey,
  selectBattleSkillPreviewIntent,
  selectInitialBattleSkillPreviewIntent,
  selectDirectionalBattleSkillPreviewIntent,
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

it('automatically chooses the nearest eligible living target while preserving a legal chosen target', () => {
  expect(selectInitialBattleSkillPreviewIntent(barrier, selection)?.target).toEqual({
    kind: 'unit',
    combatantId: 'ally',
  })
  const enemySkill = { ...barrier, targetTeamPolicy: 'enemy' as const }
  expect(selectInitialBattleSkillPreviewIntent(enemySkill, selection)?.target).toEqual({
    kind: 'unit',
    combatantId: 'enemy',
  })
  expect(
    selectInitialBattleSkillPreviewIntent(enemySkill, {
      ...selection,
      combatants: combatants.filter((row) => row.combatantId !== 'enemy'),
    }),
  ).toBeNull()
})

it('automatically selects bounded ground and vacant summon tiles without changing explicit-target validation', () => {
  const tiles = Array.from({ length: 9 }, (_, index) => ({
    x: index % 3,
    y: Math.floor(index / 3),
  }))
  const ground = {
    ...barrier,
    targetKind: 'ground-tile' as const,
    targetTeamPolicy: 'enemy' as const,
  }
  expect(selectInitialBattleSkillPreviewIntent(ground, { ...selection, tiles })?.target).toEqual({
    kind: 'tile',
    position: { x: 1, y: 0 },
  })
  const summon = { ...ground, targetKind: 'empty-tile' as const }
  const intent = selectInitialBattleSkillPreviewIntent(summon, { ...selection, tiles })
  expect(intent?.target).toEqual({ kind: 'tile', position: { x: 0, y: 1 } })
  expect(selectInitialBattleSkillPreviewIntent(summon, { ...selection, tiles: [] })).toBeNull()
  expect(selectBattleSkillPreviewIntent(ground, selection)).toBeNull()
})

it('directional targeting selects only an eligible target in that direction and keeps self casts self', () => {
  const skill = { ...barrier, targetTeamPolicy: 'enemy' as const }
  expect(
    selectDirectionalBattleSkillPreviewIntent(skill, selection, { x: 1, y: 0 })?.target,
  ).toEqual({
    kind: 'unit',
    combatantId: 'enemy',
  })
  expect(selectDirectionalBattleSkillPreviewIntent(skill, selection, { x: -1, y: 0 })).toBeNull()
  expect(
    selectDirectionalBattleSkillPreviewIntent({ ...barrier, targetKind: 'self' }, selection, {
      x: -1,
      y: 0,
    })?.target,
  ).toEqual({ kind: 'self' })
})

it.each(['ally', 'any'] as const)(
  'aims zero-minimum-range %s unit Skills at a living target in the requested direction',
  (targetTeamPolicy) => {
    const skill = { ...barrier, targetTeamPolicy, minimumRange: 0 }
    expect(
      selectDirectionalBattleSkillPreviewIntent(
        skill,
        {
          ...selection,
          selectedCombatantId: 'actor',
        },
        { x: 0, y: 1 },
      )?.target,
    ).toEqual({ kind: 'unit', combatantId: 'ally' })
    expect(selectDirectionalBattleSkillPreviewIntent(skill, selection, { x: 0, y: -1 })).toBeNull()
    expect(
      selectDirectionalBattleSkillPreviewIntent(
        skill,
        {
          ...selection,
          combatants: combatants.filter((row) => row.combatantId !== 'ally'),
        },
        { x: 0, y: 1 },
      ),
    ).toBeNull()
  },
)

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

it('executes the identified unit in the aimed direction before considering a nearer unit', () => {
  const skill = { ...barrier, targetTeamPolicy: 'enemy' as const }
  const current = {
    ...selection,
    selectedCombatantId: 'chosen',
    combatants: [
      ...combatants,
      { combatantId: 'chosen', teamIndex: 1, hp: 100, position: { x: 2, y: 0 } },
    ],
  }
  expect(selectDirectionalBattleSkillPreviewIntent(skill, current, { x: 1, y: 0 })?.target).toEqual(
    { kind: 'unit', combatantId: 'chosen' },
  )
  expect(selectDirectionalBattleSkillPreviewIntent(skill, current, { x: -1, y: 0 })).toBeNull()
})

it('keeps the identified ground tile in the aimed direction instead of retargeting an enemy', () => {
  const skill = {
    ...barrier,
    targetKind: 'ground-tile' as const,
    targetTeamPolicy: 'enemy' as const,
  }
  const current = {
    ...selection,
    selectedTile: { x: 2, y: 1 },
    tiles: [
      { x: 1, y: 0 },
      { x: 2, y: 1 },
    ],
  }
  expect(selectDirectionalBattleSkillPreviewIntent(skill, current, { x: 1, y: 0 })?.target).toEqual(
    { kind: 'tile', position: { x: 2, y: 1 } },
  )
  expect(selectDirectionalBattleSkillPreviewIntent(skill, current, { x: -1, y: 0 })).toBeNull()
})
