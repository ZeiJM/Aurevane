import type { Metadata, Route } from 'next'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { currentManualArticles } from '@/content/current-manual'
import type { ImageAssetId } from '@/media/registry'

import { ManualIndexDirectory, type ManualIndexEntry } from './manual-index-directory'

export const metadata: Metadata = {
  title: 'Adventurer’s Guide | AUREVANE',
  description: 'The spoiler-safe public guide to AUREVANE’s current playable and testable systems.',
}

function assetForCategory(category: string): ImageAssetId {
  switch (category) {
    case 'Character':
      return 'environment.character-creation.threshold'
    case 'Progression':
      return 'environment.passive-training.cloister'
    case 'Combat':
      return 'environment.battle-hall.courtyard'
    case 'Orientation':
      return 'ui.foundation.vista'
    default:
      return 'environment.archive.interior'
  }
}

const manualIndexEntries: readonly ManualIndexEntry[] = [
  {
    id: 'manual.disciplines-mastery',
    href: '/manual/disciplines-mastery' as Route,
    title: 'Disciplines, Atlas & Mastery',
    summary:
      'The full 36-Discipline map, mastery stages, class-budget philosophy, Rekindling gates, secret paths, pure versus mixed builds, and the temporary Phase-4 testing rule.',
    category: 'Character',
    lastUpdated: '2026-09-12',
    assetId: 'environment.character-creation.threshold',
  },
  ...currentManualArticles.map((article) => ({
    id: article.id,
    href: `/manual/${article.slug}` as Route,
    title: article.title,
    summary: article.summary,
    category: article.category,
    lastUpdated: article.lastUpdated,
    assetId: assetForCategory(article.category),
  })),
]

export default function ManualPage() {
  return (
    <PublicInformationShell active="manual">
      <ManualIndexDirectory entries={manualIndexEntries} />
    </PublicInformationShell>
  )
}
