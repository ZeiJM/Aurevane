import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SkillMediaEditor } from './skill-media-editor'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'

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
it('offers automatic PC upload with crop and sound limits and immutable removal', () => {
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
  expect(markup).not.toContain('Upload file')
  expect(markup).not.toContain('About Media uploads')
  expect(markup).toContain('Selected files upload automatically')
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

it.each([
  ['basic.move', '/media/skills/move.webp'],
  ['unarmed.basic', '/media/skills/basic-attack-fist.webp'],
  ['basic.guard', '/media/skills/guard.webp'],
  ['basic.recover', '/media/skills/hp-recovery.webp'],
  ['basic.recover.mp', '/media/skills/mp-recovery-dark-fantasy-v1.webp'],
])(
  'previews the existing builtin %s artwork in a single media group without intersecting legends',
  (id, source) => {
    const value = defaultBasicSkills().find((skill) => skill.id === id)!.media
    const before = structuredClone(value)
    const html = renderToStaticMarkup(
      <SkillMediaEditor
        contentId={id}
        value={value}
        onChange={() => {
          throw new Error('Opening media must not edit content')
        }}
      />,
    )
    expect(html).toContain(`src="${source}"`)
    expect(html).toContain('Current artwork')
    expect(html).toContain('aria-label="Artwork and sound"')
    expect(html).not.toContain('<legend')
    expect(html.match(/<fieldset/g)).toHaveLength(1)
    expect(value).toEqual(before)
  },
)
