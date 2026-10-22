import {
  captureCombatTagPresentation,
  bindCombatTagPresentations,
  type CombatTagPresentationSnapshot,
} from '@aurevane/game-core/combat/combat-tag-registry'
import {
  parseNoncombatContentDefinition,
  type AuthoredTag,
} from '@aurevane/game-core/content/authored-content'
import {
  defaultBasicSkills,
  type BasicSkillDefinition,
  type BasicSkillId,
} from '@aurevane/game-core/combat/combat-basic-actions'
import 'server-only'
import { combatContentCategory } from './combat-content-categories'
import {
  InvalidPublishedCombatContentError,
  isBasicSkillId,
  validatePublishedBasicSkill,
  validatePublishedEssence,
  validatePublishedResonance,
  validatePublishedSkill,
} from './combat-content-published-validation'
import { EFFECT_PROFILE_AUTHORING_BLOCKER } from './combat-standalone-content'
export {
  InvalidPublishedCombatContentError,
  isBasicSkillId,
  validatePublishedBasicSkill,
} from './combat-content-published-validation'

import type {
  CombatContentDefinition,
  CombatContentKind,
  CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import {
  parseStoredCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import {
  currentEssenceDefinitions,
  resolveEssenceForBuild,
  type EssenceDefinition,
  type EssenceSnapshotReference,
} from '@aurevane/game-core/combat/essence'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  currentResonanceDefinitions,
  resolveResonanceForPair,
  type AnyResonanceDefinition,
  type ResonanceSnapshotReference,
} from '@aurevane/game-core/combat/resonance'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CombatContentResolver {
  resolveCurrentTagPresentations?(): Promise<readonly CombatTagPresentationSnapshot[]>
  resolvePinnedTagPresentation?(
    key: string,
    version: number,
  ): Promise<CombatTagPresentationSnapshot | null>
  /** One MVCC catalogue supplies timing and every current lookup during battle admission. */
  captureCurrentCatalogue?(): Promise<{
    resolver: CombatContentResolver
    policy: CombatEffectTimingPolicy
  }>

  resolveCurrentCatalogue?(): Promise<CombatContentCatalogue>
  resolveCurrentBasicSkillDefinitions?(
    ids: readonly BasicSkillId[],
  ): Promise<ReadonlyMap<BasicSkillId, BasicSkillDefinition>>
  resolvePinnedBasicSkillDefinition?(
    id: BasicSkillId,
    version: number,
  ): Promise<BasicSkillDefinition | null>
  resolveCurrentSkillDefinition(skillId: string): Promise<MatureSkillDefinition | null>
  resolveCurrentSkillDefinitions?(
    skillIds: readonly string[],
  ): Promise<ReadonlyMap<string, MatureSkillDefinition>>
  resolvePinnedSkillDefinition(
    skillId: string,
    version: number,
  ): Promise<MatureSkillDefinition | null>
  resolveCurrentEssenceDefinition?(
    primaryDisciplineId: string,
    secondaryDisciplineId: string | null,
  ): Promise<EssenceDefinition | null>
  resolvePinnedEssenceDefinition?(
    primaryDisciplineId: string,
    secondaryDisciplineId: string | null,
    essenceId: string,
    version: number,
  ): Promise<EssenceDefinition | null>
  resolveCurrentResonanceDefinition?(
    primaryDisciplineId: string,
    secondaryDisciplineId: string | null,
  ): Promise<AnyResonanceDefinition | null>
  resolvePinnedResonanceDefinition?(
    primaryDisciplineId: string,
    secondaryDisciplineId: string | null,
    resonanceId: string,
    version: number,
  ): Promise<AnyResonanceDefinition | null>
}

/** Server-private snapshot. Definitions may contain private authoring and must not enter public DTOs. */
export interface PublishedCombatContentCatalogueSnapshot {
  readonly token: string
  readonly policy: CombatEffectTimingPolicy
  readonly publications: readonly CombatContentVersionRecord[]
  readonly archivedKeys?: readonly string[]
}
type CatalogueIdentity = {
  readonly contentKey: string
  readonly contentKind: CombatContentKind
  readonly contentVersion: number
  readonly source: 'builtin' | 'published'
}
export type CombatContentCatalogueEntry = CatalogueIdentity &
  (
    | { readonly category: 'basic'; readonly definition: BasicSkillDefinition }
    | { readonly category: 'skill'; readonly definition: MatureSkillDefinition }
    | { readonly category: 'essence'; readonly definition: EssenceDefinition }
    | { readonly category: 'resonance'; readonly definition: AnyResonanceDefinition }
    | { readonly category: 'status'; readonly definition: CombatContentDefinition }
    | {
        readonly category: 'effect-profile'
        readonly definition: CombatContentDefinition
        readonly runtimeSupported: false
        readonly authoringBlocker: typeof EFFECT_PROFILE_AUTHORING_BLOCKER
      }
  )
export interface CombatContentCatalogue {
  readonly token: string
  readonly policy: CombatEffectTimingPolicy
  readonly entries: readonly CombatContentCatalogueEntry[]
}

export interface CurrentDisciplineSelection {
  readonly selectionVersion: 1
  readonly catalogueToken: string
  readonly essence: EssenceSnapshotReference | null
  readonly resonance: ResonanceSnapshotReference | null
}

export interface PublishedCombatContentSource {
  readCurrentDisciplineSelection?(
    primary: string,
    secondary: string | null,
  ): Promise<CurrentDisciplineSelection>
  readCatalogueSnapshot?(): Promise<PublishedCombatContentCatalogueSnapshot>
  findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null>
  findCurrentSkills?(contentKeys: readonly string[]): Promise<readonly CombatContentVersionRecord[]>
  findSkillVersion(
    contentKey: string,
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null>
  findCurrentContent?(
    contentKey: string,
    contentKind: 'essence' | 'resonance' | 'tag',
  ): Promise<CombatContentVersionRecord | null>
  findContentVersion?(
    contentKey: string,
    contentKind: 'essence' | 'resonance' | 'tag',
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null>
}

type RpcError = { readonly code?: string; readonly message?: string }
type RpcResult = { readonly data: unknown; readonly error: RpcError | null }
type RpcExecutor = (
  functionName: string,
  parameters: Readonly<Record<string, unknown>>,
) => PromiseLike<RpcResult>

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function mapRpcFailure(error: RpcError): never {
  throw new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Published combat content is unavailable right now.',
    { cause: error },
  )
}

function parseVersionRow(
  data: unknown,
  expectedKind: CombatContentVersionRecord['contentKind'] = 'skill',
): CombatContentVersionRecord | null {
  if (data === null || (Array.isArray(data) && data.length === 0)) return null
  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (
    !isObject(row) ||
    !requiredString(row.id) ||
    !requiredString(row.content_key) ||
    row.content_kind !== expectedKind ||
    !positiveInteger(row.content_version) ||
    !isObject(row.definition) ||
    !requiredString(row.published_by) ||
    !requiredString(row.published_at)
  ) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned invalid published combat content.',
    )
  }

  return {
    id: row.id,
    contentKey: row.content_key,
    contentKind: expectedKind,
    contentVersion: row.content_version,
    definition: structuredClone(row.definition),
    publishedBy: row.published_by,
    publishedAt: row.published_at,
  }
}

