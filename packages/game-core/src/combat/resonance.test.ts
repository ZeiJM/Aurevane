import { describe, expect, it } from 'vitest'

import { createCombatEncounterState, type CombatEffectDefinition } from './actions'
import { createPendingBattle, endTurn, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  P35_REPRESENTATIVE_RESONANCES,
  createResonanceCombatState,
  executeMatureSkillWithResonance,
  forecastResonanceForSkill,
  resonanceAiUtilityBonus,
  resonanceSnapshotReference,
  resolveResonanceForPair,
  validateResonanceDefinition,
} from './resonance'
import { rebalanceResonanceDefinition } from './resonance-balance-v5'
import { normalizedResonanceMechanics } from './resonance-v2'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.5-resonance',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 54321,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 30,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open-ground', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      ],
      movementProfiles: [
        { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
        { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      ],
      placements: [
        {
          combatantId: 'player',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'player-ground',
        },
        {
          combatantId: 'recruit',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'recruit-ground',
        },
      ],
    }),
  )
}

function nextPlayerAction(state: ReturnType<typeof encounter>) {
  const playerFacing = selectCurrentFinalFacing(state.tactical, 'east').state
  const recruitTurn = endTurn(playerFacing.battle).state
  const recruitFacing = selectCurrentFinalFacing(
    { ...playerFacing, battle: recruitTurn },
    'west',
  ).state
  const playerTurn = endTurn(recruitFacing.battle).state
  return {
    ...state,
    tactical: {
      ...recruitFacing,
      battle: playerTurn,
    },
  }
}

describe('P3.5 versioned Resonance framework', () => {
  it('keeps representative definitions valid and resolves one canonical unordered pair', () => {
    for (const definition of P35_REPRESENTATIVE_RESONANCES) {
      expect(validateResonanceDefinition(definition)).toEqual([])
    }

    const forward = resolveResonanceForPair('lifebinder', 'vanguard', 1)
    const reverse = resolveResonanceForPair('vanguard', 'lifebinder', 1)
    expect(forward?.id).toBe('resonance.lifebinder-vanguard.mercys-edge')
    expect(reverse?.id).toBe(forward?.id)
    expect(resolveResonanceForPair('vanguard', null)).toBeNull()
    expect(resolveResonanceForPair('vanguard', 'vanguard')).toBeNull()
    expect(resolveResonanceForPair('vanguard', 'unknown-discipline')).toBeNull()
  })

  it('exposes a stable snapshot identity without embedding executable trigger state', () => {
    const definition = resolveResonanceForPair('vanguard', 'lifebinder', 1)
    if (!definition) throw new Error('Expected representative Resonance.')
    expect(resonanceSnapshotReference(definition)).toEqual({
      resonanceId: definition.id,
      contentVersion: 1,
      disciplinePair: ['lifebinder', 'vanguard'],
    })
  })

  it('arms on a successful Lifebinder heal and gives the next Vanguard melee Skill a bounded payoff', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder', 1)
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    const strike = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!resonance || !heal || !strike) throw new Error('Expected representative P3.5 content.')

    const initialResonanceState = createResonanceCombatState(resonance)
    const setup = executeMatureSkillWithResonance({
      state: encounter(),
      resonance,
      resonanceState: initialResonanceState,
      skill: heal,
      combatContext: 'pve',
      selection: { kind: 'self' },
      content: { statuses: [] },
    })

    expect(setup.resonanceState.armedByActionId).toBe(heal.id)
    expect(setup.events).toContainEqual(
      expect.objectContaining({ event: 'resonance_armed', resonanceId: resonance.id }),
    )

    const payoff = executeMatureSkillWithResonance({
      state: nextPlayerAction(setup.state),
      resonance,
      resonanceState: setup.resonanceState,
      skill: strike,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
      content: { statuses: [] },
    })

    const recruit = payoff.state.tactical.battle.combatants.find((row) => row.id === 'recruit')
    expect(recruit?.hp).toBe(32)
    expect(payoff.resonanceState.armedByActionId).toBeNull()
    expect(payoff.events).toContainEqual(
      expect.objectContaining({
        event: 'resonance_activated',
        resonanceId: resonance.id,
        setupActionId: heal.id,
        payoffActionId: strike.id,
      }),
    )
  })

  it('expires an armed setup on an intervening non-payoff Discipline Skill and never loops itself', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder', 1)
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!resonance || !heal) throw new Error('Expected representative P3.5 content.')

    const armed = {
      ...createResonanceCombatState(resonance),
      armedByActionId: 'lifebinder.previous-heal',
    }
    const forecast = forecastResonanceForSkill(resonance, armed, heal)
    expect(forecast).toMatchObject({
      willArm: true,
      willActivate: false,
      willExpireArmedSetup: true,
    })
    expect(forecast.bonusEffects).toEqual([])
  })

  it('makes the armed payoff more valuable to AI without changing Skill legality', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder', 1)
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    const strike = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!resonance || !heal || !strike) throw new Error('Expected representative P3.5 content.')

    const ready = createResonanceCombatState(resonance)
    expect(resonanceAiUtilityBonus(resonance, ready, heal)).toBe(12)
    expect(resonanceAiUtilityBonus(resonance, ready, strike)).toBe(0)

    const armed = { ...ready, armedByActionId: heal.id }
    expect(resonanceAiUtilityBonus(resonance, armed, strike)).toBe(30)
  })
})

