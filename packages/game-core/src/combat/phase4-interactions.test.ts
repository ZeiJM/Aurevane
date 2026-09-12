import { terrainOverlayAiUtility } from './terrain-overlays'
import { conditionalDamageMultiplier } from './damage-modifiers'
import { executePv1fMatureSkillWithResonance } from './pv1f-resonance'
import { ADVANCED_RESONANCES } from './advanced-resonances'
import { createResonanceCombatState } from './resonance'
import { describe, expect, it } from 'vitest'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import {
  createPv1fTemporaryResources,
  PV1F_COMBAT_CONTENT,
  evaluatePv1fMovement,
  executePv1fMovement,
  finishPv1fTurn,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  readPv1fActionEconomy,
  executePv1fAction,
  PV1F_BASIC_ATTACK_ID,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  validateMatureSkillDefinition,
} from './mature-skills'
import { surrenderPvpCombatant, timeoutPvpTurn, createPvpQualityResources } from './pvp-quality'
function encounter(): StatDrivenCombatEncounterState {
  const ids = ['actor', 'enemy', 'other', 'ally']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'phase4-effects',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || id === 'ally' ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 4,
        hp: 25,
        maxHp: 50,
        mp: 10,
        maxMp: 20,
        temporaryResources: [
          ...createPv1fTemporaryResources(10),
          ...createPvpQualityResources(),
        ].sort((a, b) => a.key.localeCompare(b.key)),
      })),
    }),
  ).state
  const positions = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
  ]
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 4,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 20 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, i) => ({
          combatantId,
          position: positions[i]!,
          facing: 'west' as const,
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:phase4', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function withStatus<T extends CombatEncounterState>(
  state: T,
  owner: string,
  statusId: string,
  source = 'actor',
): T {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === statusId)!
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === owner
        ? {
            ...row,
            statuses: [
              ...row.statuses.filter((status) => status.statusId !== statusId),
              {
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: definition?.durationOwnerTurnStarts ?? 2,
                sourceCombatantId: source,
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : row,
    ),
  }
}
function action(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.effects',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'circle', radius: 1 },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    effects,
  }
}
const target = { kind: 'unit' as const, combatantId: 'enemy' }

const hp = (state: CombatEncounterState, id = 'enemy') =>
  state.tactical.battle.combatants.find((unit) => unit.id === id)!.hp
const statuses = (state: CombatEncounterState, id = 'enemy') =>
  state.statusState.find((row) => row.combatantId === id)!.statuses.map((status) => status.statusId)
const ground = (effects: readonly CombatEffectDefinition[]): CombatActionDefinition => ({
  ...action(effects),
  target: { ...action([]).target, kind: 'ground-tile', minimumRange: 0, shape: { kind: 'single' } },
})
const tile = { kind: 'tile' as const, position: { x: 0, y: 1 } }

