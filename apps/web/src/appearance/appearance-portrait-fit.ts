type Point = readonly [x: number, y: number]
export const PORTRAIT_TEMPLE_FRACTION = 0.86

export type PortraitAnchors = Readonly<{
  left: number
  right: number
  top: number
  bottom: number
}>

type PaintedLayer = Readonly<{
  href: string
  rearHref?: string
  crownOpening?: number
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
  irisRatio?: number
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
  adjustment: Point = [0, 0],
): PortraitAnchors {
  const { temples, hairline, brow } = landmarks
  const headWidth = temples[1] - temples[0]
  if (hair.crownOpening !== undefined) {
    // Register the painted part at the scalp and keep the opening around
    // the face. Long locks keep their length independently of the crown.
    const span = hair.anchors.right - hair.anchors.left
    const opening = hair.crownOpening * hair.height
    const targetOpening = hairline + (brow - hairline) * 0.34
    const scale = Math.min(
      (headWidth * 1.05) / span,
      (headWidth * (length === 'long' ? 1.95 : 1.71)) / hair.width,
      (targetOpening - 6) / Math.max(1, opening),
    )
    const center = (temples[0] + temples[1]) / 2
    return {
      left: center - (span * scale) / 2 + adjustment[0],
      right: center + (span * scale) / 2 + adjustment[0],
      top: targetOpening + (hair.anchors.top - opening) * scale + adjustment[1],
      bottom: targetOpening + (hair.anchors.bottom - opening) * scale + adjustment[1],
    }
  }
  const [left, right] = boundedFittingWidth(
    hair,
    temples[0],
    temples[1],
    headWidth * (length === 'long' ? 1.45 : 1.29),
  )
  const horizontalScale = (right - left) / (hair.anchors.right - hair.anchors.left)
  const guideHeight = hair.anchors.bottom - hair.anchors.top
  const opening = hairline + (brow - hairline) * 0.44
  const sourceOpening = (hair.anchors.top + hair.anchors.bottom) / 2
  const verticalSpan = Math.min(
    brow - hairline,
    guideHeight * horizontalScale * 1.18,
    ((opening - 7) * guideHeight) / sourceOpening,
  )
  return {
    left: left + adjustment[0],
    right: right + adjustment[0],
    top: opening - verticalSpan / 2 + adjustment[1],
    bottom: opening + verticalSpan / 2 + adjustment[1],
  }
}

export function clearShortHairFromFace(
  hair: string,
  { eyes, eyesY, chin, temples }: PortraitFaceLandmarks,
  id: string,
) {
  const left = (eyes[0] + temples[0]) / 2
  const right = (eyes[1] + temples[1]) / 2
  const mid = (left + right) / 2
  return `<clipPath id="${id}"><path clip-rule="evenodd" d="M0 0H256V256H0Z M${left} ${eyesY - 2}Q${mid} ${eyesY - 8} ${right} ${eyesY - 2}L${eyes[1]} ${chin}H${eyes[0]}Z"/></clipPath><g clip-path="url(#${id})">${hair}</g>`
}

type HairPlacement = 'split' | 'tips' | 'streak' | 'underlight' | 'ombre' | 'ribbons'

