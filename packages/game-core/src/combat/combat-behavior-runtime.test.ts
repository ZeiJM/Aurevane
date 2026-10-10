import { applySkillCooldown, readSkillCooldown } from './skill-cooldowns'
import { describe, expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  finishPv1fTurn,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  hasPv1fTurnActivity,
  evaluatePv1fAction,
  executePv1fAction,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  activateCombatAbility,
  evaluateCombatAbility,
  reconcileCombatAbilitySources,
  type CombatAbilityActivationInput,
} from './combat-behavior-runtime'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { toCombatActionDefinition, resolveMatureSkillVersion } from './mature-skills'
import { PV1F_BASIC_ATTACK_ID } from './pv1f-skills'
import {
  createStatDrivenCombatEncounterState,
  createCurrentStatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { forecastStatDrivenAttack } from './stat-driven-combat'
import { evaluateCombatAction } from './actions'

function input(
  overrides: Partial<CombatAbilityActivationInput> = {},
): CombatAbilityActivationInput {
  const state = preparePv1fTurnEconomy(percentageDotEncounter())
  return {
    state,
    actorId: 'actor',
    source: captureCombatAbilitySource(source()),
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: {
      provenance: createCombatActionProvenance({
        rulesetVersion: 1,
        sourceKind: 'discipline-skill',
        actionDefinitionId: 'test.ability',
        actionVersion: 1,
        sourceCombatantId: 'actor',
        controllerCombatantId: 'actor',
        triggerChainId: 'command-1',
      }),
      triggerGuard: createCombatTriggerGuard({ triggerChainId: 'command-1' }),
    },
    ...overrides,
  }
}
const actor = (state: CombatAbilityActivationInput['state']) =>
  state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!

describe('canonical behavior runtime', () => {
  it.each([false, 'yes', 1])('rejects malformed private Basic marker %s', (marker) => {
    const old = evaluatePv1fAction(input().state as never, PV1F_BASIC_ATTACK_ID, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(() =>
      evaluateCombatAction(
        old.prepared,
        { ...old.action, nativeBasicAttackCommand: marker } as never,
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ),
    ).toThrow('invalid-native-basic-command-marker')
    expect(() =>
      evaluateCombatAction(
        old.prepared,
        { ...old.action, sourceType: 'discipline-skill', nativeBasicAttackCommand: true },
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ),
    ).toThrow('invalid-native-basic-command-marker')
  })
  it.each(
    [0, 10000].flatMap((accuracy) =>
      [0, 5000, 10000].map((criticalChance) => ({ accuracy, criticalChance })),
    ),
  )(
    'composed native Basic preserves seeded hit/critical draws and root Defense; %j',
    ({ accuracy, criticalChance }) => {
      const initial = preparePv1fTurnEconomy(percentageDotEncounter())
      const state = createStatDrivenCombatEncounterState(
        initial,
        initial.statBridge.combatants.map((profile) => ({
          ...profile,
          accuracy: profile.combatantId === 'actor' ? accuracy : 10000,
          armor: profile.combatantId === 'enemy' ? 400 : 0,
          ward: 0,
          level: 50,
          criticalChance,
        })),
      )
      const baseline = executePv1fAction(state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: 'enemy',
      })
      const modifier = captureCombatAbilitySource(
        source(
          {
            id: 'bonus',
            mode: 'modifier',
            targeting: null,
            costs: [{ resource: 'ap', amount: 7 }],
            activationLimits: ['once-per-battle'],
            effects: [
              {
                id: 'mystic-hit',
                payload: {
                  type: 'damage',
                  recipient: 'primary-unit',
                  amount: 20,
                  defenseKind: 'ward',
                },
              },
            ],
          },
          'modifier',
        ),
      )
      const active = reconcileCombatAbilitySources(state, [modifier])
      const options = { manualModifiers: [{ sourceInstanceId: 'modifier', behaviorId: 'bonus' }] }
      const preview = evaluatePv1fAction(
        active as never,
        PV1F_BASIC_ATTACK_ID,
        { kind: 'unit', combatantId: 'enemy' },
        options,
      )
      expect(preview.action.effects).toHaveLength(2)
      expect(preview.action.nativeBasicAttackCommand).toBe(true)
      expect(
        evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, { kind: 'unit', combatantId: 'enemy' })
          .action.nativeBasicAttackCommand,
      ).toBeUndefined()
      const out = executePv1fAction(
        active as never,
        PV1F_BASIC_ATTACK_ID,
        { kind: 'unit', combatantId: 'enemy' },
        options,
      )
      const oldReceipt = baseline.events.find(
        (e) => (e as { event: string }).event === 'stat_driven_attack_resolved',
      )
      expect(
        out.events.filter((e) => (e as { event: string }).event === 'stat_driven_attack_resolved'),
      ).toEqual([oldReceipt])
      expect(out.state.tactical.battle.rng).toEqual(baseline.state.tactical.battle.rng)
      const damage = out.events.filter(
        (e) => (e as { event: string }).event === 'damage_applied',
      ) as { amount: number }[]
      const oldDamage = baseline.events.filter(
        (e) => (e as { event: string }).event === 'damage_applied',
      ) as { amount: number }[]
      expect(damage.slice(0, oldDamage.length)).toEqual(oldDamage)
      expect(damage).toHaveLength(accuracy === 0 ? 0 : 2)
      if (accuracy !== 0) {
        expect(damage[1]!.amount).toBeGreaterThan(damage[0]!.amount)
        if (criticalChance === 0)
          expect(
            preview.evaluation.projectedEffects
              .filter((effect) => effect.effectType === 'damage')
              .map((effect) => Number(effect.before) - Number(effect.after)),
          ).toEqual(damage.map((event) => event.amount))
      }
      expect(() =>
        executePv1fAction(
          out.state,
          PV1F_BASIC_ATTACK_ID,
          { kind: 'unit', combatantId: 'enemy' },
          options,
        ),
      ).toThrow('limit')
      expect(readPv1fActionEconomy(out.state)!.current).toBe(
        readPv1fActionEconomy(baseline.state)!.current - 7,
      )
      expect(out.state.abilityRuntime!.usage).toHaveLength(1)
    },
  )
  it('composed native Basic retains terrain Evasion without a Skill elevation bypass', () => {
    const initial = preparePv1fTurnEconomy(percentageDotEncounter())
    const modern = createCurrentStatDrivenCombatEncounterState(
      initial,
      initial.statBridge.combatants.map((profile) => ({
        ...profile,
        physicalPower: profile.physicalPower!,
        mysticPower: profile.mysticPower!,
        level: 50,
        criticalChance: 0,
        statusResistance: 0,
      })),
    )
    const state = {
      ...modern,
      statBalancePolicyVersion: 1 as const,
      tactical: {
        ...initial.tactical,
        tiles: initial.tactical.tiles.map((tile) =>
          tile.position.x === 2 && tile.position.y === 1 ? { ...tile, elevation: 1 } : tile,
        ),
      },
    }
    const modifier = captureCombatAbilitySource(
      source(
        {
          id: 'bonus',
          mode: 'modifier',
          targeting: null,
          costs: [],
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 3 } },
          ],
        },
        'modifier',
      ),
    )
    const active = reconcileCombatAbilitySources(state, [modifier])
    const old = evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    const oldChance = forecastStatDrivenAttack(
      old.prepared,
      old.action,
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).hitChanceBasisPoints
    const preview = evaluatePv1fAction(
      active as never,
      PV1F_BASIC_ATTACK_ID,
      { kind: 'unit', combatantId: 'enemy' },
      { manualModifiers: [{ sourceInstanceId: 'modifier', behaviorId: 'bonus' }] },
    )
    expect(oldChance).toBe(8500)
    expect(preview.evaluation.targetHitChances![0]!.hitChanceBasisPoints).toBe(oldChance)
  })
  it('source_owned_maintenance changes actual damage without making a removable status', () => {
    const command = input()
    const maintained = captureCombatAbilitySource(
      source(
        {
          id: 'bonus',
          activation: 'ongoing',
          mode: 'modifier',
          classification: 'utility',
          attackFamily: undefined,
          costs: [],
          targeting: null,
          effects: [
            {
              id: 'bonus',
              payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
            },
          ],
        },
        'ongoing-a',
      ),
    )
    const state = reconcileCombatAbilitySources(command.state, [command.source, maintained])
    const out = activateCombatAbility({ ...command, state })
    expect(out.events.find((e) => e.event === 'damage_applied')).toMatchObject({ amount: 15 })
    expect(out.state.statusState).toEqual(command.state.statusState)
  })
  it('captures packet Requirements before its own payment and applies explicit packet timing', () => {
    const command = input({
      source: captureCombatAbilitySource(
        source({
          effects: [
            {
              id: 'now',
              timing: 'instant',
              requirements: {
                kind: 'resource-state',
                subject: 'owner',
                resource: 'mp',
                comparison: 'at-least',
                amount: 20,
              },
              payload: { type: 'damage', recipient: 'primary-unit', amount: 3 },
            },
            {
              id: 'later',
              timing: 'delayed',
              requirements: {
                kind: 'resource-state',
                subject: 'affected',
                resource: 'hp',
                comparison: 'at-least',
                amount: 20,
              },
              payload: { type: 'damage', recipient: 'primary-unit', amount: 7 },
            },
            {
              id: 'blocked',
              timing: 'delayed',
              requirements: {
                kind: 'resource-state',
                subject: 'owner',
                resource: 'mp',
                comparison: 'at-least',
                amount: 21,
              },
              payload: { type: 'damage', recipient: 'primary-unit', amount: 19 },
            },
          ],
        }),
      ),
    })
    const original = JSON.stringify(command.state)
    const preview = evaluateCombatAbility(command)
    expect(
      preview.projectedEvents
        .filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.amount : 0)),
    ).toEqual([3])
    expect(JSON.stringify(command.state)).toBe(original)
    const out = activateCombatAbility(command)
    expect(
      out.events
        .filter((e) => e.event === 'damage_applied')
        .map((e) => (e.event === 'damage_applied' ? e.amount : 0)),
    ).toEqual([3])
    expect(out.state.pendingEffects).toHaveLength(1)
    expect(out.state.pendingEffects![0]).toMatchObject({
      activationRound: command.state.tactical.battle.round + 2,
      recipientIds: ['enemy'],
      effect: { amount: 7 },
      effectOrigin: { sourceInstanceId: 'source-a', behaviorId: 'strike', effectId: 'later' },
    })
    let restored = JSON.parse(JSON.stringify(out.state)) as typeof out.state
    restored = {
      ...restored,
      tactical: {
        ...restored.tactical,
        battle: {
          ...restored.tactical.battle,
          combatants: restored.tactical.battle.combatants.map((u) =>
            u.id === 'enemy'
              ? { ...u, hp: 10 }
              : u.id === 'actor'
                ? { ...u, mp: 30, maxMp: 30 }
                : u,
          ),
        },
      },
    }
    const laterEvents: unknown[] = []
    while (restored.tactical.battle.round < command.state.tactical.battle.round + 2) {
      const next = finishPv1fTurn(restored as never, 'east')
      restored = next.state
      laterEvents.push(...next.events)
    }
    expect(laterEvents.filter((e) => (e as { event: string }).event === 'damage_applied')).toEqual([
      expect.objectContaining({ amount: 7, targetCombatantId: 'enemy' }),
    ])
    expect(
      laterEvents.some((e) =>
        ['hp_spent', 'mp_spent', 'ap_spent'].includes((e as { event: string }).event),
      ),
    ).toBe(false)
  })
  it('atomic_multicost_nonlethal pays each resource once and HP payment emits no damage', () => {
    let command = input()
    command = {
      ...command,
      state: {
        ...command.state,
        tactical: {
          ...command.state.tactical,
          battle: {
            ...command.state.tactical.battle,
            combatants: command.state.tactical.battle.combatants.map((u) =>
              u.id === 'actor' ? { ...u, hp: 2 } : u,
            ),
          },
        },
      },
    }
    expect(evaluateCombatAbility(command).legal).toBe(true)
    const out = activateCombatAbility(command)
    expect(actor(out.state).hp).toBe(1)
    expect(actor(out.state).mp).toBe(18)
    expect(readPv1fActionEconomy(out.state as never)!.current).toBe(89)
    expect(
      out.events.filter((e) => e.event === 'damage_applied' && e.targetCombatantId === 'actor'),
    ).toEqual([])
    expect(
      evaluateCombatAbility({ ...command, state: out.state, context: out.resolution! }).legal,
    ).toBe(false)
  })
  it('illegal commands spend0 and fixed misses retain the paid legal attempt', () => {
    const command = input()
    expect(
      evaluateCombatAbility({ ...command, selection: { kind: 'unit', combatantId: 'ally' } }).legal,
    ).toBe(false)
    expect(actor(command.state).mp).toBe(20)
    const missed = activateCombatAbility({
      ...command,
      source: captureCombatAbilitySource(
        source({ accuracy: { kind: 'fixed', chanceBasisPoints: 0 } }),
      ),
    })
    expect(actor(missed.state).mp).toBe(18)
    expect(missed.events.some((e) => e.event === 'damage_applied')).toBe(false)
  })
  it('once_limit_epoch consumes battle scope on a legal paid fixed miss and survives reconnect', () => {
    const command = input({
      source: captureCombatAbilitySource(
        source({
          activationLimits: ['once-per-battle'],
          accuracy: { kind: 'fixed', chanceBasisPoints: 0 },
        }),
      ),
    })
    const out = activateCombatAbility(command)
    const reconnect = JSON.parse(JSON.stringify(out.state))
    const nextContext = input().context
    expect(
      evaluateCombatAbility({
        ...command,
        state: reconnect,
        context: {
          ...nextContext,
          provenance: { ...nextContext.provenance, triggerChainId: 'command-2' as never },
          triggerGuard: createCombatTriggerGuard({ triggerChainId: 'command-2' }),
        },
      }).legal,
    ).toBe(false)
  })
  it('source_owned_maintenance source removal preserves the other compatible contribution', () => {
    const ongoing = (id: string) =>
      captureCombatAbilitySource(
        source(
          {
            activation: 'ongoing',
            mode: 'modifier',
            classification: 'utility',
            attackFamily: undefined,
            targeting: null,
            costs: [],
            effects: [
              {
                id: 'bonus',
                payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
              },
            ],
          },
          id,
        ),
      )
    const a = ongoing('source-a'),
      b = ongoing('source-b')
    const state = reconcileCombatAbilitySources(input().state, [a, b])
    const kept = reconcileCombatAbilitySources(state, [b])
    expect(kept).toHaveProperty('abilityRuntime.maintained', [
      expect.objectContaining({ sourceInstanceId: 'source-b', multiplierBasisPoints: 11000 }),
    ])
    expect(kept.statusState).toEqual(state.statusState)
  })
  it('historical_absent_canonical retains the historical projection', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    expect(toCombatActionDefinition(definition, 'pve').id).toBe(definition.id)
  })
  it('once_limit_epoch refreshes owner scope only on that owners actual turn start', () => {
    const command = input({
      source: captureCombatAbilitySource(source({ activationLimits: ['once-per-owner-turn'] })),
    })
    const out = activateCombatAbility(command)
    const second = {
      ...command.context,
      provenance: { ...command.context.provenance, triggerChainId: 'command-2' as never },
      triggerGuard: createCombatTriggerGuard({ triggerChainId: 'command-2' }),
    }
    expect(evaluateCombatAbility({ ...command, state: out.state, context: second }).legal).toBe(
      false,
    )
    let next = finishPv1fTurn(out.state as never, 'west').state
    expect(
      next.turnTriggerState!.combatants.find((row) => row.combatantId === 'actor')!.cycle,
    ).toBe(1)
    for (let index = 0; index < 3; index++) next = finishPv1fTurn(next, 'west').state
    expect(next.tactical.battle.currentTurn!.combatantId).toBe('actor')
    expect(evaluateCombatAbility({ ...command, state: next, context: second }).legal).toBe(true)
  })
  it('Automatic explicit actor authority resolves real out-of-turn Reflect without changing turn ownership', () => {
    const command = input()
    const auto = captureCombatAbilitySource({
      ...source({ activation: 'automatic', automaticTarget: { subject: 'triggering' }, costs: [] }),
      ownerCombatantId: 'enemy',
    })
    const state = {
      ...command.state,
      statusState: command.state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'test.reflect',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'actor',
                },
              ],
            }
          : row,
      ),
    }
    const out = activateCombatAbility({
      ...command,
      state,
      source: auto,
      content: {
        ...PV1F_COMBAT_CONTENT,
        statuses: [
          ...PV1F_COMBAT_CONTENT.statuses,
          {
            id: 'test.reflect',
            version: 1,
            maximumStacks: 1,
            durationOwnerTurnStarts: 2,
            damageTakenMultiplierBasisPoints: 10000,
            polarity: 'positive',
            reactionClass: 'reactive',
            reflectBasisPoints: 10000,
          },
        ],
      },
      behaviorId: 'strike',
      actorId: 'enemy',
      selection: { kind: 'unit', combatantId: 'actor' },
      trigger: {
        id: 'event-1',
        type: 'damage_applied',
        phase: 'after',
        triggeringCombatantId: 'actor',
        depth: 1,
      },
    })
    expect(out.state.tactical.battle.currentTurn!.combatantId).toBe('actor')
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        actionId: 'status.reflect.current.v1',
        sourceCombatantId: 'actor',
        targetCombatantId: 'enemy',
        amount: 10,
      }),
    )
    expect(out.resolution!.triggerGuard.remainingReactionBudget).toBe(30)
  })
  it('Manual off-turn and foreign source ownership cannot acquire Automatic authority', () => {
    const command = input()
    const foreign = captureCombatAbilitySource({ ...source(), ownerCombatantId: 'enemy' })
    expect(evaluateCombatAbility({ ...command, source: foreign, actorId: 'enemy' }).legal).toBe(
      false,
    )
    expect(evaluateCombatAbility({ ...command, source: foreign }).legal).toBe(false)
  })
  it('multiple Manual action groups require explicit selection', () => {
    const original = source()
    const captured = captureCombatAbilitySource({
      ...original,
      definition: {
        ...original.definition,
        behaviors: [
          ...original.definition.behaviors,
          { ...original.definition.behaviors[0]!, id: 'second' },
        ],
      },
    })
    expect(() => evaluateCombatAbility(input({ source: captured }))).toThrow(
      /ambiguous-manual-behavior/,
    )
  })
  it('actual Mature preview and commit route canonical mechanics before legacy fields', () => {
    const command = input()
    const legacy = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const definition = { ...legacy, ability: source().definition, apCost: 99, mpCost: 20 }
    const preview = evaluatePv1fMatureSkill(command.state as never, definition, command.selection)
    expect(preview.cost).toBe(11)
    expect(preview.evaluation.legal).toBe(true)
    const out = executePv1fMatureSkill(command.state as never, definition, command.selection)
    expect(readPv1fActionEconomy(out.state)!.current).toBe(89)
    expect(actor(out.state).mp).toBe(18)
    expect(hasPv1fTurnActivity(out.state)).toBe(true)
    expect(out.state.capturedAbilitySources![0]!.definition).toEqual(definition.ability)
  })
  it('actual Mature adapter returns the exact composed gated action and combined cost', () => {
    const command = input()
    const modifier = captureCombatAbilitySource(
      source(
        {
          id: 'bonus',
          mode: 'modifier',
          targeting: null,
          costs: [{ resource: 'ap', amount: 7 }],
          effects: [
            {
              id: 'extra',
              requirements: {
                kind: 'resource-state',
                subject: 'owner',
                resource: 'mp',
                comparison: 'at-least',
                amount: 21,
              },
              payload: { type: 'damage', recipient: 'primary-unit', amount: 3 },
            },
          ],
        },
        'modifier',
      ),
    )
    const legacy = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const definition = { ...legacy, ability: source().definition }
    const state = reconcileCombatAbilitySources(command.state, [modifier])
    // Exact immutable root is also active; direct adapter cannot reactivate an archived source.
    const capturedRoot = captureCombatAbilitySource({
      ...command.source,
      sourceInstanceId: JSON.stringify([
        'skill',
        'actor',
        definition.id,
        definition.contentVersion,
      ]),
      abilityId: definition.id,
      contentVersion: definition.contentVersion,
    })
    const active = reconcileCombatAbilitySources(state, [modifier, capturedRoot])
    const options = { manualModifiers: [{ sourceInstanceId: 'modifier', behaviorId: 'bonus' }] }
    const preview = evaluatePv1fMatureSkill(
      active as never,
      definition,
      command.selection,
      'pve',
      options,
    )
    expect(preview.cost).toBe(18)
    expect(preview.action.effects).toHaveLength(2)
    expect(preview.action.effectEligibleRecipientIds).toEqual([undefined, []])
    const out = executePv1fMatureSkill(
      active as never,
      definition,
      command.selection,
      'pve',
      options,
    )
    expect(readPv1fActionEconomy(out.state)!.current).toBe(82)
    expect(
      out.events.filter((e) => (e as { event: string }).event === 'damage_applied'),
    ).toHaveLength(1)
  })
  it('historical Mature root retains its intrinsic Discipline and scaling while selecting a modifier', () => {
    const command = input()
    const modifier = captureCombatAbilitySource(
      source(
        {
          id: 'bonus',
          mode: 'modifier',
          targeting: null,
          costs: [{ resource: 'ap', amount: 7 }],
          requirements: { kind: 'action', sourceDisciplineId: 'vanguard' },
          effects: [
            { id: 'extra', payload: { type: 'damage', recipient: 'primary-unit', amount: 3 } },
          ],
        },
        'modifier',
      ),
    )
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const state = reconcileCombatAbilitySources(command.state, [modifier])
    const baseline = evaluatePv1fMatureSkill(state as never, definition, command.selection)
    const options = { manualModifiers: [{ sourceInstanceId: 'modifier', behaviorId: 'bonus' }] }
    const preview = evaluatePv1fMatureSkill(
      state as never,
      definition,
      command.selection,
      'pve',
      options,
    )
    expect(preview.cost).toBe(baseline.cost + 7)
    expect(preview.action.effects.slice(0, baseline.action.effects.length)).toEqual(
      baseline.action.effects,
    )
    const out = executePv1fMatureSkill(
      state as never,
      definition,
      command.selection,
      'pve',
      options,
    )
    expect(readPv1fActionEconomy(out.state)!.current).toBe(100 - preview.cost)
  })
})

