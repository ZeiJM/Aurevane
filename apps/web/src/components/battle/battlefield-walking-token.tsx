import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { positionKey, type BattleFacing, type BattleGridPosition } from './battle-geometry'
import { BattlefieldAppearanceToken } from './battlefield-appearance-token'
import type { BattlefieldWalk } from './battlefield-walks'

const WALK_STEP_MS = 165
type WalkPlayback = {
  path: readonly BattleGridPosition[]
  startTime: number
  finished?: boolean
}
// A second confirmed Move can reparent the token while its first route is still playing.
// Keep that route's clock without tying it to the departing tile's element.
const playingWalks = new WeakMap<readonly BattleGridPosition[], WalkPlayback>()

interface BattlefieldWalkingTokenProps extends ComponentProps<'span'> {
  children?: ReactNode
  appearance: ComponentProps<typeof BattlefieldAppearanceToken>
  walk?: BattlefieldWalk
}

function center(tile: HTMLElement): BattleGridPosition {
  return {
    x: tile.offsetLeft + tile.offsetWidth / 2,
    y: tile.offsetTop + tile.offsetHeight / 2,
  }
}

function stepFacing(from: BattleGridPosition, to: BattleGridPosition): BattleFacing {
  if (from.x !== to.x) return to.x > from.x ? 'east' : 'west'
  return to.y > from.y ? 'south' : 'north'
}

export function BattlefieldWalkingToken({
  appearance,
  walk,
  children,
  ...tokenProps
}: BattlefieldWalkingTokenProps) {
  const tokenRef = useRef<HTMLSpanElement>(null)
  const [walkingFacing, setWalkingFacing] = useState<BattleFacing | null>(null)
  const defeated = appearance.defeated

  useLayoutEffect(() => {
    const token = tokenRef.current
    const tile = token?.parentElement
    const board = tile?.parentElement
    if (!walk || !token || !tile || !board || defeated) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    const now = performance.now()
    const previous = walk.previousPath ? playingWalks.get(walk.previousPath) : undefined
    const completed = previous ? Math.floor((now - previous.startTime) / WALK_STEP_MS) : 0
    const playback =
      playingWalks.get(walk.path) ??
      (previous && !previous.finished && completed < previous.path.length - 1
        ? {
            path: [...previous.path.slice(completed), ...walk.path.slice(1)],
            startTime: previous.startTime + completed * WALK_STEP_MS,
          }
        : { path: walk.path, startTime: now })
    if (playback.finished) return
    playingWalks.set(walk.path, playback)
    const { path, startTime } = playback
    const tiles = path.map((point) =>
      board.querySelector<HTMLElement>(`[data-battle-tile="${positionKey(point)}"]`),
    )
    if (tiles.some((step) => !step)) return
    const indicator = tile.querySelector<HTMLElement>(':scope > [data-battle-facing-indicator]')

    let centers = tiles.map((step) => center(step!))
    let destination = center(tile)
    const resize = new ResizeObserver(() => {
      centers = tiles.map((step) => center(step!))
      destination = center(tile)
    })
    resize.observe(board)
    let frame = 0
    let facing: BattleFacing | null = null
    const stop = () => {
      window.cancelAnimationFrame(frame)
      token.style.removeProperty('translate')
      token.removeAttribute('data-battle-token-walking')
      indicator?.style.removeProperty('translate')
      resize.disconnect()
      preference.removeEventListener('change', finish)
      if (facing !== null) {
        facing = null
        setWalkingFacing(null)
      }
    }
    const finish = () => {
      playback.finished = true
      stop()
    }
    const draw = (now: number) => {
      const position = Math.max(0, now - startTime) / WALK_STEP_MS
      const segment = Math.floor(position)
      if (segment >= centers.length - 1) {
        finish()
        return
      }
      const from = centers[segment]!
      const to = centers[segment + 1]!
      const fraction = position - segment
      const x = from.x + (to.x - from.x) * fraction - destination.x
      const y = from.y + (to.y - from.y) * fraction - destination.y
      const offset = `${x}px ${y}px`
      token.style.translate = offset
      if (indicator) indicator.style.translate = offset
      const nextFacing = stepFacing(path[segment]!, path[segment + 1]!)
      if (facing !== nextFacing) {
        facing = nextFacing
        setWalkingFacing(facing)
      }
      frame = window.requestAnimationFrame(draw)
    }
    preference.addEventListener('change', finish)
    token.setAttribute('data-battle-token-walking', 'true')
    draw(now)
    return stop
  }, [defeated, walk])

  return (
    <span {...tokenProps} ref={tokenRef}>
      <BattlefieldAppearanceToken
        {...appearance}
        facing={walkingFacing ?? appearance.facing}
        walking={walkingFacing !== null}
      />
      {children}
    </span>
  )
}
