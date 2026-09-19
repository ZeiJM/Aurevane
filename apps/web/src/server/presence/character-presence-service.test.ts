import { describe, expect, it } from 'vitest'

interface PublicIdentityRow {
  id: string
  portrait_ref: string | null
  foundation_discipline_id: string | null
  personal_title: string | null
}

interface PublicBuildIdentityRow {
  character_id: string
  primary_discipline_id: string
  secondary_discipline_id: string | null
}

function project(identity: PublicIdentityRow, build: PublicBuildIdentityRow) {
  return {
    portraitRef: identity.portrait_ref,
    disciplineId: build.primary_discipline_id,
    secondaryDisciplineId: build.secondary_discipline_id,
    personalTitle: identity.personal_title,
  }
}

describe('public character identity projection', () => {
  it('uses the committed Primary and Secondary Disciplines instead of the stale foundation field', () => {
    expect(
      project(
        {
          id: '00000000-0000-0000-0000-000000000001',
          portrait_ref: 'portrait.starter.wayfarer-01',
          foundation_discipline_id: 'vanguard',
          personal_title: 'Frost Shadow',
        },
        {
          character_id: '00000000-0000-0000-0000-000000000001',
          primary_discipline_id: 'cinderweaver',
          secondary_discipline_id: 'lifebinder',
        },
      ),
    ).toEqual({
      portraitRef: 'portrait.starter.wayfarer-01',
      disciplineId: 'cinderweaver',
      secondaryDisciplineId: 'lifebinder',
      personalTitle: 'Frost Shadow',
    })
  })
})
