import type { TacticalHallArenaId } from './tactical-hall-arenas'

export type TacticalHallRecordId =
  | 'movement-drill'
  | 'strike-drill'
  | 'guard-drill'
  | 'facing-drill'
  | 'recruit-sparring'

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
    name: 'Movement Drill',
    purpose: 'Learn positioning and terrain cost without confusing Movement with the Action.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Move or press 2.',
      'Build a highlighted path and read its Movement cost.',
      'Confirm the move, then verify the Action still reads READY.',
    ],
    combinedDuel: false,
  },
  {
    id: 'strike-drill',
    name: 'Strike Drill',
    purpose: 'Learn Basic Attack targeting, forecast, Confirm, and the Action-spent state.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Basic Attack or press 3.',
      'Select the Recruit and read the hit/damage forecast.',
      'Confirm, then verify Basic Attack and Guard explain that the Action is SPENT.',
    ],
    combinedDuel: false,
  },
  {
    id: 'guard-drill',
    name: 'Guard Drill',
    purpose: 'Learn that Guard is a deliberate defensive use of the same normal Action.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Guard or press 4.',
      'Read that Guard spends the Action defensively.',
      'Confirm, then reposition if Movement remains before ending the turn.',
    ],
    combinedDuel: false,
  },
  {
    id: 'facing-drill',
    name: 'Facing Drill',
    purpose: 'Learn provisional final facing without a separate mandatory facing ceremony.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Press Space or choose End Turn preparation.',
      'Use WASD, arrows, or the facing controls to protect the intended direction.',
      'Confirm once; facing and End Turn settle together authoritatively.',
    ],
    combinedDuel: false,
  },
  {
    id: 'recruit-sparring',
    name: 'Recruit Sparring Partner',
    purpose: 'Combine movement, Action economy, targeting, facing, and Recruit AI in a full duel.',
    defaultArenaId: 'duel-yard',
    coachSteps: [
      'Position with purpose; Movement normally leaves the Action available.',
      'Spend the Action on Basic Attack or Guard when the timing is right.',
      'Adjust final facing and End Turn; repeat until one combatant is defeated.',
    ],
    combinedDuel: true,
  },
]

export function getTacticalHallRecord(id: TacticalHallRecordId): TacticalHallRecordDefinition {
  const record = P2_7_TACTICAL_HALL_RECORDS.find((candidate) => candidate.id === id)
  if (!record) throw new Error(`Unknown Tactical Hall record: ${id}`)
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
