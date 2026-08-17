import { notFound } from 'next/navigation'

import { PublicArticle } from '@/components/public-information/public-article'
import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { findNewsArticle, newsArticles } from '@/content/public-information'

export function generateStaticParams() {
  return newsArticles.map((article) => ({ slug: article.slug }))
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = findNewsArticle(slug)

  if (!article) {
    notFound()
  }

  return (
    <PublicInformationShell active="news">
      <PublicArticle
        category={article.category}
        title={article.title}
        summary={article.summary}
        lastUpdated={article.lastUpdated}
        body={article.body}
        backHref="/news"
        backLabel="All News"
      />
    </PublicInformationShell>
  )
}