describe('Combat v5.1 Resonance v2 runtime', () => {
  it('activates an immediate Trigger without arming stale Setup state', () => {
    const resonance = resolveResonanceForPair('farstrider', 'lifebinder')
    const shot = resolveMatureSkillVersion('farstrider.aimed-shot', 1)
    if (!resonance || !shot) throw new Error('Expected immediate Resonance v2 fixtures.')

    const ready = createResonanceCombatState(resonance)
    const forecast = forecastResonanceForSkill(resonance, ready, shot)
    expect(forecast).toMatchObject({
      willArm: false,
      willActivate: true,
      willExpireArmedSetup: false,
    })

    const resolved = executeMatureSkillWithResonance({
      state: encounter(),
      resonance,
      resonanceState: ready,
      skill: shot,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
      content: { statuses: [] },
    })

    expect(resolved.resonanceState.armedByActionId).toBeNull()
    expect(resolved.events).toContainEqual(
      expect.objectContaining({
        event: 'resonance_activated',
        resonanceId: resonance.id,
        setupActionId: null,
        triggerActionId: shot.id,
        payoffActionId: shot.id,
      }),
    )
    expect(resolved.events).not.toContainEqual(
      expect.objectContaining({ event: 'resonance_armed', resonanceId: resonance.id }),
    )
  })
})

describe('Combat v5 thematic Resonance rebalance', () => {
  it('derives payoff variety from authored setup Disciplines rather than Resonance IDs', () => {
    const lifebinder = resolveResonanceForPair('lifebinder', 'vanguard', 1)
    const farstrider = resolveResonanceForPair('farstrider', 'vanguard', 1)
    const cinderweaver = resolveResonanceForPair('cinderweaver', 'vanguard', 1)
    if (!lifebinder || !farstrider || !cinderweaver) {
      throw new Error('Expected representative thematic Resonances.')
    }

    const lifebinderV5 = rebalanceResonanceDefinition(lifebinder)
    const farstriderV5 = rebalanceResonanceDefinition(farstrider)
    const cinderweaverV5 = rebalanceResonanceDefinition(cinderweaver)

    expect(lifebinderV5.trigger.payoffEffects).toContainEqual(
      expect.objectContaining({ type: 'healing', recipient: 'actor' }),
    )
    expect(farstriderV5.trigger.payoffEffects).toContainEqual(
      expect.objectContaining({ type: 'resource-change', recipient: 'actor', resource: 'mp' }),
    )
    expect(cinderweaverV5.trigger.payoffEffects).toContainEqual(
      expect.objectContaining({ type: 'burn', recipient: 'primary-unit' }),
    )
  })

  it('keeps all 136 current pairs valid with broad semantic Result variety', () => {
    const current = P35_REPRESENTATIVE_RESONANCES.map((historical) => {
      const resolved = resolveResonanceForPair(
        historical.disciplinePair[0],
        historical.disciplinePair[1],
      )
      if (!resolved) throw new Error(`Missing current Resonance ${historical.id}.`)
      return resolved
    })

    expect(current).toHaveLength(136)
    expect(new Set(current.map((definition) => definition.id)).size).toBe(136)

    const resultSignatures = new Set<string>()
    let nonDamageResultCount = 0
    let immediateCount = 0
    for (const definition of current) {
      expect(validateResonanceDefinition(definition), definition.id).toEqual([])
      expect(definition.authoring.schemaVersion, definition.id).toBe(2)
      expect(definition.authoring.validationTags, definition.id).toContain('owner-rebalance-v5')
      expect(definition.authoring.validationTags, definition.id).toContain(
        'owner-rebalance-v5-1',
      )
      expect(definition.authoring.validationTags, definition.id).toContain(
        'thematic-resonance-payoff',
      )
      expect(definition.flavorLine?.trim().length, definition.id).toBeGreaterThan(0)

      const mechanics = normalizedResonanceMechanics(definition)
      expect(mechanics.trigger.requiredTags.length, definition.id).toBeGreaterThanOrEqual(1)
      expect(mechanics.trigger.requiredTags.length, definition.id).toBeLessThanOrEqual(2)
      expect(mechanics.resultEffects.length, definition.id).toBeGreaterThanOrEqual(1)
      expect(mechanics.resultEffects.length, definition.id).toBeLessThanOrEqual(2)
      if (mechanics.setup) {
        expect(mechanics.setup.requiredTags.length, definition.id).toBeLessThanOrEqual(2)
      } else {
        immediateCount += 1
      }

      const signature = mechanics.resultEffects
        .map((effect) => {
          if (effect.type === 'apply-status') {
            return `${effect.type}:${effect.recipient}:${effect.statusId}`
          }
          if (effect.type === 'resource-change') {
            return `${effect.type}:${effect.recipient}:${effect.resource}:${Math.sign(effect.delta)}`
          }
          if (effect.type === 'remove-status') {
            return `${effect.type}:${effect.recipient}:${effect.statusIds.join('+')}`
          }
          return `${effect.type}:${effect.recipient}`
        })
        .join('|')
      resultSignatures.add(signature)
      if (mechanics.resultEffects.some((effect) => effect.type !== 'damage')) {
        nonDamageResultCount += 1
      }
    }

    expect(resultSignatures.size).toBeGreaterThanOrEqual(8)
    expect(nonDamageResultCount).toBeGreaterThan(current.length / 2)
    expect(immediateCount).toBeGreaterThan(0)
    expect(immediateCount).toBeLessThan(current.length)
  })

  it('does not change v5 payoff semantics when only an opaque Resonance ID changes', () => {
    const base = resolveResonanceForPair('lifebinder', 'vanguard', 1)
    if (!base) throw new Error('Expected Lifebinder/Vanguard Resonance.')

    const renamed = {
      ...base,
      id: 'resonance.lifebinder-vanguard.semantic-identity-test',
    }

    expect(rebalanceResonanceDefinition(renamed).trigger.payoffEffects).toEqual(
      rebalanceResonanceDefinition(base).trigger.payoffEffects,
    )
  })
})

