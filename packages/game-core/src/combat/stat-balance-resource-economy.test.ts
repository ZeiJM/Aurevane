import { describe, expect, it } from 'vitest'
import { calculateDerivedStats, DERIVED_STAT_RULESET_V4 } from '../character/derived-stats'
import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { mitigateDamageByDefense } from './damage-mitigation'
import { calculateScaledRawDamage, currentSkillDamageScaling } from './damage-scaling'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  finishPv1fTurn,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  createStatBalancedCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
} from './stat-driven-combat'

const anchors = [
  {
    core: 0,
    power: 40,
    hp: 80,
    mp: 16,
    channel: 13,
    siphon: 11,
    drain: 15,
    physical: 22,
    mystic: 20,
  },
  {
    core: 40,
    power: 120,
    hp: 160,
    mp: 32,
    channel: 27,
    siphon: 20,
    drain: 33,
    physical: 25,
    mystic: 23,
  },
  {
    core: 60,
    power: 160,
    hp: 200,
    mp: 48,
    channel: 34,
    siphon: 25,
    drain: 42,
    physical: 26,
    mystic: 24,
  },
] as const
type Anchor = (typeof anchors)[number]
const target = { kind: 'unit', combatantId: 'target' } as const
const self = { kind: 'self' } as const

function skill(id: string) {
  const definition = resolveMatureSkillVersion(id)
  if (!definition) throw new Error(`Missing current Skill: ${id}`)
  return definition
}

function unit(state: StatDrivenCombatEncounterState, id = 'actor') {
  const combatant = state.tactical.battle.combatants.find((row) => row.id === id)
  if (!combatant) throw new Error(`Missing combatant: ${id}`)
  return combatant
}

function encounter(anchor: Anchor, actorMp = 2, targetMp: number = anchor.mp, seed = 123_456_789) {
  // Core0 is a synthetic mathematical intercept, never a newly created character.
  // Equal-Core scenarios isolate rating/pool curves, not a purchasable allocation.
  const snapshot =
    anchor.core === 0
      ? null
      : calculateDerivedStats(
          {
            attributes: {
              might: anchor.core,
              finesse: anchor.core,
              vitality: anchor.core,
              agility: anchor.core,
              intellect: anchor.core,
              resolve: anchor.core,
            },
            level: 1,
          },
          DERIVED_STAT_RULESET_V4,
        )
  const rating = (key: keyof NonNullable<typeof snapshot>['stats'], intercept: number) =>
    snapshot?.stats[key].value ?? intercept
  const profiles: StatDrivenCombatProfileV4[] = ['actor', 'target'].map((combatantId) => ({
    combatantId,
    provenance: {
      kind: 'scenario',
      sourceId: `scenario:resource-economy:${anchor.core}`,
      sourceRulesVersion: 4,
    },
    physicalPower: rating('physicalPower', 40),
    mysticPower: rating('mysticPower', 40),
    armor: rating('armor', 40),
    ward: rating('ward', 40),
    accuracy: rating('accuracy', 8_500),
    evasion: rating('evasion', 0),
    criticalChance: rating('criticalChance', 0),
    statusResistance: rating('statusResistance', 0),
    jump: rating('jump', 0),
    level: 1,
  }))
  const battle = startBattle(
    createPendingBattle({
      battleId: `battle:resource-economy:${anchor.core}`,
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: seed,
      combatants: ['actor', 'target'].map((id, index) => ({
        id,
        teamId: id,
        initiative: rating('initiative', 10) + 1 - index,
        baseMovementBudget: rating('movement', 2),
        hp: rating('maxHp', 80),
        maxHp: rating('maxHp', 80),
        mp: index === 0 ? actorMp : targetMp,
        maxMp: rating('maxMp', 16),
        temporaryResources: createPv1fTemporaryResources(100),
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'ground', traversalCost: 1 }],
      tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, terrainId: 'ground', elevation: 0 })),
      movementProfiles: [
        { id: 'ground', maxElevationStep: rating('jump', 0), terrainCostOverrides: [] },
      ],
      placements: ['actor', 'target'].map((combatantId, x) => ({
        combatantId,
        position: { x, y: 0 },
        facing: x === 0 ? 'east' : 'west',
        movementProfileId: 'ground',
      })),
    }),
  )
  return createStatBalancedCombatEncounterState(
    { ...base, effectStackingPolicyVersion: 1 },
    profiles,
  )
}

