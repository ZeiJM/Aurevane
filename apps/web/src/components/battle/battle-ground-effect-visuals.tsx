import {
  groundEffectVisual,
  type GroundEffectVisualId,
} from '@aurevane/game-core/combat/combat-ground-visuals'
import { BattleEffectIcon } from './battle-effect-icon'

const paths: Readonly<Record<string, string>> = {
  pierce: 'M3 21 18 3l3-1-1 4L5 23ZM7 3h10v4M7 9V3M5 11l8 8M14 11l6 6',
  'hp-recovery': 'M8 2h8v5h5v8h-5v5H8v-5H3V7h5ZM18 22l4-4M18 18h4v4',
  cleanse: 'M4 18 17 3l4 4L8 22H3ZM4 4h6M7 1v6M17 17l2 2 4-5',
  dispel: 'M4 18 17 3l4 4L8 22H3ZM16 18h7M19 15v6',
  'conditional-cleanse': 'M4 18 17 3l4 4L8 22H3ZM19 14a3 3 0 0 1 0 6M19 23h.1',
  reveal:
    'M2 14c5-7 15-7 20 0-5 7-15 7-20 0ZM14 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 2v4M5 4l2 3M19 4l-2 3',
  summoned:
    'M3 18a9 5 0 1 0 18 0 9 5 0 1 0-18 0ZM7 16V8a5 5 0 0 1 10 0v8l-3-2-2 2-2-2ZM10 7h.1M14 7h.1',
}
export function GroundEffectIcon({ id }: { id: GroundEffectVisualId }) {
  const visual = groundEffectVisual(id)
  const path = paths[visual?.iconId ?? id]
  return path ? (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  ) : (
    <BattleEffectIcon statusId={visual?.iconId ?? id} fallback="?" />
  )
}