describe('Phase 4 gameplay interactions', () => {
  it('uses legacy status aliases in typed requirements without replacing saved IDs', () => {
    const state = withStatus(encounter(), 'enemy', 'bleed')
    const skill = {
      ...action([{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 5 }]),
      requirements: [{ kind: 'target-tag-present' as const, tag: 'Bleeding' as const }],
    }
    expect(evaluateCombatAction(state, skill, target, PV1F_COMBAT_CONTENT).legal).toBe(true)
    expect(evaluateCombatAction(encounter(), skill, target, PV1F_COMBAT_CONTENT).legal).toBe(false)
    expect(statuses(state)).toEqual(['bleed'])
  })
  it('grants storm one 20% bonus per recipient per action and consumes Conductive once', () => {
    const state = withStatus(withStatus(encounter(), 'enemy', 'wet'), 'enemy', 'conductive')
    const skill = action(
      Array.from({ length: 2 }, () => ({
        type: 'damage' as const,
        recipient: 'primary-unit' as const,
        amount: 5,
        element: 'storm' as const,
      })),
    )
    const preview = evaluateCombatAction(state, skill, target, PV1F_COMBAT_CONTENT)
    expect(
      preview.projectedEffects
        .filter((effect) => effect.effectType === 'damage')
        .map((effect) => effect.after),
    ).toEqual([19, 14])
    const result = executeCombatAction(
      JSON.parse(JSON.stringify(state)),
      skill,
      target,
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(result.state)).toBe(14)
    expect(statuses(result.state)).toEqual(['wet'])
    expect(statuses(state)).toEqual(['conductive', 'wet'])
  })
  it('fire removes Wet and Frozen, while historical damage without metadata leaves both intact', () => {
    const state = withStatus(withStatus(encounter(), 'enemy', 'wet'), 'enemy', 'frozen')
    const legacy = action([{ type: 'damage', recipient: 'primary-unit', amount: 5 }])
    expect(statuses(executeCombatAction(state, legacy, target, PV1F_COMBAT_CONTENT).state)).toEqual(
      ['frozen', 'wet'],
    )
    const fire = action([{ type: 'damage', recipient: 'primary-unit', amount: 5, element: 'fire' }])
    expect(statuses(executeCombatAction(state, fire, target, PV1F_COMBAT_CONTENT).state)).toEqual(
      [],
    )
  })
  it('blocks hostile direct targeting of Invisible but allows ground damage and breaks concealment', () => {
    const state = withStatus(encounter(), 'enemy', 'invisible')
    const damage: CombatEffectDefinition = {
      type: 'damage',
      recipient: 'affected-units',
      amount: 5,
    }
    expect(evaluateCombatAction(state, action([damage]), target, PV1F_COMBAT_CONTENT).legal).toBe(
      false,
    )
    const result = executeCombatAction(
      state,
      ground([damage]),
      { kind: 'tile', position: { x: 2, y: 1 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(result.state)).toBe(20)
    expect(statuses(result.state)).toEqual([])
  })
  it('breaks the holder’s Invisible on a damaging action, applies Inspired and reduces Hexed healing', () => {
    let state = withStatus(withStatus(encounter(), 'actor', 'invisible'), 'actor', 'inspired')
    const result = executeCombatAction(
      state,
      action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }]),
      target,
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(result.state)).toBe(14)
    expect(statuses(result.state, 'actor')).toEqual(['inspired'])
    state = withStatus(encounter(), 'actor', 'hexed')
    const healed = executeCombatAction(
      state,
      action([{ type: 'healing', recipient: 'actor', amount: 8 }]),
      target,
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(healed.state, 'actor')).toBe(31)
  })
  it('creates dispellable Summoned protection without adding an actor or turn', () => {
    const state = withStatus(encounter(), 'enemy', 'summoned')
    expect(
      hp(
        executeCombatAction(
          state,
          action([{ type: 'damage', recipient: 'primary-unit', amount: 20 }]),
          target,
          PV1F_COMBAT_CONTENT,
        ).state,
      ),
    ).toBe(8)
    const removed = executeCombatAction(
      state,
      action([{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['summoned'] }]),
      target,
      PV1F_COMBAT_CONTENT,
    )
    expect(statuses(removed.state)).toEqual([])
    expect(removed.state.tactical.battle.turnNumber).toBe(state.tactical.battle.turnNumber)
    expect(removed.state.tactical.battle.combatants).toHaveLength(4)
  })
})