it.each([true, false])(
  'actual finishPv1fTurn prepares incoming AP and old clocks before Automatic costs; prior incoming pool %s',
  (existingPool) => {
    const initial = input().state
    const enemy = initial.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!
    const old = applySkillCooldown(
      {
        ...enemy,
        temporaryResources: existingPool
          ? [{ key: 'pv1f.action-economy', current: 0, maximum: 100 }]
          : [],
      },
      { key: 'old', ownerTurns: 1 },
      { actionId: 'old.action', definitionVersion: 1 },
    ).combatant
    const reaction = captureCombatAbilitySource({
      ...source(
        {
          id: 'incoming',
          activation: 'automatic',
          classification: 'recovery',
          attackFamily: undefined,
          costs: [{ resource: 'ap', amount: 5 }],
          cooldown: { key: 'incoming', ownerTurns: 1 },
          activationLimits: ['once-per-owner-turn'],
          requirements: {
            kind: 'all',
            children: [
              { kind: 'event', eventType: 'turn_started', phase: 'after' },
              {
                kind: 'resource-state',
                subject: 'owner',
                resource: 'ap',
                comparison: 'at-least',
                amount: 5,
              },
            ],
          },
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
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 1 } }],
        },
        'incoming-source',
      ),
      ownerCombatantId: 'enemy',
    })
    const state = reconcileCombatAbilitySources(
      {
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy'
                ? {
                    ...old,
                    temporaryResources: old.temporaryResources.map((row) =>
                      row.key.startsWith('p3.skill-cooldown.') ? { ...row, current: 1 } : row,
                    ),
                  }
                : unit,
            ),
          },
        },
      },
      [reaction],
    )
    const out = finishPv1fTurn(state as never, 'west')
    const incoming = out.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!
    expect(out.state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(readPv1fActionEconomy(out.state, 'enemy')!.current).toBe(95)
    expect(readSkillCooldown(incoming, { key: 'old', ownerTurns: 1 }).ticksRemaining).toBe(0)
    expect(readSkillCooldown(incoming, { key: 'incoming', ownerTurns: 1 }).ticksRemaining).toBe(2)
    expect(hasPv1fTurnActivity(out.state)).toBe(false)
    expect(out.state.abilityRuntime!.usage).toHaveLength(1)
    expect(out.state.abilityRuntime!.nextCommandSequence).toBeUndefined()
    expect(
      out.events.filter(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          (event as { event?: string }).event === 'combat_action_used',
      ),
    ).toHaveLength(1)
    const repeated = preparePv1fTurnEconomy(out.state)
    expect(readPv1fActionEconomy(repeated, 'enemy')!.current).toBe(95)
    expect(
      readSkillCooldown(
        repeated.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!,
        { key: 'incoming', ownerTurns: 1 },
      ).ticksRemaining,
    ).toBe(2)
  },
)
