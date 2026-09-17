import type { Metadata } from 'next'

import { PublicInformationShell } from '@/components/public-information/public-information-shell'
import { RulesCodex } from '@/components/public-information/rules-codex'

export const metadata: Metadata = {
  title: 'Rules | AUREVANE',
  description: 'Current AUREVANE fair-play, account-security, and conduct rules.',
}

export default function RulesPage() {
  return (
    <PublicInformationShell active="rules">
      <RulesCodex />
    </PublicInformationShell>
  )
}
