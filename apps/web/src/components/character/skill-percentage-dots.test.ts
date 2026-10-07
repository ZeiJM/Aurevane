import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import {
  applyCurrentBurnState,
  advanceCurrentBurnEndTurn,
} from '@aurevane/game-core/combat/combat-dots'
import {
  activePersistentCombatStatusRows,
  pendingCombatStatusRows,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { executeCombatAction } from '@aurevane/game-core/combat/actions'
import { toCombatActionDefinition } from '@aurevane/game-core/combat/mature-skills'
import { describe, expect, it } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { combatEffectPresentationTags } from '@aurevane/game-core/combat/gameplay-tags'
import { previewEffect } from './skill-effect-preview'
import { skillEffectDescription, skillEffectSummaries } from './skill-detail-presentation'
import { describeBattleEffect } from '../battle/battle-effect-identity'
import { aggregateBattleStatusStacks } from '../battle/battle-effect-summary'

const rows = [
  ['ravager.gash', 'Bleed [20%] [3 turns]'],
  ['wildwarden.venom-shot', 'Poison [15%] [4 turns]'],
  ['cinderweaver.cinder-bolt', 'Burn [25% → 20% → 15%] [3 turns]'],
] as const

describe('shared percentage DoT readers', () => {
  it.each(rows)('reads %s from its immutable percentage profile', (id, bracket) => {
    const skill = resolveMatureSkillVersion(id)!
    const effect = skill.effects.find(
      (effect) => effect.type === 'burn' || effect.type === 'poison' || effect.type === 'bleed',
    )!
    expect(skillEffectSummaries(skill)).toContain(bracket)
    expect(
      combatEffectPresentationTags(effect as Parameters<typeof combatEffectPresentationTags>[0]),
    ).toContain(bracket)
    expect(previewEffect(effect).explanation).toContain('HP damage dealt by that attack')
    expect(skillEffectDescription(effect)).toContain('HP damage dealt by that attack')
    expect(skillEffectDescription(effect)).not.toContain('fixed damage')
  })
  it('explains the same contract for Essence effects and historical fixed versions', () => {
    const current = resolveEssenceForBuild('cinderweaver', null)!
    const burn = current.skill.effects.find((effect) => effect.type === 'burn')!
    expect(skillEffectDescription(burn)).toContain('10%')
    expect(skillEffectDescription(burn)).toContain(
      'misses and friendly damage do not trigger backlash',
    )
    const old = resolveEssenceForBuild(
      'cinderweaver',
      null,
      current.contentVersion - (current.skill.target.geometryVersion === 2 ? 2 : 1),
    )!
    expect(
      skillEffectDescription(old.skill.effects.find((effect) => effect.type === 'burn')!),
    ).toContain('fixed damage')
  })
  it('projects committed and pending metadata without command or private source fields', () => {
    const captured = {
      capturedDamage: 40,
      profile: {
        kind: 'attack-percentage' as const,
        basisPoints: 2500,
        decayBasisPointsPerTick: 500,
      },
    }
    const applied = applyCurrentBurnState(
      percentageDotEncounter(),
      'actor',
      'enemy',
      'private.skill',
      true,
      undefined,
      3,
      captured,
    )
    const active = activePersistentCombatStatusRows(
      advanceCurrentBurnEndTurn(applied, 'enemy').state,
    )[0]!.status
    expect(describeBattleEffect(active).explanation).toContain('Next tick: 8 HP')
    expect(describeBattleEffect(active).explanation).toContain('2 HP backlash')
    const current = activePersistentCombatStatusRows({
      ...applied,
      dotTriggerPolicyVersion: 1,
      effectState: {
        ...applied.effectState!,
        burn: applied.effectState!.burn.map((row) => ({ ...row, backlashBasisPoints: 1234 })),
      },
    })[0]!.status
    expect(describeBattleEffect(current).explanation).toContain('12.34%')
    expect(describeBattleEffect(current).explanation).toContain('Once per turn')
    expect(describeBattleEffect(current).explanation).not.toContain('2 HP backlash')
    expect(JSON.stringify(active)).not.toContain('private.skill')
    const skill = resolveMatureSkillVersion('ravager.gash')!
    const state = { ...percentageDotEncounter(), effectTimingPolicy: { version: 1, modes: {} } }
    const cast = executeCombatAction(
      state,
      toCombatActionDefinition(skill, 'pve'),
      { kind: 'unit', combatantId: 'enemy' },
      { statuses: [] },
    ).state
    const pending = pendingCombatStatusRows(cast).find(
      (row) => row.status.statusId === 'bleed',
    )!.status
    expect(pending.percentageDotProfile?.basisPoints).toBe(2000)
    expect(describeBattleEffect(pending).explanation).toContain('HP damage dealt by that attack')
    expect(JSON.stringify(pending)).not.toContain('percentageDotCommandId')
  })
  it('shows the actual next tick and basis from viewer-safe active state', () => {
    const effect = {
      statusId: 'burn',
      statusVersion: 1,
      stacks: 1,
      sourceCombatantId: 'enemy',
      remainingOwnerTurnStarts: 2,
      remainingOwnerTurnEnds: 2,
      timingState: 'active' as const,
      percentageDamage: {
        capturedDamage: 40,
        profile: {
          kind: 'attack-percentage' as const,
          basisPoints: 2500,
          decayBasisPointsPerTick: 500,
        },
      },
      percentageDotStage: 1,
    }
    const description = describeBattleEffect(effect).explanation
    expect(description).toContain('Captured attack damage: 40 HP')
    expect(description).toContain('Next tick: 8 HP')
    expect(description).not.toContain('sourceActionId')
    const second = {
      ...effect,
      percentageDamage: { ...effect.percentageDamage, capturedDamage: 20 },
    }
    expect(aggregateBattleStatusStacks([effect, second])).toHaveLength(2)
  })
})
