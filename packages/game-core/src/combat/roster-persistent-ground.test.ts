import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { surrenderPvpCombatant } from './pvp-quality'
import { projectPublicCombatGroundAreas } from './combat-ground-visuals'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { MatureSkillDefinition } from './mature-skills'
import { capturedMatureSkillAbilitySource } from './combat-action-source'
import {
  materializeCombatAbilityAction,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import {
  fixture,
  unit,
  ap,
  give,
  hasStatus,
  restoreRosterEncounter,
} from './roster-outcome.test-utils'
import { PV1F_COMBAT_CONTENT, finishPv1fTurn, executePv1fMovement } from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'

const definitions: { id: string; after: MatureSkillDefinition }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const cases = [
  {
    id: 'wildwarden.venom-shot',
    version: 8,
    ap: 55,
    mp: 0,
    rounds: 4,
    entries: ['entry-0', 'entry-1'],
  },
  {
    id: 'cinderweaver.flame-burst',
    version: 10,
    ap: 55,
    mp: 3,
    rounds: 3,
    entries: ['entry-0', 'entry-1'],
  },
  {
    id: 'frostweaver.chilling-mist',
    version: 8,
    ap: 50,
    mp: 0,
    rounds: 2,
    entries: ['entry-1', 'entry-2'],
  },
]
function ready(id: string) {
  const definition = definitions.find((row) => row.id === id)!.after
  const base = {
    ...fixture([]),
    groundEffectPolicyVersion: 1 as const,
    frozenGroundPolicyVersion: 1 as const,
    airbornePolicyVersion: 1 as const,
  }
  const source = capturedMatureSkillAbilitySource(base, definition, 'actor')
  expect(source, `${id} must be captured from its actual proposed definition`).not.toBeNull()
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(base, [source!]),
    base.statBridge,
  )
  return { definition, source: source!, state }
}
it.each(cases)(
  '$id@$version captures its actual complete proposed Ground group and pays once',
  (test) => {
    const { definition, source, state } = ready(test.id)
    expect(source.contentVersion).toBe(test.version)
    expect(source.definition).toEqual(definition.ability)
    const group = source.definition.behaviors[0]!
    expect(group.groundArea).toMatchObject({
      durationRounds: test.rounds,
      entryEffectIds: test.entries,
      timing: 'next-round',
    })
    const action = materializeCombatAbilityAction(source, group)
    expect(action.groundArea).toMatchObject(definition.groundArea!)
    expect(action.effects).toEqual(definition.effects)
    expect(group.accuracy).toEqual(
      definition.accuracyMode === 'automatic'
        ? { kind: 'fixed', chanceBasisPoints: 10000 }
        : { kind: 'standard' },
    )
    const before = JSON.stringify(state)
    const input = {
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source },
      selection: {
        kind: 'activate' as const,
        ...(test.id === 'cinderweaver.flame-burst' ? { ground: true as const } : {}),
      },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, source),
    }
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(input)
    expect(ap(out.state)).toBe(100 - test.ap)
    expect(unit(out.state).mp).toBe(20 - test.mp)
    expect(out.state.groundAreas).toHaveLength(1)
    expect(out.state.groundAreas![0]).toMatchObject({
      sourceActionId: test.id,
      activationRound: 2,
      expiresAtRound: 2 + test.rounds,
      entryEffectOrigins: test.entries.map((effectId) => expect.objectContaining({ effectId })),
    })
    expect(out.state.groundAreas![0]!.entryEffects).toEqual(
      definition.groundArea!.entryEffectOrdinals.map((ordinal) => definition.effects[ordinal]),
    )
    expect(restoreRosterEncounter(out.state).groundAreas).toEqual(out.state.groundAreas)
    expect(JSON.stringify(state)).toBe(before)
  },
)

function command(id: string, state = ready(id).state) {
  const source = state.capturedAbilitySources!.find((row) => row.abilityId === id)!
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source },
    selection: {
      kind: 'activate' as const,
      ...(id === 'cinderweaver.flame-burst' ? { ground: true as const } : {}),
    },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
function nextTurn(state: ReturnType<typeof ready>['state']) {
  const id = state.tactical.battle.currentTurn!.combatantId
  return finishPv1fTurn(
    state,
    state.tactical.placements.find((row) => row.combatantId === id)!.facing,
  ).state
}
const stackCount = (state: ReturnType<typeof ready>['state']) =>
  state.statusState
    .find((row) => row.combatantId === 'enemy')!
    .statuses.filter((status) => ['slow', 'frozen'].includes(status.statusId))
    .reduce((sum, status) => sum + status.stacks, 0)

