import 'server-only'
import { createHash } from 'node:crypto'
import { isWorldAtlasToken, type WorldAtlasScene } from '@/world/presence'
import type { WorldView } from '@/world/types'

/** Compare only after the normal owned read and its current discovery projection. */
export function worldAtlasReceipt(
  view: WorldView,
  known: string | null,
): WorldView | WorldAtlasScene {
  const owner = `${view.characterId}:`
  if (!known?.startsWith(owner) || !view.atlas) return view
  const token = known.slice(owner.length)
  if (token !== 'full' && !isWorldAtlasToken(token)) return view
  const { atlas, ...scene } = view
  const atlasToken = createHash('sha256')
    .update('world-atlas-v1\0')
    .update(owner)
    .update(JSON.stringify(atlas))
    .digest('hex')
  return token === atlasToken ? { ...scene, kind: 'scene', atlasToken } : { ...view, atlasToken }
}
