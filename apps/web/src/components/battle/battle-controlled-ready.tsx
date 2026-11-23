import styles from './battle-controlled-ready.module.css'

/** Captured prime and local release readiness stay distinct inside the existing image. */
export function BattleControlledReady({
  ready,
  primed = false,
  kind,
  canPrepare = false,
}: {
  ready: boolean
  primed?: boolean
  kind?: 'reversal'
  canPrepare?: boolean
}) {
  return (
    <>
      {ready && kind !== 'reversal' ? (
        <span className={styles.light} data-battle-controlled-ready="true" aria-hidden="true" />
      ) : null}
      {primed || (kind === 'reversal' && canPrepare) ? (
        <span className={styles.primed} data-battle-controlled-primed={primed || undefined}>
          {kind === 'reversal' ? (primed ? 'Cancel' : 'Prepare') : 'Primed'}
        </span>
      ) : null}
    </>
  )
}
