type Point = readonly [x: number, y: number]

export type PortraitAnchors = Readonly<{
  left: number
  right: number
  top: number
  bottom: number
}>

type PaintedLayer = Readonly<{
  href: string
  rearHref?: string
  filter?: string
  width: number
  height: number
  anchors: PortraitAnchors
}>

export type PortraitFaceLandmarks = Readonly<{
  temples: readonly [left: number, right: number]
  eyes: readonly [left: number, right: number]
  eyesY: number
  hairline: number
  brow: number
  nose: number
  chin: number
  neck: readonly [left: number, right: number]
  shoulder: number
}>

export function fitPortraitLayer(source: PortraitAnchors, target: PortraitAnchors) {
  const scaleX = (target.right - target.left) / (source.right - source.left)
  const scaleY = (target.bottom - target.top) / (source.bottom - source.top)
  const origin: Point = [target.left - source.left * scaleX, target.top - source.top * scaleY]
  return { origin, scaleX, scaleY }
}

function layerImage(layer: PaintedLayer, target: PortraitAnchors, href = layer.href) {
  const { origin, scaleX, scaleY } = fitPortraitLayer(layer.anchors, target)
  const filter = layer.filter ? ` filter="url(#${layer.filter})"` : ''
  return `<image href="${href}" x="${origin[0]}" y="${origin[1]}" width="${layer.width * scaleX}" height="${layer.height * scaleY}" preserveAspectRatio="none"${filter}/>`
}

function rearImage(layer: PaintedLayer, target: PortraitAnchors) {
  return layer.rearHref ? layerImage(layer, target, layer.rearHref) : ''
}

export type PaintedPortraitLayers = Readonly<{
  face: PaintedLayer
  landmarks: PortraitFaceLandmarks
  neckPigment: readonly [light: string, shadow: string]
  hair: PaintedLayer
  garment: PaintedLayer
  paintedFilters?: string
  expressionMap?: string
  faceMarks?: string
  torsoScale?: number
  gear?: PaintedLayer
  facialHair?: Readonly<{ layer: PaintedLayer; upperLipOnly: boolean }>
  hairAccent?: Readonly<{ filter: string; placement: 'split' | 'tips' | 'streak' | 'underlight' }>
  eyeFilters?: readonly [viewerLeft?: string, viewerRight?: string]
  headwear?: Readonly<{ layer: PaintedLayer; kind: 'cap' | 'circlet' | 'hood' }>
  facewear?: Readonly<{ layer: PaintedLayer; kind: 'lenses' | 'veil' | 'mask' | 'patch' }>
}>

