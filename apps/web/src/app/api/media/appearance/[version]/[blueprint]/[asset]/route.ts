import { appearanceBlueprintFromId, isAppearanceAsset } from '@/appearance/appearance-manifest'
import { renderAppearanceAsset } from '@/appearance/appearance-svg'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ version: string; blueprint: string; asset: string }> },
) {
  const { version, blueprint: id, asset: filename } = await params
  const blueprint = appearanceBlueprintFromId(id, version)
  const asset = filename.endsWith('.svg') ? filename.slice(0, -4) : ''
  if (!blueprint || !isAppearanceAsset(asset)) return new Response(null, { status: 404 })

  return new Response(renderAppearanceAsset(blueprint, asset), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; img-src data:; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
