import { Children, createElement, isValidElement, type ComponentProps } from 'react'
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
function render(
  view: WorldView,
  onSelect = vi.fn(),
  showLocationLabels = true,
  selected: string | null = null,
) {
  return renderToStaticMarkup(
    createElement(WorldGlobe, {
      view,
      selected,
      onSelect,
      zoom: 0.94,
      zoomLocked: false,
      onZoom: vi.fn(),
      showLocationLabels,
    }),
  )
}

beforeEach(() => {
  capture.sphere = undefined
})

describe('globe geographic labels', () => {
  it('cycles globe Travel Point markers through known destinations without moving the character', () => {
    const mainland = atlasCell(126, 32, 'Mainland coast')
    const west = atlasCell(125, 32, 'West approach')
    const north = atlasCell(124, 32, 'North approach')
    const hidden = { ...atlasCell(123, 32, 'Hidden landmark'), charted: false }
    const view = viewFor([mainland, west, north, hidden])
    view.anchors = [
      { id: 'west-anchor', name: 'West Waystone', sectorId: west.id },
      { id: 'north-anchor', name: 'North Waystone', sectorId: north.id },
      { id: 'hidden-anchor', name: 'Secret Waystone', sectorId: hidden.id },
    ]
    const onSelect = vi.fn()
    const markup = render(view, onSelect)
    const markers = Children.toArray(capture.sphere?.children)
      .filter(isValidElement<{ 'data-globe-travel-point'?: string; onClick: () => void }>)
      .filter((child) => child.props['data-globe-travel-point'] !== undefined)
    expect(markers).toHaveLength(3)
    expect(markup).toContain('Travel point: Mainland')
    expect(markup).toContain('Travel point: West Waystone')
    expect(markup).not.toContain('Ferry dock')
    expect(markup).not.toContain('Secret Waystone')
    for (const [index, next] of [west.id, north.id, mainland.id].entries()) {
      markers[index]!.props.onClick()
      expect(onSelect).toHaveBeenLastCalledWith(next)
    }
    expect(view.position).toEqual({ sectorId: mainland.id, x: 6, y: 4 })
    expect(view.route).toEqual([])
    render(view, onSelect, true, west.id)
    const mainlandMarker = Children.toArray(capture.sphere?.children)
      .filter(isValidElement<{ 'data-globe-travel-point'?: string; onClick: () => void }>)
      .find((child) => child.props['data-globe-travel-point'] === mainland.id)
    mainlandMarker!.props.onClick()
    expect(onSelect).toHaveBeenLastCalledWith(north.id)
  })
  it('hides town names while preserving selectable town icons and the current-position pin', () => {
    const view = viewFor([atlasCell(0, 2, 'South town')])
    expect(render(view)).toContain('<span>South town</span>')
    const hidden = render(view, vi.fn(), false)
    expect(hidden).not.toContain('<span>South town</span>')
    expect(hidden).toContain('aria-label="Select South town town"')
    expect(hidden).toContain('data-globe-town')
    expect(hidden).toContain('Your current position')
    expect(hidden).toContain('<span>You are here</span>')
  })
  it('shows named locations on the globe without cluttering the view with duplicate pickers', () => {
    const south = atlasCell(0, 2, 'South town')
    const north = atlasCell(85, 1, 'North town')
    const view = viewFor([south, north])
    const markup = render(view)
    expect(markup).toContain('World Atlas')
    expect(markup).toContain('South town')
    expect(markup).not.toContain('Find a town')
    expect(markup).not.toContain('Known Lands')
    expect(markup).not.toContain('S86-02')
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
  it('names the private landmass as Uncharted Lands without revealing its coordinates', () => {
    const markup = render(viewFor([atlasCell(0, 48, 'South town')]))
    expect(markup).toContain('<span>Uncharted Lands</span>')
    expect(markup).not.toContain('Focus Uncharted Lands')
    expect(markup).not.toMatch(/Uncharted waters/i)
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
