import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor } from './ability-definition-editor'

it('keeps timing global and does not offer once-per-battle Skill authoring', () => {
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor
      value={defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability}
      onChange={vi.fn()}
    />,
  )
  expect(html).not.toContain('aria-label="Effect timing"')
  expect(html).not.toContain('Once per battle')
  expect(html).toContain('Cooldown (owner turns; 0 means none)')
})
