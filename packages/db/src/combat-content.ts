import { randomUUID } from 'node:crypto'

export type CombatContentKind = 'skill' | 'status' | 'effect-profile'

export type CombatContentDefinition = Readonly<Record<string, unknown>>

export interface CombatContentDraftRecord {
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly definition: CombatContentDefinition
  readonly baseVersion: number | null
  readonly draftVersion: number
  readonly updatedBy: string
  readonly updatedAt: string
}

export interface CombatContentVersionRecord {
  readonly id: string
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly contentVersion: number
  readonly definition: CombatContentDefinition
  readonly publishedBy: string
  readonly publishedAt: string
}

export interface CombatContentPublicationRecord {
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly versionId: string
  readonly updatedBy: string
  readonly updatedAt: string
}

export interface SaveCombatContentDraftInput {
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly definition: CombatContentDefinition
  readonly baseVersion: number | null
  readonly expectedDraftVersion: number | null
  readonly actorUserId: string
}

export interface PublishCombatContentInput {
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly definition: CombatContentDefinition
  readonly expectedBaseVersion: number | null
  readonly actorUserId: string
}

export interface CombatContentRepository {
  findDraft(contentKey: string): Promise<CombatContentDraftRecord | null>
  saveDraft(input: SaveCombatContentDraftInput): Promise<CombatContentDraftRecord>
  publish(input: PublishCombatContentInput): Promise<CombatContentVersionRecord>
  findPublished(contentKey: string): Promise<CombatContentVersionRecord | null>
  listPublishedVersions(contentKey: string): Promise<readonly CombatContentVersionRecord[]>
  setCurrentPublication(contentKey: string, version: number, actorUserId: string): Promise<void>
}

export class CombatContentConflictError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CombatContentConflictError'
    this.code = code
  }
}

const cloneDefinition = (definition: CombatContentDefinition): CombatContentDefinition =>
  structuredClone(definition) as CombatContentDefinition

const cloneDraft = (draft: CombatContentDraftRecord): CombatContentDraftRecord => ({
  ...draft,
  definition: cloneDefinition(draft.definition),
})

const cloneVersion = (version: CombatContentVersionRecord): CombatContentVersionRecord => ({
  ...version,
  definition: cloneDefinition(version.definition),
})

const assertContentIdentity = (
  contentKey: string,
  requestedKind: CombatContentKind,
  storedKind: CombatContentKind,
): void => {
  if (requestedKind !== storedKind) {
    throw new CombatContentConflictError(
      'COMBAT_CONTENT_KIND_CONFLICT',
      `${contentKey} is already registered as ${storedKind}, not ${requestedKind}.`,
    )
  }
}

export class InMemoryCombatContentRepository implements CombatContentRepository {
  readonly #drafts = new Map<string, CombatContentDraftRecord>()
  readonly #versions = new Map<string, CombatContentVersionRecord[]>()
  readonly #publications = new Map<string, CombatContentPublicationRecord>()

  async findDraft(contentKey: string): Promise<CombatContentDraftRecord | null> {
    const draft = this.#drafts.get(contentKey)
    return draft ? cloneDraft(draft) : null
  }

  async saveDraft(input: SaveCombatContentDraftInput): Promise<CombatContentDraftRecord> {
    const existing = this.#drafts.get(input.contentKey)
    const actualDraftVersion = existing?.draftVersion ?? null

    if (existing) {
      assertContentIdentity(input.contentKey, input.contentKind, existing.contentKind)
    }
    this.#assertKnownVersion(input.contentKey, input.contentKind, input.baseVersion)

    if (input.expectedDraftVersion !== actualDraftVersion) {
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_DRAFT_VERSION_CONFLICT',
        `Expected draft version ${String(input.expectedDraftVersion)} for ${input.contentKey}, ` +
          `but current draft version is ${String(actualDraftVersion)}.`,
      )
    }

    const draft: CombatContentDraftRecord = {
      contentKey: input.contentKey,
      contentKind: input.contentKind,
      definition: cloneDefinition(input.definition),
      baseVersion: input.baseVersion,
      draftVersion: (actualDraftVersion ?? 0) + 1,
      updatedBy: input.actorUserId,
      updatedAt: new Date().toISOString(),
    }

    this.#drafts.set(input.contentKey, draft)
    return cloneDraft(draft)
  }

  async publish(input: PublishCombatContentInput): Promise<CombatContentVersionRecord> {
    const versions = this.#versions.get(input.contentKey) ?? []
    const publication = this.#publications.get(input.contentKey)
    const current = publication
      ? versions.find((version) => version.id === publication.versionId) ?? null
      : null

    if (current) {
      assertContentIdentity(input.contentKey, input.contentKind, current.contentKind)
    } else if (versions[0]) {
      assertContentIdentity(input.contentKey, input.contentKind, versions[0].contentKind)
    }

    const actualBaseVersion = current?.contentVersion ?? null
    if (input.expectedBaseVersion !== actualBaseVersion) {
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_BASE_VERSION_CONFLICT',
        `Expected published base version ${String(input.expectedBaseVersion)} for ${input.contentKey}, ` +
          `but current version is ${String(actualBaseVersion)}.`,
      )
    }

    const nextVersion = versions.reduce(
      (highest, version) => Math.max(highest, version.contentVersion),
      0,
    ) + 1
    const now = new Date().toISOString()
    const version: CombatContentVersionRecord = {
      id: randomUUID(),
      contentKey: input.contentKey,
      contentKind: input.contentKind,
      contentVersion: nextVersion,
      definition: cloneDefinition(input.definition),
      publishedBy: input.actorUserId,
      publishedAt: now,
    }

    this.#versions.set(input.contentKey, [...versions, version])
    this.#publications.set(input.contentKey, {
      contentKey: input.contentKey,
      contentKind: input.contentKind,
      versionId: version.id,
      updatedBy: input.actorUserId,
      updatedAt: now,
    })

    return cloneVersion(version)
  }

  async findPublished(contentKey: string): Promise<CombatContentVersionRecord | null> {
    const publication = this.#publications.get(contentKey)
    if (!publication) return null

    const version = this.#versions
      .get(contentKey)
      ?.find((candidate) => candidate.id === publication.versionId)
    return version ? cloneVersion(version) : null
  }

  async listPublishedVersions(contentKey: string): Promise<readonly CombatContentVersionRecord[]> {
    return [...(this.#versions.get(contentKey) ?? [])]
      .sort((left, right) => left.contentVersion - right.contentVersion)
      .map(cloneVersion)
  }

  async setCurrentPublication(
    contentKey: string,
    version: number,
    actorUserId: string,
  ): Promise<void> {
    const target = this.#versions
      .get(contentKey)
      ?.find((candidate) => candidate.contentVersion === version)

    if (!target) {
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_VERSION_NOT_FOUND',
        `Cannot point ${contentKey} at missing version ${version}.`,
      )
    }

    this.#publications.set(contentKey, {
      contentKey,
      contentKind: target.contentKind,
      versionId: target.id,
      updatedBy: actorUserId,
      updatedAt: new Date().toISOString(),
    })
  }

  #assertKnownVersion(
    contentKey: string,
    contentKind: CombatContentKind,
    version: number | null,
  ): void {
    if (version === null) return

    const known = this.#versions
      .get(contentKey)
      ?.find((candidate) => candidate.contentVersion === version)
    if (!known) {
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_BASE_VERSION_NOT_FOUND',
        `Draft base version ${version} does not exist for ${contentKey}.`,
      )
    }
    assertContentIdentity(contentKey, contentKind, known.contentKind)
  }
}