function parseVersionRows(data: unknown): readonly CombatContentVersionRecord[] {
  if (!Array.isArray(data)) {
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The server returned invalid published combat content.',
    )
  }

  return data.map((row) => {
    const parsed = parseVersionRow([row])
    if (!parsed) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The server returned invalid published combat content.',
      )
    }
    return parsed
  })
}

export class RpcPublishedCombatContentSource implements PublishedCombatContentSource {
  readonly #rpc: RpcExecutor

  constructor(rpc: RpcExecutor) {
    this.#rpc = rpc
  }

  async readCurrentDisciplineSelection(
    primary: string,
    secondary: string | null,
  ): Promise<CurrentDisciplineSelection> {
    const { data, error } = await this.#rpc('read_current_discipline_selection_v1', {
      p_primary_discipline_id: primary,
      p_secondary_discipline_id: secondary,
    })
    if (error) mapRpcFailure(error)
    const invalid = () =>
      new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The current Discipline selection is invalid.')
    if (
      !isObject(data) ||
      data.selectionVersion !== 1 ||
      typeof data.catalogueToken !== 'string' ||
      !/^[a-f0-9]{32}$/.test(data.catalogueToken) ||
      Object.keys(data).some(
        (key) => !['selectionVersion', 'catalogueToken', 'essence', 'resonance'].includes(key),
      )
    )
      throw invalid()
    const essence = data.essence
    const resonance = data.resonance
    if (
      essence !== null &&
      (!isObject(essence) ||
        secondary !== null ||
        !requiredString(essence.essenceId) ||
        !positiveInteger(essence.contentVersion) ||
        essence.sourceDisciplineId !== primary ||
        essence.skillId !== essence.essenceId ||
        essence.skillContentVersion !== essence.contentVersion ||
        Object.keys(essence).some(
          (key) =>
            ![
              'essenceId',
              'contentVersion',
              'sourceDisciplineId',
              'skillId',
              'skillContentVersion',
            ].includes(key),
        ))
    )
      throw invalid()
    const pair = secondary === null ? null : [primary, secondary].sort()
    if (
      resonance !== null &&
      (!isObject(resonance) ||
        secondary === null ||
        secondary === primary ||
        !requiredString(resonance.resonanceId) ||
        !positiveInteger(resonance.contentVersion) ||
        !Array.isArray(resonance.disciplinePair) ||
        resonance.disciplinePair.length !== 2 ||
        resonance.disciplinePair.some((id, index) => id !== pair![index]) ||
        Object.keys(resonance).some(
          (key) => !['resonanceId', 'contentVersion', 'disciplinePair'].includes(key),
        ))
    )
      throw invalid()
    return structuredClone(data) as unknown as CurrentDisciplineSelection
  }

  async readCatalogueSnapshot(): Promise<PublishedCombatContentCatalogueSnapshot> {
    const { data, error } = await this.#rpc('read_combat_content_catalogue_v1', {})
    if (error) mapRpcFailure(error)
    try {
      if (
        !isObject(data) ||
        Object.keys(data).some(
          (key) => !['token', 'policy', 'publications', 'archivedKeys'].includes(key),
        ) ||
        typeof data.token !== 'string' ||
        !/^[a-f0-9]{32}$/.test(data.token) ||
        !Array.isArray(data.publications)
      )
        throw new TypeError('Invalid catalogue snapshot.')
      const seen = new Set<string>()
      const publications = data.publications.map((row) => {
        if (!isObject(row) || !combatContentCategory(row.content_kind))
          throw new TypeError('Invalid catalogue content kind.')
        const record = parseVersionRow([row], row.content_kind as CombatContentKind)
        if (!record || seen.has(record.contentKey))
          throw new TypeError('Invalid or duplicate catalogue identity.')
        seen.add(record.contentKey)
        combatContentCategory(record.contentKind, record.contentKey)!.parseRetained(
          record.definition,
          record.contentKey,
          record.contentVersion,
        )
        return record
      })
      if (
        data.archivedKeys !== undefined &&
        (!Array.isArray(data.archivedKeys) ||
          data.archivedKeys.some(
            (key) => typeof key !== 'string' || !requiredString(key) || seen.has(key),
          ) ||
          new Set(data.archivedKeys).size !== data.archivedKeys.length)
      )
        throw new TypeError('Invalid archived identities.')
      return {
        ...(data.archivedKeys === undefined ? {} : { archivedKeys: data.archivedKeys as string[] }),
        token: data.token,
        policy: parseStoredCombatEffectTimingPolicy(data.policy),
        publications,
      }
    } catch (cause) {
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'The current combat catalogue is invalid.',
        { cause },
      )
    }
  }

  async findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_current_combat_content_v1', {
      p_content_key: contentKey,
      p_content_kind: 'skill',
    })
    if (error) mapRpcFailure(error)
    return parseVersionRow(data)
  }

  async findCurrentContent(
    contentKey: string,
    contentKind: 'essence' | 'resonance' | 'tag',
  ): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_current_combat_content_v1', {
      p_content_key: contentKey,
      p_content_kind: contentKind,
    })
    if (error) mapRpcFailure(error)
    return parseVersionRow(data, contentKind)
  }

  async findCurrentSkills(
    contentKeys: readonly string[],
  ): Promise<readonly CombatContentVersionRecord[]> {
    if (contentKeys.length === 0) return []

    const { data, error } = await this.#rpc('read_current_combat_content_many_v1', {
      p_content_keys: [...contentKeys],
      p_content_kind: 'skill',
    })
    if (error) mapRpcFailure(error)
    return parseVersionRows(data)
  }

  async findContentVersion(
    contentKey: string,
    contentKind: 'essence' | 'resonance' | 'tag',
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_combat_content_version_v1', {
      p_content_key: contentKey,
      p_content_kind: contentKind,
      p_content_version: contentVersion,
    })
    if (error) mapRpcFailure(error)
    return parseVersionRow(data, contentKind)
  }

  async findSkillVersion(
    contentKey: string,
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_combat_content_version_v1', {
      p_content_key: contentKey,
      p_content_kind: 'skill',
      p_content_version: contentVersion,
    })
    if (error) mapRpcFailure(error)
    return parseVersionRow(data)
  }
}

