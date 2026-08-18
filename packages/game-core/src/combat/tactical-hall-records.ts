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
      'Learn reachable movement, terrain cost, remaining Movement, and how final facing closes the turn without spending your Action.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Move or press 2. Green tiles are reachable now; rough ground marked R2 costs 2 Movement.',
      'Move once and verify the Movement counter changes while your Action remains READY.',
      'Choose End Turn, set the direction you want to protect, then Confirm; facing and End Turn settle together.',
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
      'Select the Recruit and read the green/red target state plus hit and damage forecast.',
      'Confirm, then read the result banner and enemy HP to see whether the attack hit or missed.',
    ],
    combinedDuel: false,
  },
  {
    id: 'guard-drill',
    name: 'Guard Drill',
    purpose: 'Learn that Guard spends the normal Action to reduce incoming damage by 20%.',
    defaultArenaId: 'basic-training-floor',
    coachSteps: [
      'Choose Guard or press 4 and read the Guard preview.',
      'Confirm to gain Guarded; the status panel shows its active defensive effect.',
      'Use any remaining Movement if useful, choose final facing, then End Turn.',
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
      'Choose End Turn preparation.',
      'Use the directional facing pad to select north, west, east, or south.',
      'Confirm once; facing and End Turn settle together authoritatively.',
    ],
    combinedDuel: false,
  },
  {
    id: 'recruit-sparring',
    name: 'Recruit Sparring Partner',
    purpose:
      'Combine movement, Action economy, targeting, terrain, facing, and visible Recruit decisions in a full duel.',
    defaultArenaId: 'duel-yard',
    coachSteps: [
      'Use green movement reachability and terrain information to approach with purpose.',
      'Spend the Action on Basic Attack or Guard when the timing is right; read the result banner after every commit.',
      'Choose final facing and End Turn, then watch the Recruit turn summary before acting again.',
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
