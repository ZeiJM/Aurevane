import { expect, it } from 'vitest'
import {
  PV1F_COMBAT_CONTENT,
  finishPv1fTurn,
  evaluatePv1fMovement,
  executePv1fMovement,
  validatePv1fFinalFacing,
} from './pv1f-action-economy'
import {
  captured,
  fixture,
  unit,
  ap,
  hasStatus,
  pair,
  commitRosterCommand as cast,
  restoreRosterEncounter as restored,
} from './roster-outcome.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  combatManualModifierAvailability,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand } from './combat-ability-command'
import { combatSourceCommandVisibility } from './actions'
import type { CombatEncounterState, CombatTargetSelection } from './actions'
import { captureBasicSkillSources, defaultBasicSkills } from './combat-basic-actions'
import { currentBarrierAmount } from './combat-barrier'
import { airborneJump } from './combat-airborne'
import {
  currentPoisonInstances,
  currentBurnInstances,
  currentBleedStacks,
  hasCurrentPoison,
  hasCurrentBurn,
  hasCurrentBleed,
  removeCurrentBurnState,
} from './combat-dots'
import {
  createPvpQualityResources,
  createAiQualityResources,
  timeoutPvpTurn,
  timeoutAiTurn,
} from './pvp-quality'
import { validateCombatTagPayload } from './combat-tag-registry'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

const self = { kind: 'self' as const },
  enemy = { kind: 'unit' as const, combatantId: 'enemy' }
const strike = 'vanguard.forceful-strike',
  bolt = 'aetherist.arc-bolt',
  scout = 'farstrider.scouts-mark',
  smoke = 'shadehand.smoke-vial'
const position = (state: CombatEncounterState, id: string) =>
  state.tactical.placements.find((row) => row.combatantId === id)!.position
