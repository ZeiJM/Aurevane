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

  it('credits delivered buildcraft and PvP without promising complete content', () => {
    expect(articleText('start-here')).toContain('already testable')
    expect(articleText('character-creation')).toContain('Ironfist content remains incomplete')
    expect(articleText('battle-hall')).toContain('Ranked matchmaking and seasons remain future')
    expect(JSON.stringify(currentManualArticles)).not.toContain('until multiplayer combat exists')
  })
})
