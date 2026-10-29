import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionParameters } from './ability-definition-parameters'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { BasicActionEffectExplanations } from './basic-action-effect-details'
import { CompactEffectSummary } from './compact-skill-effect-summary'
import { compactSkillEffectSummaryParts } from './skill-detail-presentation'
import {
  basicActionEffectSummaryParts,
  basicActionEffectExplanation,
} from './basic-action-presentation'

const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!

it('keeps supplementary Guard and recovery labels, magnitudes and descriptions aligned', () => {
  expect(basicActionEffectSummaryParts('basic.guard').label).toBe('Guard')
  expect(basicActionEffectSummaryParts('basic.recover').magnitude).toBe('10%')
  expect(basicActionEffectSummaryParts('basic.recover.mp').magnitude).toBe('10%')
  expect(basicActionEffectExplanation('basic.guard')).not.toMatch(/\d/u)
})

it('keeps Pierce power numeric and explains Barrier destruction under current global rules', () => {
  const report = abilityBehaviorInformation(
    {
      ...base,
      effects: [
        {
          id: 'pierce',
          payload: {
            type: 'pierce',
            recipient: 'primary-unit',
            amount: 15,
            armorIgnoredBasisPoints: 5000,
          },
        },
      ],
    },
    { timingPolicy: { version: 8, tagAuthority: 'global', modes: {} } },
  )
  expect(report.effects[0]!.parts.magnitude).toBe('15')
  expect(report.effects[0]!.parts.details).toContainEqual({ label: 'Armor ignored', value: '50%' })
  expect(report.effectDescriptions[0]).toContain('Barrier')
  expect(report.effectDescriptions[0]).toContain('Defense still apply')
})

it('renders a shared effect tag as bold text in a compact Resonance-style summary', () => {
  const html = renderToStaticMarkup(
    <CompactEffectSummary parts={{ label: 'Haste', magnitude: '10', duration: null }} />,
  )
  expect(html).toMatch(
    /<strong[^>]*data-compact-effect-label="true"[^>]*><span[^>]*data-effect-tag-label="true"[^>]*>Haste<\/span><\/strong>/,
  )
})

it.each([
  ['instant', '2 Turns'],
  ['next-round', '2 Rounds'],
] as const)('keeps the actual duration unit while shortening %s labels', (mode, duration) => {
  const report = abilityBehaviorInformation({
    ...base,
    effects: [
      {
        id: 'opening',
        timing: mode,
        payload: {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'blindside',
          stacks: 1,
          durationTurns: 2,
        },
      },
    ],
  })
  expect(report.effects[0]!.parts.duration).toBe(duration)
})

it('uses the shared colored tag in supplementary effect explanation bullets', () => {
  const html = renderToStaticMarkup(<BasicActionEffectExplanations id="basic.guard" />)
  expect(html).toContain('data-effect-tag-label="true"')
})

it('reports modifier Skills as Utility with a compact modular requirement', () => {
  const behavior = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        id: 'riposte',
        mode: 'modifier',
        classification: 'utility',
        attackFamily: undefined,
        targeting: null,
        requirements: {
          kind: 'status-presence',
          subject: 'owner',
          statusId: 'guarded',
          present: true,
        },
        effects: [
          {
            id: 'bonus',
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11500 },
          },
        ],
      },
    ],
  }).behaviors[0]!
  const report = abilityBehaviorInformation(behavior)
  expect(Object.fromEntries(report.rows)['Skill Type']).toBe('Utility')
  expect(Object.fromEntries(report.rows).Requirements).toBe('Guard [Self]')
  expect(report.effectDescriptions[0]).not.toMatch(/Manual|Ongoing|prepaid|captured|contribution/)
})

it('omits a redundant effect recipient and uses a compact selected-target prerequisite', () => {
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        requirements: {
          kind: 'status-presence',
          subject: 'selected',
          statusId: 'slow',
          present: true,
        },
      },
    ],
  })
  const html = renderToStaticMarkup(<AbilityDefinitionParameters definition={definition} />)
  expect(html).not.toContain('[Target]')
  expect(html).not.toContain('→')
  expect(html).not.toContain('must have')
  expect(
    Object.fromEntries(abilityBehaviorInformation(definition.behaviors[0]!).rows).Requirements,
  ).toBe('Slow')
})

