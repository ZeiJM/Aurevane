import { expect, it } from 'vitest'
import {
  CURRENT_SUPPORT_ACTION_IDS,
  DEFAULT_SUPPORT_ACTION_ID,
  parseSupportActionId,
  parseCurrentSupportActionId,
} from './support-actions'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  validateBasicSkillDefinition,
} from './combat-basic-actions'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy } from './pv1f-action-economy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  createDuelBalancedCombatEncounterState,
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

function setup(id: (typeof CURRENT_SUPPORT_ACTION_IDS)[number]) {
  const base = percentageDotEncounter()
  const current = createDuelBalancedCombatEncounterState(
    base,
    base.statBridge.combatants.map((row) => ({
      ...row,
      physicalPower: row.physicalPower ?? 20,
      mysticPower: row.mysticPower ?? 20,
      level: row.level ?? 1,
      criticalChance: row.criticalChance ?? 0,
    })),
  )
  const sources = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: id,
    definitions: defaultBasicSkills(),
  })
  const root = sources.find((row) => row.abilityId === id)!
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      preparePv1fTurnEconomy({
        ...current,
        pierceCriticalPolicyVersion: 1,
        summonPotencyPolicyVersion: 1,
      }),
      sources,
    ),
    current.statBridge,
  )
  return { state, root }
}
const command = (
  state: import('./actions').CombatEncounterState,
  root: ReturnType<typeof setup>['root'],
  selection: Parameters<typeof prepareCombatAbilityCommand>[0]['selection'],
  movementPath?: readonly { x: number; y: number }[],
) => ({
  state,
  actorId: 'actor',
  root: { kind: 'canonical' as const, source: root },
  selection,
  movementPath,
  content: PV1F_COMBAT_CONTENT,
  context: combatAbilityCommandContext(state, root),
})

