import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CombatEffectTimingEditor } from './combat-effect-timing-editor'
it('offers compatible Controlled timing without exposed policy numbers or a reason form', () => {
  const markup = renderToStaticMarkup(
    createElement(CombatEffectTimingEditor, { initialPolicy: { version: 1, modes: {} } }),
  )
  expect(markup).toContain('HP recovery')
  expect(markup).toContain('MP drain')
  expect(markup).toContain('Normal')
  expect(markup).toContain('timing-push')
  expect(markup).toContain('timing-pull')
  expect(markup).toMatch(/id="timing-blindside"[^]*?<option value="instant" selected="">Instant/)
  expect(markup).not.toContain('timing-displace')
  expect(markup).not.toContain('Reason for this change')
  expect(markup).not.toContain('policy v1')
  expect(markup).toContain('value="controlled"')
  expect(markup).toContain('Save Changes')
  expect(markup).toContain('Existing battles retain their saved rules')
})

it('shows saved compatible Controlled choices while disabling unsupported release targeting', () => {
  const markup = renderToStaticMarkup(
    createElement(CombatEffectTimingEditor, {
      initialPolicy: {
        version: 12,
        modes: { slow: 'controlled', 'return-to-turn-start': 'controlled' },
      },
    }),
  )
  expect(markup).toMatch(/id="timing-slow"[^]*?<option value="controlled" selected="">Controlled/)
  expect(markup).toMatch(
    /id="timing-return-to-turn-start"[^]*?<option value="controlled" selected="">Controlled/,
  )
  expect(markup).toMatch(/id="timing-summon"[^]*?<option value="controlled" disabled="">Controlled/)
  expect(markup).toContain('dedicated release targeting')
  expect(markup).not.toContain('policy v12')
  expect(markup).not.toContain('textarea')
  expect(markup).toContain('<button type="submit">Save Changes</button>')
})

it('exposes compact search, filter, bidirectional display sort and actual Used by', () => {
  const markup = renderToStaticMarkup(
    <CombatEffectTimingEditor
      initialPolicy={{ version: 8, modes: {} }}
      usedBy={{ damage: [{ contentKey: 'unarmed.basic', name: 'Basic Attack' }] }}
    />,
  )
  for (const text of [
    'Search effect tags',
    'Filter timing',
    'Sort effect tags',
    'Name A–Z',
    'Name Z–A',
    'Timing first–last',
    'Timing last–first',
    'Used by',
    'Basic Attack',
  ])
    expect(markup).toContain(text)
})

it('puts affected definition names in labelled dialogs without raw identifiers', () => {
  const html = renderToStaticMarkup(
    <CombatEffectTimingEditor
      initialPolicy={{ version: 8, modes: {} }}
      usedBy={{ damage: [{ contentKey: 'unarmed.basic', name: 'Basic Attack' }] }}
    />,
  )
  expect(html).toContain('aria-haspopup="dialog"')
  expect(html).toContain('<dialog')
  expect(html).toContain('Direct damage definitions')
  expect(html).toContain('Basic Attack')
  expect(html).not.toContain('unarmed.basic')
  expect(html).not.toContain('<summary>1 current definitions')
})
