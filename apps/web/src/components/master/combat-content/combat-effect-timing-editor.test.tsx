import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CombatEffectTimingEditor } from './combat-effect-timing-editor'
it('offers explicit timing choices and audited publication for the complete canonical tags', () => {
  const markup = renderToStaticMarkup(
    createElement(CombatEffectTimingEditor, { initialPolicy: { version: 1, modes: {} } }),
  )
  expect(markup).toContain('HP recovery')
  expect(markup).toContain('MP drain')
  expect(markup).toContain('Next global round')
  expect(markup).toContain('Reason for this change')
  expect(markup).toContain('Publish timing policy')
  expect(markup).toContain('Existing battles keep their pinned policy')
})
