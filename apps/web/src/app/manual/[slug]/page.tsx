import { notFound } from 'next/navigation'

import { DisciplineAtlasGuide } from '@/components/public-information/discipline-atlas-guide'
import { PublicArticle } from '@/components/public-information/public-article'
import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { currentManualArticles, findCurrentManualArticle } from '@/content/current-manual'

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

  const article = findCurrentManualArticle(slug)
  if (!article) {
    notFound()
  }

  return (
    <PublicInformationShell active="manual">
      <PublicArticle
        category={article.category}
        title={article.title}
        summary={article.summary}
        lastUpdated={article.lastUpdated}
        rulesVersion={article.rulesVersion}
        body={article.body}
        backHref="/manual"
        backLabel="Adventurer’s Guide"
      />
    </PublicInformationShell>
  )
}
