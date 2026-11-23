export const STARTER_TITLES = ['Roadfarer', 'Dawn Seeker', 'Horizon Wanderer'] as const

export type StarterTitle = (typeof STARTER_TITLES)[number]

export function isStarterTitle(value: unknown): value is StarterTitle {
  return STARTER_TITLES.some((title) => title === value)
}