export function fittedFacialHairTarget(
  { mouth, nose, chin, neck, temples }: PortraitFaceLandmarks,
  fit: FacialHairFit,
): PortraitAnchors {
  const [center, lip] = mouth ?? [(neck[0] + neck[1]) / 2, nose + 16]
  if (fit === 'upperLip') {
    return { left: center - 14, right: center + 14, top: lip - 6, bottom: lip + 1 }
  }
  if (fit === 'chin') {
    return { left: center - 9, right: center + 9, top: lip + 2, bottom: chin + 0.8 }
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
  landmarks: PortraitFaceLandmarks
  neckPigment: readonly [light: string, shadow: string]
  hair: PaintedLayer
  hairLength?: 'short' | 'long'
  rootedHair?: boolean
  clearCheeks?: boolean
  garment: PaintedLayer
  lowCollar?: boolean
  paintedFilters?: string
  expressionMap?: string
  expressionIntensity?: number
  faceMarks?: string
  torsoScale?: number
  gear?: PaintedLayer
  gearPlacement?: 'sash' | 'shoulder' | 'waist' | 'behind'
  facialHair?: Readonly<{ layer: PaintedLayer; fit: FacialHairFit }>
  hairAdjustment?: Point
  hairAccent?: Readonly<{ filter: string; placement: HairPlacement; highlight?: string }>
  eyeFilters?: readonly [viewerLeft?: string, viewerRight?: string]
  irisAccent?: Readonly<{ filter: string; pattern: 'central' | 'sectoral' }>
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
    const band = hood ? hairline + 9 : closedCrown ? brow - 3 : brow - 8
    const padding = hood ? 15 : closedCrown ? 8 : 3
    const guides = headwear.layer.anchors
    const headWidth = temples[1] - temples[0]
    const brimWidth = headwear.wideBrim ? 1.68 : hood ? 1.5 : closedCrown ? 1.55 : 1.14
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
      const left = temples[0] - 4
      const right = temples[1] + 4
      const crownCenter = (left + right) / 2
      fittedHair = `<clipPath id="${clip}"><path d="M${left} ${band - 3}Q${crownCenter} ${band - 13} ${right} ${band - 3}L${right + 4} ${eyesY + 10}L256 ${chin + 6}V256H0V${chin + 6}L${left - 4} ${eyesY + 10}Z"/></clipPath><g clip-path="url(#${clip})">${hairstyle}</g>`
    }
  }

  let accessory = ''
  let accessoryBack = ''
  if (facewear?.kind === 'lenses' || facewear?.kind === 'mask') {
    const lenses = facewear.kind === 'lenses'
    const [left, right] = lenses
      ? boundedFittingWidth(facewear.layer, eyes[0], eyes[1], (temples[1] - temples[0]) * 1.23)
      : eyes
    const opening = lenses ? Math.min(9, (right - left) * 0.18) : 9
    const lensTarget = {
      left,
      right,
      top: eyesY - opening,
      bottom: eyesY + opening,
    }
    const lensImage = layerImage(facewear.layer, lensTarget)
    accessoryBack = rearImage(facewear.layer, lensTarget)
    if (lenses) {
      const lensRadius = (eyes[1] - eyes[0]) * 0.31
      const mask = `${scope}-lens-transmission`
      accessory = `<defs><mask id="${mask}"><rect width="256" height="256" fill="white"/>${eyes.map((x) => `<ellipse cx="${x}" cy="${eyesY}" rx="${lensRadius}" ry="${opening}" fill="#141414"/>`).join('')}</mask></defs><g mask="url(#${mask})">${lensImage}</g>`
    } else {
      accessory = lensImage
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
  // Fade the painted crop into skin below the jaw, where some bases end in a
  // flat edge. Keep the jaw and its shading fully opaque.
  const fittedFaceImage = `<defs>
    <linearGradient id="painted-neck-feather" gradientUnits="userSpaceOnUse" x2="0" y1="${chin + 12}" y2="${chin + 35}">
      <stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <mask id="painted-neck-fit" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
      <rect width="256" height="256" fill="url(#painted-neck-feather)"/>
    </mask>
  </defs><g mask="url(#painted-neck-fit)">${faceImage}</g>`
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
  const irisRadius = (eyes[1] - eyes[0]) * (landmarks.irisRatio ?? 0.105)
  const irisHeight = irisRadius * (landmarks.irisRatio ? 0.94 : 1.17)
  let irisOverlay =
    layers.eyeFilters
      ?.map((filter, index) => {
        if (!filter) return ''
        const clip = `painted-iris-${index}`
        return `<mask id="${clip}"><ellipse cx="${eyes[index]}" cy="${eyesY}" rx="${irisRadius}" ry="${irisHeight}" fill="white" filter="url(#painted-iris-rolloff)"/></mask><g mask="url(#${clip})" opacity=".82"><use href="#painted-head-source" filter="url(#${filter})"/></g>`
      })
      .join('') ?? ''
  if (irisOverlay) {
    irisOverlay =
      '<defs><filter id="painted-iris-rolloff"><feGaussianBlur stdDeviation=".62"/></filter></defs>' +
      irisOverlay
  }
  if (layers.irisAccent) {
    const x = eyes[0]
    const shape =
      layers.irisAccent.pattern === 'central'
        ? `<ellipse cx="${x}" cy="${eyesY}" rx="${irisRadius * 0.56}" ry="${irisRadius * 0.62}"/>`
        : `<path d="M${x} ${eyesY - irisHeight}a${irisRadius} ${irisHeight} 0 0 1 0 ${irisHeight * 2}Z"/>`
    irisOverlay += `<clipPath id="painted-iris-accent">${shape}</clipPath><g clip-path="url(#painted-iris-accent)"><use href="#painted-head-source" filter="url(#${layers.irisAccent.filter})"/></g>`
  }
  const blendRoots = layers.rootedHair && (!headwear || headwear.kind === 'circlet')
  const head =
    irisOverlay || blendRoots
      ? `<defs><g id="painted-head-source">${headSource}</g></defs><use href="#painted-head-source"/>${irisOverlay}`
      : headSource
  const upperNeck = (neck[1] - neck[0]) * 0.34
  const neckUnderlay = `<defs>
    <linearGradient id="neck-continuation" x1="0" y1="0" x2=".92" y2=".37">
      <stop stop-color="${neckPigment[1]}"/>
      <stop offset=".65" stop-color="${neckPigment[0]}"/>
      <stop offset="1" stop-color="${neckPigment[1]}"/>
    </linearGradient>
    <linearGradient id="neck-contact-shade" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="${neckPigment[1]}" stop-opacity=".45"/>
      <stop offset="1" stop-color="${neckPigment[1]}" stop-opacity="0"/>
    </linearGradient>
    <path id="neck-contour" d="M${neckCenter - upperNeck} ${chin + 3}Q${neckCenter} ${chin - 9} ${neckCenter + upperNeck} ${chin + 3}
      C${neck[1] + 9} ${chin + 7} ${neck[1] + 19} ${shoulder - 7} ${neck[1] + 25} ${shoulder + 11}
      L${neck[1] + 27} ${shoulder + 40}H${neck[0] - 27}L${neck[0] - 25} ${shoulder + 11}C${neck[0] - 19} ${shoulder - 7} ${neck[0] - 9} ${chin + 7} ${neckCenter - upperNeck} ${chin + 3}Z"/>
  </defs>
  <use href="#neck-contour" fill="url(#neck-continuation)"/>
  <use href="#neck-contour" fill="url(#neck-contact-shade)"/>`
  const torsoScale = layers.torsoScale ?? 1
  // Fit the whole garment once. A crossfade between two sized copies leaves
  // transparent folds and double edges across the shoulders.
  const garmentScale = 1 + (torsoScale - 1) * 0.8
  // The neck locates the collar, but its width is a poor proxy for the
  // shoulders. Keep lighter outfits distinct without shrinking the whole
  // silhouette around a narrow jaw or a slender build.
  const faceWidth = (temples[1] - temples[0]) / PORTRAIT_TEMPLE_FRACTION
  const neckSpan = neck[1] - neck[0]
  const sourceCollarSpan = garment.anchors.right - garment.anchors.left
  const naturalWidth = (neckSpan * garmentScale * garment.width) / sourceCollarSpan
  const minimumWidth = Math.max(238, faceWidth * 2.45) * garmentScale
  const garmentWidth = Math.min(
    Math.max(260, minimumWidth),
    faceWidth * 2.8 * garmentScale,
    Math.max(minimumWidth, naturalWidth),
  )
  const collarSpan = (garmentWidth * sourceCollarSpan) / garment.width / 2
  const garmentImage = layerImage(garment, {
    left: neckCenter - collarSpan,
    right: neckCenter + collarSpan,
    top: chin + (layers.lowCollar ? 5 : 1),
    bottom: layers.lowCollar
      ? chin + 5 + ((garment.anchors.bottom - garment.anchors.top) * garmentWidth) / garment.width
      : shoulder,
  })
  // The collar wraps around the neck. Keep the painted sides while giving
  // the chin and the center of the throat a continuous clear opening.
  const collarLeft = neck[0] - 3
  const collarRight = neck[1] + 3
  const opening = `M0 0H${collarLeft}V${chin - 3}Q${neckCenter} ${chin + 9} ${collarRight} ${chin - 3}V0H256V256H0Z`
  const clothing = `<defs><clipPath id="painted-neck-opening"><path d="${opening}"/></clipPath></defs><g clip-path="url(#painted-neck-opening)">${garmentImage}</g>`
  const gearPlacement = layers.gearPlacement ?? 'sash'
  const gearPositions = {
    sash: { left: -43, right: 50, top: -12, bottom: 79 },
    shoulder: { left: 35, right: 81, top: -6, bottom: 65 },
    waist: { left: -56, right: 46, top: 49, bottom: 118 },
    behind: { left: 43, right: 98, top: -24, bottom: 35 },
  }
  const gearPosition = gearPositions[gearPlacement]
  const gearScale = Math.min(torsoScale, garmentWidth / 196)
  const gearTop =
    gearPlacement === 'waist'
      ? Math.max(shoulder + gearPosition.top, 248)
      : shoulder + gearPosition.top
  const gear = layers.gear
    ? `<image href="${layers.gear.href}" x="${neckCenter + gearPosition.left * gearScale}" y="${gearTop}" width="${(gearPosition.right - gearPosition.left) * gearScale}" height="${gearPosition.bottom - gearPosition.top}" preserveAspectRatio="xMidYMin meet"${layers.gear.filter ? ` filter="url(#${layers.gear.filter})"` : ''}/>`
    : ''
  const hairTarget = fittedHairTarget(
    hair,
    landmarks,
    layers.hairLength ?? 'short',
    layers.hairAdjustment,
  )
  let hairstyle = layerImage(hair, hairTarget)
  if (layers.hairAccent) {
    const { placement, filter, highlight } = layers.hairAccent
    const { origin, scaleY } = fitPortraitLayer(hair.anchors, hairTarget)
    const bottom = origin[1] + hair.height * scaleY
    const middle = (hairline + bottom) / 2
    const region = {
      split: '<path d="M130 0h126v256H124Z" fill="white"/>',
      streak: `<path d="M145 0h15Q156 71 ${temples[1]} 256h-15Q141 71 145 0Z" fill="white" filter="url(#painted-streak-edge)"/>`,
      tips: `<rect y="${middle}" width="256" height="${Math.max(1, bottom - middle)}" fill="url(#painted-hair-fade)"/>`,
      underlight: `<path d="M0 ${brow}Q145 ${middle} 256 ${brow + 6}v180H0Z" fill="#bcbcbc"/>`,
      ombre: '<rect width="256" height="256" fill="url(#painted-ombre-fade)"/>',
      ribbons: `<path d="M${hairTarget.left + 7} 0q-8 75 22 256h-11Q${hairTarget.left - 14} 75 ${hairTarget.left - 4} 0ZM${hairTarget.right - 12} 0q18 75 9 256h-9q7-184-11-256Z" fill="white" filter="url(#painted-streak-edge)"/>`,
    }[placement]
    hairstyle = `<defs>
      <g id="painted-hair-source">${layerImage({ ...hair, filter: undefined }, hairTarget)}</g>
      <filter id="painted-streak-edge"><feGaussianBlur stdDeviation="1.5"/></filter>
      <linearGradient id="painted-hair-fade" x2="0" y2="1">
        <stop offset="0" stop-color="black"/><stop offset=".16" stop-color="white"/>
      </linearGradient>
      <linearGradient id="painted-ombre-fade" gradientUnits="userSpaceOnUse" x2="0" y1="${hairline}" y2="${bottom}">
        <stop stop-color="black"/><stop offset=".42" stop-color="black"/><stop offset="1" stop-color="white"/>
      </linearGradient>
      <mask id="painted-hair-accent">${region}</mask>
      ${highlight ? `<mask id="painted-hair-highlight"><path d="M${hairTarget.left + 16} 0q-5 90 31 256h-12q-30-161-31-256Z" fill="white" filter="url(#painted-streak-edge)"/></mask>` : ''}
    </defs>
    <use href="#painted-hair-source" ${hair.filter ? `filter="url(#${hair.filter})"` : ''}/>
    <use href="#painted-hair-source" filter="url(#${filter})" mask="url(#painted-hair-accent)"/>
    ${highlight ? `<use href="#painted-hair-source" filter="url(#${highlight})" mask="url(#painted-hair-highlight)"/>` : ''}`
  }
  const beard = layers.facialHair
    ? layerImage(layers.facialHair.layer, fittedFacialHairTarget(landmarks, layers.facialHair.fit))
    : ''
  const { hat, hatBack, fittedHair, accessory, accessoryBack } = fitPortraitAccessories(
    landmarks,
    layers.clearCheeks
      ? clearShortHairFromFace(hairstyle, landmarks, 'portrait-short-fringe')
      : hairstyle,
    headwear,
    facewear,
  )
  // Project the painted fringe onto the actual skin silhouette. Restrict the
  // contact shade to the hairline and temples so it cannot tint the eyes or
  // show as a halo against a light backdrop.
  const rootShadow = blendRoots
    ? `<defs><g id="painted-root-hair">${fittedHair}</g>
      <filter id="painted-root-contact" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.45"/>
        <feOffset dx=".15" dy="1.05" result="contact"/>
        <feFlood flood-color="${neckPigment[1]}" flood-opacity=".54"/>
        <feComposite in2="contact" operator="in"/>
      </filter>
      <mask id="painted-root-skin" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <use href="#painted-head-source"/>
      </mask>
      <linearGradient id="painted-root-rolloff" gradientUnits="userSpaceOnUse" x2="0" y1="${hairline + 5}" y2="${brow + 1}">
        <stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <mask id="painted-root-region" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="${brow + 1}">
        <rect width="256" height="${brow + 1}" fill="url(#painted-root-rolloff)"/>
      </mask></defs>
      <g mask="url(#painted-root-region)"><g mask="url(#painted-root-skin)">
        <use href="#painted-root-hair" filter="url(#painted-root-contact)"/>
      </g></g>`
    : ''
  const hairPaint = blendRoots ? '<use href="#painted-root-hair"/>' : fittedHair
  // The longer locks grow behind the cheek. Reuse the painted fringe above
  // the brow so moving it behind the head never makes the scalp show through.
  const layeredHair =
    hair.crownOpening !== undefined
      ? `<defs>
      <g id="fitted-hair-paint">${hairPaint}</g>
      <filter id="fringe-contact-rolloff"><feGaussianBlur stdDeviation="1.5"/></filter>
      <mask id="painted-fringe-fit">
        <rect width="256" height="256" fill="white"/>
        <path d="M${eyes[0] - 12} ${eyesY + 4} Q${eyes[0] - 13} ${brow - 3} ${eyes[0]} ${brow - 3}
          H${eyes[1]} Q${eyes[1] + 13} ${brow - 3} ${eyes[1] + 12} ${eyesY + 4}
          Q${eyes[1] + 7} ${chin - 8} ${neckCenter} ${chin + 1}
          Q${eyes[0] - 7} ${chin - 8} ${eyes[0] - 12} ${eyesY + 4}Z"
          fill="black" filter="url(#fringe-contact-rolloff)"/>
      </mask>
    </defs>`
      : ''
  const hairBack = layeredHair ? '<use href="#fitted-hair-paint"/>' : ''
  const frontHair = layeredHair
    ? '<use href="#fitted-hair-paint" mask="url(#painted-fringe-fit)"/>'
    : hairPaint
  const size = icon ? 64 : 256
  const viewBox = icon ? '44 28 168 168' : '0 0 256 256'
  // Scale the head and its fittings together around the base of the jaw.
  // The collar stays on the body registration and overlaps the neck below it.
  const crownWidth = hair.width * fitPortraitLayer(hair.anchors, hairTarget).scaleX
  const headEnvelope = Math.max(faceWidth, crownWidth)
  const headScale = icon ? 1 : Math.min(0.93, Math.max(0.79, (garmentWidth * 0.485) / headEnvelope))
  const headTransform = `translate(${neckCenter} ${chin}) scale(${headScale}) translate(${-neckCenter} ${-chin})`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
    ${layers.paintedFilters ? `<defs>${layers.paintedFilters}</defs>` : ''}
    ${backdrop}${gearPlacement === 'behind' ? gear : ''}
    <g transform="${headTransform}">${layeredHair}${hatBack}${rearImage(hair, hairTarget)}${hairBack}${accessoryBack}</g>
    ${neckUnderlay}<g transform="${headTransform}">${head}${layers.faceMarks ?? ''}</g>${clothing}${gearPlacement === 'behind' ? '' : gear}
    <g transform="${headTransform}">${beard}${accessory}${rootShadow}${frontHair}${hat}</g>
  </svg>`
}
