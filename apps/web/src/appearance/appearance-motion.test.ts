import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { expect, it } from 'vitest'

import { GET } from '@/app/api/media/appearance/[version]/[blueprint]/[asset]/route'
import {
  APPEARANCE_FACINGS,
  APPEARANCE_FRAME,
  APPEARANCE_MOTION_FRAME,
  APPEARANCE_POSES,
  APPEARANCE_PRESETS,
  APPEARANCE_WALK_CYCLE_MS,
  appearanceMotionFrameIndex,
  appearanceWalkFrame,
  compileAppearanceManifest,
  paintedAppearanceBlueprint,
  paintedPlayerAppearanceBlueprint,
  wardrobeAppearanceBlueprint,
} from './appearance-manifest'
import { DEFAULT_PAINTED_LOOK } from './appearance-painted-catalog'
import { paintedPlayerLook } from './appearance-painted-looks'
import { wardrobeLook } from './appearance-painted-wardrobe'
import { renderAppearanceAsset } from './appearance-svg'

it('serves the expanded motion atlas at its own immutable path', async () => {
  const manifest = compileAppearanceManifest(APPEARANCE_PRESETS[0].blueprint)
  const [version, blueprint] = manifest.id.split('/')
  expect(manifest.atlas).toBe(`/api/media/appearance/${manifest.id}/atlas.svg`)
  expect(manifest.motionAtlas).toBe(`/api/media/appearance/${manifest.id}/motion.svg`)
  const response = await GET(new Request(`https://aurevane.invalid${manifest.motionAtlas}`), {
    params: Promise.resolve({ version: version!, blueprint: blueprint!, asset: 'motion.svg' }),
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('immutable')
  const { width, height, columns, rows } = APPEARANCE_MOTION_FRAME
  expect(await response.text()).toContain(`viewBox="0 0 ${width * columns} ${height * rows}"`)
})

it('plays each walk frame once in every cycle', () => {
  const stepMs = APPEARANCE_WALK_CYCLE_MS / APPEARANCE_MOTION_FRAME.frames
  for (let frame = 0; frame < APPEARANCE_MOTION_FRAME.frames; frame++) {
    expect(appearanceWalkFrame(frame * stepMs)).toBe(frame)
    expect(appearanceWalkFrame((frame + 1) * stepMs - 1)).toBe(frame)
  }
  expect(appearanceWalkFrame(APPEARANCE_WALK_CYCLE_MS)).toBe(0)
})

const preset = APPEARANCE_PRESETS[0].blueprint
const looks = [
  ...APPEARANCE_PRESETS.map(({ blueprint }) => blueprint),
  { ...preset, palette: 'ivory' } as const,
  paintedAppearanceBlueprint({
    ...DEFAULT_PAINTED_LOOK,
    identity: 'ranger',
    headwear: 'arcanist',
    gear: 'bedroll',
  }),
  wardrobeAppearanceBlueprint({
    ...wardrobeLook(),
    identity: 'guard',
    bodyFrame: 'stocky',
    outerwear: 'brigandine',
    gear: 'sword',
    headwear: 'arcanist',
  }),
  paintedPlayerAppearanceBlueprint(
    paintedPlayerLook({
      ...wardrobeLook(),
      identity: 'pinescout',
      bodyFrame: 'stocky',
      outerwear: 'hooded',
      gear: 'sword',
      headwear: 'arcanist',
    }),
  ),
]

it.each(looks.map((look) => ({ look, id: compileAppearanceManifest(look).id })))(
  'renders complete cells for every pose and direction in $id',
  async ({ look, id }) => {
    const { width, height, frames } = APPEARANCE_MOTION_FRAME
    let atlas = renderAppearanceAsset(look, 'motion')
    // Convert embedded WebP to PNG for the test rasterizer. The browser loads WebP directly.
    for (const uri of atlas.match(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g) ?? []) {
      const png = await sharp(Buffer.from(uri.split(',')[1]!, 'base64'))
        .png()
        .toBuffer()
      atlas = atlas.replace(uri, `data:image/png;base64,${png.toString('base64')}`)
    }
    const { data, info } = await sharp(Buffer.from(atlas))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    for (const facing of APPEARANCE_FACINGS) {
      for (const pose of APPEARANCE_POSES) {
        const loop = pose === 'idle' || pose === 'walk'
        const poseFrames = new Set<string>()
        const count = loop ? frames : APPEARANCE_FRAME.frames
        for (let frame = 0; frame < count; frame++) {
          const { column, row } = appearanceMotionFrameIndex(facing, pose, frame)
          const hash = createHash('sha256')
          let opaquePixels = 0
          const clippedPixels: string[] = []
          for (let y = 0; y < height; y++) {
            const offset = ((row * height + y) * info.width + column * width) * 4
            const pixels = data.subarray(offset, offset + width * 4)
            hash.update(pixels)
            for (let x = 0; x < width; x++) {
              if (pixels[x * 4 + 3]! < 128) continue
              opaquePixels++
              if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                clippedPixels.push(`${x},${y}`)
              }
            }
          }
          const cell = `${id} ${facing} ${pose} frame ${frame}`
          expect(opaquePixels, cell).toBeGreaterThan(125)
          expect(clippedPixels, cell).toEqual([])
          poseFrames.add(hash.digest('hex'))
        }
        if (loop) expect(poseFrames.size, `v${look.v} ${facing} ${pose}`).toBe(frames)
      }
    }
  },
)