describe('Phase 4 shared temporary terrain', () => {
  const ice = ground([{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }])
  it('creates empty-ground Frozen, charges 10 extra AP to either team, and preserves base terrain through reload/movement', () => {
    const state = encounter()
    const preview = evaluateCombatAction(state, ice, tile, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.projectedTerrain).toEqual([
      expect.objectContaining({
        position: tile.position,
        before: null,
        after: 'frozen',
        remainingRoundBoundaries: 2,
      }),
    ])
    expect(state.terrainOverlays).toBeUndefined()
    const frozen = {
      ...executeCombatAction(state, ice, tile, PV1F_COMBAT_CONTENT).state,
      statBridge: state.statBridge,
    }
    const path = [{ x: 1, y: 1 }, tile.position]
    expect(evaluatePv1fMovement(frozen, path).economyCost).toBe(30)
    const moved = executePv1fMovement(JSON.parse(JSON.stringify(frozen)), path).state
    expect(readPv1fActionEconomy(moved)?.current).toBe(70)
    expect(moved.terrainOverlays).toEqual(frozen.terrainOverlays)
    expect(moved.tactical.tiles).toEqual(state.tactical.tiles)
    const airborne = withStatus(frozen, 'actor', 'airborne')
    expect(evaluatePv1fMovement(airborne, path).economyCost).toBe(20)
  })
  it('refreshes instead of stacking and expires after exactly two round boundaries', () => {
    let state = encounter()
    const first = executeCombatAction(state, ice, tile, PV1F_COMBAT_CONTENT).state
    state = {
      ...executeCombatAction(first, ice, tile, PV1F_COMBAT_CONTENT).state,
      statBridge: state.statBridge,
    }
    expect(state.terrainOverlays).toHaveLength(1)
    for (let i = 0; i < 4; i++) state = finishPv1fTurn(state, 'west').state
    expect(state.terrainOverlays?.[0]?.remainingRoundBoundaries).toBe(1)
    for (let i = 0; i < 4; i++)
      state = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west').state
    expect(state.terrainOverlays).toEqual([])
  })
  it('fire converts Frozen to Steam on empty ground, forecasts conversion, and blocks sight through it', () => {
    const state = encounter()
    const middle = { kind: 'tile' as const, position: { x: 2, y: 1 } }
    const frozen = executeCombatAction(state, ice, middle, PV1F_COMBAT_CONTENT).state
    const fire = ground([
      { type: 'damage', recipient: 'affected-units', amount: 5, element: 'fire' },
    ])
    const preview = evaluateCombatAction(frozen, fire, middle, PV1F_COMBAT_CONTENT)
    expect(preview.projectedTerrain[0]?.after).toBe('steam')
    const steam = executeCombatAction(frozen, fire, middle, PV1F_COMBAT_CONTENT).state
    const ranged = {
      ...action([{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 5 }]),
      target: { ...action([]).target, requiresLineOfSight: true },
    }
    expect(
      evaluateCombatAction(
        steam,
        ranged,
        { kind: 'unit', combatantId: 'other' },
        PV1F_COMBAT_CONTENT,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: 'line-of-sight-blocked' }))
    expect(steam.terrainOverlays?.[0]?.remainingRoundBoundaries).toBe(2)
  })
  it('preserves overlays on timeout and surrender and rejects terminal actions', () => {
    const state = encounter()
    const frozen = {
      ...executeCombatAction(state, ice, tile, PV1F_COMBAT_CONTENT).state,
      statBridge: state.statBridge,
    }
    expect(timeoutPvpTurn(frozen).state.terrainOverlays).toEqual(frozen.terrainOverlays)
    const surrendered = surrenderPvpCombatant(frozen, 'actor').state
    expect(surrendered.terrainOverlays).toEqual(frozen.terrainOverlays)
    const terminal = {
      ...frozen,
      tactical: {
        ...frozen.tactical,
        battle: { ...frozen.tactical.battle, lifecycle: 'completed' as const, currentTurn: null },
      },
    }
    expect(evaluateCombatAction(terminal, ice, tile, PV1F_COMBAT_CONTENT).legal).toBe(false)
  })
  it('rejects duplicate, invalid-duration and off-board overlays at JSON state validation', () => {
    const state = encounter()
    for (const overlays of [
      [
        {
          kind: 'frozen',
          position: { x: 0, y: 1 },
          remainingRoundBoundaries: 3,
          sourceCombatantId: 'actor',
        },
      ],
      [
        {
          kind: 'frozen',
          position: { x: 5, y: 1 },
          remainingRoundBoundaries: 2,
          sourceCombatantId: 'actor',
        },
      ],
      Array.from({ length: 2 }, () => ({
        kind: 'frozen',
        position: { x: 0, y: 1 },
        remainingRoundBoundaries: 2,
        sourceCombatantId: 'actor',
      })),
    ])
      expect(
        validateCombatEncounterState({
          ...state,
          terrainOverlays: overlays,
        } as CombatEncounterState).length,
      ).toBeGreaterThan(0)
  })
})