it('offers five current Support choices, defaults to HP Recovery and preserves historical Guard parsing', () => {
  expect(CURRENT_SUPPORT_ACTION_IDS).toEqual([
    'basic.recover',
    'basic.recover.mp',
    'basic.pilfer',
    'basic.fleetstep',
    'basic.invocation',
  ])
  expect(DEFAULT_SUPPORT_ACTION_ID).toBe('basic.recover')
  expect(parseSupportActionId('basic.guard')).toBe('basic.guard')
  expect(parseCurrentSupportActionId('basic.guard')).toBeNull()
  const definitions = defaultBasicSkills()
  expect(definitions.find((row) => row.id === 'basic.guard')?.enabled).toBe(false)
  for (const row of definitions) expect(validateBasicSkillDefinition(row)).toEqual([])
  expect(() =>
    captureBasicSkillSources({
      ownerCombatantId: 'actor',
      supportActionId: 'basic.guard',
      definitions,
    }),
  ).toThrow(/disabled|retired/i)
})
it('commits Pilfer with four base Pierce damage, normal duel modifiers and inert Loot', () => {
  const { state, root } = setup('basic.pilfer')
  const beforeEnemy = state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!
  const quote = prepareCombatAbilityCommand(
    command(state, root, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.costs).toEqual([{ resource: 'ap', amount: 15 }])
  expect(root.definition.behaviors[0]!.effects.map((effect) => effect.payload.type)).toEqual([
    'pierce',
    'loot',
  ])
  const used = commitCombatAbilityCommand(
    command(state, root, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(used.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    beforeEnemy.hp - 5,
  )
  expect(used.events.filter((event) => event.event === 'damage_applied')).toContainEqual(
    expect.objectContaining({ amount: 5, critical: false }),
  )
  expect(used.events.filter((event) => /loot|inventory|item/.test(event.event))).toEqual([])
  const historicalBalance = { ...state, duelBalancePolicyVersion: undefined }
  const baseHit = commitCombatAbilityCommand(
    command(historicalBalance, root, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(baseHit.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    beforeEnemy.hp - 4,
  )
  expect(
    prepareCombatAbilityCommand(command(used.state, root, { kind: 'unit', combatantId: 'enemy' }))
      .evaluation.issues,
  ).toContainEqual(expect.objectContaining({ code: 'cooldown-active' }))
})
it('walks Fleetstep through a real path without consuming ordinary Movement', () => {
  const { state, root } = setup('basic.fleetstep')
  const path = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
    { x: 0, y: 4 },
  ]
  const used = commitCombatAbilityCommand(command(state, root, { kind: 'self' }, path))
  expect(
    used.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
  ).toEqual(path.at(-1))
  expect(used.state.tactical.battle.currentTurn!.movementSpent).toBe(
    state.tactical.battle.currentTurn!.movementSpent,
  )
  expect(
    prepareCombatAbilityCommand(
      command(state, root, { kind: 'self' }, [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
      ]),
    ).evaluation.legal,
  ).toBe(false)
  expect(
    prepareCombatAbilityCommand(
      command(state, root, { kind: 'self' }, [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ]),
    ).evaluation.legal,
  ).toBe(false)
})
it('places one allied Vesper through Invocation and blocks duplicate active or pending companions atomically', () => {
  const { state, root } = setup('basic.invocation')
  const cast = command(state, root, { kind: 'tile', position: { x: 2, y: 2 } })
  const used = commitCombatAbilityCommand(cast)
  expect(used.state.effectState?.summons).toHaveLength(1)
  expect(used.state.effectState?.summons?.[0]!.profile).toMatchObject({
    id: 'summon.vesper',
    name: 'Vesper',
    maxHp: 40,
    lifetimeTurns: 4,
    potencyBasisPoints: 2500,
  })
  expect(used.state.tactical.battle.combatants.find((unit) => unit.kind === 'summon')!.teamId).toBe(
    'players',
  )
  const noClock = {
    ...used.state,
    tactical: {
      ...used.state.tactical,
      battle: {
        ...used.state.tactical.battle,
        combatants: used.state.tactical.battle.combatants.map((unit) => ({
          ...unit,
          temporaryResources: unit.temporaryResources.filter(
            (row) => !row.key.startsWith('p3.skill-cooldown.'),
          ),
        })),
      },
    },
  }
  const duplicate = command(noClock, root, { kind: 'tile', position: { x: 3, y: 2 } })
  expect(prepareCombatAbilityCommand(duplicate).evaluation.legal).toBe(false)
  const before = JSON.stringify(noClock)
  expect(() => commitCombatAbilityCommand(duplicate)).toThrow()
  expect(JSON.stringify(noClock)).toBe(before)
})

it('appends Briar Snare without changing the old Wildwarden Summon version', async () => {
  const { resolveMatureSkillVersion, validateMatureSkillDefinition } =
    await import('./mature-skills')
  const current = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
  expect(current.name).toBe('Briar Snare')
  expect(current).toMatchObject({
    apCost: 35,
    mpCost: 5,
    cooldown: { ownerTurns: 3 },
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      maximumRange: 3,
      maximumElevationDifference: 1,
      requiresLineOfSight: true,
    },
  })
  expect(current.effects).toEqual([
    { type: 'damage', recipient: 'primary-unit', amount: 8, durationTurns: 0 },
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'root',
      stacks: 1,
      durationTurns: 2,
    },
  ])
  expect(validateMatureSkillDefinition(current)).toEqual([])
  const old = resolveMatureSkillVersion(current.id, current.contentVersion - 1)!
  expect(old.summonProfile?.id).toBe('summon.wildwarden.verdant-stalker')
})

it('reserves current Summon admission for Invocation while historical captured and native Skills keep literal authority', async () => {
  const { state, root } = setup('basic.invocation')
  const { basic: _basic, ...saved } = root
  void _basic
  const legacy = captureCombatAbilitySource({
    ...saved,
    sourceKind: 'discipline-skill',
    sourceInstanceId: 'old-custom-summon',
    abilityId: 'custom.summon',
  })
  const current = reconcileCombatAbilitySources(state, [legacy])
  const cast = command(current, legacy, { kind: 'tile', position: { x: 2, y: 2 } })
  expect(prepareCombatAbilityCommand(cast).evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'source-disabled' }),
  )
  const before = JSON.stringify(current)
  expect(() => commitCombatAbilityCommand(cast)).toThrow('source-disabled')
  expect(JSON.stringify(current)).toBe(before)
  const historical = { ...current, supportActionPolicyVersion: undefined }
  expect(
    prepareCombatAbilityCommand(
      command(historical, legacy, { kind: 'tile', position: { x: 2, y: 2 } }),
    ).evaluation.legal,
  ).toBe(true)
  const { resolveMatureSkillVersion } = await import('./mature-skills')
  const { evaluatePv1fMatureSkill } = await import('./pv1f-action-economy')
  const latest = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
  const old = resolveMatureSkillVersion(latest.id, latest.contentVersion - 1)!
  expect(
    evaluatePv1fMatureSkill(reattachStatDrivenCombatBridge(current, state.statBridge!), old, {
      kind: 'tile',
      position: { x: 2, y: 2 },
    }).evaluation.issues,
  ).toContainEqual(expect.objectContaining({ code: 'source-disabled' }))
  expect(
    evaluatePv1fMatureSkill(reattachStatDrivenCombatBridge(historical, state.statBridge!), old, {
      kind: 'tile',
      position: { x: 2, y: 2 },
    }).evaluation.legal,
  ).toBe(true)
})

