import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorldAtlasCell, WorldView } from '@/world/types'
import type { SphericalView } from './spherical-view'

const capture = vi.hoisted(() => ({
  sphere: undefined as ComponentProps<typeof SphericalView> | undefined,
}))
vi.mock('./spherical-view', () => ({
  SphericalView: (props: ComponentProps<typeof SphericalView>) => {
    capture.sphere = props
    return createElement('div', null, props.children)
  },
}))
import { WorldGlobe } from './world-globe'
import { globeSectorCenter } from '@/world/globe-math'
import { resolveWorldEnvironment } from '@/world/environment'

function atlasCell(column: number, row: number, name: string): WorldAtlasCell {
  const id = `atlas:${column}:${row}`
  return {
    id,
    name,
    coordinate: `S${String(column + 1).padStart(2, '0')}-${String(row + 1).padStart(2, '0')}`,
    regionId: 'aureth-crown',
    column,
    row,
    charted: true,
    townId: id,
  }
}
function viewFor(atlas: WorldAtlasCell[]): WorldView {
  const current = atlas[0]!
  return {
    characterId: 'traveller',
    serverNow: 1000,
    version: 1,
    position: { sectorId: current.id, x: 6, y: 4 },
    route: [],
    nextStepAt: null,
    sectors: [
      {
        ...current,
        atlasColumn: current.column,
        atlasRow: current.row,
        art: null,
        east: 0,
        north: 0,
        cells: [],
        exits: [],
        landmarks: [],
      },
    ],
    atlas,
    players: [],
    objectives: [],
    interactions: [],
    anchors: [],
    archive: [],
    battleSessionId: null,
    movementBlocked: null,
    environment: resolveWorldEnvironment(1000),
  }
}
function render(view: WorldView, onSelect = vi.fn()) {
  return renderToStaticMarkup(
    createElement(WorldGlobe, {
      view,
      selected: null,
      onSelect,
      zoom: 0.94,
      zoomLocked: false,
      onZoom: vi.fn(),
    }),
  )
}

beforeEach(() => {
  capture.sphere = undefined
})

describe('globe geographic labels', () => {
  it('uses stable sector numbers in both pickers, ordered by geographic row', () => {
    const south = atlasCell(0, 2, 'South town')
    const north = atlasCell(85, 1, 'North town')
    const view = viewFor([south, north])
    const markup = render(view)
    expect(markup).toContain('Sector214 · North town')
    expect(markup).toContain('North town · Sector214')
    expect(markup).toContain('Sector257 · South town')
    expect(markup).not.toContain('S86-02')
    expect(markup.indexOf('Sector214 · North town')).toBeLessThan(
      markup.indexOf('Sector257 · South town'),
    )
    expect(render(viewFor([north]))).toContain('Sector214 · North town')
    expect(view.atlas).toEqual([south, north])
  })
  it('retains raw globe coordinates and persisted sector IDs for location selection', () => {
    const cell = atlasCell(85, 1, 'North town')
    const view = viewFor([cell])
    const onSelect = vi.fn()
    render(view, onSelect)
    expect(capture.sphere?.atlas?.[0]).toEqual(cell)
    capture.sphere?.onActivate?.(globeSectorCenter(cell.coordinate, 128, 64)!)
    expect(onSelect).toHaveBeenLastCalledWith(cell.id)
    expect(view.position).toEqual({ sectorId: cell.id, x: 6, y: 4 })
    capture.sphere?.onActivate?.(globeSectorCenter('S01-01', 128, 64)!)
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })
  it('does not add private Void destinations to the charted pickers', () => {
    const privateCell = {
      ...atlasCell(21, 6, 'Unknown Void'),
      id: 'void:ivory-veil:21:6',
      charted: false,
    }
    const markup = render(viewFor([atlasCell(85, 1, 'North town'), privateCell]))
    expect(markup).not.toContain('Unknown Void')
    expect(markup).not.toContain('void:ivory-veil')
  })
})
