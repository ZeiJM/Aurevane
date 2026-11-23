import Image from 'next/image'
import type { WorldNpcPresentation } from '@/world/types'
import styles from './workspace.module.css'

export function WorldNearbyNpc({
  npc,
  disabled,
  onTalk,
  onApproach,
}: {
  npc: WorldNpcPresentation
  disabled: boolean
  onTalk: ((opener: HTMLButtonElement) => void) | undefined
  onApproach: () => void
}) {
  return (
    <article className={styles.player} data-world-nearby-npc={npc.id}>
      {npc.imageUrl ? (
        <Image src={npc.imageUrl} alt="" width={36} height={36} unoptimized />
      ) : (
        <span className={styles.avatar} aria-hidden="true">
          {Array.from(npc.name)[0] ?? '?'}
        </span>
      )}
      <div className={styles.playerIdentity}>
        <strong title={npc.name}>{npc.name}</strong>
        <small>NPC</small>
      </div>
      <div className={styles.rowActions}>
        <button
          className={styles.primaryPlayerAction}
          type="button"
          disabled={disabled}
          aria-label={onTalk ? `Talk to ${npc.name}` : `Approach ${npc.name}`}
          onClick={(event) => (onTalk ? onTalk(event.currentTarget) : onApproach())}
        >
          {onTalk ? 'Talk' : 'Approach'}
        </button>
      </div>
    </article>
  )
}
