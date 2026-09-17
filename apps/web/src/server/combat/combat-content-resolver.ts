import 'server-only'

import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import { combatActionPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface CombatContentResolver {
  resolveCurrentSkillDefinition(skillId: string): Promise<MatureSkillDefinition | null>
  resolvePinnedSkillDefinition(
    skillId: string,
    version: number,
  ): Promise<MatureSkillDefinition | null>
}

export interface PublishedCombatContentSource {
  findCurrentSkill(contentKey: string): Promise<CombatContentVersionRecord | null>
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

  return structuredClone(candidate)
}

export function createCombatContentResolver(
  source: PublishedCombatContentSource,
): CombatContentResolver {
  return {
    async resolveCurrentSkillDefinition(skillId) {
      const published = await source.findCurrentSkill(skillId)
      if (published) return validatePublishedSkill(published, skillId)
      const fallback = resolveMatureSkillVersion(skillId)
      return fallback ? structuredClone(fallback) : null
    },

    async resolvePinnedSkillDefinition(skillId, version) {
      const published = await source.findSkillVersion(skillId, version)
      if (published) return validatePublishedSkill(published, skillId, version)
      const fallback = resolveMatureSkillVersion(skillId, version)
      return fallback ? structuredClone(fallback) : null
    },
  }
}

export function deriveSkillPresentationTags(
  definition: MatureSkillDefinition,
): readonly string[] {
  return combatActionPresentationTags(toCombatActionDefinition(definition, 'pve'))
}

export function createServerCombatContentResolver(): CombatContentResolver {
  const client = createSupabaseAdminClient()
  const source = new RpcPublishedCombatContentSource((functionName, parameters) =>
    client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
  )
  return createCombatContentResolver(source)
}
