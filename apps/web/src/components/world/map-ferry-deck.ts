import type { FerryPassage } from '@/world/ferry'
import { hashString, seeded } from '@/world/terrain-gen'
import type { WorldWind } from './map-weather'

type ProjectDeckPoint = (x: number, y: number) => { x: number; y: number }

export function ferryWaterFrame(
  passage: FerryPassage | undefined,
  serverNow: number,
  now: number,
  wind: WorldWind,
  animate: boolean,
) {
  const underway = Boolean(
    passage && serverNow >= passage.departureAt && serverNow < passage.arrivalAt,
  )
  const elapsed = passage ? Math.max(0, serverNow - passage.departureAt) / 1_000 : 0
  const remaining = passage ? Math.max(0, passage.arrivalAt - serverNow) / 1_000 : Infinity
  const mainlandOrigin =
    passage?.direction === 'outbound' || passage?.direction === 'asterwake-outbound'
  const shore = !passage
    ? null
    : serverNow < passage.arrivalAt && elapsed < 22
      ? ({
          coast: mainlandOrigin ? 'pine' : 'cliff',
          arriving: false,
          offset: animate ? elapsed / 22 : 0,
        } as const)
      : remaining < 24
        ? ({
            coast: mainlandOrigin ? 'cliff' : 'pine',
            arriving: true,
            offset: animate ? remaining / 24 : 0,
          } as const)
        : null
  return {
    underway,
    sighting: passage && underway && animate ? ferrySeaSighting(passage, elapsed) : null,
    advance: underway && animate ? elapsed * 24 : 0,
    shore,
    chop: Math.min(1, Math.abs(wind.speed) / 0.055),
    phase: animate ? now / 1_000 : 0,
    drift: animate ? wind.offset : 0,
    wind: wind.speed,
  }
}

const ferryVesselVersions = ['v02', 'v03', 'v04'] as const

export function ferryVesselVersion(sectorId: string) {
  return ferryVesselVersions[hashString(sectorId) % ferryVesselVersions.length]!
}

type FerryWaterFrame = ReturnType<typeof ferryWaterFrame>

const sightingKinds = ['dolphins', 'gulls', 'shoal', 'whale'] as const

/** Derive sightings from the sailing clock so deckmates see the same crossing. */
export function ferrySeaSighting(passage: FerryPassage, elapsed: number) {
  const openWater = elapsed - 25
  if (openWater < 0 || elapsed > 270) return null
  const slot = Math.floor(openWater / 38)
  const random = seeded(`${passage.direction}:${passage.departureAt}:${slot}`)
  const duration = 8 + Math.floor(random() * 5)
  const age = (openWater % 38) - (3 + Math.floor(random() * 13))
  if (age < 0 || age >= duration) return null
  return {
    kind: sightingKinds[Math.floor(random() * sightingKinds.length)]!,
    progress: age / duration,
    lane: random() < 0.5 ? 0.19 : 0.81,
    count: 2 + Math.floor(random() * 3),
  }
}

type SeaArt = {
  pine?: HTMLImageElement
  cliff?: HTMLImageElement
  dolphin?: HTMLImageElement
}

function ready(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return Boolean(image?.complete && image.naturalWidth)
}

