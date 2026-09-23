import 'server-only'

import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import { validateCombatActionDefinition } from '@aurevane/game-core/combat/combat-authoring-validation'
import { AurevaneError } from '@aurevane/game-core/errors'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import {
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CombatContentResolver {
  resolveCurrentSkillDefinition(skillId: string): Promise<MatureSkillDefinition | null>
  resolveCurrentSkillDefinitions?(
    skillIds: readonly string[],
  ): Promise<ReadonlyMap<string, MatureSkillDefinition>>
  resolvePinnedSkillDefinition(
    skillId: string,
    version: number,
  ): Promise<MatureSkillDefinition | null>
}

export interface PublishedCombatContentSource {
  findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null>
  findCurrentSkills?(
    contentKeys: readonly string[],
  ): Promise<readonly CombatContentVersionRecord[]>
  findSkillVersion(
    contentKey: string,
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

function parseVersionRow(data: unknown): CombatContentVersionRecord | null {
  if (data === null || (Array.isArray(data) && data.length === 0)) return null
  const row = Array.isArray(data) && data.length === 1 ? data[0] : null
  if (
    !isObject(row) ||
    !requiredString(row.id) ||
    !requiredString(row.content_key) ||
    row.content_kind !== 'skill' ||
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
    contentKind: 'skill',
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

  async findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null> {
    const { data, error } = await this.#rpc('read_current_combat_content_v1', {
      p_content_key: contentKey,
      p_content_kind: 'skill',
    })
    if (error) mapRpcFailure(error)
    return parseVersionRow(data)
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
    for (const context of ['pve', 'pvp'] as const) {
      validateCombatActionDefinition(toCombatActionDefinition(candidate, context))
    }
  } catch (error) {
    throw new InvalidPublishedCombatContentError(
      `Published Skill ${expectedSkillId}@${record.contentVersion} failed combat-action validation.`,
      { cause: error },
    )
  }

  return structuredClone(candidate)
}

export function createCombatContentResolver(
  source: PublishedCombatContentSource,
): CombatContentResolver {
  async function resolveCurrentSkillDefinitions(
    skillIds: readonly string[],
  ): Promise<ReadonlyMap<string, MatureSkillDefinition>> {
    const uniqueSkillIds = [...new Set(skillIds)]
    if (uniqueSkillIds.length === 0) return new Map()

    const publishedRows = source.findCurrentSkills
      ? await source.findCurrentSkills(uniqueSkillIds)
      : (
          await Promise.all(
            uniqueSkillIds.map((skillId) => source.findCurrentSkill(skillId)),
          )
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
  }
}

export function deriveSkillPresentationTags(definition: MatureSkillDefinition): readonly string[] {
  return combatActionPresentationTags(toCombatActionDefinition(definition, 'pve'))
}

export function createServerCombatContentResolver(): CombatContentResolver {
  const client = createSupabaseAdminClient()
  const source = new RpcPublishedCombatContentSource(
    (functionName, parameters) =>
      client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
  )
  return createCombatContentResolver(source)
}
