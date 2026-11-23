import type { Wildlife, WildlifePose } from './map-ambient'

interface Limb {
  hipX: number
  hipY: number
  footY: number
  phase: number
  mask: readonly number[]
}
interface GroundArt {
  center: number
  ground: number
  width: number
  body: readonly number[]
  legs: readonly Limb[]
}

// Masks use the original 384 × 512 cell coordinates. The painted floor and
// still legs are excluded from the body; each limb keeps the original fur art.
const groundArt: Record<number, GroundArt> = {
  4: {
    center: 195,
    ground: 430,
    width: 0.68,
    body: [
      12, 350, 38, 307, 107, 242, 269, 222, 384, 212, 384, 303, 305, 337, 270, 329, 231, 347, 184,
      335, 151, 317, 119, 342, 92, 392, 43, 417, 13, 396,
    ],
    legs: [
      {
        hipX: 171,
        hipY: 310,
        footY: 414,
        phase: 1,
        mask: [152, 307, 179, 307, 187, 356, 216, 414, 196, 416, 167, 379, 154, 341],
      },
      {
        hipX: 267,
        hipY: 320,
        footY: 418,
        phase: 0,
        mask: [250, 314, 278, 318, 266, 365, 250, 419, 229, 419, 239, 359],
      },
      {
        hipX: 157,
        hipY: 306,
        footY: 410,
        phase: 0,
        mask: [137, 296, 166, 302, 164, 348, 140, 408, 118, 410, 129, 354],
      },
      {
        hipX: 291,
        hipY: 322,
        footY: 424,
        phase: 1,
        mask: [276, 309, 303, 311, 320, 360, 373, 419, 350, 427, 297, 371, 273, 340],
      },
    ],
  },
  5: {
    center: 197,
    ground: 450,
    width: 0.67,
    body: [
      29, 237, 82, 204, 197, 214, 229, 96, 355, 96, 384, 284, 293, 326, 261, 335, 235, 329, 200,
      341, 136, 323, 100, 309, 69, 334, 40, 307,
    ],
    legs: [
      {
        hipX: 166,
        hipY: 321,
        footY: 431,
        phase: 1,
        mask: [
          154, 313, 181, 317, 176, 339, 161, 354, 186, 399, 213, 430, 195, 439, 180, 423, 141, 375,
          129, 349,
        ],
      },
      {
        hipX: 283,
        hipY: 322,
        footY: 443,
        phase: 0,
        mask: [
          275, 313, 294, 318, 302, 339, 327, 365, 342, 419, 355, 445, 337, 449, 322, 437, 307, 390,
          279, 353, 267, 339,
        ],
      },
      {
        hipX: 130,
        hipY: 308,
        footY: 430,
        phase: 0,
        mask: [
          113, 298, 148, 310, 135, 330, 109, 355, 96, 405, 95, 428, 79, 436, 63, 424, 71, 384, 82,
          339,
        ],
      },
      {
        hipX: 241,
        hipY: 321,
        footY: 453,
        phase: 1,
        mask: [
          228, 309, 255, 318, 258, 342, 257, 380, 244, 430, 253, 451, 236, 458, 223, 446, 228, 385,
          220, 338,
        ],
      },
    ],
  },
  6: {
    center: 178,
    ground: 437,
    width: 0.6,
    body: [
      47, 344, 98, 301, 200, 280, 207, 211, 268, 211, 308, 323, 278, 363, 232, 381, 208, 399, 158,
      394, 105, 402, 65, 387,
    ],
    legs: [
      {
        hipX: 156,
        hipY: 387,
        footY: 422,
        phase: 0,
        mask: [138, 374, 168, 378, 174, 412, 164, 425, 147, 417, 131, 393],
      },
      {
        hipX: 237,
        hipY: 376,
        footY: 426,
        phase: 1,
        mask: [220, 364, 245, 374, 240, 402, 255, 420, 245, 429, 225, 417, 216, 384],
      },
      {
        hipX: 129,
        hipY: 389,
        footY: 431,
        phase: 0,
        mask: [110, 374, 140, 377, 151, 417, 165, 429, 146, 435, 114, 412, 102, 389],
      },
      {
        hipX: 259,
        hipY: 385,
        footY: 437,
        phase: 1,
        mask: [241, 372, 268, 380, 263, 408, 290, 431, 278, 441, 247, 419, 232, 391],
      },
    ],
  },
}
const birdBody = [
  25, 318, 72, 296, 109, 282, 144, 273, 177, 285, 171, 306, 146, 327, 100, 331, 31, 365,
]
const birdWings: readonly Limb[] = [
  {
    hipX: 113,
    hipY: 292,
    footY: 0,
    phase: 0,
    mask: [16, 163, 61, 181, 97, 224, 131, 282, 110, 305, 83, 272, 54, 217],
  },
  {
    hipX: 136,
    hipY: 289,
    footY: 0,
    phase: 1,
    mask: [126, 281, 147, 226, 178, 207, 184, 241, 169, 276, 148, 301],
  },
]

interface WildlifePart {
  canvas: HTMLCanvasElement
  left: number
  top: number
  width: number
  height: number
  index: number
  mask: readonly number[]
  bird: boolean
}

