import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CombatEffectTimingEditor } from './combat-effect-timing-editor'
it('keeps timing and definition links while description editing lives only in Tag Library', () => {
  const html = renderToStaticMarkup(
    <CombatEffectTimingEditor initialPolicy={{ version: 1, modes: {} }} />,
  )
  expect(html).not.toContain('Edit descriptions')
  expect(html).not.toContain('<th scope="col">Description</th>')
  expect(html).not.toContain('uncommitted description')
  expect(html).toContain('Tag Library')
  expect(html).toContain('Timed buffs use this timing')
})
it('normalizes the retained stock Blindside label without overriding custom wording', () => {
  for (const [name, expected] of [
    ['Blindside (debuff)', 'Blindside'],
    ['Flanked', 'Flanked'],
  ]) {
    const html = renderToStaticMarkup(
      <CombatEffectTimingEditor
        initialPolicy={{ version: 1, modes: {} }}
        tagPresentations={[{ tagId: 'blindside-vulnerability', name } as never]}
      />,
    )
    expect(html).toContain(`>${expected}</label>`)
    expect(html).not.toContain('Blindside (debuff)')
  }
})
it('offers compatible Controlled timing without exposed policy numbers or a reason form', () => {
  const markup = renderToStaticMarkup(
    createElement(CombatEffectTimingEditor, { initialPolicy: { version: 1, modes: {} } }),
  )
  expect(markup).toContain('HP Recovery')
  expect(markup).toContain('MP Drain')
  expect(markup).toContain('Normal')
  expect(markup).toContain('timing-push')
  expect(markup).toContain('timing-pull')
  expect(markup).toMatch(
    /id="timing-blindside-blindside-vulnerability"[^]*?<option value="instant" selected="">Instant/,
  )
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
  expect(html).toContain('Damage definitions')
  expect(html).toContain('Basic Attack')
  expect(html.replace(/<[^>]*>/g, '')).not.toContain('unarmed.basic')
  expect(html).not.toContain('<summary>1 current definitions')
})

it('links affected definitions directly to their effect editor while preserving the rules tab', () => {
  const html = renderToStaticMarkup(
    <CombatEffectTimingEditor
      initialPolicy={{ version: 1, modes: {} }}
      usedBy={{ damage: [{ contentKey: 'custom.skill-1', name: 'Custom Skill' }] }}
    />,
  )
  expect(html).toContain('href="/master/combat-content?contentKey=custom.skill-1&amp;tab=effects"')
  expect(html).toContain('target="_blank"')
})
