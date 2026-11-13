import 'server-only'

import { supercontinentTerrain } from './supercontinent-terrain'

import { GRID_HEIGHT, GRID_WIDTH, STEP_MS } from '@/world/catalog'
import { terrainWalkable } from '@/world/terrain'
import {
  VOID_REALMS,
  VOID_REALM_COLUMNS,
  VOID_REALM_ROWS,
  parseVoidSectorId,
  voidSectorId,
  type VoidRealmId,
} from '@/world/void-realms'
import type { WorldLandmark, WorldPosition, WorldSector, WorldWarpedScenery } from '@/world/types'

type Point = readonly [number, number]
type Ellipse = readonly [number, number, number, number]
type Site = readonly [string, number, number]
type Channel = { points: readonly Point[]; width: number; lava?: boolean }
type District = {
  name: string
  extent: Ellipse
  theme: NonNullable<WorldSector['warpedTheme']>
  landscape?: WorldSector['landscape']
}
interface RealmDefinition {
  coast: readonly Ellipse[]
  bays?: readonly Ellipse[]
  lakes: readonly Ellipse[]
  lava?: readonly Ellipse[]
  channels: readonly Channel[]
  cliffs: readonly Channel[]
  passages?: readonly Channel[]
  districts: readonly District[]
  sites: readonly Site[]
  foliage: number
}

