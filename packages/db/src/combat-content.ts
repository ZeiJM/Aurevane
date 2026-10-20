import { randomUUID } from 'node:crypto'

export type CombatContentKind =
  | 'skill'
  | 'essence'
  | 'resonance'
  | 'status'
  | 'effect-profile'
  | 'discipline'
  | 'tag'
  | 'item'
  | 'ascension'
  | 'severence'

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
  /** Trusted shipped history; independent of the selected current publication. */
  readonly versionFloor?: number | null
  readonly actorUserId: string
}

export interface CombatContentRepository {
  findDraft(contentKey: string): Promise<CombatContentDraftRecord | null>
  saveDraft(input: SaveCombatContentDraftInput): Promise<CombatContentDraftRecord>
  publish(input: PublishCombatContentInput): Promise<CombatContentVersionRecord>
  findPublished(
    contentKey: string,
    contentKind?: CombatContentKind,
  ): Promise<CombatContentVersionRecord | null>
  listPublishedVersions(contentKey: string): Promise<readonly CombatContentVersionRecord[]>
  setCurrentPublication(
    contentKey: string,
    version: number | null,
    actorUserId: string,
    contentKind?: CombatContentKind,
  ): Promise<void>
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

const versionDefinition = (
  definition: CombatContentDefinition,
  contentVersion: number,
  contentKind: CombatContentKind,
): CombatContentDefinition => {
  const clone = cloneDefinition(definition)
  const versioned = Object.hasOwn(clone, 'contentVersion') ? { ...clone, contentVersion } : clone
  if (contentKind !== 'essence') return versioned

  const skill = versioned.skill
  if (typeof skill !== 'object' || skill === null || Array.isArray(skill)) return versioned
  return {
    ...versioned,
    skill: Object.hasOwn(skill, 'contentVersion')
      ? { ...(skill as Record<string, unknown>), contentVersion }
      : structuredClone(skill),
  }
}

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

const assertOptionalPositiveVersion = (version: number | null, label: string): void => {
  if (version !== null && (!Number.isSafeInteger(version) || version < 1)) {
    throw new CombatContentConflictError(
      'COMBAT_CONTENT_VERSION_INVALID',
      `${label} must be null or a positive safe integer.`,
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
    assertOptionalPositiveVersion(input.baseVersion, 'Draft base version')
    const existing = this.#drafts.get(input.contentKey)
    const actualDraftVersion = existing?.draftVersion ?? null

    if (existing) {
      assertContentIdentity(input.contentKey, input.contentKind, existing.contentKind)
    }
    this.#assertKnownOrExternalFallbackVersion(
      input.contentKey,
      input.contentKind,
      input.baseVersion,
    )

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
    assertOptionalPositiveVersion(input.expectedBaseVersion, 'Expected base version')
    assertOptionalPositiveVersion(input.versionFloor ?? null, 'Publication version floor')
    const versions = this.#versions.get(input.contentKey) ?? []
    const publication = this.#publications.get(input.contentKey)
    const current = publication
      ? (versions.find((version) => version.id === publication.versionId) ?? null)
      : null

    if (publication && !current) {
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_PUBLICATION_INVALID',
        `Current publication for ${input.contentKey} does not reference immutable history.`,
      )
    }

    if (current) {
      assertContentIdentity(input.contentKey, input.contentKind, current.contentKind)
      if (input.expectedBaseVersion !== current.contentVersion) {
        throw new CombatContentConflictError(
          'COMBAT_CONTENT_BASE_VERSION_CONFLICT',
          `Expected published base version ${String(input.expectedBaseVersion)} for ${input.contentKey}, ` +
            `but current version is ${current.contentVersion}.`,
        )
      }
    }

    const highestStoredVersion = versions.reduce(
      (highest, version) => Math.max(highest, version.contentVersion),
      0,
    )
    const highestVersion = Math.max(
      highestStoredVersion,
      input.expectedBaseVersion ?? 0,
      input.versionFloor ?? 0,
    )
    if (highestVersion >= 2_147_483_647)
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_VERSION_INVALID',
        'Publication version is exhausted.',
      )
    const nextVersion = highestVersion + 1
    const now = new Date().toISOString()
    const version: CombatContentVersionRecord = {
      id: randomUUID(),
      contentKey: input.contentKey,
      contentKind: input.contentKind,
      contentVersion: nextVersion,
      definition: versionDefinition(input.definition, nextVersion, input.contentKind),
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

  async findPublished(
    contentKey: string,
    contentKind?: CombatContentKind,
  ): Promise<CombatContentVersionRecord | null> {
    const publication = this.#publications.get(contentKey)
    if (!publication || (contentKind && publication.contentKind !== contentKind)) return null

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
    version: number | null,
    actorUserId: string,
    contentKind?: CombatContentKind,
  ): Promise<void> {
    if (version === null) {
      if (!contentKind || this.#publications.get(contentKey)?.contentKind === contentKind)
        this.#publications.delete(contentKey)
      return
    }

    const target = this.#versions
      .get(contentKey)
      ?.find((candidate) => candidate.contentVersion === version)

    if (!target || (contentKind && target.contentKind !== contentKind)) {
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

  #assertKnownOrExternalFallbackVersion(
    contentKey: string,
    contentKind: CombatContentKind,
    version: number | null,
  ): void {
    if (version === null || !this.#publications.has(contentKey)) return

    const known = (this.#versions.get(contentKey) ?? []).find(
      (candidate) => candidate.contentVersion === version,
    )
    if (!known) {
      throw new CombatContentConflictError(
        'COMBAT_CONTENT_BASE_VERSION_NOT_FOUND',
        `Draft base version ${version} does not exist for ${contentKey}.`,
      )
    }
    assertContentIdentity(contentKey, contentKind, known.contentKind)
  }
}

export type CombatContentLifecycle = 'draft' | 'active' | 'archived'
export interface CompleteCombatContentVersion {
  readonly contentVersion: number
  readonly definition: CombatContentDefinition
  readonly publishedBy: string
  readonly publishedAt: string
  readonly authoredBy: string | null
  readonly authoredAt: string | null
  readonly restoredFrom: number | null
  readonly restoredBy: string | null
}
export interface CompleteCombatContentRecord {
  /** Server-derived capability; opaque retained data is not an editable definition. */
  readonly authoringBlocker?: {
    readonly code: 'EFFECT_PROFILE_AUTHORING_UNSUPPORTED'
    readonly message: string
  }
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly lifecycle: CombatContentLifecycle
  readonly revision: number
  readonly versionFloor: number
  readonly createdBy: string | null
  readonly createdAt: string | null
  /** Baseline identity metadata; this is not a fabricated publication/history row. */
  readonly builtin?: { readonly contentVersion: number; readonly name: string } | null
  /** Resolved from the existing executable catalogue only for a nonarchived baseline. */
  readonly builtinDefinition?: CombatContentDefinition
  readonly draft: {
    readonly definition: CombatContentDefinition
    readonly draftVersion: number
    readonly baseVersion: number | null
    readonly updatedBy: string
    readonly updatedAt: string
    readonly restoredFrom: number | null
    readonly restoredBy: string | null
  } | null
  readonly current: CompleteCombatContentVersion | null
  readonly history: readonly CompleteCombatContentVersion[]
  readonly usedBy: readonly {
    readonly kind: string
    readonly key: string
    readonly blocking?: boolean
  }[]
  readonly usedByTruncated?: boolean
  readonly links: readonly string[]
}
export type CompleteCombatContentWrite =
  | {
      readonly action: 'create'
      readonly requestId: string
      readonly contentKind: CombatContentKind
      readonly definition: CombatContentDefinition
      readonly parentKey?: string
      readonly expectedParentRevision?: number
    }
  | {
      readonly action: 'duplicate'
      readonly requestId: string
      readonly sourceKey: string
      readonly expectedSourceRevision: number
      readonly sourceDefinition?: CombatContentDefinition
    }
  | {
      readonly action: 'save'
      readonly expectedRevision: number
      readonly definition: CombatContentDefinition
    }
  | {
      readonly action: 'restore'
      readonly expectedRevision: number
      readonly sourceVersion: number
    }
  | { readonly action: 'archive'; readonly expectedRevision: number }
  | {
      readonly action: 'link' | 'unlink'
      readonly requestId: string
      readonly expectedRevision: number
      readonly childKey: string
    }
export interface CombatContentListPage {
  readonly records: readonly Pick<
    CompleteCombatContentRecord,
    'contentKey' | 'contentKind' | 'lifecycle' | 'revision'
  >[]
  readonly nextCursor: string | null
}