describe('Phase 4 bounded displacement', () => {
  const push = action([{ type: 'displace', recipient: 'primary-unit', distance: 1 }])
  it('records a failed occupied push without moving, overlap, or refund, then legally pushes one tile', () => {
    const state = encounter()
    const failed = executeCombatAction(state, push, target, PV1F_COMBAT_CONTENT)
    expect(failed.state.tactical.placements).toEqual(state.tactical.placements)
    expect(failed.events).toContainEqual(
      expect.objectContaining({ event: 'displacement_failed', reason: 'occupied-tile' }),
    )
    expect(statuses(failed.state)).not.toContain('displaced')
    const open = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((unit) =>
          unit.combatantId === 'other' ? { ...unit, position: { x: 4, y: 1 } } : unit,
        ),
      },
    }
    const result = executeCombatAction(open, push, target, PV1F_COMBAT_CONTENT)
    expect(
      result.state.tactical.placements.find((unit) => unit.combatantId === 'enemy')?.position,
    ).toEqual({ x: 3, y: 1 })
    expect(statuses(result.state)).toContain('displaced')
    expect(result.state.tactical.battle.currentTurn).toEqual(state.tactical.battle.currentTurn)
  })
  it('Root prevents displacement and a repeat omits terrain and push effects at unchanged AP cost', () => {
    const state = withStatus(encounter(), 'enemy', 'root')
    const failed = executeCombatAction(state, push, target, PV1F_COMBAT_CONTENT)
    expect(failed.events).toContainEqual(
      expect.objectContaining({ event: 'displacement_failed', reason: 'status-restricted' }),
    )
    const definition = {
      ...P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find((skill) => skill.enabled)!,
      apCost: 20,
      requirements: [],
      effects: push.effects,
      target: push.target,
    }
    const first = executePv1fMatureSkill(state, definition, target)
    const repeat = evaluatePv1fMatureSkill(first.state, definition, target)
    expect(readPv1fActionEconomy(first.state)?.current).toBe(80)
    expect(repeat.action.effects).toEqual([])
    expect(repeat.cost).toBe(20)
  })
})