// Authored macro coordinates are tiles on a private 416 x 216 plane. They never
// become globe/atlas coordinates. Features cross sector seams without restamping.
const definitions: Record<VoidRealmId, RealmDefinition> = {
  'ivory-veil': {
    coast: [
      [207, 106, 194, 94],
      [116, 161, 97, 38],
    ],
    bays: [[310, 20, 58, 25]],
    lakes: [
      [154, 86, 26, 16],
      [298, 143, 38, 23],
      [85, 150, 16, 11],
    ],
    channels: [
      {
        points: [
          [191, 18],
          [187, 45],
          [170, 61],
          [178, 92],
          [154, 116],
          [143, 146],
          [112, 174],
          [102, 210],
        ],
        width: 2.4,
      },
      {
        points: [
          [78, 48],
          [108, 63],
          [123, 89],
          [154, 116],
        ],
        width: 1.5,
      },
      {
        points: [
          [282, 46],
          [251, 61],
          [229, 99],
          [199, 106],
          [154, 116],
        ],
        width: 1.8,
      },
    ],
    cliffs: [
      {
        points: [
          [198, 29],
          [232, 41],
          [252, 59],
          [280, 65],
          [324, 59],
        ],
        width: 2,
      },
      {
        points: [
          [206, 161],
          [233, 175],
          [260, 175],
          [279, 161],
        ],
        width: 1.6,
      },
    ],
    districts: [
      { name: 'The Ivory Canopy', extent: [113, 108, 98, 63], theme: 'haven', landscape: 'sakura' },
      {
        name: 'Silverwater Valley',
        extent: [217, 125, 74, 62],
        theme: 'amethyst',
        landscape: 'willow',
      },
      { name: 'The Pale Escarpment', extent: [293, 64, 96, 43], theme: 'fracture' },
      {
        name: 'Lantern Downs',
        extent: [326, 137, 67, 53],
        theme: 'wayfarer',
        landscape: 'wildflowers',
      },
    ],
    sites: [
      ['Veilwatch Refuge', 3, 12],
      ['The Folded Orchard', 7, 7],
      ['Silverleaf Spring', 9, 15],
      ['Palecrest Lookout', 15, 4],
      ['The Rootbound Crossing', 12, 11],
      ['Ivory Cloister', 17, 17],
      ['The Quiet Expedition', 21, 11],
      ['Shrine of Soft Rain', 23, 6],
      ['The Waning Mile', 26, 11],
      ['Lanternflower Hollow', 24, 17],
      ['The Unshadowed Dial', 19, 7],
      ['The Far White Tarn', 29, 12],
    ],
    foliage: 0.42,
  },
  'amber-drowned': {
    coast: [
      [224, 117, 184, 85],
      [86, 104, 65, 64],
    ],
    bays: [
      [187, 195, 71, 26],
      [352, 48, 54, 36],
    ],
    lakes: [
      [104, 83, 29, 19],
      [274, 143, 44, 27],
      [334, 103, 23, 14],
    ],
    channels: [
      {
        points: [
          [193, 25],
          [185, 58],
          [202, 85],
          [190, 112],
          [222, 137],
          [214, 170],
          [235, 211],
        ],
        width: 3.2,
      },
      {
        points: [
          [190, 112],
          [165, 133],
          [138, 130],
          [119, 150],
          [88, 165],
          [56, 206],
        ],
        width: 2.4,
      },
      {
        points: [
          [202, 85],
          [238, 95],
          [263, 115],
          [288, 120],
          [321, 154],
          [381, 180],
        ],
        width: 2.5,
      },
    ],
    cliffs: [
      {
        points: [
          [59, 60],
          [80, 50],
          [127, 49],
          [152, 58],
        ],
        width: 1.8,
      },
      {
        points: [
          [239, 54],
          [278, 57],
          [297, 70],
        ],
        width: 2.2,
      },
    ],
    districts: [
      {
        name: 'The Drowned Reaches',
        extent: [177, 144, 112, 62],
        theme: 'amber',
        landscape: 'willow',
      },
      { name: 'Reedgold Banks', extent: [94, 89, 72, 53], theme: 'haven', landscape: 'autumn' },
      {
        name: 'The Copper Lagoons',
        extent: [299, 127, 96, 65],
        theme: 'amber',
        landscape: 'autumn',
      },
      { name: 'Drybell Heights', extent: [237, 60, 93, 35], theme: 'ashen' },
    ],
    sites: [
      ['Reedgold Refuge', 4, 11],
      ['The Sunken Pears', 8, 6],
      ['Copperwell', 10, 13],
      ['Drybell Tower', 16, 5],
      ['The Gilt Causeway', 14, 12],
      ['Drowned Counting House', 18, 15],
      ['The Reedcutters Rest', 11, 18],
      ['Shrine of Low Water', 22, 10],
      ['The Amber Mile', 25, 6],
      ['Saffron Mangroves', 25, 17],
      ['The Twice-Struck Bell', 20, 7],
      ['Last Ember Lagoon', 29, 13],
    ],
    foliage: 0.29,
  },
  'cinder-choir': {
    coast: [[210, 113, 190, 95]],
    bays: [[364, 44, 44, 35]],
    lakes: [
      [92, 128, 24, 15],
      [321, 161, 23, 14],
    ],
    lava: [
      [210, 85, 35, 26],
      [283, 137, 23, 18],
    ],
    channels: [
      {
        points: [
          [211, 87],
          [227, 112],
          [215, 137],
          [239, 165],
          [236, 195],
        ],
        width: 2.8,
        lava: true,
      },
      {
        points: [
          [213, 84],
          [244, 93],
          [253, 112],
          [284, 137],
          [322, 130],
          [365, 147],
        ],
        width: 2.1,
        lava: true,
      },
      {
        points: [
          [90, 32],
          [111, 68],
          [104, 99],
          [93, 128],
          [67, 164],
          [69, 195],
        ],
        width: 1.8,
      },
    ],
    cliffs: [
      {
        points: [
          [140, 31],
          [157, 61],
          [146, 90],
          [164, 123],
          [155, 159],
          [171, 187],
        ],
        width: 3.4,
      },
      {
        points: [
          [259, 29],
          [283, 55],
          [277, 91],
          [309, 111],
          [338, 104],
        ],
        width: 3,
      },
      {
        points: [
          [183, 155],
          [208, 165],
          [229, 163],
          [258, 184],
          [300, 190],
        ],
        width: 2.1,
      },
    ],
    districts: [
      { name: 'The Sootbound Valley', extent: [101, 114, 78, 74], theme: 'ashen' },
      { name: 'The Cinder Choir', extent: [222, 102, 91, 77], theme: 'ashen' },
      { name: 'Emberglass Steps', extent: [305, 99, 79, 65], theme: 'fracture' },
      {
        name: 'The Cooling Verge',
        extent: [293, 173, 76, 30],
        theme: 'wayfarer',
        landscape: 'wildflowers',
      },
    ],
    sites: [
      ['Sootlamp Refuge', 4, 13],
      ['The Charcoal Orchard', 7, 8],
      ['The Cooling Eye', 9, 14],
      ['Scoria Watch', 12, 5],
      ['The Goldfall Stair', 17, 12],
      ['Choir of Broken Kilns', 17, 9],
      ['Ashwalk Camp', 14, 18],
      ['The Low Ember Shrine', 21, 18],
      ['The Pumice Stair', 23, 7],
      ['Cinderflower Fold', 26, 15],
      ['The Black Meridian', 20, 4],
      ['The Last Cool Spring', 29, 12],
    ],
    foliage: 0.08,
  },
  'glass-tides': {
    coast: [
      [126, 108, 111, 83],
      [278, 94, 105, 68],
      [319, 158, 65, 38],
    ],
    bays: [
      [200, 189, 66, 36],
      [247, 18, 61, 30],
    ],
    lakes: [
      [102, 97, 27, 21],
      [281, 76, 35, 16],
    ],
    channels: [
      {
        points: [
          [164, 26],
          [175, 59],
          [171, 87],
          [185, 118],
          [178, 144],
          [203, 180],
        ],
        width: 4.2,
      },
      {
        points: [
          [185, 118],
          [229, 123],
          [256, 114],
          [292, 127],
          [324, 122],
          [396, 145],
        ],
        width: 3.2,
      },
      {
        points: [
          [228, 39],
          [237, 65],
          [230, 91],
          [229, 123],
        ],
        width: 2,
      },
    ],
    cliffs: [
      {
        points: [
          [47, 76],
          [69, 53],
          [98, 47],
          [129, 58],
        ],
        width: 2.5,
      },
      {
        points: [
          [269, 145],
          [296, 153],
          [318, 148],
          [343, 161],
          [367, 159],
        ],
        width: 2.4,
      },
    ],
    districts: [
      {
        name: 'The Mirror Shoals',
        extent: [103, 113, 85, 68],
        theme: 'amethyst',
        landscape: 'willow',
      },
      { name: 'Glassfall Narrows', extent: [206, 100, 56, 74], theme: 'fracture' },
      { name: 'The Quiet Tides', extent: [296, 77, 83, 51], theme: 'haven', landscape: 'sakura' },
      {
        name: 'Violet Shell Strand',
        extent: [324, 164, 63, 31],
        theme: 'amethyst',
        landscape: 'wildflowers',
      },
    ],
    sites: [
      ['Shelllight Refuge', 3, 11],
      ['The Saltblossom Grove', 7, 6],
      ['The Lower Mirror', 8, 15],
      ['Glassneedle Watch', 12, 8],
      ['The Clearwater Crossing', 14, 13],
      ['House of Quiet Tides', 18, 8],
      ['The Long Shoal Camp', 18, 14],
      ['Shrine of Violet Shells', 24, 18],
      ['The Windworn Marker', 22, 5],
      ['The Pearled Canopy', 26, 10],
      ['The Unsetting Glass', 23, 8],
      ['The Far Tidepool', 28, 16],
    ],
    foliage: 0.17,
  },
  'hollow-orchard': {
    coast: [[208, 109, 193, 95]],
    bays: [[54, 30, 46, 39]],
    lakes: [
      [216, 111, 69, 33],
      [106, 165, 20, 13],
    ],
    channels: [
      {
        points: [
          [217, 113],
          [277, 114],
          [300, 101],
          [325, 110],
          [350, 135],
          [405, 151],
        ],
        width: 2.7,
      },
      {
        points: [
          [171, 28],
          [181, 52],
          [173, 76],
          [187, 93],
          [216, 111],
        ],
        width: 1.8,
      },
      {
        points: [
          [118, 59],
          [142, 71],
          [151, 88],
          [177, 102],
        ],
        width: 1.4,
      },
    ],
    cliffs: [
      {
        points: [
          [109, 84],
          [131, 59],
          [174, 46],
          [214, 43],
          [258, 53],
          [287, 74],
          [302, 95],
        ],
        width: 3.1,
      },
      {
        points: [
          [122, 129],
          [143, 151],
          [189, 166],
          [235, 168],
          [278, 153],
        ],
        width: 2.4,
      },
    ],
    districts: [
      {
        name: 'The Outer Orchard',
        extent: [101, 113, 83, 72],
        theme: 'haven',
        landscape: 'sakura',
      },
      {
        name: 'Hollowwater Banks',
        extent: [216, 112, 88, 59],
        theme: 'amethyst',
        landscape: 'willow',
      },
      {
        name: 'The Crown of Roots',
        extent: [216, 50, 109, 31],
        theme: 'haven',
        landscape: 'wisteria',
      },
      {
        name: 'The Sporelit Vale',
        extent: [323, 133, 70, 57],
        theme: 'wayfarer',
        landscape: 'wildflowers',
      },
    ],
    sites: [
      ['Rootlantern Refuge', 3, 12],
      ['The Thousand White Boughs', 6, 9],
      ['Hollowwater Spring', 10, 14],
      ['The High Branch Watch', 13, 4],
      ['The Rootwoven Ford', 21, 12],
      ['The Fallen Conservatory', 16, 18],
      ['The Orchard Keepers Rest', 8, 17],
      ['Shrine of Still Fruit', 22, 5],
      ['The Mossbound Mile', 25, 9],
      ['Sporelight Gardens', 26, 15],
      ['The Seedless Hour', 18, 6],
      ['The Listening Pool', 29, 13],
    ],
    foliage: 0.68,
  },
  'starfall-basin': {
    coast: [[210, 109, 194, 96]],
    lakes: [
      [108, 76, 25, 17],
      [310, 145, 30, 19],
      [225, 187, 33, 11],
    ],
    channels: [
      {
        points: [
          [102, 21],
          [119, 40],
          [108, 76],
          [84, 99],
          [76, 137],
          [44, 163],
        ],
        width: 1.9,
      },
      {
        points: [
          [313, 22],
          [298, 53],
          [313, 81],
          [305, 112],
          [310, 145],
          [335, 184],
        ],
        width: 2.1,
      },
      {
        points: [
          [310, 145],
          [277, 167],
          [252, 169],
          [225, 187],
        ],
        width: 1.5,
      },
    ],
    cliffs: [
      {
        points: [
          [135, 45],
          [170, 30],
          [219, 28],
          [258, 40],
          [286, 63],
        ],
        width: 2.2,
      },
    ],
    districts: [
      { name: 'The Falling-Star Hollow', extent: [214, 99, 91, 60], theme: 'fracture' },
      {
        name: 'The Outer Terraces',
        extent: [123, 126, 95, 68],
        theme: 'wayfarer',
        landscape: 'wildflowers',
      },
      {
        name: 'The Violet Rim',
        extent: [302, 120, 85, 68],
        theme: 'amethyst',
        landscape: 'wisteria',
      },
      {
        name: 'Pale Meteor Downs',
        extent: [213, 177, 84, 26],
        theme: 'haven',
        landscape: 'wildflowers',
      },
    ],
    sites: [
      ['Rimlight Refuge', 3, 12],
      ['The Pale Ejecta Garden', 7, 7],
      ['The Outer Tarn', 9, 16],
      ['Shattered Rim Watch', 13, 5],
      ['The Breached Terrace', 12, 12],
      ['The Silent Impact', 18, 11],
      ['The Falling-Star Camp', 16, 17],
      ['The Dustfall Shrine', 22, 6],
      ['The Inclined Mile', 25, 10],
      ['The Violet Scree Garden', 26, 16],
      ['The Fallen Meridian', 20, 8],
      ['The Southern Starwell', 25, 19],
    ],
    foliage: 0.13,
  },
  'violet-estuary': {
    coast: [[211, 111, 195, 93]],
    bays: [[226, 203, 58, 18]],
    lakes: [
      [101, 76, 26, 15],
      [326, 126, 28, 19],
    ],
    channels: [
      {
        points: [
          [198, 19],
          [187, 52],
          [204, 78],
          [192, 103],
          [209, 129],
          [205, 161],
          [226, 204],
        ],
        width: 3.4,
      },
      {
        points: [
          [49, 35],
          [84, 51],
          [101, 76],
          [136, 89],
          [157, 111],
          [192, 103],
        ],
        width: 2.4,
      },
      {
        points: [
          [355, 36],
          [317, 54],
          [287, 83],
          [253, 86],
          [228, 110],
          [209, 129],
        ],
        width: 2.7,
      },
      {
        points: [
          [209, 129],
          [172, 143],
          [143, 167],
          [108, 183],
          [83, 208],
        ],
        width: 2,
      },
      {
        points: [
          [205, 161],
          [250, 170],
          [281, 161],
          [316, 179],
          [362, 196],
        ],
        width: 2.2,
      },
    ],
    cliffs: [
      {
        points: [
          [81, 109],
          [108, 117],
          [128, 108],
          [143, 119],
        ],
        width: 1.7,
      },
      {
        points: [
          [253, 33],
          [278, 45],
          [300, 42],
        ],
        width: 2.6,
      },
    ],
    passages: [
      {
        points: [
          [188, 58],
          [216, 39],
          [252, 51],
          [286, 61],
          [305, 67],
        ],
        width: 1.2,
      },
      {
        points: [
          [149, 157],
          [170, 171],
          [181, 190],
          [213, 181],
          [248, 186],
          [276, 181],
          [300, 160],
          [266, 139],
        ],
        width: 1.2,
      },
    ],
    districts: [
      {
        name: 'The Three Violet Rivers',
        extent: [205, 116, 98, 78],
        theme: 'amethyst',
        landscape: 'willow',
      },
      {
        name: 'The Flowering Levees',
        extent: [101, 126, 78, 66],
        theme: 'haven',
        landscape: 'wildflowers',
      },
      {
        name: 'The East Wisteria Terraces',
        extent: [312, 106, 80, 62],
        theme: 'amethyst',
        landscape: 'wisteria',
      },
      {
        name: 'The Gold Reed Mouths',
        extent: [278, 175, 87, 28],
        theme: 'amber',
        landscape: 'autumn',
      },
    ],
    sites: [
      ['Leveelight Refuge', 3, 13],
      ['The Floodblossom Grove', 6, 10],
      ['First Violet Spring', 9, 5],
      ['The Highwater Watch', 14, 6],
      ['The Threefold Crossing', 15, 12],
      ['The Riverless Mill', 11, 17],
      ['The Quiet Bank Camp', 20, 15],
      ['Shrine of Reed Shadows', 23, 7],
      ['The Siltbound Mile', 25, 12],
      ['The Wisteria Mouth', 26, 17],
      ['The Reflected Hour', 19, 9],
      ['The Eastern Well', 29, 11],
    ],
    foliage: 0.47,
  },
  'clockwound-waste': {
    coast: [[210, 109, 194, 96]],
    bays: [[58, 27, 51, 35]],
    lakes: [
      [287, 95, 49, 28],
      [127, 154, 23, 14],
    ],
    channels: [
      {
        points: [
          [287, 95],
          [301, 128],
          [280, 151],
          [295, 180],
          [325, 208],
        ],
        width: 1.3,
      },
      {
        points: [
          [103, 36],
          [117, 62],
          [104, 94],
          [127, 121],
          [127, 154],
        ],
        width: 1.1,
      },
    ],
    cliffs: [
      {
        points: [
          [151, 23],
          [167, 54],
          [153, 84],
          [176, 116],
          [164, 145],
          [181, 183],
        ],
        width: 3.2,
      },
      {
        points: [
          [195, 35],
          [217, 58],
          [202, 87],
          [220, 119],
          [209, 153],
          [235, 180],
        ],
        width: 2.7,
      },
      {
        points: [
          [260, 140],
          [284, 151],
          [309, 145],
          [345, 164],
          [368, 155],
        ],
        width: 2.8,
      },
    ],
    districts: [
      { name: 'The Windcut Hours', extent: [100, 114, 80, 73], theme: 'amber' },
      { name: 'The Wound Mesas', extent: [199, 104, 74, 84], theme: 'fracture' },
      { name: 'The Salt Mirror', extent: [291, 94, 72, 53], theme: 'amethyst' },
      { name: 'The Rusted Afternoon', extent: [309, 161, 70, 39], theme: 'ashen' },
    ],
    sites: [
      ['Lastlight Refuge', 3, 12],
      ['The Petrified Orchard', 7, 7],
      ['The Windless Well', 9, 16],
      ['The Sundial Watch', 12, 5],
      ['The Worn Escapement', 14, 12],
      ['The Unfinished Arcade', 17, 17],
      ['The Long Noon Camp', 19, 9],
      ['Shrine of Falling Sand', 23, 18],
      ['The Crooked Mile', 25, 6],
      ['The Saltflower Fold', 26, 13],
      ['The Clock Without Hands', 21, 5],
      ['The Stillwater Hour', 29, 12],
    ],
    foliage: 0.04,
  },
}

