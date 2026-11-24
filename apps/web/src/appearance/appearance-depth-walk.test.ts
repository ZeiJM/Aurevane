import sharp from 'sharp'
import { expect, it } from 'vitest'
import {
  APPEARANCE_MOTION_FRAME,
  APPEARANCE_PRESETS,
  appearanceMotionFrameIndex,
  paintedPlayerAppearanceBlueprint,
  type AppearanceFacing,
} from './appearance-manifest'
import { paintedPlayerLook } from './appearance-painted-looks'
import { wardrobeLook } from './appearance-painted-wardrobe'
import { renderAppearanceAsset } from './appearance-svg'

const { width, height, frames } = APPEARANCE_MOTION_FRAME
const looks = [
  {
    name: 'dressed scout',
    look: paintedPlayerAppearanceBlueprint(paintedPlayerLook(wardrobeLook())),
  },
  {
    name: 'capped ranger',
    look: paintedPlayerAppearanceBlueprint(
      paintedPlayerLook({
        ...wardrobeLook(),
        identity: 'ranger',
        headwear: 'furcap',
        gear: 'sword',
      }),
    ),
  },
  {
    name: 'legacy vector',
    look: { ...APPEARANCE_PRESETS[0].blueprint, palette: 'ivory' } as const,
  },
]

async function walkStrip(atlas: string, facing: AppearanceFacing) {
  const { column, row } = appearanceMotionFrameIndex(facing, 'walk', 0)
  return sharp(Buffer.from(atlas))
    .extract({ left: column * width, top: row * height, width: width * frames, height })
    .ensureAlpha()
    .raw()
    .toBuffer()
}

function outlineAt(pixels: Buffer, frame: number) {
  let leftBoot = 0
  let rightBoot = 0
  let crown: number = height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width * frames + frame * width + x) * 4 + 3
      // Ignore the translucent ground shadow and antialiasing fringe.
      if (pixels[offset]! < 180) continue
      if (x < width / 2) leftBoot = Math.max(leftBoot, y)
      else rightBoot = Math.max(rightBoot, y)
      crown = Math.min(crown, y)
    }
  }
  return { leftBoot, rightBoot, crown }
}

it.each(looks)(
  '$name alternates its feet along the viewing axis and keeps its profile gait',
  async ({ look }) => {
    const updated = renderAppearanceAsset(look, 'motion-v2')
    const previous = renderAppearanceAsset(look, 'motion')
    for (const facing of ['south', 'north'] as const) {
      const strip = await walkStrip(updated, facing)
      const first = outlineAt(strip, 0)
      const opposite = outlineAt(strip, frames / 2)
      const towards = facing === 'south' ? 1 : -1
      expect((first.leftBoot - opposite.leftBoot) * towards).toBeGreaterThanOrEqual(4)
      expect((opposite.rightBoot - first.rightBoot) * towards).toBeGreaterThanOrEqual(4)
      const crowns = Array.from({ length: frames }, (_, frame) => outlineAt(strip, frame).crown)
      expect(Math.max(...crowns) - Math.min(...crowns)).toBeLessThanOrEqual(2)
    }
    for (const facing of ['east', 'west'] as const) {
      expect((await walkStrip(updated, facing)).equals(await walkStrip(previous, facing))).toBe(
        true,
      )
    }
  },
)
