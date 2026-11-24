import { groundMaterialPreview } from './map-ground-preview'
import type { MapDirection } from '@/world/wild-ids'
import { colosseumDetailArt } from './map-colosseum-detail-art'
import { asterwakeOceanFringes, asterwakeShore, paintAsterwakeShore } from './asterwake-shore'
import { createMapPortraitCrops } from './map-portrait-crops'
import { createMapActorFrames } from './map-actor-frames'
import { createGroundProjectionCache, drawGroundSurface } from './map-ground-projection'
import {
  releaseStaticRaster,
  snapshotStaticRaster,
  type StaticMapRaster,
} from './map-static-raster'
import { bridgeDeckArt, bridgeDeckPoint, type BridgeDeck } from './map-bridge-deck'
import { mapSceneDomain } from './map-scene-domain'
import { ferryPierPlacement, paintFerryPier } from './map-ferry-pier'
import {
  forestCanopy,
  groveCompanion,
  mainlandTreeIndex,
  vegetationPose,
  treeFlex,
  treeWindBend,
} from './map-vegetation'
import { OFFSHORE_DISCOVERY } from '@/world/discovery-sites'
import {
  indexMountainPlacements,
  isMajorMountainRangeSector,
  denseMountainRidge,
  drawMountainScree,
} from './map-mountains'
import { worldDayPhase } from '@/world/environment'
import { createWorldLightingCache, paintWorldLighting } from './map-daylight'
import {
  APPEARANCE_ASSET_PREFIX,
  APPEARANCE_FRAME,
  appearanceManifestFromImageUrl,
  appearanceMotionFrameIndex,
  appearanceWalkFrame,
  type AppearanceFacing,
} from '@/appearance/appearance-manifest'
import { KEY_LOOKAHEAD_STEPS, walkOffset } from '@/world/directional-walk'
import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import {
  FERRY_NORTH_DOCK,
  FERRY_ASTERWAKE_DOCK,
  FERRY_CONVERSATION_ID,
  ferryAtPort,
  isFerryTerminalLandmark,
} from '@/world/ferry'
import { hashString } from '@/world/terrain-gen'
import {
  ASTERWAKE_GOLDEN_TREE,
  ASTERWAKE_GOLDEN_TREE_ID,
  ASTERWAKE_REGION_ID,
} from '@/world/asterwake'
import type {
  WorldAtlasCell,
  WorldBuilding,
  WorldCell,
  WorldLandmark,
  WorldPosition,
  WorldSectorView,
  WorldView,
} from '@/world/types'
import {
  ATLAS_ROWS,
  sectorMapOrigin,
  wrapAtlasColumn,
  wrappedMapX,
  WORLD_MAP_WIDTH,
} from '@/world/topology'
import { mapPoint, type MapPoint, WorldMotion } from './world-motion'
import { WorldPlayerMotion } from './map-player-motion'
import { clampWorldZoom } from './world-zoom'
import { samePosition } from '@/world/travel'
import { isLocalVoidWalk, isVoidRealmSectorId } from '@/world/void-realms'
import { retainWorldSceneReferences } from '@/world/presence'
import {
  createCloudTexture,
  createWildlife,
  wildlifePose,
  wildlifeVisible,
  type Wildlife,
  type WildlifePose,
} from './map-ambient'
import {
  buildWaterField,
  clipWaterSurface,
  isWaterTerrain,
  liquidMaterial,
  paintLavaMotion,
  paintLavaGround,
  type WaterCell,
  paintWaterGround,
  paintWaterMotion,
  paintWaterfallMotion,
} from './map-water'
import {
  buildPublicCoasts,
  paintCoastLand,
  paintCoastSea,
  paintOpenSea,
  publicGroundCoversViewport,
  publicCoastEdges,
} from './map-coast'
import {
  advanceSurfaceRain,
  advanceWorldWind,
  airborneMoteProfile,
  paintPrecipitation,
  paintTerrainAtmosphere,
  paintWeatherVeil,
  createWeatherVeilCache,
  precipitationKind,
  surfaceRainTarget,
  terrainHeatEmitters,
  worldWindTarget,
  type WorldWind,
} from './map-weather'
import { createWildlifePartCache, drawWildlife } from './map-wildlife'
import { buildBiomeTransitions } from './map-biome-transitions'

import { worldRenderTerrain } from './map-render-terrain'
import { settlementComposition } from './map-settlement-composition'
import { buildSettlementGround, paintSettlementEdges } from './map-settlement-edge'
import {
  hamletFamilyIndex,
  naturalDressing,
  regionalScenery,
  paintTownLight,
  paintVoidGlimmer,
  sceneryDressing,
} from './map-dressing'
import { DEFAULT_MAP_QUALITY, mapQualityBudgets, type MapQuality } from './map-quality'
import { buildTrailGround, naturalTrailWear, paintNaturalTrail } from './map-trail'
import { paintSnowRoadShoulders } from './map-snow-road'
import { paintTerrainRelief, paintTerrainContours } from './map-relief'
import { impactSite, paintImpactGround } from './map-impact'
import {
  grandBridgeArt,
  grandBridgeDiscoveryArt,
  landmarkArtSize,
  lavaFallSite,
  waterfallArt,
} from './map-surface-art'
import { grandDiscoveryPlacements, oceanFeaturePlacements } from './map-grand-discoveries'
import { ShallowWaterRipples } from './map-shallow-ripples'
import { colosseumArenaMaterial, valleyDetailArt } from './map-grand-detail-art'
import { townArchitectureArt, crownWallArt, crownWallSegments } from './map-town-architecture'
import { settlementFloorIndex } from './map-settlement-floor'
import { ferryWaterFrame, paintFerryHull, paintFerryRig, paintFerrySea } from './map-ferry-deck'
import { buildWarpedTerrainEdges, paintWarpedScree, WARPED_GROUND_COLOR } from './map-warped-ground'
import {
  regionalBuildingIndex,
  legacyStructureContact,
  settlementChimneys,
  townPaving,
  warpedChimneys,
  warpedPalette,
  winterChimneys,
  WORLD_STRUCTURE_ASPECT,
  WORLD_STRUCTURE_FLOOR,
  type Chimney,
} from './map-regional-art'
import { createChimneyPuff, paintChimneySmoke } from './map-chimney'

import { MAP_X, MAP_Y, mapWalkFacing, projectMapPoint, unprojectMapPoint } from './map-projection'

const BASE = '/media/art/world/runtime/'
const WINTER_ART = 'frostmere'
const WINTER_ATLAS_ASPECT = 336 / 384

function winterBuildingIndex(sector: WorldSectorView, building: WorldBuilding) {
  if (sector.regionId !== 'frostmere') return
  if (building.propIndex === 0) return 3
  if (building.artIndex !== 2) return
  if (sector.id === 'frostmere' && building.x === 4) return 0
  if (sector.id === 'frostmere' && building.x === 8) return 1
  if (hashString(building.id) % 4 === 0) return 2
  if (hashString(building.id) % 4 === 1) return 1
}
const MAX_EMBODIED_ACTORS = 32
const MAX_VISIBLE_IMAGE_REQUESTS = 108
const PORTRAIT_CACHE_LIMIT = 110
type WorldRenderNpc = { id: string; name: string; position: WorldPosition; imageUrl: string | null }
type WorldRenderView = WorldView & { npcs?: readonly WorldRenderNpc[] }
const landmarkProps: Partial<Record<WorldLandmark['kind'], number>> = {
  bridge: 2,
  ruin: 3,
  shrine: 4,
  camp: 5,
  spring: 6,
  waystone: 7,
  anchor: 3,
  hamlet: 0,
  grove: 6,
}
const palettes: Record<string, [string, number, number]> = {
  'verdant-expanse': ['#557748', 0, 0],
  'aureth-crown': ['#727254', 0, 2],
  frostmere: ['#a5b1b5', 2, 1],
  'hollow-coast': ['#73827b', 5, 3],
  'glasswind-desert': ['#ab956e', 3, 2],
  emberreach: ['#5c5150', 6, 3],
  'starfall-highlands': ['#7c7c77', 7, 1],
  'umbral-march': ['#384e48', 1, 0],
  [ASTERWAKE_REGION_ID]: ['#566454', 1, 0],
}
const regionalGround: Readonly<Partial<Record<string, number>>> = {
  'aureth-crown': 0,
  'verdant-expanse': 1,
  frostmere: 2,
  'starfall-highlands': 3,
  emberreach: 4,
  'glasswind-desert': 5,
  'hollow-coast': 6,
  'umbral-march': 7,
}
const voidGroundIndex = {
  haven: 0,
  ashen: 1,
  fracture: 2,
  wayfarer: 3,
  amber: 4,
  amethyst: 5,
} as const

type MaterialCell = Pick<WorldCell, 'x' | 'y' | 'terrain'>
function terrainMaterialPainter(
  images: ReadonlyMap<string, HTMLImageElement>,
  tile: number,
  originX: number,
  originY: number,
  warpedTheme?: WorldSectorView['warpedTheme'],
) {
  const texture = images.get('terrain')
  const groundArt = images.get('regional-ground')
  const privateGround = warpedTheme ? images.get('void-ground') : undefined
  return (
    target: CanvasRenderingContext2D,
    cell: MaterialCell,
    regionId: string,
    offsetX = 0,
    offsetY = 0,
  ) => {
    const material = palettes[regionId] ?? palettes['verdant-expanse']!,
      x = cell.x * tile - offsetX,
      y = cell.y * tile - offsetY
    target.fillStyle = material[0]
    target.fillRect(x, y, tile + 1, tile + 1)
    const privateIndex =
      warpedTheme && privateGround?.complete && privateGround.naturalWidth
        ? voidGroundIndex[warpedTheme]
        : undefined
    const regionalIndex = privateIndex ?? regionalGround[regionId]
    const painted =
      regionalIndex !== undefined &&
      (privateIndex !== undefined || (groundArt?.complete && groundArt.naturalWidth))
    const sheet = privateIndex !== undefined ? privateGround : painted ? groundArt : texture
    const loading = !sheet?.complete || !sheet.naturalWidth
    const source = loading ? groundMaterialPreview() : sheet
    target.globalAlpha = painted || loading ? 0.96 : 0.66
    const columns = privateIndex !== undefined ? 3 : 4
    const sw = source.width / columns,
      sh = source.height / 2,
      index = loading
        ? (regionalGround[regionId] ?? 1)
        : painted
          ? regionalIndex
          : regionId === 'verdant-expanse' && cell.terrain === 't'
            ? 1
            : material[1]
    const wx = originX + cell.x
    const wy = originY + cell.y
    // Reflect alternating blocks so their edges meet without a repeated seam.
    const flipX = (painted || loading) && Math.floor(wx / 4) % 2 !== 0
    const flipY = (painted || loading) && Math.floor(wy / 4) % 2 !== 0
    const flipped = flipX || flipY
    if (flipped) {
      target.save()
      target.translate(x + (flipX ? tile + 1 : 0), y + (flipY ? tile + 1 : 0))
      target.scale(flipX ? -1 : 1, flipY ? -1 : 1)
    }
    const sx = flipX ? 3 - (wx % 4) : wx % 4
    const sy = flipY ? 3 - (wy % 4) : wy % 4
    // Compressed atlas borders can carry neighbouring colour on both
    // public and private sheets. Reflect the clean interior.
    const inset = painted && !loading ? 2 : 0
    const sampleWidth = sw - inset * 2,
      sampleHeight = sh - inset * 2
    target.drawImage(
      source,
      (index % columns) * sw + inset + (sx * sampleWidth) / 4,
      Math.floor(index / columns) * sh + inset + (sy * sampleHeight) / 4,
      sampleWidth / 4,
      sampleHeight / 4,
      flipped ? 0 : x,
      flipped ? 0 : y,
      tile + 1,
      tile + 1,
    )
    if (flipped) target.restore()
    target.globalAlpha = 1
  }
}

const trailColours: Readonly<Partial<Record<string, string>>> = {
  'verdant-expanse': '#9e865d',
  'aureth-crown': '#b6a473',
  frostmere: '#aaa28e',
  'starfall-highlands': '#9e9286',
  emberreach: '#887262',
  'glasswind-desert': '#c1a16b',
  'hollow-coast': '#a19b79',
  'umbral-march': '#817d61',
}
const regionalTrees: Readonly<Partial<Record<string, number>>> = {
  'aureth-crown': 6,
  'hollow-coast': 5,
  'glasswind-desert': 0,
  emberreach: 4,
  'starfall-highlands': 4,
  'umbral-march': 7,
}
interface BridgeStrip {
  x: number
  y: number
  width: number
  height: number
  axis: number
}
interface LiquidSurface {
  canvas: StaticMapRaster
  tint?: WorldSectorView['warpedTheme']
  x: number
  y: number
  width: number
  height: number
  cells: { x: number; y: number; profile: WaterCell }[]
}
function bridgeBounds(strips: readonly BridgeStrip[]) {
  const x = Math.min(...strips.map((strip) => strip.x))
  const y = Math.min(...strips.map((strip) => strip.y))
  return {
    x,
    y,
    width: Math.max(...strips.map((strip) => strip.x + strip.width)) - x,
    height: Math.max(...strips.map((strip) => strip.y + strip.height)) - y,
  }
}
interface Scenery {
  x: number
  y: number
  width: number
  height: number
  image: HTMLImageElement
  index: number
  columns: number
  rows: number
  tree: boolean
  rock?: boolean
  anchorX?: number
  anchorY?: number
  mirror?: boolean
  source?: readonly [number, number, number, number]
  underpass?: 'water' | 'lava'
  underpassSurface?: LiquidSurface
  bridgeStrips?: BridgeStrip[]
  deck?: BridgeDeck
  waterfall?: boolean
  waterfallStyle?: 'water' | 'grand' | 'lava'
  grandBridge?: boolean
  forge?: boolean
  chimney?: Chimney
  ferryMast?: boolean
  voidGlimmer?: string
  townLight?: 'town-centres-north' | 'town-centres-south'
  windFlex?: number
  windSeed?: number
  grandFeature?: boolean
  arenaFloor?: { cx: number; cy: number; rx: number; ry: number }
  oceanFeature?: boolean
}
interface SceneryBatch {
  layer: StaticMapRaster
  left: number
  top: number
}
const STATIONARY_SCENERY_PIXEL_LIMIT = 800_000
const BIOME_RASTER_PIXEL_LIMIT = 4_000_000

function usesCompactScenery(item: Scenery) {
  return !item.underpass && !item.mirror && !item.ferryMast && !item.waterfall && !item.oceanFeature
}
// Inspected biomes-v02 floor contacts, excluding empty cell padding. Preserve
// the original painted scale; anchor the rubble floor rather than the cell edge.
const rockArt: Record<
  number,
  Pick<Scenery, 'width' | 'height' | 'anchorX' | 'anchorY' | 'source'>
> = {
  2: {
    width: (1.8 * 450) / 443.5,
    height: (1.7 * 365) / 443.5,
    anchorX: 229 / 450,
    anchorY: 349 / 365,
    source: [880 / 1774, 60 / 887, 450 / 1774, 365 / 887],
  },
  3: {
    width: (1.8 * 405) / 443.5,
    height: (1.7 * 310) / 443.5,
    anchorX: 204 / 405,
    anchorY: 290 / 310,
    source: [1348 / 1774, 102 / 887, 405 / 1774, 310 / 887],
  },
}
function treeCrop(
  sheetWidth: number,
  sheetHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  floorX: number,
  floorY: number,
): Required<Pick<Scenery, 'width' | 'height' | 'anchorX' | 'anchorY' | 'source'>> {
  return {
    width: (1.65 * width) / (sheetWidth / 4),
    height: (2.55 * height) / (sheetHeight / 2),
    anchorX: (floorX - x) / width,
    anchorY: (floorY - y) / height,
    source: [x / sheetWidth, y / sheetHeight, width / sheetWidth, height / sheetHeight],
  }
}
// These paintings cross the nominal grid. Isolate each canopy and complete
// roots, retaining source-pixel scale and using the visible floor as its pivot.
const treeArt: Record<string, Record<number, ReturnType<typeof treeCrop>>> = {
  nature: {
    0: treeCrop(1514, 1039, 0, 26, 442, 591, 224, 603),
    1: treeCrop(1514, 1039, 443, 24, 320, 585, 599, 596),
    2: treeCrop(1514, 1039, 763, 38, 356, 566, 947, 594),
    3: treeCrop(1514, 1039, 1119, 67, 395, 549, 1336, 603),
  },
  biomes: {
    0: treeCrop(1774, 887, 30, 5, 380, 433, 230, 419),
    4: treeCrop(1774, 887, 0, 447, 433, 431, 252, 867),
    5: treeCrop(1774, 887, 443, 444, 443, 430, 630, 853),
    6: treeCrop(1774, 887, 925, 427, 388, 451, 1102, 866),
    7: treeCrop(1774, 887, 1328, 447, 432, 423, 1510, 851),
  },
  beauties: {
    0: treeCrop(1774, 887, 15, 15, 430, 438, 217, 444),
    1: treeCrop(1774, 887, 454, 24, 430, 423, 668, 435),
    2: treeCrop(1774, 887, 893, 29, 430, 426, 1077, 439),
    3: treeCrop(1774, 887, 1333, 24, 422, 431, 1540, 443),
  },
}
interface FeaturePlacement {
  point: MapPoint
  width: number
  height: number
  anchorX: number
  anchorY: number
  mirror: boolean
  source?: readonly [number, number, number, number]
  underpass?: 'water' | 'lava'
  span?: number
  deck?: BridgeDeck
  fallMaterial?: 'water' | 'lava'
  bridgeStrips?: BridgeStrip[]
}
function isBridgeRoad(cell: WorldCell | undefined): boolean {
  return Boolean(cell?.walkable && (cell.terrain === '=' || cell.terrain === 's'))
}
/** Positions are presentation-only and use exclusively supplied, known terrain. */
function indexFeaturePlacements(sectors: readonly WorldSectorView[]) {
  const fields = new Map<string, Map<string, FeaturePlacement | null>>()
  const known = new Map<string, WorldCell>()
  const namespace = mapSceneDomain
  const address = (sector: WorldSectorView, x: number, y: number) =>
    `${namespace(sector)}:${namespace(sector) === 'atlas' ? ((x % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH : x}:${y}`
  const at = (sector: WorldSectorView, x: number, y: number) => known.get(address(sector, x, y))
  const liquid = (cell: WorldCell | undefined) =>
    isWaterTerrain(cell?.terrain) || cell?.terrain === 'l'
  for (const sector of sectors) {
    const origin = sectorMapOrigin(sector)
    for (const cell of sector.cells)
      known.set(address(sector, origin.x + cell.x, origin.y + cell.y), cell)
  }
  for (const sector of sectors) {
    const placements = new Map<string, FeaturePlacement | null>()
    fields.set(sector.id, placements)
    const origin = sectorMapOrigin(sector)
    for (const landmark of sector.landmarks) {
      const x = origin.x + landmark.x,
        y = origin.y + landmark.y
      if (landmark.kind === 'bridge') {
        placements.set(landmark.id, null)
        if (!isBridgeRoad(at(sector, x, y))) continue
        for (const axis of [0, 1]) {
          const dx = axis === 0 ? 1 : 0,
            dy = axis === 1 ? 1 : 0
          const crossing = (cx: number, cy: number) => {
            const cell = at(sector, cx, cy)
            if (!isBridgeRoad(cell)) return null
            const waterSide = (sign: number) => {
              for (let i = 1; i <= 4; i++) {
                const next = at(sector, cx + dy * sign * i, cy + dx * sign * i)
                if (liquid(next))
                  return { terrain: isWaterTerrain(next!.terrain) ? '~' : 'l', distance: i }
                if (!isBridgeRoad(next)) break
              }
              return null
            }
            const a = waterSide(-1),
              b = waterSide(1)
            return a !== null && b !== null && a.terrain === b.terrain
              ? { terrain: a.terrain, from: a.distance, to: b.distance }
              : null
          }
          if (!crossing(x, y)) continue
          let before = 0,
            after = 0
          while (before < 5 && crossing(x - (before + 1) * dx, y - (before + 1) * dy)) before++
          while (after < 5 && crossing(x + (after + 1) * dx, y + (after + 1) * dy)) after++
          if (before === 5 || after === 5) continue
          const a = at(sector, x - (before + 1) * dx, y - (before + 1) * dy),
            b = at(sector, x + (after + 1) * dx, y + (after + 1) * dy)
          if (!a?.walkable || !b?.walkable || liquid(a) || liquid(b)) continue
          const span = before + after + 2
          const bridgeStrips: BridgeStrip[] = []
          for (let offset = -before; offset <= after; offset++) {
            const cx = x + offset * dx,
              cy = y + offset * dy,
              support = crossing(cx, cy)!
            bridgeStrips.push({
              x: cx - dy * (support.from - 1),
              y: cy - dx * (support.from - 1),
              width: axis === 0 ? 1 : support.from + support.to - 1,
              height: axis === 0 ? support.from + support.to - 1 : 1,
              axis,
            })
          }
          const point = {
            x: x + 0.5 + ((after - before) * dx) / 2,
            y: y + 0.5 + ((after - before) * dy) / 2,
          }
          const bounds = bridgeBounds(bridgeStrips)
          const across = axis === 0 ? 'y' : 'x'
          const left = point[across] - bounds[across]
          placements.set(landmark.id, {
            point,
            ...bridgeDeckArt(span, 'footbridge'),
            deck: {
              point,
              span,
              profile: 'footbridge',
              along: axis === 0 ? 'x' : 'y',
              left,
              right: bounds[axis === 0 ? 'height' : 'width'] - left,
            },
            mirror: axis === 0,
            source: [950 / 1774, 60 / 887, 460 / 1774, 380 / 887],
            underpass: crossing(x, y)!.terrain === 'l' ? 'lava' : 'water',
            bridgeStrips,
            span,
          })
          break
        }
      } else if (
        landmark.sceneryIndex === 4 ||
        (landmark.sceneryIndex === undefined &&
          (landmark.kind === 'spring' || landmark.kind === 'grove'))
      ) {
        placements.set(landmark.id, null)
        if (!at(sector, x, y)?.walkable) continue
        let closest: MapPoint | null = null,
          closestMaterial: 'water' | 'lava' = 'water',
          distance = 3.25
        for (const candidate of sectors) {
          if (namespace(candidate) !== namespace(sector)) continue
          const o = sectorMapOrigin(candidate, namespace(sector) === 'atlas' ? x : undefined)
          for (const cell of candidate.cells) {
            if (
              (!isWaterTerrain(cell.terrain) &&
                !(landmark.sceneryIndex === 4 && cell.terrain === 'l')) ||
              cell.walkable
            )
              continue
            const wx = o.x + cell.x,
              wy = o.y + cell.y,
              d = Math.hypot(wx - x, wy - y)
            if (d < distance) {
              closest = { x: wx + 0.5, y: wy + 0.5 }
              closestMaterial = cell.terrain === 'l' ? 'lava' : 'water'
              distance = d
            }
          }
        }
        if (!closest) continue
        const waterfall = landmark.sceneryIndex === 4
        placements.set(landmark.id, {
          point: closest,
          fallMaterial: closestMaterial,
          width: waterfall ? 1.8 : 1.55,
          height: waterfall ? 1.8 : 1.55,
          anchorX: waterfall ? 0.48 : 0.53,
          anchorY: waterfall ? 0.78 : 0.66,
          mirror: false,
          ...(waterfall ? {} : { source: [975 / 1774, 480 / 887, 453 / 1774, 372 / 887] as const }),
        })
      }
    }
  }
  return fields
}
/** Presentation beneath proven decks only; supplied collision cells are never rewritten. */
function indexBridgeWater(
  sectors: readonly WorldSectorView[],
  placements: Map<string, Map<string, FeaturePlacement | null>>,
  material: 'water' | 'lava' = 'water',
) {
  const namespace = mapSceneDomain
  const address = (sector: WorldSectorView, x: number, y: number) =>
    `${namespace(sector)}:${namespace(sector) === 'atlas' ? ((x % WORLD_MAP_WIDTH) + WORLD_MAP_WIDTH) % WORLD_MAP_WIDTH : x}:${y}`
  const decks = new Set<string>()
  for (const sector of sectors)
    for (const placement of placements.get(sector.id)?.values() ?? [])
      if (placement?.underpass === material)
        for (const strip of placement.bridgeStrips ?? [])
          for (let y = strip.y; y < strip.y + strip.height; y++)
            for (let x = strip.x; x < strip.x + strip.width; x++) decks.add(address(sector, x, y))
  const presentation = decks.size
    ? sectors.map((sector) => {
        const origin = sectorMapOrigin(sector)
        return {
          ...sector,
          cells: sector.cells.map((cell) =>
            isBridgeRoad(cell) && decks.has(address(sector, origin.x + cell.x, origin.y + cell.y))
              ? { ...cell, terrain: material === 'water' ? '~' : 'l', walkable: false }
              : cell,
          ),
        }
      })
    : sectors
  const field = buildWaterField(presentation, material)
  const profiles = new Map<string, WaterCell>()
  for (const sector of presentation) {
    const origin = sectorMapOrigin(sector)
    for (const cell of field.get(sector.id)?.cells.values() ?? []) {
      const key = address(sector, origin.x + cell.x, origin.y + cell.y)
      if (decks.has(key)) profiles.set(key, cell)
    }
  }
  const keys = new Map<string, string>()
  for (const sector of sectors) {
    const relevant: (WaterCell | undefined)[] = []
    for (const placement of placements.get(sector.id)?.values() ?? [])
      if (placement?.underpass === material)
        for (const strip of placement.bridgeStrips ?? [])
          for (let y = strip.y; y < strip.y + strip.height; y++)
            for (let x = strip.x; x < strip.x + strip.width; x++)
              relevant.push(profiles.get(address(sector, x, y)))
    keys.set(sector.id, JSON.stringify(relevant))
  }
  return { profiles, address, keys, field }
}
function sprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  index: number,
  columns: number,
  rows: number,
  x: number,
  y: number,
  width: number,
  height: number,
  source?: readonly [number, number, number, number],
) {
  const sw = image.width / columns,
    sh = image.height / rows
  context.drawImage(
    image,
    source ? source[0] * image.width : (index % columns) * sw,
    source ? source[1] * image.height : Math.floor(index / columns) * sh,
    source ? source[2] * image.width : sw,
    source ? source[3] * image.height : sh,
    x,
    y,
    width,
    height,
  )
}
type LabelBounds = { left: number; top: number; right: number; bottom: number }

