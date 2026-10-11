export const gameNavigation = [
  {
    href: '/game/haven',
    label: 'Haven',
    detail: 'Your journey, Current Path and latest news',
    symbol: '⌂',
    icon: 'haven',
  },
  {
    href: '/game/character',
    label: 'Profile',
    detail: 'Character profile and attributes',
    symbol: '◇',
    icon: 'profile',
  },
  {
    href: '/game/loadout',
    label: 'Loadout',
    detail: 'Nexus, disciplines, techniques and Items',
    symbol: '✦',
    icon: 'nexus',
  },
  { href: '/game/world', label: 'Travel', detail: 'Explore the world', symbol: '✥', icon: 'world' },
  {
    href: '/game/battle',
    label: 'Battle',
    detail: 'Battle Hall, direct PvP and spectation',
    symbol: '⚔',
    icon: 'battle',
  },
  {
    href: '/game/training',
    label: 'Training',
    detail: 'Passive Training',
    symbol: '◷',
    icon: 'training',
  },
] as const
