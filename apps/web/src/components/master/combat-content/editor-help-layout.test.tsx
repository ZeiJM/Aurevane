import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityEffectEditor } from './ability-effect-editor'
import { EffectTagPicker } from './effect-tag-picker'

function headerContainsHelp(html: string, text: string, help: string) {
  // The visible label and its help trigger share a header, above the control.
  expect(html).toMatch(
    new RegExp(
      `<div[^>]*>[^<]*<label[^>]*>${text}</label>[\\s\\S]*?aria-label="About ${help}"[\\s\\S]*?</div><(?:input|select)`,
    ),
  )
  // Interactive help must not be nested inside a label that activates the input.
  expect(html).not.toMatch(/<label[^>]*>(?:(?!<\/label>)[\s\S])*<button/)
}
it('keeps Accuracy guidance beside the label rather than in a separate grid cell', () => {
  const value = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor value={value} onChange={() => {}} section="accuracy" />,
  )
  headerContainsHelp(html, 'Accuracy rule', 'Accuracy availability')
})
it('keeps Move controls compact without duplicated help', () => {
  const html = renderToStaticMarkup(
    <AbilityEffectEditor
      value={{ id: 'move', payload: { type: 'move', recipient: 'actor', maximumTiles: 15 } }}
      onChange={() => {}}
    />,
  )
  expect(html).not.toContain('aria-label="About Move"')
  expect(html).not.toContain('aria-label="About Destination"')
  expect(html).toMatch(/aria-label="Destination"[^>]*disabled/)
  expect(html).toMatch(/aria-label="Move maximum tiles"[^>]*value="15"/)
})
it('keeps the selected tag help beside New effect without an extra picker row', () => {
  const html = renderToStaticMarkup(<EffectTagPicker label="New effect" onAdd={() => {}} />)
  headerContainsHelp(html, 'New effect', 'Damage')
  expect(html).toContain('aria-label="Search effect tags"')
  expect(html).toContain('Add effect')
})