it.each(cases)(
  '$id retains its actual source after removal, applies one real entry and expires without further input',
  (test) => {
    const cast = commitCombatAbilityCommand(command(test.id))
    const area = cast.state.groundAreas![0]!
    const expiry = area.expiresAtRound
    let state = restoreRosterEncounter(reconcileCombatAbilitySources(cast.state, []))
    for (
      let i = 0;
      i < 10 &&
      !(
        state.tactical.battle.round === 2 &&
        state.tactical.battle.currentTurn?.combatantId === 'enemy'
      );
      i++
    )
      state = nextTurn(state)
    expect(state.tactical.battle.round).toBe(2)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(state.groundAreas![0]!.expiresAtRound).toBe(expiry)
    const hp = unit(state, 'enemy').hp,
      stacks = stackCount(state)
    const entered = executePv1fMovement(state, [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ])
    state = restoreRosterEncounter(entered.state)
    if (test.id === 'frostweaver.chilling-mist') expect(stackCount(state)).toBeGreaterThan(stacks)
    else expect(hp - unit(state, 'enemy').hp).toBe(test.id === 'wildwarden.venom-shot' ? 9 : 11)
    const firstHp = unit(state, 'enemy').hp,
      firstStacks = stackCount(state)
    state = restoreRosterEncounter(
      executePv1fMovement(state, [
        { x: 2, y: 2 },
        { x: 2, y: 1 },
      ]).state,
    )
    expect(unit(state, 'enemy').hp).toBe(firstHp)
    expect(stackCount(state)).toBe(firstStacks)
    expect(state.groundAreas![0]!.id).toBe(area.id)
    const visible = projectPublicCombatGroundAreas(
      state.groundAreas!,
      state.tactical.battle.round,
      'active',
    )
    expect(visible).toHaveLength(1)
    expect(JSON.stringify(visible)).not.toMatch(
      /caster|entryEffects|sourceCombatantId|sourceActionId|effectOrigin/,
    )
    for (let i = 0; i < 24 && state.tactical.battle.round < expiry; i++)
      state = restoreRosterEncounter(nextTurn(state))
    expect(state.tactical.battle.round).toBe(expiry)
    expect(state.groundAreas).toEqual([])
  },
)
it.each(cases)(
  '$id is actually chosen and committed by AI when its area is useful and walking is exhausted',
  (test) => {
    const { state } = ready(test.id)
    state.tactical.placements.find((row) => row.combatantId === 'enemy')!.position = { x: 2, y: 2 }
    state.tactical.placements.find((row) => row.combatantId === 'other')!.position = { x: 0, y: 0 }
    const turn = state.tactical.battle.currentTurn!
    turn.movementSpent = turn.movementMaximum
    turn.movementRemaining = 0
    const before = JSON.stringify(restoreRosterEncounter(state))
    const choice = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 13 })
    expect(choice.intent).toMatchObject({
      kind: 'action',
      actionId: test.id,
      behaviorId: 'persistent-ground',
    })
    expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 13 })).toEqual(choice)
    expect(JSON.stringify(state)).toBe(before)
    if (choice.intent.kind !== 'action') throw new Error('Expected actual Ground action.')
    const out = executeBuildAwareRecruitAiAction(
      state,
      choice.intent.actionId,
      choice.intent.target,
      {},
      choice.intent,
    )
    expect(out.state.groundAreas).toHaveLength(1)
    expect(out.state.groundAreas![0]!.sourceActionId).toBe(test.id)
    expect(ap(out.state)).toBe(100 - test.ap)
    expect(unit(out.state).mp).toBe(20 - test.mp)
  },
)
it.each(cases)(
  '$id rejects unaffordable execution without payment and cleans up on genuine surrender',
  (test) => {
    const { state } = ready(test.id)
    unit(state).temporaryResources.find(
      (resource) => resource.key === 'pv1f.action-economy',
    )!.current = test.ap - 1
    const before = JSON.stringify(state)
    expect(prepareCombatAbilityCommand(command(test.id, state)).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(command(test.id, state))).toThrow()
    expect(JSON.stringify(state)).toBe(before)
    const cast = commitCombatAbilityCommand(command(test.id)).state
    expect(cast.groundAreas).toHaveLength(1)
    unit(cast, 'ally').hp = 0
    const terminal = surrenderPvpCombatant(restoreRosterEncounter(cast), 'actor').state
    expect(terminal.tactical.battle.lifecycle).toBe('completed')
    expect(terminal.groundAreas).toEqual([])
    expect(() =>
      chooseBuildAwareRecruitAiDecision({
        state: restoreRosterEncounter(terminal),
        tieBreakSeed: 13,
      }),
    ).toThrow()
  },
)
it.each(cases)(
  '$id keeps Airborne immune to its Ground packets while still placing the finite area',
  (test) => {
    const { state } = ready(test.id)
    give(state, 'airborne', 'enemy')
    const out = commitCombatAbilityCommand(command(test.id, state))
    expect(unit(out.state, 'enemy').hp).toBe(1000)
    expect(out.state.groundAreas).toHaveLength(1)
    expect(
      out.state.statusState
        .find((row) => row.combatantId === 'enemy')!
        .statuses.map((status) => status.statusId),
    ).toEqual(['airborne'])
    expect(ap(out.state)).toBe(100 - test.ap)
  },
)

