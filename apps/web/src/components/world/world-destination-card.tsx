import type { WorldAtlasCell, WorldPosition } from '@/world/types'
import { positionLabel } from '@/world/coordinate-label'
import { worldTravelDestination } from './world-travel-points'
import styles from './workspace.module.css'

interface Props {
  destination: WorldAtlasCell
  arrival?: WorldPosition
  disabled: boolean
  reviewing: boolean
  replacesRoute: boolean
  favorite?: boolean
  onToggleFavorite?: () => void
  onReview: () => void
  onConfirm: () => void
  onCancel: () => void
  onClear: () => void
}

export function WorldDestinationCard({
  destination,
  arrival,
  disabled,
  reviewing,
  replacesRoute,
  favorite,
  onToggleFavorite,
  onReview,
  onConfirm,
  onCancel,
  onClear,
}: Props) {
  return (
    <section className={styles.destination} aria-label="Selected destination">
      <header className={styles.destinationHeader}>
        <div>
          <h2>{destination.name}</h2>
        </div>
        <div className={styles.destinationTools}>
          {onToggleFavorite ? (
            <button
              type="button"
              className={styles.destinationClose}
              aria-label="Favorite sector"
              aria-pressed={favorite ?? false}
              title={favorite ? 'Remove favorite' : 'Set favorite'}
              onClick={onToggleFavorite}
            >
              <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
            </button>
          ) : null}
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
        </div>
      </header>
      <p className={styles.destinationCoordinates}>
        {positionLabel(destination, arrival ?? worldTravelDestination(destination.id))}
      </p>
      <div
        className={styles.destinationActions}
        role={reviewing ? 'group' : undefined}
        aria-label={reviewing ? 'Confirm world travel' : undefined}
      >
        {reviewing && replacesRoute ? (
          <p id="world-travel-review-copy" role="status">
            This journey will replace your current route.
          </p>
        ) : null}
        <button
          type="button"
          className={`${styles.primary} ${reviewing ? styles.confirmTravel : styles.reviewTravel}`}
          disabled={disabled}
          aria-expanded={reviewing}
          aria-describedby={reviewing && replacesRoute ? 'world-travel-review-copy' : undefined}
          onClick={reviewing ? onConfirm : onReview}
        >
          {reviewing ? 'Confirm travel' : 'Travel here'}
        </button>
        {reviewing ? (
          <button type="button" className={styles.cancelTravel} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  )
}
