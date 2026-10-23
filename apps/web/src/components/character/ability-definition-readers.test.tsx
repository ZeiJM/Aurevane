import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { skillTypeDescription } from './skill-detail-presentation'
import { SkillDetails } from './skill-details'
import { SkillParameters } from './skill-parameters'
import { ResonanceParameters } from './resonance-parameters'
import { MINIMUM_SKILL_INFORMATION_FIELDS } from './skill-information-contract'

const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
const ability = parseAbilityDefinition({
  schemaVersion: 1,
  behaviors: [
    {
      ...base,
      id: 'leap',
      costs: [
        { resource: 'ap', amount: 11 },
        { resource: 'mp', amount: 2 },
        { resource: 'hp', amount: 1 },
      ],
      cooldown: { key: 'leap', ownerTurns: 3 },
      requirements: {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'mp',
        comparison: 'at-least',
        amount: 3,
      },
      activationLimits: ['once-per-battle'],
      targeting: { ...base.targeting!, maximumRange: 4, maximumSelections: 2 },
      effects: [
        { id: 'move', payload: { type: 'move', recipient: 'actor', maximumTiles: 2 } },
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 13 },
        },
      ],
    },
  ],
})
const skill = {
  ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
  ability,
  apCost: 71,
  effectDescriptions: ['Wrong legacy explanation'],
}
function assertReport(html: string) {
  expect([...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1])).toEqual([
    ...MINIMUM_SKILL_INFORMATION_FIELDS,
  ])
  expect(html).toContain('11 AP / 2 MP / 1 HP')
  expect(html.replace(/<[^>]*>/gu, '')).toContain('MP [≥ 3] [Self]')
  expect(html).toContain('data-compact-effect-magnitude="true">[13]</span>')
  expect(html).toMatch(
    /data-compact-effect-label="true"><span[^>]*data-effect-tag-label="true">Move<\/span><\/strong>/u,
  )
  expect(html).toContain('data-compact-effect-timing="true">[Controlled]</span>')
  expect(html).not.toContain('71 AP')
  expect(html).not.toContain('Wrong legacy')
  expect(html).not.toContain('Consecutive reuse reduces')
}
it('renders current and read-only Master Skill details from the canonical group', () => {
  const before = JSON.stringify(skill)
  for (const node of [
    <SkillDetails key="current" skill={skill} expanded />,
    <SkillDetails key="master" skill={projectPublicCombat(skill)} />,
  ]) {
    const html = renderToStaticMarkup(node)
    assertReport(html)
    expect(html).toContain('Once per battle')
  }
  expect(JSON.stringify(skill)).toBe(before)
})
it('renders full current Nexus parameter reports from canonical mechanics', () => {
  const html = renderToStaticMarkup(<SkillParameters skill={skill} />)
  assertReport(html)
  expect(html).toContain('Once per battle')
})
it('renders canonical Resonance behaviors without entering the legacy combo normalizer', () => {
  const resonance = { ...resolveResonanceForPair('wildwarden', 'edgedancer')!, ability }
  const html = renderToStaticMarkup(<ResonanceParameters definition={resonance} />)
  assertReport(html)
  expect(html).not.toContain('Once per battle')
})
it('keeps multiple groups separate and describes Ongoing 12.5% by its maintained lifetime', () => {
  const multi = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [
      ability.behaviors[0]!,
      {
        ...base,
        id: 'maintain',
        activation: 'ongoing',
        mode: 'modifier',
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        cooldown: null,
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
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11250 },
          },
        ],
      },
    ],
  })
  const html = renderToStaticMarkup(<SkillDetails skill={{ ...skill, ability: multi }} expanded />)
  expect(html.match(/<dt>Skill Type<\/dt>/g)).toHaveLength(2)
  expect(html).toContain('Ongoing Modifier')
  expect(html).toContain('[12.5%]')
  expect(html).toContain('while Requirements are met')
  expect(html).not.toMatch(/12\.5%[^<]*Turns/)
  expect(html).toContain('data-ability-behavior="leap"')
  expect(html).toContain('data-ability-behavior="maintain"')
})

it('uses canonical classification for compact Nexus metadata rather than stale legacy tags', () => {
  expect(skillTypeDescription({ ...skill, tags: ['recovery'] })).toBe('Attack')
})

it('preserves version-matched authored explanations across groups as plain text with registry fallbacks', () => {
  const definition = parseAbilityDefinition({
    schemaVersion: 1,
    behaviors: [ability.behaviors[0]!, { ...ability.behaviors[0]!, id: 'second' }],
  })
  const authored = {
    ...skill,
    ability: definition,
    effectDescriptions: [
      'Leap <once> & move.',
      null,
      'Second movement note.',
      'Second impact note.',
    ],
  }
  for (const node of [
    <SkillDetails key="details" skill={authored} expanded />,
    <SkillParameters key="parameters" skill={authored} />,
  ]) {
    const html = renderToStaticMarkup(node)
    expect(html).toContain('Leap &lt;once&gt; &amp; move.')
    expect(html).toContain('Second movement note.')
    expect(html).toContain('Second impact note.')
    expect(html).toContain('Deal 13 base damage')
    expect(html.match(/data-compact-effect-magnitude="true">\[13\]<\/span>/g)).toHaveLength(2)
    expect(html).not.toContain('<once>')
  }
})

it('renders the exact repeated Ground subset in actual Skill details and Skill Management parameters', () => {
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
          teamPolicy: 'enemy',
          friendlyFire: 'enemies-only',
          minimumRange: 0,
          maximumRange: 2,
        },
        effects: [
          { id: 'cast-hit', payload: { type: 'damage', recipient: 'affected-units', amount: 10 } },
          { id: 'repeat-hit', payload: { type: 'damage', recipient: 'affected-units', amount: 4 } },
          {
            id: 'caster',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'guarded',
              stacks: 1,
              durationTurns: 2,
              potencyBasisPoints: 1200,
            },
          },
        ],
        groundArea: {
          durationRounds: 3,
          visualPresetId: 'embers',
          entryEffectIds: ['repeat-hit'],
          timing: 'instant',
        },
      },
    ],
  })
  const current = { ...skill, ability: definition, effectDescriptions: undefined }
  const before = JSON.stringify(current)
  for (const node of [
    <SkillDetails key="details" skill={current} expanded />,
    <SkillParameters key="parameters" skill={projectPublicCombat(current)} />,
  ]) {
    const html = renderToStaticMarkup(node)
    const effects = [
      ...html.matchAll(/<div>(<span data-compact-skill-effect[\s\S]*?)<\/div>/g),
    ].map((m) => m[1]!)
    expect(effects).toHaveLength(3)
    expect(effects.map((effect) => effect.includes('Repeats on entry'))).toEqual([
      false,
      false,
      false,
    ])
    expect(html.split('Repeats on entry.')).toHaveLength(2)
    expect(effects[1]).toContain('data-compact-effect-magnitude="true">[4]</span>')
    expect(html).toContain('only the effects marked for entry')
    expect(html).not.toContain('repeat-hit')
    expect(html).toContain('data-effect-tag-label="true"')
  }
  expect(JSON.stringify(current)).toBe(before)
})
