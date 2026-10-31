import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SummonProfileEditor } from './summon-profile-editor'

function currentProfile() {
  const definition = resolveMatureSkillVersion('wildwarden.renewing-herbs')
  if (!definition?.summonProfile) throw new Error('Expected current Renewing Herbs summon profile.')
  return definition.summonProfile
}

describe('Master Panel summon profile editor', () => {
  it('allows Reversal in native Summon Skills with their paid preparation adapter', () => {
    const profile = currentProfile()
    const value = {
      ...profile,
      abilities: profile.abilities.map((ability) => ({ ...ability, effects: [] })),
    }
    const before = structuredClone(value)
    const markup = renderToStaticMarkup(
      createElement(SummonProfileEditor, { value, onChange: vi.fn() }),
    )
    expect(markup.match(/<option value="reversal">Reversal<\/option>/gu)).toHaveLength(
      value.abilities.length,
    )
    expect(value).toEqual(before)
  })
  it('shows core stats and compact summon controls while hiding internal metadata', () => {
    const markup = renderToStaticMarkup(
      createElement(SummonProfileEditor, {
        value: currentProfile(),
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain('data-summon-profile-editor')
    expect(markup).toContain('<legend>Summon Profile</legend>')
    expect(markup).toMatch(/aria-label="Summon lifetime turns"[^>]*min="1"[^>]*value="5"/u)
    for (const stat of ['Might', 'Finesse', 'Vitality', 'Agility', 'Intellect', 'Resolve'])
      expect(markup).toContain(`aria-label="Summon ${stat}"`)
    expect(markup).toContain('aria-label="Summon potency (%)"')
    expect(markup).toContain('Never moves')
    for (const hidden of [
      'max HP',
      'max MP',
      'initiative',
      'movement budget',
      'AI profile',
      'profile ID',
      'portrait key',
      'tags',
      'AI purpose tags',
      'description',
      'flavor line',
    ])
      expect(markup).not.toContain(`aria-label="Summon ${hidden}"`)
  })

  it('renders both programmable abilities and prevents a third authored ability', () => {
    const markup = renderToStaticMarkup(
      createElement(SummonProfileEditor, {
        value: currentProfile(),
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain('aria-label="Summon ability 1 in-battle text"')
    expect(markup).toContain('aria-label="Summon ability 2 in-battle text"')
    expect(markup).toContain('<span>Insert tag</span>')
    expect(markup).toContain('About Writing tags')
    expect(markup).not.toContain('References and writing preview')
    expect(markup).toContain('aria-label="Summon ability 1 HP cost"')
    expect(markup).toContain('aria-label="Summon ability 1 damage type"')
    for (const hidden of ['ID', 'tags', 'AI purpose tags', 'icon key'])
      expect(markup).not.toContain(`aria-label="Summon ability 1 ${hidden}"`)
    expect(markup).toContain('data-summon-skill-body')
    expect(markup).toContain('alt="Current artwork"')
    expect(markup).toContain('<summary>Effects</summary>')
    expect(markup).toContain('<summary>Range &amp; Area</summary>')
    expect(markup).toContain('Thorn Rake')
    expect(markup).toContain('Verdant Mend')
    expect(markup).toContain('aria-label="Summon ability 1 AP cost"')
    expect(markup).toContain('aria-label="Summon ability 2 AP cost"')
    expect(markup).toContain('aria-label="Summon ability 1 action priority"')
    expect(markup).toContain('aria-label="Summon ability 2 action priority"')
    expect(markup).toContain('<button type="button" disabled="">Add summon Skill</button>')
  })
})