describe('Phase 4 edge contracts', () => {
  it('charges both teams for Frozen and keeps Slow even while Airborne', () => {
    const state = encounter()
    const ice = ground([{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }])
    const position = { x: 2, y: 0 }
    let frozen = {
      ...executeCombatAction(state, ice, { kind: 'tile', position }, PV1F_COMBAT_CONTENT).state,
      statBridge: state.statBridge,
    }
    frozen = finishPv1fTurn(frozen, 'west').state
    const path = [{ x: 2, y: 1 }, position]
    expect(evaluatePv1fMovement(frozen, path).economyCost).toBe(30)
    const flying = withStatus(withStatus(frozen, 'enemy', 'airborne'), 'enemy', 'slow')
    expect(evaluatePv1fMovement(flying, path).economyCost).toBe(30)
    expect(executePv1fMovement(frozen, path).state.terrainOverlays).toEqual(frozen.terrainOverlays)
  })
  it('keeps terrain meaningful on empty ground alongside per-unit statuses and damage', () => {
    const state = encounter()
    const skill = ground([
      { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' },
      { type: 'apply-status', recipient: 'affected-units', statusId: 'slow', stacks: 1 },
    ])
    const preview = evaluateCombatAction(state, skill, tile, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.affectedCombatantIds).toEqual([])
    const frozen = executeCombatAction(state, skill, tile, PV1F_COMBAT_CONTENT)
    expect(frozen.events.slice(1)).toEqual(preview.projectedEvents)
    const fire = ground([
      { type: 'damage', recipient: 'affected-units', amount: 5, element: 'fire' },
    ])
    const previewFire = evaluateCombatAction(frozen.state, fire, tile, PV1F_COMBAT_CONTENT)
    const steamed = executeCombatAction(frozen.state, fire, tile, PV1F_COMBAT_CONTENT)
    expect(steamed.events.slice(1)).toEqual(previewFire.projectedEvents)
    expect(steamed.state.terrainOverlays?.[0]?.kind).toBe('steam')
    expect(steamed.state.tactical.battle.combatants).toEqual(state.tactical.battle.combatants)
  })
  it('caps Inspired and storm together with existing conditional modifiers and reads typed opponent aliases', () => {
    let state = withStatus(
      withStatus(withStatus(encounter(), 'actor', 'reckless'), 'actor', 'inspired'),
      'enemy',
      'wet',
    )
    state = withStatus(state, 'enemy', 'marked')
    const storm = action([
      { type: 'damage', recipient: 'primary-unit', amount: 5, element: 'storm' },
    ])
    expect(hp(executeCombatAction(state, storm, target, PV1F_COMBAT_CONTENT).state)).toBe(15)
    const tagged = withStatus(withStatus(encounter(), 'actor', 'warded'), 'enemy', 'burn')
    const content = {
      statuses: PV1F_COMBAT_CONTENT.statuses.map((status) =>
        status.id === 'warded'
          ? {
              ...status,
              damageModifiers: [
                {
                  direction: 'outgoing' as const,
                  multiplierBasisPoints: 12000,
                  condition: { kind: 'opponent-tag' as const, tag: 'Scorched' as const },
                },
              ],
            }
          : status,
      ),
    }
    expect(conditionalDamageMultiplier(tagged, 'actor', 'enemy', content)).toBe(12000)
  })
  it('applies storm once per affected recipient and resets the bonus on the next command', () => {
    const state = withStatus(withStatus(encounter(), 'enemy', 'wet'), 'other', 'conductive')
    const storm = action([
      { type: 'damage', recipient: 'affected-units', amount: 5, element: 'storm' },
      { type: 'damage', recipient: 'affected-units', amount: 5, element: 'storm' },
    ])
    const first = executeCombatAction(state, storm, target, PV1F_COMBAT_CONTENT)
    expect(hp(first.state)).toBe(14)
    expect(hp(first.state, 'other')).toBe(14)
    expect(statuses(first.state, 'other')).toEqual([])
    const next = executeCombatAction(first.state, storm, target, PV1F_COMBAT_CONTENT)
    expect(hp(next.state)).toBe(3)
    expect(hp(next.state, 'other')).toBe(4)
  })
  it('breaks Invisible even on a missed basic attack and Hexed also reduces periodic healing', () => {
    const invisible = withStatus(encounter(), 'actor', 'invisible')
    const miss = {
      ...invisible,
      statBridge: {
        ...invisible.statBridge,
        combatants: invisible.statBridge.combatants.map((unit) =>
          unit.combatantId === 'actor' ? { ...unit, accuracy: 0 } : unit,
        ),
      },
    }
    const result = executePv1fAction(miss, PV1F_BASIC_ATTACK_ID, target)
    expect(hp(result.state)).toBe(25)
    expect(statuses(result.state, 'actor')).toEqual([])
    expect(readPv1fActionEconomy(result.state)?.current).toBe(70)
    const healing = withStatus(withStatus(encounter(), 'actor', 'regeneration'), 'actor', 'hexed')
    expect(hp(finishPv1fTurn(healing, 'east').state, 'actor')).toBe(28)
  })
  it.each([
    ['out-of-bounds', { x: 4, y: 1 }, null],
    ['blocked-terrain', { x: 2, y: 1 }, 'blocked'],
    ['elevation-step-too-high', { x: 2, y: 1 }, 'elevated'],
    ['blocked-terrain', { x: 2, y: 1 }, 'override-blocked'],
  ] as const)('does not move an invalid push: %s / %s / %s', (reason, position, obstacle) => {
    const base = encounter()
    const state = {
      ...base,
      tactical: {
        ...base.tactical,
        placements: base.tactical.placements.map((unit) =>
          unit.combatantId === 'enemy'
            ? { ...unit, position }
            : unit.combatantId === 'other'
              ? { ...unit, position: { x: 4, y: 3 } }
              : unit,
        ),
        terrains: [
          { id: 'blocked', traversalCost: null },
          ...base.tactical.terrains,
          { id: 'push-floor', traversalCost: 1 },
        ],
        tiles: base.tactical.tiles.map((tile) =>
          tile.position.x === 3 && tile.position.y === 1
            ? {
                ...tile,
                terrainId:
                  obstacle === 'blocked'
                    ? 'blocked'
                    : obstacle === 'override-blocked'
                      ? 'push-floor'
                      : tile.terrainId,
                elevation: obstacle === 'elevated' ? 1 : 0,
              }
            : tile,
        ),
        movementProfiles: base.tactical.movementProfiles.map((profile) =>
          obstacle === 'override-blocked'
            ? {
                ...profile,
                terrainCostOverrides: [{ terrainId: 'push-floor', traversalCost: null }],
              }
            : profile,
        ),
      },
    }
    const push = action([{ type: 'displace', recipient: 'primary-unit', distance: 1 }])
    const preview = evaluateCombatAction(state, push, target, PV1F_COMBAT_CONTENT)
    const result = executeCombatAction(state, push, target, PV1F_COMBAT_CONTENT)
    expect(result.state.tactical.placements).toEqual(state.tactical.placements)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'displacement_failed', reason }),
    )
    expect(preview.projectedEvents).toContainEqual(
      expect.objectContaining({ event: 'displacement_failed', reason }),
    )
  })
  it('rejects malformed tags, elements, and terrain/displacement definitions before publication', () => {
    const base = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find((skill) => skill.enabled)!
    for (const effects of [
      [{ type: 'damage', recipient: 'primary-unit', amount: 5, element: 'void' }],
      [{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'steam' }],
      [{ type: 'displace', recipient: 'primary-unit', distance: 2 }],
    ])
      expect(validateMatureSkillDefinition({ ...base, effects } as typeof base)).toContain(
        'combatDefinition',
      )
    for (const requirements of [
      [{ kind: 'target-tag-present', tag: 'Made Up' }],
      [{ kind: 'actor-tag-present' }],
    ])
      expect(validateMatureSkillDefinition({ ...base, requirements } as typeof base)).toContain(
        'combatDefinition',
      )
  })
  it('preserves an armed single-unit Resonance when casting on occupied or empty ground', () => {
    const resonance = ADVANCED_RESONANCES.find((definition) =>
      definition.trigger.payoffEffects.some((effect) => effect.recipient === 'primary-unit'),
    )!
    const base = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find((skill) => skill.enabled)!
    const skill = {
      ...base,
      sourceDisciplineId: resonance.trigger.payoff.sourceDisciplineId,
      tags: resonance.trigger.payoff.requiredTags,
      requirements: [],
      target: { ...ground([]).target, shape: { kind: 'circle' as const, radius: 0 } },
      effects: [
        {
          type: 'create-terrain' as const,
          recipient: 'affected-tiles' as const,
          terrain: 'frozen' as const,
        },
      ],
    }
    for (const selection of [tile, { kind: 'tile' as const, position: { x: 2, y: 1 } }]) {
      const result = executePv1fMatureSkillWithResonance({
        state: encounter(),
        resonance,
        resonanceState: { ...createResonanceCombatState(resonance), armedByActionId: 'test.setup' },
        skill,
        combatContext: 'pve',
        selection,
      })
      expect(result.state.terrainOverlays).toHaveLength(1)
      expect(hp(result.state, 'actor')).toBe(25)
      expect(hp(result.state)).toBe(25)
      expect(result.resonanceState.armedByActionId).toBe('test.setup')
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ event: 'resonance_activated' }),
      )
    }
  })
})