export function fitPortraitAccessories(
  landmarks: Pick<
    PortraitFaceLandmarks,
    'temples' | 'eyes' | 'eyesY' | 'hairline' | 'brow' | 'nose' | 'chin'
  >,
  hairstyle: string,
  headwear: PaintedPortraitLayers['headwear'],
  facewear: PaintedPortraitLayers['facewear'],
  scope = 'portrait',
) {
  const { temples, eyes, eyesY, hairline, brow, nose, chin } = landmarks
  let hat = ''
  let hatBack = ''
  let fittedHair = hairstyle
  if (headwear) {
    const closedCrown = headwear.kind !== 'circlet'
    const hood = headwear.kind === 'hood'
    const band = closedCrown ? hairline + 7 : brow - 8
    const padding = hood ? 15 : closedCrown ? 8 : 3
    const hatTarget = {
      left: temples[0] - padding,
      right: temples[1] + padding,
      top: hood ? hairline - 2 : band - (closedCrown ? 11 : 3),
      bottom: hood ? eyesY : band,
    }
    hat = layerImage(headwear.layer, hatTarget)
    hatBack = rearImage(headwear.layer, hatTarget)
    if (closedCrown) {
      const clip = `${scope}-brim-fit`
      fittedHair = `<clipPath id="${clip}"><path d="M0 0H${temples[0] - 7}V${band}Q128 ${band - 12} ${temples[1] + 7} ${band}V0H256V256H0Z"/></clipPath><g clip-path="url(#${clip})">${hairstyle}</g>`
    }
  }

  let accessory = ''
  let accessoryBack = ''
  if (facewear?.kind === 'lenses' || facewear?.kind === 'mask') {
    const lensTarget = {
      left: eyes[0],
      right: eyes[1],
      top: eyesY - 9,
      bottom: eyesY + 9,
    }
    const lenses = layerImage(facewear.layer, lensTarget)
    accessoryBack = rearImage(facewear.layer, lensTarget)
    if (facewear.kind === 'lenses') {
      const lensRadius = (eyes[1] - eyes[0]) * 0.315
      const mask = `${scope}-lens-transmission`
      accessory = `<defs><mask id="${mask}"><rect width="256" height="256" fill="white"/>${eyes.map((x) => `<ellipse cx="${x}" cy="${eyesY}" rx="${lensRadius}" ry="8" fill="#272727"/>`).join('')}</mask></defs><g mask="url(#${mask})">${lenses}</g>`
    } else {
      accessory = lenses
    }
  } else if (facewear?.kind === 'veil') {
    const veilTarget = {
      left: temples[0] + 4,
      right: temples[1] - 4,
      top: nose,
      bottom: chin + 3,
    }
    accessory = layerImage(facewear.layer, veilTarget)
    accessoryBack = rearImage(facewear.layer, veilTarget)
  } else if (facewear?.kind === 'patch') {
    const patchTarget = {
      left: temples[0] - 5,
      right: temples[1],
      top: brow + 1,
      bottom: eyesY + 12,
    }
    accessory = layerImage(facewear.layer, patchTarget)
    accessoryBack = rearImage(facewear.layer, patchTarget)
  }

  return { hat, hatBack, fittedHair, accessory, accessoryBack }
}

