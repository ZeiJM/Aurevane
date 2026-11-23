import { readSiteMusicConfig } from '@/server/music/site-music-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await readSiteMusicConfig()
  return Response.json(
    {
      config: {
        enabled: config.enabled,
        defaultTrack: config.defaultTrack,
        routeOverrides: config.routeOverrides,
        revision: config.revision,
        updatedAt: config.updatedAt,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    },
  )
}