/** Resolve a proposed server-private snapshot with the same validators as current reads. */
export function resolveCombatContentCatalogueSnapshot(
  snapshot: PublishedCombatContentCatalogueSnapshot,
): CombatContentCatalogue {
  const entries: CombatContentCatalogueEntry[] = [
    ...defaultBasicSkills().map((definition) => ({
      contentKey: definition.id,
      contentKind: 'skill' as const,
      contentVersion: definition.contentVersion,
      source: 'builtin' as const,
      category: 'basic' as const,
      definition: structuredClone(definition),
    })),
    ...latestEnabledMatureSkills().map((definition) => ({
      contentKey: definition.id,
      contentKind: 'skill' as const,
      contentVersion: definition.contentVersion,
      source: 'builtin' as const,
      category: 'skill' as const,
      definition: structuredClone(definition),
    })),
    ...currentEssenceDefinitions().map((definition) => ({
      contentKey: definition.essenceId,
      contentKind: 'essence' as const,
      contentVersion: definition.contentVersion,
      source: 'builtin' as const,
      category: 'essence' as const,
      definition: structuredClone(definition),
    })),
    ...currentResonanceDefinitions().map((definition) => ({
      contentKey: definition.id,
      contentKind: 'resonance' as const,
      contentVersion: definition.contentVersion,
      source: 'builtin' as const,
      category: 'resonance' as const,
      definition: structuredClone(definition),
    })),
  ]
  const current = new Map(
    entries
      .filter((entry) => !snapshot.archivedKeys?.includes(entry.contentKey))
      .map((entry) => [entry.contentKey, entry]),
  )
  const seen = new Set<string>()
  for (const record of snapshot.publications) {
    if (seen.has(record.contentKey))
      throw new InvalidPublishedCombatContentError('Duplicate current content identity.')
    seen.add(record.contentKey)
    if (snapshot.archivedKeys?.includes(record.contentKey))
      throw new InvalidPublishedCombatContentError('Archived content has a current publication.')
    const descriptor = combatContentCategory(record.contentKind, record.contentKey)
    if (!descriptor)
      throw new InvalidPublishedCombatContentError('Unsupported current content kind.')
    const definition = descriptor.parsePublished(record)
    if (descriptor.catalogueProjection === 'container') continue
    const entry = {
      contentKey: record.contentKey,
      contentKind: record.contentKind,
      contentVersion: record.contentVersion,
      source: 'published',
      category: descriptor.category,
      definition,
      ...(descriptor.authoringBlocker
        ? { authoringBlocker: { ...descriptor.authoringBlocker }, runtimeSupported: false }
        : {}),
    } as CombatContentCatalogueEntry
    if (
      current.has(entry.contentKey) &&
      current.get(entry.contentKey)!.contentKind !== entry.contentKind
    )
      throw new InvalidPublishedCombatContentError(
        'Current content kind conflicts with its builtin identity.',
      )
    current.set(entry.contentKey, entry)
  }
  return {
    token: snapshot.token,
    policy: structuredClone(snapshot.policy),
    entries: [...current.values()].sort((a, b) =>
      a.contentKey < b.contentKey ? -1 : a.contentKey > b.contentKey ? 1 : 0,
    ),
  }
}