it('scores new Frozen near an enemy above the same terrain near an ally, without rewarding an unchanged refresh', () => {
  const state = encounter()
  const ice = ground([{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }])
  const evaluate = (position: { x: number; y: number }) =>
    evaluateCombatAction(state, ice, { kind: 'tile', position }, PV1F_COMBAT_CONTENT)
  expect(terrainOverlayAiUtility(state, evaluate({ x: 2, y: 0 }))).toBe(6)
  expect(terrainOverlayAiUtility(state, evaluate({ x: 0, y: 2 }))).toBe(-6)
  const frozen = executeCombatAction(state, ice, tile, PV1F_COMBAT_CONTENT).state
  expect(
    terrainOverlayAiUtility(frozen, evaluateCombatAction(frozen, ice, tile, PV1F_COMBAT_CONTENT)),
  ).toBe(0)
})

it('reads and consumes authored typed tags even when status identities are not aliases', () => {
  const custom = {
    ...PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === 'conductive')!,
    id: 'test.charge',
  }
  const content = { statuses: [...PV1F_COMBAT_CONTENT.statuses, custom] }
  const charged = executeCombatAction(
    encounter(),
    action([
      { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.charge', stacks: 1 },
    ]),
    target,
    content,
  ).state
  const hit = executeCombatAction(
    charged,
    action([{ type: 'damage', recipient: 'primary-unit', amount: 5, element: 'storm' }]),
    target,
    content,
  )
  expect(hp(hit.state)).toBe(19)
  expect(statuses(hit.state)).toEqual([])
  expect(() =>
    evaluateCombatAction(encounter(), action([]), target, {
      statuses: [
        ...PV1F_COMBAT_CONTENT.statuses,
        { ...custom, gameplayTags: ['Unknown'] as never },
      ],
    }),
  ).toThrow(/gameplay tag/)
})

