import Image from 'next/image'
import type { WorldPlayer, WorldPosition } from '@/world/types'
import styles from './workspace.module.css'

export interface WorldNearbyPlayerProps {
  player: WorldPlayer
  ownerPosition: WorldPosition
  disabled: boolean
  approaching: boolean
  attacking: boolean
  onApproach: () => void
  onAttack: () => void
  selected: boolean
}

export function WorldNearbyPlayer({
  player,
  ownerPosition,
  disabled,
  approaching,
  attacking,
  onApproach,
  onAttack,
  selected,
}: WorldNearbyPlayerProps) {
  // Range follows the approved position; animated travel never grants attack authority.
  const inRange =
    player.position.sectorId === ownerPosition.sectorId &&
    Math.abs(player.position.x - ownerPosition.x) + Math.abs(player.position.y - ownerPosition.y) <=
      1
  const showAttack = inRange || approaching || attacking
  const primaryDisabled =
    disabled ||
    attacking ||
    (showAttack && (!inRange || !(player.attackEligible ?? player.attackable)))
  return (
    <article
      className={`${styles.player} ${selected ? styles.selected : ''}`}
      data-world-player={player.characterId}
    >
      {player.imageUrl ? (
        <Image src={player.imageUrl} alt="" width={36} height={36} unoptimized />
      ) : (
        <span className={styles.avatar} aria-hidden="true">
          {Array.from(player.name)[0] ?? '?'}
        </span>
      )}
      <div className={styles.playerIdentity}>
        <strong>{player.name}</strong>
        <small>
          Level {player.level}
          {player.online ? ' · Online' : ''}
        </small>
      </div>
      <div className={styles.rowActions} data-world-player-actions>
        <button className={styles.secondaryPlayerAction} type="button" disabled title="Coming soon">
          {player.entityKind === 'ai' ? 'Interact' : 'Talk'}
        </button>
        <button
          className={styles.primaryPlayerAction}
          type="button"
          data-world-primary-action={showAttack ? 'attack' : 'approach'}
          disabled={primaryDisabled}
          aria-busy={attacking || undefined}
          onClick={primaryDisabled ? undefined : showAttack ? onAttack : onApproach}
        >
          {showAttack ? 'Attack' : 'Approach'}
        </button>
      </div>
    </article>
  )
}
