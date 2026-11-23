import { expect, it } from 'vitest'
import { readableContentReference } from './content-reference-label'
it('uses current programmed Discipline names and never turns missing custom IDs into prose', () => {
  const id = 'discipline.f60c5dc7-abf2-4e03-8b10-428dee7fc4c2'
  expect(
    readableContentReference(id, [
      { contentKey: id, contentKind: 'discipline', name: 'Super Saiyan' },
    ]),
  ).toBe('Super Saiyan')
  expect(readableContentReference(id, [])).toBe('Unavailable Discipline')
})