it('keeps Fleetstep usable after ordinary Movement is exhausted and rejects Root, excessive paths and elevation', () => {
  const { state, root } = setup('basic.fleetstep')
  const turn = state.tactical.battle.currentTurn!
  const exhausted = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        currentTurn: { ...turn, movementRemaining: 0, movementSpent: turn.movementMaximum },
      },
    },
  }
  const path = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ]
  const used = commitCombatAbilityCommand(command(exhausted, root, { kind: 'self' }, path))
  expect(used.state.tactical.battle.currentTurn!.movementRemaining).toBe(0)
  expect(used.events.filter((event) => event.event === 'combatant_moved')).toContainEqual(
    expect.objectContaining({ from: path[0], to: path.at(-1), movementCost: 2 }),
  )
  const rooted = {
    ...exhausted,
    statusState: exhausted.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'root',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'enemy',
              },
            ],
          }
        : row,
    ),
  }
  expect(
    prepareCombatAbilityCommand(command(rooted, root, { kind: 'self' }, path)).evaluation.legal,
  ).toBe(false)
  const tooLong = [...path, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 1, y: 4 }]
  expect(
    prepareCombatAbilityCommand(command(exhausted, root, { kind: 'self' }, tooLong)).evaluation
      .legal,
  ).toBe(false)
  const raised = {
    ...exhausted,
    tactical: {
      ...exhausted.tactical,
      tiles: exhausted.tactical.tiles.map((tile) =>
        tile.position.x === 0 && tile.position.y === 1 ? { ...tile, elevation: 3 } : tile,
      ),
    },
  }
  expect(
    prepareCombatAbilityCommand(command(raised, root, { kind: 'self' }, path)).evaluation.legal,
  ).toBe(false)
})

