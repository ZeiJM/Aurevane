import { notFound } from 'next/navigation'

import { PvpSpectatorExperience } from '@/components/battle/pvp-spectator-experience'
import { getPvpSpectatorView } from '@/server/battle/pvp-lobby-service'

export const dynamic = 'force-dynamic'

export default async function MobileSpectatorDiagnosticPage({
  params,
}: {
  params: Promise<{ battleKey: string }>
}) {
  if (process.env.AUREVANE_ENV !== 'local') notFound()

  const { battleKey } = await params
  const spectator = await getPvpSpectatorView(battleKey)
  if (!spectator) notFound()

  return (
    <PvpSpectatorExperience
      initialSpectator={spectator}
      initialParticipantTitles={{}}
    />
  )
}