const ellipseDistance = (x: number, y: number, [cx, cy, rx, ry]: Ellipse) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2

function segmentDistanceSquared(x: number, y: number, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2
}

function nearChannel(x: number, y: number, channel: Channel) {
  for (let n = 1; n < channel.points.length; n++)
    if (
      segmentDistanceSquared(x, y, channel.points[n - 1]!, channel.points[n]!) <=
      channel.width ** 2
    )
      return true
  return false
}

const sitePoint = (site: Site): Point => [site[1] * GRID_WIDTH + 6, site[2] * GRID_HEIGHT + 4]

// A small authored tree of winding footpaths joins the focal places. No sector
// center, grid row or grid column receives an automatic stamped crossroad.
const paths = Object.fromEntries(
  VOID_REALMS.map(({ id }) => {
    const sites = definitions[id].sites.map(sitePoint)
    const segments: Channel[] = []
    for (let index = 1; index < sites.length; index++) {
      const end = sites[index]!
      let start = sites[0]!,
        nearest = Infinity
      for (const candidate of sites.slice(0, index)) {
        const distance = Math.hypot(end[0] - candidate[0], end[1] - candidate[1])
        if (distance < nearest) {
          nearest = distance
          start = candidate
        }
      }
      const dx = end[0] - start[0],
        dy = end[1] - start[1]
      const bend = (index % 2 ? 1 : -1) * Math.min(9, nearest * 0.16)
      segments.push({
        points: [
          start,
          [
            start[0] + dx * 0.35 - (dy / nearest) * bend,
            start[1] + dy * 0.35 + (dx / nearest) * bend,
          ],
          [
            start[0] + dx * 0.7 - (dy / nearest) * bend * 0.6,
            start[1] + dy * 0.7 + (dx / nearest) * bend * 0.6,
          ],
          end,
        ],
        width: 1.2,
      })
    }
    return [id, segments]
  }),
) as Record<VoidRealmId, Channel[]>