it.each(['endure', 'armed', 'strain'] as const)(
  'blocks offensive Pilfer during %s while Fleetstep and Invocation stay available',
  async (restriction) => {
    const { source } = await import('./combat-behavior.test-utils')
    const { primeCombatControlledAbility } = await import('./combat-behavior-runtime')
    for (const id of ['basic.pilfer', 'basic.fleetstep', 'basic.invocation'] as const) {
      const { state, root } = setup(id)
      let restricted: import('./actions').CombatEncounterState
      if (restriction === 'strain')
        restricted = {
          ...state,
          reversalState: {
            version: 1,
            armed: [],
            offensiveTurns: [],
            strain: [{ combatantId: 'actor', endedTurnNumber: state.tactical.battle.turnNumber }],
          },
        }
      else {
        const protection = captureCombatAbilitySource(
          source(
            {
              id: 'prepare',
              classification: 'utility',
              attackFamily: undefined,
              costs: [],
              cooldown: null,
              targeting: {
                kind: 'self',
                teamPolicy: 'self',
                friendlyFire: 'allies-only',
                shape: { kind: 'single' },
                minimumRange: 0,
                maximumRange: 0,
                requiresLineOfSight: false,
                maximumElevationDifference: null,
                maximumSelections: 1,
              },
              effects:
                restriction === 'endure'
                  ? [
                      {
                        id: 'endure',
                        timing: 'instant',
                        payload: {
                          type: 'endure',
                          recipient: 'actor',
                          durationTurns: 2,
                          releaseBasisPoints: 15000,
                          radiusTiles: 3,
                          targetTeams: 'enemies',
                        },
                      },
                    ]
                  : [
                      {
                        id: 'reversal',
                        timing: 'controlled',
                        payload: {
                          type: 'reversal',
                          recipient: 'actor',
                          version: 1,
                          family: 'physical',
                          reflectionBasisPoints: 10000,
                          attackerMaxHpCapBasisPoints: 2000,
                          defenderMaxHpCapBasisPoints: 2500,
                        },
                      },
                    ],
            },
            'protection',
          ),
        )
        const ready = reconcileCombatAbilitySources(state, [
          ...state.capturedAbilitySources!,
          protection,
        ])
        restricted =
          restriction === 'endure'
            ? commitCombatAbilityCommand(command(ready, protection, { kind: 'self' })).state
            : primeCombatControlledAbility({
                state: ready,
                actorId: 'actor',
                sourceInstanceId: protection.sourceInstanceId,
                behaviorId: 'prepare',
                content: PV1F_COMBAT_CONTENT,
              }).state
      }
      const selection =
        id === 'basic.pilfer'
          ? { kind: 'unit' as const, combatantId: 'enemy' }
          : id === 'basic.invocation'
            ? { kind: 'tile' as const, position: { x: 2, y: 2 } }
            : { kind: 'self' as const }
      const quote = prepareCombatAbilityCommand(
        command(
          restricted as typeof state,
          root,
          selection,
          id === 'basic.fleetstep'
            ? [
                { x: 1, y: 1 },
                { x: 0, y: 1 },
              ]
            : undefined,
        ),
      )
      expect(quote.evaluation.legal).toBe(id !== 'basic.pilfer')
    }
  },
)

it('keeps Loot free of extra RNG and resource effects compared with the same Pierce packet alone', () => {
  const { state, root } = setup('basic.pilfer')
  const ability = {
    ...root.definition,
    behaviors: root.definition.behaviors.map((behavior) => ({
      ...behavior,
      effects: behavior.effects.filter((effect) => effect.payload.type !== 'loot'),
    })),
  }
  const without = captureCombatAbilitySource({
    ...root,
    sourceInstanceId: 'without-loot',
    contentVersion: 2,
    definition: ability,
    basic: { ...root.basic!, contentVersion: 2, ability },
  })
  const withoutState = reconcileCombatAbilitySources(state, [without])
  const plain = commitCombatAbilityCommand(
    command(withoutState, without, { kind: 'unit', combatantId: 'enemy' }),
  )
  const marked = commitCombatAbilityCommand(
    command(state, root, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(marked.state.tactical.battle.rng).toEqual(plain.state.tactical.battle.rng)
  expect(marked.state.tactical.battle.combatants).toEqual(plain.state.tactical.battle.combatants)
})

it.each(['basic.pilfer', 'basic.fleetstep', 'basic.invocation'] as const)(
  'rejects unpaid %s commands without changing AP, MP or RNG',
  (id) => {
    const { state, root } = setup(id)
    const poor = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor'
              ? {
                  ...unit,
                  mp: 0,
                  temporaryResources: unit.temporaryResources.map((row) =>
                    row.key === 'pv1f.action-economy' ? { ...row, current: 0 } : row,
                  ),
                }
              : unit,
          ),
        },
      },
    }
    const selection =
      id === 'basic.pilfer'
        ? { kind: 'unit' as const, combatantId: 'enemy' }
        : id === 'basic.invocation'
          ? { kind: 'tile' as const, position: { x: 2, y: 2 } }
          : { kind: 'self' as const }
    const cast = command(
      poor,
      root,
      selection,
      id === 'basic.fleetstep'
        ? [
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ]
        : undefined,
    )
    const before = JSON.stringify(poor)
    expect(prepareCombatAbilityCommand(cast).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(cast)).toThrow()
    expect(JSON.stringify(poor)).toBe(before)
  },
)

