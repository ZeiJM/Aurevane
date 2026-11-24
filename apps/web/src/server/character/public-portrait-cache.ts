import 'server-only'
import { loadPublicCharacterProfileImageMap } from './character-profile-display-service'

const ttlMs = 30_000
const limit = 2048
type Entry = { expiresAt: number; url: Promise<string | undefined> }
const cache = new Map<string, Entry>()

/** Only supply character IDs already selected by authenticated scene or presence authority. */
export async function publicPeerPortraits(ids: readonly string[]) {
  const now = Date.now()
  const selected = new Map<string, Entry>()
  const missing: string[] = []
  for (const id of new Set(ids)) {
    const entry = cache.get(id)
    if (entry && now < entry.expiresAt) {
      cache.delete(id)
      cache.set(id, entry)
      selected.set(id, entry)
    } else {
      missing.push(id)
    }
  }
  if (missing.length) {
    const batch = loadPublicCharacterProfileImageMap(missing)
    for (const id of missing) {
      const entry: Entry = {
        expiresAt: now + ttlMs,
        url: batch.then(
          (images) => images.get(id),
          () => {
            if (cache.get(id) === entry) cache.delete(id)
            return undefined
          },
        ),
      }
      cache.delete(id)
      cache.set(id, entry)
      selected.set(id, entry)
    }
    while (cache.size > limit) cache.delete(cache.keys().next().value!)
  }
  return new Map(
    await Promise.all([...selected].map(async ([id, entry]) => [id, await entry.url] as const)),
  )
}

export function invalidatePublicPeerPortrait(id: string) {
  cache.delete(id)
}

export function resetPublicPeerPortraits() {
  cache.clear()
}
