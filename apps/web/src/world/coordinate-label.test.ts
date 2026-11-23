import { mainlandSectorAtNumber, mainlandSectorCount, mainlandSectorNumber } from './sector-index'
import { FERRY_ASTERWAKE_DOCK } from './ferry'
import { describe, expect, it } from 'vitest'
import { positionLabel, sectorLabel } from './coordinate-label'

const publicSector = (column: number, row: number) => ({
  id: `atlas:${column}:${row}`,
  coordinate: `S${String(column + 1).padStart(2, '0')}-${String(row + 1).padStart(2, '0')}`,
  charted: true,
  atlasColumn: column,
  atlasRow: row,
})

describe('geographic sector display aliases', () => {
  it('starts numbering on the familiar mainland and reserves higher numbers for outlying land', () => {
    const first = mainlandSectorAtNumber(1)!
    expect(sectorLabel(first)).toBe('Sector 1')
    expect(sectorLabel(publicSector(0, 0))).toBe('Sector ?')
    expect(sectorLabel(publicSector(127, 63))).toBe('Sector ?')
    const contiguous = mainlandSectorNumber(58, 28)!
    expect(mainlandSectorNumber(59, 28)).toBe(contiguous + 1)
    const asterwake = mainlandSectorNumber(4, 15)!
    expect(asterwake).toBeGreaterThan(contiguous)
    expect(mainlandSectorAtNumber(asterwake)?.id).toBe(FERRY_ASTERWAKE_DOCK.sectorId)
    expect(mainlandSectorAtNumber(mainlandSectorCount() + 1)).toBeUndefined()
  })
  it('keeps labels stable when loaded sectors are filtered or reordered', () => {
    const west = publicSector(58, 28)
    const east = publicSector(59, 28)
    expect([west, east].map(sectorLabel)).toEqual(['Sector 817', 'Sector 818'])
    expect([east].map(sectorLabel)).toEqual(['Sector 818'])
    expect([east, west].map(sectorLabel)).toEqual(['Sector 818', 'Sector 817'])
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
    expect(sectorLabel(picker)).toBe('Sector 817')
    expect(sectorLabel(legacy)).toBe('Sector 817')
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
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector 817 · X:6 · Y:4')
    expect(positionLabel(sector, { x: 7, y: 3 })).toBe('Sector 817 · X:7 · Y:3')
  })
  it('numbers the new private Void grid locally while masking X/Y regardless of charted metadata', () => {
    const sector = {
      id: 'void:ivory-veil:21:6',
      coordinate: 'Beyond the charts',
      charted: false,
      sceneColumn: 21,
      sceneRow: 6,
    }
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector 8598 · X:? · Y:?')
    expect(positionLabel({ ...sector, charted: true }, { x: 12, y: 8 })).toBe(
      'Sector 8598 · X:? · Y:?',
    )
  })
  it('numbers the preserved legacy landing on the expanded geographic grid and masks its positions', () => {
    const sector = {
      id: 'uncharted-landing',
      coordinate: 'Beyond the charts',
      charted: false,
      sceneColumn: 1,
      sceneRow: 1,
      warpedTheme: 'haven' as const,
    }
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector 8258 · X:? · Y:?')
    expect(sectorLabel({ ...sector, id: 'uncharted-pale', sceneColumn: 3, sceneRow: 0 })).toBe(
      'Sector 8196',
    )
  })
  it('numbers distant private continental addresses while retaining coordinate masking', () => {
    const sector = {
      id: 'uncharted-expanse:60:36',
      coordinate: 'Beyond the charts',
      charted: false,
      sceneColumn: 60,
      sceneRow: 36,
    }
    expect(positionLabel(sector, { x: 6, y: 4 })).toBe('Sector 10557 · X:? · Y:?')
    expect(sectorLabel({ ...sector, sceneColumn: 64 })).toBe('Sector ?')
  })
  it('keeps Void X/Y masked when its current sector projection is temporarily unavailable', () => {
    expect(positionLabel(undefined, { sectorId: 'void:ivory-veil:21:6', x: 6, y: 4 })).toBe(
      'Sector ? · X:? · Y:?',
    )
    expect(positionLabel(undefined, { sectorId: 'uncharted-landing', x: 6, y: 4 })).toBe(
      'Sector ? · X:? · Y:?',
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
      expect(sectorLabel(sector)).toBe('Sector ?')
  })
})
