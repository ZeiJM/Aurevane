import { describe, expect, it } from 'vitest'
import { FITTED_ACCESSORY_ART } from './appearance-fitted-accessories.generated'
import { FITTED_ART_SOURCE } from './appearance-fitted-source.generated'
import { REPAINTED_FACES } from './appearance-repainted-faces.generated'
import { REPAINTED_HAIR } from './appearance-repainted-hair.generated'
import {
  fitPortraitLayer,
  fittedFacialHairTarget,
  fittedHairTarget,
  renderFittedPortrait,
  type PaintedPortraitLayers,
} from './appearance-portrait-fit'

describe('painted portrait fitting', () => {
  it('keeps every source cutout and its calibration inside the source image', async () => {
    const { default: sharp } = await import('sharp')
    const repaints = Object.fromEntries(
      Object.entries({ ...REPAINTED_FACES, ...REPAINTED_HAIR }).map(([name, assets]) => [
        name,
        assets.portrait,
      ]),
    )
    for (const [name, layer] of Object.entries({
      ...FITTED_ART_SOURCE,
      ...FITTED_ACCESSORY_ART,
      ...repaints,
    })) {
      const { anchors, width, height } = layer
      expect([anchors.left, anchors.right], name).toEqual(
        [anchors.left, anchors.right].sort((a, b) => a - b),
      )
      expect(anchors.left, name).toBeGreaterThanOrEqual(0)
      expect(anchors.right, name).toBeLessThanOrEqual(width)
      expect(anchors.top, name).toBeGreaterThanOrEqual(0)
      expect(anchors.bottom, name).toBeGreaterThan(anchors.top)
      expect(anchors.bottom, name).toBeLessThanOrEqual(height)
      const art = Buffer.from(layer.href.slice('data:image/webp;base64,'.length), 'base64')
      await expect(sharp(art).metadata()).resolves.toMatchObject({
        width,
        height,
        format: 'webp',
        hasAlpha: true,
      })
    }
  })

  it('registers the illustrated noses and mouths between the eye line and chin', () => {
    const faces = Object.values(FITTED_ART_SOURCE).filter((art) => 'facialGuides' in art)
    expect(faces).toHaveLength(60)
    for (const { anchors, height, facialGuides } of faces) {
      expect(facialGuides.center).toBeGreaterThan(0.35)
      expect(facialGuides.center).toBeLessThan(0.75)
      expect(facialGuides.nose * height).toBeGreaterThan(anchors.top)
      expect(facialGuides.lip).toBeGreaterThan(facialGuides.nose)
      expect(facialGuides.lip * height).toBeLessThan(anchors.bottom)
    }
  })

  it('registers both pairs of guides even if source artwork has uneven padding', () => {
    const source = { left: 53, right: 143, top: 40, bottom: 260 }
    const target = { left: 91, right: 165, top: 98, bottom: 159 }
    const { origin, scaleX, scaleY } = fitPortraitLayer(source, target)
    expect(origin[0] + source.left * scaleX).toBeCloseTo(target.left)
    expect(origin[0] + source.right * scaleX).toBeCloseTo(target.right)
    expect(origin[1] + source.top * scaleY).toBeCloseTo(target.top)
    expect(origin[1] + source.bottom * scaleY).toBeCloseTo(target.bottom)
  })

  it('measures repainted forehead, brow, iris and neck landmarks on each source', () => {
    for (const { portrait, sprite } of Object.values(REPAINTED_FACES)) {
      const { anchors, height, fit } = portrait
      expect(fit.hairline).toBeGreaterThan(0)
      expect(fit.brow).toBeGreaterThan(fit.hairline)
      expect(fit.brow * height).toBeLessThan(anchors.top)
      expect(fit.temples[0]).toBeLessThan(fit.neck[0])
      expect(fit.temples[1]).toBeGreaterThan(fit.neck[1])
      expect(fit.iris).toBeLessThan(0.1)
      expect(sprite.fit).toEqual(fit)
    }
  })

  const paintedPart = (name: string) => ({
    href: `data:image/webp;name=${name}`,
    width: 300,
    height: 300,
    anchors: { left: 90, right: 210, top: 100, bottom: 230 },
  })
  const bare: PaintedPortraitLayers = {
    face: paintedPart('face'),
    neckPigment: ['#b58060', '#6b4338'],
    landmarks: {
      temples: [74, 182],
      eyes: [102, 154],
      eyesY: 103,
      hairline: 60,
      brow: 88,
      nose: 119,
      chin: 169,
      neck: [104, 152],
      shoulder: 199,
    },
    garment: paintedPart('garment'),
    hair: paintedPart('hair'),
  }

  it('puts the painted collar over the neck continuation and hair over the garment', () => {
    const result = renderFittedPortrait(bare, '<rect id="paper"/>')
    const order = [
      'id="paper"',
      'url(#neck-continuation)',
      'name=face',
      'name=garment',
      'name=hair',
    ]
    expect(order.map((marker) => result.indexOf(marker))).toEqual(
      order.map((marker) => result.indexOf(marker)).sort((a, b) => a - b),
    )
    expect(order.every((marker) => result.includes(marker))).toBe(true)
    expect(result).not.toContain('brim-fit')
  })

  it('keeps the neck attached to the shifted jaw and pinned at the shoulders in posed portraits', () => {
    const upright = renderFittedPortrait(bare, '')
    const guarded = renderFittedPortrait({ ...bare, stance: 1 }, '')
    const alert = renderFittedPortrait({ ...bare, stance: 2 }, '')
    const neck = (portrait: string) => portrait.match(/id="neck-contour" d="([^"]+)"/)?.[1]

    expect(neck(upright)).toContain('Q128 160')
    expect(neck(guarded)).toContain('Q133 163')
    expect(neck(alert)).toContain('Q123 155')
    for (const portrait of [upright, guarded, alert]) {
      expect(neck(portrait)).toContain('L179 239H77L79 210')
    }
  })

  it('restricts hair root shading to the face and fades it out at the brows', () => {
    const result = renderFittedPortrait({ ...bare, rootedHair: true }, '')
    expect(result).toContain('id="painted-root-skin" mask-type="alpha"')
    expect(result).toContain('<use href="#painted-head-source"/>')
    expect(result).toContain('y1="65" y2="89"')
    expect(result).toContain('mask="url(#painted-root-region)"><g mask="url(#painted-root-skin)"')
    expect(result.match(/name=hair/g)).toHaveLength(1)
    expect(result).toContain('<use href="#painted-root-hair"/>')
  })

  it('keeps cropped hairstyles off the brow, eye, and cheek while retaining the temple silhouette', () => {
    const result = renderFittedPortrait({ ...bare, clearCheeks: true }, '')
    expect(result).toContain('id="portrait-short-fringe"')
    expect(result).toContain('M88 101Q128 95 168 101L154 169H102Z')
    expect(result.indexOf('clip-path="url(#portrait-short-fringe)"')).toBeLessThan(
      result.indexOf('name=hair'),
    )
    expect(renderFittedPortrait(bare, '')).not.toContain('portrait-short-fringe')
  })

  it('repositions a lens opening when a different face moves its pupils', () => {
    const fitted = (eyes: readonly [number, number], eyesY: number) =>
      renderFittedPortrait(
        {
          ...bare,
          landmarks: { ...bare.landmarks, eyes, eyesY },
          facewear: { layer: paintedPart('lenses'), kind: 'lenses' },
        },
        '',
      )
    expect(fitted([102, 154], 103)).toContain('<ellipse cx="102" cy="103"')
    expect(fitted([108, 148], 95)).toContain('<ellipse cx="108" cy="95"')
  })

  it('puts accessory straps behind the head and keeps its front over the face', () => {
    const veil = paintedPart('veil')
    const strap = paintedPart('veil-strap')
    const result = renderFittedPortrait(
      { ...bare, facewear: { layer: { ...veil, rearHref: strap.href }, kind: 'veil' } },
      '',
    )
    const strapPosition = result.indexOf('href="' + strap.href + '"')
    const facePosition = result.indexOf('href="' + bare.face.href + '"')
    const veilPosition = result.indexOf('href="' + veil.href + '"')
    expect(strapPosition).toBeGreaterThanOrEqual(0)
    expect(strapPosition).toBeLessThan(facePosition)
    expect(veilPosition).toBeGreaterThan(facePosition)
  })

  it('keeps the exposed eye visible when a hand-selected patch is fitted', () => {
    const result = renderFittedPortrait(
      { ...bare, facewear: { layer: paintedPart('eye-patch'), kind: 'patch' } },
      '',
    )
    expect(result).toContain('mask="url(#portrait-uncovered-eye)"')
    expect(result).toContain('<ellipse cx="102" cy="103"')
    expect(result).not.toContain('<ellipse cx="154" cy="103"')
  })

  it('clips crown hair for a cap and allows it to show beneath an open circlet', () => {
    const withHeadwear = (kind: 'cap' | 'circlet') =>
      renderFittedPortrait({ ...bare, headwear: { layer: paintedPart(kind), kind } }, '')
    expect(withHeadwear('cap')).toContain('clip-path="url(#portrait-brim-fit)"')
    expect(withHeadwear('circlet')).not.toContain('brim-fit')
    expect(withHeadwear('circlet')).toContain('name=circlet')
  })

  it('bounds short and long hair to the head measured in the portrait', () => {
    const wideHair = { ...bare.hair, width: 450 }
    const short = fittedHairTarget(wideHair, bare.landmarks, 'short')
    const long = fittedHairTarget(wideHair, bare.landmarks, 'long')
    const scale = fitPortraitLayer(wideHair.anchors, short)
    expect(wideHair.width * scale.scaleX).toBeCloseTo(108 * 1.29)
    expect(scale.scaleY).toBeLessThanOrEqual(scale.scaleX * 1.18)
    expect((short.left + short.right) / 2).toBe(128)
    expect(long.right - long.left).toBeGreaterThan(short.right - short.left)
    expect(wideHair.width * fitPortraitLayer(wideHair.anchors, long).scaleX).toBeCloseTo(108 * 1.45)
  })

  it('tucks painted locks behind the head and protects the eyes under the fringe', () => {
    const hair = { ...bare.hair, crownOpening: 0.32 }
    const result = renderFittedPortrait({ ...bare, hair }, '')
    const locks = result.indexOf('<use href="#fitted-hair-paint"/>')
    const collar = result.indexOf('clip-path="url(#painted-neck-opening)"')
    const fringe = result.indexOf('mask="url(#painted-fringe-fit)"')
    expect(locks).toBeGreaterThan(0)
    expect(collar).toBeGreaterThan(locks)
    expect(fringe).toBeGreaterThan(collar)
    const fit = fitPortraitLayer(hair.anchors, fittedHairTarget(hair, bare.landmarks, 'long'))
    expect(fit.scaleX).toBeCloseTo(fit.scaleY, 8)
  })

  it('follows the painted mouth instead of centering a moustache on the canvas', () => {
    const landmarks = { ...bare.landmarks, mouth: [140, 145] as const }
    expect(fittedFacialHairTarget(landmarks, 'upperLip')).toEqual({
      left: 126,
      right: 154,
      top: 139,
      bottom: 146,
    })
    expect(fittedFacialHairTarget(landmarks, 'chin').top).toBeGreaterThan(145)
  })
})
