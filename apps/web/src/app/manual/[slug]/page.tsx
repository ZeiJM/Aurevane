import { notFound } from 'next/navigation'

import { DisciplineAtlasGuide } from '@/components/public-information/discipline-atlas-guide'
import { ManualArticle } from '@/components/public-information/manual-article'
import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { currentManualArticles, findCurrentManualArticle } from '@/content/current-manual'
import { createTechniquesManualArticle } from '@/content/techniques-manual'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { createServerCombatContentResolver } from '@/server/combat/combat-content-resolver'

// Current publications must be read at request time, rather than frozen into the build output.
export const dynamic = 'force-dynamic'

const DISCIPLINE_ATLAS_SLUG = 'disciplines-mastery'

export function generateStaticParams() {
  return [
    ...currentManualArticles.map((article) => ({ slug: article.slug })),
    { slug: DISCIPLINE_ATLAS_SLUG },
  ]
}

export default async function ManualArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (slug === DISCIPLINE_ATLAS_SLUG) {
    return (
      <PublicInformationShell active="manual">
        <DisciplineAtlasGuide />
      </PublicInformationShell>
    )
  }

  let article = findCurrentManualArticle(slug)
  if (!article) {
    notFound()
  }
  if (slug === 'techniques-damage-effects') {
    const resolver = createServerCombatContentResolver()
    if (!resolver.resolveCurrentCatalogue) throw new Error('Current combat catalogue unavailable.')
    const catalogue = await resolver.resolveCurrentCatalogue()
    article = createTechniquesManualArticle({
      skills: catalogue.entries.flatMap((entry) =>
        entry.category === 'skill' ? [projectPublicCombat(entry.definition)] : [],
      ),
      basics: catalogue.entries.flatMap((entry) =>
        entry.category === 'basic' ? [projectPublicCombat(entry.definition)] : [],
      ),
      timingPolicy: catalogue.policy,
    })
  }

  return (
    <PublicInformationShell active="manual">
      <ManualArticle
        category={article.category}
        title={article.title}
        summary={article.summary}
        lastUpdated={article.lastUpdated}
        rulesVersion={article.rulesVersion}
        body={article.body}
      />
    </PublicInformationShell>
  )
}