function paintFerrySighting(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sighting: NonNullable<FerryWaterFrame['sighting']>,
  dolphin?: HTMLImageElement,
) {
  const { kind, progress, lane, count } = sighting
  const scale = Math.min(1.3, Math.max(0.65, width / 900))
  const forward = kind === 'gulls' ? 1 : -1
  const x = width * (0.5 + forward * (progress - 0.5) * 1.27)
  const y = height * lane + (progress - 0.5) * 22
  context.save()
  context.translate(x, y)
  context.scale(scale, scale)
  if (kind === 'dolphins' && ready(dolphin)) {
    for (let i = 0; i < count; i++) {
      const phase = (progress * 2.4 + i * 0.31) % 1
      const leap = Math.sin(phase * Math.PI)
      const dx = i * 28
      const dy = (i % 2) * 16
      context.save()
      context.translate(dx, dy - 23 * leap)
      context.rotate((phase - 0.4) * -1.2)
      context.globalAlpha = Math.min(1, leap * 2.1)
      context.drawImage(dolphin, -20, -11, 40, 26.67)
      context.restore()
      context.strokeStyle = `rgba(194,226,218,${(1 - leap) * 0.62})`
      context.beginPath()
      context.ellipse(dx, dy + 5, 10 + phase * 10, 3 + phase * 2, 0, 0, Math.PI * 2)
      context.stroke()
    }
  } else if (kind === 'gulls') {
    for (let i = 0; i < count + 1; i++) {
      const wing = Math.sin(progress * 41 + i * 1.7) * 6
      const dx = -i * 21
      const dy = (i % 3) * 10
      context.strokeStyle = '#e4e9d9'
      context.lineWidth = 1.8
      context.beginPath()
      context.moveTo(dx - 8, dy - wing)
      context.quadraticCurveTo(dx - 4, dy - 4, dx, dy + 1)
      context.quadraticCurveTo(dx + 5, dy - 2, dx + 9, dy - wing)
      context.stroke()
    }
  } else if (kind === 'whale') {
    const surface = Math.sin(progress * Math.PI)
    context.globalAlpha = surface * 0.62
    context.fillStyle = '#183d49'
    context.beginPath()
    context.ellipse(0, 0, 44, 10, 0.19, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = '#a4d2cc'
    context.beginPath()
    context.ellipse(0, 6, 49 + surface * 7, 12, 0.19, 0, Math.PI * 2)
    context.stroke()
    const mist = context.createRadialGradient(-22, -12, 1, -22, -12, 14)
    mist.addColorStop(0, 'rgba(223,240,230,.85)')
    mist.addColorStop(1, 'rgba(223,240,230,0)')
    context.fillStyle = mist
    context.fillRect(-36, -26, 28, 28)
  } else {
    for (let i = 0; i < count * 4; i++) {
      const glint = Math.max(0, Math.sin(progress * 42 + i * 2.4))
      const dx = (i * 19) % 81
      const dy = ((i * 37) % 29) + Math.sin(progress * 15 + i) * 3
      context.strokeStyle = `rgba(179,221,218,${glint * 0.54})`
      context.beginPath()
      context.moveTo(dx, dy)
      context.quadraticCurveTo(dx + 3, dy - 2, dx + 7, dy)
      context.stroke()
    }
  }
  context.restore()
}

export function paintFerrySea(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  deck: { x: number; y: number },
  tile: number,
  frame: FerryWaterFrame,
  lowDetail: boolean,
  art: SeaArt,
) {
  const depth = context.createLinearGradient(0, 0, width * 0.2, height)
  depth.addColorStop(0, '#386774')
  depth.addColorStop(0.55, '#254f60')
  depth.addColorStop(1, '#173a4d')
  context.fillStyle = depth
  context.fillRect(0, 0, width, height)

  // Relative motion follows the passage clock even when weather is completely calm.
  const waveCount = lowDetail ? 18 : 42
  const wrap = (value: number, span: number) => ((value % span) + span) % span
  context.lineWidth = 0.8
  for (let i = 0; i < waveCount; i++) {
    const depth = ((i * 43) % 97) / 97
    const speed = 0.42 + depth * 0.58
    const x = wrap(i * 173.17 + frame.drift * 0.2 - frame.advance * speed, width + 72) - 36
    const y = wrap(i * 103.63 - frame.advance * speed * 0.24, height + 20) - 10
    const length = 12 + depth * 48
    const lift = Math.sin(frame.phase * (1.4 + depth) + i) * (2 + frame.chop * 3)
    const alpha = (0.11 + depth * 0.1) * (0.65 + frame.chop * 0.65)
    context.strokeStyle = `rgba(164,213,210,${alpha})`
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + length * 0.42, y - 4 + lift, x + length, y + lift * 0.6)
    context.stroke()
  }
  const coast = frame.shore ? art[frame.shore.coast] : undefined
  if (frame.shore && ready(coast)) {
    const { arriving, offset } = frame.shore
    const coastWidth = 27 * tile
    const coastHeight = coastWidth * (coast.naturalHeight / coast.naturalWidth)
    const x = deck.x - coastWidth / 2 + (arriving ? 1.5 : -1.5) * tile
    const y = deck.y - coastHeight - (1.5 + offset * 10) * tile
    context.drawImage(coast, x, y, coastWidth, coastHeight)
  }
  if (frame.sighting) paintFerrySighting(context, width, height, frame.sighting, art.dolphin)
}

