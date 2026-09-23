import type { CharacterIdentityCardProps } from '@/components/character/character-identity-card'
import { CharacterIdentityCard } from '@/components/character/character-identity-card'
import { CharacterRailSynchronizedLayout } from '@/components/character/character-rail-synchronized-layout'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

import { BattleLaunch } from './battle-launch'
import styles from './battle-hall-shell.module.css'

interface BattleHallShellProps {
  identity: CharacterIdentityCardProps
  characterId: string
  characterName: string
  initialJoinKey?: string | null
}

export function BattleHallShell({
  identity,
  characterId,
  characterName,
  initialJoinKey = null,
}: BattleHallShellProps) {
  return (
    <AuthenticatedShellFrame sessionLabel="Battle Hall">
      <CharacterRailSynchronizedLayout
        className={styles.layout}
        data-battle-hall-workspace="true"
      >
        <CharacterIdentityCard {...identity} />
        <BattleLaunch
          characterId={characterId}
          characterName={characterName}
          initialJoinKey={initialJoinKey}
        />
      </CharacterRailSynchronizedLayout>
    </AuthenticatedShellFrame>
  )
}
