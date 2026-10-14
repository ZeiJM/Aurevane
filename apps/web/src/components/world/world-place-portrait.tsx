import type { WorldLandmark } from '@/world/types'
import styles from './workspace.module.css'

// Cells from the existing original World runtime sheets (see runtime/manifest.json).
const placeArt: Record<WorldLandmark['kind'], readonly [string, number, number, number]> = {
  settlement: ['props-v02.webp', 1, 4, 2],
  watchtower: ['buildings-v02.webp', 8, 3, 3],
  frontier: ['buildings-v02.webp', 7, 3, 3],
  anchor: ['beauties-v03.webp', 5, 4, 2],
  shrine: ['props-v02.webp', 4, 4, 2],
  ruin: ['props-v02.webp', 3, 4, 2],
  camp: ['props-v02.webp', 5, 4, 2],
  grove: ['beauties-v03.webp', 6, 4, 2],
  spring: ['props-v02.webp', 6, 4, 2],
  hamlet: ['buildings-v02.webp', 0, 3, 3],
  waystone: ['props-v02.webp', 7, 4, 2],
  marketplace: ['props-v02.webp', 0, 4, 2],
  bridge: ['props-v02.webp', 2, 4, 2],
}

export function WorldPlacePortrait({ place }: { place: WorldLandmark }) {
  const [sheet, index, columns, rows] =
    place.sceneryIndex !== undefined &&
    Number.isInteger(place.sceneryIndex) &&
    place.sceneryIndex >= 0 &&
    place.sceneryIndex < 8
      ? (['beauties-v03.webp', place.sceneryIndex, 4, 2] as const)
      : placeArt[place.kind]
  return (
    <span
      className={styles.placePortrait}
      aria-hidden="true"
      style={{
        backgroundImage: `url(/media/art/world/runtime/${sheet})`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        backgroundPosition: `${((index % columns) / (columns - 1)) * 100}% ${(Math.floor(index / columns) / (rows - 1)) * 100}%`,
      }}
    />
  )
}
