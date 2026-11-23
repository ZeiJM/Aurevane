export function BattleRoundBadge({ round }: { round?: number | null }) {
  const recordedRound = typeof round === 'number' && Number.isSafeInteger(round) && round >= 0
  const label = recordedRound ? `Current battle round ${round}` : 'Current battle round unavailable'

  return (
    <span
      role="status"
      data-battle-round-badge="true"
      data-battle-round={recordedRound ? round : 'unavailable'}
      aria-label={label}
      title={label}
      aria-live="polite"
      aria-atomic="true"
    >
      <span aria-hidden="true">Round</span>
      <b aria-hidden="true">{recordedRound ? round : '—'}</b>
    </span>
  )
}
