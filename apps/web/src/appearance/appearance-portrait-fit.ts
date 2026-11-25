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

type FacialHairFit = 'upperLip' | 'chin' | 'jaw'

export type PortraitFaceLandmarks = Readonly<{
  temples: readonly [left: number, right: number]
  eyes: readonly [left: number, right: number]
  eyesY: number
  hairline: number
  brow: number
  nose: number
  mouth?: Point
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

function boundedFittingWidth(
  layer: PaintedLayer,
  left: number,
  right: number,
  maxArtworkWidth: number,
): readonly [number, number] {
  const sourceSpan = layer.anchors.right - layer.anchors.left
  const span = Math.min(right - left, (maxArtworkWidth * sourceSpan) / layer.width)
  const center = (left + right) / 2
  return [center - span / 2, center + span / 2]
}

export function fittedHairTarget(
  hair: PaintedLayer,
  landmarks: Pick<PortraitFaceLandmarks, 'temples' | 'hairline' | 'brow'>,
  length: 'short' | 'long',
): PortraitAnchors {
  const { temples, hairline, brow } = landmarks
  const headWidth = temples[1] - temples[0]
  const [left, right] = boundedFittingWidth(
    hair,
    temples[0],
    temples[1],
    headWidth * (length === 'long' ? 1.53 : 1.37),
  )
  const horizontalScale = (right - left) / (hair.anchors.right - hair.anchors.left)
  const guideHeight = hair.anchors.bottom - hair.anchors.top
  const opening = (hairline + brow) / 2
  const sourceOpening = (hair.anchors.top + hair.anchors.bottom) / 2
  const verticalSpan = Math.min(
    brow - hairline,
    guideHeight * horizontalScale * 1.18,
    ((opening - 4) * guideHeight) / sourceOpening,
  )
  return { left, right, top: opening - verticalSpan / 2, bottom: opening + verticalSpan / 2 }
}

export function fittedFacialHairTarget(
  { mouth, nose, chin, neck, temples }: PortraitFaceLandmarks,
  fit: FacialHairFit,
): PortraitAnchors {
  const [center, lip] = mouth ?? [(neck[0] + neck[1]) / 2, nose + 16]
  if (fit === 'upperLip') {
    return { left: center - 14, right: center + 14, top: lip - 6, bottom: lip + 1 }
  }
  if (fit === 'chin') {
    return { left: center - 13, right: center + 13, top: lip + 4, bottom: chin + 3 }
  }
  return {
    left: (temples[0] + neck[0]) / 2,
    right: (temples[1] + neck[1]) / 2,
    top: Math.min(nose - 3, lip - 12),
    bottom: chin + 4,
  }
}

export type PaintedPortraitLayers = Readonly<{
  face: PaintedLayer
  trimScalp?: boolean
  landmarks: PortraitFaceLandmarks
  neckPigment: readonly [light: string, shadow: string]
  hair: PaintedLayer
  hairLength?: 'short' | 'long'
  tuckHairBehindShoulders?: boolean
  garment: PaintedLayer
  paintedFilters?: string
  expressionMap?: string
  expressionIntensity?: number
  faceMarks?: string
  torsoScale?: number
  gear?: PaintedLayer
  gearPlacement?: 'sash' | 'shoulder' | 'waist' | 'behind'
  facialHair?: Readonly<{ layer: PaintedLayer; fit: FacialHairFit }>
  hairAccent?: Readonly<{ filter: string; placement: 'split' | 'tips' | 'streak' | 'underlight' }>
  eyeFilters?: readonly [viewerLeft?: string, viewerRight?: string]
  headwear?: Readonly<{ layer: PaintedLayer; kind: 'cap' | 'circlet' | 'hood'; wideBrim?: boolean }>
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
    const guides = headwear.layer.anchors
    const headWidth = temples[1] - temples[0]
    const brimWidth = headwear.wideBrim ? 1.58 : hood ? 1.42 : closedCrown ? 1.3 : 1.14
    const [left, right] = boundedFittingWidth(
      headwear.layer,
      temples[0] - padding,
      temples[1] + padding,
      headWidth * brimWidth,
    )
    const fittedWidth = right - left
    const horizontalScale = fittedWidth / (guides.right - guides.left)
    const verticalScale = Math.min(horizontalScale, (band - 4) / guides.bottom)
    const hatTarget = {
      left,
      right,
      top: hood ? hairline - 2 : band - (guides.bottom - guides.top) * verticalScale,
      bottom: hood ? eyesY : band,
    }
    hat = layerImage(headwear.layer, hatTarget)
    hatBack = rearImage(headwear.layer, hatTarget)
    if (hood) {
      const faceOpening = `${scope}-hood-opening`
      const betweenEyes = (eyes[0] + eyes[1]) / 2
      const radius = (temples[1] - temples[0]) / 2 - 5
      const openingTop = hairline - 1
      const openingBottom = chin + 5
      hat = `<defs><mask id="${faceOpening}"><rect width="256" height="256" fill="white"/><ellipse cx="${betweenEyes}" cy="${(openingTop + openingBottom) / 2}" rx="${radius}" ry="${(openingBottom - openingTop) / 2}" fill="black"/></mask></defs><g mask="url(#${faceOpening})">${hat}</g>`
    }
    if (closedCrown) {
      const clip = `${scope}-brim-fit`
      const left = temples[0] - 7
      const right = temples[1] + 7
      const crownCenter = (left + right) / 2
      fittedHair = `<clipPath id="${clip}"><path d="M${left} ${band + 2}Q${crownCenter} ${band - 11} ${right} ${band + 2}L${right + 4} ${eyesY + 10}L256 ${chin + 6}V256H0V${chin + 6}L${left - 4} ${eyesY + 10}Z"/></clipPath><g clip-path="url(#${clip})">${hairstyle}</g>`
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
      const lensRadius = (eyes[1] - eyes[0]) * 0.31
      const mask = `${scope}-lens-transmission`
      accessory = `<defs><mask id="${mask}"><rect width="256" height="256" fill="white"/>${eyes.map((x) => `<ellipse cx="${x}" cy="${eyesY}" rx="${lensRadius}" ry="9" fill="#141414"/>`).join('')}</mask></defs><g mask="url(#${mask})">${lenses}</g>`
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
    // The painted patch sits right of center within the strap. Register its
    // eye cup to the covered pupil and keep the opposite eye unobstructed.
    const strapWidth = temples[1] - temples[0]
    const left = eyes[1] - 0.68 * strapWidth
    const patchTarget = {
      left,
      right: left + strapWidth,
      top: eyesY - 12,
      bottom: eyesY + 9,
    }
    const uncoveredEye = `${scope}-uncovered-eye`
    const eyeRadius = (eyes[1] - eyes[0]) * 0.31
    accessory = `<defs><mask id="${uncoveredEye}"><rect width="256" height="256" fill="white"/><ellipse cx="${eyes[0]}" cy="${eyesY}" rx="${eyeRadius}" ry="8" fill="black"/></mask></defs><g mask="url(#${uncoveredEye})">${layerImage(facewear.layer, patchTarget)}</g>`
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
  const { temples, eyes, eyesY, hairline, brow, chin, neck, shoulder } = landmarks
  const neckCenter = (neck[0] + neck[1]) / 2
  const faceImage = layerImage(face, { left: eyes[0], right: eyes[1], top: eyesY, bottom: chin })
  const fittedFaceImage = layers.trimScalp
    ? `<clipPath id="painted-scalp"><path d="M0 ${brow} Q${neckCenter} ${2 * (hairline - 10) - brow} 256 ${brow} V256 H0Z"/></clipPath><g clip-path="url(#painted-scalp)">${faceImage}</g>`
    : faceImage
  // The expression maps were painted on a reference with eyes at y=98,
  // 44 units apart, and the mouth at y=138. Keep the movement on the
  // corresponding features once different face proportions are fitted.
  const expressionScaleX = (eyes[1] - eyes[0]) / 44
  const expressionScaleY = landmarks.mouth ? (landmarks.mouth[1] - eyesY) / 40 : 1
  const expressionX = (eyes[0] + eyes[1]) / 2 - 128 * expressionScaleX
  const expressionY = eyesY - 98 * expressionScaleY
  const headSource = layers.expressionMap
    ? `<filter id="painted-expression" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="#808080" result="rest"/><feImage href="${layers.expressionMap}" x="${expressionX}" y="${expressionY}" width="${256 * expressionScaleX}" height="${256 * expressionScaleY}" preserveAspectRatio="none" result="expression-shape"/><feComposite in="expression-shape" in2="rest" operator="over" result="fitted-expression"/><feDisplacementMap in="SourceGraphic" in2="fitted-expression" scale="${layers.expressionIntensity ?? 18}" xChannelSelector="R" yChannelSelector="G"/></filter><g filter="url(#painted-expression)">${fittedFaceImage}</g>`
    : fittedFaceImage
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
    <g mask="url(#painted-shoulder-mask)"><use href="#painted-garment-source" transform="translate(${neckCenter} 0) scale(${torsoScale} 1) translate(${-neckCenter} 0)"/></g>`
  }
  // The collar wraps around the neck. Keep the painted sides while giving
  // the chin and the center of the throat a continuous clear opening.
  const collarLeft = neck[0] - 3
  const collarRight = neck[1] + 3
  clothing = `<defs><clipPath id="painted-neck-opening"><path d="M0 0H${collarLeft}V${chin - 3}Q${neckCenter} ${chin + 13} ${collarRight} ${chin - 3}V0H256V256H0Z"/></clipPath></defs><g clip-path="url(#painted-neck-opening)">${clothing}</g>`
  const gearPlacement = layers.gearPlacement ?? 'sash'
  const gearPositions = {
    sash: { left: -43, right: 50, top: -12, bottom: 79 },
    shoulder: { left: 35, right: 81, top: -6, bottom: 65 },
    waist: { left: -56, right: 46, top: 49, bottom: 118 },
    behind: { left: 43, right: 98, top: -24, bottom: 35 },
  }
  const gearPosition = gearPositions[gearPlacement]
  const gear = layers.gear
    ? `<image href="${layers.gear.href}" x="${neckCenter + gearPosition.left * torsoScale}" y="${shoulder + gearPosition.top}" width="${(gearPosition.right - gearPosition.left) * torsoScale}" height="${gearPosition.bottom - gearPosition.top}" preserveAspectRatio="xMidYMin meet"${layers.gear.filter ? ` filter="url(#${layers.gear.filter})"` : ''}/>`
    : ''
  const hairTarget = fittedHairTarget(hair, landmarks, layers.hairLength ?? 'short')
  let hairstyle = layerImage(hair, hairTarget)
  if (layers.hairAccent) {
    const { placement, filter } = layers.hairAccent
    const { origin, scaleY } = fitPortraitLayer(hair.anchors, hairTarget)
    const bottom = origin[1] + hair.height * scaleY
    const middle = (hairline + bottom) / 2
    const region = {
      split: '<path d="M130 0h126v256H124Z" fill="white"/>',
      streak: `<path d="M145 0h15Q156 71 ${temples[1]} 256h-15Q141 71 145 0Z" fill="white" filter="url(#painted-streak-edge)"/>`,
      tips: `<rect y="${middle}" width="256" height="${Math.max(1, bottom - middle)}" fill="url(#painted-hair-fade)"/>`,
      underlight: `<path d="M0 ${brow}Q145 ${middle} 256 ${brow + 6}v180H0Z" fill="#bcbcbc"/>`,
    }[placement]
    hairstyle = `<defs>
      <g id="painted-hair-source">${layerImage({ ...hair, filter: undefined }, hairTarget)}</g>
      <filter id="painted-streak-edge"><feGaussianBlur stdDeviation="1.5"/></filter>
      <linearGradient id="painted-hair-fade" x2="0" y2="1">
        <stop offset="0" stop-color="black"/><stop offset=".16" stop-color="white"/>
      </linearGradient>
      <mask id="painted-hair-accent">${region}</mask>
    </defs>
    <use href="#painted-hair-source" ${hair.filter ? `filter="url(#${hair.filter})"` : ''}/>
    <use href="#painted-hair-source" filter="url(#${filter})" mask="url(#painted-hair-accent)"/>`
  }
  const beard = layers.facialHair
    ? layerImage(layers.facialHair.layer, fittedFacialHairTarget(landmarks, layers.facialHair.fit))
    : ''
  const { hat, hatBack, fittedHair, accessory, accessoryBack } = fitPortraitAccessories(
    landmarks,
    hairstyle,
    headwear,
    facewear,
  )
  let shoulderHair = ''
  let frontHair = fittedHair
  if (layers.tuckHairBehindShoulders) {
    const split = chin + 4
    const cut = `M0 ${split + 18}Q128 ${split - 10} 256 ${split + 18}`
    const splitLayers = `<defs><g id="fitted-hair-paint">${fittedHair}</g>
      <clipPath id="hair-behind-shoulders"><path d="${cut}V256H0Z"/></clipPath>
      <clipPath id="hair-above-shoulders"><path d="${cut}V0H0Z"/></clipPath></defs>`
    shoulderHair = `${splitLayers}<use href="#fitted-hair-paint" clip-path="url(#hair-behind-shoulders)"/>`
    frontHair = '<use href="#fitted-hair-paint" clip-path="url(#hair-above-shoulders)"/>'
  }
  const size = icon ? 64 : 256
  const viewBox = icon ? '44 28 168 168' : '0 0 256 256'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
    ${layers.paintedFilters ? `<defs>${layers.paintedFilters}</defs>` : ''}
    ${backdrop}${gearPlacement === 'behind' ? gear : ''}${hatBack}${rearImage(hair, hairTarget)}${shoulderHair}${accessoryBack}
    ${neckUnderlay}${head}${layers.faceMarks ?? ''}${clothing}${gearPlacement === 'behind' ? '' : gear}${beard}${frontHair}${accessory}${hat}
  </svg>`
}