function macroTerrain(realmId: VoidRealmId, x: number, y: number): string {
  const definition = definitions[realmId]
  const seed = VOID_REALMS.findIndex((realm) => realm.id === realmId)
  if (x >= 416 || y >= 216) return supercontinentTerrain(x, y, seed)
  const scallop = 1 + Math.sin(x * 0.047 + y * 0.019) * 0.035 + Math.sin(y * 0.089) * 0.021
  if (
    !definition.coast.some((ellipse) => ellipseDistance(x, y, ellipse) < scallop) ||
    definition.bays?.some((ellipse) => ellipseDistance(x, y, ellipse) < 1)
  ) {
    // Add continental joins in the former outer sea only. Existing dry ground,
    // lakes, paths, sites and every saved legal cell retain their old terrain.
    if (x >= 378 || y >= 194) return supercontinentTerrain(x, y, seed)
    return '~'
  }
  if (definition.lava?.some((ellipse) => ellipseDistance(x, y, ellipse) < scallop)) return 'l'
  if (definition.lakes.some((ellipse) => ellipseDistance(x, y, ellipse) < scallop)) return '~'
  for (const channel of definition.channels)
    if (nearChannel(x, y, channel)) return channel.lava ? 'l' : '~'
  if (realmId === 'starfall-basin') {
    const rim = ellipseDistance(x, y, [214, 99, 94, 62])
    if (rim > 0.93 && rim < 1.06) return '#'
  }
  if (definition.cliffs.some((cliff) => nearChannel(x, y, cliff))) return '#'
  const grove = Math.sin(x * 0.033) * Math.cos(y * 0.051) + Math.sin((x + y) * 0.017)
  const leaves = ((x * 37 + y * 61) % 101) / 101
  return leaves < definition.foliage * (0.8 + grove * 0.18) ? 't' : '.'
}