it('adds only conflicting recipients to a Ground Move, enemy damage and self healing Skill', () => {
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        targeting: {
          ...base.targeting!,
          geometryVersion: 3,
          kind: 'ground-tile',
          categories: ['ground'],
          minimumRange: 0,
        },
        effects: [
          { id: 'step', payload: { type: 'move', recipient: 'actor', maximumTiles: 1 } },
          { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 13 } },
          { id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 3 } },
        ],
      },
    ],
  })
  const html = renderToStaticMarkup(<AbilityDefinitionParameters definition={definition} />)
  expect(html).toContain('[Enemy]')
  expect(html).toContain('[Self]')
  expect(html).not.toContain('[Ground]')
  const report = abilityBehaviorInformation(definition.behaviors[0]!)
  expect(Object.fromEntries(report.rows).Effects).toBe(
    'Move [1] [Instant] [Self], Dmg [13] [Enemy], Heal [3] [Instant] [Self]',
  )
})

it('keeps status magnitude numeric and omits stack and expiry metadata brackets', () => {
  const parts = compactSkillEffectSummaryParts({
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'inspired',
    stacks: 1,
    durationTurns: 1,
    potencyBasisPoints: 1200,
  })
  expect(parts.magnitude).toBe('12%')
  const html = renderToStaticMarkup(
    <CompactEffectSummary
      parts={{
        label: 'Blindside',
        magnitude: null,
        duration: '1 Turn',
        details: [
          { label: 'Stacks', value: '1' },
          { label: 'Expiry', value: 'Recipient turn end' },
        ],
      }}
    />,
  )
  expect(html).not.toContain('[Stacks:')
  expect(html).not.toContain('[Expiry:')
})

it('shows a percentage Barrier with its temporary-HP meaning rather than flat Skill power', () => {
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'shield',
            payload: {
              type: 'barrier-change',
              recipient: 'actor',
              amount: 25,
              basis: 'maximum-hp-percent',
            },
          },
        ],
      },
    ],
  })
  const report = abilityBehaviorInformation(definition.behaviors[0]!)
  expect(report.effects[0]!.parts.magnitude).toBe('25%')
  expect(report.effectDescriptions[0]).toContain('maximum HP')
  expect(report.effectDescriptions[0]).toContain('Pierce')
})

it('keeps Move and Controlled Rewind explanations short without repeating timing or engine bookkeeping', () => {
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        id: 'advance',
        classification: 'utility',
        attackFamily: undefined,
        targeting: {
          ...base.targeting!,
          geometryVersion: 3,
          kind: 'ground-tile',
          categories: ['ground'],
          minimumRange: 0,
        },
        effects: [{ id: 'move', payload: { type: 'move', recipient: 'actor', maximumTiles: 1 } }],
      },
      {
        ...base,
        id: 'return',
        classification: 'utility',
        attackFamily: undefined,
        targeting: {
          ...base.targeting!,
          kind: 'self',
          teamPolicy: 'self',
          minimumRange: 0,
          maximumRange: 0,
          friendlyFire: 'allies-only',
        },
        effects: [
          {
            id: 'rewind',
            timing: 'controlled',
            payload: {
              type: 'return-to-turn-start',
              recipient: 'actor',
              anchorMode: 'cast-position',
            },
          },
        ],
      },
    ],
  })
  const descriptions = definition.behaviors.flatMap(
    (behavior) => abilityBehaviorInformation(behavior).effectDescriptions,
  )
  for (const description of descriptions) {
    expect(description.length).toBeLessThan(120)
    expect(description).not.toMatch(
      /legal|Controlled|captured|stored|global round|once per|refunded/,
    )
  }
  expect(descriptions[1]).toContain('primed')
})

it('presents enemy Blindside as a one-turn vulnerability with only its powers in the magnitude', () => {
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [
          {
            id: 'debuff',
            payload: {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'blindside-vulnerability',
              stacks: 1,
              durationTurns: 1,
              blindsideModifiersBasisPoints: { side: 17500, rear: 25000 },
            },
          },
        ],
      },
    ],
  })
  const report = abilityBehaviorInformation(definition.behaviors[0]!)
  expect(report.effects[0]!.parts).toMatchObject({
    label: 'Blindside',
    magnitude: '175% / 250%',
    duration: null,
  })
  expect(report.effectDescriptions[0]).toContain('Take increased Skill damage')
  expect(report.effectDescriptions[0]).not.toMatch(/grants|refreshes|owner|Stacks|Expiry/)
})
