import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { ContentDefinitionFields } from './content-definition-fields'
it.each([
  ['skill', () => latestEnabledMatureSkills().find((skill) => !skill.id.startsWith('unarmed.'))!],
  ['essence', () => currentEssenceDefinitions()[0]!],
  ['resonance', () => currentResonanceDefinitions()[0]!],
] as const)(
  'uses the same five ordered sections for %s without rewriting its mechanics',
  (kind, load) => {
    const value = structuredClone(load())
    const before = JSON.stringify(value)
    const html = renderToStaticMarkup(
      <ContentDefinitionFields
        kind={kind}
        value={value as never}
        tab="Parameters"
        onChange={() => {
          throw new Error('Opening must not change the draft')
        }}
      />,
    )
    let previous = -1
    for (const label of [
      'Details &amp; Text',
      'Media',
      'Range &amp; Area',
      'Execution Characteristics',
      'Effects',
    ]) {
      const index = html.indexOf(`>${label}</button>`)
      expect(index, label).toBeGreaterThan(previous)
      previous = index
    }
    expect(html).toContain('role="tablist"')
    expect(html).toContain('data-ability-section="effects" hidden=""')
    expect(JSON.stringify(value)).toBe(before)
  },
)

it('separates Discipline artwork from its details and keeps it image-only', () => {
  const value = {
    id: 'vanguard',
    name: 'Vanguard',
    description: 'A guardian.',
    core: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 1 },
    focus: ['might', 'vitality'],
    enabledForPrimary: true,
    enabledForSecondary: true,
    unlock: { kind: 'always' },
    linkedSkills: [],
    sortOrder: 0,
    enabled: true,
  } as never
  const details = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="discipline"
      value={value}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  const artwork = renderToStaticMarkup(
    <ContentDefinitionFields kind="discipline" value={value} tab="Media" onChange={() => {}} />,
  )
  expect(details).not.toContain('Upload content media')
  expect(artwork).toContain('Restore default artwork')
  expect(artwork).toContain('image/png,image/jpeg,image/webp')
  expect(artwork).not.toContain('audio/wav')
})

it('opens a linked effect editor directly on Effects', () => {
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="skill"
      value={latestEnabledMatureSkills()[0]! as never}
      tab="Parameters"
      initialAbilitySection="effects"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('data-ability-section="details" hidden=""')
  expect(html).not.toContain('data-ability-section="effects" hidden=""')
})