function terrainAt(realmId: VoidRealmId, x: number, y: number): string {
  // The crater art occupies a dry, uninterrupted three-tile footprint. Its
  // center is (6.5,4.5) within sector16:10; the basin itself spans many sectors.
  if (realmId === 'starfall-basin' && x >= 213 && x <= 215 && y >= 93 && y <= 95) return '.'
  const definition = definitions[realmId]
  for (let index = 0; index < definition.sites.length; index++) {
    const point = sitePoint(definition.sites[index]!)
    if (Math.abs(x - point[0]) <= 2 && Math.abs(y - point[1]) <= 1) return index === 0 ? 's' : '.'
  }
  const terrain = macroTerrain(realmId, x, y)
  if (
    paths[realmId].some((path) => nearChannel(x, y, path)) ||
    definition.passages?.some((path) => nearChannel(x, y, path))
  )
    return terrain === '~' || terrain === 'l' ? '=' : '.'
  return terrain
}

function districtAt(realmId: VoidRealmId, x: number, y: number) {
  const districts = definitions[realmId].districts
  return districts.reduce(
    (nearest, candidate) =>
      ellipseDistance(x, y, candidate.extent) < ellipseDistance(x, y, nearest.extent)
        ? candidate
        : nearest,
    districts[0]!,
  )
}