describe('Phase 4 Resonance payoff metadata boundaries', () => {
  const base = P35_REPRESENTATIVE_RESONANCES[0]!
  it.each([
    ['unknown element', { type: 'damage', recipient: 'primary-unit', amount: 6, element: 'void' }],
    ['unbounded push', { type: 'displace', recipient: 'primary-unit', distance: 2 }],
    ['actor push', { type: 'displace', recipient: 'actor', distance: 1 }],
    ['unknown terrain', { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'steam' }],
    [
      'unit terrain recipient',
      { type: 'create-terrain', recipient: 'primary-unit', terrain: 'frozen' },
    ],
  ])('rejects %s before accepting the definition or snapshot reference', (_name, effect) => {
    const definition = {
      ...base,
      trigger: { ...base.trigger, payoffEffects: [effect as CombatEffectDefinition] },
    }
    expect(validateResonanceDefinition(definition)).toContain('trigger.payoffEffects')
    expect(() => resonanceSnapshotReference(definition)).toThrow(/trigger.payoffEffects/)
  })

  it.each<CombatEffectDefinition>([
    { type: 'damage', recipient: 'primary-unit', amount: 6, element: 'storm' },
    { type: 'displace', recipient: 'primary-unit', distance: 1 },
    { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' },
  ])('accepts valid additive $type metadata without inventing a target spec', (effect) => {
    const definition = { ...base, trigger: { ...base.trigger, payoffEffects: [effect] } }
    expect(validateResonanceDefinition(definition)).toEqual([])
    expect(resonanceSnapshotReference(definition)).toEqual({
      resonanceId: base.id,
      contentVersion: base.contentVersion,
      disciplinePair: [...base.disciplinePair],
    })
  })

  it('checks ground-only terrain legality when the accepted payoff is composed into a unit-targeted Skill', () => {
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
    const strike = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    expect(validateResonanceDefinition(definition)).toEqual([])
    expect(() =>
      executeMatureSkillWithResonance({
        state: encounter(),
        resonance: definition,
        resonanceState: {
          ...createResonanceCombatState(definition),
          armedByActionId: 'lifebinder.mending-light',
        },
        skill: strike,
        combatContext: 'pve',
        selection: { kind: 'unit', combatantId: 'recruit' },
        content: { statuses: [] },
      }),
    ).toThrow(/ground targeting/)
  })
})
