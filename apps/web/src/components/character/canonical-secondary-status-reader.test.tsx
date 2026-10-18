import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  parseAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
interface Row {
  id: string
  after: { ability: AbilityDefinition }
}
const rows: Row[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const expected = {
  airborne: [
    { label: 'Ground Skills', value: 'Always miss' },
    { label: 'Jump', value: '3' },
    { label: 'Attack Target Elevation', value: '3' },
  ],
  blindside: [
    { label: 'Front', value: '100%' },
    { label: 'Side', value: '160%' },
    { label: 'Rear', value: '220%' },
  ],
  haste: [{ label: 'Minimum movement cost', value: '10 AP' }],
  wet: [
    { label: 'Initiative', value: '−10% per application' },
    { label: 'Maximum Initiative reduction', value: '100%' },
    { label: 'Minimum Initiative', value: '0' },
  ],
} as const
it.each(['airborne', 'blindside', 'haste', 'wet'] as const)(
  'keeps every actual %s secondary value structured before shortening prose',
  (statusId) => {
    let count = 0
    for (const row of rows) {
      const definition = parseAbilityDefinition(row.after.ability),
        before = JSON.stringify(definition)
      for (const group of definition.behaviors) {
        const report = abilityBehaviorInformation(group)
        group.effects.forEach((effect, index) => {
          if (effect.payload.type !== 'apply-status' || effect.payload.statusId !== statusId) return
          count++
          expect(report.effects[index]!.parts).toMatchObject({
            details: expect.arrayContaining([
              { label: 'Stacks', value: String(effect.payload.stacks) },
              ...expected[statusId],
            ]),
          })
          expect(report.effectDescriptions[index]).not.toMatch(/\d/)
          const html = renderToStaticMarkup(
            <AbilityDefinitionParameters
              definition={projectPublicCombat({ schemaVersion: 1, behaviors: [group] })}
            />,
          )
          for (const { label, value } of expected[statusId])
            expect(html).toContain(`[${label}: ${value}]`)
        })
      }
      expect(JSON.stringify(definition)).toBe(before)
    }
    expect(count).toBe({ airborne: 2, blindside: 5, haste: 4, wet: 6 }[statusId])
  },
)
function statusGroup(statusId: string, extra: Record<string, unknown> = {}) {
  const group = rows.find((r) =>
    r.after.ability.behaviors.some((g) =>
      g.effects.some((e) => e.payload.type === 'apply-status' && e.payload.statusId === statusId),
    ),
  )!.after.ability.behaviors[0]!
  return parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...group,
        classification: 'utility',
        attackFamily: undefined,
        accuracy: undefined,
        effects: [
          {
            id: 'status',
            timing: 'instant',
            payload: {
              type: 'apply-status',
              statusId,
              recipient: 'actor',
              stacks: 1,
              durationTurns: statusId === 'blindside' ? 1 : 2,
              ...extra,
            },
          },
        ],
      },
    ],
  }).behaviors[0]!
}
it('preserves exact edited Blindside multipliers instead of substituting current defaults', () => {
  const group = statusGroup('blindside', {
      blindsideModifiersBasisPoints: { side: 12500, rear: 25000 },
    }),
    before = JSON.stringify(group)
  const parts = abilityBehaviorInformation(group).effects[0]!.parts
  expect(parts.details).toEqual(
    expect.arrayContaining([
      { label: 'Side', value: '125%' },
      { label: 'Rear', value: '250%' },
    ]),
  )
  expect(parts.details).not.toEqual(expect.arrayContaining([{ label: 'Side', value: '160%' }]))
  expect(JSON.stringify(group)).toBe(before)
})
it.each([true, false])(
  'preserves the captured Blindside activation policy (legacy=%s)',
  (legacyBlindsideActivation) => {
    const report = abilityBehaviorInformation(statusGroup('blindside'), {
      effectContext: { legacyBlindsideActivation },
    })
    expect(report.effectDescriptions[0]).toContain('Basic Attack is unchanged')
    if (legacyBlindsideActivation)
      expect(report.effectDescriptions[0]).not.toContain('facing bonus')
    else expect(report.effectDescriptions[0]).toContain('facing bonus')
  },
)
it.each([
  [false, false],
  [false, true],
  [true, true],
] as const)(
  'preserves captured Airborne/Jump flags (%s/%s)',
  (legacyAirborne, legacyAirborneJump) => {
    const report = abilityBehaviorInformation(statusGroup('airborne'), {
      effectContext: { legacyAirborne, legacyAirborneJump },
    })
    const facts = report.effects[0]!.parts.details ?? []
    if (legacyAirborne) {
      expect(report.effectDescriptions[0]).not.toContain('Ground-targeted Skills')
      expect(facts).not.toContainEqual({ label: 'Ground Skills', value: 'Always miss' })
    } else {
      expect(facts).toContainEqual({ label: 'Ground Skills', value: 'Always miss' })
      expect(facts).toContainEqual({ label: 'Attack Target Elevation', value: '3' })
    }
    if (legacyAirborne || legacyAirborneJump)
      expect(facts.some((f) => f.label === 'Jump')).toBe(false)
    else expect(facts).toContainEqual({ label: 'Jump', value: '3' })
  },
)
it('keeps current captured Drenched potency distinct from its fixed Initiative reduction', () => {
  const report = abilityBehaviorInformation(
    statusGroup('wet', { stacks: 3, potencyBasisPoints: 2750 }),
  )
  expect(report.effects[0]!.parts).toMatchObject({
    magnitude: '+27.5% Storm',
    details: expect.arrayContaining([
      { label: 'Stacks', value: '3' },
      { label: 'Initiative', value: '−10% per application' },
    ]),
  })
  expect(report.effectDescriptions[0]).toContain('strongest active application')
})
it.each([true, false])(
  'retains the captured older elemental Drenched rule (legacy=%s)',
  (legacyElemental) => {
    const report = abilityBehaviorInformation(statusGroup('wet'), {
      effectContext: { legacyElemental, explicitElemental: false },
    })
    if (legacyElemental) expect(report.effectDescriptions[0]).not.toContain('Initiative')
    else
      expect(report.effects[0]!.parts.details ?? []).toContainEqual({
        label: 'Initiative',
        value: '−10% once',
      })
  },
)

