import { isStarterCharacterPortraitRef } from '@aurevane/game-core/character/starter-options'

import { getStarterPortraitImageAssetId } from '@/media/character'
import { getImageAsset } from '@/media/registry'

interface RouteContext {
  params: Promise<{ portraitRef: string }>
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
}

export async function GET(request: Request, context: RouteContext) {
  const { portraitRef } = await context.params
  if (!isStarterCharacterPortraitRef(portraitRef)) {
    return new Response(null, { status: 404, headers: CACHE_HEADERS })
  }

  const source = getImageAsset(getStarterPortraitImageAssetId(portraitRef)).src
  if (!source) return new Response(null, { status: 404, headers: CACHE_HEADERS })

  const prefix = 'data:image/webp;base64,'
  if (source.startsWith(prefix)) {
    const bytes = Uint8Array.from(Buffer.from(source.slice(prefix.length), 'base64'))
    return new Response(bytes, {
      headers: {
        ...CACHE_HEADERS,
        'Content-Type': 'image/webp',
      },
    })
  }

  if (source.startsWith('/')) {
    return Response.redirect(new URL(source, request.url), 307)
  }

  return new Response(null, { status: 404, headers: CACHE_HEADERS })
}
