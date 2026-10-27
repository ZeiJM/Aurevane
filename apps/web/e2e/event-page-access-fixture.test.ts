import { expect, it } from 'vitest'
import { createEventPageAccessFixture } from './event-page-access-fixture'
it('refuses an existing enabled Owner before reading defaults or issuing mutations', () => {
  const seen: string[] = []
  expect(() =>
    createEventPageAccessFixture((text) => {
      seen.push(text)
      return text.startsWith('select count(*)') ? '1' : '["events"]'
    }),
  ).toThrow(/no enabled Owner/)
  expect(seen).toHaveLength(1)
})
it('does not attempt restoration when setup never acquired its temporary grant', () => {
  let writes = 0
  const fixture = createEventPageAccessFixture((text) => {
    if (text.startsWith('begin;')) {
      writes++
      throw new Error('EVENT_FIXTURE_EXISTING_OWNER')
    }
    return text.startsWith('select count(*)') ? '0' : '[\"events\"]'
  })
  expect(() => fixture.set(false)).toThrow('EVENT_FIXTURE_EXISTING_OWNER')
  fixture.restore()
  expect(writes).toBe(1)
})
