import {
  EFFECT_PROFILE_AUTHORING_BLOCKER,
  parseStoredStatusDefinition,
  retainOpaqueEffectProfile,
} from './combat-standalone-content'
import {
  isNoncombatContentKind,
  parseNoncombatContentDefinition,
} from '@aurevane/game-core/content/authored-content'
import {
  BASIC_SKILL_IDS,
  defaultBasicSkills,
  parseBasicSkillDefinition,
  type BasicSkillDefinition,
  type BasicSkillId,
} from '@aurevane/game-core/combat/combat-basic-actions'
import 'server-only'

import type {
  CombatContentVersionRecord,
  CombatContentKind,
  CombatContentDefinition,
} from '@aurevane/db/combat-content'
import {
  parseStoredCombatEffectTimingPolicy,
  type CombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import {
  resolveEssenceForBuild,
  currentEssenceDefinitions,
  validateEssenceDefinition,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import {
  resolveResonanceForPair,
  currentResonanceDefinitions,
  validateResonanceDefinition,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import { AurevaneError } from '@aurevane/game-core/errors'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  resolveMatureSkillVersion,
  latestEnabledMatureSkills,
  toMaterializedCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CombatContentResolver {
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

export interface PublishedCombatContentSource {
  readCatalogueSnapshot?(): Promise<PublishedCombatContentCatalogueSnapshot>
  findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null>
  findCurrentSkills?(contentKeys: readonly string[]): Promise<readonly CombatContentVersionRecord[]>
  findSkillVersion(
    contentKey: string,
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null>
  findCurrentContent?(
    contentKey: string,
    contentKind: 'essence' | 'resonance',
  ): Promise<CombatContentVersionRecord | null>
  findContentVersion?(
    contentKey: string,
    contentKind: 'essence' | 'resonance',
    contentVersion: number,
  ): Promise<CombatContentVersionRecord | null>
}

export class InvalidPublishedCombatContentError extends Error {
  readonly code = 'INVALID_PUBLISHED_COMBAT_CONTENT' as const

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InvalidPublishedCombatContentError'
  }
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
        if (
          !isObject(row) ||
          typeof row.content_kind !== 'string' ||
          (!['skill', 'essence', 'resonance', 'status', 'effect-profile'].includes(
            row.content_kind,
          ) &&
            !isNoncombatContentKind(row.content_kind))
        )
          throw new TypeError('Invalid catalogue content kind.')
        const record = parseVersionRow([row], row.content_kind as CombatContentKind)
        if (!record || seen.has(record.contentKey))
          throw new TypeError('Invalid or duplicate catalogue identity.')
        seen.add(record.contentKey)
        if (record.contentKind === 'status') {
          const definition = parseStoredStatusDefinition(record.definition)
          if (
            definition.id !== record.contentKey ||
            (definition.contentVersion !== undefined &&
              definition.contentVersion !== record.contentVersion)
          )
            throw new TypeError('Status identity mismatch.')
        }
        if (record.contentKind === 'effect-profile')
          retainOpaqueEffectProfile(record.definition, record.contentKey, record.contentVersion)
        if (isNoncombatContentKind(record.contentKind)) {
          const definition = parseNoncombatContentDefinition(record.contentKind, record.definition)
          if (
            definition.id !== record.contentKey ||
            definition.contentVersion !== record.contentVersion
          )
            throw new TypeError('Noncombat identity mismatch.')
        }
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
    contentKind: 'essence' | 'resonance',
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
    contentKind: 'essence' | 'resonance',
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

function validatePublishedSkill(
  record: CombatContentVersionRecord,
  expectedSkillId: string,
  expectedVersion?: number,
): MatureSkillDefinition {
  if (
    record.contentKind !== 'skill' ||
    record.contentKey !== expectedSkillId ||
    (expectedVersion !== undefined && record.contentVersion !== expectedVersion)
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill metadata does not match ${expectedSkillId}${
        expectedVersion === undefined ? '' : `@${expectedVersion}`
      }.`,
    )
  }

  const candidate = structuredClone(record.definition) as unknown as MatureSkillDefinition
  let issues: readonly string[]
  try {
    issues = validateMatureSkillDefinition(candidate)
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} has an invalid definition shape.`,
      { cause: error },
    )
  }

  if (
    issues.length > 0 ||
    candidate.id !== record.contentKey ||
    candidate.contentVersion !== record.contentVersion
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} failed validation${
        issues.length > 0 ? `: ${issues.join(', ')}` : '.'
      }`,
    )
  }

  try {
    if (Object.hasOwn(candidate, 'ability')) return structuredClone(candidate)
    for (const context of ['pve', 'pvp'] as const) {
      validateCombatActionDefinition(
        toMaterializedCombatActionDefinition({ ...candidate, enabled: true }, context),
      )
    }
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} failed combat-action validation.`,
      { cause: error },
    )
  }

  return structuredClone(candidate)
}

function validatePublishedEssence(
  record: CombatContentVersionRecord,
  expectedEssenceId: string,
  expectedVersion?: number,
): EssenceDefinition {
  if (
    record.contentKind !== 'essence' ||
    record.contentKey !== expectedEssenceId ||
    (expectedVersion !== undefined && record.contentVersion !== expectedVersion)
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Essence metadata does not match ${expectedEssenceId}${
        expectedVersion === undefined ? '' : `@${expectedVersion}`
      }.`,
    )
  }

  const candidate = structuredClone(record.definition) as unknown as EssenceDefinition
  let issues: readonly string[]
  try {
    issues = validateEssenceDefinition(candidate)
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Essence ${expectedEssenceId}@${record.contentVersion} has an invalid definition shape.`,
      { cause: error },
    )
  }
  if (
    issues.length > 0 ||
    candidate.essenceId !== record.contentKey ||
    candidate.contentVersion !== record.contentVersion ||
    candidate.skill.contentVersion !== record.contentVersion
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Essence ${expectedEssenceId}@${record.contentVersion} failed validation${
        issues.length > 0 ? `: ${issues.join(', ')}` : '.'
      }`,
    )
  }
  return structuredClone(candidate)
}

function validatePublishedResonance(
  record: CombatContentVersionRecord,
  expectedResonanceId: string,
  expectedVersion?: number,
): AnyResonanceDefinition {
  if (
    record.contentKind !== 'resonance' ||
    record.contentKey !== expectedResonanceId ||
    (expectedVersion !== undefined && record.contentVersion !== expectedVersion)
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Resonance metadata does not match ${expectedResonanceId}${
        expectedVersion === undefined ? '' : `@${expectedVersion}`
      }.`,
    )
  }

  const candidate = structuredClone(record.definition) as unknown as AnyResonanceDefinition
  let issues: readonly string[]
  try {
    issues = validateResonanceDefinition(candidate)
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Resonance ${expectedResonanceId}@${record.contentVersion} has an invalid definition shape.`,
      { cause: error },
    )
  }
  if (
    issues.length > 0 ||
    candidate.id !== record.contentKey ||
    candidate.contentVersion !== record.contentVersion
  ) {
    throw new InvalidPublishedCombatContentError(
      `Published Resonance ${expectedResonanceId}@${record.contentVersion} failed validation${
        issues.length > 0 ? `: ${issues.join(', ')}` : '.'
      }`,
    )
  }
  return structuredClone(candidate)
}

export function isBasicSkillId(id: string): id is BasicSkillId {
  return BASIC_SKILL_IDS.includes(id as BasicSkillId)
}

export function validatePublishedBasicSkill(
  record: CombatContentVersionRecord,
  id: BasicSkillId,
  version?: number,
): BasicSkillDefinition {
  if (
    record.contentKind !== 'skill' ||
    record.contentKey !== id ||
    (version !== undefined && record.contentVersion !== version)
  )
    throw new InvalidPublishedCombatContentError(
      'Published Basic Skill metadata does not match its exact identity.',
    )
  try {
    const basic = parseBasicSkillDefinition(record.definition)
    if (basic.id !== id || basic.contentVersion !== record.contentVersion)
      throw new TypeError('Basic definition identity or version mismatch.')
    return basic
  } catch (cause) {
    throw new InvalidPublishedCombatContentError(
      `Published Basic Skill ${id}@${record.contentVersion} is invalid.`,
      { cause },
    )
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
    if (isNoncombatContentKind(record.contentKind)) {
      const definition = parseNoncombatContentDefinition(record.contentKind, record.definition)
      if (
        definition.id !== record.contentKey ||
        definition.contentVersion !== record.contentVersion
      )
        throw new InvalidPublishedCombatContentError('Noncombat identity mismatch.')
      continue
    }
    const identity: CatalogueIdentity = {
      contentKey: record.contentKey,
      contentKind: record.contentKind,
      contentVersion: record.contentVersion,
      source: 'published',
    }
    let entry: CombatContentCatalogueEntry
    switch (record.contentKind) {
      case 'skill':
        entry = isBasicSkillId(record.contentKey)
          ? {
              ...identity,
              category: 'basic',
              definition: validatePublishedBasicSkill(record, record.contentKey),
            }
          : {
              ...identity,
              category: 'skill',
              definition: validatePublishedSkill(record, record.contentKey),
            }
        break
      case 'essence':
        entry = {
          ...identity,
          category: 'essence',
          definition: validatePublishedEssence(record, record.contentKey),
        }
        break
      case 'resonance':
        entry = {
          ...identity,
          category: 'resonance',
          definition: validatePublishedResonance(record, record.contentKey),
        }
        break
      case 'status': {
        const definition = parseStoredStatusDefinition(record.definition)
        if (
          definition.id !== record.contentKey ||
          (definition.contentVersion !== undefined &&
            definition.contentVersion !== record.contentVersion)
        )
          throw new InvalidPublishedCombatContentError('Status identity mismatch.')
        entry = { ...identity, category: 'status', definition }
        break
      }
      case 'effect-profile':
        entry = {
          ...identity,
          category: record.contentKind,
          definition: retainOpaqueEffectProfile(
            record.definition,
            record.contentKey,
            record.contentVersion,
          ),
          runtimeSupported: false,
          authoringBlocker: { ...EFFECT_PROFILE_AUTHORING_BLOCKER },
        }
        break
      default:
        throw new InvalidPublishedCombatContentError('Unsupported current content kind.')
    }
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

export function createCombatContentResolver(
  source: PublishedCombatContentSource,
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

  return {
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
            const frozen = createCombatContentResolver({
              readCatalogueSnapshot: async () => structuredClone(snapshot),
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
            })
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