function nextActorTurn(state: StatDrivenCombatEncounterState) {
  const enemyTurn = finishPv1fTurn(state, 'east').state
  const next = finishPv1fTurn(enemyTurn, 'west').state
  expect(next.tactical.battle.currentTurn?.combatantId).toBe('actor')
  return next
}

describe('policy1 pools preserve published stat-scaled resource tempo', () => {
  it.each(anchors)(
    'keeps equal-rating AP60 Physical20/Mystic16 pressure at Core$core',
    (anchor) => {
      const state = encounter(anchor)
      expect(unit(state)).toMatchObject({ maxHp: anchor.hp, maxMp: anchor.mp })
      const profile = state.statBridge.combatants.find((row) => row.combatantId === 'actor')!
      expect(profile).toMatchObject({
        physicalPower: anchor.power,
        mysticPower: anchor.power,
        armor: anchor.power,
        ward: anchor.power,
      })
      expect(
        mitigateDamageByDefense(
          calculateScaledRawDamage(
            20,
            currentSkillDamageScaling('physical-power', 1, 60),
            profile.physicalPower!,
          ),
          profile.armor,
        ),
      ).toBe(anchor.physical)
      expect(
        mitigateDamageByDefense(
          calculateScaledRawDamage(
            16,
            currentSkillDamageScaling('mystic-power', 1, 60),
            profile.mysticPower!,
          ),
          profile.ward,
        ),
      ).toBe(anchor.mystic)
    },
  )

  it.each(anchors)(
    'pays Channel costs and restores its actual scaled output at Core$core',
    (anchor) => {
      const state = encounter(anchor)
      const definition = skill('aetherist.channel')
      const preview = evaluatePv1fMatureSkill(state, definition, self)
      expect(preview.evaluation.legal).toBe(true)
      expect(preview.action.effects).toContainEqual(
        expect.objectContaining({ type: 'resource-change', delta: anchor.channel }),
      )
      const used = executePv1fMatureSkill(state, definition, self).state
      // The initial 2MP pays the cost before recovery, rather than being recovered for free.
      expect(unit(used).mp).toBe(anchor.channel)
      expect(readPv1fActionEconomy(used, 'actor')?.current).toBe(65)
      const nearFull = executePv1fMatureSkill(
        encounter(anchor, anchor.mp - 1),
        definition,
        self,
      ).state
      expect(unit(nearFull).mp).toBe(anchor.mp)
      expect(
        evaluatePv1fMatureSkill(encounter(anchor, 1), definition, self).evaluation.issues,
      ).toContainEqual(expect.objectContaining({ code: 'insufficient-mp' }))
      expect(() => executePv1fMatureSkill(encounter(anchor, 1), definition, self)).toThrow(
        /enough MP/,
      )
    },
  )

  it.each(anchors)(
    'preserves independent Siphon recovery from an empty target at Core$core',
    (anchor) => {
      const state = encounter(anchor, 0, 0)
      const used = executePv1fMatureSkill(state, skill('runeblade.siphon-slash'), target)
      expect(used.events).toContainEqual(
        expect.objectContaining({ event: 'combat_accuracy_resolved', hit: true }),
      )
      expect(unit(used.state, 'target').mp).toBe(0)
      expect(unit(used.state).mp).toBe(anchor.siphon)
      expect(readPv1fActionEconomy(used.state, 'actor')?.current).toBe(55)
    },
  )

  it.each(anchors)(
    'a hostile miss preserves actor Siphon recovery and costs at Core$core',
    (anchor) => {
      // Seed24 draws88.89%, missing equal-Core profiles'85% hit chance without changing ratings.
      const state = encounter(anchor, 0, anchor.mp, 24)
      const used = executePv1fMatureSkill(state, skill('runeblade.siphon-slash'), target)
      expect(used.events).toContainEqual(
        expect.objectContaining({ event: 'combat_accuracy_resolved', hit: false }),
      )
      expect(unit(used.state, 'target')).toMatchObject({ hp: anchor.hp, mp: anchor.mp })
      expect(unit(used.state).mp).toBe(anchor.siphon)
      expect(readPv1fActionEconomy(used.state, 'actor')?.current).toBe(55)
      expect(
        evaluatePv1fMatureSkill(used.state, skill('runeblade.siphon-slash'), target).evaluation
          .legal,
      ).toBe(false)
    },
  )

  it.each(anchors)('scaled Static Drain respects the real target pool at Core$core', (anchor) => {
    const state = encounter(anchor, 3)
    const definition = skill('stormsinger.static-drain')
    const preview = evaluatePv1fMatureSkill(state, definition, target)
    expect(preview.action.effects).toContainEqual(
      expect.objectContaining({ type: 'resource-change', delta: -anchor.drain }),
    )
    const used = executePv1fMatureSkill(state, definition, target)
    expect(used.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: true }),
    )
    expect(unit(used.state, 'target').mp).toBe(anchor.core === 0 ? 1 : anchor.core === 40 ? 0 : 6)
    expect(unit(used.state).mp).toBe(0)
    expect(readPv1fActionEconomy(used.state, 'actor')?.current).toBe(55)
  })

  it('sustains further casts across real owner turns while enforcing AP and Channel cooldown', () => {
    const channel = skill('aetherist.channel')
    const overchannel = skill('aetherist.overchannel')
    const arcBolt = skill('aetherist.arc-bolt')
    let state: StatDrivenCombatEncounterState = encounter(anchors[1])
    state = executePv1fMatureSkill(state, channel, self).state
    state = executePv1fMatureSkill(state, overchannel, target).state
    expect(unit(state).mp).toBe(23)
    expect(readPv1fActionEconomy(state, 'actor')?.current).toBe(5)
    expect(evaluatePv1fMatureSkill(state, arcBolt, target).evaluation.legal).toBe(false)
    expect(() => executePv1fMatureSkill(state, arcBolt, target)).toThrow()
    expect(evaluatePv1fMatureSkill(state, channel, self).evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'cooldown-active' }),
    )
    state = nextActorTurn(JSON.parse(JSON.stringify(state)) as StatDrivenCombatEncounterState)
    expect(readPv1fActionEconomy(state, 'actor')?.current).toBe(100)
    expect(evaluatePv1fMatureSkill(state, channel, self).evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'cooldown-active' }),
    )
    state = nextActorTurn(state)
    expect(evaluatePv1fMatureSkill(state, channel, self).evaluation.legal).toBe(true)
    state = executePv1fMatureSkill(state, channel, self).state
    expect(unit(state).mp).toBe(32)
    state = executePv1fMatureSkill(state, arcBolt, target).state
    expect(unit(state).mp).toBe(29)
    expect(readPv1fActionEconomy(state, 'actor')?.current).toBe(20)
    expect(state.statBalancePolicyVersion).toBe(1)
    expect(state.statBridge.rulesVersion).toBe(4)
  })

  it('rejects an unaffordable cast even when recovery leaves sufficient MP and the action ready', () => {
    const recovered = executePv1fMatureSkill(
      encounter(anchors[1], 0, 0),
      skill('runeblade.siphon-slash'),
      target,
    ).state
    expect(unit(recovered).mp).toBe(20)
    expect(readPv1fActionEconomy(recovered, 'actor')?.current).toBe(55)
    expect(recovered.tactical.battle.currentTurn?.actionState).toBe('ready')
    const before = JSON.parse(JSON.stringify(recovered)) as StatDrivenCombatEncounterState
    expect(() => executePv1fMatureSkill(recovered, skill('aetherist.overchannel'), target)).toThrow(
      /Not enough Action Economy/,
    )
    expect(recovered).toEqual(before)
  })
})
