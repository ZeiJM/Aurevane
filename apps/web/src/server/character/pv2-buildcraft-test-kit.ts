import 'server-only'

import { P33_REPRESENTATIVE_DISCIPLINE_SKILLS } from '@aurevane/game-core/combat/mature-skills'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const PV2_TEST_DISCIPLINES = ['vanguard', 'lifebinder'] as const
const PV2_TEST_SOURCE_ID = 'pv2-buildcraft-test-kit:v1'
const PV2_TEST_PREVIEW_BRANCH = 'agent/p3-8-representative-buildcraft-slice'

export interface Pv2BuildcraftTestKitResult {
  readonly masteredDisciplines: number
  readonly learnedSkills: number
}

export function isPv2BuildcraftTestKitEnabled(): boolean {
  if (process.env.AUREVANE_PV2_TEST_MODE === '1') return true
  return (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === PV2_TEST_PREVIEW_BRANCH
  )
}

export async function preparePv2BuildcraftTestKit(
  userId: string,
  characterId: string,
): Promise<Pv2BuildcraftTestKitResult> {
  if (!isPv2BuildcraftTestKitEnabled()) {
    throw new AurevaneError('INVALID_REQUEST', 'The PV-2 buildcraft test kit is not available.')
  }

  const supabase = createSupabaseAdminClient()

  const { data: ownedBuild, error: ownershipError } = await supabase.rpc(
    'get_character_active_build_v2',
    {
      p_user_id: userId,
      p_character_id: characterId,
    },
  )
  if (ownershipError || !Array.isArray(ownedBuild) || ownedBuild.length !== 1) {
    throw new AurevaneError('INVALID_REQUEST', 'The selected character is not available.')
  }

  for (const disciplineId of PV2_TEST_DISCIPLINES) {
    const { error } = await supabase.rpc('record_character_discipline_mastery_v1', {
      p_character_id: characterId,
      p_discipline_id: disciplineId,
      p_source_kind: 'support',
      p_source_id: PV2_TEST_SOURCE_ID,
    })
    if (error) throw persistenceUnavailable()
  }

  const representativeSkills = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.filter(
    (skill) =>
      skill.enabled &&
      PV2_TEST_DISCIPLINES.some((disciplineId) => disciplineId === skill.sourceDisciplineId),
  )

  for (const skill of representativeSkills) {
    const { error } = await supabase.rpc('record_character_skill_unlock_v1', {
      p_character_id: characterId,
      p_skill_id: skill.id,
      p_skill_content_version: skill.contentVersion,
      p_source_discipline_id: skill.sourceDisciplineId,
      p_source_kind: 'support',
      p_source_id: PV2_TEST_SOURCE_ID,
    })
    if (error) throw persistenceUnavailable()
  }

  return {
    masteredDisciplines: PV2_TEST_DISCIPLINES.length,
    learnedSkills: representativeSkills.length,
  }
}

function persistenceUnavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'The PV-2 test kit could not be prepared. Nothing should be assumed from a partial response.',
  )
}
