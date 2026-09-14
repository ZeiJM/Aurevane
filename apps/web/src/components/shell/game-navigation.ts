export const gameNavigation = [
  {
    href: '/game/character',
    label: 'Profile',
    detail: 'Character sheet and build',
    symbol: '◇',
    icon: 'profile',
  },
  {
    href: '/game/battle',
    label: 'Battle Hall',
    detail: 'Practice fights and combat',
    symbol: '⚔',
    icon: 'battle',
  },
  {
    href: '/game/training',
    label: 'Passive Training',
    detail: 'Start a timed background training plan',
    symbol: '◷',
    icon: 'training',
  },
  {
    href: '/game/online',
    label: 'Adventurers',
    detail: 'Online presence and adventurer directory',
    symbol: '♧',
    icon: 'adventurers',
  },
] as const
