import { DISCIPLINE_ATLAS } from '@aurevane/game-core/character/discipline-atlas'

/** Published names win, including renamed builtins. Unknown identities never become UUID prose. */
export function readableDisciplineName(
  id: string | null,
  publishedName?: string | null,
): string | null {
  if (!id) return null
  return (
    publishedName?.trim() ||
    DISCIPLINE_ATLAS.find((row) => row.id === id)?.name ||
    'Unknown Discipline'
  )
}