export function catalogueTagPresentations(
  snapshot: PublishedCombatContentCatalogueSnapshot,
): readonly CombatTagPresentationSnapshot[] {
  return snapshot.publications
    .filter((row) => row.contentKind === 'tag' && !snapshot.archivedKeys?.includes(row.contentKey))
    .flatMap((row) => {
      const definition = parseNoncombatContentDefinition('tag', row.definition) as AuthoredTag
      if (definition.id !== row.contentKey || definition.contentVersion !== row.contentVersion)
        throw new InvalidPublishedCombatContentError('Tag identity mismatch.')
      return definition.enabled ? [captureCombatTagPresentation(definition)] : []
    })
}

export function createCombatContentResolver(
  source: PublishedCombatContentSource,
  admissionTags?: readonly CombatTagPresentationSnapshot[],
): CombatContentResolver {
  async function resolveCurrentCatalogue(): Promise<CombatContentCatalogue> {
    if (!source.readCatalogueSnapshot)
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'A complete combat catalogue is unavailable.',
      )
    const snapshot = await source.readCatalogueSnapshot()
    return resolveCombatContentCatalogueSnapshot(snapshot)
  }
  async function resolveCurrentSkillDefinitions(
    skillIds: readonly string[],
  ): Promise<ReadonlyMap<string, MatureSkillDefinition>> {
    const uniqueSkillIds = [...new Set(skillIds)]
    if (uniqueSkillIds.length === 0) return new Map()

    const publishedRows = source.findCurrentSkills
      ? await source.findCurrentSkills(uniqueSkillIds)
      : (
          await Promise.all(uniqueSkillIds.map((skillId) => source.findCurrentSkill(skillId)))
        ).filter((row): row is CombatContentVersionRecord => row !== null)

    const requested = new Set(uniqueSkillIds)
    const publishedByKey = new Map<string, CombatContentVersionRecord>()
    for (const row of publishedRows) {
      if (!requested.has(row.contentKey) || publishedByKey.has(row.contentKey)) {
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'The server returned invalid published combat content.',
        )
      }
      publishedByKey.set(row.contentKey, row)
    }

    const resolved = new Map<string, MatureSkillDefinition>()
    for (const skillId of uniqueSkillIds) {
      const published = publishedByKey.get(skillId)
      if (published) {
        resolved.set(skillId, validatePublishedSkill(published, skillId))
        continue
      }

      const fallback = resolveMatureSkillVersion(skillId)
      if (fallback) resolved.set(skillId, structuredClone(fallback))
    }
    return resolved
  }

  const resolver: CombatContentResolver = {
    ...(source.readCatalogueSnapshot
      ? {
          async captureCurrentCatalogue() {
            const snapshot = structuredClone(await source.readCatalogueSnapshot!())
            // Validate the entire coherent generation before selecting any battle source.
            resolveCombatContentCatalogueSnapshot(snapshot)
            const current = (key: string, kind: CombatContentKind) => {
              if (snapshot.archivedKeys?.includes(key))
                throw new InvalidPublishedCombatContentError('This content is archived.')
              return (
                snapshot.publications.find(
                  (row) => row.contentKey === key && row.contentKind === kind,
                ) ?? null
              )
            }
            const pinned = (key: string, kind: CombatContentKind, version: number) => {
              const row = snapshot.publications.find(
                (row) => row.contentKey === key && row.contentKind === kind,
              )
              return row?.contentVersion === version ? row : null
            }
            const frozen = createCombatContentResolver(
              {
                readCatalogueSnapshot: async () => structuredClone(snapshot),
                ...(source.readCurrentDisciplineSelection
                  ? {
                      readCurrentDisciplineSelection: async (
                        primary: string,
                        secondary: string | null,
                      ) => {
                        const selected = await source.readCurrentDisciplineSelection!(
                          primary,
                          secondary,
                        )
                        if (selected.catalogueToken !== snapshot.token)
                          throw new AurevaneError(
                            'STALE_VERSION',
                            'The combat catalogue changed. Refresh your build and retry.',
                          )
                        return selected
                      },
                    }
                  : {}),
                findCurrentSkill: async (key) => structuredClone(current(key, 'skill')),
                findCurrentSkills: async (keys) =>
                  keys
                    .map((key) => current(key, 'skill'))
                    .filter((row): row is CombatContentVersionRecord => row !== null)
                    .map((row) => structuredClone(row)),
                findCurrentContent: async (key, kind) => structuredClone(current(key, kind)),
                findSkillVersion: async (key, version) =>
                  structuredClone(pinned(key, 'skill', version)) ??
                  source.findSkillVersion(key, version),
                findContentVersion: async (key, kind, version) =>
                  structuredClone(pinned(key, kind, version)) ??
                  (await source.findContentVersion?.(key, kind, version)) ??
                  null,
              },
              catalogueTagPresentations(snapshot),
            )
            return { resolver: frozen, policy: structuredClone(snapshot.policy) }
          },
        }
      : {}),
    resolveCurrentCatalogue,
    async resolveCurrentBasicSkillDefinitions(ids) {
      const unique = [...new Set(ids)]
      if (unique.some((id) => !isBasicSkillId(id)))
        throw new InvalidPublishedCombatContentError('Unknown Basic Skill identity.')
      const rows = source.findCurrentSkills
        ? await source.findCurrentSkills(unique)
        : (await Promise.all(unique.map((id) => source.findCurrentSkill(id)))).filter(
            (row): row is CombatContentVersionRecord => row !== null,
          )
      const published = new Map<BasicSkillId, CombatContentVersionRecord>()
      for (const row of rows) {
        if (
          !isBasicSkillId(row.contentKey) ||
          !unique.includes(row.contentKey) ||
          published.has(row.contentKey)
        )
          throw new InvalidPublishedCombatContentError(
            'Invalid or duplicate Basic Skill publication rows.',
          )
        published.set(row.contentKey, row)
      }
      const result = new Map<BasicSkillId, BasicSkillDefinition>()
      for (const id of unique) {
        const row = published.get(id)
        result.set(
          id,
          row
            ? validatePublishedBasicSkill(row, id)
            : structuredClone(defaultBasicSkills().find((basic) => basic.id === id)!),
        )
      }
      return result
    },
    async resolvePinnedBasicSkillDefinition(id, version) {
      if (!isBasicSkillId(id) || !positiveInteger(version)) return null
      const published = await source.findSkillVersion(id, version)
      if (published) return validatePublishedBasicSkill(published, id, version)
      const builtin = defaultBasicSkills().find(
        (basic) => basic.id === id && basic.contentVersion === version,
      )
      return builtin ? structuredClone(builtin) : null
    },
    async resolveCurrentSkillDefinition(skillId) {
      return (await resolveCurrentSkillDefinitions([skillId])).get(skillId) ?? null
    },

    resolveCurrentSkillDefinitions,

    async resolvePinnedSkillDefinition(skillId, version) {
      const published = await source.findSkillVersion(skillId, version)
      if (published) return validatePublishedSkill(published, skillId, version)
      const fallback = resolveMatureSkillVersion(skillId, version)
      return fallback ? structuredClone(fallback) : null
    },
    async resolveCurrentEssenceDefinition(primaryDisciplineId, secondaryDisciplineId) {
      if (source.readCurrentDisciplineSelection) {
        const reference = (
          await source.readCurrentDisciplineSelection(primaryDisciplineId, secondaryDisciplineId)
        ).essence
        if (!reference) return null
        const published = await source.findContentVersion?.(
          reference.essenceId,
          'essence',
          reference.contentVersion,
        )
        const definition = published
          ? validatePublishedEssence(published, reference.essenceId, reference.contentVersion)
          : resolveEssenceForBuild(
              primaryDisciplineId,
              secondaryDisciplineId,
              reference.contentVersion,
            )
        if (
          !definition ||
          definition.essenceId !== reference.essenceId ||
          definition.sourceDisciplineId !== primaryDisciplineId ||
          !definition.enabled ||
          !definition.skill.enabled
        )
          throw new InvalidPublishedCombatContentError(
            'The selected Essence is unavailable for this build.',
          )
        return structuredClone(definition)
      }
      const fallback = resolveEssenceForBuild(primaryDisciplineId, secondaryDisciplineId)
      if (!fallback) return null
      const published = source.findCurrentContent
        ? await source.findCurrentContent(fallback.essenceId, 'essence')
        : null
      return published
        ? validatePublishedEssence(published, fallback.essenceId)
        : structuredClone(fallback)
    },

    async resolvePinnedEssenceDefinition(
      primaryDisciplineId,
      secondaryDisciplineId,
      essenceId,
      version,
    ) {
      const published = source.findContentVersion
        ? await source.findContentVersion(essenceId, 'essence', version)
        : null
      if (published) return validatePublishedEssence(published, essenceId, version)
      const fallback = resolveEssenceForBuild(primaryDisciplineId, secondaryDisciplineId, version)
      return fallback?.essenceId === essenceId ? structuredClone(fallback) : null
    },

    async resolveCurrentResonanceDefinition(primaryDisciplineId, secondaryDisciplineId) {
      if (source.readCurrentDisciplineSelection) {
        const reference = (
          await source.readCurrentDisciplineSelection(primaryDisciplineId, secondaryDisciplineId)
        ).resonance
        if (!reference) return null
        const published = await source.findContentVersion?.(
          reference.resonanceId,
          'resonance',
          reference.contentVersion,
        )
        const definition = published
          ? validatePublishedResonance(published, reference.resonanceId, reference.contentVersion)
          : resolveResonanceForPair(
              primaryDisciplineId,
              secondaryDisciplineId,
              reference.contentVersion,
            )
        if (
          !definition ||
          definition.id !== reference.resonanceId ||
          !definition.enabled ||
          definition.disciplinePair.some((id, index) => id !== reference.disciplinePair[index])
        )
          throw new InvalidPublishedCombatContentError(
            'The selected Resonance is unavailable for this build.',
          )
        return structuredClone(definition)
      }
      const fallback = resolveResonanceForPair(primaryDisciplineId, secondaryDisciplineId)
      if (!fallback) return null
      const published = source.findCurrentContent
        ? await source.findCurrentContent(fallback.id, 'resonance')
        : null
      return published
        ? validatePublishedResonance(published, fallback.id)
        : structuredClone(fallback)
    },

    async resolvePinnedResonanceDefinition(
      primaryDisciplineId,
      secondaryDisciplineId,
      resonanceId,
      version,
    ) {
      const published = source.findContentVersion
        ? await source.findContentVersion(resonanceId, 'resonance', version)
        : null
      if (published) return validatePublishedResonance(published, resonanceId, version)
      const fallback = resolveResonanceForPair(primaryDisciplineId, secondaryDisciplineId, version)
      return fallback?.id === resonanceId ? structuredClone(fallback) : null
    },
  }
  const tags = async () =>
    admissionTags ??
    (source.readCatalogueSnapshot
      ? catalogueTagPresentations(await source.readCatalogueSnapshot())
      : [])
  const bindCurrent = async <T>(value: T) => bindCombatTagPresentations(value, await tags())
  const bindPinned = <T>(value: T) =>
    admissionTags ? bindCombatTagPresentations(value, admissionTags) : value
  return {
    ...resolver,
    resolveCurrentTagPresentations: tags,
    async resolvePinnedTagPresentation(key, version) {
      if (!Number.isSafeInteger(version) || version < 1) return null
      const row = await source.findContentVersion?.(key, 'tag', version)
      if (!row || row.contentKey !== key || row.contentVersion !== version) return null
      const tag = parseNoncombatContentDefinition('tag', row.definition) as AuthoredTag
      if (tag.id !== key || tag.contentVersion !== version) return null
      return captureCombatTagPresentation(tag)
    },
    async resolveCurrentCatalogue() {
      const catalogue = await resolver.resolveCurrentCatalogue!()
      return bindCurrent(catalogue)
    },
    async resolveCurrentSkillDefinition(id) {
      return bindCurrent(await resolver.resolveCurrentSkillDefinition(id))
    },
    async resolveCurrentSkillDefinitions(ids) {
      const entries = await resolver.resolveCurrentSkillDefinitions!(ids)
      const currentTags = await tags()
      return new Map(
        [...entries].map(([id, definition]) => [
          id,
          bindCombatTagPresentations(definition, currentTags),
        ]),
      )
    },
    async resolveCurrentBasicSkillDefinitions(ids) {
      const entries = await resolver.resolveCurrentBasicSkillDefinitions!(ids)
      const currentTags = await tags()
      return new Map(
        [...entries].map(([id, definition]) => [
          id,
          bindCombatTagPresentations(definition, currentTags),
        ]),
      )
    },
    async resolveCurrentEssenceDefinition(primary, secondary) {
      return bindCurrent(await resolver.resolveCurrentEssenceDefinition!(primary, secondary))
    },
    async resolveCurrentResonanceDefinition(primary, secondary) {
      return bindCurrent(await resolver.resolveCurrentResonanceDefinition!(primary, secondary))
    },
    async resolvePinnedSkillDefinition(id, version) {
      return bindPinned(await resolver.resolvePinnedSkillDefinition(id, version))
    },
    async resolvePinnedBasicSkillDefinition(id, version) {
      return bindPinned(await resolver.resolvePinnedBasicSkillDefinition!(id, version))
    },
    async resolvePinnedEssenceDefinition(primary, secondary, id, version) {
      return bindPinned(
        await resolver.resolvePinnedEssenceDefinition!(primary, secondary, id, version),
      )
    },
    async resolvePinnedResonanceDefinition(primary, secondary, id, version) {
      return bindPinned(
        await resolver.resolvePinnedResonanceDefinition!(primary, secondary, id, version),
      )
    },
  }
}

export function deriveSkillPresentationTags(definition: MatureSkillDefinition): readonly string[] {
  return combatActionPresentationTags(definition)
}

export function createServerCombatContentResolver(): CombatContentResolver {
  const client = createSupabaseAdminClient()
  const source = new RpcPublishedCombatContentSource(
    (functionName, parameters) =>
      client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
  )
  return createCombatContentResolver(source)
}
