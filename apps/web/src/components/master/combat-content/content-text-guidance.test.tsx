import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { defaultCombatTagDefinitions } from '@aurevane/game-core/combat/combat-tag-wording'
import { ContentDefinitionFields } from './content-definition-fields'
import {
  CONTENT_TEXT_GUIDANCE,
  contentDescriptionGuidance,
  contentFlavorGuidance,
} from './content-text-guidance'

vi.mock('server-only', () => ({}))

const fixtures = [
  { kind: 'skill', value: { ...resolveMatureSkillVersion('vanguard.forceful-strike')! } },
  { kind: 'essence', value: { ...resolveEssenceForBuild('vanguard', null)! } },
  { kind: 'resonance', value: { ...resolveResonanceForPair('vanguard', 'aetherist')! } },
  { kind: 'item', value: { ...starterItemDefinitions()[0]! } },
] as const

it.each(fixtures)(
  'keeps accurate $kind guidance with a single Item description help source',
  ({ kind, value }) => {
    const before = JSON.stringify(value)
    const onChange = vi.fn()
    const html = renderToStaticMarkup(
      <ContentDefinitionFields kind={kind} value={value} tab="Text" onChange={onChange} />,
    )
    const description = contentDescriptionGuidance(kind)
    if (kind === 'item') {
      expect(html).not.toContain(`-description">${description.hint}</small>`)
      expect(html.split(description.hint)).toHaveLength(2)
    } else {
      expect(html).toContain(`-description">${description.hint}</small>`)
      expect(html.split(description.hint)).toHaveLength(3)
    }
    expect(html).toContain('aria-label="About Description"')
    expect(html).toMatch(/<h3[^>]*>About Description<\/h3>/)
    const descriptionInput = html.match(
      /<textarea[^>]*aria-label="Description"[^>]*aria-describedby="([^"]+)"/,
    )
    if (kind === 'item') expect(descriptionInput).toBeNull()
    else {
      expect(descriptionInput?.[1]).toBeTruthy()
      expect(html).toContain(`<small id="${descriptionInput![1]}">`)
    }
    if (kind !== 'item') {
      const flavor = contentFlavorGuidance(kind)
      expect(html).toContain(`-flavor">${flavor.hint}</small>`)
      expect(html.split(flavor.hint)).toHaveLength(3)
      expect(html).toContain('aria-label="About Flavor line tags"')
      expect(html).toContain('Cards supply the ability name.')
      expect(html).toContain('Missing character names read as Combatant')
    }
    if (kind === 'skill' || kind === 'essence') {
      expect(html).toContain(`-battle-text">${CONTENT_TEXT_GUIDANCE.battleText.hint}</small>`)
      expect(html).toContain(CONTENT_TEXT_GUIDANCE.battleText.help)
    } else expect(html).not.toContain('aria-label="In-battle text"')
    expect(html).not.toContain('Shown on the Skill card.')
    expect(html).not.toContain('Shown in Resonance details.')
    expect(onChange).not.toHaveBeenCalled()
    expect(JSON.stringify(value)).toBe(before)
  },
)

it.each(defaultBasicSkills())(
  'gives Basic/Support $id the same Description and Chronicle guidance without a Flavor field',
  (value) => {
    const html = renderToStaticMarkup(
      <ContentDefinitionFields kind="skill" value={{ ...value }} tab="Text" onChange={() => {}} />,
    )
    expect(html).toContain(`-description">${CONTENT_TEXT_GUIDANCE.skillDescription.hint}</small>`)
    expect(html).toContain(`-battle-text">${CONTENT_TEXT_GUIDANCE.battleText.hint}</small>`)
    expect(html).not.toContain('aria-label="Flavor line"')
  },
)

it('explains full Tag reports separately from compact tooltips, with persistent accessible guidance for both', () => {
  const value = defaultCombatTagDefinitions().find((tag) => tag.tagId === 'dispel')!
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="tag"
      value={{ ...value }}
      tab="Parameters"
      onChange={() => {}}
    />,
  )
  for (const [field, guidance] of [
    ['full', CONTENT_TEXT_GUIDANCE.tagFull],
    ['short', CONTENT_TEXT_GUIDANCE.tagCompact],
  ] as const) {
    expect(html).toContain(`-${field}" class=`)
    expect(html).toContain(guidance.hint)
    expect(html.split(guidance.hint)).toHaveLength(3)
    expect(html).toContain(guidance.help)
  }
  expect(html).toContain('aria-label="About Skill Manager description"')
  expect(html).toContain('aria-label="About Battle description"')
  expect(html).toMatch(/<h3[^>]*>About Skill Manager description<\/h3>/)
  expect(html).toMatch(/<h3[^>]*>About Battle description<\/h3>/)
  expect(html).toContain('battle Parameters')
  expect(html).toContain('Chronicle effect tooltips')
})
