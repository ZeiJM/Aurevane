import styles from './battle-controlled-ready.module.css'

/** Captured prime and local release readiness stay distinct inside the existing image. */
export function BattleControlledReady({
  ready,
  primed = false,
}: {
  ready: boolean
  primed?: boolean
}) {
  return (
    <>
      {ready ? (
        <span className={styles.light} data-battle-controlled-ready="true" aria-hidden="true" />
      ) : null}
      {primed ? (
        <span className={styles.primed} data-battle-controlled-primed="true">
          Primed
        </span>
      ) : null}
    </>
  )
}
