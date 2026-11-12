import { describe, expect, it } from 'vitest'
import { positionLabel, sectorDisplayNumber, sectorLabel } from './coordinate-label'

const publicSector = (column: number, row: number) => ({
  id: `atlas:${column}:${row}`,
  coordinate: `S${String(column + 1).padStart(2, '0')}-${String(row + 1).padStart(2, '0')}`,
  charted: true,
  atlasColumn: column,
  atlasRow: row,
})

describe('geographic sector display aliases', () => {
  it('numbers the whole atlas west to east, then north to south, including its longitude seam', () => {
    expect(sectorLabel(publicSector(0, 0))).toBe('Sector1')
    expect(sectorLabel(publicSector(127, 0))).toBe('Sector128')
    expect(sectorLabel(publicSector(0, 1))).toBe('Sector129')
    expect(sectorLabel(publicSector(127, 63))).toBe('Sector8192')
    expect(sectorDisplayNumber(publicSector(59, 28))).toBe(
      sectorDisplayNumber(publicSector(58, 28))! + 1,
    )
  })
  it('keeps labels stable when loaded sectors are filtered or reordered', () => {
    const west = publicSector(58, 28)
    const east = publicSector(59, 28)
    expect([west, east].map(sectorLabel)).toEqual(['Sector3643', 'Sector3644'])
    expect([east].map(sectorLabel)).toEqual(['Sector3644'])
    expect([east, west].map(sectorLabel)).toEqual(['Sector3644', 'Sector3643'])
  })
  it('accepts atlas picker addresses and strict public coordinate fallback without changing either', () => {
    const picker = {
      id: 'mainland',
      coordinate: 'S59-29',
      charted: true,
      column: 58,
      row: 28,
    }
    const legacy = { id: 'old-root', coordinate: 'S59-29', charted: true }
    expect(sectorLabel(picker)).toBe('Sector3643')
    expect(sectorLabel(legacy)).toBe('Sector3643')
    expect(picker).toEqual({
      id: 'mainland',
      coordinate: 'S59-29',
      charted: true,
      column: 58,
      row: 28,
    })
  })
  it('shows actual sector-local positions rather than global east/north coordinates', () => {
    const sector = publicSector(58, 28)
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector3643 · X:6 · Y:4')
    expect(positionLabel(sector, { x: 7, y: 3 })).toBe('Sector3643 · X:7 · Y:3')
  })
  it('numbers the new private Void grid locally while masking X/Y regardless of charted metadata', () => {
    const sector = {
      id: 'void:ivory-veil:21:6',
      coordinate: 'Beyond the charts',
      charted: false,
      sceneColumn: 21,
      sceneRow: 6,
    }
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector214 · X:? · Y:?')
    expect(positionLabel({ ...sector, charted: true }, { x: 12, y: 8 })).toBe(
      'Sector214 · X:? · Y:?',
    )
  })
  it('keeps the legacy private Void four-column numbering and masks its positions', () => {
    const sector = {
      id: 'uncharted-landing',
      coordinate: 'Beyond the charts',
      charted: false,
      sceneColumn: 1,
      sceneRow: 1,
      warpedTheme: 'haven' as const,
    }
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector6 · X:? · Y:?')
    expect(sectorLabel({ ...sector, id: 'uncharted-pale', sceneColumn: 3, sceneRow: 0 })).toBe(
      'Sector4',
    )
  })
  it('keeps Void X/Y masked when its current sector projection is temporarily unavailable', () => {
    expect(positionLabel(undefined, { sectorId: 'void:ivory-veil:21:6', x: 6, y: 4 })).toBe(
      'Sector? · X:? · Y:?',
    )
    expect(positionLabel(undefined, { sectorId: 'uncharted-landing', x: 6, y: 4 })).toBe(
      'Sector? · X:? · Y:?',
    )
  })
  it('does not invent atlas numbers from private, ferry, missing or invalid geographic metadata', () => {
    for (const sector of [
      undefined,
      { id: 'sealed-realm:test', coordinate: 'S59-29', charted: false },
      { id: 'ferry:outbound:1794441000000', coordinate: 'At sea', charted: false },
      { id: 'old-trail', coordinate: 'S59-29·T4', charted: true },
      { ...publicSector(128, 0), coordinate: 'S129-01' },
      { ...publicSector(0, -1), coordinate: 'S01-00' },
      { ...publicSector(0.5, 1), coordinate: 'bad' },
    ])
      expect(sectorLabel(sector)).toBe('Sector?')
  })
})
