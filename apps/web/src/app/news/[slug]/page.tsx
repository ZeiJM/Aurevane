import { notFound } from 'next/navigation'

import { NewsArticle as NewsArticleView } from '@/components/public-information/news-article'
import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { findNewsArticle, type NewsArticle as NewsArticleRecord } from '@/content/public-information'

const NEWS_ARTICLE_LAYOUT_PREVIEW: NewsArticleRecord = {
  id: 'news.layout-preview',
  slug: '__layout-preview',
  title: 'News Article Layout Preview',
  summary: 'A local-only composition fixture for the unpublished AUREVANE News article template.',
  category: 'Layout preview',
  publishedAt: '2026-09-16',
  lastUpdated: '2026-09-16',
  body: [
    {
      id: 'editorial-layout',
      title: 'Editorial layout',
      paragraphs: [
        'This preview exists only in the local verification environment. It proves the article hierarchy, scenic media treatment, readable prose width, and natural document scrolling without publishing a News post.',
        'Real News articles continue to come only from the source-controlled published News collection.',
      ],
    },
    {
      id: 'public-resources',
      title: 'Public resources',
      paragraphs: [
        'The article keeps direct paths back to News and onward to the Manual and Rules without changing authentication, session handling, or private game state.',
      ],
    },
  ],
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article =
    slug === NEWS_ARTICLE_LAYOUT_PREVIEW.slug && process.env.AUREVANE_ENV === 'local'
      ? NEWS_ARTICLE_LAYOUT_PREVIEW
      : findNewsArticle(slug)

  if (!article) {
    notFound()
  }

  return (
    <PublicInformationShell active="news">
      <NewsArticleView article={article} />
    </PublicInformationShell>
  )
}
