import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { SkillGroundEditor, groundAreaForEffects } from './skill-ground-editor'

describe('Master persistent Ground controls', () => {
  it('edits duration, timing and only registered animations', () => {
    const skill = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    const html = renderToStaticMarkup(
      createElement(SkillGroundEditor, {
        target: skill.target,
        effects: skill.effects,
        value: skill.groundArea,
        onChange: vi.fn(),
      }),
    )
    expect(html).toContain('aria-label="Ground duration (rounds)"')
    expect(html).toContain('value="3"')
    expect(html).toContain('aria-label="Ground animation"')
    expect(html).toContain('Embers')
    expect(html).toContain('Frost')
    expect(html).toContain('Arcane pulse')
    expect(html).toContain('aria-label="Ground activation"')
    expect(html).not.toContain('textarea')
  })
  it('keeps a registered preset while synchronizing only legal entry payloads', () => {
    const skill = resolveMatureSkillVersion('frostweaver.chilling-mist')!
    expect(groundAreaForEffects(skill.effects, skill.groundArea)).toMatchObject({
      durationRounds: 2,
      visualPresetId: 'frost',
      entryEffectOrdinals: [1, 2],
    })
    expect(
      groundAreaForEffects([{ type: 'healing', recipient: 'actor', amount: 1 }], skill.groundArea),
    ).toBeUndefined()
  })
  it('offers no persistent entries for unit targeting or pure terrain', () => {
    const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
    expect(
      renderToStaticMarkup(
        createElement(SkillGroundEditor, {
          target: skill.target,
          effects: skill.effects,
          onChange: vi.fn(),
        }),
      ),
    ).toBe('')
    expect(
      groundAreaForEffects([
        { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' },
      ]),
    ).toBeUndefined()
  })
})