// This file executes the immutable October10 roster. Enemy Blindside is exercised
// by the separate modular correction cohort and combat-blindside.test.ts. Counter
// and Endure are later authoring mechanics, verified by combat-counter.test.ts and
// combat-endure.test.ts; Endure has no application in the pinned October10 records.
const outsideOctober10Roster = [
  'lowered-guard',
  'displaced',
  'blindside-vulnerability',
  'counter',
  'endure',
]
function current(ids: string[], otherOwners: Record<string, string[]> = {}) {
  const base = fixture(ids),
    sources = [...base.capturedAbilitySources!]
  for (const [owner, abilities] of Object.entries(otherOwners))
    for (const id of abilities)
      sources.push(
        captureCombatAbilitySource({
          ...captured(id),
          sourceInstanceId: `${owner}.${id}`,
          ownerCombatantId: owner,
        }),
      )
  return restored(
    reconcileCombatAbilitySources(
      {
        ...base,
        dynamicInitiativePolicyVersion: 1,
        airbornePolicyVersion: 1,
        airborneJumpPolicyVersion: 1,
        healingDownPolicyVersion: 1,
        blindsideActivationPolicyVersion: 1,
        groundEffectPolicyVersion: 1,
        frozenGroundPolicyVersion: 1,
        dotTriggerPolicyVersion: 2,
        displacementPolicyVersion: 1,
      },
      sources,
    ),
  )
}
function command(
  state: CombatEncounterState,
  id: string,
  owner = 'actor',
  selection: CombatTargetSelection = enemy,
) {
  const source = state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === owner && row.abilityId === id,
  )
  if (!source) throw new Error(`Missing captured ${id} for ${owner}.`)
  return {
    state,
    actorId: owner,
    root: { kind: 'canonical' as const, source },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
function step(state: StatDrivenCombatEncounterState) {
  const owner = state.tactical.battle.currentTurn!.combatantId
  const facing = state.tactical.placements.find((row) => row.combatantId === owner)!.facing
  return finishPv1fTurn(state, facing).state
}
function turn(state: CombatEncounterState, owner: string) {
  let live = restored(state)
  for (let i = 0; i < 16 && live.tactical.battle.currentTurn?.combatantId !== owner; i++)
    live = step(live)
  expect(live.tactical.battle.currentTurn?.combatantId).toBe(owner)
  return live
}
function without(state: CombatEncounterState, id: string, owner: string) {
  const paired = restored(state)
  paired.statusState = paired.statusState.map((row) =>
    row.combatantId === owner
      ? { ...row, statuses: row.statuses.filter((status) => status.statusId !== id) }
      : row,
  )
  return restored(paired)
}
function active(state: CombatEncounterState, id: string, owner: string) {
  if (id === 'burn') return hasCurrentBurn(state, owner)
  if (id === 'bleed') return hasCurrentBleed(state, owner)
  if (id === 'poison') return hasCurrentPoison(state, owner)
  return hasStatus(state, id, owner)
}
function hpLoss(before: CombatEncounterState, after: CombatEncounterState, owner = 'enemy') {
  return unit(before, owner).hp - unit(after, owner).hp
}
function incomingComparison(state: CombatEncounterState, statusId: string) {
  const ready = turn(state, 'enemy'),
    paired = without(ready, statusId, 'actor')
  const target = { kind: 'unit' as const, combatantId: 'actor' }
  return {
    withStatus: hpLoss(ready, cast(command(ready, strike, 'enemy', target)).state, 'actor'),
    withoutStatus: hpLoss(paired, cast(command(paired, strike, 'enemy', target)).state, 'actor'),
  }
}
interface StatusCase {
  statusId: string
  recordId: string
  version: number
  exercise: () => { state: CombatEncounterState; owner: string }
}
const cases: StatusCase[] = [
  {
    statusId: 'guarded',
    recordId: 'vanguard.brace',
    version: 5,
    exercise() {
      const id = 'vanguard.brace',
        state = current([id], { enemy: [strike] }),
        applied = cast(command(state, id, 'actor', self)).state
      const compared = incomingComparison(applied, 'guarded')
      expect(compared.withStatus).toBeLessThan(compared.withoutStatus)
      expect(currentBarrierAmount(applied, 'actor')).toBe(12) //Both counterfixtures retain this same Barrier.
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'exposed',
    recordId: 'aetherist.arcane-field',
    version: 7,
    exercise() {
      const id = 'aetherist.arcane-field',
        state = current([id, strike]),
        applied = cast(command(state, id, 'actor', { kind: 'activate' })).state
      //Field leaves45AP: exactly enough for this real follow-up; compare only the status.
      const paired = without(applied, 'exposed', 'enemy')
      const withStatus = cast(command(applied, strike)).state,
        ordinary = cast(command(paired, strike)).state
      expect(hpLoss(applied, withStatus)).toBeGreaterThan(hpLoss(paired, ordinary))
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'covert',
    recordId: smoke,
    version: 6,
    exercise() {
      const state = current([smoke, strike]),
        applied = cast(command(state, smoke, 'actor', self)).state
      expect(combatSourceCommandVisibility(state, 'actor')).toBeUndefined()
      expect(combatSourceCommandVisibility(applied, 'actor')).toEqual({
        kind: 'team-only',
        teamId: 'players',
      })
      expect(
        combatSourceCommandVisibility(without(applied, 'covert', 'actor'), 'actor'),
      ).toBeUndefined()
      const attacked = cast(command(applied, strike)).state
      expect(hasStatus(attacked, 'invisible')).toBe(false)
      expect(combatSourceCommandVisibility(attacked, 'actor')).toEqual({
        kind: 'team-only',
        teamId: 'players',
      })
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'revealed',
    recordId: scout,
    version: 5,
    exercise() {
      const initial = current([smoke, strike, bolt], { enemy: [scout] })
      const hidden = cast(command(initial, smoke, 'actor', self)).state
      const unhidden = cast(command(hidden, bolt)).state //Damage breaks Invisible, preserving Covert.
      const foe = turn(unhidden, 'enemy'),
        revealed = cast(command(foe, scout, 'enemy', { kind: 'unit', combatantId: 'actor' })).state
      expect(hasStatus(revealed, 'covert')).toBe(false)
      const ready = turn(revealed, 'actor'),
        paired = without(ready, 'revealed', 'actor')
      expect(hasStatus(ready, 'revealed')).toBe(true)
      expect(prepareCombatAbilityCommand(command(ready, strike)).costs).toContainEqual({
        resource: 'ap',
        amount: 90,
      })
      expect(prepareCombatAbilityCommand(command(paired, strike)).costs).toContainEqual({
        resource: 'ap',
        amount: 45,
      })
      expect(ap(cast(command(ready, strike)).state)).toBe(10)
      return { state: revealed, owner: 'actor' }
    },
  },
  {
    statusId: 'wet',
    recordId: 'tidecaller.water-lance',
    version: 8,
    exercise() {
      const id = 'tidecaller.water-lance',
        state = current([id])
      for (const [owner, initiative] of Object.entries({
        actor: 100,
        enemy: 90,
        other: 85,
        ally: 80,
      }))
        unit(state, owner).initiative = initiative
      const applied = cast(command(state, id)).state
      expect(applied.tactical.battle.initiativeOrder).toEqual(['actor', 'other', 'enemy', 'ally'])
      expect(unit(applied, 'enemy').initiative).toBe(90)
      expect(applied.tactical.battle.currentTurn?.combatantId).toBe('actor')
      expect(step(restored(applied)).tactical.battle.currentTurn?.combatantId).toBe('other')
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'frozen',
    recordId: 'frostweaver.ice-lance',
    version: 8,
    exercise() {
      const id = 'frostweaver.ice-lance',
        applied = cast(command(current([id], { enemy: [strike] }), id)).state,
        ready = turn(applied, 'enemy')
      const facing = ready.tactical.placements.find((row) => row.combatantId === 'enemy')!.facing
      const before = JSON.stringify(ready)
      expect(() => validatePv1fFinalFacing(ready, facing === 'west' ? 'east' : 'west')).toThrow(
        'Chilled prevents changing final facing',
      )
      expect(() => validatePv1fFinalFacing(ready, facing)).not.toThrow()
      expect(
        prepareCombatAbilityCommand(
          command(ready, strike, 'enemy', { kind: 'unit', combatantId: 'actor' }),
        ).evaluation.legal,
      ).toBe(true)
      expect(
        evaluatePv1fMovement(ready, [
          { x: 2, y: 1 },
          { x: 2, y: 0 },
        ]).movement.legal,
      ).toBe(true)
      expect(JSON.stringify(ready)).toBe(before)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'conductive',
    recordId: 'stormsinger.arc-spark',
    version: 8,
    exercise() {
      const id = 'stormsinger.arc-spark',
        other = 'stormsinger.static-drain',
        state = current([id, other]),
        applied = cast(command(state, id)).state
      const paired = without(applied, 'conductive', 'enemy')
      const withCharge = cast(command(applied, other)),
        plain = cast(command(paired, other))
      expect(hpLoss(applied, withCharge.state)).toBeGreaterThan(hpLoss(paired, plain.state))
      expect(withCharge.events).toContainEqual(
        expect.objectContaining({
          event: 'status_removed',
          statusId: 'conductive',
          targetCombatantId: 'enemy',
        }),
      )
      const charge = withCharge.state.statusState
        .find((row) => row.combatantId === 'enemy')!
        .statuses.filter((row) => row.statusId === 'conductive')
      expect(charge).toHaveLength(1)
      expect(charge[0]!.stacks).toBe(1)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'inspired',
    recordId: 'vanguard.rally',
    version: 6,
    exercise() {
      const id = 'vanguard.rally',
        applied = cast(command(current([id, strike]), id, 'actor', self)).state
      const paired = without(applied, 'inspired', 'actor')
      expect(hpLoss(applied, cast(command(applied, strike)).state)).toBeGreaterThan(
        hpLoss(paired, cast(command(paired, strike)).state),
      )
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'blindside',
    recordId: 'shadehand.backstab',
    version: 6,
    exercise() {
      const id = 'shadehand.backstab',
        state = current([id, strike])
      state.tactical.placements.find((row) => row.combatantId === 'enemy')!.facing = 'north'
      const applied = cast(command(state, id)).state,
        paired = without(applied, 'blindside', 'actor')
      expect(hpLoss(applied, cast(command(applied, strike)).state)).toBeGreaterThan(
        hpLoss(paired, cast(command(paired, strike)).state),
      )
      const front = current([id])
      const facingFront = cast(command(front, id)).state
      expect(hasStatus(facingFront, 'blindside')).toBe(false)
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'suppress',
    recordId: 'aetherist.chain-spark',
    version: 7,
    exercise() {
      const id = 'aetherist.chain-spark',
        applied = cast(command(current([id], { enemy: [strike] }), id)).state
      const ready = turn(applied, 'enemy'),
        paired = without(ready, 'suppress', 'enemy'),
        target = { kind: 'unit' as const, combatantId: 'actor' }
      expect(
        hpLoss(ready, cast(command(ready, strike, 'enemy', target)).state, 'actor'),
      ).toBeLessThan(hpLoss(paired, cast(command(paired, strike, 'enemy', target)).state, 'actor'))
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'hexed',
    recordId: 'lifebinder.vital-sever',
    version: 6,
    exercise() {
      const id = 'lifebinder.vital-sever',
        heal = 'lifebinder.mending-light',
        channel = 'aetherist.channel',
        initial = current([id], { enemy: [heal, channel] })
      unit(initial, 'enemy').hp = 600
      const applied = cast(command(initial, id)).state,
        ready = turn(applied, 'enemy'),
        paired = without(ready, 'hexed', 'enemy')
      const reduced = cast(command(ready, heal, 'enemy', self)).state,
        normal = cast(command(paired, heal, 'enemy', self)).state
      expect(unit(reduced, 'enemy').hp - unit(ready, 'enemy').hp).toBe(75)
      expect(unit(normal, 'enemy').hp - unit(paired, 'enemy').hp).toBe(100)
      const low = restored(ready)
      unit(low, 'enemy').mp = 8
      const clean = without(low, 'hexed', 'enemy')
      let after = cast(command(low, channel, 'enemy', self)).state,
        unhexed = cast(command(clean, channel, 'enemy', self)).state
      for (let i = 0; i < 4; i++) {
        after = step(after)
        unhexed = step(unhexed)
      }
      expect(unit(after, 'enemy').mp).toBe(9)
      expect(unit(unhexed, 'enemy').mp).toBe(10)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'invisible',
    recordId: smoke,
    version: 6,
    exercise() {
      const applied = cast(
        command(current([smoke, strike], { enemy: [strike] }), smoke, 'actor', self),
      ).state
      const ready = turn(applied, 'enemy'),
        target = { kind: 'unit' as const, combatantId: 'actor' },
        before = JSON.stringify(ready)
      expect(
        prepareCombatAbilityCommand(command(ready, strike, 'enemy', target)).evaluation.issues,
      ).toContainEqual(expect.objectContaining({ code: 'target-invisible' }))
      expect(
        prepareCombatAbilityCommand(
          command(without(ready, 'invisible', 'actor'), strike, 'enemy', target),
        ).evaluation.legal,
      ).toBe(true)
      expect(JSON.stringify(ready)).toBe(before)
      expect(hasStatus(cast(command(applied, strike)).state, 'invisible')).toBe(false)
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'airborne',
    recordId: 'ironfist.breakfall',
    version: 6,
    exercise() {
      const id = 'ironfist.breakfall',
        state = current([id]),
        applied = cast(command(state, id, 'actor', self)).state
      expect(airborneJump(applied, 'actor', 0, PV1F_COMBAT_CONTENT)).toBe(3)
      expect(
        airborneJump(without(applied, 'airborne', 'actor'), 'actor', 0, PV1F_COMBAT_CONTENT),
      ).toBe(0)
      const raised = restored(applied)
      raised.tactical.tiles = raised.tactical.tiles.map((tile) =>
        tile.position.x === 1 && tile.position.y === 0 ? { ...tile, elevation: 2 } : tile,
      )
      const path = [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ]
      expect(evaluatePv1fMovement(raised, path).movement.legal).toBe(true)
      expect(evaluatePv1fMovement(without(raised, 'airborne', 'actor'), path).movement.legal).toBe(
        false,
      )
      expect(position(executePv1fMovement(raised, path).state, 'actor')).toEqual({ x: 1, y: 0 })
      expect(state.statBridge.combatants.find((row) => row.combatantId === 'actor')!.jump).toBe(0)
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'haste',
    recordId: 'chronist.haste',
    version: 5,
    exercise() {
      const id = 'chronist.haste',
        applied = cast(command(current([id]), id, 'actor', self)).state,
        paired = without(applied, 'haste', 'actor'),
        path = [
          { x: 1, y: 1 },
          { x: 1, y: 0 },
        ]
      const fast = evaluatePv1fMovement(restored(applied), path),
        normal = evaluatePv1fMovement(paired, path)
      expect(fast.movement.legal).toBe(true)
      expect(normal.economyCost - fast.economyCost).toBe(10)
      const moved = executePv1fMovement(restored(applied), path).state
      expect(ap(moved)).toBe(ap(applied)! - fast.economyCost)
      expect(moved.tactical.battle.currentTurn!.movementRemaining).toBe(
        applied.tactical.battle.currentTurn!.movementRemaining - 1,
      )
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'burn',
    recordId: 'cinderweaver.cinder-bolt',
    version: 8,
    exercise() {
      const id = 'cinderweaver.cinder-bolt',
        applied = cast(command(current([id]), id)).state
      expect(currentBurnInstances(applied, 'enemy')[0]!.percentageDamage).toMatchObject({
        capturedDamage: 21,
        profile: { basisPoints: 2000, decayBasisPointsPerTick: 500 },
      })
      let later = restored(applied)
      for (let i = 0; i < 4; i++) later = step(later)
      expect(hpLoss(applied, later)).toBe(4)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'bleed',
    recordId: 'ravager.gash',
    version: 6,
    exercise() {
      const id = 'ravager.gash',
        applied = cast(command(current([id]), id)).state
      expect(currentBleedStacks(applied, 'enemy')[0]!.percentageDamage).toMatchObject({
        capturedDamage: 21,
        profile: { basisPoints: 1500 },
      })
      let later = restored(applied)
      for (let i = 0; i < 4; i++) later = step(later)
      expect(hpLoss(applied, later)).toBe(3)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'poison',
    recordId: pair('farstrider', 'wildwarden'),
    version: 6,
    exercise() {
      const id = pair('farstrider', 'wildwarden'),
        initial = current([scout, id])
      initial.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      const setup = cast(command(initial, scout)).state,
        applied = cast(command(setup, id)).state
      expect(currentPoisonInstances(applied, 'enemy')[0]!.percentageDamage).toMatchObject({
        capturedDamage: 19,
        profile: { basisPoints: 1500 },
      })
      let later = restored(applied)
      for (let i = 0; i < 4; i++) later = step(later)
      expect(hpLoss(applied, later)).toBe(2)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'slow',
    recordId: 'farstrider.pinning-shot',
    version: 5,
    exercise() {
      const id = 'farstrider.pinning-shot',
        initial = current([id])
      initial.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      const applied = cast(command(initial, id)).state,
        ready = turn(applied, 'enemy'),
        paired = without(ready, 'slow', 'enemy'),
        path = [
          { x: 2, y: 1 },
          { x: 2, y: 0 },
        ]
      const slowed = evaluatePv1fMovement(ready, path),
        normal = evaluatePv1fMovement(paired, path)
      expect(slowed.economyCost - normal.economyCost).toBe(10)
      const moved = executePv1fMovement(ready, path).state
      expect(
        unit(moved, 'enemy').temporaryResources.find((row) => row.key === 'pv1f.action-economy')!
          .current,
      ).toBe(100 - slowed.economyCost)
      expect(moved.tactical.battle.currentTurn!.movementRemaining).toBe(
        ready.tactical.battle.currentTurn!.movementRemaining - 1,
      )
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'root',
    recordId: 'chronist.time-lock',
    version: 5,
    exercise() {
      const id = 'chronist.time-lock',
        applied = cast(command(current([id], { enemy: [strike] }), id)).state,
        ready = turn(applied, 'enemy'),
        path = [
          { x: 2, y: 1 },
          { x: 2, y: 0 },
        ]
      expect(evaluatePv1fMovement(ready, path).movement.legal).toBe(false)
      expect(evaluatePv1fMovement(without(ready, 'root', 'enemy'), path).movement.legal).toBe(true)
      expect(() => validatePv1fFinalFacing(ready, 'east')).not.toThrow()
      const attacked = cast(
        command(ready, strike, 'enemy', { kind: 'unit', combatantId: 'actor' }),
      ).state
      expect(unit(attacked).hp).toBe(972)
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'reckless',
    recordId: 'ravager.frenzy',
    version: 5,
    exercise() {
      const id = 'ravager.frenzy',
        applied = cast(
          command(current([id, strike], { enemy: [strike] }), id, 'actor', self),
        ).state,
        paired = without(applied, 'reckless', 'actor')
      expect(hpLoss(applied, cast(command(applied, strike)).state)).toBeGreaterThan(
        hpLoss(paired, cast(command(paired, strike)).state),
      )
      const compared = incomingComparison(applied, 'reckless')
      expect(compared.withStatus).toBeGreaterThan(compared.withoutStatus)
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'fortified',
    recordId: 'bastion.fortress',
    version: 5,
    exercise() {
      const id = 'bastion.fortress',
        applied = cast(
          command(current([id, strike], { enemy: [strike] }), id, 'actor', self),
        ).state,
        paired = without(applied, 'fortified', 'actor')
      expect(hpLoss(applied, cast(command(applied, strike)).state)).toBeLessThan(
        hpLoss(paired, cast(command(paired, strike)).state),
      )
      const compared = incomingComparison(applied, 'fortified')
      expect(compared.withStatus).toBeLessThan(compared.withoutStatus)
      return { state: applied, owner: 'actor' }
    },
  },
  {
    statusId: 'challenged',
    recordId: 'bastion.challenge',
    version: 5,
    exercise() {
      const id = 'bastion.challenge',
        applied = cast(command(current([id], { enemy: [bolt] }), id)).state,
        ready = turn(applied, 'enemy'),
        paired = without(ready, 'challenged', 'enemy')
      const source = { kind: 'unit' as const, combatantId: 'actor' },
        other = { kind: 'unit' as const, combatantId: 'ally' }
      expect(hpLoss(ready, cast(command(ready, bolt, 'enemy', source)).state, 'actor')).toBe(
        hpLoss(paired, cast(command(paired, bolt, 'enemy', source)).state, 'actor'),
      )
      expect(hpLoss(ready, cast(command(ready, bolt, 'enemy', other)).state, 'ally')).toBeLessThan(
        hpLoss(paired, cast(command(paired, bolt, 'enemy', other)).state, 'ally'),
      )
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'mark',
    recordId: scout,
    version: 5,
    exercise() {
      const applied = cast(command(current([scout, strike], { ally: [bolt] }), scout)).state
      applied.statBridge.combatants.find((row) => row.combatantId === 'actor')!.accuracy = 6000
      applied.statBridge.combatants.find((row) => row.combatantId === 'ally')!.accuracy = 6000
      const paired = without(applied, 'mark', 'enemy')
      const chance = (state: CombatEncounterState, id: string, owner: string) =>
        prepareCombatAbilityCommand(command(state, id, owner)).evaluation.targetHitChances![0]!
          .hitChanceBasisPoints
      expect(chance(applied, strike, 'actor') - chance(paired, strike, 'actor')).toBe(1500)
      const allyTurn = turn(applied, 'ally'),
        plain = without(allyTurn, 'mark', 'enemy')
      expect(chance(allyTurn, bolt, 'ally')).toBe(chance(plain, bolt, 'ally'))
      return { state: applied, owner: 'enemy' }
    },
  },
  {
    statusId: 'warded',
    recordId: 'cinderweaver.ash-ward',
    version: 5,
    exercise() {
      const id = 'cinderweaver.ash-ward',
        fire = 'cinderweaver.cinder-bolt',
        initial = current([id, fire], { enemy: [fire, strike] })
      const foe = turn(initial, 'enemy'),
        burned = cast(command(foe, fire, 'enemy', { kind: 'unit', combatantId: 'actor' })).state
      const own = turn(burned, 'actor'),
        ward = cast(command(own, id, 'actor', self)).state
      const applied = cast(command(ward, fire)).state,
        ready = turn(applied, 'enemy'),
        paired = without(ready, 'warded', 'actor')
      const target = { kind: 'unit' as const, combatantId: 'actor' }
      const reduced = hpLoss(ready, cast(command(ready, strike, 'enemy', target)).state, 'actor')
      const normal = hpLoss(paired, cast(command(paired, strike, 'enemy', target)).state, 'actor')
      expect(reduced).toBeLessThan(normal)
      const noBurn = restored(removeCurrentBurnState(ready, 'enemy'))
      expect(hpLoss(noBurn, cast(command(noBurn, strike, 'enemy', target)).state, 'actor')).toBe(
        normal,
      )
      return { state: applied, owner: 'actor' }
    },
  },
]

it('requires a real mechanic outcome for every authorable status in the October10 roster', () => {
  expect(cases.map((row) => row.statusId).sort()).toEqual(
    [...new Set(PV1F_COMBAT_CONTENT.statuses.map((row) => row.id))]
      .filter((id) => !outsideOctober10Roster.includes(id))
      .sort(),
  )
})
it.each(cases)(
  '$statusId has a pinned final-roster application, real mechanic and finite expiration',
  (row) => {
    const source = captured(row.recordId)
    expect(source.contentVersion).toBe(row.version)
    expect(
      source.definition.behaviors
        .flatMap((group) => group.effects)
        .some(
          (effect) =>
            effect.payload.type === row.statusId ||
            (effect.payload.type === 'apply-status' && effect.payload.statusId === row.statusId) ||
            (row.statusId === 'revealed' && effect.payload.type === 'sensory'),
        ),
    ).toBe(true)
    const result = row.exercise()
    expect(active(result.state, row.statusId, result.owner)).toBe(true)
    let later = restored(result.state)
    for (let i = 0; i < 16; i++) later = step(later)
    expect(active(later, row.statusId, result.owner)).toBe(false)
  },
)
it('Sensory removes Covert while preserving an unrelated real Suppress application', () => {
  const spark = 'aetherist.chain-spark'
  const initial = current([smoke, strike], { enemy: [spark, scout] })
  const hidden = cast(command(initial, smoke, 'actor', self)).state
  const unhidden = cast(command(hidden, strike)).state
  const foe = turn(unhidden, 'enemy')
  const target = { kind: 'unit' as const, combatantId: 'actor' }
  const suppressed = cast(command(foe, spark, 'enemy', target)).state
  expect(hasStatus(suppressed, 'suppress')).toBe(true)
  expect(hasStatus(suppressed, 'covert')).toBe(true)
  const revealed = cast(command(suppressed, scout, 'enemy', target)).state
  expect(hasStatus(revealed, 'revealed')).toBe(true)
  expect(hasStatus(revealed, 'covert')).toBe(false)
  expect(hasStatus(revealed, 'suppress')).toBe(true)
})

it('quotes and enforces Revealed on canonical Essence and modifier AP without altering intrinsic captures', () => {
  const essence = 'essence.vanguard.unbroken-strike',
    modifier = 'farstrider.keen-focus'
  const initial = current([smoke, bolt, essence, modifier, 'farstrider.aimed-shot'], {
    enemy: [scout],
  })
  const hidden = cast(command(initial, smoke, 'actor', self)).state
  const unhidden = cast(command(hidden, bolt)).state
  const foe = turn(unhidden, 'enemy')
  const revealed = cast(command(foe, scout, 'enemy', { kind: 'unit', combatantId: 'actor' })).state
  const ready = turn(revealed, 'actor'),
    before = JSON.stringify(ready)
  expect(hasStatus(ready, 'revealed')).toBe(true)
  const expensive = prepareCombatAbilityCommand(command(ready, essence))
  expect(expensive.costs).toEqual([
    { resource: 'ap', amount: 130 },
    { resource: 'mp', amount: 6 },
  ])
  expect(expensive.evaluation.issues).toEqual([
    { code: 'insufficient-ap', message: 'Insufficient AP for atomic command payment.' },
  ])
  expect(
    prepareCombatAbilityCommand(command(without(ready, 'revealed', 'actor'), essence)).evaluation
      .legal,
  ).toBe(true)
  const ranged = restored(ready)
  ranged.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 0, y: 1 }
  const attached = prepareCombatAbilityCommand({
    ...command(ranged, 'farstrider.aimed-shot'),
    manualModifiers: [{ sourceInstanceId: modifier, behaviorId: 'keen-focus' }],
  })
  expect(attached.costs).toEqual([
    { resource: 'ap', amount: 110 },
    { resource: 'mp', amount: 3 },
  ])
  expect(attached.evaluation.issues).toEqual([
    { code: 'insufficient-ap', message: 'Insufficient AP for atomic command payment.' },
  ])
  expect(
    prepareCombatAbilityCommand({
      ...command(without(ranged, 'revealed', 'actor'), 'farstrider.aimed-shot'),
      manualModifiers: [{ sourceInstanceId: modifier, behaviorId: 'keen-focus' }],
    }).evaluation.legal,
  ).toBe(true)
  const basics = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: 'basic.guard',
    definitions: defaultBasicSkills(),
  })
  const withBasics = restored(
    reconcileCombatAbilitySources(ready, [...ready.capturedAbilitySources!, ...basics]),
  )
  const basic = command(withBasics, 'unarmed.basic')
  expect(prepareCombatAbilityCommand(basic).costs).toEqual([{ resource: 'ap', amount: 30 }])
  expect(ap(cast(basic).state)).toBe(70)
  const availability = combatManualModifierAvailability(ready, 'actor').find(
    (row) => row.sourceInstanceId === modifier,
  )!
  expect(availability.costs).toEqual([
    { resource: 'ap', amount: 20 },
    { resource: 'mp', amount: 3 },
  ])
  expect(availability.ownerEligible).toBe(true)
  expect(JSON.stringify(ready)).toBe(before)
  const low = restored(ready)
  unit(low).temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current = 15
  expect(
    combatManualModifierAvailability(low, 'actor').find((row) => row.sourceInstanceId === modifier)!
      .blockedReasons,
  ).toEqual(['insufficient-ap'])
})

it.each(['pvp', 'ai'] as const)(
  'keeps Lowered Guard system-generated on genuine idle %s expiry',
  (kind) => {
    const initial = current([strike], { enemy: [strike] })
    for (const owner of initial.tactical.battle.combatants)
      owner.temporaryResources = [
        ...owner.temporaryResources,
        ...(kind === 'pvp' ? createPvpQualityResources() : createAiQualityResources()),
      ].sort((a, b) => a.key.localeCompare(b.key))
    const timeout = kind === 'pvp' ? timeoutPvpTurn : timeoutAiTurn
    const expired = timeout(initial).state
    expect(
      expired.pendingEffects?.some(
        (row) => row.effect.type === 'apply-status' && row.effect.statusId === 'lowered-guard',
      ),
    ).toBe(true)
    let activated = restored(expired)
    for (
      let i = 0;
      i < 4 && activated.tactical.battle.round < initial.tactical.battle.round + 1;
      i++
    )
      activated = step(activated)
    expect(activated.tactical.battle.round).toBe(initial.tactical.battle.round + 1)
    expect(hasStatus(activated, 'lowered-guard')).toBe(true)
    const compared = incomingComparison(activated, 'lowered-guard')
    expect(compared.withStatus).toBeGreaterThan(compared.withoutStatus)
    const acted = cast(command(initial, strike)).state
    expect(
      timeout(acted).state.pendingEffects?.some(
        (row) => row.effect.type === 'apply-status' && row.effect.statusId === 'lowered-guard',
      ) ?? false,
    ).toBe(false)
    expect(
      step(initial).pendingEffects?.some(
        (row) => row.effect.type === 'apply-status' && row.effect.statusId === 'lowered-guard',
      ) ?? false,
    ).toBe(false)
  },
)
it('keeps Displaced historical-only and current Push grants no turn, AP or Movement refund', () => {
  const id = 'vanguard.shield-bash',
    state = current([id])
  state.tactical.placements.find((row) => row.combatantId === 'other')!.position = { x: 4, y: 4 }
  const out = cast(command(state, id)).state
  expect(position(out, 'enemy')).toEqual({ x: 3, y: 1 })
  expect(hasStatus(out, 'displaced', 'enemy')).toBe(false)
  expect(out.tactical.battle.currentTurn!.combatantId).toBe('actor')
  expect(out.tactical.battle.currentTurn!.movementRemaining).toBe(
    state.tactical.battle.currentTurn!.movementRemaining,
  )
  expect(unit(out, 'enemy').temporaryResources).toEqual(unit(state, 'enemy').temporaryResources)
  expect(
    validateCombatTagPayload({
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'displaced',
      stacks: 1,
    }).length,
  ).toBeGreaterThan(0)
  const historical = restored(state)
  historical.statusState = historical.statusState.map((row) =>
    row.combatantId === 'actor'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'displaced',
              statusVersion: 1,
              sourceCombatantId: 'actor',
              stacks: 1,
              remainingOwnerTurnStarts: 1,
            },
          ],
        }
      : row,
  )
  expect(ap(restored(historical))).toBe(ap(state))
  expect(restored(historical).tactical.battle.currentTurn).toEqual(
    state.tactical.battle.currentTurn,
  )
})
