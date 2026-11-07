export interface PersonalJourneyPosition {
  readonly sectorId: string
  readonly x: number
  readonly y: number
}

export const PERSONAL_QUEST_GIVERS = {
  'eastern-watch-officer': {
    label: 'Verdant Expanse Watch officer',
    speaker: 'Watch officer',
    position: { sectorId: 'verdant-expanse', x: 2, y: 4 },
  },
  'crown-hinterland-watch-officer': {
    label: 'Aureth Crown Watch officer',
    speaker: 'Watch officer',
    position: { sectorId: 'aureth-crown', x: 2, y: 4 },
  },
} as const

export type PersonalQuestGiverId = keyof typeof PERSONAL_QUEST_GIVERS

export function isPersonalQuestGiver(value: unknown): value is PersonalQuestGiverId {
  return typeof value === 'string' && Object.hasOwn(PERSONAL_QUEST_GIVERS, value)
}

export interface PersonalTravelJourney {
  readonly type: 'travel-and-report'
  readonly giverId: PersonalQuestGiverId
  readonly destination: PersonalJourneyPosition
  readonly offer: string
  readonly active: string
  readonly ready: string
  readonly completed: string
}
