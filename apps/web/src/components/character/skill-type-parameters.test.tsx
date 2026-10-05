import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import { SkillParameters } from './skill-parameters'
import { SkillDetails } from './skill-details'
import { skillParameterRows, skillTypeDescription } from './skill-detail-presentation'
import { basicActionCharacteristicRows } from './basic-action-presentation'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import { BattleSkillParameters } from '../battle/battle-skill-parameters'
import { battleSkillParameterRows } from '../battle/battle-preview-content'

const physical = resolveMatureSkillVersion('vanguard.forceful-strike')!
const mystic = resolveMatureSkillVersion('runeblade.aether-cut')!
const presentation = (definition: typeof physical) => ({
  definition,
  id: definition.id,
  name: definition.id,
  apCost: definition.apCost,
  mpCost: definition.mpCost ?? 0,
  targetKind: definition.target.kind,
  targetTeamPolicy: definition.target.teamPolicy,
  minimumRange: definition.target.minimumRange,
  maximumRange: definition.target.maximumRange,
  tags: definition.tags,
  effectDescriptions: [],
  requirementDescriptions: [],
})

function expectFamily(markup: string, family: 'Physical' | 'Mystic') {
  expect(markup).toContain('<dt>Skill Type</dt>')
  expect(markup).toContain(`data-skill-attack-family="${family.toLowerCase()}"`)
  expect(markup).toContain(`>[${family}]</span>`)
  expect(markup).not.toContain(`>[${family === 'Physical' ? 'Mystic' : 'Physical'}]</span>`)
}

describe('Attack family in parameter reports', () => {
  it.each([
    [physical, 'Physical'],
    [mystic, 'Mystic'],
  ] as const)('uses the canonical defense family for %s', (skill, family) => {
    expect(Object.fromEntries(skillParameterRows(skill))['Skill Type']).toBe(`Attack [${family}]`)
    expect(skillTypeDescription(skill)).toBe('Attack')
    expectFamily(
      renderToStaticMarkup(
        <dl>
          <SkillParameters skill={skill} />
        </dl>,
      ),
      family,
    )
    expectFamily(renderToStaticMarkup(<SkillDetails skill={skill} expanded />), family)
    expectFamily(
      renderToStaticMarkup(<BattleSkillParameters skill={presentation(skill)} />),
      family,
    )
  })

  it('matches every current Attack Skill to the same tag-based defense choice as execution', () => {
    const skills = latestEnabledMatureSkills().filter((skill) => skill.tags.includes('attack'))
    expect(skills.length).toBeGreaterThan(20)
    for (const skill of skills) {
      const family = skill.tags.includes('mystic') ? 'Mystic' : 'Physical'
      expect(Object.fromEntries(skillParameterRows(skill))['Skill Type'], skill.id).toBe(
        `Attack [${family}]`,
      )
    }
  })

  it('keeps mixed damage and recovery attacks in their authored family within one Discipline', () => {
    const siphon = resolveMatureSkillVersion('runeblade.siphon-slash')!
    expect(Object.fromEntries(skillParameterRows(siphon))['Skill Type']).toBe('Attack [Physical]')
    expect(Object.fromEntries(skillParameterRows(mystic))['Skill Type']).toBe('Attack [Mystic]')
  })

  it('labels inherent Basic Attack Physical without relabeling utility or recovery', () => {
    const rows = basicActionCharacteristicRows('basic.attack.unarmed.basic')
    expect(Object.fromEntries(rows)['Skill Type']).toBe('Attack [Physical]')
    expectFamily(
      renderToStaticMarkup(
        <dl>
          <SkillCharacteristicRows rows={rows} />
        </dl>,
      ),
      'Physical',
    )
    for (const id of ['basic.guard', 'basic.recover', 'basic.recover.mp', 'basic.move'] as const) {
      expect(Object.fromEntries(basicActionCharacteristicRows(id))['Skill Type']).not.toContain(
        'Attack',
      )
    }
    for (const id of ['vanguard.brace', 'vanguard.rally']) {
      const skill = resolveMatureSkillVersion(id)!
      expect(
        renderToStaticMarkup(
          <dl>
            <SkillParameters skill={skill} />
          </dl>,
        ),
      ).not.toContain('data-skill-attack-family')
    }
  })

  it('uses pinned legacy attack tags and keeps other missing metadata unavailable', () => {
    for (const family of ['physical', 'mystic'] as const) {
      const skill = { ...presentation(physical), definition: undefined, tags: ['attack', family] }
      expect(Object.fromEntries(battleSkillParameterRows(skill))['Skill Type']).toBe(
        `Attack [${family === 'physical' ? 'Physical' : 'Mystic'}]`,
      )
      expectFamily(
        renderToStaticMarkup(<BattleSkillParameters skill={skill} />),
        family === 'physical' ? 'Physical' : 'Mystic',
      )
    }
    expect(
      Object.fromEntries(
        battleSkillParameterRows({ ...presentation(physical), definition: undefined, tags: [] }),
      )['Skill Type'],
    ).toBe('Unavailable')
  })
})