export function paintFerryHull(
  context: CanvasRenderingContext2D,
  project: ProjectDeckPoint,
  tile: number,
  frame: FerryWaterFrame,
  lowDetail: boolean,
  hull?: HTMLImageElement,
) {
  const stern = project(1.25, 4.5)
  const bow = project(11.75, 4.5)
  const hullDepth = Math.max(6, tile * 0.58)
  context.save()
  context.translate(stern.x, stern.y + hullDepth * 0.7)
  context.rotate(Math.atan2(bow.y - stern.y, bow.x - stern.x))
  if (frame.underway) {
    const wash = lowDetail ? 2 : 4
    for (const side of [-1, 1]) {
      for (let i = 0; i < wash; i++) {
        const length = tile * (2.1 + i * 0.76)
        const spread = tile * side * (0.32 + i * 0.19)
        const drift = Math.sin(frame.phase * 2.4 - i * 1.7) * tile * (0.07 + frame.chop * 0.08)
        context.strokeStyle = `rgba(199,233,222,${0.53 - i * 0.09})`
        context.lineWidth = Math.max(1, tile * (0.035 - i * 0.004))
        context.beginPath()
        context.moveTo(tile * 0.42, spread * 0.5)
        context.bezierCurveTo(
          -length * 0.24,
          spread * 0.25 + drift,
          -length * 0.72,
          spread * 1.6 - drift,
          -length,
          spread * 2 + drift,
        )
        context.stroke()
      }
    }
  }
  context.restore()

  const center = project(6.5, 4.5)
  const bowStep = project(7.5, 4.5)
  const nearStep = project(6.5, 5.5)
  if (ready(hull)) {
    // Source floor anchors in the 1536 × 1024 painting. The same world-space
    // grid projects avatars, wake, coast and pointer coordinates.
    const sourceBow = { x: 111, y: 44 }
    const sourceNear = { x: -34, y: 18 }
    const determinant = sourceBow.x * sourceNear.y - sourceNear.x * sourceBow.y
    const a =
      ((bowStep.x - center.x) * sourceNear.y - (nearStep.x - center.x) * sourceBow.y) / determinant
    const b =
      ((bowStep.y - center.y) * sourceNear.y - (nearStep.y - center.y) * sourceBow.y) / determinant
    const c =
      ((nearStep.x - center.x) * sourceBow.x - (bowStep.x - center.x) * sourceNear.x) / determinant
    const d =
      ((nearStep.y - center.y) * sourceBow.x - (bowStep.y - center.y) * sourceNear.x) / determinant
    context.save()
    context.transform(a, b, c, d, center.x, center.y)
    context.drawImage(hull, -700, -648, 1536, 1024)
    context.restore()
    return
  }

  // Keep the deck legible while the painting downloads.
  context.save()
  context.translate(center.x, center.y)
  context.rotate(Math.atan2(bow.y - stern.y, bow.x - stern.x))
  context.fillStyle = '#785538'
  context.strokeStyle = '#443531'
  context.lineWidth = tile * 0.12
  context.beginPath()
  context.ellipse(0, 0, tile * 6, tile * 2.8, 0, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.restore()
}
