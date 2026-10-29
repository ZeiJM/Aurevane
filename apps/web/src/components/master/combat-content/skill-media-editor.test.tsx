import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SkillMediaEditor } from './skill-media-editor'

describe('Master Panel Skill media editor', () => {
  it('renders registered artwork preview, produced audio audition, without unsupported VFX clutter', () => {
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

    expect(markup).toContain('Restore default artwork')
    expect(markup).not.toContain('aria-label="Skill artwork hook"')
    expect(markup).toContain('src="/media/art/discipline-skills/lifebinder-mend-v01.webp"')
    expect(markup).toContain('aria-label="Skill audio hook"')
    expect(markup).toContain(
      '<option value="audio.skill-fx.v01.082" selected="">Stone Pulse 082</option>',
    )
    expect(markup).toContain('aria-label="Battle audio preview"')
    expect(markup).toContain('/media/audio/sfx/skill-fx-v01/082-1.mp3')
    expect(markup).not.toContain('data-media-hook-readonly="vfx"')
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
      '<option value="audio.skill-fx.v01.140" selected="">Steel Pulse 140</option>',
    )
    expect(markup).toContain('aria-label="Battle audio preview"')
    expect(markup).toContain('/media/audio/sfx/skill-fx-v01/140-1.mp3')
  })
})
it('offers PC upload with explicit finalization, crop and sound limits and immutable removal', () => {
  const media = {
    id: '00000000-0000-4000-8000-000000000012',
    kind: 'image' as const,
    contentType: 'image/png' as const,
    checksum: 'a'.repeat(64),
    byteLength: 100,
    width: 4,
    height: 4,
    sourceWidth: 8,
    sourceHeight: 4,
    crop: { x: 2, y: 0, size: 4 },
  }
  const markup = renderToStaticMarkup(
    createElement(SkillMediaEditor, {
      value: { iconKey: null, audioCueKey: null, vfxKey: null, artwork: media },
      onChange: () => {},
    }),
  )
  expect(markup).toContain('type="file"')
  expect(markup).toContain('Upload file')
  expect(markup).toContain('PCM16 WAV')
  expect(markup).toContain('2 MiB')
  expect(markup).toContain('Restore default artwork')
  expect(markup).not.toContain('Remove uploaded artwork')
  expect(markup).toContain(`/api/master/combat-content/media/${media.id}`)
  expect(markup).not.toContain('Browse finalized assets')
})

it('uses one artwork preview with Restore default and upload instead of browsing other items artwork', () => {
  const html = renderToStaticMarkup(
    <SkillMediaEditor
      contentId="lifebinder.mend"
      value={{ iconKey: 'skill.lifebinder.mend.icon', audioCueKey: null, vfxKey: null }}
      onChange={() => {}}
    />,
  )
  expect(html).toContain('Restore default artwork')
  expect(html).not.toContain('aria-label="Skill artwork hook"')
  expect(html).not.toContain('Built-in artwork')
  expect(html.match(/<img /g) ?? []).toHaveLength(1)
})
