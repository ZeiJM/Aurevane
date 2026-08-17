import { notFound } from 'next/navigation'

import { PublicArticle } from '@/components/public-information/public-article'
import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { findManualArticle, manualArticles } from '@/content/public-information'

export function generateStaticParams() {
  return manualArticles.map((article) => ({ slug: article.slug }))
}

export default async function ManualArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = findManualArticle(slug)

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
