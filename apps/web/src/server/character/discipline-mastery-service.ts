import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export interface DisciplineMasteryProgress {
  disciplineId: string
  xp: number
  stage: number
  unlocked: boolean
  demonstratedSkillCount: number
}
export async function loadDisciplineMastery(
  userId: string,
  characterId: string,
): Promise<DisciplineMasteryProgress[]> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    'get_character_discipline_progress_v1',
    { p_user_id: userId, p_character_id: characterId },
  )
  if (error || !Array.isArray(data))
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'Discipline Mastery is temporarily unavailable.',
    )
  return data.map(
    (row: {
      discipline_id: string
      mastery_xp: number
      stage: number
      unlocked: boolean
      demonstrated_skill_count: number
    }) => ({
      disciplineId: row.discipline_id,
      xp: row.mastery_xp,
      stage: row.stage,
      unlocked: row.unlocked,
      demonstratedSkillCount: row.demonstrated_skill_count,
    }),
  )
}
const claimErrors: Record<string, string> = {
  MASTERY_TRIAL_REQUIRED: 'Only a Standard or High Discipline Mastery Trial awards Mastery.',
  TRIAL_VICTORY_REQUIRED: 'Win the Mastery Trial before claiming its result.',
  TRIAL_TIMEOUT_DISQUALIFIED:
    'This trial included an expired player turn timer. Complete another trial without timing out.',
  TRIAL_SKILL_VARIETY_REQUIRED:
    'Use at least two different Primary Skills across at least three Skill commands, then win the trial.',
  TRIAL_COMMITTED_BUILD_REQUIRED: 'This trial has no eligible committed Discipline build.',
}
export async function claimDisciplineTrial(userId: string, battleSessionId: string) {
  // The database derives eligibility and XP from immutable snapshots and committed events.
  // Neither the browser nor this boundary supplies rewards, outcomes or a Discipline ID.
  const { data, error } = await createSupabaseAdminClient().rpc('claim_discipline_trial_v1', {
    p_user_id: userId,
    p_battle_session_id: battleSessionId,
  })
  if (error) {
    if (error.message.includes('TRIAL_NOT_FOUND'))
      throw new AurevaneError('FORBIDDEN', 'That trial is unavailable to this account.')
    const message = Object.entries(claimErrors).find(([code]) => error.message.includes(code))?.[1]
    if (message) throw new AurevaneError('INVALID_REQUEST', message)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The Mastery result could not be saved. You can safely retry.',
    )
  }
  if (!Array.isArray(data) || data.length !== 1)
    throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'The Mastery result is unavailable.')
  const row = data[0] as {
    discipline_id: string
    awarded_xp: number
    mastery_xp: number
    stage: number
    replayed: boolean
  }
  return {
    disciplineId: row.discipline_id,
    awardedXp: row.awarded_xp,
    xp: row.mastery_xp,
    stage: row.stage,
    replayed: row.replayed,
  }
}
