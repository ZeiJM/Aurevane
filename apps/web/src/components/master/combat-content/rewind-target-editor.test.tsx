import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SkillEffectEditor } from './skill-effect-editor'
import { previewEffect } from '../../character/skill-effect-preview'
it('offers all five unit targets for Rewind and describes each recipient own position', () => {
  const effect = {
    type: 'return-to-turn-start' as const,
    recipient: 'affected-units' as const,
    target: 'enemy' as const,
    anchorMode: 'cast-position' as const,
  }
  const html = renderToStaticMarkup(
    createElement(SkillEffectEditor, { value: effect, onChange() {} }),
  )
  for (const target of ['self', 'ally', 'enemy', 'anyone', 'all'])
    expect(html).toMatch(new RegExp(`<option value="${target}"(?: selected="")?>`))
  expect(html).not.toContain('Actor only')
  expect(previewEffect(effect).explanation).toContain('own tile')
})