it('keeps multi-command terrain preview and commit identical through MP costs and a consecutive repeat', () => {
  const state = encounter()
  const base = P33_REPRESENTATIVE_DISCIPLINE_SKILLS.find((skill) => skill.enabled)!
  const ice = {
    ...base,
    id: 'test.ice',
    apCost: 20,
    mpCost: 2,
    requirements: [],
    target: ground([]).target,
    effects: [
      {
        type: 'create-terrain' as const,
        recipient: 'affected-tiles' as const,
        terrain: 'frozen' as const,
      },
    ],
  }
  const firstPreview = evaluatePv1fMatureSkill(state, ice, tile)
  expect(firstPreview.evaluation.legal).toBe(true)
  const first = executePv1fMatureSkill(JSON.parse(JSON.stringify(state)), ice, tile)
  expect(first.state.terrainOverlays?.[0]?.kind).toBe(
    firstPreview.evaluation.projectedTerrain[0]?.after,
  )
  expect(readPv1fActionEconomy(first.state)?.current).toBe(80)
  const repeatPreview = evaluatePv1fMatureSkill(first.state, ice, tile)
  expect(repeatPreview.action.effects).toEqual([])
  expect(repeatPreview.evaluation.projectedTerrain).toEqual([])
  const repeat = executePv1fMatureSkill(first.state, ice, tile)
  expect(repeat.state.terrainOverlays).toEqual(first.state.terrainOverlays)
  const fire = {
    ...ice,
    id: 'test.fire',
    mpCost: 1,
    effects: [
      {
        type: 'damage' as const,
        recipient: 'affected-units' as const,
        amount: 4,
        element: 'fire' as const,
      },
    ],
  }
  const firePreview = evaluatePv1fMatureSkill(repeat.state, fire, tile)
  expect(firePreview.repeatPenaltyApplied).toBe(false)
  const last = executePv1fMatureSkill(repeat.state, fire, tile)
  expect(last.events).toEqual(expect.arrayContaining([...firePreview.evaluation.projectedEvents]))
  expect(last.state.terrainOverlays?.[0]?.kind).toBe('steam')
  expect(readPv1fActionEconomy(last.state)?.current).toBe(40)
  expect(last.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(5)
  expect(last.state.tactical.battle.currentTurn?.movementRemaining).toBe(4)
  expect(state.terrainOverlays).toBeUndefined()
})

it('area damage aimed at a visible unit hits Invisible bystanders and breaks their status', () => {
  const state = withStatus(encounter(), 'enemy', 'invisible')
  const area = action([{ type: 'damage', recipient: 'affected-units', amount: 5 }])
  const result = executeCombatAction(
    state,
    area,
    { kind: 'unit', combatantId: 'other' },
    PV1F_COMBAT_CONTENT,
  )
  expect(hp(result.state)).toBe(20)
  expect(hp(result.state, 'other')).toBe(20)
  expect(statuses(result.state)).toEqual([])
})

it('preserves overlays at actual surrender completion without granting another turn', () => {
  const state = encounter()
  const ice = ground([{ type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' }])
  const frozen = {
    ...executeCombatAction(state, ice, tile, PV1F_COMBAT_CONTENT).state,
    statBridge: state.statBridge,
  }
  const first = surrenderPvpCombatant(frozen, 'actor')
  const final = surrenderPvpCombatant(first.state, 'ally')
  expect(final.state.tactical.battle.lifecycle).toBe('completed')
  expect(final.state.tactical.battle.currentTurn).toBeNull()
  expect(final.state.terrainOverlays).toEqual(frozen.terrainOverlays)
  expect(() => finishPv1fTurn(final.state, 'west')).toThrow()
})
