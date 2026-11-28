import { contentMediaKeySource } from '@aurevane/game-core/combat/content-media'

// Replace these exact published uploads for the art refresh. Later uploads
// keep their own identities, and the finalized media routes remain immutable.
const refreshedArtwork: ReadonlyMap<string, string> = new Map([
  [
    '/api/content-media/f63abd95-14eb-4da5-8e89-131d0d2d4d68',
    '/media/art/discipline-sigils/warrior-lineage-anime-v01.webp',
  ],
  [
    '/api/content-media/e86b3a5c-a6e6-4283-84a7-49271bbde89e',
    '/media/art/discipline-skills/crimson-ignition-anime-v01.webp',
  ],
  [
    '/api/content-media/40bc394f-a924-43b4-9b0d-dbc3f136192b',
    '/media/art/discipline-skills/celestial-sphere-anime-v01.webp',
  ],
  [
    '/api/content-media/b55353ac-eeaf-402d-824f-8d8e30f46a59',
    '/media/art/discipline-skills/space-fold-anime-v01.webp',
  ],
  [
    '/api/content-media/f6ba91b3-6887-4197-8cc6-22f0aa48361b',
    '/media/art/resonances/silver-instinct-anime-v01.webp',
  ],
  [
    '/api/content-media/777136d0-b986-4cd7-8806-c131b9a8d175',
    '/media/art/essence-skills/cobalt-beam-anime-v01.webp',
  ],
])

export function publishedContentArtwork(iconKey?: string | null): string | null {
  const source = contentMediaKeySource(iconKey)
  return source ? (refreshedArtwork.get(source) ?? source) : null
}
