import { describe, expect, it } from 'vitest'

import { describeTerrainLabel } from './battle-inspect-terrain-context'

describe('battle Inspect terrain context', () => {
  it('recognizes elevated ground while preserving its traversal details', () => {
    expect(describeTerrainLabel('Tile 4, 4; open-ground; elevation 1')).toEqual({
      title: 'Elevated ground · Tile 4,4',
      description: 'Entry costs 20 AP · Elevation 1.',
    })
  })

  it('keeps rough and open ground labels unchanged at base elevation', () => {
    expect(describeTerrainLabel('Tile 4, 5; rough-ground; elevation 0')).toEqual({
      title: 'Rough ground · Tile 4,5',
      description: 'Entry costs 40 AP · Elevation 0.',
    })
    expect(describeTerrainLabel('Tile 4, 4; open-ground; elevation 0')).toEqual({
      title: 'Open ground · Tile 4,4',
      description: 'Entry costs 20 AP · Elevation 0.',
    })
  })

  it('keeps rough traversal cost when rough ground is also elevated', () => {
    expect(describeTerrainLabel('Tile 3, 6; rough-ground; elevation 1')).toEqual({
      title: 'Elevated ground · Tile 3,6',
      description: 'Entry costs 40 AP · Elevation 1.',
    })
  })
})

it('includes temporary terrain duration and both-team rules in empty tile Inspect', () => {
  const frozen = describeTerrainLabel(
    'Tile 4, 4; open-ground; elevation 0; Frozen terrain; 2 round boundaries remaining; Adds 10 AP per entered tile for either team. Airborne ignores this surcharge; Movement allowance is unchanged.',
  )!
  expect(frozen.description).toContain('Frozen terrain')
  expect(frozen.description).toContain('2 round boundaries remaining')
  expect(frozen.description).toContain('Airborne')
  const steam = describeTerrainLabel(
    'Tile 4, 4; rough-ground; elevation 0; Steam terrain; 1 round boundary remaining; Blocks line of sight through this tile for either team. Preserves base terrain.',
  )!
  expect(steam.description).toContain('Steam terrain')
  expect(steam.description).toContain('Blocks line of sight')
})
