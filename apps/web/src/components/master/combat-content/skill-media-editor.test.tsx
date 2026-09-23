import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SkillMediaEditor } from './skill-media-editor'

describe('Master Panel Skill media editor', () => {
  it('renders registered artwork preview, produced audio audition, and read-only VFX', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillMediaEditor, {
        value: {
          iconKey: 'skill.lifebinder.mend.icon',
          audioCueKey: 'skill.ironfist.breakfall.audio',
          vfxKey: 'skill.vanguard.forceful-strike.vfx',
        },
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain('aria-label="Skill artwork hook"')
    expect(markup).toContain(
      '<option value="skill.lifebinder.mend.icon" selected="">Mend · lifebinder</option>',
    )
    expect(markup).toContain('aria-label="Skill artwork preview"')
    expect(markup).toContain('src="/media/art/discipline-skills/lifebinder-mend-v01.webp"')
    expect(markup).toContain('aria-label="Skill audio hook"')
    expect(markup).toContain(
      '<option value="skill.ironfist.breakfall.audio" selected="">Breakfall · ironfist</option>',
    )
    expect(markup).toContain('aria-label="Battle audio preview"')
    expect(markup).toContain('/media/audio/sfx/phase4/ironfist-action-v02-1.wav')
    expect(markup).toContain('aria-label="VFX hook read only"')
    expect(markup).toContain('data-media-hook-readonly="vfx"')
    expect(markup).toContain('skill.vanguard.forceful-strike.vfx')
  })

  it('auditions newly produced Vanguard audio instead of showing a reserved placeholder', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillMediaEditor, {
        value: {
          iconKey: 'skill.vanguard.forceful-strike.icon',
          audioCueKey: 'skill.vanguard.forceful-strike.audio',
          vfxKey: 'skill.vanguard.forceful-strike.vfx',
        },
        onChange: vi.fn(),
      }),
    )

    expect(markup).toContain(
      '<option value="skill.vanguard.forceful-strike.audio" selected="">Forceful Strike · vanguard</option>',
    )
    expect(markup).toContain('aria-label="Battle audio preview"')
    expect(markup).toContain('/media/audio/sfx/phase4/vanguard-action-v02-1.wav')
  })
})
