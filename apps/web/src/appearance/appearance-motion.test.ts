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

it('serves the current walk cycle at a fresh immutable URL for existing characters', async () => {
  const manifest = compileAppearanceManifest(APPEARANCE_PRESETS[0].blueprint)
  const [version, blueprint] = manifest.id.split('/')
  expect(manifest.atlas).toBe(`/api/media/appearance/${manifest.id}/atlas.svg`)
  expect(manifest.motionAtlas).toBe(`/api/media/appearance/${manifest.id}/motion-v2.svg`)
  const response = await GET(new Request(`https://aurevane.invalid${manifest.motionAtlas}`), {
    params: Promise.resolve({ version: version!, blueprint: blueprint!, asset: 'motion-v2.svg' }),
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toContain('immutable')
  const { width, height, columns, rows } = APPEARANCE_MOTION_FRAME
  expect(await response.text()).toContain(`viewBox="0 0 ${width * columns} ${height * rows}"`)
})

it('preserves the previous immutable motion URLs for saved characters and older clients', async () => {
  const preset = APPEARANCE_PRESETS[0].blueprint
  const previous = [
    [preset, '068c7e7d384b0093b262b7b4c2dd66b1e1e4a1d4244da5158c58829a6da23487'],
    [
      { ...preset, palette: 'ivory' },
      'f10521e78d80b1ae177f42d32789fd8bb73f7418af045bad4cae57a8712bf8c2',
    ],
    [
      paintedPlayerAppearanceBlueprint(paintedPlayerLook(wardrobeLook())),
      '704c5fba1915f24a52fb7230c5c9c9913bf77afe8812f5f1eadbd2253c983f31',
    ],
  ] as const
  for (const [look, expected] of previous) {
    const { id } = compileAppearanceManifest(look)
    const [version, blueprint] = id.split('/')
    const response = await GET(
      new Request(`https://aurevane.invalid/api/media/appearance/${id}/motion.svg`),
      {
        params: Promise.resolve({ version: version!, blueprint: blueprint!, asset: 'motion.svg' }),
      },
    )
    expect(response.status).toBe(200)
    expect(
      createHash('sha256')
        .update(await response.text())
        .digest('hex'),
    ).toBe(expected)
  }
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
    let atlas = renderAppearanceAsset(look, 'motion-v2')
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
