import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const key = query.get('key'),
    version = query.get('version')
  try {
    const resolver = createServerCombatContentResolver()
    if (key !== null || version !== null) {
      if (!key || !/^tag\.[a-z-]+$/u.test(key) || !version || !/^[1-9]\d*$/u.test(version))
        return Response.json(
          { error: 'Choose an exact Tag identity and version.' },
          { status: 400 },
        )
      const tag = await resolver.resolvePinnedTagPresentation!(key, Number(version))
      return tag
        ? Response.json(
            { tag: projectPublicCombat(tag) },
            { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
          )
        : Response.json({ error: 'This published Tag version is unavailable.' }, { status: 404 })
    }
    return Response.json(
      { tags: projectPublicCombat(await resolver.resolveCurrentTagPresentations!()) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json(
      { error: 'Tag presentation is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
