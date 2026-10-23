import { loadPublishedDisciplineAtlas } from '@/server/character/published-discipline-catalogue'
import {
  describeDisciplineUnlockRule,
  evaluateDisciplineAtlasEntry,
  rekindlingCountFromCycleNumber,
  type DisciplineMasteryStage,
} from '@aurevane/game-core/character/discipline-atlas'
import { AurevaneError } from '@aurevane/game-core/errors'

import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadDisciplineMastery } from '@/server/character/discipline-mastery-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { toServerErrorResponse } from '@/server/http/error-response'

export async function GET() {
  try {
    const actor = await getAuthenticatedActor()
    const character = await loadSelectedCharacter(actor)
    if (!character) throw new AurevaneError('FORBIDDEN', 'Select your character first.')

    const [progress, disciplines] = await Promise.all([
      loadDisciplineMastery(actor.userId, character.id),
      loadPublishedDisciplineAtlas(),
    ])
    const testingAccess = progress.some((row) => row.testingAccess)
    const rekindlingCount = rekindlingCountFromCycleNumber(character.progressionCycle.number)
    const masteryByDiscipline = Object.fromEntries(
      progress.map((row) => [row.disciplineId, row.stage]),
    ) as Record<string, DisciplineMasteryStage>
    const progressByDiscipline = new Map(progress.map((row) => [row.disciplineId, row]))

    const entries = disciplines.map((discipline, index) => {
      const evaluation = evaluateDisciplineAtlasEntry(discipline, {
        masteryByDiscipline,
        rekindlingCount,
        testingAccess,
      })
      const mastery = progressByDiscipline.get(discipline.id)
      const keepVeiled =
        discipline.disclosure === 'secret' &&
        discipline.publication === 'planned' &&
        evaluation.state !== 'unlocked'

      if (keepVeiled) {
        return {
          key: `veiled:${discipline.band}:${index}`,
          disciplineId: null,
          name: 'Veiled Discipline',
          summary: 'A hidden combat tradition whose path has not yet been uncovered.',
          family: discipline.family,
          band: discipline.band,
          publication: discipline.publication,
          state: 'veiled' as const,
          releaseEligible: false,
          effectiveSelectable: false,
          requirementSummary: 'Discovery required',
          unmetRequirements: ['Discovery required'],
          masteryRite: null,
          power: null,
          mastery: null,
        }
      }

      return {
        key: discipline.id,
        disciplineId: discipline.id,
        name: discipline.name,
        summary: discipline.summary,
        family: discipline.family,
        band: discipline.band,
        publication: discipline.publication,
        state: mastery
          ? mastery.releaseUnlocked
            ? 'unlocked'
            : mastery.unlocked
              ? 'testing'
              : evaluation.state
          : discipline.publication === 'published'
            ? 'revealed'
            : evaluation.state,
        releaseEligible:
          mastery?.releaseUnlocked ??
          (discipline.publication === 'planned' && evaluation.releaseEligible),
        effectiveSelectable:
          mastery?.unlocked ??
          (discipline.publication === 'planned' && evaluation.effectiveSelectable),
        requirementSummary: describeDisciplineUnlockRule(discipline.unlock),
        unmetRequirements: evaluation.unmetRequirements,
        masteryRite: discipline.masteryRite ?? null,
        power: discipline.power,
        mastery: mastery
          ? {
              xp: mastery.xp,
              stage: mastery.stage,
              demonstratedSkillCount: mastery.demonstratedSkillCount,
              earnedSkillCount: mastery.earnedSkillCount,
              unearnedSkillCount: mastery.unearnedSkillCount,
            }
          : null,
      }
    })

    return Response.json(
      {
        progress,
        atlas: {
          progressionCycleNumber: character.progressionCycle.number,
          rekindlingCount,
          testingAccess,
          totalDisciplines: disciplines.length,
          publishedDisciplines: disciplines.filter(
            (discipline) => discipline.publication === 'published',
          ).length,
          entries,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return toServerErrorResponse(error)
  }
}
