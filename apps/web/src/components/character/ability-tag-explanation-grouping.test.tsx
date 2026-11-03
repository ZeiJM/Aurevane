import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionParameters } from './ability-definition-parameters'

const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!

it('shows one bottom Damage explanation across groups while retaining every Damage packet and unique note', () => {
  const definition = {
    schemaVersion: 1 as const,
    behaviors: [
      {
        ...base,
        id: 'first',
        effects: [
          {
            id: 'first-hit',
            payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 12 },
          },
          {
            id: 'bonus-hit',
            payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 5 },
            requirements: {
              kind: 'status-presence' as const,
              subject: 'owner' as const,
              statusId: 'fortified',
              present: true,
            },
          },
        ],
      },
      {
        ...base,
        id: 'second',
        effects: [
          {
            id: 'last-hit',
            payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 3 },
          },
        ],
      },
    ],
  }
  const before = JSON.stringify(definition)
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={definition}
      effectDescriptions={['First custom note.', 'Unique bonus note.', 'First custom note.']}
    />,
  )
  expect(html.match(/aria-label="Effect explanations"/g)).toHaveLength(1)
  const explanation = html.slice(html.indexOf('aria-label="Effect explanations"'))
  expect(explanation.match(/<li/g)).toHaveLength(1)
  expect(html.match(/data-compact-effect-magnitude="true"/g)).toHaveLength(3)
  expect(explanation.match(/First custom note\./g)).toHaveLength(1)
  expect(explanation).toContain('Unique bonus note.')
  expect(explanation).toContain('Applies only when')
  expect(explanation).toContain('Fortified')
  expect(JSON.stringify(definition)).toBe(before)
})

it('keeps different stable Tags separate even if their displayed labels are identical', async () => {
  const { abilityBehaviorInformation } = await import('./ability-detail-presentation')
  const { AbilityParameters } = await import('./ability-parameters')
  const report = abilityBehaviorInformation({
    ...base,
    effects: [
      { id: 'damage', payload: { type: 'damage', recipient: 'primary-unit', amount: 2 } },
      { id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 2 } },
    ],
  })
  const sameLabels = {
    ...report,
    effects: report.effects.map((effect) => ({
      ...effect,
      parts: { ...effect.parts, label: 'Shared name' },
    })),
  }
  const html = renderToStaticMarkup(<AbilityParameters report={sameLabels} />)
  const explanation = html.slice(html.indexOf('aria-label="Effect explanations"'))
  expect(explanation.match(/<li/g)).toHaveLength(2)
})

it('retains unique authored notes alongside one captured Tag explanation', () => {
  const definition = {
    schemaVersion: 1 as const,
    tagPresentation: [
      {
        contentKey: 'tag.damage',
        contentVersion: 1,
        tagId: 'damage',
        name: 'Dmg',
        full: 'Captured Damage teaching copy.',
        compact: 'Damage.',
      },
    ],
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'first',
            payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 12 },
          },
          {
            id: 'second',
            payload: { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 5 },
          },
        ],
      },
    ],
  }
  const html = renderToStaticMarkup(
    <AbilityDefinitionParameters
      definition={definition}
      effectDescriptions={['First authored note.', 'Second authored note.']}
    />,
  )
  const explanation = html.slice(html.indexOf('aria-label="Effect explanations"'))
  expect(explanation.match(/Captured Damage teaching copy\./g)).toHaveLength(1)
  expect(explanation).toContain('First authored note.')
  expect(explanation).toContain('Second authored note.')
})
