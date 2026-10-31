import { describe, expect, it } from 'vitest'
import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { effectTagDescription } from '../../lib/combat-effect-descriptions'
import { describeBattleEffect, battleEffectIdentity } from '../battle/battle-effect-identity'
import { canonicalEffectExplanation } from './canonical-effect-explanation'
import { compactSkillEffectSummaryParts, skillEffectDescription } from './skill-detail-presentation'
import { previewEffect, skillPreviewEffects } from './skill-effect-preview'

// A captured effect supplies its own values; readers never substitute authoring defaults.
const capturedEndure = {
  type: 'endure',
  recipient: 'actor',
  durationTurns: 2,
  releaseBasisPoints: 15000,
  radiusTiles: 3,
  targetTeams: 'enemies',
} as const satisfies MatureSkillEffectDefinition

describe('Endure readers', () => {
  it('01 shows the saved release, radius, team and lifetime in Skill readers', () => {
    const preview = previewEffect(capturedEndure)
    expect(preview).toMatchObject({ label: 'Endure', magnitude: '150%' })
    expect(preview.explanation).toContain('150%')
    expect(preview.explanation).toContain('within 3 tiles')
    expect(preview.explanation).toContain('each living enemy')
    expect(preview.explanation).toContain('2 turns')
    expect(skillEffectDescription(capturedEndure)).toBe(preview.explanation)
    expect(compactSkillEffectSummaryParts(capturedEndure)).toMatchObject({
      label: 'Endure',
      magnitude: '150%',
      duration: '2 Turns',
      target: 'Self',
    })
    expect(canonicalEffectExplanation(capturedEndure, {})?.description).toContain('150%')
    expect(skillPreviewEffects({ effects: [capturedEndure] })[0]).toEqual(preview)
  })

  it.each([
    ['allies', 'each living ally'],
    ['all', 'each living unit'],
  ] as const)(
    '02 preserves captured %s scope and nondefault values',
    (targetTeams, teamDescription) => {
      const effect = {
        ...capturedEndure,
        releaseBasisPoints: 17550,
        radiusTiles: 1,
        durationTurns: 4,
        targetTeams,
      } satisfies MatureSkillEffectDefinition
      const description = previewEffect(effect).explanation
      expect(description).toContain('175.5%')
      expect(description).toContain('within 1 tile')
      expect(description).toContain('4 turns')
      expect(description).toContain(teamDescription)
      expect(description).not.toContain('150%')
    },
  )

  it('03 explains manual damage restrictions and natural expiry without suppressing automatic reactions', () => {
    const description = skillEffectDescription(capturedEndure)
    expect(description).toContain('Basic Attack')
    expect(description).toContain('damage-dealing manual Skills')
    expect(description).toContain('Automatic reactions and already-pending casts still resolve')
    expect(description).toContain('ends naturally')
    expect(description).toContain('Barrier')
    expect(description).toContain('without applying Defense again')
    expect(description).toContain('Removal or defeat cancels it')
  })

  it('04 shows only the active public profile and lifetime, never a private damage ledger', () => {
    const capturedStatus: CombatStatusInstance = {
      statusId: 'endure',
      statusVersion: 1,
      stacks: 1,
      sourceCombatantId: 'caster',
      remainingOwnerTurnStarts: 2,
      remainingOwnerTurnEnds: 2,
      endure: { releaseBasisPoints: 15000, radiusTiles: 3, targetTeams: 'enemies' },
    }
    const effect = { ...capturedStatus, receivedHpDamage: 987654321 }
    const description = describeBattleEffect(effect)
    expect(battleEffectIdentity('endure')).toMatchObject({ label: 'Endure', identifier: 'END' })
    expect(description.description).toContain('150%')
    expect(description.description).toContain('within 3 tiles')
    expect(description.description).toContain('each living enemy')
    expect(description).toMatchObject({ count: 2, counterLabel: '2t', timing: 'Active' })
    expect(JSON.stringify(description)).not.toContain('987654321')
    expect(JSON.stringify(description)).not.toContain('receivedHpDamage')
  })

  it('05 keeps generic help concise and free of a fixed configuration', () => {
    const description = effectTagDescription('endure')
    expect(description).toContain('damage-dealing manual actions')
    expect(description).toContain('expires naturally')
    expect(description).toContain('each eligible target')
    expect(description).not.toMatch(/\d|%/)
  })

  it('06 retains a one-turn Endure lifetime when activation is Instant', () => {
    const effect = { ...capturedEndure, durationTurns: 1 }
    expect(
      compactSkillEffectSummaryParts(effect, { version: 2, modes: { endure: 'instant' } }),
    ).toMatchObject({ duration: '1 Turn', timing: 'Instant' })
    expect(previewEffect(effect).explanation).toContain('Lasts 1 turn.')
  })
})
