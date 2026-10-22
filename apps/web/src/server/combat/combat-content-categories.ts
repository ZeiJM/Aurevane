import type {
  CombatContentDefinition,
  CombatContentKind,
  CombatContentVersionRecord,
} from '@aurevane/db/combat-content'
import {
  NONCOMBAT_CONTENT_KINDS,
  parseNoncombatContentDefinition,
  noncombatPublicationBlocker,
  assertDisciplinePublicationReady,
} from '@aurevane/game-core/content/authored-content'
import {
  EFFECT_PROFILE_AUTHORING_BLOCKER,
  parseStoredStatusDefinition,
  retainOpaqueEffectProfile,
} from './combat-standalone-content'
import {
  isBasicSkillId,
  validatePublishedBasicSkill,
  validatePublishedSkill,
  validatePublishedEssence,
  validatePublishedResonance,
} from './combat-content-published-validation'
import {
  validateSkillDefinition,
  validateEssenceAuthoringDefinition,
  validateResonanceAuthoringDefinition,
} from '../master/combat-content-authoring-validation'
import type { CombatContentValidationResult } from '../master/combat-content-authoring-service'

export interface CombatContentCategoryDescriptor {
  readonly category: CombatContentKind | 'basic'
  readonly storedKind: CombatContentKind
  readonly identityField: 'id' | 'essenceId' | null
  readonly runtime: 'combat' | 'container' | 'unsupported'
  readonly catalogueProjection: 'combat' | 'opaque' | 'container'
  readonly authoringBlocker: typeof EFFECT_PROFILE_AUTHORING_BLOCKER | null
  readonly publicationBlocker: { readonly code: string; readonly message: string } | null
  validatePublication?(value: unknown): void
  parseAuthoring(value: unknown): CombatContentDefinition
  parseRetained(value: unknown, key: string, version?: number): CombatContentDefinition
  parsePublished(record: CombatContentVersionRecord): CombatContentDefinition
}
function object(value: unknown): asserts value is CombatContentDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('A complete content definition is required.')
}
function validated(validator: (value: unknown) => CombatContentValidationResult) {
  return (value: unknown): CombatContentDefinition => {
    const result = validator(value)
    if (!result.valid)
      throw new TypeError(result.issues[0]?.message ?? 'The complete definition is invalid.')
    object(value)
    return structuredClone(value)
  }
}
function descriptor(
  input: Omit<CombatContentCategoryDescriptor, 'parseRetained' | 'parsePublished'> & {
    parsePublished?: CombatContentCategoryDescriptor['parsePublished']
    parseRetainedBody?(value: unknown, key: string, version?: number): CombatContentDefinition
  },
): CombatContentCategoryDescriptor {
  const { parseRetainedBody, ...entry } = input
  const result: CombatContentCategoryDescriptor = {
    ...entry,
    parsePublished(record) {
      return input.parsePublished
        ? input.parsePublished(record)
        : result.parseRetained(record.definition, record.contentKey, record.contentVersion)
    },
    parseRetained(value: unknown, key: string, version?: number) {
      const definition = parseRetainedBody ? parseRetainedBody(value, key, version) : value
      object(definition)
      if (
        entry.identityField !== null &&
        (definition[entry.identityField] !== key ||
          (version !== undefined &&
            definition.contentVersion !== undefined &&
            definition.contentVersion !== version))
      )
        throw new TypeError('Content definition identity or publication version mismatch.')
      return structuredClone(definition)
    },
  }
  return Object.freeze(result)
}
const skillAuthoring = validated(validateSkillDefinition)
export const COMBAT_CONTENT_CATEGORIES: readonly CombatContentCategoryDescriptor[] = Object.freeze([
  descriptor({
    category: 'basic',
    storedKind: 'skill',
    identityField: 'id',
    runtime: 'combat',
    catalogueProjection: 'combat',
    authoringBlocker: null,
    publicationBlocker: null,
    parseAuthoring: skillAuthoring,
    parsePublished(record) {
      if (!isBasicSkillId(record.contentKey))
        throw new TypeError('Unknown reserved Basic identity.')
      return { ...validatePublishedBasicSkill(record, record.contentKey) }
    },
  }),
  descriptor({
    category: 'skill',
    storedKind: 'skill',
    identityField: 'id',
    runtime: 'combat',
    catalogueProjection: 'combat',
    authoringBlocker: null,
    publicationBlocker: null,
    parseAuthoring: skillAuthoring,
    parsePublished: (record) => ({ ...validatePublishedSkill(record, record.contentKey) }),
  }),
  descriptor({
    category: 'essence',
    storedKind: 'essence',
    identityField: 'essenceId',
    runtime: 'combat',
    catalogueProjection: 'combat',
    authoringBlocker: null,
    publicationBlocker: null,
    parseAuthoring: validated(validateEssenceAuthoringDefinition),
    parsePublished: (record) => ({ ...validatePublishedEssence(record, record.contentKey) }),
  }),
  descriptor({
    category: 'resonance',
    storedKind: 'resonance',
    identityField: 'id',
    runtime: 'combat',
    catalogueProjection: 'combat',
    authoringBlocker: null,
    publicationBlocker: null,
    parseAuthoring: validated(validateResonanceAuthoringDefinition),
    parsePublished: (record) => ({ ...validatePublishedResonance(record, record.contentKey) }),
  }),
  descriptor({
    category: 'status',
    storedKind: 'status',
    identityField: 'id',
    runtime: 'combat',
    catalogueProjection: 'combat',
    authoringBlocker: null,
    publicationBlocker: null,
    parseAuthoring: parseStoredStatusDefinition,
    parseRetainedBody: parseStoredStatusDefinition,
  }),
  descriptor({
    category: 'effect-profile',
    storedKind: 'effect-profile',
    identityField: null,
    runtime: 'unsupported',
    catalogueProjection: 'opaque',
    authoringBlocker: EFFECT_PROFILE_AUTHORING_BLOCKER,
    publicationBlocker: EFFECT_PROFILE_AUTHORING_BLOCKER,
    parseAuthoring() {
      throw new TypeError(EFFECT_PROFILE_AUTHORING_BLOCKER.message)
    },
    parseRetainedBody: retainOpaqueEffectProfile,
    parsePublished: (record) =>
      retainOpaqueEffectProfile(record.definition, record.contentKey, record.contentVersion),
  }),
  ...NONCOMBAT_CONTENT_KINDS.map((kind) =>
    descriptor({
      category: kind,
      storedKind: kind,
      identityField: 'id',
      runtime: kind === 'discipline' ? 'container' : 'unsupported',
      catalogueProjection: 'container',
      authoringBlocker: null,
      publicationBlocker: kind === 'discipline' ? null : noncombatPublicationBlocker(kind),
      ...(kind === 'discipline' ? { validatePublication: assertDisciplinePublicationReady } : {}),
      parseAuthoring: (value) => ({ ...parseNoncombatContentDefinition(kind, value) }),
      parseRetainedBody: (value) => ({ ...parseNoncombatContentDefinition(kind, value) }),
    }),
  ),
])
const categories = new Map(COMBAT_CONTENT_CATEGORIES.map((entry) => [entry.category, entry]))
/** One backend identity/validator/capability registry; caller-specific UI fields are Stage D. */
export function combatContentCategory(
  kind: unknown,
  key?: string,
): CombatContentCategoryDescriptor | null {
  if (kind === 'skill' && key !== undefined && isBasicSkillId(key)) return categories.get('basic')!
  return typeof kind === 'string' && kind !== 'basic'
    ? (categories.get(kind as CombatContentKind) ?? null)
    : null
}
