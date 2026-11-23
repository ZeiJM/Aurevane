export type SupernaturalPathRecord = 'unawakened' | 'ascended' | 'severed'

export interface SupernaturalStoryStateRecord {
  characterId: string
  schemaVersion: 1
  stateVersion: number
  storyId: string
  storyVersion: number
  nodeId: string
  path: SupernaturalPathRecord
  ascensionId: string | null
  ascensionContentVersion: number | null
  severenceId: string | null
  severenceContentVersion: number | null
  chosenAt: string | null
  updatedAt: string
}

export interface InitializeSupernaturalStoryStateInput {
  userId: string
  characterId: string
  storyId: string
  storyVersion: number
  initialNodeId: string
}

export interface CommitSupernaturalStoryTransitionInput {
  userId: string
  characterId: string
  expectedStateVersion: number
  idempotencyKey: string
  requestFingerprint: string
  transitionId: string
  transitionContentVersion: number
  storyId: string
  storyVersion: number
  fromNodeId: string
  toNodeId: string
  nextPath: SupernaturalPathRecord
  ascensionId: string | null
  ascensionContentVersion: number | null
  severenceId: string | null
  severenceContentVersion: number | null
}

export interface SupernaturalStoryStateRepository {
  find(userId: string, characterId: string): Promise<SupernaturalStoryStateRecord | null>
  initialize(input: InitializeSupernaturalStoryStateInput): Promise<SupernaturalStoryStateRecord>
  commitTransition(
    input: CommitSupernaturalStoryTransitionInput,
  ): Promise<{ state: SupernaturalStoryStateRecord; replayed: boolean }>
}
