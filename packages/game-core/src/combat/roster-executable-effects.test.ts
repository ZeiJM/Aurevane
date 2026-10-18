import { expect, it } from 'vitest'
import { COMBAT_TAG_REGISTRY, type CombatTagPayload } from './combat-tag-registry'
import {
  captured,
  fixture,
  input,
  unit,
  ap,
  give,
  damage,
  hasStatus,
  pair,
  commitRosterCommand as cast,
  rejectRosterCommand as blocked,
  restoreRosterEncounter as restored,
  advanceRosterTurns as nextTurns,
} from './roster-outcome.test-utils'
import { prepareCombatAbilityCommand } from './combat-ability-command'
import { primeCombatControlledAbility } from './combat-behavior-runtime'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
import { currentPoisonInstances, currentBurnInstances, currentBleedStacks } from './combat-dots'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { executePv1fMovement, finishPv1fTurn } from './pv1f-action-economy'
import type { CombatEncounterState } from './actions'

interface ExecutableEffectCase {
  tag: CombatTagPayload['type']
  recordId: string
  version: number
  exercise: (recordId: string) => void
}
const enemy = { kind: 'unit' as const, combatantId: 'enemy' }
const self = { kind: 'self' as const }
const position = (state: CombatEncounterState, id = 'actor') =>
  state.tactical.placements.find((row) => row.combatantId === id)!.position

