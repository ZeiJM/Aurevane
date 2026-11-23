import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const fixture = readFileSync(
  new URL('../../../e2e/fixtures/arsenal-items-harness.jsx', import.meta.url),
  'utf8',
)
const initialState = fixture.slice(
  fixture.indexOf('const original ='),
  fixture.indexOf('const storage ='),
)
const equipment = (search: string) =>
  runInNewContext(`(() => { ${initialState}; return original.equipment })()`, {
    stacks: [],
    location: { search },
    URLSearchParams,
  })

it.each(['', '?shell=items', '?shell=items&evasion', '?shell=nexus'])(
  'preserves ordinary scenario equipment for %s',
  (search) => {
    expect(equipment(search)).toMatchObject({ head: 'owned-wayfarer-hood' })
    expect(equipment(search)['consumable-2']).toBeUndefined()
  },
)

it.each(['items', 'nexus'])(
  'opts only %s name-fit scenarios into long equipment names',
  (shell) => {
    expect(equipment(`?shell=${shell}&longNames`)).toMatchObject({
      head: 'owned-ember-stitched-cowl',
      'consumable-2': 'owned-vulnerability-oil',
    })
  },
)
