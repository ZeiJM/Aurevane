import 'server-only'
import {
  DISCIPLINE_ATLAS,
  type DisciplineAtlasEntry,
  type DisciplineUnlockRule,
} from '@aurevane/game-core/character/discipline-atlas'
import {
  parseNoncombatContentDefinition,
  type AuthoredDiscipline,
} from '@aurevane/game-core/content/authored-content'
import { disciplineAttributePolicyFromCore } from '@aurevane/game-core/character/attribute-allocation'
import {
  FOUNDATION_DISCIPLINES,
  type FoundationBaseAttributes,
  type FoundationAttributeId,
  type FoundationStartingAttributeBonuses,
} from '@aurevane/game-core/character/foundation-disciplines'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
export interface PublishedPrimaryDiscipline {
  id: string
  name: string
  summary: string
  profileVersion: number
  definitionVersion: number
  enabledForPrimary: boolean
  enabledForSecondary: boolean
  authoredDefinition: AuthoredDiscipline | null
  nativeUnlock: DisciplineUnlockRule | null
  baseAttributes: FoundationBaseAttributes
  focusAttributes: readonly FoundationAttributeId[]
}
export interface PublishedFoundationDiscipline extends Omit<
  PublishedPrimaryDiscipline,
  'authoredDefinition' | 'nativeUnlock'
> {
  startingAttributeBonuses: FoundationStartingAttributeBonuses
}
export async function loadPublishedPrimaryDisciplines(): Promise<PublishedPrimaryDiscipline[]> {
  const { data, error } = await createSupabaseAdminClient().rpc('get_current_discipline_catalog_v1')
  const unavailable = () =>
    new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The current Discipline catalogue is unavailable.')
  if (error || !Array.isArray(data)) throw unavailable()
  return data.map((row: Record<string, unknown>) => {
    if (
      typeof row.discipline_id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.summary !== 'string' ||
      typeof row.enabled_for_primary !== 'boolean' ||
      typeof row.enabled_for_secondary !== 'boolean' ||
      !Number.isSafeInteger(row.profile_version) ||
      !Number.isSafeInteger(row.definition_version)
    )
      throw unavailable()
    const policy = disciplineAttributePolicyFromCore(
      row.discipline_id,
      row.profile_version as number,
      row.core_base_attributes,
      row.focus_attributes,
      row.off_focus_cap,
    )
    if (!policy) throw unavailable()
    const authoredDefinition =
      row.authored_definition == null
        ? null
        : (parseNoncombatContentDefinition(
            'discipline',
            row.authored_definition,
          ) as AuthoredDiscipline)
    if (
      authoredDefinition &&
      (authoredDefinition.id !== row.discipline_id ||
        authoredDefinition.contentVersion !== row.definition_version ||
        !authoredDefinition.atlas ||
        authoredDefinition.unlock.kind === 'unavailable')
    )
      throw unavailable()
    return {
      enabledForPrimary: row.enabled_for_primary,
      enabledForSecondary: row.enabled_for_secondary,
      authoredDefinition,
      nativeUnlock: (row.native_unlock ?? null) as DisciplineUnlockRule | null,
      id: row.discipline_id,
      name: row.name,
      summary: row.summary,
      profileVersion: row.profile_version as number,
      definitionVersion: row.definition_version as number,
      baseAttributes: policy.baseAttributes,
      focusAttributes: policy.focusAttributes,
    }
  })
}
export async function loadPublishedFoundations(): Promise<PublishedFoundationDiscipline[]> {
  const current = await loadPublishedPrimaryDisciplines()
  return FOUNDATION_DISCIPLINES.flatMap((legacy) => {
    const row = current.find(
      (candidate) => candidate.id === legacy.id && candidate.enabledForPrimary,
    )
    return row
      ? [
          {
            id: row.id,
            name: row.name,
            summary: row.summary,
            profileVersion: row.profileVersion,
            definitionVersion: row.definitionVersion,
            enabledForPrimary: row.enabledForPrimary,
            enabledForSecondary: row.enabledForSecondary,
            baseAttributes: row.baseAttributes,
            focusAttributes: row.focusAttributes,
            startingAttributeBonuses: legacy.startingAttributeBonuses,
          },
        ]
      : []
  })
}

export async function loadPublishedDisciplineAtlas(): Promise<DisciplineAtlasEntry[]> {
  const current = await loadPublishedPrimaryDisciplines()
  return [
    ...current.map((row) => {
      const authored = row.authoredDefinition
      if (authored?.atlas && authored.unlock.kind !== 'unavailable')
        return {
          id: row.id,
          name: row.name,
          summary: row.summary,
          publication: 'published' as const,
          ...authored.atlas,
          unlock: authored.unlock,
        }
      const native = DISCIPLINE_ATLAS.find((entry) => entry.id === row.id)
      if (!native || !row.nativeUnlock)
        throw new AurevaneError(
          'PERSISTENCE_UNAVAILABLE',
          'Discipline Atlas metadata is unavailable.',
        )
      return {
        ...native,
        name: row.name,
        summary: row.summary,
        unlock: row.nativeUnlock,
        publication: 'published' as const,
      }
    }),
    ...DISCIPLINE_ATLAS.filter(
      (entry) => entry.publication === 'planned' && !current.some((row) => row.id === entry.id),
    ),
  ]
}
