import { describe, expect, it } from 'vitest'

interface PublicIdentityRow {
  id: string
  portrait_ref: string | null
  foundation_discipline_id: string | null
  personal_title: string | null
}

function project(row: PublicIdentityRow) {
  return {
    portraitRef: row.portrait_ref,
    disciplineId: row.foundation_discipline_id,
    personalTitle: row.personal_title,
  }
}

describe('public character identity projection', () => {
  it('uses the canonical foundation discipline field alongside the personal title', () => {
    expect(
      project({
        id: '00000000-0000-0000-0000-000000000001',
        portrait_ref: 'portrait.starter.wayfarer-01',
        foundation_discipline_id: 'aetherist',
        personal_title: 'Frost Shadow',
      }),
    ).toEqual({
      portraitRef: 'portrait.starter.wayfarer-01',
      disciplineId: 'aetherist',
      personalTitle: 'Frost Shadow',
    })
  })
})
