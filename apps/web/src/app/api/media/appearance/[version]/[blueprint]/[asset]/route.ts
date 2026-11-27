import { authoredAppearanceSource } from '@/appearance/appearance-authored-catalog'
import { hasOriginalFeaturedArt } from '@/appearance/appearance-featured-variants'
import { appearanceBlueprintFromId, isAppearanceAsset } from '@/appearance/appearance-manifest'
import { renderAppearanceAsset } from '@/appearance/appearance-svg'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ version: string; blueprint: string; asset: string }> },
) {
  const { version, blueprint: id, asset: filename } = await params
  const blueprint = appearanceBlueprintFromId(id, version)
  if (blueprint?.v === 7) {
    const asset = /^(neutral|happy|angry|sad|surprised|icon)\.svg$/.exec(filename)?.[1]
    if (!asset) return new Response(null, { status: 404 })
    return new Response(null, {
      status: 307,
      headers: {
        Location: `${authoredAppearanceSource(blueprint)}/${asset}.webp`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
  const illustrated = filename.startsWith('illustrated-')
  const posed = filename.startsWith('illustrated-posed-')
  const prefixLength = posed ? 'illustrated-posed-'.length : illustrated ? 'illustrated-'.length : 0
  const asset = filename.endsWith('.svg') ? filename.slice(prefixLength, -4) : ''
  if (posed && asset !== 'icon' && ['atlas', 'motion', 'motion-v2', 'motion-v3'].includes(asset))
    return new Response(null, { status: 404 })
  if ((illustrated || asset === 'motion-v3') && blueprint?.v !== 6)
    return new Response(null, { status: 404 })
  if (!blueprint || !isAppearanceAsset(asset)) return new Response(null, { status: 404 })

  return new Response(
    renderAppearanceAsset(
      blueprint,
      asset,
      illustrated || (blueprint.v === 6 && hasOriginalFeaturedArt(blueprint)),
      posed || filename === 'neutral.svg',
    ),
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