// Each painted part has optical guides measured in its source pixels.
export function renderFittedPortrait(
  layers: PaintedPortraitLayers,
  backdrop: string,
  icon = false,
) {
  const { face, landmarks, neckPigment, hair, garment, headwear, facewear } = layers
  const { temples, eyes, eyesY, hairline, brow, nose, chin, neck, shoulder } = landmarks
  const faceImage = layerImage(face, { left: eyes[0], right: eyes[1], top: eyesY, bottom: chin })
  const headSource = layers.expressionMap
    ? `<filter id="painted-expression" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage href="${layers.expressionMap}" x="0" y="0" width="256" height="256" result="expression-shape"/><feDisplacementMap in="SourceGraphic" in2="expression-shape" scale="18" xChannelSelector="R" yChannelSelector="G"/></filter><g filter="url(#painted-expression)">${faceImage}</g>`
    : faceImage
  const irisRadius = (eyes[1] - eyes[0]) * 0.105
  const irisOverlay = layers.eyeFilters
    ?.map((filter, index) => {
      if (!filter) return ''
      const clip = `painted-iris-${index}`
      return `<clipPath id="${clip}"><ellipse cx="${eyes[index]}" cy="${eyesY}" rx="${irisRadius}" ry="${irisRadius * 1.17}"/></clipPath><g clip-path="url(#${clip})"><use href="#painted-head-source" filter="url(#${filter})"/></g>`
    })
    .join('')
  const head = irisOverlay
    ? `<defs><g id="painted-head-source">${headSource}</g></defs><use href="#painted-head-source"/>${irisOverlay}`
    : headSource
  const neckUnderlay = `<defs>
    <linearGradient id="neck-continuation">
      <stop stop-color="${neckPigment[1]}"/>
      <stop offset=".62" stop-color="${neckPigment[0]}"/>
      <stop offset="1" stop-color="${neckPigment[1]}"/>
    </linearGradient>
  </defs>
  <path d="M${neck[0] - 2} ${chin - 1}H${neck[1] + 2}L${neck[1] + 6} 256H${neck[0] - 6}Z" fill="url(#neck-continuation)"/>`
  let clothing = layerImage(garment, {
    left: neck[0],
    right: neck[1],
    top: chin + 4,
    bottom: shoulder,
  })
  const torsoScale = layers.torsoScale ?? 1
  if (torsoScale !== 1) {
    const seam = shoulder + 28
    clothing = `<defs>
      <g id="painted-garment-source">${clothing}</g>
      <linearGradient id="painted-collar-fade" gradientUnits="userSpaceOnUse" x2="0" y1="${shoulder}" y2="${seam}"><stop stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
      <linearGradient id="painted-shoulder-fade" gradientUnits="userSpaceOnUse" x2="0" y1="${shoulder}" y2="${seam}"><stop stop-color="black"/><stop offset="1" stop-color="white"/></linearGradient>
      <mask id="painted-collar-mask"><rect width="256" height="256" fill="url(#painted-collar-fade)"/></mask>
      <mask id="painted-shoulder-mask"><rect width="256" height="256" fill="url(#painted-shoulder-fade)"/></mask>
    </defs>
    <use href="#painted-garment-source" mask="url(#painted-collar-mask)"/>
    <g mask="url(#painted-shoulder-mask)"><use href="#painted-garment-source" transform="translate(128 0) scale(${torsoScale} 1) translate(-128 0)"/></g>`
  }
  const gear = layers.gear
    ? layerImage(layers.gear, {
        left: 128 - 53 * torsoScale,
        right: 128 + 53 * torsoScale,
        top: shoulder - 17,
        bottom: shoulder + 71,
      })
    : ''
  const hairTarget = { left: temples[0], right: temples[1], top: hairline, bottom: brow }
  let hairstyle = layerImage(hair, hairTarget)
  if (layers.hairAccent) {
    const { placement, filter } = layers.hairAccent
    const { origin, scaleY } = fitPortraitLayer(hair.anchors, hairTarget)
    const bottom = origin[1] + hair.height * scaleY
    const middle = (hairline + bottom) / 2
    const region = {
      split: '<path d="M130 0h126v256H124Z" fill="white"/>',
      streak: `<path d="M145 0h15L${temples[1]} 256h-15Z" fill="white"/>`,
      tips: `<rect y="${middle}" width="256" height="${Math.max(1, bottom - middle)}" fill="url(#painted-hair-fade)"/>`,
      underlight: `<path d="M0 ${brow}Q145 ${middle} 256 ${brow + 6}v180H0Z" fill="#bcbcbc"/>`,
    }[placement]
    hairstyle = `<defs>
      <g id="painted-hair-source">${layerImage({ ...hair, filter: undefined }, hairTarget)}</g>
      <linearGradient id="painted-hair-fade" x2="0" y2="1">
        <stop offset="0" stop-color="black"/><stop offset=".16" stop-color="white"/>
      </linearGradient>
      <mask id="painted-hair-accent">${region}</mask>
    </defs>
    <use href="#painted-hair-source" ${hair.filter ? `filter="url(#${hair.filter})"` : ''}/>
    <use href="#painted-hair-source" filter="url(#${filter})" mask="url(#painted-hair-accent)"/>`
  }
  const beard = layers.facialHair
    ? layerImage(layers.facialHair.layer, {
        left: layers.facialHair.upperLipOnly ? 110 : (temples[0] + neck[0]) / 2,
        right: layers.facialHair.upperLipOnly ? 146 : (temples[1] + neck[1]) / 2,
        top: nose + 11,
        bottom: layers.facialHair.upperLipOnly ? nose + 16 : chin + 4,
      })
    : ''
  const { hat, hatBack, fittedHair, accessory, accessoryBack } = fitPortraitAccessories(
    landmarks,
    hairstyle,
    headwear,
    facewear,
  )
  const size = icon ? 64 : 256
  const viewBox = icon ? '44 28 168 168' : '0 0 256 256'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
    ${layers.paintedFilters ? `<defs>${layers.paintedFilters}</defs>` : ''}
    ${backdrop}${hatBack}${rearImage(hair, hairTarget)}${accessoryBack}
    ${neckUnderlay}${head}${layers.faceMarks ?? ''}${clothing}${gear}${beard}${fittedHair}${accessory}${hat}
  </svg>`
}