it('shows the same-turn expiry in every actual Blindside reader, including Controlled', () => {
  let count = 0
  for (const row of rows) {
    for (const group of row.after.ability.behaviors) {
      const report = abilityBehaviorInformation(group)
      for (const [index, effect] of group.effects.entries()) {
        if (effect.payload.type !== 'apply-status' || effect.payload.statusId !== 'blindside')
          continue
        count++
        expect(report.effects[index]!.parts).toMatchObject({
          duration: '1 recipient turn end',
          details: expect.arrayContaining([
            {
              label: 'Expiry',
              value: 'Count from activation, including the recipient’s current turn',
            },
          ]),
        })
        const html = renderToStaticMarkup(
          <AbilityDefinitionParameters
            definition={projectPublicCombat({ schemaVersion: 1, behaviors: [group] })}
          />,
        )
        expect(html).toContain('[1 recipient turn end]')
        expect(html).toContain(
          '[Expiry: Count from activation, including the recipient’s current turn]',
        )
        if (effect.timing === 'controlled')
          expect(report.effectDescriptions[index]).toContain(
            'Controlled primes the whole selected action for free',
          )
      }
    }
  }
  expect(count).toBe(5)
})
it.each([
  ['instant', false],
  ['controlled', false],
  ['next-round', false],
  ['delayed', false],
  ['instant', true],
  ['controlled', true],
  ['next-round', true],
  ['delayed', true],
] as const)(
  'retains Blindside expiry for %s timing and captured activation legacy=%s',
  (timing, legacyBlindsideActivation) => {
    const group = statusGroup('blindside')
    const definition = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [{ ...group, effects: group.effects.map((e) => ({ ...e, timing })) }],
    })
    const before = JSON.stringify(definition)
    const report = abilityBehaviorInformation(definition.behaviors[0]!, {
      effectContext: { legacyBlindsideActivation },
    })
    const rounds = timing === 'next-round' || timing === 'delayed'
    expect(report.effects[0]!.parts).toMatchObject({
      duration: rounds ? '1 full round' : '1 recipient turn end',
      details: expect.arrayContaining([
        {
          label: 'Expiry',
          value: rounds
            ? 'Global round end after activation'
            : 'Count from activation, including the recipient’s current turn',
        },
      ]),
    })
    expect(report.effectDescriptions[0]).toContain('Basic Attack is unchanged')
    if (timing === 'controlled')
      expect(report.effectDescriptions[0]).toContain('Invalid releases retain the prime')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
