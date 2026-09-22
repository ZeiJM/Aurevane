import 'server-only'
import { createHash } from 'node:crypto'
import { CHARTED_SECTORS } from '@/world/catalog'
import { isWalkable, validCell } from '@/world/travel'
import type { WorldObjective } from '@/world/types'
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
/** Accept only public navigation fields from live production phases; never forward definitions. */
export function eventWorldObjectives(rows: unknown): WorldObjective[] {
  if (!Array.isArray(rows)) return []
  return rows
    .flatMap((row) => {
      if (
        !record(row) ||
        !record(row.navigation) ||
        typeof row.runId !== 'string' ||
        typeof row.objectiveId !== 'string' ||
        typeof row.title !== 'string' ||
        typeof row.phaseName !== 'string'
      )
        return []
      const n = row.navigation
      const sector = CHARTED_SECTORS.find((s) => s.id === n.sectorId)
      if (
        !sector ||
        typeof n.x !== 'number' ||
        typeof n.y !== 'number' ||
        !validCell({ x: n.x, y: n.y }) ||
        !isWalkable(sector, { x: n.x, y: n.y }) ||
        typeof n.autoPath !== 'boolean' ||
        !['exact', 'clue'].includes(String(n.guidance))
      )
        return []
      return [
        {
          id: `event-${createHash('sha256').update(`${row.runId}:${row.objectiveId}`).digest('hex').slice(0, 32)}`,
          name: row.title.slice(0, 120),
          description: row.phaseName.slice(0, 100),
          kind: 'event' as const,
          autoPath: n.autoPath,
          guidance: n.guidance as 'exact' | 'clue',
          destination: { sectorId: sector.id, x: n.x, y: n.y },
          completed: false,
        },
      ]
    })
    .slice(0, 48)
}
