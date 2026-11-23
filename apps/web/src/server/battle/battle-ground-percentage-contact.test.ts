import { expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { capturedMatureSkillAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import { applyAbilityTimingDefaults } from '@aurevane/game-core/combat/combat-definition'
import { captureCombatAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import { commitCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import {
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  validateCombatEncounterState,
  type CombatEncounterState,
  endCombatTurn,
} from '@aurevane/game-core/combat/actions'
import { resolveCombatMovementStepEffects } from '../../../../../packages/game-core/src/combat/actions-legacy'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { grantBarrier } from '@aurevane/game-core/combat/combat-barrier'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { correctCombatContentEntries } from '@/lib/combat-content-corrector'
import { upgradeSkillFormat } from '@/components/master/combat-content/skill-format-upgrade'
import { projectPublicCombatGroundAreas } from '@aurevane/game-core/combat/combat-ground-visuals'

vi.mock('server-only', () => ({}))

const definitions = [
  ['cinderweaver.flame-burst', 'burn'],
  ['wildwarden.venom-shot', 'poison'],
  ['edgedancer.severing-cut', 'bleed'],
] as const
const hp = (state: CombatEncounterState) =>
  state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp
const periodic = (state: CombatEncounterState, type: 'burn' | 'poison' | 'bleed') =>
  state.effectState?.[type].filter((row) => row.targetCombatantId === 'enemy') ?? []
for (const [id, type] of definitions) {
  it.each(['hit', 'partial-barrier', 'full-barrier', 'miss'] as const)(
    `current defaulted ${id} preserves paired percentage ${type} contact (%s)`,
    (scenario) => {
      const raw = resolveMatureSkillVersion(id)!
      const ground =
        id === 'edgedancer.severing-cut'
          ? {
              ...raw,
              target: { ...raw.target, kind: 'ground-tile' as const },
              effects: raw.effects.map((effect) =>
                effect.recipient === 'actor' ? effect : { ...effect, target: 'ground' as const },
              ),
            }
          : raw
      const current = correctCombatContentEntries(
        'skill',
        upgradeSkillFormat(ground, 'base'),
      ).definition
      let base: CombatEncounterState = {
        ...preparePv1fTurnEconomy(percentageDotEncounter()),
        groundEffectPolicyVersion: 1,
        groundContactPolicyVersion: 1,
        effectTimingPolicy: {
          version: 1,
          tagAuthority: 'global',
          modes: { 'ground-area': 'next-round', [type]: 'next-round' },
        },
      }
      if (scenario === 'partial-barrier' || scenario === 'full-barrier')
        base = grantBarrier(
          base,
          'enemy',
          'enemy',
          'test.barrier',
          scenario === 'full-barrier' ? 1000 : 1,
        ).state
      const original = capturedMatureSkillAbilitySource(base, current)!
      const captured = captureCombatAbilitySource({
        ...original,
        definition: {
          ...original.definition,
          behaviors: original.definition.behaviors.map((behavior) => ({
            ...applyAbilityTimingDefaults(behavior, base.effectTimingPolicy),
            ...(scenario === 'miss'
              ? { accuracy: { kind: 'fixed' as const, chanceBasisPoints: 0 } }
              : {}),
          })),
        },
      })
      const before = JSON.stringify(captured)
      const behavior = captured.definition.behaviors[0]!
      expect(behavior.groundArea?.placementTimingVersion).toBe(1)
      expect(behavior.groundArea?.timing).toBeUndefined()
      const state = reconcileCombatAbilitySources(base, [captured])
      const shape = behavior.targeting!.shape.kind
      const selection =
        shape === 'line'
          ? { kind: 'direction' as const, direction: 'east' as const }
          : { kind: 'activate' as const }
      const result = commitCombatAbilityCommand({
        state,
        actorId: 'actor',
        root: { kind: 'canonical', source: captured, behaviorId: behavior.id },
        selection,
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, captured),
      })
      expect(result.state.groundAreas).toHaveLength(1)
      expect(result.state.groundAreas?.[0]?.activationRound).toBe(1)
      expect(result.state.groundAreas?.[0]?.entryEffectTimingModes).toContain('next-round')
      const actual = hp(state) - hp(result.state)
      if (scenario === 'full-barrier' || scenario === 'miss') {
        expect(actual).toBe(0)
        expect(periodic(result.state, type)).toEqual([])
      } else {
        expect(actual).toBeGreaterThan(0)
        expect(periodic(result.state, type)).toHaveLength(1)
        expect(periodic(result.state, type)[0]?.percentageDamage?.capturedDamage).toBe(actual)
      }
      const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
      expect(validateCombatEncounterState(restored)).toEqual([])
      const contact = resolveCombatMovementStepEffects(restored, 'enemy', PV1F_COMBAT_CONTENT).state
      expect(hp(contact)).toBe(hp(restored))
      const applications = (value: CombatEncounterState) =>
        periodic(value, type).map((row) => ({
          applicationOrder: row.applicationOrder,
          percentageDamage: row.percentageDamage,
        }))
      expect(applications(contact)).toEqual(applications(restored))
      const next = endCombatTurn(
        { ...contact, tactical: selectCurrentFinalFacing(contact.tactical, 'west').state },
        PV1F_COMBAT_CONTENT,
      ).state
      expect(next.tactical.battle.currentTurn?.combatantId).toBe('enemy')
      expect(validateCombatEncounterState(next)).toEqual([])
      expect(
        projectPublicCombatGroundAreas(
          next.groundAreas ?? [],
          next.tactical.battle.round,
          'active',
        ),
      ).toHaveLength(1)
      expect(JSON.stringify(captured)).toBe(before)
    },
  )
}
