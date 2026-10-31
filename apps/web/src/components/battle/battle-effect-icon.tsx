/** Original rail pictograms convey identity only; captured reports own every rule.
 * Shared 24px canvas, with color inherited from the existing state palette. */
const effectPaths: Readonly<Record<string, string>> = {
  reversal: 'M3 8h12a5 5 0 0 1 0 10h-3M3 8l5-5M3 8l5 5M6 21 18 9l3-1-1 3L8 23M4 18l6 5',
  'reversal-strain': 'M4 3l7 7-3 3-6-7ZM14 13l7 7M17 19l3-3M11 9l3-3M9 15l-3 3M14 3h7v6M18 3v3l3 3',
  endure:
    'M4 5l8-3 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10ZM9 7h6M9 17h6M9 7c0 5 6 5 6 10M15 7c0 5-6 5-6 10',
  'weak-point': 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM13 5l-3 6 4 2-3 6M2 3l4 4M18 17l4 4',
  spike: 'M12 2 14 9 21 5 17 12 22 17 15 16 12 22 9 16 2 17 7 12 3 5 10 9Z',
  ruin: 'M3 7l4-4 4 4-4 4ZM13 17l4-4 4 4-4 4ZM9 10l5 5M2 16l4 4M2 20l4-4M17 2v6M14 5h6',
  counter: 'M4 9a8 8 0 0 1 14-4l2 3M20 3v5h-5M7 11l5-2 5 2v4c0 3-3 5-5 6-2-1-5-3-5-6Z',
  burn: 'M13 2c1 6 7 8 7 13a8 8 0 0 1-16 0c0-3 2-6 4-8 0 4 2 5 3 5 2-3 2-6 2-10ZM12 15c-3 3-3 5 0 6 3-1 3-3 0-6Z',
  bleed: 'M10 3C8 7 4 11 4 15a6 6 0 0 0 12 0c0-4-4-8-6-12ZM18 4l3 4M18 11h4',
  poison: 'M5 14a8 8 0 1 1 14 0l-2 2v5H7v-5ZM8 10h1M15 10h1M10 17v4M14 17v4',
  wet: 'M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13ZM8 15a4 4 0 0 0 4 4',
  frozen:
    'M12 3v18M4 7l16 10M4 17 20 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1V5M20 14l-4 1v4M4 14l4 1v4M20 10l-4-1V5',
  conductive: 'M14 2 6 13h6l-2 9 8-12h-6ZM2 5h3M19 19h3',
  inspired: 'M7 20 17 5l3-2v4L10 22ZM5 16l7 5M3 7h6M6 4v6M16 15h6M19 12v6',
  hexed: 'M12 21 4 13C-2 6 7 1 12 7c5-6 14-1 8 6ZM4 3l17 18M10 11h4M12 9v6',
  suppress: 'M4 4h16M12 6v14M6 14l6 6 6-6M3 8h4M17 8h4',
  invisible: 'M6 21V9a6 6 0 0 1 12 0v12l-3-2-3 2-3-2ZM9 10h.1M15 10h.1',
  airborne: 'M12 21V5M8 9l4-4 4 4M9 14C4 14 2 10 2 6c5 0 8 3 10 6 2-3 5-6 10-6 0 4-2 8-7 8',
  displaced: 'M3 17h7V5H3ZM12 11h9M17 7l4 4-4 4M14 20h7',
  haste: 'M3 6h10M2 11h8M3 16h4M10 20l7-9-4-3 4-5M17 3h4v4',
  slow: 'M4 12h16v6H4ZM6 12a6 6 0 0 1 12 0M4 16H2M20 14h2v4M7 18v3M17 18v3',
  root: 'M12 2v12M6 5l6 4 6-4M12 14l-6 7M12 14l6 7M9 17H4v4M15 17h5v4',
  reckless: 'M4 21 19 4l2-1-1 4L6 22ZM2 16l7 6M3 3l18 18M3 3h5M3 3v5',
  fortified: 'M3 21V4h4v4h3V4h4v4h3V4h4v17ZM9 21v-6h6v6',
  challenged: 'M4 5c4-3 12-3 16 0v9l-8 7-8-7ZM12 7v6M12 16h.1',
  mark: 'M12 2v5M12 17v5M2 12h5M17 12h5M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  warded:
    'M4 5l8-3 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10ZM12 7c1 3 4 4 3 7-1 4-7 3-6-1 0-1 1-2 2-3 0 2 1 2 1-3Z',
  guarded: 'M4 5l8-3 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10ZM8 11l3 3 5-6',
  exposed: 'M3 5l7-3v7l-3 3 3 3v7c-3-2-7-5-7-10ZM14 2l7 3v7c0 5-4 8-7 10v-7l3-3-3-3Z',
  'lowered-guard': 'M4 5l8-3 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10ZM7 12h10M12 8v9M9 14l3 3 3-3',
  blind: 'M3 3l18 18M9 5c6-2 10 3 13 7l-3 3M15 19c-6 2-10-3-13-7l3-3M10 10a3 3 0 0 0 4 4',
  blindside:
    'M15 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 21v-8a4 4 0 0 1 8 0v8M2 11l4 4-4 4M6 15H2M22 11l-4 4 4 4M18 15h4',
  'blindside-vulnerability':
    'M15 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 21v-8a4 4 0 0 1 8 0v8M1 15h6M4 12l3 3-3 3M23 15h-6M20 12l-3 3 3 3',
  barrier: 'M3 21V11a9 9 0 0 1 18 0v10M7 21V11a5 5 0 0 1 10 0v10M2 21h20',
  covert: 'M3 17 7 5l5-3 5 3 4 12-5 4H8ZM7 13l5-2 5 2-5 4Z',
  revealed: 'M2 12c5-8 15-8 20 0-5 8-15 8-20 0ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM12 1v3M12 20v3',
  'mp-drain': 'M9 2C7 6 3 10 3 13a6 6 0 0 0 12 0c0-3-4-7-6-11ZM18 5v15M14 16l4 4 4-4',
  'mp-recovery': 'M9 2C7 6 3 10 3 13a6 6 0 0 0 12 0c0-3-4-7-6-11ZM18 20V5M14 9l4-4 4 4',
  healing: 'M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z',
  damage: 'M13 2 9 9 2 7l5 7-4 7 9-3 6 4-1-8 5-5-8 1Z',
  'create-terrain': 'M2 17l6-5 5 3 5-10 4 12ZM2 21h20M5 4h4M7 2v4',
  displace: 'M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4M9 5h6M9 19h6',
  push: 'M3 4v16M5 12h16M15 6l6 6-6 6',
  pull: 'M3 4v16M21 12H6M12 6l-6 6 6 6',
  'barrier-change': 'M4 5l8-3 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10ZM8 12h8M12 8v8',
  'return-to-turn-start': 'M3 10a9 9 0 1 1 1 8M3 4v6h6M12 6v7h5',
  'remove-status': 'M3 16 16 3l5 5L8 21H3ZM10 9l5 5M17 16v6M14 19h6',
  'copy-statuses': 'M8 8h13v13H8ZM3 16V3h13M12 14h5M14.5 11.5v5',
  sensory:
    'M2 14c5-7 15-7 20 0-5 7-15 7-20 0ZM14 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 2v4M5 4l2 3M19 4l-2 3',
  summon:
    'M3 20c0-3 4-5 9-5s9 2 9 5-4 3-9 3-9 0-9-3ZM12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM7 16v-3a5 5 0 0 1 10 0v3',
  'terrain-evasion': 'M2 21 9 7l5 7 3-4 5 11M18 9V2M15 5l3-3 3 3',
  'terrain-defense': 'M2 21 9 7l5 7 3-4 5 11M18 2v7M15 6l3 3 3-3',
  primed: 'M8 2h8M8 22h8M8 2c0 5 8 5 8 10S8 17 8 22M16 2c0 5-8 5-8 10s8 5 8 10M4 10H2M22 10h-2',
}

export function BattleEffectIcon({ statusId, fallback }: { statusId: string; fallback: string }) {
  const path = Object.hasOwn(effectPaths, statusId) ? effectPaths[statusId] : undefined
  // Custom identities retain their stable code rather than a guessed mechanical symbol.
  if (!path) return <i aria-hidden="true">{fallback}</i>
  return (
    <svg
      data-battle-effect-icon={statusId}
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
  )
}
