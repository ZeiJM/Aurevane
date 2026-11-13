/** Public realm identities. Private geography is resolved exclusively on the server. */
export const VOID_REALMS = [
  {
    id: 'ivory-veil',
    name: 'The Inverted Reach',
    summary: 'Pale wooded uplands and silver lakes rest beneath an unfamiliar horizon.',
  },
  {
    id: 'amber-drowned',
    name: 'The Drowned Meridian',
    summary: 'Orange lagoons swallow old embankments between banks of gold reeds.',
  },
  {
    id: 'cinder-choir',
    name: 'The Ruined Sun',
    summary: 'Black escarpments gather around glowing hollows and rivers of molten gold.',
  },
  {
    id: 'glass-tides',
    name: 'The Shattered Horizon',
    summary: 'Glassy islands and broken tidal shelves divide the violet sea.',
  },
  {
    id: 'hollow-orchard',
    name: 'The Unremembered Orchard',
    summary: 'An immense wooded hollow shelters orchards whose keepers have gone.',
  },
  {
    id: 'starfall-basin',
    name: 'The Fallen Firmament',
    summary: 'A silent celestial depression lies within fractured terraces and quiet tarns.',
  },
  {
    id: 'violet-estuary',
    name: 'The Violet Recess',
    summary: 'Three wandering rivers carry violet reflections through flowering floodplains.',
  },
  {
    id: 'clockwound-waste',
    name: 'The Hourless Waste',
    summary: 'Wind-carved mesas and salt mirrors surround ruins with weatherless shadows.',
  },
] as const

export type VoidRealmId = (typeof VOID_REALMS)[number]['id']
export const VOID_REALM_COLUMNS = 64
export const VOID_REALM_ROWS = 48
export interface VoidSectorAddress {
  realmId: VoidRealmId
  column: number
  row: number
}

export function isVoidRealmId(id: string): id is VoidRealmId {
  return VOID_REALMS.some((realm) => realm.id === id)
}

export function parseVoidSectorId(id: string): VoidSectorAddress | null {
  const match = /^void:([a-z]+(?:-[a-z]+)*):(0|[1-9][0-9]?):(0|[1-9][0-9]?)$/.exec(id)
  if (!match || match[0] !== id || !isVoidRealmId(match[1]!)) return null
  const column = Number(match[2]),
    row = Number(match[3])
  if (column >= VOID_REALM_COLUMNS || row >= VOID_REALM_ROWS) return null
  return { realmId: match[1]!, column, row }
}

export const isVoidRealmSectorId = (id: string) => parseVoidSectorId(id) !== null

export function voidSectorId(realmId: VoidRealmId, column: number, row: number): string {
  if (
    !isVoidRealmId(realmId) ||
    !Number.isInteger(column) ||
    !Number.isInteger(row) ||
    column < 0 ||
    column >= VOID_REALM_COLUMNS ||
    row < 0 ||
    row >= VOID_REALM_ROWS
  )
    throw new RangeError('Invalid Void sector address')
  return `void:${realmId}:${column}:${row}`
}
