import { expect, it } from 'vitest'
import { PHASE4_STATUSES } from './status-content'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { createCombatGroundArea, validateCombatGroundAreas } from './combat-ground-areas'
import {
  isGroundVisualPresetId,
  projectPublicCombatGroundAreas,
  type GroundVisualPresetId,
} from './combat-ground-visuals'
import { resolveMatureSkillVersion } from './mature-skills'
import { validateSummonProfileDefinition } from './summon-content'

const presets = [
  'embers',
  'frost',
  'arcane-pulse',
  'water',
  'ripples',
  'lightning',
  'poison',
  'healing',
  'sand',
  'wind',
  'vines',
  'shadow',
  'lava',
  'rain',
  'snow',
  'holy-light',
  'void',
  'runes',
  'crystals',
  'spores',
]

it.each(presets)('captures, reloads and publicly projects authored Ground preset %s', (id) => {
  expect(isGroundVisualPresetId(id)).toBe(true)
  const visualPresetId = id as GroundVisualPresetId
  const base = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!
  const action = {
    id: 'test.ground-preset',
    version: 1,
    sourceType: 'test' as const,
    tags: [],
    requirements: [],
    cost: { spendsAction: false, mp: 0 },
    target: { ...base.target, kind: 'ground-tile' as const },
    effects: [{ type: 'damage' as const, recipient: 'affected-units' as const, amount: 5 }],
    groundArea: { visualPresetId, durationRounds: 3, entryEffectOrdinals: [0] },
  }
  const state = createCombatGroundArea(
    { ...percentageDotEncounter(), groundEffectPolicyVersion: 1, groundContactPolicyVersion: 1 },
    'actor',
    action,
    [{ x: 1, y: 0 }],
    { statuses: PHASE4_STATUSES },
  )
  const restored = JSON.parse(JSON.stringify(state))
  expect(validateCombatGroundAreas(restored)).toEqual([])
  expect(restored.groundAreas[0].visualPresetId).toBe(id)
  expect(projectPublicCombatGroundAreas(restored.groundAreas, 1, 'active')[0]).toMatchObject({
    visualPresetId: id,
    effectVisualIds: ['damage'],
  })
  const profile = base.summonProfile!
  expect(
    validateSummonProfileDefinition({
      ...profile,
      abilities: [
        {
          ...profile.abilities[0]!,
          target: action.target,
          effects: action.effects,
          groundArea: action.groundArea,
        },
      ],
    }),
  ).toEqual([])
})

it('rejects executable or unknown Ground preset IDs', () => {
  for (const value of ['unknown', 'url(javascript:alert(1))', {}, null])
    expect(isGroundVisualPresetId(value)).toBe(false)
})