it('keeps one pending Invocation per owner even if the next captured profile has another identity', () => {
  const { state, root } = setup('basic.invocation')
  const timed = (version: number, profileId: string) => {
    const definition = {
      ...root.definition,
      behaviors: root.definition.behaviors.map((behavior) => ({
        ...behavior,
        effects: behavior.effects.map((effect) =>
          effect.payload.type === 'summon'
            ? {
                ...effect,
                timing: 'next-round' as const,
                payload: {
                  ...effect.payload,
                  profile: { ...effect.payload.profile, id: profileId },
                },
              }
            : effect,
        ),
      })),
    }
    return captureCombatAbilitySource({
      ...root,
      contentVersion: version,
      sourceInstanceId: `invocation-${version}`,
      definition,
      basic: { ...root.basic!, contentVersion: version, ability: definition },
    })
  }
  const delayed = timed(2, 'summon.vesper')
  const ready = reconcileCombatAbilitySources(
    { ...state, effectTimingPolicy: { version: 1, modes: { summon: 'next-round' as const } } },
    [delayed],
  )
  const used = commitCombatAbilityCommand(
    command(ready, delayed, { kind: 'tile', position: { x: 2, y: 2 } }),
  )
  expect(used.state.pendingSummons).toHaveLength(1)
  expect(used.state.effectState?.summons ?? []).toEqual([])
  const alternate = timed(3, 'summon.vesper.alternate')
  const restored = reconcileCombatAbilitySources(JSON.parse(JSON.stringify(used.state)), [
    alternate,
  ])
  const noClock = {
    ...restored,
    tactical: {
      ...restored.tactical,
      battle: {
        ...restored.tactical.battle,
        combatants: restored.tactical.battle.combatants.map((unit) => ({
          ...unit,
          temporaryResources: unit.temporaryResources.filter(
            (row) => !row.key.startsWith('p3.skill-cooldown.'),
          ),
        })),
      },
    },
  }
  const quote = prepareCombatAbilityCommand(
    command(noClock, alternate, { kind: 'tile', position: { x: 3, y: 2 } }),
  )
  expect(quote.evaluation.legal).toBe(false)
  expect(quote.evaluation.issues).toContainEqual(
    expect.objectContaining({ message: 'Only one Vesper may accompany each character.' }),
  )
})

