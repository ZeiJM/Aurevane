import type { TacticalHallArenaId } from './tactical-hall-arenas'

export type TacticalHallRecordId =
  'movement-drill' | 'strike-drill' | 'guard-drill' | 'facing-drill' | 'recruit-sparring'

export interface TacticalHallRecordDefinition {
  id: TacticalHallRecordId
  name: string
  purpose: string
  defaultArenaId: TacticalHallArenaId
  coachSteps: readonly string[]
  combinedDuel: boolean
}

export const P2_7_TACTICAL_HALL_RECORDS: readonly TacticalHallRecordDefinition[] = [
  {
    id: 'movement-drill',
    name: 'Movement & Facing Drill',
    purpose:
      'Learn Action Economy movement, terrain cost, reachable tiles, and how final facing closes the turn.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Move. A normal terrain point costs 25 AP; rough ground marked R50 currently costs 50 AP to enter.',
      'Propose a destination and read the glowing AP reservation before you confirm the move.',
      'Choose Finish Turn and select the direction you want to protect; the facing choice immediately closes the turn.',
    ],
    combinedDuel: false,
  },
  {
    id: 'strike-drill',
    name: 'Strike Drill',
    purpose: 'Learn Basic Attack targeting, forecast, confirmation, and committed AP spending.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Basic Attack and select the Recruit.',
      'Read the target state plus hit and damage forecast before committing.',
      'Confirm the action, then read the result and grouped Combat Log entry.',
    ],
    combinedDuel: false,
  },
  {
    id: 'guard-drill',
    name: 'Guard Drill',
    purpose: 'Learn that Guard costs 30 AP and reduces incoming damage by 15% while active.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Guard and read the 30 AP preview.',
      'Confirm to gain Guarded; click its status icon to read the defensive effect above the battle layer.',
      'Spend remaining AP if useful, then choose final facing to finish the turn.',
    ],
    combinedDuel: false,
  },
  {
    id: 'facing-drill',
    name: 'Facing Drill (legacy)',
    purpose:
      'Compatibility record retained for existing sessions. New players learn final facing inside Movement & Facing Drill.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Finish Turn.',
      'Use the directional facing pad to select north, west, east, or south.',
      'The chosen direction commits final facing and ends the turn authoritatively.',
    ],
    combinedDuel: false,
  },
  {
    id: 'recruit-sparring',
    name: 'Recruit Sparring Partner',
    purpose:
      'Combine movement, AP management, targeting, terrain, facing, and visible Recruit decisions in a full duel.',
    defaultArenaId: 'duel-yard',
    coachSteps: [
      'Choose whichever legal action best fits the board; movement is optional and is never preselected.',
      'Watch proposed AP before commitment, then read the immediate action result and grouped Combat Log entry.',
      'Choose final facing to end the turn, then watch the Recruit turn summary before acting again.',
    ],
    combinedDuel: true,
  },
]

export function getTacticalHallRecord(id: TacticalHallRecordId): TacticalHallRecordDefinition {
  const record = P2_7_TACTICAL_HALL_RECORDS.find((candidate) => candidate.id === id)
  if (!record) throw new Error(`Unknown Battle Hall record: ${id}`)
  return record
}

export function getTacticalHallRecordFromScenarioSourceId(
  sourceId: string,
): TacticalHallRecordDefinition | null {
  const prefix = 'scenario:p2-7-recruit:'
  if (!sourceId.startsWith(prefix)) return null
  const parts = sourceId.slice(prefix.length).split(':')
  const recordId = parts[1] as TacticalHallRecordId | undefined
  if (!recordId) return null
  return P2_7_TACTICAL_HALL_RECORDS.find((candidate) => candidate.id === recordId) ?? null
}
