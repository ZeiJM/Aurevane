import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { useState } from 'react'
import { positionsEqual, type BattleGridPosition } from './battle-geometry'

export interface BattlefieldWalk {
  path: readonly BattleGridPosition[]
  previousPath?: readonly BattleGridPosition[]
}

type BattlefieldWalks = ReadonlyMap<string, BattlefieldWalk>

export function confirmedBattlefieldWalks(
  previous: BattleSessionView,
  current: BattleSessionView,
  active: BattlefieldWalks,
): BattlefieldWalks {
  const walks = new Map<string, BattlefieldWalk>()
  if (
    previous.battleSessionId !== current.battleSessionId ||
    previous.battleVersion >= current.battleVersion
  )
    return walks

  const before = new Map(
    previous.snapshot.tactical.placements.map(({ combatantId, position }) => [
      combatantId,
      position,
    ]),
  )
  const routes = current.snapshot.recentWalks ?? []
  for (const { combatantId, position } of current.snapshot.tactical.placements) {
    const origin = before.get(combatantId)
    if (!origin) continue
    const earlier = active.get(combatantId)
    if (earlier && positionsEqual(origin, position)) walks.set(combatantId, earlier)

    const path = [origin]
    for (const route of routes) {
      if (
        route.combatantId !== combatantId ||
        route.version <= previous.battleVersion ||
        route.version > current.battleVersion
      )
        continue
      const nextOrigin = route.path[0]
      if (!nextOrigin || !positionsEqual(path.at(-1)!, nextOrigin)) {
        path.length = 0
        break
      }
      path.push(...route.path.slice(1))
    }
    if (path.length > 1 && positionsEqual(path.at(-1)!, position))
      walks.set(combatantId, { path, previousPath: earlier?.path })
  }
  return walks
}

/** Keep an ongoing walk through unrelated battle versions and ignore first-load history. */
export function useBattlefieldWalks(battle: BattleSessionView): BattlefieldWalks {
  const [last, setLast] = useState<{ battle: BattleSessionView; walks: BattlefieldWalks }>(() => ({
    battle,
    walks: new Map<string, BattlefieldWalk>(),
  }))
  if (
    last.battle.battleSessionId === battle.battleSessionId &&
    last.battle.battleVersion === battle.battleVersion
  )
    return last.walks
  const walks = confirmedBattlefieldWalks(last.battle, battle, last.walks)
  setLast({ battle, walks })
  return walks
}
