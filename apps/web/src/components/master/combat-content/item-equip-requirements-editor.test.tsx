import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ItemEquipRequirementsEditor } from './item-equip-requirements-editor'
it('offers optional level, catalogue disciplines and every base Core stat without combat requirements', () => {
  const html = renderToStaticMarkup(
    <ItemEquipRequirementsEditor
      value={{ minimumLevel: 4, disciplineIds: ['custom.flame'], minimumCoreStats: { might: 12 } }}
      disciplines={[{ id: 'custom.flame', name: 'Flame Keeper' }]}
      onChange={() => {}}
    />,
  )
  expect(html).toContain('Minimum level')
  expect(html).toContain('Flame Keeper')
  expect(html).toContain('Base Might')
  expect(html).toContain('Base Resolve')
  expect(html).toContain('value="4"')
  expect(html).toContain('checked=""')
})
