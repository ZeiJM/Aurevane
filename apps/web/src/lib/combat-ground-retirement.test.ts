import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  validateCombatTagPayload,
  type CombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { reconcileAuthoredEffectDependencies } from './combat-effect-dependencies'
import { withAbilityEffectDependencies } from './combat-ability-effect-dependencies'
import { withRemappedGroundEntries } from './combat-ground-entry-authoring'
import { currentSummonForAuthoring, currentTagForAuthoring } from './combat-current-tag-authoring'
import { correctCombatContentEntries } from './combat-content-corrector'
import { combatContentForAuthoring } from './combat-content-for-authoring'
import { hasSharedGroundAim, retireAuthoredFrozenGround } from './combat-effect-dependencies'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SkillEffectListEditor } from '../components/master/combat-content/skill-effect-list-editor'
import { isMaterializedCombatEffect } from '@aurevane/game-core/combat/summon-content'

const retainedChillingMist = (
  JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    records: { id: string; after: MatureSkillDefinition }[]
  }
).records.find((row) => row.id === 'frostweaver.chilling-mist')!.after

it('converts actual retained Chilling Mist@8 without synthesizing a duplicate inherited Chilled', () => {
  const retained = retainedChillingMist
  expect(retained.contentVersion).toBe(8)
  const before = JSON.stringify(retained)
  expect(retained.effects.map((row) => row.type)).toEqual([
    'create-terrain',
    'apply-status',
    'apply-status',
  ])
  const originalGroup = retained.ability!.behaviors[0]!
  const current = combatContentForAuthoring(
    'skill',
    retained as never,
  ) as unknown as typeof retained
  expect(current.effects).toEqual(retained.effects.slice(1))
  expect(current.groundArea?.entryEffectOrdinals).toEqual([0, 1])
  expect(current.ability!.behaviors[0]!.effects).toEqual(originalGroup.effects.slice(1))
  expect(current.ability!.behaviors[0]!.groundArea?.entryEffectIds).toEqual(['entry-1', 'entry-2'])
  expect(current.ability!.behaviors[0]!.groundArea?.timing).toBe('next-round')
  expect(JSON.stringify(retained)).toBe(before)
})

it('retains actual inherited Chilled wrapper, duration and notes while preserving an explicit Enemy Chilled', () => {
  const retained = retainedChillingMist
  const group = retained.ability!.behaviors[0]!
  const originalChilled = group.effects[2]!
  const chilled = {
    ...originalChilled,
    timing: 'delayed' as const,
    requirements: {
      kind: 'status-presence' as const,
      subject: 'owner' as const,
      statusId: 'inspired',
      present: true,
    },
    payload: { ...originalChilled.payload, durationTurns: 7 },
  }
  const enemy = {
    id: 'independent-enemy',
    payload: {
      type: 'apply-status' as const,
      statusId: 'frozen',
      recipient: 'affected-units' as const,
      target: 'enemy' as const,
      stacks: 1,
      durationTurns: 4,
    },
  }
  const source = {
    ...retained,
    ability: {
      ...retained.ability!,
      behaviors: [{ ...group, effects: [group.effects[0]!, group.effects[1]!, chilled, enemy] }],
    },
    effectDescriptions: ['Terrain note', 'Slow note', 'Inherited note', 'Enemy note'],
  }
  const current = combatContentForAuthoring('skill', source as never) as unknown as typeof source
  expect(current.ability.behaviors[0]!.effects).toEqual([group.effects[1], chilled, enemy])
  expect(current.effectDescriptions).toEqual(['Slow note', 'Inherited note', 'Enemy note'])
  expect(current.ability.behaviors[0]!.groundArea?.entryEffectIds).toEqual(['entry-1', 'entry-2'])
})

it('renders exactly the two retained native Chilling Mist rows in the actual effect editor', () => {
  const html = renderToStaticMarkup(
    createElement(SkillEffectListEditor, {
      value: retainedChillingMist.effects.filter(isMaterializedCombatEffect),
      aim: retainedChillingMist.target,
      onChange: () => {},
    }),
  )
  expect(html).toContain('data-effect-sequence="apply-status|apply-status"')
  expect(html).not.toContain('<strong>Freeze Ground</strong>')
})

