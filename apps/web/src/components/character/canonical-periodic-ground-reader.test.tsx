import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { skillEffectDescription } from './skill-detail-presentation'
import {
  type AbilityDefinition,
  parseAbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { AbilityDefinitionParameters } from '@/components/character/ability-definition-parameters'
const rows: readonly { id: string; after: { ability: AbilityDefinition } }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
// Fails if the actual shared reader leaves these secondary rules only in prose.
// Exact secondary facts must survive before repeated numeric prose can be removed.
it.each(['burn', 'poison', 'create-terrain'])(
  'keeps every actual %s secondary rule structured in the public reader',
  (type) => {
    let count = 0
    for (const row of rows) {
      const definition = parseAbilityDefinition(row.after.ability)
      const before = JSON.stringify(definition)
      for (const group of definition.behaviors) {
        const report = abilityBehaviorInformation(group)
        for (const [index, effect] of group.effects.entries()) {
          if (effect.payload.type !== type) continue
          count++
          const facts =
            type === 'burn'
              ? [
                  { label: 'Backlash', value: '10% own hostile HP damage' },
                  { label: 'Backlash allowance', value: 'Once per turn' },
                ]
              : type === 'poison'
                ? [
                    { label: 'Refresh', value: 'Every 5 traversed tiles' },
                    { label: 'Refresh duration', value: 'Captured full duration' },
                    { label: 'Extra damage on refresh', value: 'None' },
                  ]
                : [
                    { label: 'Movement surcharge', value: '+10 AP per entered tile' },
                    { label: 'Affected units', value: 'Caster’s enemies' },
                  ]
          expect(report.effects[index]!.parts.details).toEqual(expect.arrayContaining(facts))
          if (type === 'create-terrain')
            expect(report.effects[index]!.parts.duration).toBe('2 global round boundaries')
          const html = renderToStaticMarkup(
            <AbilityDefinitionParameters
              definition={projectPublicCombat({ schemaVersion: 1, behaviors: [group] })}
            />,
          )
          for (const { label, value } of facts) expect(html).toContain(`[${label}: ${value}]`)
        }
      }
      expect(JSON.stringify(definition)).toBe(before)
    }
    expect(count).toBe({ burn: 7, poison: 2, 'create-terrain': 1 }[type])
  },
)

function actualEffect(
  type: 'burn' | 'poison' | 'create-terrain',
  patch: Record<string, unknown> = {},
) {
  const row = rows.find((r) =>
    r.after.ability.behaviors.some((g) => g.effects.some((e) => e.payload.type === type)),
  )!
  const definition = parseAbilityDefinition({
    ...row.after.ability,
    behaviors: row.after.ability.behaviors.map((g) => ({
      ...g,
      effects: g.effects.map((e) =>
        e.payload.type === type ? { ...e, payload: { ...e.payload, ...patch } } : e,
      ),
    })),
  })
  const group = definition.behaviors.find((g) => g.effects.some((e) => e.payload.type === type))!
  const index = group.effects.findIndex((e) => e.payload.type === type)
  return { definition, group, index }
}
it('keeps captured Burn backlash separate from the tick percentages', () => {
  const { definition, group, index } = actualEffect('burn', { backlashBasisPoints: 1875 })
  const before = JSON.stringify(definition)
  const report = abilityBehaviorInformation(group)
  expect(report.effects[index]!.parts).toMatchObject({
    magnitude: '20% → 15% → 10%',
    details: expect.arrayContaining([
      { label: 'Backlash', value: '18.75% own hostile HP damage' },
      { label: 'Backlash allowance', value: 'Once per turn' },
    ]),
  })
  expect(report.effectDescriptions[index]).not.toMatch(/\d/)
  expect(report.effectDescriptions[index]).toContain('Multi-hit')
  expect(report.effectDescriptions[index]).toContain('misses and friendly damage do not trigger')
  expect(report.effectDescriptions[index]).toContain('Copy does not renew')
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters definition={projectPublicCombat(definition)} />,
  )
  expect(html).toContain('[Backlash: 18.75% own hostile HP damage]')
  expect(JSON.stringify(definition)).toBe(before)
})
it.each([
  ['burn', { legacyTriggers: true }],
  ['poison', { legacyTriggers: true, legacyPoisonMovement: true }],
  ['poison', { legacyTriggers: true, legacyPoisonMovement: false }],
  ['poison', { legacyTriggers: false, legacyPoisonMovement: true }],
] as const)('preserves the complete captured old %s trigger explanation (%j)', (type, options) => {
  const { definition, group, index } = actualEffect(type)
  const before = JSON.stringify(definition)
  const native = nativeCombatTagPayload(group.effects[index]!.payload)
  const report = abilityBehaviorInformation(group, { effectContext: options })
  const raw = skillEffectDescription(native, options)
  expect(report.effectDescriptions[index]).toContain(raw)
  if (type === 'burn') expect(raw).toContain('2 HP backlash once after each damaging command')
  else if (options.legacyTriggers) expect(raw).toContain('Every five traversed tiles')
  else expect(raw).toContain('at most once per turn')
  expect(JSON.stringify(definition)).toBe(before)
})
it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
] as const)(
  'retains captured Ground teams/Steam lifetime (oldGround=%s,oldElemental=%s)',
  (legacyFrozenGround, legacyElemental) => {
    const { definition, group, index } = actualEffect('create-terrain')
    const before = JSON.stringify(definition)
    const report = abilityBehaviorInformation(group, {
      effectContext: { legacyFrozenGround, legacyElemental },
    })
    expect(report.effects[index]!.parts).toMatchObject({
      duration: '2 global round boundaries',
      details: expect.arrayContaining([
        { label: 'Movement surcharge', value: '+10 AP per entered tile' },
        { label: 'Affected units', value: legacyFrozenGround ? 'Both teams' : 'Caster’s enemies' },
        expect.objectContaining({
          label: 'Steam lifetime',
          value: legacyElemental ? '2 global round boundaries' : 'Remaining Ground lifetime',
        }),
      ]),
    })
    expect(report.effectDescriptions[index]).not.toMatch(/\d/)
    expect(report.effectDescriptions[index]).toContain('Airborne ignores')
    expect(report.effectDescriptions[index]).toContain('blocks line of sight for both teams')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
