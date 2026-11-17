import type { WorldAtlasCell } from '@/world/types'
import { positionLabel } from '@/world/coordinate-label'
import styles from './workspace.module.css'

interface Props {
  destination: WorldAtlasCell
  disabled: boolean
  reviewing: boolean
  replacesRoute: boolean
  onReview: () => void
  onConfirm: () => void
  onCancel: () => void
  onClear: () => void
}

export function WorldDestinationCard({
  destination,
  disabled,
  reviewing,
  replacesRoute,
  onReview,
  onConfirm,
  onCancel,
  onClear,
}: Props) {
  return (
    <section className={styles.destination} aria-label="Selected destination">
      <header className={styles.destinationHeader}>
        <div>
          <small>DESTINATION</small>
          <h2>{destination.name}</h2>
        </div>
        <button
          type="button"
          className={styles.destinationClose}
          aria-label="Clear destination"
          onClick={onClear}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="m5 5 10 10M15 5 5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <p className={styles.destinationCoordinates}>{positionLabel(destination, { x: 6, y: 4 })}</p>
      {reviewing ? (
        <div
          className={styles.travelReview}
          role="group"
          aria-label="Confirm world travel"
          id="world-travel-review"
        >
          <p id="world-travel-review-copy" role="status">
            {replacesRoute
              ? 'This journey will replace your current route.'
              : 'Ready to travel to this destination?'}
          </p>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className={styles.primary}
        disabled={disabled}
        aria-expanded={reviewing}
        aria-controls={reviewing ? 'world-travel-review' : undefined}
        aria-describedby={reviewing ? 'world-travel-review-copy' : undefined}
        onClick={reviewing ? onConfirm : onReview}
      >
        {reviewing ? 'Confirm travel' : 'Travel here'}
      </button>
    </section>
  )
}