/** Retain immutable masks, never animation poses, at the source's native density. */
export function createWildlifePartCache(pixelLimit = 512_000) {
  let source: HTMLImageElement | null = null
  let sourceUrl = ''
  let sourceWidth = 0,
    sourceHeight = 0,
    pixels = 0,
    builds = 0
  const parts: WildlifePart[] = []
  let unavailable = false
  const clear = () => {
    parts.length = 0
    unavailable = false
    source = null
    sourceUrl = ''
    sourceWidth = sourceHeight = pixels = builds = 0
  }
  return {
    get pixels() {
      return pixels
    },
    get builds() {
      return builds
    },
    clear,
    beginFrame() {
      builds = 0
    },
    get(image: HTMLImageElement, index: number, mask: readonly number[], bird: boolean) {
      if (
        source !== image ||
        sourceUrl !== image.src ||
        sourceWidth !== image.width ||
        sourceHeight !== image.height
      ) {
        clear()
        source = image
        sourceUrl = image.src
        sourceWidth = image.width
        sourceHeight = image.height
      }
      const cached = parts.find(
        (part) => part.mask === mask && part.index === index && part.bird === bird,
      )
      if (cached) return cached
      if (
        unavailable ||
        ![image.width, image.height].every((value) => Number.isFinite(value) && value > 0)
      )
        return null
      const sx = image.width / 1536,
        sy = image.height / 1024
      const xs = mask.filter((_, i) => i % 2 === 0),
        ys = mask.filter((_, i) => i % 2 === 1)
      const left = Math.floor(Math.min(...xs) * sx) - 1,
        top = Math.floor(Math.min(...ys) * sy) - 1
      const width = Math.ceil(Math.max(...xs) * sx) + 1 - left
      const height = Math.ceil(Math.max(...ys) * sy) + 1 - top
      const area = width * height
      // Keep the warmed subset if oversized source art exceeds the budget.
      // Repeated frames must not evict and reconstruct each other's masks.
      if (parts.length >= 18 || area <= 0 || pixels + area > pixelLimit) return null
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        unavailable = true
        return null
      }
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.setTransform(sx, 0, 0, sy, -left, -top)
      paintMaskedPart(context, image, index, mask, bird)
      const part = {
        canvas,
        left: left / sx,
        top: top / sy,
        width: width / sx,
        height: height / sy,
        index,
        mask,
        bird,
      }
      parts.push(part)
      pixels += area
      builds++
      return part
    },
  }
}

function paintPart(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  index: number,
  mask: readonly number[],
  bird: boolean,
  cache?: ReturnType<typeof createWildlifePartCache>,
) {
  const part = cache?.get(image, index, mask, bird)
  if (part) ctx.drawImage(part.canvas, part.left, part.top, part.width, part.height)
  else paintMaskedPart(ctx, image, index, mask, bird)
}

function paintMaskedPart(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  index: number,
  mask: readonly number[],
  bird = false,
) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(mask[0]!, mask[1]!)
  for (let i = 2; i < mask.length; i += 2) ctx.lineTo(mask[i]!, mask[i + 1]!)
  ctx.closePath()
  ctx.clip()
  const sx = image.width / 1536,
    sy = image.height / 1024
  // The bird source rect contains only the upper bird. Its wing/body masks also
  // exclude the lower bird's wing where the two illustrations nearly touch.
  ctx.drawImage(
    image,
    (index % 4) * 384 * sx,
    (512 + (bird ? 160 : 0)) * sy,
    (bird ? 185 : 384) * sx,
    (bird ? 210 : 512) * sy,
    0,
    bird ? 160 : 0,
    bird ? 185 : 384,
    bird ? 210 : 512,
  )
  ctx.restore()
}

/** Paints decorative original-art wildlife at its screen-space ground point. */
export function drawWildlife(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  animal: Wildlife,
  pose: WildlifePose,
  x: number,
  y: number,
  tile: number,
  cache?: ReturnType<typeof createWildlifePartCache>,
) {
  ctx.save()
  if (animal.flying) {
    const scale = tile * 0.0028
    ctx.translate(x, y - tile * 0.85 + pose.bob)
    ctx.scale(pose.facing * scale, scale)
    ctx.translate(-105, -300)
    for (const wing of birdWings) {
      ctx.save()
      ctx.translate(wing.hipX, wing.hipY)
      ctx.transform(
        1,
        0,
        pose.wing * (wing.phase ? -0.24 : 0.35),
        0.55 + (pose.wing + 1) * 0.36,
        0,
        0,
      )
      ctx.translate(-wing.hipX, -wing.hipY)
      paintPart(ctx, image, 7, wing.mask, true, cache)
      ctx.restore()
    }
    paintPart(ctx, image, 7, birdBody, true, cache)
  } else {
    const art = groundArt[animal.index] ?? groundArt[4]!
    const scale = (tile * art.width) / 384
    ctx.fillStyle = 'rgba(14,27,20,.24)'
    ctx.beginPath()
    ctx.ellipse(x, y, tile * 0.23, tile * 0.042, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.translate(x, y - pose.hop * tile * 0.065)
    ctx.scale(pose.facing * scale, scale)
    ctx.translate(-art.center, -art.ground)
    for (const leg of art.legs) {
      const wave = Math.sin(pose.gait * Math.PI * 2 + leg.phase * Math.PI)
      const lift = Math.max(0, wave) * pose.step * (animal.index === 6 ? 9 : 24)
      const length = leg.footY - leg.hipY
      ctx.save()
      ctx.translate(leg.hipX, leg.hipY)
      // A planted foot keeps its ground height. Only the returning limb lifts;
      // shear around the hip makes the original leg swing visibly fore/aft.
      ctx.transform(1, 0, wave * pose.step * 0.3, (art.ground - leg.hipY - lift) / length, 0, 0)
      ctx.translate(-leg.hipX, -leg.hipY)
      paintPart(ctx, image, animal.index, leg.mask, false, cache)
      ctx.restore()
    }
    ctx.translate(0, art.ground)
    ctx.scale(1, 1 - pose.crouch * 0.12)
    ctx.translate(0, -art.ground)
    paintPart(ctx, image, animal.index, art.body, false, cache)
  }
  ctx.restore()
}
