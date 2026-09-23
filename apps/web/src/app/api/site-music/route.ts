import { readSiteMusicConfig } from '@/server/music/site-music-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await readSiteMusicConfig()
  return Response.json(
    { config },
    {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    },
  )
}