function labelsOverlap(a: LabelBounds, b: LabelBounds) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

const mapLabelPalette = {
  self: { text: '#ffdb86', border: '#bd904f', top: '#3b2a1b', bottom: '#211810' },
  player: { text: '#a5efe2', border: '#5bb4a4', top: '#19383b', bottom: '#102628' },
  npc: { text: '#ffc2a6', border: '#c28069', top: '#3c2822', bottom: '#261a17' },
  location: { text: '#dbc8ff', border: '#9279c0', top: '#302641', bottom: '#211a31' },
} as const

function paintMapLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  { left, top, right, bottom }: LabelBounds,
  fontSize: number,
  kind: keyof typeof mapLabelPalette,
  ratio: number,
) {
  const palette = mapLabelPalette[kind]
  const background = ctx.createLinearGradient(left, top, left, bottom)
  background.addColorStop(0, palette.top)
  background.addColorStop(1, palette.bottom)
  ctx.fillStyle = background
  ctx.strokeStyle = palette.border
  ctx.lineWidth = Math.max(1 / ratio, 0.85)
  ctx.beginPath()
  ctx.roundRect(left, top, right - left, bottom - top, 4)
  ctx.fill()
  ctx.stroke()
  ctx.font = `600 ${fontSize}px Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = palette.text
  ctx.fillText(
    label,
    Math.round((left + 6) * ratio) / ratio,
    Math.round((top + fontSize + 2) * ratio) / ratio,
  )
}

export function createMapRenderer(
  canvas: HTMLCanvasElement,
  motion: WorldMotion,
  initial: WorldView,
  select: (
    position: WorldPosition,
    direction?: MapDirection,
    previewDestination?: WorldPosition,
  ) => void,
  selectPlayer: (id: string) => void,
  onZoom: (zoom: number) => void = () => {},
  onVisiblePlayers: (ids: string[]) => void = () => {},
  onStop: () => void = () => {},
  identityCanvas?: HTMLCanvasElement,
  selectFerryman?: () => void,
) {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return null
  const ctx = context
  const identityContext = identityCanvas?.getContext('2d')
  const personContext = identityContext ?? ctx
  // Opt-in numeric profiling for native timing investigations; normal rendering
  // does not collect stage timings or publish diagnostic records.
  let timing: Record<string, number> | null = null
  let pendingTiming: Record<string, number> | null = null
  let callbackStarted = 0
  const coverageFrames: {
    at: number
    x: number
    y: number
    width: number
    height: number
    tile: number
    painted: string[]
  }[] = []
  const timingEnabled = () => canvas.dataset.renderDiagnostics === 'timing'
  let paintedIdentity: (string | number | boolean | null)[] | null = null
  let paintedIdentityBounds: { left: number; top: number; right: number; bottom: number } | null =
    null
  let view: WorldRenderView = initial,
    width = 0,
    height = 0,
    ratio = 1,
    identityRatio = 1,
    groundScale = 1,
    tile = 64,
    rasterTile = 64,
    rasterZoomAt: number | null = null,
    zoom = 1,
    disposed = false,
    frame = 0,
    last = 0,
    lastPaintRaf = -Infinity,
    drawn = 0,
    dirty = true,
    wasMoving = false,
    wasRemoteMoving = false,
    pendingOverviewGround = false,
    visiblePlayerKey: string | null = null
  const pan = { x: 0, y: 0 }
  const heldKeys = new Map<string, MapDirection>()
  let keyTimer: ReturnType<typeof setTimeout> | null = null
  let heldDirection: MapDirection | null = null
  let heldDestination: WorldPosition | null = null
  let heldReleaseOrigin: WorldPosition | null = null
  let heldFirstDestination: WorldPosition | null = null
  let initialKeyStep = false
  function releaseHeldKeys(finishStep = true) {
    const direction = heldDirection
    const destination = heldDestination
    const origin = heldReleaseOrigin
    const first = heldFirstDestination
    heldDestination = null
    heldReleaseOrigin = null
    heldFirstDestination = null
    heldKeys.clear()
    heldDirection = null
    if (keyTimer !== null) clearTimeout(keyTimer)
    keyTimer = null
    if (finishStep && direction && destination && !view.movementBlocked && !view.battleSessionId) {
      const landing = motion.nextLanding(performance.now())
      // The movement receipt can arrive after an immediate keyup. In that gap
      // WorldMotion still reports the old origin, which must not overwrite the
      // already-approved route. Finish its first legal step instead.
      const released =
        first && (initialKeyStep || (origin && samePosition(landing, origin))) ? first : landing
      if (!samePosition(released, destination)) {
        select(released, direction)
        requestDraw()
      }
    }
  }
  let camera = motion.sample(performance.now()).point
  type PaintedProjection = {
    at: number
    camera: MapPoint
    pan: MapPoint
    tile: number
    width: number
    height: number
    decks: BridgeDeck[]
  }
  const paintedProjections: PaintedProjection[] = []
  const remoteMotion = new WorldPlayerMotion(initial, performance.now(), camera)
  let animate = true,
    showLocationLabels = true,
    visualMinuteOfDay = view.environment.minuteOfDay,
    quality: MapQuality = DEFAULT_MAP_QUALITY,
    zoomLocked = false,
    paused = false,
    preview = false,
    authorityOverlay = false,
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let drag: {
    x: number
    y: number
    position: WorldPosition | null
    player: { id: string; self: boolean } | null
  } | null = null
  const actorAssets = new Map<string, ReturnType<typeof appearanceManifestFromImageUrl>>()
  let actorPositions = new Map<
    string,
    { point: MapPoint; facing: AppearanceFacing; walkingSince: number | null }
  >()
  const images = new Map<string, HTMLImageElement>(),
    portraits = new Map<string, HTMLImageElement>()
  const cache = new Map<
    string,
    {
      key: string
      scale: number
      ground: StaticMapRaster
      pendingMaterials: string[]
      publicSurface?: WorldAtlasCell
      surfaces: Map<string, LiquidSurface>
      pixels: number
    }
  >()
  // Small presentation-only rasters for charted ground beyond the streamed scene.
  const chartBackdrops = new Map<string, { metadata: WorldAtlasCell; ground: StaticMapRaster }>()
  const chartMaterials = new Map<string, StaticMapRaster>()
  const groundProjections = createGroundProjectionCache()
  const snapshot = (source: HTMLCanvasElement) => {
    const image = snapshotStaticRaster(source)
    if (timing) {
      timing.staticRasterBuilds!++
      if ('close' in image) timing.staticRasterTransfers!++
    }
    return image
  }
  const actorFrames = createMapActorFrames()
  const compactPortraits = createMapPortraitCrops()
  const wildlifeParts = createWildlifePartCache()
  const weatherVeil = createWeatherVeilCache()
  const lighting = createWorldLightingCache()
  const biomeRasters = new Map<string, StaticMapRaster>()
  let biomeRasterPixels = 0
  const clearBiomeRasters = () => {
    for (const raster of biomeRasters.values()) releaseStaticRaster(raster)
    biomeRasters.clear()
    biomeRasterPixels = 0
  }
  let woodland = new WeakMap<WorldSectorView, { key: string; originX: number; items: Scenery[] }>()
  let stationaryScenery: Scenery[] | null = null
  let sceneryBatches = new Map<string, SceneryBatch>()
  const clearStationaryScenery = () => {
    stationaryScenery = null
    for (const batch of sceneryBatches.values()) releaseStaticRaster(batch.layer)
    sceneryBatches.clear()
  }
  let stationaryGround: {
    camera: MapPoint
    ambient: boolean
    layer: StaticMapRaster | null
    start: number
    end: number
    ids: string
    padding: number
  } | null = null
  const clearStationaryGround = () => {
    if (stationaryGround?.layer) releaseStaticRaster(stationaryGround.layer)
    stationaryGround = null
  }
  let wind: WorldWind | undefined
  let surfaceRain: number | undefined
  let chimneyPuff: HTMLCanvasElement | undefined
  let ferryClockAt = performance.now()
  let hitTargets: { id: string; self: boolean; x: number; y: number; radius: number }[] = []
  const frameTimes: number[] = []
  const terrainKeys = new Map<string, string>()
  const featureKeys = new Map<string, string>()
  const wildlife = new WeakMap<WorldSectorView, Wildlife[]>()
  const dressing = new WeakMap<WorldSectorView, ReturnType<typeof sceneryDressing>>()
  let renderSectors = worldRenderTerrain(view)
  let mountains = indexMountainPlacements(renderSectors)
  let biomeField = buildBiomeTransitions(renderSectors)
  let settlementGround: ReturnType<typeof buildSettlementGround>
  let featurePlacements = indexFeaturePlacements(renderSectors)
  let bridgeWater = indexBridgeWater(renderSectors, featurePlacements)
  let waterField = bridgeWater.field
  let bridgeLava = indexBridgeWater(renderSectors, featurePlacements, 'lava')
  let lavaField = bridgeLava.field
  let coastField = buildPublicCoasts({ ...view, sectors: renderSectors })
  let warpedEdges = buildWarpedTerrainEdges(renderSectors)
  let heatEmitters = terrainHeatEmitters(renderSectors)
  let grandDiscoveries = grandDiscoveryPlacements(renderSectors, view.publicGrandDiscoveries)
  let oceanDiscoveries = oceanFeaturePlacements(renderSectors, coastField, view.atlas)
  const shallowRipples = new ShallowWaterRipples()
  const clouds = [0, 1, 2].map((i) => snapshot(createCloudTexture('world-cloud:' + i)))
  let cachedPixels = 0
  let visibleGroundIds = new Set<string>()
  let activeVisibleTerrainIds = new Set<string>()
  let terrainSources = new Map<string, WorldSectorView>()
  const chartedTerrainAt = (atlas: WorldView['atlas']) =>
    new Map(
      atlas?.filter((cell) => cell.charted).map((cell) => [`${cell.column}:${cell.row}`, cell]),
    )
  const chartCoasts = new Map<string, ReturnType<typeof publicCoastEdges>>()
  let chartedTerrain = chartedTerrainAt(view.atlas)
  let islandFringes = asterwakeOceanFringes(chartedTerrain)
  const atlasTerrainKey = (atlas: WorldView['atlas']) =>
    JSON.stringify(
      atlas?.map(({ id, charted, column, row, regionId, townId, waterTiles }) => [
        id,
        charted,
        column,
        row,
        regionId,
        townId,
        regionId === ASTERWAKE_REGION_ID ? waterTiles : undefined,
      ]) ?? [],
    )
  let indexedAtlasKey = atlasTerrainKey(view.atlas)
  const terrainDependenciesChanged = (dependencies: ReadonlySet<string>) => {
    const current = new Map(renderSectors.map((sector) => [sector.id, sector]))
    for (const id of dependencies) if (terrainSources.get(id) !== current.get(id)) return true
    return false
  }
  function indexTerrain() {
    woodland = new WeakMap()
    clearStationaryGround()
    clearStationaryScenery()
    mountains = indexMountainPlacements(renderSectors)
    biomeField = buildBiomeTransitions(renderSectors)
    featurePlacements = indexFeaturePlacements(renderSectors)
    bridgeWater = indexBridgeWater(renderSectors, featurePlacements)
    waterField = bridgeWater.field
    bridgeLava = indexBridgeWater(renderSectors, featurePlacements, 'lava')
    lavaField = bridgeLava.field
    coastField = buildPublicCoasts({ ...view, sectors: renderSectors })
    settlementGround = buildSettlementGround(renderSectors, coastField)
    warpedEdges = buildWarpedTerrainEdges(renderSectors)
    heatEmitters = terrainHeatEmitters(renderSectors)
    grandDiscoveries = grandDiscoveryPlacements(renderSectors, view.publicGrandDiscoveries)
    oceanDiscoveries = oceanFeaturePlacements(renderSectors, coastField, view.atlas)
    terrainKeys.clear()
    featureKeys.clear()
    for (const sector of renderSectors) {
      const islandCoast = []
      if (
        sector.regionId === ASTERWAKE_REGION_ID &&
        sector.atlasColumn !== undefined &&
        sector.atlasRow !== undefined
      ) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const neighbor = chartedTerrain.get(
              `${wrapAtlasColumn(sector.atlasColumn + dx)}:${sector.atlasRow + dy}`,
            )
            islandCoast.push(
              neighbor?.regionId === ASTERWAKE_REGION_ID ? (neighbor.waterTiles ?? '') : null,
            )
          }
      }
      terrainKeys.set(
        sector.id,
        JSON.stringify([
          sector.regionId,
          sector.townId,
          sector.warpedTheme,
          sector.cells.map((cell) => [cell.x, cell.y, cell.terrain]),
          sector.regionId === WINTER_ART &&
            sector.landmarks
              .filter((landmark) => landmark.kind === 'marketplace')
              .map(({ x, y }) => [x, y]),
          coastField.get(sector.id),
          islandCoast,
          settlementGround.edges.get(sector.id),
          Array.from(settlementGround.shoreRoads.get(sector.id) ?? []),
          Array.from(settlementGround.pavedCells.get(sector.id) ?? []),
          warpedEdges.get(sector.id)?.key,
        ]),
      )
      featureKeys.set(
        sector.id,
        JSON.stringify([...(featurePlacements.get(sector.id)?.values() ?? [])]),
      )
      if (!wildlife.has(sector)) wildlife.set(sector, createWildlife(sector))
      if (!dressing.has(sector))
        dressing.set(sector, [
          ...sceneryDressing(sector),
          ...naturalDressing(sector),
          ...regionalScenery(sector),
          ...settlementComposition(sector),
        ])
    }
    terrainSources = new Map(renderSectors.map((sector) => [sector.id, sector]))
    indexedAtlasKey = atlasTerrainKey(view.atlas)
  }
  indexTerrain()
  const clearCache = () => {
    groundProjections.clear()
    for (const { ground } of chartBackdrops.values()) releaseStaticRaster(ground)
    chartBackdrops.clear()
    for (const material of chartMaterials.values()) releaseStaticRaster(material)
    chartMaterials.clear()
    for (const entry of cache.values()) {
      releaseStaticRaster(entry.ground)
      for (const surface of entry.surfaces.values()) releaseStaticRaster(surface.canvas)
    }
    cache.clear()
    cachedPixels = 0
    clearStationaryGround()
    clearStationaryScenery()
  }
  const load = (name: string, version = 'v02', format = 'webp') => {
    const image = new Image()
    if (name === 'terrain' || name === 'regional-ground' || name === 'water-materials')
      image.fetchPriority = 'high'
    image.onload = () => {
      if (name === 'nature') wildlifeParts.clear()
      if (
        [
          'nature',
          'beauties',
          'biomes',
          'living-trees',
          'forest-variety',
          'asterwake-woodland',
        ].includes(name)
      )
        woodland = new WeakMap()
      if (name === 'terrain' || name === 'regional-ground') clearCache()
      else {
        // Late specialty art affects only the sectors that painted its fallback.
        // Rebuilding every dry sector on a lake/floor decode stalls the whole viewport.
        for (const [id, entry] of cache) {
          if (!entry.pendingMaterials.includes(name)) continue
          cachedPixels -= entry.pixels
          releaseStaticRaster(entry.ground)
          for (const surface of entry.surfaces.values()) releaseStaticRaster(surface.canvas)
          cache.delete(id)
          clearStationaryGround()
        }
        clearStationaryScenery()
      }
      requestDraw()
    }
    image.src = BASE + name + '-' + version + '.' + format
    images.set(name, image)
  }
  for (const name of ['terrain', 'buildings', 'nature', 'props', 'biomes']) load(name)
  load('beauties', 'v03')
  load('regional-ground', 'v02')
  load('living-trees', 'v01')
  load('water-materials', 'v01')
  const loadRegionalArt = () => {
    for (const discovery of [...grandDiscoveries, ...oceanDiscoveries])
      if (!images.has(discovery.sheet)) load(discovery.sheet, 'v01')
    if (
      !images.has('grand-discoveries') &&
      renderSectors.some((sector) =>
        [...(featurePlacements.get(sector.id)?.values() ?? [])].some(
          (placement) =>
            placement?.underpass && grandBridgeDiscoveryArt(sector, placement.span ?? 0),
        ),
      )
    )
      load('grand-discoveries', 'v01')
    for (const sector of renderSectors)
      for (const building of sector.buildings ?? []) {
        const art = crownWallArt(building) ?? townArchitectureArt(sector, building)
        if (art && !images.has(art.sheet)) load(art.sheet, 'v01')
      }
    if (
      !images.has('natural-lakes') &&
      [...waterField.values()].some((sector) =>
        [...sector.cells.values()].some((cell) => cell.basin),
      )
    )
      load('natural-lakes', 'v01')
    if (
      !images.has('settlement-floors') &&
      renderSectors.some((s) => settlementFloorIndex(s) !== undefined)
    )
      load('settlement-floors', 'v01')
    if (!images.has('impact-basins') && renderSectors.some((s) => impactSite(s)))
      load('impact-basins', 'v01')
    if (
      !images.has('mountains') &&
      renderSectors.some(
        (sector) =>
          isMajorMountainRangeSector(sector) || sector.cells.some((cell) => cell.terrain === '#'),
      )
    )
      load('mountains', 'v01')
    if (
      !images.has('grand-bridges') &&
      renderSectors.some((s) =>
        [...(featurePlacements.get(s.id)?.values() ?? [])].some(
          (p) => p?.underpass && grandBridgeArt(s, p.span ?? 0) !== undefined,
        ),
      )
    )
      load('grand-bridges', 'v01')
    if (
      !images.has('waterfalls') &&
      renderSectors.some((s) =>
        s.landmarks.some(
          (l) =>
            l.sceneryIndex === 4 &&
            featurePlacements.get(s.id)?.get(l.id)?.fallMaterial === 'water',
        ),
      )
    )
      load('waterfalls', 'v01')
    if (
      !images.has('lavafalls') &&
      renderSectors.some(
        (s) =>
          lavaFallSite(s) ||
          s.landmarks.some(
            (l) =>
              l.sceneryIndex === 4 &&
              featurePlacements.get(s.id)?.get(l.id)?.fallMaterial === 'lava',
          ),
      )
    )
      load('lavafalls', 'v01')
    if (!images.has('void-ground') && renderSectors.some((sector) => sector.warpedTheme))
      load('void-ground', 'v01')
    for (const sector of renderSectors)
      for (const { sheet } of dressing.get(sector) ?? []) if (!images.has(sheet)) load(sheet, 'v01')
    if (
      !images.has('hamlet-buildings') &&
      renderSectors.some(
        (sector) =>
          sector.charted &&
          sector.landmarks.some(
            ({ kind, name }) => kind === 'hamlet' && hamletFamilyIndex(name) !== undefined,
          ),
      )
    )
      load('hamlet-buildings', 'v01')
    if (
      !images.has('hamlet-buildings-winter') &&
      renderSectors.some(
        (sector) =>
          sector.charted &&
          sector.regionId === WINTER_ART &&
          sector.landmarks.some(
            ({ kind, name }) => kind === 'hamlet' && hamletFamilyIndex(name) !== undefined,
          ),
      )
    )
      load('hamlet-buildings-winter', 'v01')
    if (!images.has('ferry-fittings') && renderSectors.some(({ id }) => id.startsWith('ferry:'))) {
      load('ferry-fittings', 'v02', 'svg')
      load('ferry-cabin', 'v01')
      load('ferry-sails', 'v01')
      load('ferry-passenger-hull', 'v01')
      load('ferry-pine-coast', 'v01')
      load('ferry-cliff-coast', 'v01')
      load('ferry-dolphin', 'v01')
    }
    if (
      !images.has('ferry-terminal') &&
      renderSectors.some((sector) => sector.landmarks.some(({ id }) => isFerryTerminalLandmark(id)))
    ) {
      load('ferry-terminal', 'v02')
      load('ferry-deck-planks', 'v01')
      load('ferry-vessel', 'v01')
    }
    if (
      !images.has('asterwake-woodland') &&
      renderSectors.some(({ regionId }) => regionId === ASTERWAKE_REGION_ID)
    )
      load('asterwake-woodland', 'v01')
    if (
      !images.has('asterwake-ferry-terminal') &&
      renderSectors.some(({ id }) => id === FERRY_ASTERWAKE_DOCK.sectorId)
    )
      load('asterwake-ferry-terminal', 'v02')
    if (
      !images.has('gildroot-oak') &&
      renderSectors.some(({ id }) => id === ASTERWAKE_GOLDEN_TREE.sectorId)
    )
      load('gildroot-oak', 'v01')
    if (!images.has('forest-variety') && renderSectors.some((sector) => sector.warpedTheme))
      load('forest-variety', 'v01')
    if (!images.has(WINTER_ART) && renderSectors.some((sector) => sector.regionId === WINTER_ART))
      load(WINTER_ART, 'v01')
    if (
      !images.has('regional-settlements') &&
      renderSectors.some((sector) =>
        sector.buildings?.some((building) => regionalBuildingIndex(sector, building) !== undefined),
      )
    )
      load('regional-settlements', 'v01')
    if (
      !images.has('warped-landmarks') &&
      renderSectors.some((sector) =>
        sector.landmarks.some(
          (landmark) => landmark.warpedArt !== undefined && landmark.warpedArt < 6,
        ),
      )
    )
      load('warped-landmarks', 'v01')
    if (
      !images.has('warped-refuges') &&
      renderSectors.some((sector) =>
        sector.landmarks.some(
          (landmark) => landmark.warpedArt !== undefined && landmark.warpedArt >= 6,
        ),
      )
    )
      load('warped-refuges', 'v01')
  }
  loadRegionalArt()
  // Fit the complete hull at the normal zoom, including on narrow screens.
  const tileSize = () =>
    view.position.sectorId.startsWith('ferry:')
      ? Math.min(51, width / 19, height / 16) * zoom
      : (width < 600 ? 48 : 64) * zoom
  const resize = () => {
    weatherVeil.clear()
    lighting.clear()
    width = canvas.clientWidth
    height = canvas.clientHeight
    ratio = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.5)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    // The canvas clears smoothing flags on backing-store resize. Restore the
    // best interpolation for painted architecture, rare sites and HD mountains;
    // keep Low's lighter sampling path and unchanged raster/frame budgets.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = quality === 'low' ? 'medium' : 'high'
    // Interface detail keeps native display density without multiplying scenery cost.
    identityRatio = identityContext ? window.devicePixelRatio || 1 : ratio
    if (identityCanvas && identityContext) {
      identityCanvas.width = Math.round(width * identityRatio)
      identityCanvas.height = Math.round(height * identityRatio)
      // A fractional grid track must not rescale or offset the native bitmap between pixels.
      identityCanvas.style.width = `${identityCanvas.width / identityRatio}px`
      identityCanvas.style.height = `${identityCanvas.height / identityRatio}px`
      const bounds = canvas.getBoundingClientRect()
      const offsetX = Math.round(bounds.left * identityRatio) / identityRatio - bounds.left
      const offsetY = Math.round(bounds.top * identityRatio) / identityRatio - bounds.top
      identityCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`
      paintedIdentity = null
      paintedIdentityBounds = null
    }
    tile = tileSize()
    rasterTile = tile
    rasterZoomAt = null
    clearCache()
    clearBiomeRasters()
    requestDraw()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  const screen = (point: MapPoint) => projectMapPoint(point, camera, pan, tile, width, height)
  const world = (x: number, y: number, projection?: PaintedProjection) =>
    unprojectMapPoint(
      { x, y },
      projection?.camera ?? camera,
      projection?.pan ?? pan,
      projection?.tile ?? tile,
      projection?.width ?? width,
      projection?.height ?? height,
    )
  const sectorOrigin = (sector: WorldSectorView) => sectorMapOrigin(sector, camera.x)
  const pick = (point: MapPoint, sectors = view.sectors, referenceX = camera.x) => {
    // Prefer the current legacy/private sector over a public sector at the same address.
    const ordered = [...sectors].sort(
      (a, b) => Number(b.id === view.position.sectorId) - Number(a.id === view.position.sectorId),
    )
    for (const sector of ordered) {
      const origin = sectorMapOrigin(sector, referenceX),
        x = Math.floor(point.x - origin.x),
        y = Math.floor(point.y - origin.y)
      const cell = sector.cells.find((c) => c.x === x && c.y === y)
      if (cell?.walkable) return { sectorId: sector.id, x, y }
    }
    return null
  }
  const chartCellSize = 16
  function paintChartMaterial(
    target: CanvasRenderingContext2D,
    sector: WorldAtlasCell,
    pixelTile: number,
  ) {
    let material = chartMaterials.get(sector.regionId)
    if (!material) {
      // Reflected four-cell patches repeat every eight world cells in both axes.
      const swatch = document.createElement('canvas')
      swatch.width = swatch.height = 8 * chartCellSize
      const c = swatch.getContext('2d')!
      const paint = terrainMaterialPainter(images, chartCellSize, 0, 0)
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) paint(c, { x, y, terrain: '.' }, sector.regionId)
      material = snapshot(swatch)
      chartMaterials.set(sector.regionId, material)
    }
    const ox = sector.column * GRID_WIDTH,
      oy = sector.row * GRID_HEIGHT
    for (let y = 0; y < GRID_HEIGHT;) {
      const sy = (oy + y) % 8,
        height = Math.min(8 - sy, GRID_HEIGHT - y)
      for (let x = 0; x < GRID_WIDTH;) {
        const sx = (ox + x) % 8,
          width = Math.min(8 - sx, GRID_WIDTH - x)
        target.drawImage(
          material,
          sx * chartCellSize,
          sy * chartCellSize,
          width * chartCellSize,
          height * chartCellSize,
          x * pixelTile,
          y * pixelTile,
          width * pixelTile + 0.5,
          height * pixelTile + 0.5,
        )
        x += width
      }
      y += height
    }
  }
  function paintChartGround(target: CanvasRenderingContext2D, sector: WorldAtlasCell) {
    const sameSurface = (previous: WorldAtlasCell) =>
      previous.id === sector.id &&
      previous.column === sector.column &&
      previous.row === sector.row &&
      previous.regionId === sector.regionId &&
      previous.townId === sector.townId &&
      previous.settlementOutskirtsOf === sector.settlementOutskirtsOf &&
      previous.waterTiles === sector.waterTiles
    const full = cache.get(sector.id)
    if (full?.publicSurface && sameSurface(full.publicSurface)) {
      drawGroundSurface(target, full.ground, GRID_WIDTH * tile, GRID_HEIGHT * tile, ratio)
      return
    }
    if (!sector.waterTiles && sector.regionId !== ASTERWAKE_REGION_ID) {
      paintChartMaterial(target, sector, tile)
      return
    }
    let saved = chartBackdrops.get(sector.id)
    if (!saved || !sameSurface(saved.metadata)) {
      const canvas = document.createElement('canvas')
      canvas.width = GRID_WIDTH * chartCellSize
      canvas.height = GRID_HEIGHT * chartCellSize
      const c = canvas.getContext('2d')!
      if (!sector.id.startsWith('asterwake-offshore:')) paintChartMaterial(c, sector, chartCellSize)
      if (sector.regionId === ASTERWAKE_REGION_ID) {
        const shore = asterwakeShore(sector.column, sector.row, (column, row) =>
          chartedTerrain.get(`${column}:${row}`),
        )
        if (shore) paintAsterwakeShore(c, chartCellSize, shore)
        else if (sector.waterTiles?.startsWith('~') && !/[^~w]/.test(sector.waterTiles))
          c.clearRect(0, 0, canvas.width, canvas.height)
      } else {
        const ox = sector.column * GRID_WIDTH,
          oy = sector.row * GRID_HEIGHT
        let water: CanvasGradient | undefined, lava: CanvasGradient | undefined
        for (let y = 0; y < GRID_HEIGHT; y++) {
          const row = sector.waterTiles?.slice(y * GRID_WIDTH, (y + 1) * GRID_WIDTH) ?? ''
          for (const run of row.matchAll(/~+|w+|l+/g)) {
            c.fillStyle =
              run[0][0] === 'l'
                ? (lava ??= liquidMaterial(c, 'lava', chartCellSize, ox, oy))
                : (water ??= liquidMaterial(c, 'water', chartCellSize, ox, oy))
            c.fillRect(
              run.index * chartCellSize,
              y * chartCellSize,
              run[0].length * chartCellSize,
              chartCellSize,
            )
          }
        }
      }
      if (saved) releaseStaticRaster(saved.ground)
      else if (chartBackdrops.size >= 64) {
        const first = chartBackdrops.keys().next().value!
        releaseStaticRaster(chartBackdrops.get(first)!.ground)
        chartBackdrops.delete(first)
      }
      saved = { metadata: sector, ground: snapshot(canvas) }
      chartBackdrops.set(sector.id, saved)
    }
    drawGroundSurface(target, saved.ground, GRID_WIDTH * tile, GRID_HEIGHT * tile, ratio)
  }
  const groundKey = (sector: WorldSectorView) =>
    terrainKeys.get(sector.id) +
    ':' +
    waterField.get(sector.id)?.key +
    ':' +
    bridgeWater.keys.get(sector.id) +
    ':' +
    lavaField.get(sector.id)?.key +
    ':' +
    bridgeLava.keys.get(sector.id) +
    ':' +
    biomeField.get(sector.id)?.key +
    ':' +
    featureKeys.get(sector.id) +
    ':' +
    rasterTile
  const ground = (sector: WorldSectorView) => {
    const tile = rasterTile
    const key = groundKey(sector)
    const previous = cache.get(sector.id)
    if (previous?.key === key) return previous.ground
    const buildStarted = timing ? performance.now() : 0
    const layer = document.createElement('canvas')
    const pixelsPerTile = Math.max(1, Math.round(tile * groundScale))
    layer.width = GRID_WIDTH * pixelsPerTile
    layer.height = GRID_HEIGHT * pixelsPerTile
    const c = layer.getContext('2d')!
    // Make a tile an integer number of source pixels before projecting it.
    // Otherwise clips can expose the previous layer between liquid cells.
    c.scale(pixelsPerTile / tile, pixelsPerTile / tile)
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    const onFerry = sector.id.startsWith('ferry:')
    const islandOcean = sector.regionId === ASTERWAKE_REGION_ID
    const islandShore =
      islandOcean && view.atlas && sector.atlasColumn !== undefined && sector.atlasRow !== undefined
        ? asterwakeShore(sector.atlasColumn, sector.atlasRow, (column, row) =>
            chartedTerrain.get(`${column}:${row}`),
          )
        : undefined
    const warped = sector.warpedTheme ? warpedPalette[sector.warpedTheme] : undefined
    if (!warped && !onFerry && !islandOcean && sector.cells.length === GRID_WIDTH * GRID_HEIGHT) {
      c.fillStyle = '#233d3c'
      c.fillRect(0, 0, layer.width, layer.height)
    }
    const materialOrigin = sectorMapOrigin(sector)
    // One world-anchored material gradient crosses every cell and sector without
    // resetting its colour at tile edges. Water/lava animation stays on the overlay.
    const waterMaterial = liquidMaterial(
      c,
      'water',
      tile,
      materialOrigin.x,
      materialOrigin.y,
      sector.warpedTheme ?? false,
    )
    const lavaMaterial = liquidMaterial(c, 'lava', tile, materialOrigin.x, materialOrigin.y)
    // Open water and the transparent arch use the same clipped bed, sampled
    // in world coordinates even when the underpass has its own cached raster.
    const paintLiquidBed = (
      target: CanvasRenderingContext2D,
      profile: WaterCell,
      material: 'water' | 'lava',
      base: CanvasGradient,
      worldX: number,
      worldY: number,
    ) => {
      const x = profile.x * tile
      const y = profile.y * tile
      target.save()
      target.translate(x, y)
      clipWaterSurface(target, profile, tile)
      target.translate(-x, -y)
      target.fillStyle = base
      target.fillRect(x, y, tile, tile)
      if (material === 'water')
        paintWaterGround(
          target,
          profile,
          tile,
          sector.warpedTheme ?? false,
          images.get('water-materials'),
          worldX,
          worldY,
          images.get('natural-lakes'),
        )
      else paintLavaGround(target, profile, tile)
      target.restore()
    }
    const paintMaterial = terrainMaterialPainter(
      images,
      tile,
      materialOrigin.x,
      materialOrigin.y,
      sector.warpedTheme,
    )
    if (!onFerry) {
      const water = waterField.get(sector.id)?.cells
      const lava = lavaField.get(sector.id)?.cells
      for (const cell of sector.cells) {
        if (islandOcean && !islandShore && cell.terrain === '~') continue
        const liquid = isWaterTerrain(cell.terrain)
          ? water
          : cell.terrain === 'l'
            ? lava
            : undefined
        const profile = liquid?.get(`${cell.x}:${cell.y}`)
        if (!islandOcean && profile?.banks.length === 0) continue
        paintMaterial(c, cell, sector.regionId)
      }
    }
    const materialLayer = (
      x: number,
      y: number,
      width: number,
      height: number,
      regionId: string,
    ) => {
      const strip = document.createElement('canvas')
      strip.width = Math.ceil(width * groundScale)
      strip.height = Math.ceil(height * groundScale)
      const blend = strip.getContext('2d')!
      blend.scale(groundScale, groundScale)
      blend.imageSmoothingEnabled = true
      blend.imageSmoothingQuality = 'high'
      for (const cell of sector.cells)
        if (
          cell.x * tile < x + width &&
          (cell.x + 1) * tile > x &&
          cell.y * tile < y + height &&
          (cell.y + 1) * tile > y
        )
          paintMaterial(blend, cell, regionId, x, y)
      return { strip, blend }
    }
    const maskMaterial = (
      material: ReturnType<typeof materialLayer>,
      side: number,
      width: number,
      height: number,
    ) => {
      const { blend } = material,
        mask =
          side === 0
            ? blend.createLinearGradient(0, 0, 0, height)
            : side === 1
              ? blend.createLinearGradient(width, 0, 0, 0)
              : side === 2
                ? blend.createLinearGradient(0, height, 0, 0)
                : blend.createLinearGradient(0, 0, width, 0)
      mask.addColorStop(0, 'rgba(0,0,0,.5)')
      mask.addColorStop(0.35, 'rgba(0,0,0,.37)')
      mask.addColorStop(0.75, 'rgba(0,0,0,.08)')
      mask.addColorStop(1, 'rgba(0,0,0,0)')
      blend.globalCompositeOperation = 'destination-in'
      blend.fillStyle = mask
      blend.fillRect(0, 0, width, height)
      blend.globalCompositeOperation = 'source-over'
    }
    // Feather supplied public dry boundaries once in cached ground. The special
    // pavement/liquid/rock overlays below remain authoritative in every biome.
    for (const edge of biomeField.get(sector.id)?.edges ?? []) {
      const vertical = edge.side % 2 === 1,
        width = (vertical ? edge.width : edge.to - edge.from) * tile,
        height = (vertical ? edge.to - edge.from : edge.width) * tile,
        x = (edge.side === 1 ? GRID_WIDTH - edge.width : vertical ? 0 : edge.from) * tile,
        y = (edge.side === 2 ? GRID_HEIGHT - edge.width : vertical ? edge.from : 0) * tile,
        material = materialLayer(x, y, width, height, edge.regionId)
      maskMaterial(material, edge.side, width, height)
      c.drawImage(material.strip, x, y, width, height)
      material.strip.width = material.strip.height = 0
    }
    // Rebuild shared corners with separable weights, rather than overlapping
    // two 50% strips in local edge order. All four quadrants meet at the same
    // material mixture: own(1-u)(1-v), east/west u(1-v), north/south v(1-u), diagonal uv.
    for (const corner of biomeField.get(sector.id)?.corners ?? []) {
      const size = corner.width * tile,
        x = (corner.verticalSide === 1 ? GRID_WIDTH - corner.width : 0) * tile,
        y = (corner.horizontalSide === 2 ? GRID_HEIGHT - corner.width : 0) * tile,
        own = materialLayer(x, y, size, size, sector.regionId),
        vertical = materialLayer(x, y, size, size, corner.verticalRegionId),
        horizontal = materialLayer(x, y, size, size, corner.horizontalRegionId),
        diagonal = materialLayer(x, y, size, size, corner.diagonalRegionId)
      maskMaterial(vertical, corner.verticalSide, size, size)
      own.blend.drawImage(vertical.strip, 0, 0, size, size)
      maskMaterial(diagonal, corner.verticalSide, size, size)
      horizontal.blend.drawImage(diagonal.strip, 0, 0, size, size)
      maskMaterial(horizontal, corner.horizontalSide, size, size)
      own.blend.drawImage(horizontal.strip, 0, 0, size, size)
      c.drawImage(own.strip, x, y, size, size)
      for (const material of [own, vertical, horizontal, diagonal])
        material.strip.width = material.strip.height = 0
    }
    const localTerrain = new Map(sector.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]))
    const trailTerrain = buildTrailGround(sector, renderSectors)
    const winterMarket =
      sector.regionId === WINTER_ART
        ? sector.landmarks.filter((landmark) => landmark.kind === 'marketplace')
        : []
    const pavement = sector.townId ? townPaving[sector.townId] : undefined
    const floorIndex = settlementFloorIndex(sector)
    const floorImage = images.get('settlement-floors')
    const dedicatedFloor =
      floorIndex !== undefined && floorImage?.complete && floorImage.naturalWidth
        ? floorImage
        : undefined
    const shoreRoads = settlementGround.shoreRoads.get(sector.id)
    const pavedCells = settlementGround.pavedCells.get(sector.id)
    if (warped) {
      // Composite the translucent tint once so touching dry cells cannot create
      // darker overlaps or antialiased seams under isometric projection.
      c.beginPath()
      for (const cell of sector.cells)
        if (!isWaterTerrain(cell.terrain) && cell.terrain !== 'l')
          c.rect(cell.x * tile, cell.y * tile, tile, tile)
      c.fillStyle = warped
      c.globalAlpha = 0.68
      c.fill()
      c.globalAlpha = 1
    }
    for (const cell of sector.cells) {
      const x = cell.x * tile,
        y = cell.y * tile
      if (onFerry) continue
      // Legal road cells become the visible riverbed only under a proved
      // crossing. The road approaches keep their regional surface.
      const key = `${cell.x}:${cell.y}`
      if (
        isBridgeRoad(cell) &&
        (waterField.get(sector.id)?.cells.has(key) || lavaField.get(sector.id)?.cells.has(key))
      )
        continue
      if (cell.terrain === '=' || cell.terrain === 's' || pavedCells?.has(`${cell.x}:${cell.y}`)) {
        const square = winterMarket.some(
          (landmark) => Math.abs(landmark.x - cell.x) + Math.abs(landmark.y - cell.y) <= 3,
        )
        const waterAdjacent =
          isWaterTerrain(localTerrain.get(`${cell.x + 1}:${cell.y}`)?.terrain) ||
          isWaterTerrain(localTerrain.get(`${cell.x - 1}:${cell.y}`)?.terrain) ||
          isWaterTerrain(localTerrain.get(`${cell.x}:${cell.y + 1}`)?.terrain) ||
          isWaterTerrain(localTerrain.get(`${cell.x}:${cell.y - 1}`)?.terrain)
        const winterPath = sector.regionId === WINTER_ART && !square && !waterAdjacent
        const naturalTrail =
          !pavedCells?.has(`${cell.x}:${cell.y}`) &&
          (waterAdjacent ||
            shoreRoads?.has(`${cell.x}:${cell.y}`) ||
            (!square && (!sector.townId || !cell.safe)))
        c.fillStyle = naturalTrail
          ? (trailColours[sector.regionId] ?? '#96896e')
          : (pavement?.color ?? '#aa9d7b')
        if (naturalTrail) {
          paintNaturalTrail(
            c,
            cell,
            tile,
            trailTerrain,
            trailColours[sector.regionId] ?? '#96896e',
            sector.id,
            winterPath,
            naturalTrailWear(sector, cell),
          )
        } else {
          c.globalAlpha = winterPath ? 0.4 : 0.72
          c.fillRect(x, y, tile + 1, tile + 1)
          c.globalAlpha = 1
        }
        const pavingImage = dedicatedFloor ?? images.get('terrain')
        if (!naturalTrail && pavingImage?.complete && pavingImage.naturalWidth) {
          const sw = pavingImage.width / 4,
            sh = pavingImage.height / (dedicatedFloor ? 3 : 2)
          const index = dedicatedFloor ? floorIndex! : 4
          if (winterPath) c.globalAlpha = sector.townId ? 0.78 : 0.6
          else if (dedicatedFloor) c.globalAlpha = 0.95
          else if (pavement) c.globalAlpha = 0.76
          c.drawImage(
            pavingImage,
            (index % 4) * sw + ((((sector.atlasColumn ?? 0) * GRID_WIDTH + cell.x) % 4) * sw) / 4,
            Math.floor(index / 4) * sh +
              ((((sector.atlasRow ?? 0) * GRID_HEIGHT + cell.y) % 4) * sh) / 4,
            sw / 4,
            sh / 4,
            x,
            y,
            tile + 1,
            tile + 1,
          )
          c.globalAlpha = 1
        }
        c.fillStyle =
          naturalTrail || winterPath
            ? 'rgba(195,178,146,.15)'
            : (pavement?.glaze ?? 'rgba(192,180,146,.35)')
        if (!naturalTrail) {
          c.globalAlpha = dedicatedFloor ? 0.25 : 1
          c.fillRect(x, y, tile + 1, tile + 1)
          c.globalAlpha = 1
        }
        if (sector.regionId === WINTER_ART && !naturalTrail && !waterAdjacent)
          paintSnowRoadShoulders(
            c,
            cell,
            tile,
            localTerrain,
            sector.id,
            sector.townId ? 0.34 : 0.51,
            pavedCells,
          )
      }
      if (islandOcean && cell.terrain === '~') continue
      if (isWaterTerrain(cell.terrain) || cell.terrain === 'l') {
        const water = isWaterTerrain(cell.terrain)
        const profile = (water ? waterField : lavaField).get(sector.id)?.cells.get(key)
        if (profile)
          paintLiquidBed(
            c,
            profile,
            water ? 'water' : 'lava',
            water ? waterMaterial : lavaMaterial,
            materialOrigin.x + cell.x,
            materialOrigin.y + cell.y,
          )
      }
      if (cell.terrain === '#') {
        // Rock contact shadows belong to the grounded sprite pass. A radial
        // shade clipped to this square still leaves visible diamond corners.
        if (warped) paintWarpedScree(c, cell, tile, sector.id)
      }
    }
    paintTerrainContours(c, sector, tile)
    paintTerrainRelief(c, sector, tile)
    paintImpactGround(c, sector, tile, images.get('impact-basins'))
    const edges = settlementGround.edges.get(sector.id)
    if (edges)
      paintSettlementEdges(
        c,
        edges,
        tile,
        pavement?.color ?? (sector.regionId === WINTER_ART ? '#a4aaa4' : '#95856a'),
      )
    if (islandShore) paintAsterwakeShore(c, tile, islandShore)
    else paintCoastLand(c, coastField.get(sector.id) ?? [], tile, sector.regionId, sector)
    // Small unoccluded liquid surfaces share the terrain cache and its pixel cap.
    const surfaces = new Map<string, LiquidSurface>()
    for (const [id, placement] of featurePlacements.get(sector.id) ?? []) {
      if (!placement?.underpass || !placement.bridgeStrips?.length) continue
      const bounds = bridgeBounds(placement.bridgeStrips)
      const surface = document.createElement('canvas')
      surface.width = Math.ceil(bounds.width * tile * groundScale)
      surface.height = Math.ceil(bounds.height * tile * groundScale)
      const liquid = surface.getContext('2d')!
      liquid.scale(groundScale, groundScale)
      const material = liquidMaterial(
        liquid,
        placement.underpass,
        tile,
        bounds.x,
        bounds.y,
        sector.warpedTheme ?? false,
      )
      const cells: LiquidSurface['cells'] = []
      for (const strip of placement.bridgeStrips)
        for (let y = strip.y; y < strip.y + strip.height; y++)
          for (let x = strip.x; x < strip.x + strip.width; x++) {
            const field = placement.underpass === 'water' ? bridgeWater : bridgeLava
            const profile = field.profiles.get(field.address(sector, x, y))
            if (!profile) continue
            paintLiquidBed(
              liquid,
              { ...profile, x: x - bounds.x, y: y - bounds.y },
              placement.underpass,
              material,
              x,
              y,
            )
            cells.push({ x, y, profile })
          }
      surfaces.set(id, {
        canvas: snapshot(surface),
        tint: sector.warpedTheme,
        ...bounds,
        cells,
      })
    }
    const stale = cache.get(sector.id)
    if (stale) {
      cachedPixels -= stale.pixels
      releaseStaticRaster(stale.ground)
      for (const surface of stale.surfaces.values()) releaseStaticRaster(surface.canvas)
      cache.delete(sector.id)
    }
    const pixels =
      layer.width * layer.height +
      [...surfaces.values()].reduce(
        (sum, surface) => sum + surface.canvas.width * surface.canvas.height,
        0,
      )
    while (cache.size && cachedPixels + pixels > 8_000_000) {
      const oldest =
        [...cache.keys()].find((id) => !visibleGroundIds.has(id)) ?? cache.keys().next().value!
      const entry = cache.get(oldest)!
      cachedPixels -= entry.pixels
      releaseStaticRaster(entry.ground)
      for (const surface of entry.surfaces.values()) releaseStaticRaster(surface.canvas)
      cache.delete(oldest)
    }
    const image = snapshot(layer)
    const publicSurface =
      sector.charted && sector.cells.length === GRID_WIDTH * GRID_HEIGHT
        ? chartedTerrain.get(`${sector.atlasColumn}:${sector.atlasRow}`)
        : undefined
    const pendingMaterials: string[] = []
    const awaiting = (name: string) => !images.get(name)?.naturalWidth
    if (floorIndex !== undefined && awaiting('settlement-floors'))
      pendingMaterials.push('settlement-floors')
    if (warped && awaiting('void-ground')) pendingMaterials.push('void-ground')
    if (awaiting('impact-basins') && impactSite(sector)) pendingMaterials.push('impact-basins')
    const wetCells = waterField.get(sector.id)?.cells
    if (wetCells?.size && !onFerry) {
      if (awaiting('water-materials')) pendingMaterials.push('water-materials')
      if (awaiting('natural-lakes') && [...wetCells.values()].some((cell) => cell.basin))
        pendingMaterials.push('natural-lakes')
    }
    cache.set(sector.id, {
      key,
      scale: groundScale,
      ground: image,
      publicSurface,
      pendingMaterials,
      surfaces,
      pixels,
    })
    cachedPixels += pixels
    if (timing) {
      timing.groundBuilds!++
      timing.groundBuildMs! += performance.now() - buildStarted
    }
    return image
  }
  function biomeRaster(item: Scenery) {
    // Individual tree growth changes CSS sizes continuously. Round only the
    // backing resolution upward so nearby sizes share a sharp, bounded crop;
    // the supplied width, height, root anchor and canopy transform stay exact.
    const desktopOverview = tile < 32 && width >= 600
    const bucket = tile >= 32 ? 32 : desktopOverview ? 16 : 1
    const pixelWidth = Math.ceil((item.width * ratio) / bucket) * bucket
    const pixelHeight = Math.ceil((item.height * ratio) / bucket) * bucket
    const pixels = pixelWidth * pixelHeight
    if (pixels > BIOME_RASTER_PIXEL_LIMIT) return null
    const crop = item.source?.join(',') ?? `${item.index}/${item.columns}/${item.rows}`
    const key = `${item.image.src}:${crop}:${pixelWidth}:${pixelHeight}`
    const cached = biomeRasters.get(key)
    if (cached) {
      biomeRasters.delete(key)
      biomeRasters.set(key, cached)
      return cached
    }

    // Pre-scale atlas crops that otherwise repeatedly resample large source
    // images for each canopy shear, including seasonal desktop foliage.
    const layer = document.createElement('canvas')
    layer.width = pixelWidth
    layer.height = pixelHeight
    const context = layer.getContext('2d')
    if (!context) return null
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    sprite(
      context,
      item.image,
      item.index,
      item.columns,
      item.rows,
      0,
      0,
      pixelWidth,
      pixelHeight,
      item.source,
    )
    while (
      biomeRasters.size &&
      (biomeRasters.size >= (desktopOverview ? 192 : 64) ||
        biomeRasterPixels + pixels > BIOME_RASTER_PIXEL_LIMIT)
    ) {
      const oldest = biomeRasters.keys().next().value!
      const evicted = biomeRasters.get(oldest)!
      biomeRasterPixels -= evicted.width * evicted.height
      biomeRasters.delete(oldest)
      releaseStaticRaster(evicted)
    }
    const raster = snapshot(layer)
    biomeRasters.set(key, raster)
    biomeRasterPixels += pixels
    if (timing) timing.biomeRasterBuilds!++
    return raster
  }
  function fitCachedGround() {
    // Density may fall when more terrain enters the camera. Reuse the painted
    // content rather than rerunning all shore/biome geometry. Do not upscale it
    // again at every visibility threshold: that churn also degrades the image.
    // Zoom settles once; resize, loaded art and terrain changes still rebuild.
    for (const entry of cache.values()) {
      if (entry.scale <= groundScale) continue
      const resample = (source: StaticMapRaster, pixelWidth: number, pixelHeight: number) => {
        const resampleStarted = timing ? performance.now() : 0
        const target = document.createElement('canvas')
        target.width = pixelWidth
        target.height = pixelHeight
        const context = target.getContext('2d')!
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(source, 0, 0, target.width, target.height)
        if (timing) {
          timing.groundResamples!++
          timing.groundResampleMs! += performance.now() - resampleStarted
        }
        return snapshot(target)
      }
      const cellPixels = Math.round(rasterTile * groundScale)
      const ground = resample(entry.ground, GRID_WIDTH * cellPixels, GRID_HEIGHT * cellPixels)
      releaseStaticRaster(entry.ground)
      const surfaces = new Map<string, LiquidSurface>()
      for (const [id, surface] of entry.surfaces) {
        surfaces.set(id, {
          ...surface,
          canvas: resample(
            surface.canvas,
            Math.ceil(surface.width * rasterTile * groundScale),
            Math.ceil(surface.height * rasterTile * groundScale),
          ),
        })
        releaseStaticRaster(surface.canvas)
      }
      const pixels =
        ground.width * ground.height +
        [...surfaces.values()].reduce(
          (sum, surface) => sum + surface.canvas.width * surface.canvas.height,
          0,
        )
      cachedPixels += pixels - entry.pixels
      Object.assign(entry, { ground, surfaces, pixels, scale: groundScale })
    }
  }
  const liquidVisible = (point: MapPoint) =>
    point.x >= -tile * 2 &&
    point.x <= width + tile * 2 &&
    point.y >= -tile &&
    point.y <= height + tile

  function colosseumDetailVisible(
    item: Pick<Scenery, 'x' | 'y' | 'width' | 'height' | 'anchorX' | 'anchorY'>,
    target: readonly number[],
  ) {
    const p = screen(item)
    const [x, y, w, h] = target
    const left = p.x + (x! - (item.anchorX ?? 0.5)) * item.width
    const top = p.y + (y! - (item.anchorY ?? 1)) * item.height
    return left < width && left + w! * item.width > 0 && top < height && top + h! * item.height > 0
  }
  function paintColosseumDetails(item: Scenery, x: number, y: number) {
    if (item.image !== images.get('remote-colosseum')) return
    for (const detail of colosseumDetailArt) {
      if (
        item.width * ratio <= detail.minProjectedMacroWidth ||
        !colosseumDetailVisible(item, detail.target)
      )
        continue
      const image = images.get(detail.sheet)
      if (!image?.complete || !image.naturalWidth) continue
      const [dx, dy, w, h] = detail.target
      ctx.save()
      ctx.globalAlpha = Math.min(1, (item.width * ratio - detail.minProjectedMacroWidth) / 768)
      ctx.drawImage(
        image,
        x + dx * item.width,
        y + dy * item.height,
        w * item.width,
        h * item.height,
      )
      ctx.restore()
    }
  }
  function stationaryGroundLayer(
    visible: readonly WorldSectorView[],
    ambient: boolean,
    moving: boolean,
  ) {
    // Only combine a consecutive dry run. Liquid/coast ordering is unchanged.
    let start = 0,
      end = 0,
      runStart = 0
    visible.forEach((sector, index) => {
      const origin = sectorOrigin(sector)
      if (
        coastField.get(sector.id)?.length ||
        (ambient &&
          sector.cells.some(
            ({ terrain, x, y }) =>
              (isWaterTerrain(terrain) || terrain === 'l') &&
              liquidVisible(screen({ x: origin.x + x, y: origin.y + y })),
          ))
      )
        runStart = index + 1
      else if (index + 1 - runStart > end - start) {
        start = runStart
        end = index + 1
      }
    })
    const effective = { x: camera.x + pan.x, y: camera.y + pan.y }
    const ids = visible
      .slice(start, end)
      .map(({ id }) => id)
      .join(':')
    const previous = stationaryGround
    const shift = previous && projectMapPoint(previous.camera, camera, pan, tile, width, height)
    const left = shift ? (shift.x - width / 2) * ratio : 0
    const top = shift ? (shift.y - height / 2) * ratio : 0
    if (
      previous?.ambient === ambient &&
      previous.ids === ids &&
      (previous.padding
        ? Math.abs(left) <= previous.padding - 2 && Math.abs(top) <= previous.padding - 2
        : !left && !top)
    ) {
      // Only the terrain bitmap follows this translation. Scenery includes
      // moving canopies and screen culling, so it keeps its original frame path.
      if (left || top) clearStationaryScenery()
      return {
        ...previous,
        start,
        end,
        left: left - previous.padding,
        top: top - previous.padding,
        stationary: !left && !top,
      }
    }
    // During motion a cache miss can draw the individual sector surfaces.
    // Compositing a new viewport-sized bitmap competes with the actor frames.
    if (moving) return null
    clearStationaryGround()
    clearStationaryScenery()
    if (end - start < 4) return null
    const padding = tile >= 32 ? Math.ceil(128 * ratio) : 0
    const layerWidth = canvas.width + 2 * padding
    const layerHeight = canvas.height + 2 * padding
    if (layerWidth * layerHeight > 4_000_000) return null
    const layer = document.createElement('canvas')
    layer.width = layerWidth
    layer.height = layerHeight
    const target = layer.getContext('2d')
    if (!target) return null
    target.save()
    for (const sector of visible.slice(start, end)) {
      const p = screen(sectorOrigin(sector))
      const surface = ground(sector)
      // Reuse projected rasters at native density so a walk that outgrows the
      // composite does not repeat the affine paint. At higher densities, keep
      // the direct composite path to avoid preloading overscan into the cache.
      const projected =
        tile >= 32 && ratio === 1
          ? groundProjections.get(surface, GRID_WIDTH * tile, GRID_HEIGHT * tile, ratio)
          : null
      if (projected) {
        target.setTransform(1, 0, 0, 1, 0, 0)
        target.drawImage(
          projected.canvas,
          p.x * ratio + padding + projected.left,
          p.y * ratio + padding + projected.top,
        )
        continue
      }
      target.setTransform(
        ratio * MAP_X,
        ratio * MAP_Y,
        -ratio * MAP_X,
        ratio * MAP_Y,
        p.x * ratio + padding,
        p.y * ratio + padding,
      )
      drawGroundSurface(target, surface, GRID_WIDTH * tile, GRID_HEIGHT * tile, ratio)
    }
    target.restore()
    stationaryGround = {
      camera: effective,
      ambient,
      layer: snapshot(layer),
      start,
      end,
      ids,
      padding,
    }
    return { ...stationaryGround, left: -padding, top: -padding, stationary: true }
  }
  const portrait = (src: string | null) => {
    if (!src) return null
    let image = portraits.get(src)
    if (!image) {
      image = new Image()
      image.onload = requestDraw
      image.src = src
      portraits.set(src, image)
      while (portraits.size > PORTRAIT_CACHE_LIMIT) portraits.delete(portraits.keys().next().value!)
    }
    return image.complete && image.naturalWidth ? image : null
  }
  function draw(now: number, rafAt: number, remoteMoving: boolean) {
    hitTargets = []
    groundProjections.beginFrame()
    wildlifeParts.beginFrame()
    weatherVeil.beginFrame()
    const start = performance.now(),
      sample = motion.sample(now),
      previousFrame = last,
      delta = Math.min(sample.moving && !wasMoving ? 16 : 64, now - last || 16)
    timing = timingEnabled()
      ? {
          updates: 0,
          updateMs: 0,
          peerUpdateMs: 0,
          lastPeerUpdateAt: 0,
          terrainIndexes: 0,
          terrainIndexMs: 0,
          ...pendingTiming,
          frameAt: now,
          rafAt,
          startedAt: start,
          callbackDelayMs: callbackStarted - rafAt,
          groundBuilds: 0,
          groundBuildMs: 0,
          groundResamples: 0,
          biomeRasterBuilds: 0,
          groundResampleMs: 0,
          staticRasterBuilds: 0,
          staticRasterTransfers: 0,
        }
      : null
    pendingTiming = null
    if (!timing && canvas.dataset.renderTiming !== undefined) delete canvas.dataset.renderTiming
    let phaseAt = start
    last = now
    lastPaintRaf = rafAt
    camera = {
      x: camera.x + (sample.point.x - camera.x) * (1 - Math.exp(-delta / 90)),
      y: camera.y + (sample.point.y - camera.y) * (1 - Math.exp(-delta / 90)),
    }
    if (Math.hypot(sample.point.x - camera.x, sample.point.y - camera.y) < 0.001)
      camera = sample.point
    const current = view.sectors.find((sector) => sector.id === view.position.sectorId)
    // A movement receipt may announce a charted sector before its authority
    // window arrives. Public chart identity still proves the ground under this frame.
    const chartedFrame =
      current?.charted ??
      view.atlas?.some((sector) => sector.charted && sector.id === view.position.sectorId)
    const regionId = current?.regionId ?? 'verdant-expanse'
    const weather = view.environment.weather
    if (animate) visualMinuteOfDay = view.environment.minuteOfDay
    const windTarget = worldWindTarget(weather, regionId)
    const ambient = animate && !reduced
    const windElapsed = ambient && wind ? Math.min(250, Math.max(0, now - previousFrame)) : 0
    wind = advanceWorldWind(wind ?? { speed: windTarget, offset: 0 }, windTarget, windElapsed)
    const rainTarget = surfaceRainTarget(weather, regionId)
    surfaceRain = advanceSurfaceRain(surfaceRain ?? rainTarget, rainTarget, windElapsed)
    const surfaceWeather = { rain: surfaceRain, windSpeed: wind.speed }
    const budget = mapQualityBudgets[quality]
    const richAtmosphere = budget.clouds && (width >= 600 || quality === 'high')
    const colosseum = grandDiscoveries.find((site) => site.id === 'remote-colosseum')
    if (colosseum) {
      const item = {
        x: wrappedMapX(colosseum.worldx, camera.x),
        y: colosseum.worldy,
        width: colosseum.widthTiles * tile,
        height: colosseum.heightTiles * tile,
        anchorX: colosseum.anchorX,
        anchorY: colosseum.anchorY,
      }
      for (const detail of colosseumDetailArt)
        if (
          item.width * ratio > detail.minProjectedMacroWidth &&
          colosseumDetailVisible(item, detail.target) &&
          !images.has(detail.sheet)
        )
          load(detail.sheet, 'v01')
    }
    const valley = grandDiscoveries.find((site) => site.id === 'elemental-valley')
    if (valley)
      for (const detail of valleyDetailArt)
        if (
          valley.widthTiles * tile * ratio > detail.minProjectedMacroWidth &&
          !images.has(detail.sheet)
        )
          load(detail.sheet, 'v01')
    if (
      grandDiscoveries.some((site) => site.arenaFloor) &&
      !images.has(colosseumArenaMaterial.sheet)
    )
      load(colosseumArenaMaterial.sheet, 'v01')
    const ferryFrame = current?.id.startsWith('ferry:')
      ? ferryWaterFrame(
          view.ferry?.passage,
          view.serverNow + Math.max(0, now - ferryClockAt),
          now,
          wind,
          ambient,
        )
      : null
    const visibleIds = view.players
      .filter((player) => {
        const point = remoteMotion.sample(player.characterId, now, camera)
        if (!point) return false
        const p = screen(point)
        return p.x > -21 && p.x < width + 21 && p.y > -4 && p.y < height + 38
      })
      .map((player) => player.characterId)
      .sort()
    const nextPlayerKey = JSON.stringify(visibleIds)
    if (visiblePlayerKey !== nextPlayerKey) {
      visiblePlayerKey = nextPlayerKey
      onVisiblePlayers(visibleIds)
    }
    const visible = renderSectors.filter((sector) => {
      const p = screen(sectorOrigin(sector))
      return (
        p.x - GRID_HEIGHT * tile * MAP_X < width + tile * 4 &&
        p.y < height + tile * 4 &&
        p.x + GRID_WIDTH * tile * MAP_X > -tile * 4 &&
        p.y + (GRID_WIDTH + GRID_HEIGHT) * tile * MAP_Y > -tile * 4
      )
    })
    // Scene receipts slide a much larger supplied terrain window around the
    // camera. Re-index when a visible sector actually changed or a newly
    // supplied sector first enters the camera; distant window additions are
    // not an input to any ground layer currently being painted.
    const nextVisibleTerrainIds = new Set(visible.map((sector) => sector.id))
    const visibleTerrainChanged =
      nextVisibleTerrainIds.size !== activeVisibleTerrainIds.size ||
      [...nextVisibleTerrainIds].some((id) => !activeVisibleTerrainIds.has(id))
    if (visibleTerrainChanged && terrainDependenciesChanged(nextVisibleTerrainIds)) {
      indexTerrain()
      loadRegionalArt()
    }
    activeVisibleTerrainIds = nextVisibleTerrainIds
    // All visible layers must fit together. Otherwise higher-resolution terrain
    // evicts the next visible layer and rebuilds the entire scene every frame.
    const budgetScale = Math.sqrt(
      7_800_000 /
        (Math.max(
          1,
          visible.reduce(
            (sum, sector) =>
              sum +
              GRID_WIDTH * GRID_HEIGHT +
              [...(featurePlacements.get(sector.id)?.values() ?? [])].reduce((area, placement) => {
                if (!placement?.bridgeStrips?.length) return area
                const bounds = bridgeBounds(placement.bridgeStrips)
                return area + bounds.width * bounds.height
              }, 0),
            0,
          ),
        ) *
          rasterTile *
          rasterTile),
    )
    const requestedScale = Math.min(ratio, Math.floor(budgetScale * 10) / 10)
    // Fractional backing pixels multiply antialiasing at each liquid-cell clip,
    // exposing dark ground as a grid. Keep each cached cell pixel-aligned while
    // retaining the existing coarse density steps and total visible-pixel budget.
    groundScale =
      Math.max(
        1,
        Math.min(Math.ceil(rasterTile * requestedScale), Math.floor(rasterTile * budgetScale)),
      ) / rasterTile
    visibleGroundIds = new Set(visible.map((sector) => sector.id))
    fitCachedGround()
    const backingPixels = canvas.width * canvas.height
    const cacheStationaryGround =
      !ferryFrame &&
      backingPixels > 0 &&
      backingPixels <= 4_000_000 &&
      rasterZoomAt === null &&
      (tile >= 32 ||
        (width < 600 &&
          ratio > 1 &&
          !sample.moving &&
          camera.x === sample.point.x &&
          camera.y === sample.point.y))
    if (!cacheStationaryGround) {
      clearStationaryGround()
      clearStationaryScenery()
    }
    // Visibility also admits tall scenery whose ground is beyond the viewport.
    const groundInView = (p: MapPoint) => {
      const bleed = 2 / ratio
      return (
        p.x + GRID_WIDTH * tile * MAP_X > -bleed &&
        p.x - GRID_HEIGHT * tile * MAP_X < width + bleed &&
        p.y + (GRID_WIDTH + GRID_HEIGHT) * tile * MAP_Y > -bleed &&
        p.y < height + bleed
      )
    }
    // At continental zoom a terrain receipt can supply dozens of sectors in one
    // tick. Paint the public chart immediately, then refine nearest ground first.
    const pendingDetail = new Map<string, WorldAtlasCell>()
    if (current?.charted && width >= 600 && tile < 32 && visible.length >= 16) {
      const waiting: { id: string; chart: WorldAtlasCell; distance: number }[] = []
      for (const sector of visible) {
        if (!sector.charted || cache.get(sector.id)?.key === groundKey(sector)) continue
        const chart = chartedTerrain.get(`${sector.atlasColumn}:${sector.atlasRow}`)
        const p = screen(sectorOrigin(sector))
        if (!chart || !groundInView(p)) continue
        const dx = p.x + ((GRID_WIDTH - GRID_HEIGHT) * tile * MAP_X) / 2 - width / 2
        const dy = p.y + ((GRID_WIDTH + GRID_HEIGHT) * tile * MAP_Y) / 2 - height / 2
        waiting.push({ id: sector.id, chart, distance: dx * dx + dy * dy })
      }
      waiting.sort((a, b) => a.distance - b.distance)
      for (const { id, chart } of waiting.slice(1)) pendingDetail.set(id, chart)
    }
    pendingOverviewGround = pendingDetail.size > 0
    const movementActive =
      sample.moving || remoteMoving || sample.point.x !== camera.x || sample.point.y !== camera.y
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    if (ferryFrame)
      paintFerrySea(ctx, width, height, ferryFrame, quality === 'low', {
        pine: images.get('ferry-pine-coast'),
        cliff: images.get('ferry-cliff-coast'),
        dolphin: images.get('ferry-dolphin'),
      })
    else {
      ctx.fillStyle = current?.warpedTheme
        ? WARPED_GROUND_COLOR
        : chartedFrame
          ? '#284b57'
          : '#233d3c'
      ctx.fillRect(0, 0, width, height)
      const seaCamera = { x: camera.x + pan.x, y: camera.y + pan.y }
      if (
        chartedFrame &&
        !(
          movementActive &&
          publicGroundCoversViewport(visible, coastField, seaCamera, tile, width, height)
        )
      )
        paintOpenSea(
          ctx,
          width,
          height,
          tile,
          seaCamera,
          now,
          ambient,
          surfaceWeather,
          quality === 'low' ? 18 : 48,
        )
    }
    // A route/read can briefly outpace full scenery. The public chart can paint
    // dry ground immediately without changing collision, fog, or real water.
    if (chartedFrame && chartedTerrain.size) {
      const left = unprojectMapPoint({ x: 0, y: 0 }, camera, pan, tile, width, height)
      const right = unprojectMapPoint({ x: width, y: height }, camera, pan, tile, width, height)
      const top = unprojectMapPoint({ x: width, y: 0 }, camera, pan, tile, width, height)
      const bottom = unprojectMapPoint({ x: 0, y: height }, camera, pan, tile, width, height)
      const completeIds = visible.every(
        (sector) => sector.cells.length === GRID_WIDTH * GRID_HEIGHT,
      )
        ? nextVisibleTerrainIds
        : new Set(
            visible
              .filter((sector) => sector.cells.length === GRID_WIDTH * GRID_HEIGHT)
              .map((sector) => sector.id),
          )
      for (let row = Math.floor(top.y / GRID_HEIGHT); row <= bottom.y / GRID_HEIGHT; row++)
        for (
          let column = Math.floor(left.x / GRID_WIDTH);
          column <= right.x / GRID_WIDTH;
          column++
        ) {
          const key = `${wrapAtlasColumn(column)}:${row}`
          const sector = chartedTerrain.get(key) ?? islandFringes.get(key)
          if (!sector || completeIds.has(sector.id)) continue
          const p = screen({ x: column * GRID_WIDTH, y: row * GRID_HEIGHT })
          if (
            p.x - GRID_HEIGHT * tile * MAP_X > width + 1 ||
            p.x + GRID_WIDTH * tile * MAP_X < -1 ||
            p.y > height + 1 ||
            p.y + (GRID_WIDTH + GRID_HEIGHT) * tile * MAP_Y < -1
          )
            continue
          ctx.save()
          ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, p.x, p.y)
          let edges = chartCoasts.get(sector.id)
          if (!edges) {
            edges =
              sector.regionId === ASTERWAKE_REGION_ID
                ? []
                : publicCoastEdges(
                    sector.column,
                    sector.row,
                    (c, r) => chartedTerrain.has(`${c}:${r}`),
                    (x, y) => sector.waterTiles?.[y * GRID_WIDTH + x] ?? '.',
                  )
            chartCoasts.set(sector.id, edges)
          }
          const address = { atlasColumn: sector.column, atlasRow: sector.row }
          if (edges.length)
            paintCoastSea(
              ctx,
              edges,
              tile,
              now,
              false,
              edges.length,
              sector.regionId,
              0,
              0,
              address,
            )
          paintChartGround(ctx, sector)
          if (edges.length) paintCoastLand(ctx, edges, tile, sector.regionId, address)
          ctx.restore()
        }
    }
    // The compositor rasterizes these draws after the callback. Use the
    // lighter sampler while animating the viewport; source crops and cached
    // terrain are still prepared at high quality and labels keep native density.
    ctx.imageSmoothingQuality = movementActive || quality === 'low' ? 'medium' : 'high'
    const projection = cacheStationaryGround
      ? stationaryGroundLayer(visible, ambient, movementActive)
      : null
    if (timing) {
      timing.projectedGroundSectors = projection?.layer ? projection.end - projection.start : 0
      timing.projectedGroundPixels = projection?.layer
        ? projection.layer.width * projection.layer.height
        : 0
    }
    if (timing) {
      const ended = performance.now()
      timing.prepareMs = ended - phaseAt
      phaseAt = ended
    }
    const cacheScenery =
      width < 600 &&
      tile < 32 &&
      ratio > 1 &&
      projection?.layer &&
      projection.stationary &&
      !sample.moving
    const cachedScenery = cacheScenery ? stationaryScenery : null
    const scenery = cachedScenery ?? []
    const docks = visible.flatMap((sector) => {
      const landmark = sector.landmarks.find(({ id }) => isFerryTerminalLandmark(id))
      if (!landmark) return []
      const north = sector.id === FERRY_NORTH_DOCK.sectorId
      const asterwake = sector.id === FERRY_ASTERWAKE_DOCK.sectorId
      const shoreSide = sector.ferryDock?.shoreSide ?? (north ? 'north' : 'south')
      const origin = sectorOrigin(sector)
      return [
        {
          sectorId: sector.id,
          x: origin.x + landmark.x + 0.5,
          y: origin.y + landmark.y + 0.5,
          shoreSide,
          port: asterwake
            ? ('asterwake' as const)
            : north
              ? ('north-shore' as const)
              : sector.charted
                ? ('mainland' as const)
                : ('uncharted' as const),
        },
      ]
    })
    const pierTerrainAt = (point: MapPoint, domain: string) => {
      const column = Math.floor(point.x / GRID_WIDTH)
      const row = Math.floor(point.y / GRID_HEIGHT)
      const x = Math.floor(point.x - column * GRID_WIDTH)
      const y = Math.floor(point.y - row * GRID_HEIGHT)
      const sector = renderSectors.find((candidate) => {
        if (mapSceneDomain(candidate) !== domain) return false
        const origin = sectorOrigin(candidate)
        return origin.x === column * GRID_WIDTH && origin.y === row * GRID_HEIGHT
      })
      const cell = sector?.cells.find((cell) => cell.x === x && cell.y === y)
      if (cell) return isWaterTerrain(cell.terrain)
      if (domain !== 'atlas' || !chartedTerrain.size || row < 0 || row >= ATLAS_ROWS) return false
      const chart = chartedTerrain.get(`${wrapAtlasColumn(column)}:${row}`)
      return !chart || isWaterTerrain(chart.waterTiles?.[y * GRID_WIDTH + x])
    }
    const piers = docks.flatMap((dock) => {
      const sector = visible.find(({ id }) => id === dock.sectorId)!
      const domain = mapSceneDomain(sector)
      const pier = ferryPierPlacement(dock, dock.shoreSide, (point) => pierTerrainAt(point, domain))
      return pier ? [{ dock, pier }] : []
    })
    const dockBySector = new Map(docks.map((dock) => [dock.sectorId, dock]))
    const bridgeBanks: MapPoint[] = []
    if (!cachedScenery) {
      for (const sector of visible) {
        for (const placement of featurePlacements.get(sector.id)?.values() ?? []) {
          const deck = placement?.deck
          if (!deck) continue
          for (const sign of [-1, 1]) {
            const bank = { ...deck.point }
            bank[deck.along] += (sign * deck.span) / 2
            if (sector.charted) bank.x = wrappedMapX(bank.x, camera.x)
            bridgeBanks.push(screen(bank))
          }
        }
      }
    }
    const addScenery = (item: Scenery) => {
      const p = screen(item)
      const anchorX = item.anchorX ?? 0.5
      const left = p.x - item.width * (item.mirror ? 1 - anchorX : anchorX)
      // Reserve the bank entrance only when the foreground canopy would actually cover it.
      if (
        item.tree &&
        bridgeBanks.some(
          (bank) =>
            bank.y < p.y &&
            bank.y > p.y - item.height * ((item.anchorY ?? 1) - 0.12) &&
            bank.x > left + item.width * 0.18 - tile * 0.18 &&
            bank.x < left + item.width * 0.82 + tile * 0.18,
        )
      )
        return
      if (
        left + item.width > 0 &&
        left < width &&
        p.y + item.height * (1 - (item.anchorY ?? 1)) > 0 &&
        p.y - item.height * (item.anchorY ?? 1) < height
      )
        scenery.push(item)
    }
    const highResMountains =
      quality !== 'low' &&
      mountains.some((feature) => !feature.pass && feature.heightTiles * tile * ratio > 384)
    if (highResMountains && images.has('mountains') && !images.has('mountains-hd'))
      load('mountains-hd', 'v01')
    const hdMountains = images.get('mountains-hd')
    const mountainSheet =
      highResMountains && hdMountains?.complete && hdMountains.naturalWidth
        ? hdMountains
        : images.get('mountains')
    const nature = images.get('nature'),
      livingTrees = images.get('living-trees'),
      forestTrees = images.get('forest-variety'),
      asterwakeWoodland = images.get('asterwake-woodland'),
      buildings = images.get('buildings'),
      props = images.get('props'),
      biomes = images.get('biomes'),
      beauties = images.get('beauties'),
      winterArt = images.get(WINTER_ART),
      settlementArt = images.get('regional-settlements'),
      hamletBuildings = images.get('hamlet-buildings'),
      winterHamletBuildings = images.get('hamlet-buildings-winter'),
      warpedLandmarks = images.get('warped-landmarks'),
      warpedRefuges = images.get('warped-refuges')
    // Wind and culling follow the camera each frame. Species and growth can
    // be reused until terrain, available artwork, dock clearances or scale change.
    const availableTreeArt = [nature, livingTrees, forestTrees, asterwakeWoodland, biomes, beauties]
      .map((image) => (image?.complete ? image.naturalWidth : 0))
      .join(',')
    const woodlandKey = `${tile}:${availableTreeArt}:${docks.map(({ x, y }) => `${x},${y}`).join(';')}`
    let waterCells = 0,
      wildlifeCount = 0,
      coastEdges = 0,
      wildlifeWalking = 0
    if (!cachedScenery) {
      if (mountainSheet?.complete && mountainSheet.naturalWidth) {
        for (const feature of mountains) {
          addScenery({
            x: feature.charted ? wrappedMapX(feature.x, camera.x) : feature.x,
            y: feature.y,
            width: tile * feature.widthTiles,
            height: tile * feature.heightTiles,
            image: mountainSheet,
            index: feature.index,
            columns: 4,
            rows: 3,
            anchorX: 0.5,
            anchorY: 0.94,
            tree: false,
            grandFeature: true,
          })
        }
      }
      for (const discovery of [...grandDiscoveries, ...oceanDiscoveries]) {
        const image = images.get(discovery.sheet)
        if (!image?.complete || !image.naturalWidth) continue
        addScenery({
          x: wrappedMapX(discovery.worldx, camera.x),
          y: discovery.worldy,
          width: discovery.widthTiles * tile,
          height: discovery.heightTiles * tile,
          image,
          index: discovery.index,
          columns: discovery.columns,
          rows: discovery.rows,
          anchorX: discovery.anchorX,
          anchorY: discovery.anchorY,
          tree: false,
          grandFeature: !('coastSide' in discovery),
          oceanFeature: 'coastSide' in discovery,
          ...('arenaFloor' in discovery ? { arenaFloor: discovery.arenaFloor } : {}),
          ...('waterfall' in discovery
            ? { waterfall: discovery.waterfall, waterfallStyle: 'grand' as const }
            : {}),
        })
      }
    }
    for (const [index, sector] of visible.entries()) {
      const origin = sectorOrigin(sector),
        p = screen(origin)
      if (ferryFrame && sector.id === current?.id) {
        paintFerryHull(
          ctx,
          (x, y) => screen({ x: origin.x + x, y: origin.y + y }),
          tile,
          ferryFrame,
          quality === 'low',
          images.get('ferry-passenger-hull'),
        )
      } else if (projection?.layer && index >= projection.start && index < projection.end) {
        if (index === projection.start) {
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.drawImage(projection.layer, projection.left, projection.top)
          ctx.restore()
        }
      } else {
        ctx.save()
        ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, p.x, p.y)
        // The cached Asterwake shore carries its own shallows through the inlets.
        if (sector.regionId !== ASTERWAKE_REGION_ID)
          coastEdges += paintCoastSea(
            ctx,
            coastField.get(sector.id) ?? [],
            tile,
            now,
            ambient,
            16 - coastEdges,
            sector.regionId,
            budget.surf,
            wind.speed,
            sector,
          )
        const chart = pendingDetail.get(sector.id)
        if (chart) paintChartGround(ctx, chart)
        else if (groundInView(p)) {
          const surface = ground(sector)
          // Cache at settled scale, including the phone overview. While zooming
          // draw existing surfaces directly until the new raster size is ready.
          const desktopOverview = tile < 32 && width >= 600
          const projected =
            rasterZoomAt === null && (tile >= 32 || desktopOverview || ratio > 1)
              ? groundProjections.get(
                  surface,
                  GRID_WIDTH * tile,
                  GRID_HEIGHT * tile,
                  ratio,
                  desktopOverview ? 96 : 16,
                )
              : null
          if (projected) {
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.drawImage(
              projected.canvas,
              p.x * ratio + projected.left,
              p.y * ratio + projected.top,
            )
          } else drawGroundSurface(ctx, surface, GRID_WIDTH * tile, GRID_HEIGHT * tile, ratio)
        }
        ctx.restore()
      }
      if (
        !cachedScenery &&
        !sector.id.startsWith('ferry:') &&
        nature?.complete &&
        nature.naturalWidth
      ) {
        const saved = woodland.get(sector)
        const reusable = saved?.key === woodlandKey && saved.originX === origin.x
        const items: Scenery[] = reusable ? saved.items : []
        if (!reusable) {
          const mixedTreeRegions = biomeField.get(sector.id)?.treeRegions
          const edgeCells = warpedEdges.get(sector.id)?.cells
          const denseRidge = denseMountainRidge(sector)
          const denseCanopy =
            sector.warpedTheme && sector.cells.filter(({ terrain }) => terrain === 't').length >= 14
          for (const cell of sector.cells) {
            if (
              sector.landscape === 'wildflowers' &&
              cell.terrain === '.' &&
              beauties?.complete &&
              beauties.naturalWidth &&
              hashString(`${sector.id}:${cell.x}:${cell.y}`) % 5 === 0
            ) {
              items.push({
                x: origin.x + cell.x + 0.5,
                y: origin.y + cell.y + 0.75,
                width: tile * 1.15,
                height: tile * 1.1,
                image: beauties,
                index: 7,
                columns: 4,
                rows: 2,
                tree: false,
              })
            }
            if (cell.terrain !== 't' && cell.terrain !== '#') continue
            // Open the dock itself and its view-side approach across sector seams.
            if (
              docks.some((dock) => {
                const dx = origin.x + cell.x + 0.5 - dock.x
                const dy = origin.y + cell.y + 0.5 - dock.y
                return (
                  Math.abs(dx) + Math.abs(dy) <= 3 ||
                  (dx + dy > 0 && dx + dy <= 6 && Math.abs(dx - dy) <= 3)
                )
              })
            )
              continue
            if (denseRidge && cell.terrain === '#' && !drawMountainScree(sector.id, cell.x, cell.y))
              continue
            // Keep the viewing side of surveyed private landmarks clear of
            // canopy. Ground and walkability retain their authoritative terrain.
            if (
              cell.terrain === 't' &&
              sector.warpedTheme &&
              sector.landmarks.some((landmark) => {
                const dx = cell.x - landmark.x
                const dy = cell.y - landmark.y
                return (
                  landmark.warpedArt !== undefined &&
                  dx + dy >= 0 &&
                  dx + dy <= 3 &&
                  Math.abs(dx - dy) <= 2
                )
              })
            )
              continue
            const rock = cell.terrain === '#'
            if (sector.regionId === ASTERWAKE_REGION_ID) {
              const grove = sector.id === ASTERWAKE_GOLDEN_TREE.sectorId
              const dx = Math.abs(cell.x - ASTERWAKE_GOLDEN_TREE.x)
              const dy = Math.abs(cell.y - ASTERWAKE_GOLDEN_TREE.y)
              if (grove && dx <= 1 && dy <= 1) continue
              const seed = hashString(`${sector.id}:${cell.x}:${cell.y}:woodland`)
              const livingSpecies =
                !rock && livingTrees?.complete && livingTrees.naturalWidth
                  ? grove && seed % 3 !== 0
                    ? 0 // Golden oaks cluster around the Gildroot.
                    : (seed >>> 15) % 6 === 0
                      ? 3 // Wind-tolerant pines among the salt-bent island trees.
                      : undefined
                  : undefined
              if (asterwakeWoodland?.complete && asterwakeWoodland.naturalWidth) {
                const size =
                  tile * (rock ? 1.65 + (seed % 4) * 0.16 : 1.32 + ((seed >>> 8) % 6) * 0.24)
                items.push({
                  x: origin.x + cell.x + 0.5,
                  y: origin.y + cell.y + 0.74,
                  width: size,
                  height: size,
                  image: livingSpecies !== undefined ? livingTrees! : asterwakeWoodland,
                  index: livingSpecies ?? (rock ? 2 : seed % 2),
                  columns: livingSpecies !== undefined ? 4 : 2,
                  rows: 2,
                  anchorY: livingSpecies !== undefined ? 488 / 512 : 0.93,
                  tree: !rock,
                  windFlex: 0.76 + (seed % 13) * 0.03,
                })
                continue
              }
            }
            const forest =
              !rock && sector.warpedTheme
                ? forestCanopy(sector.id, cell.x, cell.y, sector.warpedTheme)
                : undefined
            if (denseCanopy && forest && !forest.visible) continue
            const canopy =
              sector.landscape !== 'willow' &&
              !['sakura', 'autumn', 'wisteria'].includes(sector.landscape ?? '')
                ? forest
                : undefined
            const variedTree =
              canopy && forestTrees?.complete && forestTrees.naturalWidth ? canopy : undefined
            const anchored =
              Boolean(mixedTreeRegions) ||
              Boolean(sector.townId) ||
              sector.landmarks.some((l) => Math.abs(l.x - cell.x) + Math.abs(l.y - cell.y) <= 3)
            const wx = origin.x + cell.x
            const wy = origin.y + cell.y
            const pose = rock
              ? { x: 0, y: 0, scale: 1 }
              : vegetationPose(
                  sector.warpedTheme ? sector.id : 'public',
                  wx,
                  wy,
                  anchored,
                  Boolean(sector.warpedTheme),
                )
            const mixedTreeRegion = mixedTreeRegions?.get(cell)
            const treeRegion = mixedTreeRegion ?? sector.regionId
            const warpedRock =
              rock && sector.warpedTheme
                ? hashString(`${sector.id}:${cell.x}:${cell.y}:rock`)
                : null
            const edgeMask = warpedRock === null ? 0 : edgeCells?.get(`${cell.x}:${cell.y}`)
            if (warpedRock !== null && (edgeMask ? warpedRock % 5 !== 0 : warpedRock % 5 > 2))
              continue
            // Fringe trees are younger, but still use their supplied foot anchors.
            const scale =
              rock && denseRidge
                ? 0.48 + (hashString(`outcrop:${sector.id}:${cell.x}:${cell.y}`) % 7) * 0.045
                : mixedTreeRegion
                  ? 0.84
                  : warpedRock === null
                    ? 1
                    : 0.63 + (warpedRock % 6) * 0.095
            // Rock floors require their measured biome crop; a tree-sheet fallback
            // includes neighbouring canopies and empty padding beneath its roots.
            if (rock && (!biomes?.complete || !biomes.naturalWidth)) continue
            const special = rock
              ? sector.regionId === 'emberreach'
                ? 2
                : 3
              : sector.landscape === 'willow'
                ? 5
                : regionalTrees[treeRegion]
            const companion =
              !rock && livingTrees?.complete && livingTrees.naturalWidth
                ? groveCompanion(sector.landscape, wx, wy)
                : undefined
            const scenicTree =
              !rock && companion === undefined && beauties?.complete && beauties.naturalWidth
                ? sector.landscape === 'sakura'
                  ? hashString(`${origin.x + cell.x}:${origin.y + cell.y}`) % 3 === 0
                    ? 1
                    : 0
                  : sector.landscape === 'autumn'
                    ? 2
                    : sector.landscape === 'wisteria'
                      ? 3
                      : undefined
                : undefined
            const livingIndex =
              companion ??
              (!rock &&
              scenicTree === undefined &&
              !sector.warpedTheme &&
              livingTrees?.complete &&
              livingTrees.naturalWidth
                ? sector.landscape === 'willow'
                  ? 6
                  : mainlandTreeIndex(treeRegion, wx, wy, Boolean(mixedTreeRegions))
                : undefined)
            const asset =
              livingIndex !== undefined
                ? livingTrees!
                : scenicTree !== undefined
                  ? beauties!
                  : variedTree
                    ? forestTrees!
                    : special !== undefined && biomes?.complete && biomes.naturalWidth
                      ? biomes
                      : nature
            const rockPlacement = rock && asset === biomes ? rockArt[special!] : undefined
            const index =
              livingIndex ??
              scenicTree ??
              variedTree?.index ??
              (asset === biomes
                ? special!
                : (palettes[treeRegion] ?? palettes['verdant-expanse']!)[2])
            const family = asset === beauties ? 'beauties' : asset === biomes ? 'biomes' : 'nature'
            const artPlacement =
              livingIndex !== undefined
                ? {
                    width: 1.9,
                    height: 2.8,
                    anchorX: 0.5,
                    anchorY: 488 / 512,
                    source: [
                      (livingIndex % 4) / 4,
                      Math.floor(livingIndex / 4) / 2,
                      1 / 4,
                      1 / 2,
                    ] as const,
                  }
                : (variedTree?.placement ??
                  rockPlacement ??
                  (!rock ? treeArt[family]?.[index] : undefined))
            items.push({
              x: origin.x + cell.x + 0.5 + pose.x + (canopy?.x ?? 0),
              y: origin.y + cell.y + (rock ? 0.5 : 0.75) + pose.y + (canopy?.y ?? 0),
              width:
                tile *
                (artPlacement?.width ?? (rock ? 1.8 : 1.65)) *
                scale *
                pose.scale *
                (canopy?.scale ?? 1),
              height:
                tile *
                (artPlacement?.height ?? (rock ? 1.7 : 2.55)) *
                scale *
                pose.scale *
                (canopy?.scale ?? 1),
              image: asset,
              index,
              columns: 4,
              rows: 2,
              tree: !rock,
              rock,
              windFlex: rock
                ? undefined
                : treeFlex(sector.id, origin.x + cell.x, origin.y + cell.y, index) || undefined,
              ...(artPlacement
                ? {
                    anchorX: artPlacement.anchorX,
                    anchorY: artPlacement.anchorY,
                    source: artPlacement.source,
                  }
                : {}),
            })
          }
          for (const item of items)
            if (item.windFlex !== undefined)
              item.windSeed = hashString(`${item.x}:${item.y}:${item.index}`)
          woodland.set(sector, { key: woodlandKey, originX: origin.x, items })
        }
        for (const item of items) addScenery(item)
      }
      for (const building of cachedScenery ? [] : (sector.buildings ?? [])) {
        const wall = crownWallArt(building)
        if (wall) {
          const image = images.get(wall.sheet)
          if (!image?.complete || !image.naturalWidth) continue
          for (const segment of crownWallSegments(building)) {
            addScenery({
              x: origin.x + segment.x,
              y: origin.y + segment.y,
              width: tile * segment.widthTiles,
              height: tile * segment.heightTiles,
              image,
              index: wall.index,
              columns: wall.columns,
              rows: wall.rows,
              anchorX: wall.anchorX,
              anchorY: wall.anchorY,
              tree: false,
            })
          }
          continue
        }
        const winterIndex =
          winterArt?.complete && winterArt.naturalWidth
            ? winterBuildingIndex(sector, building)
            : undefined
        const point = {
          x: origin.x + building.x + building.width / 2,
          y: origin.y + building.y + building.height,
        }
        const dwellingScale = building.propIndex === undefined && building.artIndex < 10 ? 0.84 : 1
        const width = tile * (building.width + building.height) * 0.85 * dwellingScale
        if (winterIndex !== undefined && winterArt) {
          addScenery({
            ...point,
            width,
            height: width * WINTER_ATLAS_ASPECT,
            image: winterArt,
            index: winterIndex,
            columns: 4,
            rows: 1,
            anchorX: 0.5,
            anchorY: 306 / 336,
            tree: false,
            forge: winterIndex === 1,
            chimney: winterChimneys[winterIndex],
          })
          continue
        }
        const architecture = townArchitectureArt(sector, building)
        if (architecture) {
          const image = images.get(architecture.sheet)
          if (image?.complete && image.naturalWidth) {
            const size = width * (building.artIndex >= 10 ? 1.2 : 1.08)
            addScenery({
              ...point,
              width: size,
              height: size * architecture.aspect,
              image,
              index: architecture.index,
              columns: architecture.columns,
              rows: architecture.rows,
              anchorX: architecture.anchorX,
              anchorY: architecture.anchorY,
              tree: false,
            })
            continue
          }
          if (building.artIndex >= 10) continue
        }
        const regionalIndex =
          settlementArt?.complete && settlementArt.naturalWidth
            ? regionalBuildingIndex(sector, building)
            : undefined
        if (regionalIndex !== undefined && settlementArt) {
          const size = width * (sector.id === sector.townId ? 1.28 : 1.12)
          addScenery({
            ...point,
            width: size,
            height: size * WORLD_STRUCTURE_ASPECT,
            image: settlementArt,
            index: regionalIndex,
            columns: 4,
            rows: 2,
            anchorX: 0.5,
            anchorY: WORLD_STRUCTURE_FLOOR,
            tree: false,
            forge: regionalIndex === 3,
            chimney: settlementChimneys[regionalIndex],
          })
          continue
        }
        const asset = building.propIndex === undefined ? buildings : props
        if (!asset?.complete || !asset.naturalWidth) continue
        const contact = legacyStructureContact(
          building.propIndex === undefined ? 'buildings' : 'props',
          building.propIndex ?? building.artIndex,
        )
        addScenery({
          ...point,
          width,
          height:
            building.propIndex === undefined
              ? tile * (building.height + 2) * dwellingScale
              : tile * (building.width + building.height) * 0.85,
          image: asset,
          index: building.propIndex ?? building.artIndex,
          columns: building.propIndex === undefined ? 3 : 4,
          rows: building.propIndex === undefined ? 3 : 2,
          ...(contact ? { anchorX: contact[0], anchorY: contact[1] } : {}),
          tree: false,
        })
      }
      if (!cachedScenery)
        for (const prop of dressing.get(sector) ?? []) {
          const image = images.get(prop.sheet)
          if (!image?.complete || !image.naturalWidth) continue
          const verge = prop.sheet === 'wild-verges'
          const townLight =
            prop.sheet === 'town-centres-north' || prop.sheet === 'town-centres-south'
              ? prop.sheet
              : undefined
          const size =
            tile *
            (verge ? 0.63 : prop.sheet === 'settlement-dressing' ? 0.8 : 1.35) *
            (prop.scale ?? 1)
          addScenery({
            x: origin.x + prop.x + 0.5,
            y: origin.y + prop.y + 0.55,
            width: size,
            height: size,
            image,
            index: prop.index,
            columns: prop.sheet === 'regional-scenery' ? 4 : 2,
            rows: 2,
            anchorY: 0.94,
            tree: false,
            voidGlimmer: prop.glow,
            townLight,
            windFlex: verge ? 0.34 : undefined,
          })
        }
      // Landmark structures share scenery depth/culling and identity occlusion.
      // Painting them after the character pass would hide someone on a bridge/anchor.
      if (!cachedScenery)
        for (const landmark of sector.landmarks) {
          if (landmark.id === ASTERWAKE_GOLDEN_TREE_ID) {
            const oak = images.get('gildroot-oak')
            if (oak?.complete && oak.naturalWidth)
              addScenery({
                x: origin.x + ASTERWAKE_GOLDEN_TREE.x + 0.5,
                y: origin.y + ASTERWAKE_GOLDEN_TREE.y + 0.9,
                width: tile * 12,
                height: tile * 12 * (oak.naturalHeight / oak.naturalWidth),
                image: oak,
                index: 0,
                columns: 1,
                rows: 1,
                anchorX: 0.42,
                anchorY: 0.9,
                tree: false,
                grandFeature: true,
              })
            continue
          }
          if (isFerryTerminalLandmark(landmark.id)) {
            const dock = dockBySector.get(sector.id)!
            const northReach = dock.port === 'asterwake'
            const terminal =
              (northReach ? images.get('asterwake-ferry-terminal') : undefined) ??
              images.get('ferry-terminal')
            if (terminal?.complete && terminal.naturalWidth) {
              const size = tile * (northReach ? 2.95 : 2.65)
              addScenery({
                x: dock.x + (dock.shoreSide === 'west' ? 0.76 : -0.53),
                y: dock.y + (dock.shoreSide === 'north' ? 0.74 : -0.36),
                width: size,
                height: (size * terminal.naturalHeight) / terminal.naturalWidth,
                image: terminal,
                index: 0,
                columns: 1,
                rows: 1,
                anchorX: northReach ? 0.43 : 0.5,
                anchorY: northReach ? 0.93 : 0.91,
                tree: false,
                mirror: !northReach && dock.shoreSide !== 'north',
              })
            }
            continue
          }
          if (!props?.complete || !props.naturalWidth) continue
          if (sector.id.startsWith('ferry:')) {
            const mast = landmark.id === 'ferry-mast'
            const painted = images.get(mast ? 'ferry-sails' : 'ferry-cabin')
            const paintedReady = Boolean(painted?.complete && painted.naturalWidth)
            const fittings = paintedReady ? painted : images.get('ferry-fittings')
            if (fittings?.complete && fittings.naturalWidth) {
              const size = tile * (mast ? 3.4 : 2.55)
              addScenery({
                x: origin.x + landmark.x + (mast ? 1.27 : 0.5),
                y: origin.y + landmark.y + 0.6,
                width: size,
                height: paintedReady
                  ? (size * fittings.naturalHeight) / fittings.naturalWidth
                  : size,
                image: fittings,
                index: paintedReady || !mast ? 0 : 1,
                columns: paintedReady ? 1 : 2,
                rows: 1,
                anchorX: paintedReady && mast ? 0.55 : 0.5,
                anchorY: paintedReady ? 0.95 : 0.83,
                tree: false,
                ferryMast: mast && !paintedReady,
              })
            }
            continue
          }

          if (landmark.warpedArt !== undefined && landmark.sceneryIndex !== 4) {
            const asset = landmark.warpedArt < 6 ? warpedLandmarks : warpedRefuges
            if (asset?.complete && asset.naturalWidth) {
              const size =
                tile *
                landmarkArtSize(
                  sector,
                  landmark,
                  landmark.kind === 'hamlet' || landmark.kind === 'ruin' ? 3 : 2.55,
                )
              addScenery({
                x: origin.x + landmark.x + 0.5,
                y: origin.y + landmark.y + 0.67,
                width: size,
                height: size * WORLD_STRUCTURE_ASPECT,
                image: asset,
                index: landmark.warpedArt % 6,
                columns: 3,
                rows: 2,
                anchorX: 0.5,
                anchorY: WORLD_STRUCTURE_FLOOR,
                tree: false,
                chimney: warpedChimneys[landmark.warpedArt],
              })
              continue
            }
          }
          if (landmark.id === OFFSHORE_DISCOVERY.towerLandmarkId) {
            if (!buildings?.complete || !buildings.naturalWidth) continue
            const size = tile * landmarkArtSize(sector, landmark, 1.55)
            const contact = legacyStructureContact('buildings', 8)
            addScenery({
              x: origin.x + landmark.x + 0.5,
              y: origin.y + landmark.y + 0.5,
              width: size,
              height: size,
              image: buildings,
              index: 8,
              columns: 3,
              rows: 3,
              anchorX: contact?.[0] ?? 0.5,
              anchorY: contact?.[1] ?? WORLD_STRUCTURE_FLOOR,
              tree: false,
            })
            continue
          }
          const hamlet =
            sector.charted && landmark.kind === 'hamlet'
              ? hamletFamilyIndex(landmark.name)
              : undefined
          const hamletArt =
            sector.regionId === WINTER_ART &&
            winterHamletBuildings?.complete &&
            winterHamletBuildings.naturalWidth
              ? winterHamletBuildings
              : hamletBuildings
          if (hamlet !== undefined && hamletArt?.complete && hamletArt.naturalWidth) {
            const size = tile * 3.2
            addScenery({
              x: origin.x + landmark.x + 0.5,
              y: origin.y + landmark.y + 0.67,
              width: size,
              height: size * WORLD_STRUCTURE_ASPECT,
              image: hamletArt,
              index: hamlet,
              columns: 2,
              rows: 2,
              anchorX: 0.5,
              anchorY: WORLD_STRUCTURE_FLOOR,
              tree: false,
            })
            continue
          }
          const scenic =
            landmark.sceneryIndex !== undefined && beauties?.complete && beauties.naturalWidth
          const placement = featurePlacements.get(sector.id)?.get(landmark.id)
          if (placement === null || (landmark.sceneryIndex === 4 && !scenic)) continue
          const grandIndex = placement?.underpass
            ? grandBridgeArt(sector, placement.span ?? 0)
            : undefined
          const grand = images.get('grand-bridges')
          const grandReady = grandIndex !== undefined && grand?.complete && grand.naturalWidth
          const discoveryBridge = placement?.underpass
            ? grandBridgeDiscoveryArt(sector, placement.span ?? 0)
            : undefined
          const discoveryImage = discoveryBridge && images.get(discoveryBridge.sheet)
          const discoveryReady =
            discoveryBridge && discoveryImage?.complete && discoveryImage.naturalWidth
          const lavaFalls = placement?.fallMaterial === 'lava'
          const falls = images.get(lavaFalls ? 'lavafalls' : 'waterfalls')
          const fallsReady =
            landmark.sceneryIndex === 4 && placement && falls?.complete && falls.naturalWidth
          const asset = discoveryReady
            ? discoveryImage!
            : grandReady
              ? grand!
              : fallsReady
                ? falls!
                : scenic
                  ? beauties!
                  : props
          const index = discoveryReady
            ? discoveryBridge.index
            : grandReady
              ? grandIndex!
              : fallsReady
                ? lavaFalls
                  ? 0
                  : waterfallArt(sector.regionId)
                : scenic
                  ? landmark.sceneryIndex
                  : landmarkProps[landmark.kind]
          if (index === undefined) continue
          const ordinarySize = landmark.kind === 'bridge' ? 2.7 : scenic ? 2.4 : 1.55
          const size = tile * landmarkArtSize(sector, landmark, ordinarySize)
          const deckProfile = discoveryReady ? 'causeway' : grandIndex === 1 ? 'timber' : 'stone'
          const adjusted =
            placement?.deck && (discoveryReady || grandReady)
              ? {
                  ...placement,
                  ...bridgeDeckArt(placement.deck.span, deckProfile),
                  source: undefined,
                }
              : placement && fallsReady
                ? {
                    ...placement,
                    width: 2.65,
                    height: 2.65,
                    anchorX: 0.49,
                    anchorY: 0.9,
                    source: undefined,
                  }
                : placement
          const contact =
            !adjusted && asset === props ? legacyStructureContact('props', index) : undefined
          addScenery({
            x: adjusted
              ? sector.charted
                ? wrappedMapX(adjusted.point.x, camera.x)
                : adjusted.point.x
              : origin.x + landmark.x + 0.5,
            y:
              adjusted?.point.y ??
              origin.y + landmark.y + 0.5 + (contact ? 0 : ordinarySize * 0.25),
            width: adjusted ? adjusted.width * tile : size,
            height: adjusted ? adjusted.height * tile : size,
            ...(adjusted
              ? {
                  anchorX: adjusted.anchorX,
                  anchorY: adjusted.anchorY,
                  mirror: adjusted.mirror,
                  source: adjusted.source,
                  underpass: adjusted.underpass,
                  underpassSurface: cache.get(sector.id)?.surfaces.get(landmark.id),
                  bridgeStrips: adjusted.bridgeStrips,
                  deck: adjusted.deck && {
                    ...adjusted.deck,
                    profile: discoveryReady || grandReady ? deckProfile : 'footbridge',
                  },
                }
              : contact
                ? { anchorX: contact[0], anchorY: contact[1] }
                : {}),
            image: asset,
            index,
            columns: discoveryReady
              ? 2
              : fallsReady && lavaFalls
                ? 2
                : grandReady || fallsReady
                  ? 3
                  : 4,
            rows: discoveryReady ? 2 : grandReady || fallsReady ? 1 : 2,
            tree: false,
            waterfall: landmark.sceneryIndex === 4,
            waterfallStyle: fallsReady ? (lavaFalls ? 'lava' : 'grand') : 'water',
            grandBridge: Boolean(grandReady || discoveryReady),
          })
        }
      if (!cachedScenery) {
        const fall = lavaFallSite(sector),
          art = images.get('lavafalls')
        if (fall && art?.complete && art.naturalWidth)
          addScenery({
            x: origin.x + fall.x,
            y: origin.y + fall.y,
            width: tile * 2.55,
            height: tile * 2.55,
            image: art,
            index: fall.index,
            columns: 2,
            rows: 1,
            tree: false,
            anchorX: 0.49,
            anchorY: 0.9,
            waterfall: true,
            waterfallStyle: 'lava',
          })
      }
      if (ambient && !sector.id.startsWith('ferry:'))
        for (const cell of sector.cells)
          if (
            sector.regionId !== ASTERWAKE_REGION_ID &&
            (isWaterTerrain(cell.terrain) || cell.terrain === 'l') &&
            waterCells < budget.water
          ) {
            const point = screen({ x: origin.x + cell.x, y: origin.y + cell.y })
            if (!liquidVisible(point)) continue
            waterCells++
            const liquidWorldX = origin.x + cell.x
            ctx.save()
            ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, point.x, point.y)
            if (isWaterTerrain(cell.terrain)) {
              const profile = waterField.get(sector.id)?.cells.get(`${cell.x}:${cell.y}`)
              if (profile)
                paintWaterMotion(
                  ctx,
                  profile,
                  tile,
                  now,
                  sector.warpedTheme ?? false,
                  surfaceWeather,
                  false,
                )
              ctx.restore()
              continue
            }
            paintLavaMotion(
              ctx,
              tile,
              now,
              liquidWorldX,
              origin.y + cell.y,
              lavaField.get(sector.id)?.cells.get(`${cell.x}:${cell.y}`),
            )
            ctx.restore()
          }
    }
    // Both piers and ships use the completed water plane across sector edges.
    for (const { pier } of piers)
      paintFerryPier(ctx, pier, screen, tile, images.get('ferry-deck-planks'))
    const vessel = images.get('ferry-vessel')
    if (piers.length && vessel?.complete && vessel.naturalWidth) {
      const ferryTime = view.serverNow + Math.max(0, now - ferryClockAt)
      const vesselWidth = tile * 4.85
      const vesselHeight = vesselWidth * (vessel.naturalHeight / vessel.naturalWidth)
      for (const { dock, pier } of piers) {
        if (!ferryAtPort(dock.port, ferryTime)) continue
        const mooring = screen(pier.mooring)
        const x = mooring.x - vesselWidth * 0.46
        const y = mooring.y - vesselHeight * 0.76
        if (x < width && x + vesselWidth > 0 && y < height && y + vesselHeight > 0)
          ctx.drawImage(vessel, x, y, vesselWidth, vesselHeight)
      }
    }
    if (cacheScenery && !cachedScenery) stationaryScenery = scenery
    if (timing) {
      const ended = performance.now()
      timing.terrainMs = ended - phaseAt
      phaseAt = ended
    }
    // Wildlife shares depth with scenery. Wandering never changes collision or authority.
    const animals: {
      y: number
      type: 'animal'
      animal: Wildlife
      point: MapPoint
      bob: number
      facing: number
      pose: WildlifePose
    }[] = []
    const daylight = worldDayPhase(visualMinuteOfDay)
    if (nature?.complete && nature.naturalWidth)
      for (const sector of visible) {
        const origin = sectorOrigin(sector)
        for (const animal of wildlife.get(sector) ?? []) {
          if (!wildlifeVisible(animal, daylight, weather)) continue
          const pose = wildlifePose(animal, now, ambient)
          const point = { x: origin.x + pose.x, y: origin.y + pose.y },
            p = screen(point)
          if (
            p.x < -40 ||
            p.x > width + 40 ||
            p.y < 0 ||
            p.y > height ||
            wildlifeCount >= budget.wildlife
          )
            continue
          wildlifeCount++
          if (!animal.flying && pose.moving) wildlifeWalking++
          animals.push({
            y: point.x + point.y + (animal.flying ? 5 : 0),
            type: 'animal',
            animal,
            point,
            bob: pose.bob,
            facing: pose.facing,
            pose,
          })
        }
      }
    const stacks = new Map<
      string,
      {
        point: MapPoint
        people: {
          id: string
          name: string
          image: string | null
          self: boolean
          npc?: boolean
          spriteUrl?: string
        }[]
      }
    >()
    for (const player of view.players) {
      const point = remoteMotion.sample(player.characterId, now, camera)
      if (!point) continue
      const key = `${point.x}:${point.y}`,
        stack = stacks.get(key) ?? { point, people: [] }
      stack.people.push({
        id: player.characterId,
        name: player.name,
        image: player.imageUrl,
        self: false,
      })
      stacks.set(key, stack)
    }
    for (const npc of view.npcs ?? []) {
      if (!view.sectors.some((sector) => sector.id === npc.position.sectorId)) continue
      const point = mapPoint(npc.position, view.sectors, camera)
      stacks.set(`npc:${npc.id}`, {
        point,
        people: [
          {
            id: `npc:${npc.id}`,
            name: npc.name,
            image: npc.imageUrl,
            self: false,
            npc: true,
            spriteUrl: npc.spriteUrl,
          },
        ],
      })
    }
    const selfPoint = sample.point,
      selfKey = `${selfPoint.x}:${selfPoint.y}`,
      selfStack = stacks.get(selfKey) ?? { point: selfPoint, people: [] }
    if (!preview) {
      selfStack.people.unshift({
        id: view.characterId,
        name: canvas.dataset.characterName || 'Traveller',
        image: canvas.dataset.portrait ?? null,
        self: true,
      })
      stacks.set(selfKey, selfStack)
    }
    const objects = [
      ...animals,
      ...scenery.map((item, ordinal) => ({
        y: item.x + item.y,
        type: 'scenery' as const,
        item,
        ordinal,
      })),
    ].sort((a, b) => a.y - b.y)
    const tokenScale = Math.max(tile / 64, ferryFrame ? 0.55 : 0)
    const radius = Math.round(34 * tokenScale * identityRatio) / identityRatio / 2
    const previousActorPositions = actorPositions
    actorPositions = new Map()
    let requestedActors = 0
    let embodiedActors = 0
    const manifestFor = (image: string | null) => {
      if (!image?.startsWith(APPEARANCE_ASSET_PREFIX)) return null
      if (!actorAssets.has(image)) {
        actorAssets.set(image, appearanceManifestFromImageUrl(image))
        if (actorAssets.size > 256) actorAssets.delete(actorAssets.keys().next().value!)
      }
      return actorAssets.get(image) ?? null
    }
    const compactPortraitSource = (image: string | null) => manifestFor(image)?.icon ?? image
    const requestedImages = new Set<string>()
    const localImage = selfStack.people[0]?.image ?? null
    const selfIcon = compactPortraitSource(localImage)
    const selfAtlas = manifestFor(localImage)?.motionAtlas
    if (selfIcon) requestedImages.add(selfIcon)
    if (selfAtlas) requestedImages.add(selfAtlas)
    const visibleImage = (source: string | null) => {
      if (!source) return null
      // Keep the per-frame working set below the cache capacity, or dense scenes
      // continually evict and re-request every portrait. The marker remains pickable.
      if (!requestedImages.has(source) && requestedImages.size >= MAX_VISIBLE_IMAGE_REQUESTS)
        return null
      requestedImages.add(source)
      return portrait(source)
    }
    const visibleActor = (
      image: string | null,
      id: string,
      point: MapPoint,
      self: boolean,
      spriteUrl?: string,
    ) => {
      if ((tile < 42 && !ferryFrame) || (!self && requestedActors >= MAX_EMBODIED_ACTORS - 1))
        return null
      if (spriteUrl) {
        requestedActors++
        const sprite = visibleImage(spriteUrl)
        if (!sprite) return null
        embodiedActors++
        return { atlas: sprite, column: 0, row: 0, still: true }
      }
      const asset = manifestFor(image)
      if (!asset) return null
      requestedActors++
      const atlas = visibleImage(asset.motionAtlas)
      if (!atlas) return null
      embodiedActors++
      const previous = previousActorPositions.get(id)
      const dx = previous ? wrappedMapX(point.x, previous.point.x) - previous.point.x : 0
      const dy = previous ? point.y - previous.point.y : 0
      const moving = Math.abs(dx) + Math.abs(dy) > 0.001
      const facing = moving ? mapWalkFacing(dx, dy) : (previous?.facing ?? 'south')
      const walkingSince = !reduced && animate && moving ? (previous?.walkingSince ?? now) : null
      actorPositions.set(id, { point, facing, walkingSince })
      return {
        atlas,
        ...appearanceMotionFrameIndex(
          facing,
          walkingSince === null ? 'idle' : 'walk',
          walkingSince === null ? 0 : appearanceWalkFrame(now - walkingSince),
        ),
        still: false,
      }
    }
    type Nameplate = { point: MapPoint; person: (typeof selfStack.people)[number] }
    const nameplates: Nameplate[] = []
    let identityBounds: { left: number; top: number; right: number; bottom: number } | null = null
    const includeIdentityBounds = (left: number, top: number, right: number, bottom: number) => {
      const padding = Math.max(2 / identityRatio, 1)
      const bounds = {
        left: left - padding,
        top: top - padding,
        right: right + padding,
        bottom: bottom + padding,
      }
      if (!identityBounds) identityBounds = bounds
      else {
        identityBounds.left = Math.min(identityBounds.left, bounds.left)
        identityBounds.top = Math.min(identityBounds.top, bounds.top)
        identityBounds.right = Math.max(identityBounds.right, bounds.right)
        identityBounds.bottom = Math.max(identityBounds.bottom, bounds.bottom)
      }
    }
    const drawPerson = (
      stack: typeof selfStack,
      projected: MapPoint,
      ghost: boolean,
      actor: ReturnType<typeof visibleActor>,
      picture: HTMLImageElement | null,
      previousPicture: HTMLImageElement | null,
    ) => {
      const ctx = personContext
      const point = {
        x: Math.round((projected.x - radius) * identityRatio) / identityRatio + radius,
        y: Math.round(projected.y * identityRatio) / identityRatio,
      }
      if (point.x < -40 || point.x > width + 40 || point.y < -60 || point.y > height + 60) return
      const people = stack.people,
        selfIndex = people.findIndex((person) => person.self),
        index =
          selfIndex >= 0
            ? selfIndex
            : reduced || !animate
              ? 0
              : Math.floor(now / 3600) % people.length,
        person = people[index]!
      ctx.save()
      ctx.globalAlpha = 1
      if (actor) {
        const { width, height, anchorX, anchorY } = APPEARANCE_FRAME
        const scale = tokenScale * 1.22
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.globalAlpha = ghost ? 0.85 : 1
        if (person.self) {
          ctx.beginPath()
          ctx.ellipse(point.x, point.y, 12 * scale, 4 * scale, 0, 0, Math.PI * 2)
          ctx.strokeStyle = '#ead399'
          ctx.lineWidth = Math.max(1, scale)
          ctx.stroke()
        }
        includeIdentityBounds(
          point.x - Math.max(anchorX * scale, 12 * scale),
          point.y - anchorY * scale,
          point.x + Math.max((width - anchorX) * scale, 12 * scale),
          point.y + Math.max((height - anchorY) * scale, 4 * scale),
        )
        actorFrames.draw(
          ctx,
          actor,
          point.x - anchorX * scale,
          point.y - anchorY * scale,
          scale,
          identityRatio,
          ghost,
        )
      } else {
        const shadow = 10 * tokenScale
        includeIdentityBounds(
          point.x - radius - shadow,
          point.y - radius * 2 - shadow,
          point.x + radius + shadow,
          point.y + shadow + 5 * tokenScale,
        )
        ctx.fillStyle = ghost ? '#a6b1b0' : '#182e32'
        ctx.strokeStyle = person.self ? '#ead399' : '#c6cbc0'
        ctx.lineWidth = Math.max(1 / identityRatio, Math.min(1, tokenScale))
        ctx.shadowColor = 'rgba(0,0,0,.45)'
        ctx.shadowBlur = 10 * tokenScale
        ctx.shadowOffsetY = 5 * tokenScale
        ctx.beginPath()
        ctx.arc(point.x, point.y - radius, radius + ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(point.x, point.y - radius, radius, 0, Math.PI * 2)
        ctx.clip()
        const image = picture
        const drawPortrait = (picture: HTMLImageElement) => {
          const crop = tile < 42 && compactPortraits.get(picture, radius * 2, identityRatio, ghost)
          if (crop) {
            ctx.drawImage(crop, point.x - radius, point.y - radius * 2, radius * 2, radius * 2)
            return
          }
          if (ghost) ctx.filter = 'grayscale(1)'
          // Match battle's centered cover crop; wide/tall uploads keep their proportions.
          const w = picture.naturalWidth || picture.width,
            h = picture.naturalHeight || picture.height,
            side = Math.min(w, h)
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(
            picture,
            (w - side) / 2,
            (h - side) / 2,
            side,
            side,
            point.x - radius,
            point.y - radius * 2,
            radius * 2,
            radius * 2,
          )
        }
        if (image) {
          const fade =
            selfIndex < 0 && people.length > 1 && animate && !reduced
              ? Math.min(1, (now % 3600) / 500)
              : 1
          if (previousPicture && fade < 1) {
            ctx.globalAlpha = 1 - fade
            drawPortrait(previousPicture)
          }
          ctx.globalAlpha = fade
          drawPortrait(image)
        } else {
          ctx.fillStyle = ghost ? '#c2c9c7' : '#bcac84'
          ctx.font = `${Math.max(7, 16 * tokenScale)}px Georgia`
          ctx.textAlign = 'center'
          ctx.fillText(person.name[0] ?? '?', point.x, point.y - radius + 6 * tokenScale)
        }
      }
      ctx.restore()
      if (people.length > 1) {
        ctx.fillStyle = '#e8d7a3'
        ctx.font = `bold ${Math.max(7, 10 * tokenScale)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(String(people.length), point.x + 19 * tokenScale, point.y - 26 * tokenScale)
        const countWidth = ctx.measureText(String(people.length)).width
        const countHeight = Math.max(7, 10 * tokenScale)
        includeIdentityBounds(
          point.x + 19 * tokenScale - countWidth / 2,
          point.y - 26 * tokenScale - countHeight,
          point.x + 19 * tokenScale + countWidth / 2,
          point.y - 26 * tokenScale + 2,
        )
      }
      if (!ghost || actor) nameplates.push({ point, person })
    }
    function paintNameplate({ point, person }: Nameplate, occupied: LabelBounds[], dense: boolean) {
      const ctx = personContext
      // Small serif strokes and Canvas maxWidth condensation soften identity labels.
      // Keep glyphs at a readable whole-pixel size and shorten long names instead.
      const fontSize = Math.max(11, Math.round(12 * tokenScale))
      const labelHeight = fontSize + 6
      ctx.font = `600 ${fontSize}px Arial, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      const maxTextWidth = Math.max(112, 180 * tokenScale) - 12
      let label = person.name
      if (ctx.measureText(label).width > maxTextWidth) {
        const letters = Array.from(label)
        let low = 0,
          high = letters.length
        while (low < high) {
          const middle = Math.ceil((low + high) / 2)
          if (ctx.measureText(letters.slice(0, middle).join('') + '…').width <= maxTextWidth)
            low = middle
          else high = middle - 1
        }
        label = letters.slice(0, low).join('') + '…'
      }
      const nameWidth =
        Math.ceil((ctx.measureText(label).width + 12) * identityRatio) / identityRatio
      const left = Math.round((point.x - nameWidth / 2) * identityRatio) / identityRatio
      const top = Math.round((point.y + 2 * tokenScale) * identityRatio) / identityRatio
      const bounds = { left, top, right: left + nameWidth, bottom: top + labelHeight }
      if (
        dense &&
        !person.self &&
        (bounds.left < 0 ||
          bounds.right > width ||
          bounds.top < 0 ||
          bounds.bottom > height ||
          occupied.some((other) => labelsOverlap(bounds, other)))
      )
        return
      occupied.push(bounds)
      includeIdentityBounds(bounds.left, bounds.top, bounds.right, bounds.bottom)
      paintMapLabel(
        ctx,
        label,
        bounds,
        fontSize,
        person.self ? 'self' : person.npc ? 'npc' : 'player',
        identityRatio,
      )
    }
    const cacheBiomeRasters = rasterZoomAt === null && (tile >= 32 || width >= 600 || ratio > 1)
    const paintCompact = (
      target: CanvasRenderingContext2D,
      item: Scenery,
      x: number,
      y: number,
    ) => {
      const raster =
        cacheBiomeRasters &&
        (item.image === biomes ||
          item.image === livingTrees ||
          item.image === beauties ||
          (item.tree && (item.image === forestTrees || item.image === asterwakeWoodland)) ||
          (item.image === props && !item.underpass && item.index === 3))
          ? biomeRaster(item)
          : null
      if (raster) target.drawImage(raster, x, y, item.width, item.height)
      else
        sprite(
          target,
          item.image,
          item.index,
          item.columns,
          item.rows,
          x,
          y,
          item.width,
          item.height,
          item.source,
        )
    }
    const nextBatches = cacheScenery ? new Map<string, SceneryBatch>() : null
    let remainingBatchPixels = STATIONARY_SCENERY_PIXEL_LIMIT
    const paintBatch = (items: Scenery[], key: string) => {
      if (!nextBatches || items.length < 8) return false
      let batch = sceneryBatches.get(key)
      if (!batch) {
        const points = items.map((item) => {
          const point = screen(item)
          return {
            item,
            x: point.x - item.width * (item.anchorX ?? 0.5),
            y: point.y - item.height * (item.anchorY ?? 1),
          }
        })
        const left = Math.max(0, Math.floor(Math.min(...points.map(({ x }) => x)) * ratio))
        const top = Math.max(0, Math.floor(Math.min(...points.map(({ y }) => y)) * ratio))
        const right = Math.min(
          canvas.width,
          Math.ceil(Math.max(...points.map(({ item, x }) => x + item.width)) * ratio),
        )
        const bottom = Math.min(
          canvas.height,
          Math.ceil(Math.max(...points.map(({ item, y }) => y + item.height)) * ratio),
        )
        const pixels = (right - left) * (bottom - top)
        if (right <= left || bottom <= top || pixels > remainingBatchPixels) return false
        const layer = document.createElement('canvas')
        layer.width = right - left
        layer.height = bottom - top
        const target = layer.getContext('2d')
        if (!target) return false
        target.setTransform(ratio, 0, 0, ratio, -left, -top)
        for (const { item, x, y } of points) paintCompact(target, item, x, y)
        batch = { layer: snapshot(layer), left, top }
      }
      const pixels = batch.layer.width * batch.layer.height
      if (pixels > remainingBatchPixels) return false
      remainingBatchPixels -= pixels
      nextBatches.set(key, batch)
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(batch.layer, batch.left, batch.top)
      ctx.restore()
      return true
    }
    let detailedScenery = 0
    let glimmerCount = 0
    let townLightCount = 0
    let runEnd = 0
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index]!
      if (nextBatches && index >= runEnd) {
        // Compose only consecutive compact sprites. Moving animals and bridges
        // still paint in place, preserving their original overlaps.
        const items: Scenery[] = []
        const ordinals: number[] = []
        runEnd = index
        while (runEnd < objects.length) {
          const next = objects[runEnd]!
          if (
            next.type !== 'scenery' ||
            !usesCompactScenery(next.item) ||
            // Moving canopies stay individual only at useful pixel sizes.
            (ambient && budget.foliage > 0 && tile >= 32 && next.item.windFlex !== undefined)
          )
            break
          items.push(next.item)
          ordinals.push(next.ordinal)
          runEnd++
        }
        if (paintBatch(items, ordinals.join(','))) {
          index = runEnd - 1
          continue
        }
      }
      if (object.type === 'animal') {
        const p = screen(object.point)
        drawWildlife(
          ctx,
          nature!,
          object.animal,
          object.pose,
          p.x,
          p.y,
          tile,
          ambient ? wildlifeParts : undefined,
        )
        continue
      }
      const item = object.item,
        p = screen({ x: item.x, y: item.y })
      // Every supplied, viewport-clipped body remains visible. Spend the
      // detail budget on larger sprites; small/overflow sprites need only one
      // cropped draw, without per-object shadows, transforms or canopy sway.
      const detailed = tile >= 32 && detailedScenery < 180
      if (detailed) detailedScenery++
      if (!detailed && usesCompactScenery(item)) {
        const x = p.x - item.width * (item.anchorX ?? 0.5)
        const y = p.y - item.height * (item.anchorY ?? 1)
        paintCompact(ctx, item, x, y)
        continue
      }
      ctx.save()
      if (item.rock) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.scale(item.width * 0.46, tile * 0.09)
        const shadow = ctx.createRadialGradient(0, 0, 0.15, 0, 0, 1)
        shadow.addColorStop(0, 'rgba(17,26,23,.3)')
        shadow.addColorStop(0.55, 'rgba(17,26,23,.16)')
        shadow.addColorStop(1, 'rgba(17,26,23,0)')
        ctx.fillStyle = shadow
        ctx.beginPath()
        ctx.ellipse(0, 0, 1, 1, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      } else if (!item.grandFeature && !item.oceanFeature) {
        ctx.fillStyle = 'rgba(20,32,25,.2)'
        ctx.beginPath()
        ctx.ellipse(p.x, p.y - 4, item.width * 0.36, 10, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      // Stable individual phase, pace, strength and sheltered pauses. The base
      // stays fixed while the canopy bends, rather than sliding the whole tree.
      // Animate a deterministic subset; stationary trees remain batchable.
      // Only the upper canopy shears; the trunk's foot stays fixed.
      const movingTree = detailed && ambient && budget.foliage > 0 && item.windFlex !== undefined
      if (movingTree) {
        const seed = item.windSeed ?? hashString(`${item.x}:${item.y}:${item.index}`)
        const bend = treeWindBend(seed, now, wind.speed, item.windFlex!, budget.foliage)
        ctx.transform(1, 0, -bend, 1, p.x, p.y)
      }
      const anchored = item.anchorY !== undefined
      if (anchored) {
        if (!movingTree) ctx.translate(p.x, p.y)
        if (item.mirror) ctx.scale(-1, 1)
      }
      if (item.underpass) {
        // Source-art transparency cannot invent a river on an adjacent road.
        // Intersect the arch opening with the proven same-liquid crossing.
        ctx.save()
        ctx.beginPath()
        for (const strip of item.bridgeStrips ?? []) {
          const corners = [
            [strip.x, strip.y],
            [strip.x + strip.width, strip.y],
            [strip.x + strip.width, strip.y + strip.height],
            [strip.x, strip.y + strip.height],
          ] as const
          corners.forEach(([x, y], i) => {
            const dx = (wrappedMapX(x, item.x) - item.x) * tile,
              dy = (y - item.y) * tile
            const sx = (dx - dy) * MAP_X * (item.mirror ? -1 : 1),
              sy = (dx + dy) * MAP_Y
            if (i === 0) ctx.moveTo(sx, sy)
            else ctx.lineTo(sx, sy)
          })
          ctx.closePath()
        }
        ctx.clip()
        const ax = item.anchorX ?? 0.5,
          ay = item.anchorY ?? 1
        if (!item.grandBridge) {
          // Follow the actual props-v02 inner arch, then continue through its
          // transparent lower opening. The proved strip still cuts off dry banks.
          const opening = (sourceX: number, sourceY: number) =>
            [
              ((sourceX - 950) / 460 - ax) * item.width,
              ((sourceY - 60) / 380 - ay) * item.height,
            ] as const
          ctx.beginPath()
          ctx.moveTo(...opening(1186, 1000))
          ctx.lineTo(...opening(1186, 390))
          ctx.bezierCurveTo(...opening(1188, 316), ...opening(1226, 254), ...opening(1260, 255))
          ctx.bezierCurveTo(...opening(1288, 256), ...opening(1322, 281), ...opening(1338, 305))
          // The open outlet continues beyond the sprite crop; the terrain strip
          // owns its endpoint, preventing a crop-shaped edge across the river.
          ctx.lineTo(...opening(2000, 305))
          ctx.lineTo(...opening(2000, 1000))
          ctx.closePath()
          ctx.clip()
        }
        const surface = item.underpassSurface
        if (surface) {
          const sign = item.mirror ? -1 : 1
          ctx.transform(MAP_X * sign, MAP_Y, -MAP_X * sign, MAP_Y, 0, 0)
          ctx.drawImage(
            surface.canvas,
            (wrappedMapX(surface.x, item.x) - item.x) * tile,
            (surface.y - item.y) * tile,
            surface.width * tile,
            surface.height * tile,
          )
          if (ambient)
            for (const cell of surface.cells) {
              if (waterCells >= budget.water) break
              waterCells++
              ctx.save()
              ctx.translate((wrappedMapX(cell.x, item.x) - item.x) * tile, (cell.y - item.y) * tile)
              if (item.underpass === 'water')
                paintWaterMotion(
                  ctx,
                  cell.profile,
                  tile,
                  now,
                  surface.tint ?? false,
                  surfaceWeather,
                )
              else paintLavaMotion(ctx, tile, now, cell.x, cell.y, cell.profile)
              ctx.restore()
            }
        }
        ctx.restore()
      }
      const spriteX = (movingTree || anchored ? 0 : p.x) - item.width * (item.anchorX ?? 0.5)
      const spriteY = (movingTree || anchored ? 0 : p.y) - item.height * (item.anchorY ?? 1)
      if (item.arenaFloor) {
        const floor = item.arenaFloor
        ctx.beginPath()
        ctx.rect(spriteX, spriteY, item.width, item.height)
        ctx.ellipse(
          spriteX + floor.cx * item.width,
          spriteY + floor.cy * item.height,
          floor.rx * item.width,
          floor.ry * item.height,
          0,
          0,
          Math.PI * 2,
        )
        ctx.clip('evenodd')
      }
      paintCompact(ctx, item, spriteX, spriteY)
      paintColosseumDetails(item, spriteX, spriteY)
      if (item.image === images.get('elemental-waterfall-valley')) {
        for (const detail of valleyDetailArt) {
          if (item.width * ratio <= detail.minProjectedMacroWidth) continue
          const image = images.get(detail.sheet)
          if (!image?.complete || !image.naturalWidth) continue
          const [sx, sy, sw, sh] = detail.source,
            [x, y, width, height] = detail.target
          // Each feathered frame retains the selected master's surrounding
          // rocks/water, so no isolated silhouette mask can shift an avatar.
          ctx.save()
          ctx.globalAlpha = Math.min(1, (item.width * ratio - detail.minProjectedMacroWidth) / 768)
          ctx.drawImage(
            image,
            sx * image.width,
            sy * image.height,
            sw * image.width,
            sh * image.height,
            spriteX + x * item.width,
            spriteY + y * item.height,
            width * item.width,
            height * item.height,
          )
          ctx.restore()
        }
      }
      if (item.oceanFeature && ambient) {
        const roughness = Math.min(1, Math.abs(wind.speed) / 0.06)
        const seed = hashString(`${item.x}:${item.y}:offshore-swell`)
        ctx.save()
        ctx.strokeStyle = '#c4e7df'
        ctx.lineWidth = Math.max(0.6, tile * 0.012)
        for (let crest = 0; crest < 3; crest++) {
          const phase = (now / (7300 - roughness * 2200) + crest / 3 + (seed % 997) / 997) % 1
          const x = spriteX + item.width * (0.23 + crest * 0.18)
          const y = spriteY + item.height * (0.83 + phase * 0.065)
          ctx.globalAlpha = Math.sin(phase * Math.PI) * (0.17 + roughness * 0.19)
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.bezierCurveTo(
            x + item.width * 0.035,
            y - item.height * 0.014,
            x + item.width * 0.075,
            y + item.height * 0.012,
            x + item.width * 0.11,
            y,
          )
          ctx.stroke()
        }
        ctx.restore()
      }
      if (item.ferryMast && ferryFrame)
        paintFerryRig(
          ctx,
          spriteX + item.width * (114 / 240),
          spriteY + item.height * (45 / 240),
          item.width,
          ferryFrame,
        )
      if (item.forge && ambient && budget.clouds) {
        const x = item.width * 0.12
        const y = -item.height * 0.22
        const radius = item.width * 0.082
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
        const alpha = 0.1 + (0.5 + Math.sin(now / 360) * 0.5) * 0.08
        glow.addColorStop(0, `rgba(255,182,97,${alpha})`)
        glow.addColorStop(1, 'rgba(255,140,55,0)')
        ctx.fillStyle = glow
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }
      if (item.townLight && ambient && budget.clouds && townLightCount < 5) {
        townLightCount++
        paintTownLight(
          ctx,
          item.townLight,
          item.index,
          spriteX,
          spriteY,
          item.width,
          now,
          weather,
          daylight === 'Night',
        )
      }
      if (item.voidGlimmer && ambient && budget.clouds && glimmerCount < 6) {
        glimmerCount++
        paintVoidGlimmer(
          ctx,
          item.voidGlimmer,
          spriteX,
          spriteY,
          item.width,
          now,
          hashString(`${item.x}:${item.y}`),
          wind.speed,
          weather,
        )
      }
      if (item.chimney && ambient && budget.clouds) {
        chimneyPuff ??= createChimneyPuff()
        paintChimneySmoke(
          ctx,
          chimneyPuff,
          item.chimney,
          spriteX,
          spriteY,
          item.width,
          item.height,
          hashString(`${item.x}:${item.y}`),
          now,
          wind.speed,
        )
      }
      if (item.waterfall && ambient)
        paintWaterfallMotion(
          ctx,
          -item.width * (item.anchorX ?? 0.5),
          -item.height * (item.anchorY ?? 1),
          item.width,
          item.height,
          now,
          wind.speed,
          budget.clouds,
          item.waterfallStyle,
        )
      ctx.restore()
    }
    if (nextBatches) {
      for (const [key, batch] of sceneryBatches)
        if (!nextBatches.has(key)) releaseStaticRaster(batch.layer)
      sceneryBatches = nextBatches
    }
    for (const ripple of shallowRipples.sample({
      point: sample.point,
      moving: sample.moving,
      now,
      enabled: ambient,
      sectors: renderSectors,
      currentSectorId: sample.position.sectorId,
    })) {
      const point = screen({ x: ripple.worldx, y: ripple.worldy })
      ctx.save()
      ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, point.x, point.y)
      ctx.globalAlpha = ripple.alpha
      ctx.strokeStyle = '#d5ece2'
      ctx.lineWidth = Math.max(0.65, tile * 0.012)
      ctx.beginPath()
      ctx.ellipse(0, 0, ripple.radius * tile, ripple.radius * tile, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    for (const item of scenery) {
      if (!item.arenaFloor) continue
      const p = screen(item)
      const x = p.x - item.width * (item.anchorX ?? 0.5)
      const y = p.y - item.height * (item.anchorY ?? 1)
      const floor = item.arenaFloor
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(
        x + floor.cx * item.width,
        y + floor.cy * item.height,
        floor.rx * item.width,
        floor.ry * item.height,
        0,
        0,
        Math.PI * 2,
      )
      ctx.clip()
      sprite(
        ctx,
        item.image,
        item.index,
        item.columns,
        item.rows,
        x,
        y,
        item.width,
        item.height,
        item.source,
      )
      paintColosseumDetails(item, x, y)
      const grain = images.get(colosseumArenaMaterial.sheet)
      const pattern =
        grain?.complete && grain.naturalWidth ? ctx.createPattern(grain, 'repeat') : null
      if (pattern) {
        const scale = (tile * colosseumArenaMaterial.worldTileSize) / colosseumArenaMaterial.width
        ctx.translate(x, y)
        ctx.scale(scale, scale)
        ctx.globalAlpha = colosseumArenaMaterial.opacity
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, item.width / scale, item.height / scale)
      }
      ctx.restore()
    }
    const majorScenery = scenery.filter((item) => item.grandFeature)
    const locationLabels: { text: string; x: number; y: number }[] = []
    for (const sector of visible) {
      if (sector.id.startsWith('ferry:')) continue
      const origin = sectorOrigin(sector)
      for (const landmark of sector.landmarks) {
        const p = screen({ x: origin.x + landmark.x + 0.5, y: origin.y + landmark.y + 0.5 })
        if (p.x < 20 || p.x > width - 20 || p.y < 20 || p.y > height - 20) continue
        // Major artwork must not conceal a supplied location when labels are
        // hidden. Keep a small map marker at its exact saved ground coordinate.
        const occludedByMajor = majorScenery.some((item) => {
          const anchor = screen(item)
          const left = anchor.x - item.width * (item.anchorX ?? 0.5)
          const top = anchor.y - item.height * (item.anchorY ?? 1)
          return (
            p.x > left &&
            p.x < left + item.width &&
            p.y > top &&
            p.y < top + item.height &&
            origin.x + landmark.x + origin.y + landmark.y + 1 < item.x + item.y
          )
        })
        if (occludedByMajor) {
          ctx.save()
          ctx.fillStyle = 'rgba(6,28,35,.96)'
          ctx.strokeStyle = '#ffe2a1'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(p.x, p.y - 9)
          ctx.lineTo(p.x + 7, p.y)
          ctx.lineTo(p.x, p.y + 9)
          ctx.lineTo(p.x - 7, p.y)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#ffe2a1'
          ctx.fillRect(p.x - 1.5, p.y - 3, 3, 6)
          ctx.restore()
        }
        if (!showLocationLabels) continue
        locationLabels.push({
          text: landmark.name,
          x: p.x,
          y: isFerryTerminalLandmark(landmark.id) ? p.y - tile * 1.9 - 16 : p.y + 25,
        })
      }
    }
    if (timing) {
      const ended = performance.now()
      timing.sceneryMs = ended - phaseAt
      timing.wildlifePartBuilds = wildlifeParts.builds
      timing.wildlifePartPixels = wildlifeParts.pixels
      phaseAt = ended
    }
    // Time changes light gradually. Night never removes the ability to read terrain.
    paintWorldLighting(ctx, width, height, visualMinuteOfDay, weather, lighting)
    let cloudCount = 0
    canvas.dataset.precipitation = precipitationKind(weather, regionId) ?? 'none'
    canvas.dataset.mapQuality = quality
    canvas.dataset.precipitationParticles = '0'
    canvas.dataset.terrainMotes = '0'
    if (ambient && richAtmosphere && !ferryFrame) {
      // Keep integer lattice identities separate from floating-point drift.
      // Subtracting drift back out of a centre and flooring can round down to
      // the previous identity, flickering between silhouettes on successive frames.
      const spacing = 18,
        drift = wind.offset / 120,
        w = tile * 11,
        h = tile * 5
      // Expand the viewport by the full shadow extent before unprojecting.
      // Cull offscreen shadows, never truncate visible ones by iteration order.
      const corners = [
        world(-w / 2, -h / 2),
        world(width + w / 2, -h / 2),
        world(-w / 2, height + h / 2),
        world(width + w / 2, height + h / 2),
      ]
      const fromX = Math.ceil((Math.min(...corners.map((p) => p.x)) - drift) / spacing),
        toX = Math.floor((Math.max(...corners.map((p) => p.x)) - drift) / spacing),
        fromY = Math.ceil(Math.min(...corners.map((p) => p.y)) / spacing),
        toY = Math.floor(Math.max(...corners.map((p) => p.y)) / spacing)
      for (let y = fromY; y <= toY; y++)
        for (let x = fromX; x <= toX; x++) {
          const p = screen({ x: x * spacing + drift, y: y * spacing })
          if (p.x + w / 2 < 0 || p.x - w / 2 > width || p.y + h / 2 < 0 || p.y - h / 2 > height)
            continue
          ctx.save()
          ctx.globalAlpha = weather === 'clear' ? 0.5 : 0.8
          const cloudIndex = (((x + y) % 3) + 3) % 3
          ctx.drawImage(clouds[cloudIndex]!, p.x - w / 2, p.y - h / 2, w, h)
          ctx.restore()
          cloudCount++
        }
    }
    if (ambient) {
      canvas.dataset.precipitationParticles = String(
        paintPrecipitation(ctx, width, height, now, weather, regionId, wind, budget.weather),
      )
      canvas.dataset.terrainMotes = String(
        paintTerrainAtmosphere(
          ctx,
          width,
          height,
          now,
          regionId,
          heatEmitters,
          (point) => screen({ x: wrappedMapX(point.x, camera.x), y: point.y }),
          wind,
          budget.weather,
        ),
      )
      paintWeatherVeil(
        ctx,
        width,
        height,
        weather,
        wind.offset,
        richAtmosphere ? 1 : 0.55,
        weatherVeil,
        ratio,
      )
      const petals = current?.landscape === 'sakura' || current?.landscape === 'wisteria'
      const temperate = !['glasswind-desert', 'emberreach', 'frostmere'].includes(regionId)
      const motes = airborneMoteProfile(weather, petals)
      if (motes) ctx.fillStyle = motes.colour
      for (let i = 0; i < (temperate && motes ? Math.ceil(14 * budget.weather) : 0); i++) {
        const phase = (now / (11000 + i * 370) + i * 0.13) % 1
        const span = width + 160
        const x = ((((i * 137 + wind.offset * motes!.drift) % span) + span) % span) - 80,
          y = (i * 101 + Math.sin(now / 2400 + i) * 26 + phase * 70) % height
        ctx.save()
        ctx.translate(x, y)
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.8
        ctx.rotate(Math.sin(now / 900 + i) * 0.8)
        ctx.beginPath()
        ctx.ellipse(0, 0, motes!.width, petals ? 1.4 : 0.85, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      if (richAtmosphere && temperate && (weather === 'wind' || weather === 'clear' || petals)) {
        ctx.strokeStyle = 'rgba(232,238,215,.22)'
        ctx.lineWidth = 1
        for (let i = 0; i < 3; i++) {
          const phase = (now / 7000 + i * 0.31) % 1
          const span = width + 200
          const x = ((((i * 211 + wind.offset * 2.2) % span) + span) % span) - 100,
            y = height * (0.2 + i * 0.27)
          ctx.globalAlpha = Math.sin(phase * Math.PI)
          ctx.beginPath()
          ctx.moveTo(x - 55, y)
          ctx.bezierCurveTo(x - 15, y - 9, x + 15, y + 10, x + 55, y)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
    }
    if (!ambient && (weather === 'fog' || weather === 'overcast' || weather === 'storm'))
      paintWeatherVeil(ctx, width, height, weather, wind.offset, quality === 'low' ? 0.5 : 1)
    if (preview && authorityOverlay) {
      const visibleIds = new Set(visible.map((sector) => sector.id))
      for (const sector of view.sectors) {
        if (!visibleIds.has(sector.id)) continue
        const point = screen(sectorOrigin(sector))
        ctx.save()
        ctx.transform(MAP_X, MAP_Y, -MAP_X, MAP_Y, point.x, point.y)
        ctx.fillStyle = 'rgba(129,38,122,.56)'
        ctx.beginPath()
        for (const cell of sector.cells)
          if (!cell.walkable) ctx.rect(cell.x * tile, cell.y * tile, tile, tile)
        ctx.fill()
        ctx.fillStyle = '#f1ca62'
        for (const { from } of sector.exits)
          ctx.fillRect((from.x + 0.44) * tile, (from.y + 0.44) * tile, 0.12 * tile, 0.12 * tile)
        ctx.strokeStyle = '#fff3ce'
        ctx.lineWidth = 2
        for (const landmark of sector.landmarks)
          ctx.strokeRect(
            (landmark.x + 0.34) * tile,
            (landmark.y + 0.34) * tile,
            0.32 * tile,
            0.32 * tile,
          )
        ctx.restore()
      }
    }
    canvas.dataset.clouds = String(cloudCount)
    canvas.dataset.cloudPhase = animate && !reduced ? String(Math.round(now / 100)) : '0'
    canvas.dataset.wildlife = String(wildlifeCount)
    canvas.dataset.wildlifeWalking = String(wildlifeWalking)
    canvas.dataset.coastEdges = String(coastEdges)
    if (timing) {
      const ended = performance.now()
      timing.atmosphereMs = ended - phaseAt
      timing.weatherVeilBuilds = weatherVeil.builds
      timing.weatherVeilPixels = weatherVeil.pixels
      phaseAt = ended
    }
    // Keep labels and portraits on the retained layer above the weather.
    const identity: (string | number | boolean | null)[] = [
      identityRatio,
      width,
      height,
      tokenScale,
      radius,
      locationLabels.length,
    ]
    for (const { text, x, y } of locationLabels) identity.push(text, x, y)
    const occluderCell = 96
    const decks: BridgeDeck[] = []
    const occluders = scenery.map((item) => {
      if (item.deck) decks.push(item.deck)
      const point = screen({ x: item.x, y: item.y })
      return {
        item,
        point,
        left: point.x - item.width * 0.35,
        right: point.x + item.width * 0.35,
        top: point.y - item.height * (item.anchorY ?? 0.8),
        bottom: point.y + item.height * (1 - (item.anchorY ?? 1)),
      }
    })
    const occluderIndex = new Map<string, typeof occluders>()
    for (const occluder of occluders) {
      const left = Math.floor(occluder.left / occluderCell),
        right = Math.floor(occluder.right / occluderCell),
        top = Math.floor(occluder.top / occluderCell),
        bottom = Math.floor(occluder.bottom / occluderCell)
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          const key = `${x}:${y}`,
            candidates = occluderIndex.get(key) ?? []
          candidates.push(occluder)
          occluderIndex.set(key, candidates)
        }
    }
    let identityOccluderChecks = 0
    const identities = Array.from(stacks.values())
      .sort((a, b) => a.point.x + a.point.y - b.point.x - b.point.y)
      .flatMap((stack) => {
        let deck: BridgeDeck | undefined
        let feet = stack.point
        for (const candidate of decks) {
          const onDeck = bridgeDeckPoint(candidate, stack.point)
          if (onDeck) {
            feet = onDeck
            deck = candidate
            break
          }
        }
        const p = screen(feet)
        const x = Math.round((p.x - radius) * identityRatio) / identityRatio + radius
        const y = Math.round(p.y * identityRatio) / identityRatio
        if (x < -40 || x > width + 40 || y < -60 || y > height + 60) return []
        const people = stack.people,
          selfIndex = people.findIndex((person) => person.self),
          index =
            selfIndex >= 0
              ? selfIndex
              : reduced || !animate
                ? 0
                : Math.floor(now / 3600) % people.length,
          person = people[index]!,
          fade =
            selfIndex < 0 && people.length > 1 && animate && !reduced
              ? Math.min(1, (now % 3600) / 500)
              : 1,
          ghost = (
            occluderIndex.get(
              `${Math.floor(p.x / occluderCell)}:${Math.floor(p.y / occluderCell)}`,
            ) ?? []
          ).some(({ item, point: s, left, right, top, bottom }) => {
            identityOccluderChecks++
            return (
              (!deck || item.deck !== deck) &&
              stack.point.x + stack.point.y < item.x + item.y &&
              p.x > left &&
              p.x < right &&
              p.y > top &&
              p.y < bottom &&
              (!item.arenaFloor ||
                ((p.x - (s.x + (item.arenaFloor.cx - (item.anchorX ?? 0.5)) * item.width)) /
                  (item.arenaFloor.rx * item.width)) **
                  2 +
                  ((p.y - (s.y + (item.arenaFloor.cy - (item.anchorY ?? 1)) * item.height)) /
                    (item.arenaFloor.ry * item.height)) **
                    2 >
                  1)
            )
          })
        const actor = visibleActor(
          person.image,
          person.id,
          stack.point,
          person.self,
          person.spriteUrl,
        )
        const image = actor ? null : visibleImage(compactPortraitSource(person.image))
        const previous =
          !actor && fade < 1
            ? visibleImage(
                compactPortraitSource(people[(index + people.length - 1) % people.length]!.image),
              )
            : null
        // Only the Ferryman uses a map interaction; NPCs stay out of player targeting.
        const ferryman = person.id === `npc:${FERRY_CONVERSATION_ID}`
        if (!person.npc || (ferryman && (view.ferry?.port || view.ferry?.passage))) {
          hitTargets.push({
            id: person.id,
            self: person.self,
            x,
            y: y - (ferryman && actor ? radius * 1.65 : radius),
            radius: person.self ? radius * 0.85 : radius * (ferryman ? 1.5 : 1) + 4 * tokenScale,
          })
        }
        identity.push(
          x,
          y,
          person.id,
          person.name,
          person.self,
          person.image,
          people.length,
          fade,
          image?.naturalWidth ?? 0,
          image?.naturalHeight || image?.height || 0,
          previous?.src ?? null,
          previous?.naturalWidth ?? 0,
          previous?.naturalHeight || previous?.height || 0,
          ghost,
          actor?.column ?? null,
          actor?.row ?? null,
        )
        return [{ stack, feet: p, ghost, actor, image, previous }]
      })
    // Publish this frame's projection before drawing identities so native
    // diagnostics measure peer motion against the same camera, not the last frame.
    canvas.dataset.cameraX = String(camera.x + pan.x)
    canvas.dataset.cameraY = String(camera.y + pan.y)
    canvas.dataset.travellerX = String(selfPoint.x)
    canvas.dataset.travellerY = String(selfPoint.y)
    canvas.dataset.tileSize = String(tile)
    canvas.dataset.embodiedActors = String(embodiedActors)
    canvas.dataset.frameNow = String(now)
    canvas.dataset.frameStarted = String(start)
    const repaintIdentity =
      !identityContext ||
      !paintedIdentity ||
      identity.length !== paintedIdentity.length ||
      identity.some((value, index) => value !== paintedIdentity![index])
    if (repaintIdentity) {
      if (identityContext) {
        identityContext.setTransform(identityRatio, 0, 0, identityRatio, 0, 0)
        if (paintedIdentityBounds) {
          const left = Math.max(
            0,
            Math.floor(paintedIdentityBounds.left * identityRatio) / identityRatio,
          )
          const top = Math.max(
            0,
            Math.floor(paintedIdentityBounds.top * identityRatio) / identityRatio,
          )
          const right = Math.min(
            width,
            Math.ceil(paintedIdentityBounds.right * identityRatio) / identityRatio,
          )
          const bottom = Math.min(
            height,
            Math.ceil(paintedIdentityBounds.bottom * identityRatio) / identityRatio,
          )
          identityContext.clearRect(left, top, right - left, bottom - top)
        } else identityContext.clearRect(0, 0, width, height)
      }
      for (const { stack, feet, ghost, actor, image, previous } of identities) {
        drawPerson(stack, feet, ghost && Boolean(actor), actor, image, previous)
        if (ghost && !actor) drawPerson(stack, feet, true, null, image, previous)
      }
      // Labels are independent of actor bodies, click targets and the nearby-player list.
      // In a crowd prioritize the player and the center of the viewport, then skip collisions.
      const labelLimit = 12
      const dense = nameplates.length > labelLimit
      if (dense) {
        const centerDistance = ({ point }: Nameplate) =>
          (point.x - width / 2) ** 2 + (point.y - height / 2) ** 2
        nameplates.sort(
          (a, b) =>
            Number(b.person.self) - Number(a.person.self) || centerDistance(a) - centerDistance(b),
        )
      }
      const occupied: LabelBounds[] = []
      for (const nameplate of nameplates) {
        if (dense && occupied.length >= labelLimit) break
        paintNameplate(nameplate, occupied, dense)
      }
      if (locationLabels.length) {
        const fontSize = Math.max(11, Math.min(14, Math.round(12 * tokenScale)))
        const labelHeight = fontSize + 6
        const spacing = labelHeight + 4
        personContext.font = `600 ${fontSize}px Arial, sans-serif`
        for (const { text, x, y } of locationLabels) {
          const labelWidth = Math.ceil(personContext.measureText(text).width + 12)
          const left = Math.max(3, Math.min(width - labelWidth - 3, Math.round(x - labelWidth / 2)))
          const top = Math.max(3, Math.min(height - labelHeight - 3, Math.round(y)))
          for (const offset of [0, spacing, -spacing, spacing * 2]) {
            const bounds = {
              left,
              top: top + offset,
              right: left + labelWidth,
              bottom: top + offset + labelHeight,
            }
            if (
              bounds.top < 3 ||
              bounds.bottom > height - 3 ||
              occupied.some((other) => labelsOverlap(bounds, other))
            )
              continue
            occupied.push(bounds)
            includeIdentityBounds(left, bounds.top, bounds.right, bounds.bottom)
            paintMapLabel(personContext, text, bounds, fontSize, 'location', identityRatio)
            break
          }
        }
      }
      paintedIdentity = identity
      paintedIdentityBounds = identityBounds
    }
    const ended = performance.now()
    paintedProjections.push({
      // Native input queued during this paint still refers to the preceding
      // completed frame. The callback's start time can predate that input.
      at: Math.max(now, ended),
      camera: { ...camera },
      pan: { ...pan },
      tile,
      width,
      height,
      decks,
    })
    if (paintedProjections.length > 64) paintedProjections.shift()
    if (timing) {
      timing.identityMs = ended - phaseAt
      timing.identityOccluders = occluders.length
      timing.identityOccluderChecks = identityOccluderChecks
      timing.immutableStaticImages =
        [...cache.values()].reduce(
          (total, entry) =>
            total +
            Number('close' in entry.ground) +
            [...entry.surfaces.values()].filter(({ canvas }) => 'close' in canvas).length,
          0,
        ) +
        [...sceneryBatches.values()].filter(({ layer }) => 'close' in layer).length +
        Number(Boolean(stationaryGround?.layer && 'close' in stationaryGround.layer)) +
        groundProjections.immutableImages +
        [...biomeRasters.values()].filter((raster) => 'close' in raster).length
      timing.completedAt = ended
      timing.biomeRasters = biomeRasters.size
      timing.biomeRasterPixels = biomeRasterPixels
      canvas.dataset.renderTiming = JSON.stringify(timing)
    }
    // Coverage and timing are collected together by the native replacement
    // check. Keep coverage opt-in independent from the single timing mode so
    // enabling one diagnostic cannot silently disable the other.
    const coverageEnabled = canvas.dataset.testGroundCoverage !== undefined
    if (timing || coverageEnabled) {
      const painted = visible.map((sector) => sector.id)
      canvas.dataset.paintedGroundIds = JSON.stringify(painted)
      // Record coverage at the producer boundary after this frame has finished.
      // External observers and RAF loops can miss the renderer's final mutation
      // under native load; this opt-in diagnostic has no normal-game cost.
      if (coverageEnabled && !canvas.dataset.testGroundCoverageStopped) {
        if (canvas.dataset.testGroundCoverage === '[]' && coverageFrames.length)
          coverageFrames.length = 0
        if (coverageFrames.at(-1)?.at !== now) {
          coverageFrames.push({
            at: now,
            x: camera.x + pan.x,
            y: camera.y + pan.y,
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            tile,
            painted,
          })
          if (coverageFrames.length > 1200) coverageFrames.shift()
          canvas.dataset.testGroundCoverage = JSON.stringify(coverageFrames)
        }
      }
    } else if (canvas.dataset.paintedGroundIds !== undefined) delete canvas.dataset.paintedGroundIds
    frameTimes.push(ended - start)
    if (frameTimes.length > 120) frameTimes.shift()
    drawn++
    // Native throughput checks need completed frames, not the rounded batch
    // used by the ordinary low-frequency statistics. Timing remains opt-in.
    if (canvas.dataset.renderDiagnostics === 'frames') canvas.dataset.renderFrames = String(drawn)
    if (drawn % 60 === 0) {
      const sorted = [...frameTimes].sort((a, b) => a - b)
      canvas.dataset.frameP95 = String(Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0))
      canvas.dataset.cachedSectors = String(cache.size)
      canvas.dataset.cachedPixels = String(cachedPixels)
      canvas.dataset.cachedGroundProjectionPixels = String(groundProjections.pixels)
      canvas.dataset.visibleScenery = String(scenery.length)
      canvas.dataset.detailedScenery = String(detailedScenery)
      canvas.dataset.waterCells = String(waterCells)
      canvas.dataset.renderFrames = String(drawn)
      canvas.dataset.visiblePlayers = String(view.players.length + 1)
    }
  }
  function loop(rafAt: number) {
    frame = 0
    if (disposed || paused || document.visibilityState !== 'visible') return
    // A delayed RAF stamp can predate a receipt already applied on performance.now().
    // Sample every visual at callback entry on that same monotonic clock, retaining
    // the scheduled stamp separately for diagnostics. Never sample before a receipt.
    const callbackAt = performance.now(),
      now = Math.max(rafAt, callbackAt)
    if (timingEnabled()) callbackStarted = callbackAt
    if (rasterZoomAt !== null && now >= rasterZoomAt) {
      rasterTile = tile
      rasterZoomAt = null
      clearCache()
      dirty = true
    }
    const sample = motion.sample(now),
      remoteMoving = remoteMotion.moving(now),
      settling = sample.point.x !== camera.x || sample.point.y !== camera.y,
      interval =
        sample.moving || remoteMoving || settling
          ? 1000 / 60
          : animate && !reduced
            ? 1000 / mapQualityBudgets[quality].idleFps
            : 250
    // Finishing motion must paint its endpoint before switching to the idle cadence.
    if (
      dirty ||
      pendingOverviewGround ||
      (wasMoving && !sample.moving) ||
      (wasRemoteMoving && !remoteMoving) ||
      rafAt - lastPaintRaf >= interval - 1
    ) {
      draw(now, rafAt, remoteMoving)
      dirty = false
    }
    wasMoving = sample.moving
    wasRemoteMoving = remoteMoving
    if (
      sample.moving ||
      remoteMoving ||
      sample.point.x !== camera.x ||
      sample.point.y !== camera.y ||
      rasterZoomAt !== null ||
      pendingOverviewGround ||
      (animate && !reduced)
    )
      frame = requestAnimationFrame(loop)
  }
  function requestDraw() {
    dirty = true
    if (!disposed && !paused && !frame && document.visibilityState === 'visible')
      frame = requestAnimationFrame(loop)
  }
  const visibility = () => {
    if (document.visibilityState !== 'visible') {
      releaseHeldKeys()
      motion.suspend(performance.now())
    } else motion.resume(performance.now())
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (!disposed && !paused && document.visibilityState === 'visible') {
      last = 0
      lastPaintRaf = -Infinity
      dirty = true
      frame = requestAnimationFrame(loop)
    }
  }
  document.addEventListener('visibilitychange', visibility)
  visibility()
  const pointers = new Map<number, { x: number; y: number }>()
  let pinch: { distance: number; zoom: number } | null = null,
    gestured = false
  const distance = () => {
    const [a, b] = [...pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }
  const applyZoom = (next: number) => {
    zoom = next
    tile = tileSize()
    if (!cache.size) {
      rasterTile = tile
      rasterZoomAt = null
    } else rasterZoomAt = performance.now() + 120
    requestDraw()
  }
  const changeZoom = (next: number) => {
    next = clampWorldZoom(Math.round(next * 100) / 100)
    if (zoomLocked || next === zoom) return
    applyZoom(next)
    onZoom(zoom)
  }
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    if (zoomLocked) return
    changeZoom(zoom * Math.exp(-event.deltaY * (event.ctrlKey ? 0.006 : 0.0015)))
  }
  const down = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId)
    if (event.pointerType === 'touch') {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 2) {
        pinch = { distance: distance(), zoom }
        gestured = true
        drag = null
        return
      }
    }
    const bounds = canvas.getBoundingClientRect(),
      x = event.clientX - bounds.left,
      y = event.clientY - bounds.top,
      eventAt = Number(event.timeStamp),
      projection =
        Number.isFinite(eventAt) && eventAt > 0
          ? paintedProjections.findLast((frame) => frame.at <= eventAt)
          : undefined,
      ground = world(x, y, projection)
    drag = {
      x: event.clientX,
      y: event.clientY,
      // Public scenery may extend beyond the navigation/peer snapshot. A click
      // submits intent there; only supplied navigation can preview the route,
      // and the server still validates the destination and every traversed cell.
      position: (() => {
        const decks = projection?.decks ?? paintedProjections.at(-1)?.decks ?? []
        let target = ground
        for (const deck of decks) {
          const onDeck = bridgeDeckPoint(deck, ground, true)
          if (onDeck) {
            target = onDeck
            break
          }
          // The deck's former footprint can show open water beneath the arch.
          if (bridgeDeckPoint(deck, ground)) return null
        }
        const position = pick(target, renderSectors, projection?.camera.x ?? camera.x)
        if (
          !position ||
          (!position.sectorId.startsWith('void:') && !position.sectorId.startsWith('uncharted-'))
        )
          return position
        if (isLocalVoidWalk(view.position.sectorId, position.sectorId)) return position
        return view.sectors.some(
          (sector) =>
            sector.id === position.sectorId &&
            sector.cells.some(
              (cell) => cell.x === position.x && cell.y === position.y && cell.walkable,
            ),
        )
          ? position
          : null
      })(),
      player:
        hitTargets.find((target) => Math.hypot(target.x - x, target.y - y) < target.radius) ?? null,
    }
  }
  const move = (event: PointerEvent) => {
    if (pointers.has(event.pointerId))
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinch && pointers.size >= 2) {
      if (pinch.distance > 0) changeZoom((pinch.zoom * distance()) / pinch.distance)
      return
    }
    if (gestured) return
  }
  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (gestured) {
      if (pointers.size < 2) pinch = null
      if (!pointers.size) gestured = false
      drag = null
      return
    }
    const start = drag
    drag = null
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return
    const hit = start.player
    if (hit) {
      if (hit.id === `npc:${FERRY_CONVERSATION_ID}`) selectFerryman?.()
      else if (!hit.self) selectPlayer(hit.id)
      return
    }
    const position = start.position
    if (position) {
      releaseHeldKeys(false)
      select(position)
      requestDraw()
    }
  }
  const cancel = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size < 2) pinch = null
    if (!pointers.size) gestured = false
    drag = null
  }
  const keyDirections: Record<string, MapDirection> = {
    arrowleft: 'west',
    arrowright: 'east',
    arrowup: 'north',
    arrowdown: 'south',
    w: 'north',
    a: 'west',
    s: 'south',
    d: 'east',
  }
  function walkHeldKey(initial = false) {
    initialKeyStep = initial
    keyTimer = null
    const direction = [...heldKeys.values()].at(-1)
    if (!direction || disposed || paused || document.visibilityState !== 'visible') return
    const offset = walkOffset[direction]
    if (view.movementBlocked || view.battleSessionId) {
      releaseHeldKeys(false)
      return
    }
    const now = performance.now(),
      sample = motion.sample(now),
      approved = mapPoint(motion.approvedPosition(now), view.sectors, sample.point),
      pivot = motion.directionalOrigin(direction, view.sectors, now, sample),
      standing = mapPoint(pivot, view.sectors, sample.point),
      perpendicular = offset.x ? 'y' : 'x'
    const sampleOnLane = Math.abs(standing[perpendicular] - sample.point[perpendicular]) < 1e-7
    const p =
      Math.abs(approved[perpendicular] - standing[perpendicular]) < 1e-7 &&
      (approved.x - sample.point.x) * offset.x + (approved.y - sample.point.y) * offset.y > 0
        ? approved
        : sampleOnLane
          ? sample.point
          : standing
    const base = { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 }
    const localVoid = isVoidRealmSectorId(sample.position.sectorId)
    const pickStep = (point: MapPoint) =>
      pick(point) ?? (localVoid ? pick(point, renderSectors) : null)
    let from = pickStep(base) ?? sample.position,
      position: WorldPosition | null = null,
      first: WorldPosition | null = null
    // Keep a known legal route ahead of the key timer instead of exhausting a
    // single tile at every callback. WorldMotion still caps unconfirmed preview.
    for (let distance = 1; distance <= KEY_LOOKAHEAD_STEPS; distance++) {
      const candidate = pickStep({
        x: base.x + offset.x * distance,
        y: base.y + offset.y * distance,
      })
      if (!candidate) break
      const source = view.sectors.find((sector) => sector.id === from.sectorId),
        adjacent =
          from.sectorId === candidate.sectorId &&
          Math.abs(from.x - candidate.x) + Math.abs(from.y - candidate.y) === 1,
        crossing = source?.exits.some(
          (exit) => samePosition(exit.from, from) && samePosition(exit.to, candidate),
        )
      // Void terrain connects across dry cardinal neighbors at sector edges.
      if (
        !adjacent &&
        !crossing &&
        !(localVoid && isLocalVoidWalk(sample.position.sectorId, candidate.sectorId))
      )
        break
      first ??= candidate
      position = candidate
      from = candidate
    }
    let cadence = STEP_MS
    if (position && first) {
      const sector = view.sectors.find((sector) => sector.id === sample.position.sectorId)
      const crossing = sector?.exits.find(
        (exit) => samePosition(exit.from, sample.position) && samePosition(exit.to, first),
      )
      cadence = Math.max(STEP_MS, crossing?.durationMs ?? sector?.stepMs ?? STEP_MS)
      heldDirection = direction
      heldDestination = position
      heldReleaseOrigin = motion.nextLanding(now)
      heldFirstDestination = first
      // The release write can queue behind a delayed receipt. A tap must never
      // authorize three steps while it waits. Keep lookahead for interpolation
      // and extend the server route only after a held-key interval elapses.
      if (initial && !samePosition(first, position)) select(first, direction, position)
      else select(position, direction)
      requestDraw()
    } else if (heldDirection !== direction) {
      // A blocked turn must also cancel the previous click or held heading.
      heldDestination = null
      heldDirection = direction
      onStop()
    }
    // Browser key-repeat never owns cadence or creates extra RPCs. The legal
    // terrain/exit duration controls the next intent; the server still commits it.
    // Selection/navigation work is part of this interval, not extra time
    // between steps. Keep the next intent on the captured authored deadline.
    keyTimer = setTimeout(walkHeldKey, Math.max(0, now + cadence - performance.now()))
  }
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      releaseHeldKeys(false)
      if (!event.repeat) onStop()
      return
    }
    const name = event.key.toLowerCase(),
      direction = keyDirections[name]
    if (!Object.hasOwn(keyDirections, name) || !direction) return
    event.preventDefault()
    if (event.repeat || heldKeys.has(name)) return
    heldKeys.set(name, direction)
    if (keyTimer !== null) clearTimeout(keyTimer)
    walkHeldKey(true)
  }
  const keyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    const wasActive = [...heldKeys.keys()].at(-1) === key
    if (!heldKeys.delete(key) || !wasActive) return
    if (!heldKeys.size) releaseHeldKeys()
    else {
      if (keyTimer !== null) clearTimeout(keyTimer)
      walkHeldKey(true)
    }
  }
  const blur = (event: FocusEvent) => {
    // A deliberate Approach/Attack replaces movement itself. Do not start an
    // extra release write immediately before its high-priority action click.
    const target = event.relatedTarget as HTMLElement | null
    releaseHeldKeys(!target?.getAttribute?.('data-world-primary-action'))
  }
  const windowBlur = () => releaseHeldKeys()
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('keydown', key)
  canvas.addEventListener('keyup', keyUp)
  canvas.addEventListener('blur', blur)
  window.addEventListener('blur', windowBlur)
  canvas.addEventListener('wheel', wheel, { passive: false })
  const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
    onReduced = () => {
      reduced = media.matches
      requestDraw()
    }
  media.addEventListener('change', onReduced)
  return {
    update(next: WorldView) {
      const profiling = timingEnabled()
      const started = profiling ? performance.now() : 0
      next = retainWorldSceneReferences(view, next)
      const terrain = worldRenderTerrain(next, renderSectors)
      const terrainChanged = terrain !== renderSectors
      const atlasChanged =
        next.atlas !== view.atlas && atlasTerrainKey(next.atlas) !== indexedAtlasKey
      const discoveryProofChanged =
        (next.publicGrandDiscoveries ?? []).join(':') !==
        (view.publicGrandDiscoveries ?? []).join(':')
      renderSectors = terrain
      const peerStarted = performance.now()
      if (next.serverNow !== view.serverNow) ferryClockAt = peerStarted
      if (next.atlas !== view.atlas) {
        chartedTerrain = chartedTerrainAt(next.atlas)
        if (atlasChanged) {
          islandFringes = asterwakeOceanFringes(chartedTerrain)
          for (const [id, entry] of chartBackdrops)
            if (entry.metadata.regionId === ASTERWAKE_REGION_ID) {
              releaseStaticRaster(entry.ground)
              chartBackdrops.delete(id)
            }
        }
        chartCoasts.clear()
      }
      const changedDeck =
        view.position.sectorId.startsWith('ferry:') !== next.position.sectorId.startsWith('ferry:')
      view = next
      if (changedDeck) applyZoom(zoom)
      // Network refreshes deserialize a new object graph. Retain the exact
      // authority array only when all topology is equivalent, so ordinary
      // presence receipts avoid rebuilding remote navigation while real exits,
      // cadence and collision changes remain live.
      remoteMotion.update(next, peerStarted, camera)
      const indexStarted = profiling ? performance.now() : 0
      const nextDependencies = new Set(visibleGroundIds)
      const relevantDependencies = new Set([...activeVisibleTerrainIds, ...nextDependencies])
      const indexRequired =
        atlasChanged ||
        (terrainChanged &&
          (!activeVisibleTerrainIds.size || terrainDependenciesChanged(relevantDependencies)))
      if (indexRequired) {
        indexTerrain()
        loadRegionalArt()
      } else if (discoveryProofChanged) {
        grandDiscoveries = grandDiscoveryPlacements(renderSectors, view.publicGrandDiscoveries)
        clearStationaryScenery()
        loadRegionalArt()
      }
      if (profiling) {
        const ended = performance.now()
        pendingTiming ??= {
          updates: 0,
          updateMs: 0,
          peerUpdateMs: 0,
          lastPeerUpdateAt: 0,
          terrainIndexes: 0,
          terrainIndexMs: 0,
        }
        pendingTiming.updates!++
        pendingTiming.updateMs! += ended - started
        pendingTiming.peerUpdateMs! += indexStarted - peerStarted
        pendingTiming.lastPeerUpdateAt = peerStarted
        if (indexRequired) {
          pendingTiming.terrainIndexes!++
          pendingTiming.terrainIndexMs! += ended - indexStarted
        }
      }
      requestDraw()
    },
    settings(value: {
      animate: boolean
      zoom: number
      paused?: boolean
      zoomLocked?: boolean
      quality?: MapQuality
      preview?: boolean
      authorityOverlay?: boolean
      showLocationLabels?: boolean
    }) {
      animate = value.animate
      showLocationLabels = value.showLocationLabels ?? true
      const nextQuality = value.quality ?? DEFAULT_MAP_QUALITY
      const terrainResolutionChanged = (quality === 'low') !== (nextQuality === 'low')
      quality = nextQuality
      preview = value.preview ?? false
      authorityOverlay = value.authorityOverlay ?? false
      zoomLocked = value.zoomLocked ?? false
      paused = value.paused ?? false
      if (paused) releaseHeldKeys()
      if (paused && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (terrainResolutionChanged) resize()
      if (zoom !== value.zoom) applyZoom(value.zoom)
      requestDraw()
    },
    dispose() {
      if (disposed) return
      // A still-live host (such as switching to the globe) can shorten the route
      // before teardown. No timer or later disposal submits additional input.
      releaseHeldKeys()
      disposed = true
      remoteMotion.dispose()
      compactPortraits.clear()
      actorFrames.clear()
      wildlifeParts.clear()
      weatherVeil.clear()
      lighting.clear()
      for (const cloud of clouds) releaseStaticRaster(cloud)
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      clearCache()
      for (const image of images.values()) image.onload = null
      for (const image of portraits.values()) image.onload = null
      media.removeEventListener('change', onReduced)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('keydown', key)
      canvas.removeEventListener('keyup', keyUp)
      canvas.removeEventListener('blur', blur)
      window.removeEventListener('blur', windowBlur)
      canvas.removeEventListener('wheel', wheel)
      pointers.clear()
      cache.clear()
      clearBiomeRasters()
      portraits.clear()
      actorAssets.clear()
      actorPositions.clear()
      paintedIdentity = null
      paintedIdentityBounds = null
      if (identityCanvas && identityContext) {
        identityCanvas.width = 0
        identityCanvas.height = 0
      }
      for (const image of images.values()) image.onload = null
    },
  }
}
