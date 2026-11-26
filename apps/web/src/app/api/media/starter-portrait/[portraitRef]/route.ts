import { illustratedStarterPortrait } from '@/appearance/appearance-starter-gallery'

interface RouteContext {
  params: Promise<{ portraitRef: string }>
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
}

export async function GET(request: Request, context: RouteContext) {
  const { portraitRef } = await context.params
  const source = illustratedStarterPortrait(portraitRef)?.manifest.portraits.neutral
  if (!source) return new Response(null, { status: 404, headers: CACHE_HEADERS })

  return new Response(null, {
    status: 307,
    headers: { ...CACHE_HEADERS, Location: new URL(source, request.url).toString() },
  })
}
