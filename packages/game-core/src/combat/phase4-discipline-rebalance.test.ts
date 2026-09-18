import { describe, expect, it } from 'vitest'

import { validateCombatActionDefinition } from './combat-authoring-validation'
import { combatActionPresentationTags } from './gameplay-tags'
import {
  P36_REPRESENTATIVE_ESSENCES,
  validateEssenceDefinition,
  type EssenceDefinition,
} from './essence'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from './mature-skills'

const RETIRED_CURRENT_STATUS_IDS = new Set(['hastened', 'delayed', 'borrowed-hour', 'regeneration'])

function currentSkill(skillId: string): MatureSkillDefinition {
  const definition = resolveMatureSkillVersion(skillId)
  if (!definition) throw new Error(`Missing current Skill ${skillId}.`)
  return definition
}

function latestEssences(): readonly EssenceDefinition[] {
  const latest = new Map<string, EssenceDefinition>()
  for (const definition of P36_REPRESENTATIVE_ESSENCES) {
    if (!definition.enabled) continue
    const previous = latest.get(definition.essenceId)
    if (!previous || definition.contentVersion > previous.contentVersion) {
      latest.set(definition.essenceId, definition)
    }
  }
  return [...latest.values()].sort((left, right) => left.essenceId.localeCompare(right.essenceId))
}

function retiredCurrentReferences(definition: MatureSkillDefinition): string[] {
  const references: string[] = []
  for (const effect of definition.effects) {
    if (effect.type === 'apply-status' && RETIRED_CURRENT_STATUS_IDS.has(effect.statusId)) {
      references.push(`effect:${effect.statusId}`)
    }
    if (
      effect.type === 'apply-status' &&
      (effect.statusId === 'burn' || effect.statusId === 'bleed' || effect.statusId === 'poison')
    ) {
      references.push(`legacy-dot:${effect.statusId}`)
    }
  }
  for (const requirement of definition.requirements) {
    if ('statusId' in requirement && RETIRED_CURRENT_STATUS_IDS.has(requirement.statusId)) {
      references.push(`requirement:${requirement.statusId}`)
    }
  }
  return references
}

