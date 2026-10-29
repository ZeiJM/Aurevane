import type { DisciplineAttributePolicy } from '@aurevane/game-core/character/attribute-allocation'
import type { CharacterAttributes } from '@aurevane/game-core/character/creation'
import type { DisciplineSkillReference } from '@aurevane/game-core/character/discipline-skill-loadout'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'
import type { LevelProgressionCurve } from '@aurevane/game-core/character/progression'

export type PlayerCorrection =
  | { kind: 'source'; xp: number; attributes: CharacterAttributes }
  | { kind: 'disciplines'; primary?: string; secondary?: string | null }
  | { kind: 'skills'; skills: DisciplineSkillReference[] }
  | { kind: 'support'; supportActionId: SupportActionId }
export interface MasterPlayerSearchResult {
  characterId: string
  name: string
  level: number
  slotIndex: number
  verifiedEmail: string | null
  deletionPending: boolean
}
export interface MasterPlayerFacts {
  level: number
  xp: number
  cycle: number
  attributes: CharacterAttributes
  build: {
    buildVersion: number
    supportActionId: SupportActionId
    primary: { disciplineId: string; definitionVersion: number; profileVersion: number }
    secondary: { disciplineId: string; definitionVersion: number } | null
    disciplineSkills: (DisciplineSkillReference & { slotIndex: number })[]
    extensions: {
      resonance: { resonanceId: string; contentVersion: number } | null
      essence: { essenceId: string; contentVersion: number } | null
    }
  }
}
export interface MasterPlayerView {
  characterId: string
  name: string
  portraitRef: string
  verifiedEmail: string | null
  fingerprint: string
  /** Presentation names only; captured identities and versions remain in facts. */
  contentNames?: Readonly<Record<string, string>>
  deletionPending: boolean
  facts: MasterPlayerFacts
  attributePolicy?: DisciplineAttributePolicy
  progressionCurve?: LevelProgressionCurve
  calculated: { maxHp: number; maxMp: number; personalPointPool: number }
  disciplines: { id: string; name: string; primary: boolean; secondary: boolean }[]
  learnedSkills: DisciplineSkillReference[]
  savedLoadouts: { name: string; slotIndex: number; primary: string; secondary: string | null }[]
  world: { position?: { sectorId?: string; x?: number; y?: number } } | null
  training: {
    plannedWindow: string | null
    plannedAt: string | null
    lastActiveAt: string | null
  } | null
  battle: {
    battleSessionId: string
    version: number
    lifecycle: string
    participants: { characterId: string; name: string }[]
    combatants: { id: string; hp: number; mp: number; ap: number | null; statuses: string[] }[]
    recentActions: string[]
  } | null
}
export interface PlayerRecoveryResult {
  outcome: 'NoContest' | 'AlreadyTerminal'
  rewards?: 'NoRewards'
  version: number
  replayed: boolean
}
