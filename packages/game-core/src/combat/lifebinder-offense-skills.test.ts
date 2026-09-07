import { describe, expect, it } from 'vitest'

import {
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
} from './mature-skills'

describe('Lifebinder offensive Techniques', () => {
  it('defines Vital Sever as a ranged single-target Attack Technique', () => {
    const definition = resolveMatureSkillVersion('lifebinder.vital-sever', 1)
    if (!definition) throw new Error('Expected Vital Sever.')

    expect(validateMatureSkillDefinition(definition)).toEqual([])
    expect(definition.sourceDisciplineId).toBe('lifebinder')
    expect(definition.apCost).toBe(40)
    expect(definition.tags).toEqual(expect.arrayContaining(['attack', 'cockpit:attack']))
    expect(definition.target).toMatchObject({
      kind: 'unit',
      teamPolicy: 'enemy',
      maximumRange: 3,
      shape: { kind: 'single' },
    })
    expect(definition.effects).toContainEqual({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 10,
    })
  })

  it('defines Searing Bloom as a ranged area Attack Technique', () => {
    const definition = resolveMatureSkillVersion('lifebinder.searing-bloom', 1)
    if (!definition) throw new Error('Expected Searing Bloom.')

    expect(validateMatureSkillDefinition(definition)).toEqual([])
    expect(definition.sourceDisciplineId).toBe('lifebinder')
    expect(definition.apCost).toBe(55)
    expect(definition.tags).toEqual(expect.arrayContaining(['attack', 'area', 'cockpit:attack']))
    expect(definition.target).toMatchObject({
      kind: 'unit',
      teamPolicy: 'enemy',
      maximumRange: 3,
      shape: { kind: 'circle', radius: 1 },
    })
    expect(definition.effects).toContainEqual({
      type: 'damage',
      recipient: 'affected-units',
      amount: 7,
    })
  })
})
