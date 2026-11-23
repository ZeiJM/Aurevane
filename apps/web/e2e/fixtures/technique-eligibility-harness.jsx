import React from 'react'
import { createRoot } from 'react-dom/client'
import { CharacterSkillBuildPanel } from '@/components/character/character-skill-build-panel'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import './production-styles'

const params = new URLSearchParams(location.search)
const pure = params.has('pure')
const primaryDisciplineId = params.get('discipline') === 'ironfist' ? 'ironfist' : 'vanguard'
const learned = latestEnabledMatureSkills()
  .filter((definition) => definition.sourceDisciplineId === primaryDisciplineId)
  .map((definition, index) => ({
    definition:
      primaryDisciplineId === 'vanguard' && index === 7
        ? { ...definition, name: 'Sweeping Strike — A Long Shared Technique Identity' }
        : definition,
    activeSource: true,
    learnedAt: '2026-10-20T00:00:00Z',
    eligibilityGrants: (pure ? [primaryDisciplineId] : [primaryDisciplineId, 'lifebinder']).map(
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
window.fetch = async (url, options) => {
  if (url === '/api/character/items' && !options?.body) {
    if (params.has('equipmentReadError'))
      return Response.json({ error: { message: 'Equipment unavailable.' } }, { status: 503 })
    return Response.json({
      view: {
        characterId: 'character-a',
        revision: 0,
        catalogueToken: 'empty-items',
        battleLocked: false,
        qualityPoints: 0,
        qualityPointLimit: 100,
        equipmentIssue: null,
        equipment: {},
        selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
        stacks: [],
        notices: [],
      },
    })
  }
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
      build: { buildVersion, supportActionId: 'basic.recover' },
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
    primaryDiscipline={{
      id: primaryDisciplineId,
      name: primaryDisciplineId === 'ironfist' ? 'Ironfist' : 'Vanguard',
    }}
    secondaryDiscipline={pure ? null : { id: 'lifebinder', name: 'Lifebinder' }}
    initialCapacity={4}
    initialLearnedSkills={learned}
    initialEquippedSkills={[]}
    initialResonance={null}
    initialEssence={null}
  />,
)