it('does not guess an unlinked companion from explicit unit/Ground targets, ambiguous rows or a unit shared aim', () => {
  const terrain = retainedChillingMist.effects[0]!
  const chilled = retainedChillingMist.effects[2]!
  const inheritedGround = hasSharedGroundAim(retainedChillingMist.target)
  for (const target of ['enemy', 'ground'] as const) {
    const independent = { ...chilled, target }
    const result = retireAuthoredFrozenGround([terrain, independent], { inheritedGround })
    expect(result.effects).toHaveLength(2)
    expect(result.effects[1]).toBe(independent)
  }
  const other = { ...chilled, durationTurns: 7 }
  expect(
    retireAuthoredFrozenGround([terrain, chilled, other], { inheritedGround }).effects,
  ).toHaveLength(3)
  expect(
    retireAuthoredFrozenGround([terrain, chilled], {
      inheritedGround: hasSharedGroundAim({ kind: 'unit', categories: ['enemy'] }),
    }).effects,
  ).toHaveLength(2)
})

it.each([{ categories: ['ground', 'enemy'] as const }, { categories: ['enemy'] as const }])(
  'honors authoritative geometry3 categories $categories over a retained ground-tile kind',
  ({ categories }) => {
    const aim = {
      ...retainedChillingMist.target,
      geometryVersion: 3 as const,
      kind: 'ground-tile' as const,
      categories,
    }
    expect(hasSharedGroundAim(aim)).toBe(false)
    const original = {
      ...retainedChillingMist,
      target: aim,
      ability: {
        ...retainedChillingMist.ability!,
        behaviors: retainedChillingMist.ability!.behaviors.map((group) => ({
          ...group,
          targeting: aim,
        })),
      },
    }
    const current = combatContentForAuthoring(
      'skill',
      original as never,
    ) as unknown as typeof original
    expect(
      current.effects.filter((row) => row.type === 'apply-status' && row.statusId === 'frozen'),
    ).toHaveLength(2)
    expect(
      current.ability.behaviors[0]!.effects.filter(
        (row) => row.payload.type === 'apply-status' && row.payload.statusId === 'frozen',
      ),
    ).toHaveLength(2)
    expect(current.effects).toContain(retainedChillingMist.effects[2])
  },
)

