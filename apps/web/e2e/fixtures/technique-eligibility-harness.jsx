import React from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import './production-styles'

const pure = new URLSearchParams(location.search).has('pure')
const learned = latestEnabledMatureSkills()
  .filter((definition) => definition.sourceDisciplineId === 'vanguard')
  .map((definition, index) => ({
    definition:
      index === 7
        ? { ...definition, name: 'Sweeping Strike — A Long Shared Technique Identity' }
        : definition,
    activeSource: true,
    learnedAt: '2026-10-20T00:00:00Z',
    eligibilityGrants: (pure ? ['vanguard'] : ['vanguard', 'lifebinder']).map(
      (eligibilityDisciplineId) => ({
        eligibilityDisciplineId,
        activeSource: true,
        earnedAt: '2026-10-20T00:00:00Z',
      }),
    ),
  }))
window.calls = []
window.fixtureSkills = learned.map(({ definition }) => ({
  id: definition.id,
}))
let buildVersion = 1
// Only the HTTP response boundary is supplied. Component selection, payload and reconciliation are real.
window.fetch = async (_url, options) => {
  const payload = JSON.parse(options.body)
  window.calls.push(payload)
  if (window.rejectNext || payload.expectedBuildVersion !== buildVersion) {
    window.rejectNext = false
    return Response.json(
      { error: { message: 'Build changed. Refresh and try again.' } },
      { status: 409 },
    )
  }
  buildVersion += 1
  return Response.json({
    context: {
      build: { buildVersion, supportActionId: 'basic.guard' },
      disciplineSkills: {
        capacity: 4,
        learnedSkills: learned,
        equippedSkills: payload.skillIds.map((id, slotIndex) => ({
          definition: learned.find((entry) => entry.definition.id === id).definition,
          slotIndex,
          equippedAt: '2026-10-25T00:00:00Z',
          eligibilityDisciplineId: payload.eligibilitySelections.find(
            (entry) => entry.skillId === id,
          ).eligibilityDisciplineId,
        })),
      },
    },
  })
}
createRoot(document.getElementById('root')).render(
  <CharacterSkillBuildPanel
    characterId="character-a"
    initialBuildVersion={1}
    primaryDiscipline={{ id: 'vanguard', name: 'Vanguard' }}
    secondaryDiscipline={pure ? null : { id: 'lifebinder', name: 'Lifebinder' }}
    initialCapacity={4}
    initialLearnedSkills={learned}
    initialEquippedSkills={[]}
    initialResonance={null}
    initialEssence={null}
  />,
)
