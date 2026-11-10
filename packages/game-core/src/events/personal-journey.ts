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

interface PersonalJourneyDialogue {
  readonly offer: string
  readonly active: string
  readonly ready: string
  readonly completed: string
}

export interface PersonalTravelJourney extends PersonalJourneyDialogue {
  readonly type: 'travel-and-report'
  readonly giverId: PersonalQuestGiverId
  readonly destination: PersonalJourneyPosition
}

export interface PersonalHuntJourney extends PersonalJourneyDialogue {
  readonly type: 'defeat-and-report'
  readonly giverId: string
  readonly npcTag: string
  readonly requiredDefeats: number
  readonly rewardPackageRef: string
}

export interface PersonalSealedRealm {
  readonly guardianNpcId: string
  readonly lore: string
  readonly access: string
  readonly challenge: string
  readonly retry: string
}

export function isPersonalJourneyNpcId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  )
}

export interface PersonalItemExchange extends PersonalJourneyDialogue {
  readonly type: 'item-exchange'
  readonly giverId: string
  readonly realm?: PersonalSealedRealm
  readonly inputItemId: string
  readonly inputQuantity: number
  readonly outputItemId: string
}

export type PersonalJourney = PersonalTravelJourney | PersonalItemExchange

export interface PersonalInventoryRestorationTrial {
  readonly npcId: string
  readonly offer: string
  readonly active: string
  readonly ready: string
  readonly rewardPackageRef: string
}

export interface PersonalInventoryRestoration {
  readonly giverNpcId: string
  readonly checkpoint: PersonalJourneyPosition
  readonly outputItemId: string
  readonly offer: string
  readonly travel: string
  readonly ready: string
  readonly completed: string
  readonly trial?: PersonalInventoryRestorationTrial
  readonly recoveryRewardPackageRef?: string
}

export interface PersonalInventoryDiscovery {
  readonly firstItemId: string
  readonly secondItemId: string
  readonly clue: string
  readonly restoration?: PersonalInventoryRestoration
}

export interface PersonalCombatDiscovery {
  readonly npcTag: string
  readonly requiredDefeats: number
  readonly timeZone: string
  readonly resetMinute: number
  readonly opponentNpcId: string
  readonly mode: 'evergreen' | 'seasonal'
  readonly ready: string
  readonly completed: string
  readonly firstRewardPackageRef: string
  readonly repeatRewardPackageRef?: string
}
