import 'server-only'
import { CHARTED_SECTORS, FRONTIER_APPROACH } from '@/world/catalog'
import type { WorldObjective, WorldSector } from '@/world/types'

// Private authored content: never imported by a Client Component.
export const SURVEY_SECTOR: WorldSector = {
  id: 'survey-01',
  name: 'Beyond the Last Map',
  coordinate: 'Survey I',
  regionId: 'umbral-march',
  art: null,
  east: 0,
  north: 8,
  charted: false,
  rows: [
    '#############',
    '##...#...#..#',
    '##.#...#....#',
    '##.###.#.#..#',
    '##.....#....#',
    '####.#...#..#',
    '##...#.#....#',
    '##.#...#....#',
    '######.######',
  ],
  landmarks: [
    { id: 'first-observation', name: 'Weathered Observatory', kind: 'anchor', x: 11, y: 1 },
  ],
  roads: [
    {
      from: { sectorId: 'survey-01', x: 6, y: 8 },
      to: FRONTIER_APPROACH,
      durationMs: 1100,
      name: 'Return to the last survey',
    },
  ],
}
export const WORLD_SECTORS = [...CHARTED_SECTORS, SURVEY_SECTOR]
export const WORLD_OBJECTIVES: readonly WorldObjective[] = [
  {
    id: 'eastern-watch',
    name: 'The Eastern Watch',
    description: 'Reach the watchtower across the river.',
    kind: 'quest',
    autoPath: true,
    guidance: 'exact',
    destination: { sectorId: 'verdant-expanse', x: 12, y: 4 },
    completed: false,
  },
  {
    id: 'last-survey',
    name: 'Beyond the last map',
    description: 'Find the last reliable survey in the Umbral March.',
    kind: 'quest',
    autoPath: true,
    guidance: 'exact',
    destination: FRONTIER_APPROACH,
    completed: false,
  },
]
