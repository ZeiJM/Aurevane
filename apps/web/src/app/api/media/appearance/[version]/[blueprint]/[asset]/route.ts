import { isActivePaintedAppearance } from '@/appearance/appearance-active-catalog'
import { appearanceBlueprintFromId, isAppearanceAsset } from '@/appearance/appearance-manifest'
import { renderAppearanceAsset } from '@/appearance/appearance-svg'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ version: string; blueprint: string; asset: string }> },
) {
  const { version, blueprint: id, asset: filename } = await params
  const blueprint = appearanceBlueprintFromId(id, version)
  const illustrated = filename.startsWith('illustrated-')
  const asset = filename.endsWith('.svg') ? filename.slice(illustrated ? 12 : 0, -4) : ''
  if (illustrated && blueprint?.v !== 6) return new Response(null, { status: 404 })
  if (!blueprint || !isAppearanceAsset(asset)) return new Response(null, { status: 404 })

  return new Response(
    renderAppearanceAsset(blueprint, asset, illustrated || isActivePaintedAppearance(blueprint)),
    {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; img-src data:; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}
