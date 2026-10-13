export type BattleReturnTo = 'world' | 'battle-hall'

/** A navigation preference, never encounter provenance or an arbitrary URL. */
export function parseBattleReturnTo(value: unknown): BattleReturnTo | undefined {
  return value === 'world' || value === 'battle-hall' ? value : undefined
}
export function battleSessionHref(id: string, returnTo?: BattleReturnTo): `/game/battle/${string}` {
  const preference = parseBattleReturnTo(returnTo)
  return `/game/battle/${id}${preference ? `?returnTo=${preference}` : ''}`
}
export function battleReturnNavigation(origin?: BattleReturnTo, returnTo?: BattleReturnTo) {
  const canonical = parseBattleReturnTo(origin)
  const world = (canonical ?? parseBattleReturnTo(returnTo) ?? 'battle-hall') === 'world'
  return {
    href: world ? ('/game/world' as const) : ('/game/battle' as const),
    eyebrow:
      canonical === 'world'
        ? 'World Encounter · PvP Result'
        : canonical === 'battle-hall'
          ? 'Battle Hall · PvP Result'
          : 'PvP Result',
    label: world ? 'Return to World' : 'Return to Battle Hall',
    location: world ? 'the world' : 'the hall',
  }
}