describe('Phase 4 current Discipline Skill rebalance', () => {
  it('keeps all 17 eight-Skill regular rosters canonical and removes retired current statuses', () => {
    const current = latestEnabledMatureSkills()
    expect(current).toHaveLength(136)

    const byDiscipline = new Map<string, MatureSkillDefinition[]>()
    for (const definition of current) {
      const row = byDiscipline.get(definition.sourceDisciplineId) ?? []
      row.push(definition)
      byDiscipline.set(definition.sourceDisciplineId, row)

      expect(validateMatureSkillDefinition(definition), definition.id).toEqual([])
      expect(retiredCurrentReferences(definition), definition.id).toEqual([])
      expect(definition.accuracyMode, definition.id).toMatch(/^(automatic|per-target)$/u)
      if (definition.accuracyMode === 'per-target') {
        expect(definition.accuracyModifierBasisPoints, definition.id).toBe(0)
      }

      for (const context of ['pve', 'pvp'] as const) {
        const action = toCombatActionDefinition(definition, context)
        expect(
          () => validateCombatActionDefinition(action),
          `${definition.id}:${context}`,
        ).not.toThrow()
        expect(combatActionPresentationTags(action).length, definition.id).toBeGreaterThan(0)
      }
    }

    expect(byDiscipline.size).toBe(17)
    for (const [disciplineId, definitions] of byDiscipline) {
      expect(definitions, disciplineId).toHaveLength(8)
      for (const definition of definitions) {
        expect(definition.ai.enabled, definition.id).toBe(true)
        expect(Number.isFinite(definition.ai.baseUtility), definition.id).toBe(true)
        expect(definition.ai.purposeTags.length, definition.id).toBeGreaterThan(0)
      }
    }
  })

  it('keeps all 17 current Essences canonical and free of retired current statuses', () => {
    const current = latestEssences()
    expect(current).toHaveLength(17)
    for (const definition of current) {
      expect(validateEssenceDefinition(definition), definition.essenceId).toEqual([])
      expect(retiredCurrentReferences(definition.skill), definition.essenceId).toEqual([])
      for (const context of ['pve', 'pvp'] as const) {
        const action = toCombatActionDefinition(definition.skill, context)
        expect(
          () => validateCombatActionDefinition(action),
          `${definition.essenceId}:${context}`,
        ).not.toThrow()
        expect(combatActionPresentationTags(action).length, definition.essenceId).toBeGreaterThan(0)
      }
    }
  })

  it('migrates Chronist to movement-tempo semantics with the approved values', () => {
    expect(currentSkill('chronist.haste')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 30,
        effects: [
          expect.objectContaining({
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'haste',
          }),
        ],
      }),
    )
    expect(currentSkill('chronist.slow')).toEqual(
      expect.objectContaining({
        apCost: 35,
        effects: [
          expect.objectContaining({ type: 'damage', amount: 4 }),
          expect.objectContaining({ type: 'apply-status', statusId: 'slow' }),
        ],
      }),
    )
    expect(currentSkill('chronist.delay')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 25,
        effects: [expect.objectContaining({ type: 'apply-status', statusId: 'slow' })],
      }),
    )
    expect(currentSkill('chronist.time-lock')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        effects: [
          expect.objectContaining({ type: 'apply-status', statusId: 'root' }),
          expect.objectContaining({ type: 'apply-status', statusId: 'slow' }),
        ],
      }),
    )
    expect(currentSkill('chronist.temporal-ward')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        effects: [
          expect.objectContaining({ type: 'apply-status', statusId: 'guarded' }),
          expect.objectContaining({ type: 'apply-status', statusId: 'haste' }),
        ],
      }),
    )
    expect(currentSkill('chronist.stolen-moment')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 45,
        requirements: [
          expect.objectContaining({ kind: 'target-status-present', statusId: 'slow' }),
        ],
      }),
    )

    const borrowedHour = latestEssences().find(
      (definition) => definition.essenceId === 'essence.chronist.borrowed-hour',
    )
    expect(borrowedHour).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        skill: expect.objectContaining({
          contentVersion: 2,
          apCost: 60,
          effects: [
            expect.objectContaining({
              type: 'healing',
              recipient: 'primary-unit',
              amount: 5,
              ticks: 2,
            }),
            expect.objectContaining({
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'haste',
            }),
          ],
        }),
      }),
    )
  })

  it('migrates the approved displacement, recovery, Poison, Bleed and Burn Skills exactly', () => {
    expect(currentSkill('tidecaller.undertow')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 40,
        effects: [
          expect.objectContaining({ type: 'damage', amount: 5 }),
          expect.objectContaining({
            type: 'displace',
            recipient: 'primary-unit',
            direction: 'pull',
            distance: 2,
          }),
        ],
      }),
    )
    expect(currentSkill('tidecaller.springwater')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 35,
        effects: [
          expect.objectContaining({
            type: 'healing',
            recipient: 'primary-unit',
            amount: 3,
            ticks: 3,
          }),
        ],
      }),
    )

    expect(currentSkill('wildwarden.venom-shot')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 50,
        target: expect.objectContaining({
          kind: 'ground-tile',
          teamPolicy: 'enemy',
          shape: { kind: 'circle', radius: 1 },
        }),
        effects: [
          expect.objectContaining({ type: 'damage', recipient: 'affected-units', amount: 3 }),
          expect.objectContaining({ type: 'poison', recipient: 'affected-units' }),
        ],
      }),
    )
    expect(currentSkill('wildwarden.renewing-herbs')).toEqual(
      expect.objectContaining({
        contentVersion: 3,
        apCost: 35,
        effects: [
          expect.objectContaining({
            type: 'healing',
            recipient: 'primary-unit',
            amount: 4,
            ticks: 2,
          }),
          expect.objectContaining({
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'summoned',
          }),
        ],
      }),
    )

    expect(currentSkill('edgedancer.severing-cut')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 45,
        target: expect.objectContaining({
          shape: { kind: 'line', length: 2 },
        }),
        effects: [
          expect.objectContaining({ type: 'damage', recipient: 'affected-units', amount: 4 }),
          expect.objectContaining({
            type: 'bleed',
            recipient: 'affected-units',
            damagePerTick: 3,
            ticks: 3,
          }),
        ],
      }),
    )

    expect(currentSkill('cinderweaver.flame-burst')).toEqual(
      expect.objectContaining({
        contentVersion: 3,
        apCost: 50,
        target: expect.objectContaining({
          kind: 'ground-tile',
          shape: { kind: 'circle', radius: 1 },
        }),
        effects: [
          expect.objectContaining({
            type: 'damage',
            recipient: 'affected-units',
            amount: 5,
            element: 'fire',
          }),
          expect.objectContaining({ type: 'burn', recipient: 'affected-units' }),
        ],
      }),
    )

    expect(currentSkill('dawnshield.renewal')).toEqual(
      expect.objectContaining({
        contentVersion: 2,
        apCost: 35,
        effects: [
          expect.objectContaining({
            type: 'healing',
            recipient: 'actor',
            amount: 4,
            ticks: 2,
          }),
          expect.objectContaining({ type: 'remove-status', recipient: 'actor' }),
        ],
      }),
    )
  })
})
