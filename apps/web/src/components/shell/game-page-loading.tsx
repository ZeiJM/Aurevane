import styles from '@/components/shell/authenticated-game-shell.module.css'

export default function GamePageLoading() {
  return (
    <p className={styles.routeLoading} role="status">
      Opening page…
    </p>
  )
}
