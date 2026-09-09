import { describe, expect, it } from 'vitest'

import { retractProjectedPath } from './battle-geometry'

describe('retractProjectedPath', () => {
  const path = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ] as const

  it('retracts to an earlier projected tile without committing movement', () => {
    expect(retractProjectedPath(path, { x: 1, y: 1 })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
  })

  it('retracts all the way to zero projected movement at the committed origin', () => {
    expect(retractProjectedPath(path, { x: 0, y: 1 })).toEqual([])
  })

  it('does not treat the current projected tip or an unrelated tile as retraction', () => {
    expect(retractProjectedPath(path, { x: 3, y: 1 })).toBeNull()
    expect(retractProjectedPath(path, { x: 4, y: 1 })).toBeNull()
  })
})