const cases: ExecutableEffectCase[] = [
  {
    tag: 'move',
    recordId: 'vanguard.sweeping-strike',
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id])
      state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      const command = {
        ...input(state, id),
        movementPath: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      }
      const out = cast(command)
      expect(position(out.state)).toEqual({ x: 1, y: 1 })
      expect(unit(out.state, 'enemy').hp).toBeLessThan(1000)
      expect(ap(out.state)).toBe(50)
      expect(unit(out.state).mp).toBe(20)
      const near = restored(state)
      const excessivePath = [
        { x: 2, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]
      near.tactical.placements.find((row) => row.combatantId === 'actor')!.position =
        excessivePath[0]!
      // Both original and reached tiles are in attack range, isolating the Move cap.
      for (const point of [excessivePath[0]!, excessivePath.at(-1)!])
        expect(
          Math.abs(point.x - position(near, 'enemy').x) +
            Math.abs(point.y - position(near, 'enemy').y),
        ).toBe(1)
      blocked(
        { ...input(near, id), movementPath: excessivePath },
        {
          code: 'invalid-target-kind',
          message: 'Move requires an origin and one through the authored maximum entered tiles.',
        },
      )
    },
  },
  {
    tag: 'damage',
    recordId: 'vanguard.forceful-strike',
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id])
      const out = cast(input(state, id))
      expect(damage(out.events)).toEqual([28])
      expect(unit(out.state, 'enemy').hp).toBe(972)
      expect(ap(out.state)).toBe(55)
      const protectedState = reattachStatDrivenCombatBridge(
        grantBarrier(state, 'enemy', 'enemy', 'test.guard', 100).state,
        state.statBridge,
      )
      const absorbed = cast(input(protectedState, id))
      expect(unit(absorbed.state, 'enemy').hp).toBe(1000)
      expect(currentBarrierAmount(absorbed.state, 'enemy')).toBe(72)
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'pierce',
    recordId: 'vanguard.guard-break',
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id])
      // The approved future equipment-Armor boundary is absent: current Defense20 is not bypassed.
      // floor(16*100/120)=13, then floor(13*140%)=18; without Defense floor(16*140%)=22.
      const armored = reattachStatDrivenCombatBridge(state, {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'enemy' ? { ...row, armor: 20 } : row,
        ),
      })
      const out = cast(input(armored, id))
      expect(damage(out.events)).toEqual([18])
      expect(unit(out.state, 'enemy').hp).toBe(982)
      const unarmored = cast(input(state, id))
      expect(damage(unarmored.events)).toEqual([22])
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'healing',
    recordId: pair('cinderweaver', 'lifebinder'),
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id])
      unit(state, 'ally').hp = 600
      const out = cast(input(state, id, { kind: 'unit', combatantId: 'ally' }))
      expect(unit(out.state, 'ally').hp).toBe(620)
      expect(unit(out.state).mp).toBe(16)
      const capped = fixture([id])
      unit(capped, 'ally').hp = 995
      expect(
        unit(cast(input(capped, id, { kind: 'unit', combatantId: 'ally' })).state, 'ally').hp,
      ).toBe(1000)
      blocked(input(state, id, enemy))
    },
  },
  {
    tag: 'percentage-recovery',
    recordId: 'lifebinder.mending-light',
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id])
      unit(state).hp = 600
      const out = cast(input(state, id, self))
      expect(unit(out.state).hp).toBe(700)
      expect(ap(out.state)).toBe(55)
      expect(unit(out.state).mp).toBe(15)
      const capped = fixture([id])
      unit(capped).hp = 995
      expect(unit(cast(input(capped, id, self)).state).hp).toBe(1000)
      blocked(input(state, id, enemy))
    },
  },
  {
    tag: 'resource-change',
    recordId: 'aetherist.arcane-field',
    version: 7,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        out = cast(input(state, id, { kind: 'activate' }))
      expect(unit(out.state, 'enemy').mp).toBe(16)
      expect(unit(out.state, 'other').mp).toBe(16)
      expect(unit(out.state).mp).toBe(14)
      expect(unit(out.state, 'ally').mp).toBe(20)
      const low = fixture([id])
      unit(low, 'enemy').mp = 2
      expect(unit(cast(input(low, id, { kind: 'activate' })).state, 'enemy').mp).toBe(0)
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'apply-status',
    recordId: 'vanguard.brace',
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        out = cast(input(state, id, self))
      expect(hasStatus(out.state, 'guarded')).toBe(true)
      expect(hasStatus(out.state, 'guarded', 'enemy')).toBe(false)
      expect(ap(out.state)).toBe(65)
      expect(hasStatus(nextTurns(out.state, 8), 'guarded')).toBe(false)
      blocked(input(out.state, id, self))
    },
  },
  {
    tag: 'remove-status',
    recordId: 'runeblade.unbinding-rune',
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = give(give(fixture([id]), 'covert'), 'suppress')
      const out = cast(input(state, id))
      expect(hasStatus(out.state, 'covert', 'enemy')).toBe(false)
      expect(hasStatus(out.state, 'suppress', 'enemy')).toBe(true)
      expect(hasStatus(state, 'covert', 'enemy')).toBe(true)
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'return-to-turn-start',
    recordId: 'chronist.rewind-step',
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        root = captured(id)
      const primed = primeCombatControlledAbility({
        state,
        actorId: 'actor',
        sourceInstanceId: id,
        behaviorId: root.definition.behaviors[0]!.id,
      }).state
      expect(ap(primed)).toBe(100)
      expect(unit(primed).mp).toBe(20)
      const moved = executePv1fMovement(reattachStatDrivenCombatBridge(primed, state.statBridge), [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ]).state
      const out = cast(input(moved, id, self))
      expect(position(out.state)).toEqual({ x: 1, y: 1 })
      expect(ap(out.state)).toBe(ap(moved)! - 40)
      expect(unit(out.state).mp).toBe(16)
      expect(out.state.tactical.battle.currentTurn!.movementRemaining).toBe(
        moved.tactical.battle.currentTurn!.movementRemaining,
      )
      blocked(input(out.state, id, self))
    },
  },
  {
    tag: 'create-terrain',
    recordId: 'frostweaver.chilling-mist',
    version: 8,
    exercise(recordId) {
      const id = recordId,
        base = fixture([id]),
        state = { ...base, groundEffectPolicyVersion: 1 as const }
      const out = cast(input(state, id, { kind: 'activate' }))
      expect(out.state.groundAreas).toHaveLength(1)
      expect(out.state.groundAreas![0]!.sourceActionId).toBe(id)
      expect(
        out.state.groundAreas![0]!.expiresAtRound - out.state.groundAreas![0]!.activationRound,
      ).toBe(2)
      const settled = nextTurns(out.state, 4)
      expect(settled.terrainOverlays?.some((row) => row.kind === 'frozen')).toBe(true)
      expect(nextTurns(settled, 12).groundAreas ?? []).toEqual([])
      expect(nextTurns(settled, 12).terrainOverlays ?? []).toEqual([])
    },
  },
  {
    tag: 'displace',
    recordId: 'vanguard.shield-bash',
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id])
      // The ordinary push tile is occupied by Other: clear it for the legal variant.
      state.tactical.placements.find((row) => row.combatantId === 'other')!.position = {
        x: 4,
        y: 4,
      }
      const out = cast(input(state, id))
      expect(position(out.state, 'enemy')).toEqual({ x: 3, y: 1 })
      const occupied = fixture([id]),
        stopped = cast(input(occupied, id))
      expect(position(stopped.state, 'enemy')).toEqual({ x: 2, y: 1 })
      expect(unit(stopped.state, 'enemy').hp).toBeLessThan(1000)
    },
  },
  {
    tag: 'poison',
    recordId: pair('farstrider', 'wildwarden'),
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = give(fixture([id]), 'mark')
      state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      const out = cast(input(state, id)),
        dots = currentPoisonInstances(out.state, 'enemy')
      expect(dots).toHaveLength(1)
      expect(dots[0]!.sourceActionId).toBe(id)
      expect(dots[0]!.remainingTicks).toBe(3)
      expect(dots[0]!.percentageDamage).toEqual({
        capturedDamage: 19,
        profile: { kind: 'attack-percentage', basisPoints: 1500 },
      })
      const initialHp = unit(out.state, 'enemy').hp
      const later = nextTurns(out.state, 4)
      expect(unit(later, 'enemy').hp).toBe(initialHp - 2)
      expect(currentPoisonInstances(nextTurns(later, 16), 'enemy')).toEqual([])
      const missing = fixture([id])
      missing.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      blocked(input(missing, id))
    },
  },
  {
    tag: 'burn',
    recordId: 'cinderweaver.cinder-bolt',
    version: 8,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        out = cast(input(state, id))
      const dots = currentBurnInstances(out.state, 'enemy')
      expect(dots).toHaveLength(1)
      expect(dots[0]!.sourceActionId).toBe(id)
      expect(dots[0]!.remainingTicks).toBe(3)
      expect(dots[0]!.percentageDamage).toEqual({
        capturedDamage: 21,
        profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
      })
      const later = nextTurns(out.state, 4)
      expect(unit(later, 'enemy').hp).toBe(unit(out.state, 'enemy').hp - 4)
      expect(currentBurnInstances(nextTurns(later, 16), 'enemy')).toEqual([])
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'bleed',
    recordId: 'ravager.gash',
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        out = cast(input(state, id))
      expect(currentBleedStacks(out.state, 'enemy')).toHaveLength(1)
      expect(currentBleedStacks(out.state, 'enemy')[0]!.sourceActionId).toBe(id)
      expect(currentBleedStacks(out.state, 'enemy')[0]!.remainingTicks).toBe(3)
      expect(currentBleedStacks(out.state, 'enemy')[0]!.percentageDamage).toEqual({
        capturedDamage: 21,
        profile: { kind: 'attack-percentage', basisPoints: 1500 },
      })
      const later = nextTurns(out.state, 4)
      expect(unit(later, 'enemy').hp).toBe(unit(out.state, 'enemy').hp - 3)
      expect(currentBleedStacks(nextTurns(later, 16), 'enemy')).toEqual([])
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'barrier-change',
    recordId: 'vanguard.brace',
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        out = cast(input(state, id, self))
      expect(currentBarrierAmount(out.state, 'actor')).toBe(12)
      expect(currentBarrierAmount(out.state, 'enemy')).toBe(0)
      blocked(input(out.state, id, self))
    },
  },
  {
    tag: 'copy-statuses',
    recordId: 'shadehand.quick-hands',
    version: 6,
    exercise(recordId) {
      const id = recordId,
        state = give(fixture([id]), 'guarded'),
        out = cast(input(state, id))
      expect(hasStatus(out.state, 'guarded')).toBe(true)
      expect(hasStatus(out.state, 'guarded', 'enemy')).toBe(true)
      expect(ap(out.state)).toBe(65)
      expect(unit(out.state).mp).toBe(16)
      const empty = fixture([id])
      blocked(input(empty, id))
      expect(hasStatus(empty, 'guarded')).toBe(false)
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'sensory',
    recordId: 'farstrider.scouts-mark',
    version: 5,
    exercise(recordId) {
      const id = recordId,
        state = give(give(fixture([id]), 'covert'), 'guarded')
      const out = cast(input(state, id))
      expect(hasStatus(out.state, 'covert', 'enemy')).toBe(false)
      expect(hasStatus(out.state, 'guarded', 'enemy')).toBe(false)
      expect(hasStatus(out.state, 'revealed', 'enemy')).toBe(true)
      expect(hasStatus(out.state, 'mark', 'enemy')).toBe(true)
      expect(unit(out.state, 'enemy').hp).toBe(1000)
      expect(unit(out.state).mp).toBe(18)
      expect(hasStatus(nextTurns(out.state, 8), 'revealed', 'enemy')).toBe(false)
      blocked(input(out.state, id))
    },
  },
  {
    tag: 'summon',
    recordId: 'wildwarden.renewing-herbs',
    version: 7,
    exercise(recordId) {
      const id = recordId,
        state = fixture([id]),
        tile = { kind: 'tile' as const, position: { x: 2, y: 2 } }
      const out = cast(input(state, id, tile)),
        summon = out.state.effectState!.summons![0]!
      expect(summon.profile).toMatchObject({ maxHp: 36, maxMp: 12, lifetimeTurns: 5 })
      expect(summon.profile.abilities).toHaveLength(2)
      expect(
        out.state.tactical.battle.combatants.find((row) => row.id === summon.combatantId),
      ).toMatchObject({ hp: 36, mp: 12 })
      expect(ap(out.state)).toBe(50)
      expect(unit(out.state).mp).toBe(14)
      blocked(input(state, id, { kind: 'tile', position: { x: 2, y: 1 } }))
      let live = restored(out.state)
      let completed = 0
      for (let guard = 0; guard < 40 && live.effectState?.summons?.length; guard++) {
        if (live.tactical.battle.currentTurn?.combatantId === summon.combatantId) completed++
        live = finishPv1fTurn(live, 'east').state
      }
      expect(completed).toBe(5)
      expect(live.effectState?.summons ?? []).toEqual([])
      expect(live.tactical.battle.combatants.some((row) => row.id === summon.combatantId)).toBe(
        false,
      )
    },
  },
  {
    tag: 'damage-bonus',
    recordId: 'farstrider.keen-focus',
    version: 5,
    exercise(recordId) {
      const modifier = recordId,
        root = 'farstrider.aimed-shot',
        retryRoot = 'farstrider.pinning-shot',
        state = fixture([root, modifier, retryRoot])
      state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      const command = input(state, root),
        ordinary = cast(command)
      const out = cast({
        ...command,
        manualModifiers: [
          {
            sourceInstanceId: modifier,
            behaviorId: captured(modifier).definition.behaviors[0]!.id,
          },
        ],
      })
      expect(damage(ordinary.events)).toEqual([26])
      expect(damage(out.events)).toEqual([29])
      expect(unit(ordinary.state, 'enemy').hp).toBe(974)
      expect(unit(out.state, 'enemy').hp).toBe(971)
      expect(ap(out.state)).toBe(45)
      expect(unit(out.state).mp).toBe(17)
      expect(ap(ordinary.state)).toBe(55)
      expect(unit(ordinary.state).mp).toBe(20)
      // Isolate the modifier cooldown with an available compatible root and enough resources.
      const retry = restored(out.state)
      const owner = unit(retry)
      owner.temporaryResources = owner.temporaryResources.map((resource) =>
        resource.key === 'pv1f.action-economy' ? { ...resource, current: 100 } : resource,
      )
      owner.mp = 20
      expect(prepareCombatAbilityCommand(input(retry, retryRoot)).evaluation.legal).toBe(true)
      expect(ap(retry)).toBeGreaterThanOrEqual(55)
      blocked(
        {
          ...input(retry, retryRoot),
          manualModifiers: [
            {
              sourceInstanceId: modifier,
              behaviorId: captured(modifier).definition.behaviors[0]!.id,
            },
          ],
        },
        { code: 'cooldown-active' },
      )
    },
  },
]

it('requires an executed final-roster outcome case for every registered effect', () => {
  expect(cases.map((row) => row.tag).sort()).toEqual(
    COMBAT_TAG_REGISTRY.map((row) => row.id).sort(),
  )
})
it.each(cases)(
  '$tag executes the final proposed $recordId with a real counter or finite bound',
  (row) => {
    const source = captured(row.recordId)
    expect(source.abilityId).toBe(row.recordId)
    expect(source.contentVersion).toBe(row.version)
    expect(
      source.definition.behaviors[0]!.effects.some((effect) => effect.payload.type === row.tag),
    ).toBe(true)
    row.exercise(row.recordId)
  },
)