const terrain: CombatTagPayload = {
  type: 'create-terrain',
  recipient: 'affected-tiles',
  terrain: 'frozen',
  target: 'ground',
  skillApSurcharge: 17,
  authoringLink: 'frozen-ground.1',
}
const chilled: CombatTagPayload = {
  type: 'apply-status',
  recipient: 'affected-units',
  target: 'enemy',
  statusId: 'frozen',
  stacks: 1,
  durationTurns: 7,
  authoringLink: 'frozen-ground.1',
}
const independent: CombatTagPayload = {
  type: 'apply-status',
  recipient: 'actor',
  target: 'self',
  statusId: 'frozen',
  stacks: 1,
  durationTurns: 4,
}
it('retires only the paired terrain and preserves exact independent Chilled targets and values', () => {
  const original = [terrain, chilled, independent]
  const before = JSON.stringify(original)
  const next = reconcileAuthoredEffectDependencies(original, original)
  expect(next).toEqual([chilled, independent])
  expect(next[0]).toBe(chilled)
  expect(JSON.stringify(original)).toBe(before)
  expect(reconcileAuthoredEffectDependencies(next, next)).toBe(next)
})
it('synthesizes exactly one Ground Chilled packet for standalone retired terrain without extra AP', () => {
  const next = reconcileAuthoredEffectDependencies<CombatTagPayload>([], [terrain, independent])
  expect(next).toEqual([
    {
      type: 'apply-status',
      recipient: 'affected-units',
      target: 'ground',
      statusId: 'frozen',
      stacks: 1,
      durationTurns: 2,
      applicationOrigin: 'frozen-ground',
      authoringLink: 'frozen-ground.1',
    },
    independent,
  ])
  expect(
    currentTagForAuthoring({
      type: 'create-terrain',
      recipient: 'affected-tiles',
      terrain: 'frozen',
    }),
  ).not.toHaveProperty('skillApSurcharge')
})
it('converts old Empty Tile terrain into valid Ground Chilled and gives separate standalone rows stable links', () => {
  const first = {
    type: 'create-terrain' as const,
    recipient: 'affected-tiles' as const,
    terrain: 'frozen' as const,
    target: 'empty-tile' as const,
  }
  const next = reconcileAuthoredEffectDependencies<CombatTagPayload>([], [first, { ...first }])
  expect(next).toHaveLength(2)
  expect(next.map((row) => ('authoringLink' in row ? row.authoringLink : undefined))).toEqual([
    'frozen-ground.1',
    'frozen-ground.2',
  ])
  expect(next.every((row) => validateCombatTagPayload(row).length === 0)).toBe(true)
})
it('maps native terrain and Chilled Ground references to the retained row without duplicates', () => {
  const previous = {
    effects: [terrain, independent, chilled],
    groundArea: {
      durationRounds: 5,
      visualPresetId: 'frost' as const,
      timing: 'delayed' as const,
      entryEffectOrdinals: [0, 2],
    },
  }
  const effects = reconcileAuthoredEffectDependencies(previous.effects, previous.effects)
  const next = withRemappedGroundEntries(previous, { ...previous, effects })
  expect(next.groundArea).toEqual({
    ...previous.groundArea,
    entryEffectOrdinals: [1],
    contactPolicyVersion: 1,
  })
})
it('retains native entry references on independently edited rows while terrain retirement shifts their ordinal', () => {
  const hit = {
    type: 'damage' as const,
    recipient: 'affected-units' as const,
    target: 'ground' as const,
    amount: 9,
  }
  const previous = {
    effects: [terrain, hit, chilled] as readonly CombatTagPayload[],
    groundArea: {
      durationRounds: 5,
      visualPresetId: 'frost' as const,
      entryEffectOrdinals: [0, 1, 2],
    },
  }
  const effects = reconcileAuthoredEffectDependencies<CombatTagPayload>(previous.effects, [
    terrain,
    { ...hit, amount: 10 },
    chilled,
  ])
  const next = withRemappedGroundEntries(previous, { ...previous, effects })
  expect(next.groundArea?.entryEffectOrdinals).toEqual([1, 0])
})
it('preserves canonical retained Chilled ID, requirements, timing and notes while mapping removed terrain', () => {
  const condition = {
    kind: 'status-presence',
    subject: 'owner',
    statusId: 'inspired',
    present: true,
  }
  const group = {
    id: 'main',
    effects: [
      { id: 'terrain', payload: terrain, timing: 'next-round' },
      { id: 'independent', payload: independent },
      {
        id: 'chilled',
        payload: chilled,
        timing: 'delayed',
        requirements: condition,
        note: 'Keep me',
      },
    ],
    groundArea: {
      durationRounds: 5,
      visualPresetId: 'frost',
      entryEffectIds: ['terrain', 'chilled'],
    },
  } as unknown as AbilityBehavior
  const next = withAbilityEffectDependencies(group, group)
  expect(next.effects).toEqual([group.effects[1], group.effects[2]])
  expect(next.effects[1]).toBe(group.effects[2])
  expect(next.groundArea?.entryEffectIds).toEqual(['chilled'])
  expect(next.groundArea).toHaveProperty('contactPolicyVersion', 1)
})
it('preserves independently identified canonical rows even when their payload object is shared', () => {
  const group = {
    id: 'main',
    effects: [
      { id: 'terrain', payload: terrain },
      { id: 'chilled', payload: chilled },
      { id: 'independent-one', payload: independent, timing: 'instant' },
      { id: 'independent-two', payload: independent, timing: 'delayed' },
    ],
  } as unknown as AbilityBehavior
  const next = withAbilityEffectDependencies(group, group)
  expect(next.effects.map((row) => row.id)).toEqual([
    'chilled',
    'independent-one',
    'independent-two',
  ])
  expect(next.effects[1]).toBe(group.effects[2])
  expect(next.effects[2]).toBe(group.effects[3])
})
it('retains the canonical standalone terrain row wrapper on its replacement Chilled', () => {
  const group = {
    id: 'main',
    effects: [{ id: 'terrain', payload: terrain, timing: 'delayed', note: 'Keep' }],
    groundArea: { durationRounds: 5, visualPresetId: 'frost', entryEffectIds: ['terrain'] },
  } as unknown as AbilityBehavior
  const next = withAbilityEffectDependencies(group, group)
  expect(next.effects).toHaveLength(1)
  expect(next.effects[0]).toMatchObject({
    id: 'terrain',
    timing: 'delayed',
    note: 'Keep',
    payload: { type: 'apply-status', statusId: 'frozen' },
  })
  expect(next.groundArea).toEqual({ ...group.groundArea, contactPolicyVersion: 1 })
})
it('commits native retirement with correct entry ordinals and aligned independent notes', () => {
  const original = {
    id: 'custom.ground',
    effects: [terrain, independent, chilled],
    effectDescriptions: ['Old terrain', 'Own note', 'Chilled note'],
    groundArea: { durationRounds: 5, visualPresetId: 'frost', entryEffectOrdinals: [0, 2] },
  }
  const result = correctCombatContentEntries('skill', original).definition
  expect(result.effects).toEqual([independent, chilled])
  expect(result.effectDescriptions).toEqual(['Own note', 'Chilled note'])
  expect(result.groundArea.entryEffectOrdinals).toEqual([1])
  expect(original.effects).toHaveLength(3)
})
it('retains a Summon Ground capture while converting its retired packets and remapping ordinals', () => {
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const original = {
    ...profile,
    abilities: [
      {
        ...profile.abilities[0]!,
        effects: [terrain, independent, chilled],
        groundArea: {
          durationRounds: 5,
          visualPresetId: 'frost' as const,
          entryEffectOrdinals: [0, 2],
        },
      },
    ],
  }
  const result = currentSummonForAuthoring(original)
  expect(result.abilities[0]!.effects).toEqual([independent, chilled])
  expect(result.abilities[0]).toHaveProperty('groundArea.entryEffectOrdinals', [1])
  expect(original.abilities[0]!.effects).toHaveLength(3)
})
it('projects retired packets consistently in the whole current draft without rewriting its saved source', () => {
  const captured = {
    id: 'custom.field',
    effects: [terrain, independent, chilled],
    effectDescriptions: ['Terrain', 'Own', 'Chilled'],
    groundArea: { durationRounds: 4, visualPresetId: 'frost', entryEffectOrdinals: [0, 2] },
  }
  const before = JSON.stringify(captured)
  const current = combatContentForAuthoring('skill', captured as never)
  expect(current).toMatchObject({
    effects: [independent, chilled],
    effectDescriptions: ['Own', 'Chilled'],
    groundArea: { entryEffectOrdinals: [1] },
  })
  expect(JSON.stringify(captured)).toBe(before)
})
it('leaves malformed native Ground references visible for strict validation rather than dropping the field', () => {
  const captured = {
    id: 'custom.invalid',
    effects: [terrain],
    groundArea: { durationRounds: 4, visualPresetId: 'frost', entryEffectOrdinals: [-1] },
  }
  const current = combatContentForAuthoring('skill', captured as never)
  expect(current).toHaveProperty('groundArea', captured.groundArea)
})
it('projects canonical and nested Summon drafts while keeping wrappers, notes and Ground mappings', () => {
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
  const currentProfile = {
    ...profile,
    abilities: [
      {
        ...profile.abilities[0]!,
        effects: [terrain, chilled],
        groundArea: { durationRounds: 4, visualPresetId: 'frost', entryEffectOrdinals: [0, 1] },
      },
    ],
  }
  const wrapper = {
    id: 'chilled',
    payload: chilled,
    timing: 'delayed',
    requirements: { kind: 'always' },
  }
  const captured = {
    ability: {
      schemaVersion: 1,
      behaviors: [
        {
          id: 'main',
          effects: [
            { id: 'terrain', payload: terrain },
            wrapper,
            {
              id: 'summon',
              payload: { type: 'summon', recipient: 'selected-tile', profile: currentProfile },
            },
          ],
          groundArea: {
            durationRounds: 4,
            visualPresetId: 'frost',
            entryEffectIds: ['terrain', 'chilled'],
          },
        },
      ],
    },
    effectDescriptions: ['Terrain', 'Own Chilled', 'Summon'],
  }
  const before = JSON.stringify(captured)
  const projected = combatContentForAuthoring(
    'skill',
    captured as never,
  ) as unknown as typeof captured
  const group = projected.ability.behaviors[0]!
  expect(group.effects).toHaveLength(2)
  expect(group.effects[0]).toEqual(wrapper)
  expect(group.groundArea.entryEffectIds).toEqual(['chilled'])
  expect(projected.effectDescriptions).toEqual(['Own Chilled', 'Summon'])
  const summon = group.effects[1]!.payload as unknown as { profile: typeof currentProfile }
  expect(summon.profile.abilities[0]!.effects).toEqual([chilled])
  expect(summon.profile.abilities[0]!.groundArea.entryEffectOrdinals).toEqual([0])
  expect(JSON.stringify(captured)).toBe(before)
})
