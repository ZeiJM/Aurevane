import { describe, expect, it } from 'vitest'
import { resolveResonanceForPair } from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import {
  resonanceCharacteristicRows,
  resonanceSupplementalRows,
} from './resonance-detail-presentation'

const fields = [
  'Skill Type',
  'Cost',
  'Cooldown',
  'Requirements',
  'Effects',
  'Range',
  'Target',
  'Target Method',
  'Target Elevation',
  'Line of Sight',
]

describe('passive Resonance Skill information', () => {
  it('shows the ten required fields and preserves sequence setup and unit-target constraints', () => {
    const definition = resolveResonanceForPair('lifebinder', 'vanguard')!
    const rows = resonanceCharacteristicRows(definition)
    expect(rows.map(([label]) => label)).toEqual(fields)
    expect(Object.fromEntries(rows)).toMatchObject({
      'Skill Type': 'Passive · Resonance',
      Cost: 'N/A',
      Cooldown: 'N/A',
      Range: 'N/A',
      Target: 'Trigger Skill selected unit; Self',
      'Target Method': 'N/A',
      'Target Elevation': 'N/A',
      'Line of Sight': 'N/A',
    })
    expect(JSON.stringify(Object.fromEntries(rows).Requirements)).toContain('next Discipline Skill')
    const supplemental = Object.fromEntries(resonanceSupplementalRows(definition))
    expect(supplemental.Mode).toBe('Sequence Resonance')
    expect(supplemental.Setup).toContain('Lifebinder')
    expect(supplemental.Trigger).toContain('Vanguard')
    expect(supplemental['Trigger targeting']).toContain('unit selection')
    expect(supplemental['Result details']).not.toEqual([])
  })

  it('derives mixed result recipients without implying an independent range or cost', () => {
    const base = resolveResonanceForPair('farstrider', 'lifebinder')!
    const mechanics = normalizedResonanceMechanics(base)
    const definition = {
      ...base,
      authoring: { ...base.authoring, schemaVersion: 2 as const },
      trigger: {
        kind: 'skill-trigger-v2' as const,
        mode: 'immediate' as const,
        setup: null,
        trigger: mechanics.trigger,
        aiSetupUtilityBonus: 0,
        aiTriggerUtilityBonus: 1,
        resultEffects: [
          { type: 'healing' as const, recipient: 'actor' as const, amount: 3 },
          { type: 'damage' as const, recipient: 'affected-units' as const, amount: 2 },
        ],
      },
    }
    const rows = Object.fromEntries(resonanceCharacteristicRows(definition))
    expect(rows.Target).toBe('Self; Trigger Skill affected units')
    expect(rows.Effects).toEqual(['Healing [3] → Self', 'Dmg [2] → Trigger Skill affected units'])
    expect(rows.Range).toBe('N/A')
    expect(JSON.stringify(rows.Requirements)).not.toContain('next Discipline Skill')
    expect(Object.fromEntries(resonanceSupplementalRows(definition))).toMatchObject({
      Mode: 'Immediate Resonance',
      Setup: 'N/A',
    })
  })

  it('reports absent pinned mechanics as unavailable rather than inventing triggers or effects', () => {
    const rows = resonanceCharacteristicRows(null)
    expect(rows.map(([label]) => label)).toEqual(fields)
    expect(rows.every(([, value]) => value === 'Unavailable')).toBe(true)
    expect(resonanceSupplementalRows(null)).toEqual([])
  })

  it('supports historical sequence terrain Results on the Trigger Skill affected tiles', () => {
    const base = resolveResonanceForPair('lifebinder', 'vanguard', 1)!
    const definition = {
      ...base,
      trigger: {
        ...base.trigger,
        payoffEffects: [
          {
            type: 'create-terrain' as const,
            recipient: 'affected-tiles' as const,
            terrain: 'frozen' as const,
          },
        ],
      },
    }
    const rows = Object.fromEntries(resonanceCharacteristicRows(definition))
    expect(rows.Target).toBe('Trigger Skill affected tiles')
    expect(JSON.stringify(rows.Effects)).toContain('→ Trigger Skill affected tiles')
    expect(Object.fromEntries(resonanceSupplementalRows(definition)).Mode).toBe(
      'Sequence Resonance',
    )
  })
})
