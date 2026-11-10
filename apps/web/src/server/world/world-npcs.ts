import 'server-only'

import type { PublishedWorldNpc } from '@aurevane/validation/combat/npc-design'
import { resolvePublicCharacterImageUrl } from '@/media/public-character-portrait'
import { readPublishedWorldNpcs } from '@/server/master/npc-design-store'
import { isWalkable } from '@/world/travel'
import type { WorldInteraction, WorldNpcPresentation, WorldState } from '@/world/types'
import { isKnownCell, resolveSector } from './world-content'

const NPC_CACHE_MS = 5_000
const NPC_CACHE_SECTORS = 64
const cache = new Map<string, { expires: number; rows: PublishedWorldNpc[] }>()
const pending = new Map<string, Promise<PublishedWorldNpc[]>>()

export function projectLocalWorldNpcs(state: WorldState, rows: readonly PublishedWorldNpc[]) {
  const npcs: WorldNpcPresentation[] = []
  const interactions: WorldInteraction[] = []
  const sector = resolveSector(state.position.sectorId)
  if (!sector?.charted) return { npcs, interactions }

  for (const row of rows) {
    const position = { sectorId: row.sectorId, x: row.x, y: row.y }
    if (
      row.sectorId !== sector.id ||
      !isWalkable(sector, position) ||
      !isKnownCell(state, position)
    )
      continue
    const imageUrl = resolvePublicCharacterImageUrl(
      row.imageUrl,
      row.portraitRef ?? 'portrait.starter.wayfarer-01',
    )
    npcs.push({ id: row.id, name: row.name, position, imageUrl })
    if (Math.abs(state.position.x - row.x) + Math.abs(state.position.y - row.y) > row.radius)
      continue
    interactions.push({
      id: `npc-greeting:${row.id}`,
      objectiveId: `npc-greeting:${row.id}`,
      speakerId: row.id,
      speaker: row.name,
      title: 'Greeting',
      body: row.greeting,
      ...(imageUrl ? { portraitUrl: imageUrl } : {}),
      actionLabel: null,
      actionId: null,
      progress: 'completed',
    })
    if (row.encounter && state.route.length === 0) {
      interactions.push({
        id: `npc-challenge-${row.id}`,
        objectiveId: `npc-challenge-${row.id}`,
        speakerId: row.id,
        speaker: row.name,
        title: 'Challenge',
        body: row.greeting,
        ...(imageUrl ? { portraitUrl: imageUrl } : {}),
        actionLabel: 'Start battle',
        actionId: 'challenge-npc',
        progress: 'available',
      })
    }
  }
  return { npcs, interactions }
}

export function resetWorldNpcReadCache() {
  cache.clear()
  pending.clear()
}

function cachedNpcRows(sectorId: string) {
  const stored = cache.get(sectorId)
  return stored && stored.expires > Date.now() ? stored.rows : undefined
}

/** Compact movement acknowledgements never wait for NPC data. */
export function peekWorldNpcs(state: WorldState) {
  const rows = cachedNpcRows(state.position.sectorId)
  return rows ? projectLocalWorldNpcs(state, rows) : undefined
}

export async function loadWorldNpcs(state: WorldState) {
  const sectorId = state.position.sectorId
  if (!resolveSector(sectorId)?.charted) return projectLocalWorldNpcs(state, [])
  let rows = cachedNpcRows(sectorId)
  if (!rows) {
    let lookup = pending.get(sectorId)
    if (!lookup && pending.size < NPC_CACHE_SECTORS) {
      lookup = readPublishedWorldNpcs(sectorId)
        .then((received) => {
          cache.delete(sectorId)
          cache.set(sectorId, { expires: Date.now() + NPC_CACHE_MS, rows: received })
          if (cache.size > NPC_CACHE_SECTORS) cache.delete(cache.keys().next().value!)
          return received
        })
        .catch(() => [])
        .finally(() => pending.delete(sectorId))
      pending.set(sectorId, lookup)
    }
    rows = await (lookup ?? [])
  }
  return projectLocalWorldNpcs(state, rows)
}
