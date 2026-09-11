import {
  PURE_DISCIPLINE_SKILL_CAPACITY,
  MIXED_DISCIPLINE_SKILL_CAPACITY,
} from '@aurevane/game-core/character/discipline-skill-loadout'
import { CHARACTER_CREATION_RULES_V1 } from '@aurevane/game-core/character/creation'
import { CURRENT_LEVEL_CAP } from '@aurevane/game-core/character/progression'
import { PV1F_MOVEMENT_COST_PER_TERRAIN_POINT } from '@aurevane/game-core/combat/pv1f-skills'
import { describe, expect, it } from 'vitest'

import { currentManualArticles, findCurrentManualArticle } from './current-manual'

function articleText(slug: string): string {
  const article = findCurrentManualArticle(slug)
  expect(article).not.toBeNull()
  return JSON.stringify(article)
}

describe('published Manual rule consistency', () => {
  it('uses the current progression cap and preserves XP authority', () => {
    const text = articleText('character-xp')
    expect(text).toContain(`Level ${CURRENT_LEVEL_CAP}`)
    expect(text).toContain('retries or concurrent requests do not duplicate')
    expect(text).not.toMatch(/1[–-]100|Level 100/)
  })

  it('explains both movement costs and the independent Movement allowance', () => {
    const text = articleText('battle-hall')
    expect(text).toContain(`${PV1F_MOVEMENT_COST_PER_TERRAIN_POINT} AP per tile`)
    expect(text).toContain(`costs ${2 * PV1F_MOVEMENT_COST_PER_TERRAIN_POINT} AP`)
    expect(text).toContain('even when AP remains')
    expect(text).not.toContain('25 AP')
    expect(articleText('glossary')).toContain(`${PV1F_MOVEMENT_COST_PER_TERRAIN_POINT} AP`)
  })

  it('describes personal creation points separately from the Primary base', () => {
    const text = articleText('character-creation')
    expect(text).toContain(`${CHARACTER_CREATION_RULES_V1.attributes.bonusBudget} personal points`)
    expect(text).toContain('fixed Core Stat base')
    expect(text).not.toContain('each begin at 5')
    expect(text).not.toContain('no more than 4 bonus points')
  })

  it('distinguishes learned libraries from current selected capacity and repeat-use rules', () => {
    const text = articleText('start-here')
    expect(text).toContain(`Pure builds select up to ${PURE_DISCIPLINE_SKILL_CAPACITY}`)
    expect(text).toContain(`Mixed builds select up to ${MIXED_DISCIPLINE_SKILL_CAPACITY}`)
    expect(text).toContain('1+3, 2+2 or 3+1')
    expect(text).not.toContain('up to eight learned')
    expect(text).not.toContain('six total Discipline')
    const combat = articleText('battle-hall')
    expect(combat).toContain('50% effectiveness at the normal AP cost')
    expect(combat).toContain('ending a turn alone does not')
  })

  it('credits delivered buildcraft and PvP without promising complete content', () => {
    expect(articleText('start-here')).toContain('already testable')
    expect(articleText('character-creation')).toContain(
      'six Foundations and ten advanced Disciplines each have eight learnable Techniques',
    )
    expect(articleText('character-creation')).toContain(
      'Mastery Trials unlock advanced Disciplines',
    )
    expect(articleText('battle-hall')).toContain('Ranked matchmaking and seasons remain future')
    expect(JSON.stringify(currentManualArticles)).not.toContain('until multiplayer combat exists')
  })
})