it('actual Flame Burst preserves Enemy intent without an area and full payment', () => {
  const { state } = ready('cinderweaver.flame-burst')
  const out = commitCombatAbilityCommand({
    ...command('cinderweaver.flame-burst', state),
    selection: { kind: 'activate' },
  })
  expect(out.state.groundAreas ?? []).toEqual([])
  expect(unit(out.state, 'enemy').hp).toBeLessThan(1000)
  expect(ap(out.state)).toBe(45)
  expect(unit(out.state).mp).toBe(17)
})
it('actual Flame Burst cleanses the caster on cast but never repeats that cleanse on area entry', () => {
  const { state } = ready('cinderweaver.flame-burst')
  state.effectTimingPolicy = { version: 1, modes: { 'remove-status': 'instant' } }
  give(state, 'frozen', 'actor')
  let out = restoreRosterEncounter(
    commitCombatAbilityCommand(command('cinderweaver.flame-burst', state)).state,
  )
  expect(hasStatus(out, 'frozen', 'actor')).toBe(false)
  for (
    let i = 0;
    i < 10 &&
    !(out.tactical.battle.round === 2 && out.tactical.battle.currentTurn?.combatantId === 'enemy');
    i++
  )
    out = nextTurn(out)
  expect(out.tactical.battle.currentTurn?.combatantId).toBe('enemy')
  give(out, 'frozen', 'actor')
  expect(hasStatus(out, 'frozen', 'actor')).toBe(true)
  const entered = executePv1fMovement(out, [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ]).state
  expect(hasStatus(entered, 'frozen', 'actor')).toBe(true)
  expect(unit(entered, 'enemy').hp).toBeLessThan(unit(out, 'enemy').hp)
})
it('actual Chilling Mist converted by actual Flame Burst preserves the captured ice expiry', () => {
  const { state, source: ice } = ready('frostweaver.chilling-mist')
  const fireDefinition = definitions.find((row) => row.id === 'cinderweaver.flame-burst')!.after
  const fire = capturedMatureSkillAbilitySource(state, fireDefinition, 'actor')!
  const both = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(state, [ice, fire]),
    state.statBridge,
  )
  let out = restoreRosterEncounter(
    commitCombatAbilityCommand(command('frostweaver.chilling-mist', both)).state,
  )
  const iceExpiry = out.groundAreas![0]!.expiresAtRound
  for (let i = 0; i < 4; i++) out = nextTurn(out)
  expect(out.tactical.battle.round).toBe(2)
  expect(out.tactical.battle.currentTurn?.combatantId).toBe('actor')
  const frozen = out.terrainOverlays!.filter((tile) => tile.kind === 'frozen')
  expect(frozen.length).toBeGreaterThan(0)
  const cast = commitCombatAbilityCommand(command('cinderweaver.flame-burst', out)).state
  expect(
    cast.groundAreas!.find((area) => area.sourceActionId === 'frostweaver.chilling-mist'),
  ).toMatchObject({ expiresAtRound: iceExpiry, steamTiles: expect.any(Array) })
  for (const tile of frozen)
    expect(
      cast.terrainOverlays!.find(
        (after) => after.position.x === tile.position.x && after.position.y === tile.position.y,
      ),
    ).toMatchObject({ kind: 'steam', remainingRoundBoundaries: tile.remainingRoundBoundaries })
})
