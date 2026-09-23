import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('World sector render performance', () => {
  it('indexes sector cells once instead of linearly searching for every grid button', () => {
    const map = source('src/components/world/sector-map.tsx')

    expect(map).toContain('new Map(sector.cells.map')
    expect(map).toContain('cellByIndex.get(index)')
    expect(map).not.toContain('sector.cells.find(')
  })
})