it('pins Vesper through JSON reload, gives it a native AI action and cleans up after four own turns', async () => {
  const { state, root } = setup('basic.invocation')
  const used = commitCombatAbilityCommand(
    command(state, root, { kind: 'tile', position: { x: 2, y: 2 } }),
  )
  const saved = JSON.parse(JSON.stringify(used.state)) as StatDrivenCombatEncounterState
  let restored = reattachStatDrivenCombatBridge(saved, saved.statBridge)
  const summon = restored.effectState!.summons![0]!
  const { finishPv1fTurn } = await import('./pv1f-action-economy')
  const { chooseSummonAiDecision } = await import('./summon-ai')
  for (
    let count = 0;
    restored.tactical.battle.currentTurn!.combatantId !== summon.combatantId && count < 10;
    count++
  )
    restored = finishPv1fTurn(restored, 'east').state
  expect(restored.tactical.battle.currentTurn!.combatantId).toBe(summon.combatantId)
  const decision = chooseSummonAiDecision({
    state: restored,
    summon: restored.effectState!.summons![0]!,
    tieBreakSeed: 42,
  })
  expect(decision.intent.kind).toBe('action')
  if (decision.intent.kind !== 'action') throw new Error('Expected Vesper Moon Bolt.')
  expect(decision.intent.actionId).toBe('summon.vesper.moon-bolt')
  const { executePv1fSummonAbility } = await import('./pv1f-action-economy')
  const bolt = executePv1fSummonAbility(
    restored,
    restored.effectState!.summons![0]!,
    decision.intent.actionId,
    decision.intent.target,
  )
  expect(bolt.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', actionId: 'summon.vesper.moon-bolt' }),
  )
  restored = bolt.state
  let ownTurns = 0
  for (
    let count = 0;
    restored.effectState?.summons?.some((row) => row.combatantId === summon.combatantId) &&
    count < 30;
    count++
  ) {
    if (restored.tactical.battle.currentTurn?.combatantId === summon.combatantId) ownTurns++
    restored = finishPv1fTurn(restored, 'east').state
  }
  expect(ownTurns).toBe(4)
  expect(restored.effectState?.summons ?? []).toEqual([])
  expect(restored.tactical.battle.combatants.some((unit) => unit.id === summon.combatantId)).toBe(
    false,
  )
  expect(restored.tactical.placements.some((row) => row.combatantId === summon.combatantId)).toBe(
    false,
  )
  expect(restored.statBridge.combatants.some((row) => row.combatantId === summon.combatantId)).toBe(
    false,
  )
})

it('allows each opposing owner one independently controlled Invocation companion', async () => {
  const { state, root } = setup('basic.invocation')
  const opposing = captureCombatAbilitySource({
    ...root,
    sourceInstanceId: 'enemy-invocation',
    ownerCombatantId: 'enemy',
  })
  const ready = reconcileCombatAbilitySources(state, [...state.capturedAbilitySources!, opposing])
  const first = commitCombatAbilityCommand(
    command(ready, root, { kind: 'tile', position: { x: 2, y: 2 } }),
  )
  const { finishPv1fTurn } = await import('./pv1f-action-economy')
  const restored = JSON.parse(JSON.stringify(first.state)) as StatDrivenCombatEncounterState
  const enemyTurn = finishPv1fTurn(restored, 'east').state
  expect(enemyTurn.tactical.battle.currentTurn?.combatantId).toBe('enemy')
  const cast = {
    ...command(enemyTurn, opposing, { kind: 'tile', position: { x: 3, y: 2 } }),
    actorId: 'enemy',
  }
  expect(prepareCombatAbilityCommand(cast).evaluation.legal).toBe(true)
  const second = commitCombatAbilityCommand(cast)
  expect(second.state.effectState?.summons?.map((row) => row.ownerCombatantId).sort()).toEqual([
    'actor',
    'enemy',
  ])
  expect(
    new Set(
      second.state.tactical.battle.combatants
        .filter((unit) => unit.kind === 'summon')
        .map((unit) => unit.teamId),
    ).size,
  ).toBe(2)
})

it('keeps inert Loot instant under the current global timing authority without inventing a pending packet', () => {
  const { state, root } = setup('basic.pilfer')
  const current = {
    ...state,
    effectTimingPolicy: {
      version: 1,
      tagAuthority: 'global' as const,
      modes: { damage: 'instant' as const },
    },
  }
  const cast = command(current, root, { kind: 'unit', combatantId: 'enemy' })
  expect(prepareCombatAbilityCommand(cast).evaluation.legal).toBe(true)
  const used = commitCombatAbilityCommand(cast)
  expect(used.events.some((event) => event.event === 'effect_pending')).toBe(false)
  expect(used.state.pendingEffects ?? []).toEqual([])
})