export function voidRealmLanding(realmId: VoidRealmId): WorldPosition {
  const site = definitions[realmId]?.sites[0]
  if (!site) throw new RangeError('Unknown Void realm')
  return { sectorId: voidSectorId(realmId, site[1], site[2]), x: 6, y: 4 }
}

const kinds: readonly WorldLandmark['kind'][] = [
  'hamlet',
  'grove',
  'spring',
  'watchtower',
  'waystone',
  'ruin',
  'camp',
  'shrine',
  'waystone',
  'grove',
  'ruin',
  'spring',
]

// Fixed authored anchors on existing path crossings. These do not carve any
// terrain or perform a world scan. The bridge support regression verifies both
// liquid sides and dry walkable banks, including neighboring sector cells.
const realmBridges: Record<VoidRealmId, readonly [string, number, number, number, number]> = {
  'ivory-veil': ['The Silverroot Span', 12, 12, 12, 4],
  'amber-drowned': ['The Reedgold Crossing', 14, 6, 2, 2],
  'cinder-choir': ['The Blackglass Span', 8, 8, 4, 3],
  'glass-tides': ['The Tidesplit Bridge', 23, 7, 5, 5],
  'hollow-orchard': ['The Orchard Weir', 12, 11, 2, 2],
  'starfall-basin': ['The Outer Rim Bridge', 23, 6, 2, 7],
  'violet-estuary': ['The Three-River Span', 22, 9, 1, 1],
  'clockwound-waste': ['The Saltglass Crossing', 19, 8, 7, 7],
}

