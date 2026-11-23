import type { WorldLandmark } from './types'

/**
 * Deterministic terrain for generated World sectors. Pure and client-safe: the same sector id
 * always produces the same ground for every player, and nothing here consumes combat RNG.
 * Legend (shared with authored boards): # trees/blocked, ~ water, . open, = road, s settlement.
 */
const W = 13
const H = 9
const CX = 6

export interface GenArms {
  /** Row of the road leaving the west edge, if that edge is open. */
  w?: number
  /** Row of the road leaving the east edge, if that edge is open. */
  e?: number
  n?: boolean
  s?: boolean
}
export interface GenRiver {
  orient: 'v' | 'h'
  /** Column (v) or row (h) the river follows; wanders at most one tile either side. */
  at: number
  /** Per-line wander, zero at both ends so neighbouring sectors join seamlessly. */
  off: number[]
}
export interface GenOptions {
  id: string
  arms: GenArms
  river?: GenRiver | null
  /** Rows from here down are open sea (a shoreline sector). */
  seaFrom?: number
}

export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
export function seeded(text: string) {
  let a = hashString(text)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A river that runs along a whole lattice line, or null when this line has none. */
export function riverFor(seed: string, orient: 'v' | 'h', chance = 0.34): GenRiver | null {
  const r = seeded(`river:${seed}`)
  if (r() >= chance) return null
  const choices = orient === 'v' ? [2, 3, 9, 10] : [1, 2, 6, 7]
  const at = choices[Math.floor(r() * choices.length)]!
  const length = orient === 'v' ? H : W
  const off: number[] = []
  let drift = 0
  for (let i = 0; i < length; i++) {
    if (i === 0 || i === length - 1) drift = 0
    else if (r() < 0.3) drift = Math.max(-1, Math.min(1, drift + (r() < 0.5 ? -1 : 1)))
    off.push(drift)
  }
  return { orient, at, off }
}

const POI_KINDS: readonly {
  kind: WorldLandmark['kind']
  names: readonly string[]
  weight: number
}[] = [
  {
    kind: 'shrine',
    weight: 3,
    names: [
      'Moonpetal Shrine',
      "Wayfarer's Shrine",
      'Shrine of the Quiet Lantern',
      'Hollow Bell Shrine',
      'Shrine of Small Mercies',
    ],
  },
  {
    kind: 'ruin',
    weight: 3,
    names: [
      'Moss-Gate Ruin',
      'The Fallen Arch',
      'Old Survey Gate',
      'The Sunken Arch',
      'Hollow Gate',
    ],
  },
  {
    kind: 'camp',
    weight: 2,
    names: ["Hermit's Fire", "Drover's Camp", 'Pilgrim Camp', "Cartwright's Rest", 'Embers Camp'],
  },
  {
    kind: 'grove',
    weight: 2,
    names: ['Lantern Glade', 'Firefly Hollow', 'Whispering Grove', 'Glowmoss Glade'],
  },
  {
    kind: 'spring',
    weight: 2,
    names: ['Crystal Spring', 'Mirrorpool', 'Stillwater Spring', "Pilgrim's Basin"],
  },
  {
    kind: 'hamlet',
    weight: 2,
    names: ['Hayward Farmstead', "Millers' Rest", 'Thistledown Farm', 'Brookside Steading'],
  },
  {
    kind: 'waystone',
    weight: 2,
    names: ['Old Waystone', 'Lamplit Waymark', 'Road-Warden Post', 'Crossroads Lantern'],
  },
]

export function generateSectorTerrain({ id, arms, river = null, seaFrom }: GenOptions) {
  const r = seeded(`terrain:${id}`)
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'))
  const path = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`
  const inside = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.sign(x1 - x0),
      dy = Math.sign(y1 - y0)
    let x = x0,
      y = y0
    path.add(key(x, y))
    while (x !== x1 || y !== y1) {
      x += dx
      y += dy
      path.add(key(x, y))
    }
  }
  const westRow = arms.w ?? arms.e ?? 4
  const eastRow = arms.e ?? arms.w ?? 4
  if (arms.w !== undefined) line(0, arms.w, CX, arms.w)
  if (arms.e !== undefined) line(CX, arms.e, W - 1, arms.e)
  if (arms.w !== undefined || arms.e !== undefined) line(CX, westRow, CX, eastRow)
  const top = Math.min(westRow, eastRow),
    bottom = Math.max(westRow, eastRow)
  if (arms.n) line(CX, 0, CX, top)
  if (arms.s) line(CX, H - 1, CX, bottom)
  if (!path.size) line(CX, 4, CX, 4)

  const nearPath = (x: number, y: number, d: number) => {
    for (let yy = y - d; yy <= y + d; yy++)
      for (let xx = x - d; xx <= x + d; xx++) if (path.has(key(xx, yy))) return true
    return false
  }

  // Scattered trees, then denser groves, always leaving the road corridor clear.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (!nearPath(x, y, 1) && r() < 0.2) grid[y]![x] = '#'
  const groves = 5 + Math.floor(r() * 3)
  for (let g = 0; g < groves; g++) {
    const gx = Math.floor(r() * W),
      gy = Math.floor(r() * H),
      radius = 1.6 + r() * 1.6
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (Math.hypot(x - gx, (y - gy) * 1.2) <= radius && !nearPath(x, y, 1) && r() < 0.88)
          grid[y]![x] = '#'
  }

  // A pond on roughly one sector in three that has no river.
  if (!river && seaFrom === undefined && r() < 0.34) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const px = 2 + Math.floor(r() * (W - 4)),
        py = 1 + Math.floor(r() * (H - 2)),
        rx = 1.6 + r() * 1.2,
        ry = 1 + r() * 0.6
      const tiles: [number, number][] = []
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (Math.hypot((x - px) / rx, (y - py) / ry) <= 1) tiles.push([x, y])
      if (tiles.length < 3 || tiles.some(([x, y]) => nearPath(x, y, 2))) continue
      tiles.forEach(([x, y]) => (grid[y]![x] = '~'))
      break
    }
  }

  if (river) {
    if (river.orient === 'v')
      for (let y = 0; y < H; y++) {
        const x = river.at + (river.off[y] ?? 0)
        if (inside(x, y)) grid[y]![x] = '~'
      }
    else
      for (let x = 0; x < W; x++) {
        const y = river.at + (river.off[x] ?? 0)
        if (inside(x, y)) grid[y]![x] = '~'
      }
  }
  if (seaFrom !== undefined)
    for (let y = seaFrom; y < H; y++) for (let x = 0; x < W; x++) grid[y]![x] = '~'

  // The road always wins: where it meets water it becomes a bridge.
  path.forEach((k) => {
    const [x, y] = k.split(',').map(Number) as [number, number]
    grid[y]![x] = '='
  })

  // Points of interest: one or two per sector, each reachable by a short carved trail.
  const landmarks: WorldLandmark[] = []
  const wanted = r() < 0.55 ? 2 : 1
  const total = POI_KINDS.reduce((sum, k) => sum + k.weight, 0)
  const pickKind = () => {
    let roll = r() * total
    for (const k of POI_KINDS) if ((roll -= k.weight) < 0) return k
    return POI_KINDS[0]!
  }
  const carve = (sx: number, sy: number) => {
    // Breadth-first walk through anything but water to the nearest road tile.
    const seen = new Map<string, string | null>([[key(sx, sy), null]])
    const queue: [number, number][] = [[sx, sy]]
    while (queue.length) {
      const [x, y] = queue.shift()!
      if (grid[y]![x] === '=') {
        let k: string | null = key(x, y)
        while (k) {
          const [cx, cy] = k.split(',').map(Number) as [number, number]
          if (grid[cy]![cx] === '#') grid[cy]![cx] = '.'
          k = seen.get(k) ?? null
        }
        return true
      }
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx,
          ny = y + dy,
          nk = key(nx, ny)
        if (!inside(nx, ny) || seen.has(nk) || grid[ny]![nx] === '~') continue
        seen.set(nk, key(x, y))
        queue.push([nx, ny])
      }
    }
    return false
  }
  for (let attempt = 0; attempt < 60 && landmarks.length < wanted; attempt++) {
    const x = 1 + Math.floor(r() * (W - 2)),
      y = 1 + Math.floor(r() * (H - 2))
    if (grid[y]![x] === '=' || grid[y]![x] === '~') continue
    if (nearPath(x, y, 1)) continue
    if (landmarks.some((l) => Math.abs(l.x - x) + Math.abs(l.y - y) < 4)) continue
    const original = grid[y]![x]!
    grid[y]![x] = '.'
    if (!carve(x, y)) {
      grid[y]![x] = original
      continue
    }
    const kind = pickKind()
    landmarks.push({
      id: `${id}:poi${landmarks.length}`,
      name: kind.names[Math.floor(r() * kind.names.length)]!,
      kind: kind.kind,
      x,
      y,
    })
  }
  return { rows: grid.map((row) => row.join('')), landmarks }
}
