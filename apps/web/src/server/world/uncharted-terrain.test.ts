import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState } from '@/world/travel'
import { decodeTerrainRows } from '@/world/terrain'
import { VOID_REALMS } from '@/world/void-realms'
import { voidRealmLanding } from './void-realms'
import * as content from './world-content'
import { applyWarpedContinentPhase } from './warped-continent'
import { projectUnchartedTerrain } from './uncharted-terrain'

it('does not generate sectors outside the projected entered-world viewport', () => {
  const state = { ...newWorldState(), position: { sectorId: 'void:ivory-veil:32:24', x: 6, y: 4 } }
  const resolve = vi.spyOn(content, 'resolveSector')
  try {
    const buffer = projectUnchartedTerrain(state)!
    const supplied = new Set(buffer.map((chunk) => chunk[0]))
    expect(buffer.length).toBeGreaterThan(25)
    expect(resolve.mock.calls.every(([id]) => supplied.has(id))).toBe(true)
    expect(resolve.mock.calls.length).toBeLessThanOrEqual(buffer.length + 1)
  } finally {
    resolve.mockRestore()
  }
})

it.each(VOID_REALMS.map((realm) => realm.id))(
  'preserves %s terrain and never includes private location identities',
  (realmId) => {
    const state = { ...newWorldState(), position: voidRealmLanding(realmId) }
    const saved = structuredClone(state)
    const buffer = projectUnchartedTerrain(state)!
    const encoded = JSON.stringify(buffer)
    expect(buffer.length).toBeLessThanOrEqual(512)
    for (const chunk of buffer) {
      const canonical = content.resolveSector(chunk[0])!
      expect(decodeTerrainRows(chunk[1], 117)).toBe(canonical.rows.join(''))
      for (const landmark of canonical.landmarks) expect(encoded).not.toContain(landmark.name)
      expect(chunk[0]).toMatch(new RegExp(`^void:${realmId}:`))
    }
    expect(state).toEqual(saved)
  },
)

it('keeps legacy phase presentation separate from immutable geography and exploration history', () => {
  const state = {
    ...newWorldState(),
    position: { sectorId: 'uncharted-tarn', x: 6, y: 4 },
    warpedPhase: 7,
  }
  const buffer = projectUnchartedTerrain(state)!
  for (const chunk of buffer) {
    const canonical = applyWarpedContinentPhase(state, content.resolveSector(chunk[0])!)
    expect(decodeTerrainRows(chunk[1], 117)).toBe(canonical.rows.join(''))
    expect(chunk[5]).toBe(canonical.warpedTheme)
  }
  expect(projectUnchartedTerrain(newWorldState())).toBeUndefined()
  expect(
    projectUnchartedTerrain({ ...state, position: { sectorId: 'survey-01', x: 6, y: 8 } }),
  ).toBeUndefined()
})
