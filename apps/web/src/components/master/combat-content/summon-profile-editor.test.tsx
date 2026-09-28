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
  it('exposes per-summon lifetime and authored unit profile fields', () => {
    const markup = renderToStaticMarkup(
      createElement(SummonProfileEditor, {
        value: currentProfile(),
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain('data-summon-profile-editor')
    expect(markup).toContain('<legend>Summon Profile</legend>')
    expect(markup).toMatch(/aria-label="Summon lifetime turns"[^>]*min="1"[^>]*value="5"/u)
    expect(markup).toContain('Five turns is the standard')
    expect(markup).toContain('aria-label="Summon max HP"')
    expect(markup).toContain('aria-label="Summon max MP"')
    expect(markup).toContain('aria-label="Summon initiative"')
    expect(markup).toContain('aria-label="Summon movement budget"')
    expect(markup).toContain('aria-label="Summon AI profile"')
  })

  it('renders both programmable abilities and prevents a third authored ability', () => {
    const markup = renderToStaticMarkup(
      createElement(SummonProfileEditor, {
        value: currentProfile(),
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain('Thorn Rake')
    expect(markup).toContain('Verdant Mend')
    expect(markup).toContain('aria-label="Summon ability 1 AP cost"')
    expect(markup).toContain('aria-label="Summon ability 2 AP cost"')
    expect(markup).toContain('aria-label="Summon ability 1 AI utility"')
    expect(markup).toContain('aria-label="Summon ability 2 AI utility"')
    expect(markup).toContain('<button type="button" disabled="">Add summon ability</button>')
  })
})
