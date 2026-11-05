export type ItemGrantCharacter = Readonly<{ characterId: string; name: string }>
export type ItemGrantTarget = Readonly<{
  target: ItemGrantCharacter
  revision: number
  catalogueToken: string
  battleLocked: boolean
}>
export type ItemGrantRequest =
  | Readonly<{ action: 'search'; query: string }>
  | Readonly<{ action: 'read'; characterId: string }>
  | Readonly<{
      action: 'grant'
      characterId: string
      itemId: string
      quantity: number
      expectedRevision: number
      catalogueToken: string
      requestId: string
    }>
export type ItemGrantSearchResult = Readonly<{ characters: readonly ItemGrantCharacter[] }>
export type ItemGrantResult = Readonly<{ target: ItemGrantCharacter; revision: number }>
