import { describe, expect, it } from 'vitest'

import { describeTerrainLabel } from './battle-inspect-terrain-context'

describe('battle Inspect terrain context', () => {
  it('recognizes elevated ground while preserving its traversal details', () => {
    expect(describeTerrainLabel('Tile 4, 4; open-ground; elevation 1')).toEqual({
      title: 'Elevated ground · Tile 4,4',
      description: 'Entry costs 25 AP · Elevation 1.',
    })
  })

  it('keeps rough and open ground labels unchanged at base elevation', () => {
    expect(describeTerrainLabel('Tile 4, 5; rough-ground; elevation 0')).toEqual({
      title: 'Rough ground · Tile 4,5',
      description: 'Entry costs 50 AP · Elevation 0.',
    })
    expect(describeTerrainLabel('Tile 4, 4; open-ground; elevation 0')).toEqual({
      title: 'Open ground · Tile 4,4',
      description: 'Entry costs 25 AP · Elevation 0.',
    })
  })

  it('keeps rough traversal cost when rough ground is also elevated', () => {
    expect(describeTerrainLabel('Tile 3, 6; rough-ground; elevation 1')).toEqual({
      title: 'Elevated ground · Tile 3,6',
      description: 'Entry costs 50 AP · Elevation 1.',
    })
  })
})
