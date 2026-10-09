import {
  PURE_DISCIPLINE_SKILL_CAPACITY,
  MIXED_DISCIPLINE_SKILL_CAPACITY,
} from '@aurevane/game-core/character/discipline-skill-loadout'
import {
  FOUNDATION_FOCUS_ATTRIBUTE_CAP,
  FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP,
} from '@aurevane/game-core/character/attribute-allocation'
import { CHARACTER_CREATION_RULES_V1 } from '@aurevane/game-core/character/creation'
import { CURRENT_LEVEL_CAP } from '@aurevane/game-core/character/progression'
import { PV1F_MOVEMENT_COST_PER_TERRAIN_POINT } from '@aurevane/game-core/combat/pv1f-skills'
import { standardSkillDamageScaling } from '@aurevane/game-core/combat/damage-scaling'
import { describe, expect, it } from 'vitest'

import { currentManualArticles, findCurrentManualArticle } from './current-manual'

function articleText(slug: string): string {
  const article = findCurrentManualArticle(slug)
  expect(article).not.toBeNull()
  return JSON.stringify(article)
}

describe('published Manual rule consistency', () => {
  it('explains pinned pending activation, affected-turn expiry and the text chronicle', () => {
    const text = articleText('battle-hall')
    expect(text).toContain('following global round')
    expect(text).toContain('full stated global rounds')
    expect(text).toContain('scheduled affected-turn-end ticks')
    expect(text).toContain('direct damage and HP/MP recovery')
    expect(text).toContain('Battle Chronicle')
  })
  it('uses the current progression cap and preserves XP authority', () => {
    const text = articleText('character-xp')
    expect(text).toContain(`Level ${CURRENT_LEVEL_CAP}`)
    expect(text).toContain(`Level 1–${CURRENT_LEVEL_CAP}`)
    expect(text).toContain('Level-100 progression')
    expect(text).toContain('retries or concurrent requests do not duplicate')
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

  it('publishes the current Primary Core Stat caps', () => {
    const text = articleText('attributes-derived-stats')
    expect(text).toContain(
      `Primary focus Core Stats currently cap at ${FOUNDATION_FOCUS_ATTRIBUTE_CAP}`,
    )
    expect(text).toContain(
      `non-focus Core Stats currently cap at ${FOUNDATION_NON_FOCUS_ATTRIBUTE_CAP}`,
    )
  })

  it('distinguishes learned libraries from current selected capacity and repeat-use rules', () => {
    const text = articleText('start-here')
    expect(text).toContain(`Pure builds select up to ${PURE_DISCIPLINE_SKILL_CAPACITY}`)
    expect(text).toContain(`Mixed builds select up to ${MIXED_DISCIPLINE_SKILL_CAPACITY}`)
    expect(text).toContain('1+3, 2+2 or 3+1')
    expect(text).not.toContain('up to eight learned')
    expect(text).not.toContain('six total Discipline')
    const combat = articleText('battle-hall')
    expect(combat).toContain('authored cooldowns from 1 to 3 turns')
    expect(combat).toContain('previous consecutive-use 50% effectiveness rule is retired')
    expect(combat).not.toContain('costs and consecutive-use reduction')
  })

  it('credits delivered buildcraft and PvP without promising complete content', () => {
    expect(articleText('start-here')).toContain('already testable')
    expect(articleText('character-creation')).toContain(
      'Published mature Disciplines have eight learnable Techniques and a pure Essence',
    )
    expect(articleText('character-creation')).toContain(
      'Mastery Trials and the Discipline Atlas track the eventual acquisition paths',
    )
    expect(articleText('character-creation')).toContain(
      'without counting that access as earned Mastery or satisfying its release requirements',
    )
    expect(articleText('battle-hall')).toContain('Ranked matchmaking and seasons remain future')
    expect(JSON.stringify(currentManualArticles)).not.toContain('until multiplayer combat exists')
  })
})

it('publishes the Techniques guide with ordinary per-packet Power scaling', () => {
  const text = articleText('techniques-damage-effects')
  expect(text).toContain('Techniques, Damage & Effects')
  expect(text).toContain('136')
  expect(text).toContain('0.01%')
  expect(text).toContain('65 AP')
  const powerTable = findCurrentManualArticle('techniques-damage-effects')!.body.find(
    (section) => section.id === 'power',
  )!.table!
  for (const row of powerTable.rows) {
    expect(row[1]).toBe(
      `${standardSkillDamageScaling('physical-power').coefficientBasisPoints / 100}%`,
    )
  }
  expect(text).not.toContain('AP-linked')
  expect(text).toContain('raw damage = 20')
  expect(text).toContain('22 HP')
  expect(text).toContain('hostile direct damage by 140%')
  expect(text).toContain('without the historical clamp')
  expect(text).toContain('Physical Defense')
  expect(text).toContain('Mystic Defense')
  expect(text).not.toContain('Apply Armor or Ward')
  expect(text).toContain('bounded authored power scale from 1 to 20')
  expect(articleText('attributes-derived-stats')).not.toContain(
    'Skill-wide Power contribution is 25%',
  )
  expect(text).not.toContain('before repeat-use reduction')
  expect(text).not.toContain('Prepare repeat-use reduction')
  expect(text).toContain('Essence and Resonance details in Nexus')
  expect(text).toContain('Hover the active Essence or Resonance artwork')
  expect(text).toContain('Resonance details use Setup, Trigger and Result')
  expect(text).toContain('Immediate Resonances have no Setup')
  expect(text).not.toContain('payoff Discipline/tags')
  expect(text).toContain('percentage of HP damage dealt by that attack')
  expect(text).toContain('including Push or Pull')
  expect(text).not.toContain('current v5 Skills can author Poison Power and duration')
  expect(text).toContain('HP Recovery [4%]')
  expect(text).toContain('MP Recovery [4%]')
  expect(text).toContain('captured at cast')
  expect(text).toContain('HP Hex once')
  expect(text).toContain('independent hit and critical')
  expect(text).toContain('Delayed activates two global rounds')
  expect(text).toContain('cast-position anchor')
  expect(text).not.toContain('Rewind moves you to your vacant turn-start tile')
})

it('documents Combat v5.1 reach, elevation, LOS, and compact targeting presentation', () => {
  const text = articleText('techniques-damage-effects')

  expect(text).toContain('Range shows only the maximum reach')
  expect(text).toContain('Target Method shows Single, Line [X], Circle [X] or All')
  expect(text).toContain('range 1–5')
  expect(text).toContain('eight surrounding tiles')
  expect(text).toContain('elevation 0')
  expect(text).toContain('elevation 1')
  expect(text).toContain('elevation 2')
  expect(text).toContain('line of sight')
  expect(text).toContain('Slow [+10 AP]')
  expect(text).not.toContain('Slow [+10 AP/tile]')
})

it('explains explicit elemental tags, stacked Drenched Initiative and caster-only Fire cleanse', () => {
  const text = articleText('battle-hall')
  expect(text).toContain('explicit Chilled tag')
  expect(text).toContain('explicit Drenched tag')
  expect(text).toContain('explicit Conductive tag')
  expect(text).toContain('10% per application')
  expect(text).toContain('100% reduction (minimum 0 Initiative)')
  expect(text).toContain('strongest active captured Storm damage bonus')
  expect(text).toContain('Drenched and hostile recipients’ Chilled remain')
  expect(text).not.toContain('Fire damage clears Drenched and Chilled')
})
