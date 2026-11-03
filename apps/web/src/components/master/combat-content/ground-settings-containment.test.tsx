import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { ContentDefinitionFields } from './content-definition-fields'
import { SummonProfileEditor } from './summon-profile-editor'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

const source = resolveMatureSkillVersion('vanguard.forceful-strike')!
const effects = [
  {
    type: 'damage' as const,
    recipient: 'affected-units' as const,
    target: 'enemy' as const,
    amount: 5,
  },
  {
    type: 'damage' as const,
    recipient: 'affected-units' as const,
    target: 'ground' as const,
    amount: 7,
  },
  {
    type: 'healing' as const,
    recipient: 'affected-units' as const,
    target: 'ground' as const,
    amount: 3,
  },
]
const groundArea = {
  durationRounds: 8,
  visualPresetId: 'frost' as const,
  targetTeams: 'allies' as const,
  entryEffectOrdinals: [1, 2],
  timing: 'delayed' as const,
}
const target = {
  ...source.target,
  kind: 'ground-tile' as const,
  geometryVersion: 3 as const,
  categories: ['ground' as const],
}
const native = { ...source, target, effects, groundArea }

function expectGroundInsideFirstGroundCard(html: string) {
  const cards = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/gu) ?? []
  expect(cards).toHaveLength(3)
  expect(cards[0]).not.toContain('aria-label="Ground affects"')
  expect(cards[2]).not.toContain('aria-label="Ground affects"')
  const parameters = cards[1]!.match(
    /<details\b[^>]*data-effect-collapsible="true"[^>]*>[\s\S]*<\/details>/u,
  )?.[0]
  expect(
    parameters,
    'Ground settings belong inside the first Ground effect Edit parameters card',
  ).toBeDefined()
  for (const label of [
    'Ground affects',
    'Ground duration (rounds)',
    'Ground animation',
    'Ground animation preview',
  ]) {
    expect(parameters).toContain(`aria-label="${label}"`)
    expect(
      html.match(new RegExp(`aria-label="${label.replace(/[()]/gu, '\\$&')}"`, 'gu')),
    ).toHaveLength(1)
  }
  expect(parameters).toContain('<option value="allies" selected="">')
  expect(parameters).toMatch(/aria-label="Ground duration \(rounds\)"[^>]*value="8"/u)
  expect(parameters).toContain('<option value="frost" selected="">')
}

it('contains one shared Ground profile inside the first canonical Ground effect parameters', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const { entryEffectOrdinals: _ordinals, ...profile } = groundArea
  void _ordinals
  const value: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        targeting: { ...base.targeting!, ...target },
        effects: effects.map((payload, index) => ({ id: `effect-${index}`, payload })),
        groundArea: { ...profile, entryEffectIds: ['effect-1', 'effect-2'] },
      },
    ],
  }
  const before = structuredClone(value)
  const onChange = vi.fn()
  expectGroundInsideFirstGroundCard(
    renderToStaticMarkup(
      <AbilityDefinitionEditor value={value} section="effects" onChange={onChange} />,
    ),
  )
  expect(value).toEqual(before)
  expect(onChange).not.toHaveBeenCalled()
})

it.each(['skill', 'essence'] as const)(
  'contains the shared profile within legacy %s Ground parameters',
  (kind) => {
    const value =
      kind === 'skill' ? native : { ...resolveEssenceForBuild('vanguard', null)!, skill: native }
    const before = structuredClone(value)
    const onChange = vi.fn()
    expectGroundInsideFirstGroundCard(
      renderToStaticMarkup(
        <ContentDefinitionFields
          kind={kind}
          value={value}
          tab="Parameters"
          abilitySection="effects"
          onChange={onChange}
        />,
      ),
    )
    expect(value).toEqual(before)
    expect(onChange).not.toHaveBeenCalled()
  },
)

it('contains the native Summon profile within its first Ground effect parameters', () => {
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
  const value = {
    ...profile,
    abilities: [{ ...profile.abilities[0]!, target, effects, groundArea }],
  }
  const before = structuredClone(value)
  const onChange = vi.fn()
  expectGroundInsideFirstGroundCard(
    renderToStaticMarkup(<SummonProfileEditor value={value} onChange={onChange} />),
  )
  expect(value).toEqual(before)
  expect(onChange).not.toHaveBeenCalled()
})

it('hides obsolete saved Ground settings in ordinary unit parents without changing their drafts', () => {
  const base = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0]!
  const ordinary = { ...native, target: source.target, effects: [effects[0]!] }
  const ability: AbilityDefinition = {
    schemaVersion: 1,
    behaviors: [
      {
        ...base,
        effects: [{ id: 'unit-hit', payload: effects[0]! }],
        groundArea: { ...groundArea, entryEffectIds: ['unit-hit'] },
      },
    ],
  }
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
  const summon = {
    ...profile,
    abilities: [
      { ...profile.abilities[0]!, target: source.target, effects: ordinary.effects, groundArea },
    ],
  }
  const before = structuredClone({ ordinary, ability, summon })
  const onChange = vi.fn()
  const markup = [
    <AbilityDefinitionEditor
      key="canonical"
      value={ability}
      section="effects"
      onChange={onChange}
    />,
    <ContentDefinitionFields
      key="skill"
      kind="skill"
      value={ordinary}
      tab="Parameters"
      abilitySection="effects"
      onChange={onChange}
    />,
    <ContentDefinitionFields
      key="essence"
      kind="essence"
      value={{ ...resolveEssenceForBuild('vanguard', null)!, skill: ordinary }}
      tab="Parameters"
      abilitySection="effects"
      onChange={onChange}
    />,
    <SummonProfileEditor key="summon" value={summon} onChange={onChange} />,
  ].map((tree) => renderToStaticMarkup(tree))
  for (const html of markup.slice(0, 3)) expect(html).toContain('remove obsolete Ground settings')
  for (const html of markup)
    for (const label of ['Ground affects', 'Ground duration (rounds)', 'Ground animation'])
      expect(html).not.toContain(`aria-label="${label}"`)
  expect({ ordinary, ability, summon }).toEqual(before)
  expect(onChange).not.toHaveBeenCalled()
})
