import styles from './loading.module.css'

export default function GameRouteLoading() {
  return (
    <div
      className={styles.page}
      role="status"
      aria-live="polite"
      aria-label="Loading game page"
      data-testid="game-route-loading"
    >
      <header className={styles.header}>
        <span className={styles.crest} aria-hidden="true">
          <i>A</i>
        </span>
        <span className={styles.brand}>
          <strong>AUREVANE</strong>
          <small>Persistent tactical fantasy</small>
        </span>
        <span className={styles.routeState}>Preparing route</span>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>Wayfinding</span>
          <h1>Opening your next view</h1>
          <p>Synchronizing your character and current session…</p>
          <div className={styles.progress} aria-hidden="true">
            <span />
          </div>
          <div className={styles.skeleton} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Account route</span>
        <strong>
          <i aria-hidden="true" /> Loading
        </strong>
      </footer>
    </div>
  )
}