export function voidRealmScenery(sectorId: string): WorldWarpedScenery | undefined {
  const address = parseVoidSectorId(sectorId)
  if (!address) return
  const index = definitions[address.realmId].sites.findIndex(
    (site) => site[1] === address.column && site[2] === address.row,
  )
  // Six ordinary focal accents and one rare site per3072sector world. The
  // celestial/time accent is confined to its authored location, never scattered.
  if (index < 0 || index % 2 !== 0) return
  return index === 10
    ? { sheet: 'void-relics', index: address.realmId === 'clockwound-waste' ? 2 : 1, x: 9, y: 2 }
    : { sheet: index === 0 ? 'void-frontier' : 'void-dressing', index: (index / 2) % 4, x: 8, y: 2 }
}

// LRU retention is deliberately much smaller than one world. Importing this
// module authors96focal sites, eight bridges and88paths, constructing zero sectors.
const SECTOR_CACHE_LIMIT = 192
const sectorCache = new Map<string, WorldSector>()

export function resolveVoidSector(id: string): WorldSector | null {
  const address = parseVoidSectorId(id)
  if (!address) return null
  const cached = sectorCache.get(id)
  if (cached) {
    sectorCache.delete(id)
    sectorCache.set(id, cached)
    return cached
  }
  const { realmId, column, row } = address
  const originX = column * GRID_WIDTH,
    originY = row * GRID_HEIGHT
  const rows = Array.from({ length: GRID_HEIGHT }, (_, y) =>
    Array.from({ length: GRID_WIDTH }, (_, x) => terrainAt(realmId, originX + x, originY + y)).join(
      '',
    ),
  )
  const district = districtAt(realmId, originX + 6, originY + 4)
  const landmarks: WorldLandmark[] = definitions[realmId].sites.flatMap((site, index) => {
    if (site[1] !== column || site[2] !== row) return []
    return [
      {
        id: `${id}:site`,
        name: site[0],
        kind:
          index === 4 && (realmId === 'cinder-choir' || realmId === 'ivory-veil')
            ? 'spring'
            : kinds[index]!,
        x: 6,
        y: 4,
        ...(index === 4 && (realmId === 'cinder-choir' || realmId === 'ivory-veil')
          ? { sceneryIndex: 4 }
          : index % 3 === 1
            ? { sceneryIndex: 4 + (index % 5) }
            : { warpedArt: index === 0 ? 7 : index % 6 }),
      },
    ]
  })
  const bridge = realmBridges[realmId]
  if (bridge[1] === column && bridge[2] === row)
    landmarks.push({
      id: `${id}:bridge`,
      name: bridge[0],
      kind: 'bridge',
      x: bridge[3],
      y: bridge[4],
    })
  const roads: WorldSector['roads'][number][] = []
  const addCrossing = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    targetX: number,
    targetY: number,
  ) => {
    const targetColumn = column + dx,
      targetRow = row + dy
    if (
      targetColumn < 0 ||
      targetColumn >= VOID_REALM_COLUMNS ||
      targetRow < 0 ||
      targetRow >= VOID_REALM_ROWS ||
      !terrainWalkable(rows[y]![x]!) ||
      !terrainWalkable(
        terrainAt(realmId, targetColumn * GRID_WIDTH + targetX, targetRow * GRID_HEIGHT + targetY),
      )
    )
      return
    roads.push({
      from: { sectorId: id, x, y },
      to: { sectorId: voidSectorId(realmId, targetColumn, targetRow), x: targetX, y: targetY },
      durationMs: STEP_MS,
      name: 'Follow the passage',
    })
  }
  // All real dry cardinal neighbors connect. These are ordinary seam crossings,
  // not a painted road network or a portal through the surrounding sea.
  for (let y = 0; y < GRID_HEIGHT; y++) {
    addCrossing(0, y, -1, 0, 12, y)
    addCrossing(12, y, 1, 0, 0, y)
  }
  for (let x = 0; x < GRID_WIDTH; x++) {
    addCrossing(x, 0, 0, -1, x, 8)
    addCrossing(x, 8, 0, 1, x, 0)
  }
  const sector: WorldSector = {
    id,
    name: district.name,
    coordinate: 'Beyond the charts',
    regionId: `void-${realmId}`,
    art: null,
    east: column,
    north: row,
    sceneColumn: column,
    sceneRow: row,
    charted: false,
    warpedTheme: district.theme,
    landscape: district.landscape,
    rows,
    landmarks,
    roads,
  }
  sectorCache.set(id, sector)
  if (sectorCache.size > SECTOR_CACHE_LIMIT) sectorCache.delete(sectorCache.keys().next().value!)
  return sector
}
