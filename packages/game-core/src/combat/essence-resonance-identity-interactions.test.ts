import { expect, it } from 'vitest'
import type { CombatActionEvaluation } from './actions'
import {
  captureCombatAbilityMutation,
  combatAbilityFrameRequirements,
  createCombatAbilityEventSession,
  processCombatAbilityEvent,
  resolveAutomaticAbilitySelection,
  type AutomaticAbilityEventType,
} from './combat-ability-events'
import {
  combatAbilityCommandContext,
  combatAbilitySubject,
  reconcileCombatAbilitySources,
  cancelCombatControlledAbility,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import { evaluateAbilityRequirements, type AbilityRequirementSubject } from './combat-requirements'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT, executePv1fMovement } from './pv1f-action-economy'
import { readSkillCooldown } from './skill-cooldowns'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { advanceRosterTurns } from './roster-outcome.test-utils'
import {
  identityBaseline,
  identityResonances,
  identitySource,
  identityState,
  identityCommand,
  identityUnit,
  matchingActions,
  requirementNodes,
  seedWitness,
  witnessLeaves,
  type IdentityRow,
} from './essence-resonance-identity.test-utils'

type Roles = Record<AbilityRequirementSubject, string>
const automatic = identityResonances.filter(
  (row) =>
    row.after.ability.behaviors[0]!.activation === 'automatic' &&
    row.after.ability.behaviors[0]!.mode === 'action',
)
const ongoing = identityResonances.filter(
  (row) => row.after.ability.behaviors[0]!.activation === 'ongoing',
)
const riders = identityResonances.filter(
  (row) =>
    row.after.ability.behaviors[0]!.activation === 'automatic' &&
    row.after.ability.behaviors[0]!.mode === 'modifier',
)
const rewind = identityBaseline.records.find((row) => row.id === 'chronist.rewind-step')!
function cloned<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/** Exhaustive finite role assignments avoid guessing which native event unit a rule means. */
function satisfyingFrame(row: IdentityRow) {
  const behavior = row.after.ability.behaviors[0]!,
    leaves = witnessLeaves(behavior.requirements)
  const event = leaves.find((node) => node.kind === 'event')
  if (!event || event.kind !== 'event')
    throw new Error(`${row.id}: Automatic action has no event witness`)
  const reaction = identitySource(row),
    primed = leaves.some((node) => node.kind === 'prime-presence' && node.present)
  const parent = matchingActions(behavior.requirements)[0]
  const tried: string[] = []
  for (const triggering of ['actor', 'enemy', 'ally'])
    for (const selected of ['enemy', 'ally', 'actor'])
      for (const affected of ['enemy', 'ally', 'actor']) {
        const roles: Roles = { owner: 'actor', triggering, selected, affected }
        const initial = identityState(primed ? [reaction, identitySource(rewind)] : [reaction])
        let state = seedWitness(initial, behavior.requirements, roles)
        if (!state) continue
        // Optional Cleanse/Dispel packets need an actual removable application too.
        for (const effect of behavior.effects)
          if (effect.payload.type === 'remove-status') {
            const payload = effect.payload
            const targets: string[] =
              payload.recipient === 'actor'
                ? ['actor']
                : payload.recipient === 'primary-unit'
                  ? [roles[behavior.automaticTarget?.subject ?? 'owner']]
                  : state.tactical.battle.combatants
                      .filter((unit) =>
                        behavior.targeting?.teamPolicy === 'enemy'
                          ? unit.teamId !== 'players'
                          : unit.teamId === 'players',
                      )
                      .map((unit) => unit.id)
            for (const target of targets)
              if (
                !combatAbilitySubject(state, target)!.statusIds!.some((status) =>
                  payload.statusIds.includes(status),
                )
              )
                state = seedWitness(
                  state,
                  {
                    kind: 'status-presence',
                    subject: 'owner',
                    statusId: payload.statusIds[0]!,
                    present: true,
                  },
                  { ...roles, owner: target },
                )!
          }
        const before = cloned(state)
        const changed = new Map<string, Set<'hp' | 'mp' | 'ap'>>()
        const mutate = (id: string, resource: 'hp' | 'mp' | 'ap', value: number) => {
          const unit = identityUnit(before, id)
          if (resource === 'ap')
            unit.temporaryResources = unit.temporaryResources.map((row) =>
              row.key === 'pv1f.action-economy' ? { ...row, current: value } : row,
            )
          else unit[resource] = value
          const resources = changed.get(id) ?? new Set()
          resources.add(resource)
          changed.set(id, resources)
        }
        for (const node of leaves)
          if (node.kind === 'resource-threshold-crossing') {
            const unit = identityUnit(state, roles[node.subject]),
              maximum =
                node.resource === 'hp' ? unit.maxHp : node.resource === 'mp' ? unit.maxMp : 100
            mutate(
              roles[node.subject],
              node.resource,
              node.direction === 'below'
                ? Math.floor((maximum * node.thresholdBasisPoints) / 10000) + 1
                : Math.max(0, Math.ceil((maximum * node.thresholdBasisPoints) / 10000) - 1),
            )
          }
        if (event.eventType === 'damage_applied' && !changed.get(affected)?.has('hp'))
          mutate(
            affected,
            'hp',
            Math.min(identityUnit(state, affected).maxHp, identityUnit(state, affected).hp + 5),
          )
        if (event.eventType === 'healing_applied')
          mutate(affected, 'hp', Math.max(1, identityUnit(state, affected).hp - 5))
        if (event.eventType === 'resource_changed' && !changed.size)
          mutate(
            affected,
            'mp',
            Math.min(identityUnit(state, affected).maxMp, identityUnit(state, affected).mp + 5),
          )
        const context = combatAbilityCommandContext(state, reaction),
          session = createCombatAbilityEventSession(context.triggerGuard)
        const mutation = captureCombatAbilityMutation(
          before,
          state,
          `identity:${row.id}`,
          session,
          {
            events: [{ type: event.eventType as AutomaticAbilityEventType, phase: event.phase }],
            rootActionId: `parent:${row.id}`,
            triggeringCombatantId: triggering,
            selectedCombatantId: selected,
            selectedCombatantIds: [selected],
            affectedCombatantIds: [affected],
            ...(parent ? { actionFacts: parent.facts } : {}),
            resourceMutations: [...changed].map(([combatantId, resources]) => ({
              combatantId,
              resources: [...resources],
            })),
          },
        )
        if (
          !evaluateAbilityRequirements(
            behavior.requirements,
            combatAbilityFrameRequirements(mutation.frame, 'actor', mutation.frame.events[0]),
          )
        )
          continue
        const selection = resolveAutomaticAbilitySelection(
          mutation.state,
          reaction,
          behavior,
          mutation.frame,
        )
        if ('suppression' in selection) {
          tried.push(selection.suppression)
          continue
        }
        let issue = ''
        let geometry: CombatActionEvaluation | undefined
        const out = processCombatAbilityEvent(
          mutation.state,
          mutation.frame,
          PV1F_COMBAT_CONTENT,
          context,
          session,
          0,
          (child) => {
            const prepared = prepareCombatAbilityCommand(child)
            if (!prepared.evaluation.legal) {
              issue = prepared.evaluation.issues
                .map((row) => `${row.code}:${row.message}`)
                .join(';')
              return { state: child.state, events: [] }
            }
            geometry = prepared.evaluation
            return commitCombatAbilityCommand(child)
          },
        )
        if (out.state.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id)))
          return {
            row,
            behavior,
            reaction,
            roles,
            before: mutation.state,
            context,
            session,
            frame: mutation.frame,
            out,
            parent,
            geometry: geometry!,
          }
        tried.push(issue || 'native dispatch produced no usage')
      }
  throw new Error(
    `${row.id}: no actual native settlement from satisfying event frames: ${[...new Set(tried)].join(' | ')}`,
  )
}

it('covers every136 final passive through one native activation route without skipped records', () => {
  expect(automatic.length + ongoing.length + riders.length).toBe(136)
  expect(automatic.length).toBe(130)
  expect(ongoing.length).toBe(4)
  expect(riders.length).toBe(2)
})
it.each(automatic)(
  '$id settles an actual eligible event, authored payment and duplicate/foreign guards',
  (row) => {
    const witness = satisfyingFrame(row),
      { out, behavior } = witness
    const action = out.events.find(
      (event) => event.event === 'combat_action_used' && event.actionId === row.id,
    )
    expect(action).toBeDefined()
    for (const cost of behavior.costs) {
      const paid = out.events.filter(
        (event) =>
          event.event === `${cost.resource}_spent` &&
          'combatantId' in event &&
          event.combatantId === 'actor',
      )
      expect(paid.reduce((sum, event) => sum + ('amount' in event ? event.amount : 0), 0)).toBe(
        cost.amount,
      )
    }
    expect(
      out.events.some((event) =>
        [
          'status_removed',
          'status_applied',
          'effect_pending',
          'healing_applied',
          'recovery_scheduled',
          'resource_changed',
          'barrier_changed',
        ].includes(event.event),
      ),
    ).toBe(true)
    for (const effect of behavior.effects) {
      const payload = effect.payload
      const targets =
        payload.recipient === 'actor'
          ? ['actor']
          : payload.recipient === 'primary-unit'
            ? [witness.geometry.primaryCombatantId!]
            : witness.geometry.affectedCombatantIds
      expect(targets.length).toBeGreaterThan(0)
      for (const target of targets) {
        const events = out.events.filter(
          (event) =>
            'actionId' in event &&
            event.actionId === row.id &&
            'targetCombatantId' in event &&
            event.targetCombatantId === target,
        )
        if (payload.type === 'apply-status')
          expect(
            events.some(
              (event) =>
                (event.event === 'effect_pending' && event.effectTag === payload.statusId) ||
                (event.event === 'status_applied' && event.statusId === payload.statusId),
            ),
            `${row.id}:${effect.id}:${target}`,
          ).toBe(true)
        else if (payload.type === 'remove-status')
          expect(
            events.some(
              (event) =>
                event.event === 'status_removed' && payload.statusIds.includes(event.statusId),
            ),
            `${row.id}:${effect.id}:${target}`,
          ).toBe(true)
        else if (payload.type === 'barrier-change')
          expect(
            events.some((event) => event.event === 'barrier_changed' && event.amount > 0),
            `${row.id}:${effect.id}:${target}`,
          ).toBe(true)
        else if (payload.type === 'resource-change')
          expect(
            events.some(
              (event) =>
                event.event === 'resource_changed' &&
                Math.sign(event.delta) === Math.sign(payload.delta),
            ),
            `${row.id}:${effect.id}:${target}`,
          ).toBe(true)
        else if (payload.type === 'percentage-recovery')
          expect(
            events.some((event) =>
              payload.resource === 'hp'
                ? event.event === 'healing_applied' || event.event === 'recovery_scheduled'
                : event.event === 'resource_changed' || event.event === 'recovery_scheduled',
            ),
            `${row.id}:${effect.id}:${target}`,
          ).toBe(true)
        else throw new Error(`Missing actual packet assertion: ${payload.type}`)
      }
    }
    if (behavior.cooldown)
      expect(
        readSkillCooldown(identityUnit(out.state), behavior.cooldown).ticksRemaining,
      ).toBeGreaterThan(0)
    expect(
      processCombatAbilityEvent(
        out.state,
        witness.frame,
        PV1F_COMBAT_CONTENT,
        witness.context,
        witness.session,
        0,
        commitCombatAbilityCommand,
      ).events,
    ).toEqual([])
    const context = combatAbilityCommandContext(witness.before, witness.reaction),
      session = createCombatAbilityEventSession(context.triggerGuard)
    const unrelated = captureCombatAbilityMutation(
      witness.before,
      witness.before,
      'unrelated-event',
      session,
      {
        events: [{ type: 'status_expired', phase: 'after' }],
        rootActionId: `unrelated:${row.id}`,
        triggeringCombatantId: witness.roles.triggering,
        selectedCombatantId: witness.roles.selected,
        affectedCombatantIds: [witness.roles.affected],
        resourceMutations: [],
        ...(witness.parent ? { actionFacts: witness.parent.facts } : {}),
      },
    )
    expect(
      processCombatAbilityEvent(
        unrelated.state,
        unrelated.frame,
        PV1F_COMBAT_CONTENT,
        context,
        session,
        0,
        commitCombatAbilityCommand,
      ).events,
    ).toEqual([])
    const causal =
      requirementNodes(behavior.requirements).some(
        (node) => node.kind === 'subject-relation' && node.subject === 'triggering',
      ) ||
      (behavior.automaticTarget?.subject === 'triggering' &&
        behavior.targeting?.teamPolicy === 'self')
    if (causal) {
      const foreignSession = createCombatAbilityEventSession(context.triggerGuard),
        triggeringCombatantId = witness.roles.triggering === 'actor' ? 'enemy' : 'actor'
      const foreign = captureCombatAbilityMutation(
        witness.before,
        witness.before,
        'foreign-source',
        foreignSession,
        {
          events: witness.frame.events,
          rootActionId: `foreign:${row.id}`,
          triggeringCombatantId,
          selectedCombatantId: witness.roles.selected,
          affectedCombatantIds: [witness.roles.affected],
          resourceMutations: witness.frame.resourceMutations,
          ...(witness.parent ? { actionFacts: witness.parent.facts } : {}),
        },
      )
      const result = processCombatAbilityEvent(
        foreign.state,
        foreign.frame,
        PV1F_COMBAT_CONTENT,
        context,
        foreignSession,
        0,
        (child) =>
          prepareCombatAbilityCommand(child).evaluation.legal
            ? commitCombatAbilityCommand(child)
            : { state: child.state, events: [] },
      )
      expect(result.events).toEqual([])
    }
  },
)

function damage(events: readonly { event: string }[]) {
  return events
    .filter((event) => event.event === 'damage_applied')
    .reduce((sum, event) => sum + ('amount' in event ? Number(event.amount) : 0), 0)
}
it.each(ongoing)(
  '$id changes real owner damage only while the maintained native setup holds',
  (row) => {
    const resonance = identitySource(row),
      attack = matchingActions(
        { kind: 'action', classification: 'attack' },
        row.after.disciplinePair,
      ).find(
        (entry) =>
          entry.behavior.activation === 'manual' &&
          entry.behavior.mode === 'action' &&
          entry.behavior.targeting?.shape.kind === 'single',
      )!
    expect(attack).toBeDefined()
    const root = identitySource(attack.row),
      sources = [
        resonance,
        root,
        ...(requirementNodes(row.after.ability.behaviors[0]!.requirements).some(
          (node) => node.kind === 'prime-presence',
        )
          ? [identitySource(rewind)]
          : []),
      ]
    let state = seedWitness(identityState(sources), row.after.ability.behaviors[0]!.requirements, {
      owner: 'actor',
      triggering: 'actor',
      selected: 'enemy',
      affected: 'enemy',
    })!
    state = reconcileCombatAbilitySources(state, sources)
    expect(state.abilityRuntime!.maintained).toHaveLength(1)
    const control = reconcileCombatAbilitySources(
      cloned(state),
      sources.filter((source) => source.sourceInstanceId !== resonance.sourceInstanceId),
    )
    const actual = commitCombatAbilityCommand(
      identityCommand(state, root, { kind: 'unit', combatantId: 'enemy' }, attack.behavior.id),
    )
    const ordinary = commitCombatAbilityCommand(
      identityCommand(control, root, { kind: 'unit', combatantId: 'enemy' }, attack.behavior.id),
    )
    expect(damage(actual.events)).toBeGreaterThan(damage(ordinary.events))
    const broken = cloned(state)
    identityUnit(broken).hp = identityUnit(broken).maxHp
    identityUnit(broken).mp = 0
    expect(reconcileCombatAbilitySources(broken, sources).abilityRuntime!.maintained).toEqual([])
  },
)

it.each(riders)(
  '$id adds a fixed qualified native attack packet and denies missing setup',
  (row) => {
    const behavior = row.after.ability.behaviors[0]!,
      attack = matchingActions(behavior.requirements, row.after.disciplinePair).find(
        (entry) =>
          entry.behavior.activation === 'manual' &&
          entry.behavior.targeting?.shape.kind === 'single',
      )!,
      root = identitySource(attack.row),
      resonance = identitySource(row)
    const state = seedWitness(identityState([root, resonance]), behavior.requirements, {
      owner: 'actor',
      triggering: 'actor',
      selected: 'enemy',
      affected: 'enemy',
    })!
    // The real parent action may require its own native setup independently from the rider.
    const ready = seedWitness(state, attack.behavior.requirements, {
      owner: 'actor',
      triggering: 'actor',
      selected: 'enemy',
      affected: 'enemy',
    })!
    if ((attack.behavior.targeting?.minimumRange ?? 1) > 1) {
      ready.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position = {
        x: 3,
        y: 1,
      }
      ready.tactical.placements.find((unit) => unit.combatantId === 'other')!.position = {
        x: 4,
        y: 1,
      }
    }
    const out = commitCombatAbilityCommand(
      identityCommand(ready, root, { kind: 'unit', combatantId: 'enemy' }, attack.behavior.id),
    )
    const control = reconcileCombatAbilitySources(cloned(ready), [root])
    const plain = commitCombatAbilityCommand(
      identityCommand(control, root, { kind: 'unit', combatantId: 'enemy' }, attack.behavior.id),
    )
    expect(damage(out.events)).toBeGreaterThan(damage(plain.events))
    expect(out.state.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id))).toBe(true)
    expect(
      out.events
        .filter((event) => event.event === 'mp_spent')
        .reduce((sum, event) => sum + ('amount' in event ? event.amount : 0), 0),
    ).toBe(
      attack.behavior.costs
        .filter((cost) => cost.resource === 'mp')
        .reduce((sum, cost) => sum + cost.amount, 0) + 3,
    )
    const absent = cloned(ready)
    absent.statusState = absent.statusState.map((unit) =>
      unit.combatantId === 'enemy'
        ? { ...unit, statuses: unit.statuses.filter((status) => status.statusId !== 'frozen') }
        : unit,
    )
    const denied = commitCombatAbilityCommand(
      identityCommand(absent, root, { kind: 'unit', combatantId: 'enemy' }, attack.behavior.id),
    )
    expect(denied.state.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id))).toBe(
      false,
    )
  },
)

const parentExamples = [
  {
    id: 'resonance.bastion-dawnshield.linked-sequence',
    parent: 'vanguard.forceful-strike',
    incoming: true,
    hp: 358,
  },
  {
    id: 'resonance.chronist-ravager.linked-sequence',
    parent: 'vanguard.forceful-strike',
    incoming: true,
    hp: 308,
  },
  {
    id: 'resonance.edgedancer-runeblade.linked-sequence',
    parent: 'runeblade.siphon-slash',
    crossingMp: true,
  },
  {
    id: 'resonance.frostweaver-runeblade.linked-sequence',
    parent: 'runeblade.siphon-slash',
    crossingMp: true,
  },
  {
    id: 'resonance.runeblade-stormsinger.linked-sequence',
    parent: 'runeblade.siphon-slash',
    crossingMp: true,
  },
  { id: 'resonance.aetherist-shadehand.veiled-conduit', parent: 'shadehand.smoke-vial' },
  {
    id: 'resonance.aetherist-lifebinder.vital-circuit',
    parent: 'lifebinder.mending-light',
    ally: true,
  },
  {
    id: 'resonance.lifebinder-vanguard.mercys-edge',
    parent: 'lifebinder.mending-light',
    ally: true,
  },
  { id: 'resonance.cinderweaver-vanguard.linked-sequence', parent: 'vanguard.forceful-strike' },
  { id: 'resonance.chronist-vanguard.linked-sequence', parent: 'vanguard.forceful-strike' },
  { id: 'resonance.chronist-shadehand.linked-sequence', parent: 'shadehand.feint' },
  {
    id: 'resonance.ironfist-stormsinger.linked-sequence',
    parent: 'vanguard.forceful-strike',
    incoming: true,
    barrier: true,
  },
  {
    id: 'resonance.runeblade-vanguard.linked-sequence',
    parent: 'aetherist.arc-bolt',
    incoming: true,
    barrier: true,
  },
  { id: 'resonance.bastion-chronist.linked-sequence', parent: 'chronist.rewind-step', self: true },
  {
    id: 'resonance.chronist-edgedancer.linked-sequence',
    parent: 'chronist.rewind-step',
    self: true,
  },
  {
    id: 'resonance.chronist-lifebinder.linked-sequence',
    parent: 'chronist.rewind-step',
    self: true,
  },
  {
    id: 'resonance.chronist-tidecaller.linked-sequence',
    parent: 'chronist.rewind-step',
    self: true,
  },

  { id: 'resonance.tidecaller-vanguard.linked-sequence', parent: 'vanguard.shield-bash' },
  { id: 'resonance.tidecaller-wildwarden.linked-sequence', parent: 'tidecaller.undertow' },
  {
    id: 'resonance.bastion-wildwarden.linked-sequence',
    parent: 'vanguard.forceful-strike',
    incoming: true,
    ally: true,
  },
  {
    id: 'resonance.lifebinder-stormsinger.linked-sequence',
    parent: 'stormsinger.storm-breath',
    self: true,
  },
] as const
it.each(parentExamples)(
  '$id activates from the actual $parent command, without a fabricated event label',
  (example) => {
    const row = identityResonances.find((row) => row.id === example.id)!,
      behavior = row.after.ability.behaviors[0]!,
      resonance = identitySource(row)
    const incoming = 'incoming' in example && example.incoming,
      ally = 'ally' in example && example.ally,
      self = 'self' in example && example.self
    const root = identitySource(
      identityBaseline.records.find((row) => row.id === example.parent)!,
      incoming ? 'enemy' : 'actor',
    )
    const leaves = witnessLeaves(behavior.requirements),
      needsPrime = leaves.some((node) => node.kind === 'prime-presence')
    const roles: Roles = {
      owner: 'actor',
      triggering: incoming ? 'enemy' : 'actor',
      selected: ally ? 'ally' : incoming || self ? 'actor' : 'enemy',
      affected: ally ? 'ally' : incoming || self ? 'actor' : 'enemy',
    }
    const nativeState = identityState([
      root,
      resonance,
      ...(needsPrime ? [identitySource(rewind)] : []),
    ])
    let state = seedWitness(nativeState, behavior.requirements, roles)!
    state = seedWitness(state, root.definition.behaviors[0]!.requirements, roles)!
    if (root.abilityId === 'chronist.rewind-step') {
      state = primeCombatControlledAbility({
        state,
        actorId: 'actor',
        sourceInstanceId: root.sourceInstanceId,
        behaviorId: root.definition.behaviors[0]!.id,
      }).state
      state = executePv1fMovement(reattachStatDrivenCombatBridge(state, nativeState.statBridge), [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ]).state
    }
    if ('barrier' in example)
      state = grantBarrier(state, 'actor', 'actor', 'test.identity-barrier', 100).state

    if ('hp' in example) identityUnit(state).hp = example.hp
    if ('crossingMp' in example) identityUnit(state, 'enemy').mp = 128
    state.tactical.placements.find((unit) => unit.combatantId === 'other')!.position = {
      x: 4,
      y: 4,
    }
    if (incoming && ally)
      state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position = {
        x: 2,
        y: 2,
      }
    if (!incoming && (root.definition.behaviors[0]!.targeting?.minimumRange ?? 1) > 1)
      state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position = {
        x: 3,
        y: 1,
      }
    const hpBefore = identityUnit(state).hp,
      mpBefore = identityUnit(state).mp
    if (incoming) state = advanceRosterTurns(state, 1)
    const target = roles.affected
    const selection =
      root.definition.behaviors[0]!.targeting!.kind === 'self'
        ? { kind: 'self' as const }
        : { kind: 'unit' as const, combatantId: target }
    const out = commitCombatAbilityCommand(identityCommand(state, root, selection))
    expect(
      out.state.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id)),
      JSON.stringify(out.events),
    ).toBe(true)
    expect(
      out.events.some((event) => event.event === 'combat_action_used' && event.actionId === row.id),
    ).toBe(true)
    if (example.id === 'resonance.aetherist-shadehand.veiled-conduit') {
      expect(identityUnit(out.state).hp).toBe(hpBefore - 20)
      expect(out.events.filter((event) => event.event === 'hp_spent')).toMatchObject([
        { amount: 20 },
      ])
      expect(
        out.events.some(
          (event) =>
            event.event === 'status_removed' &&
            event.statusId === 'guarded' &&
            event.targetCombatantId === 'actor',
        ),
      ).toBe(true)
      expect(identityUnit(out.state).mp).toBeGreaterThan(
        mpBefore -
          root.definition.behaviors[0]!.costs.filter((cost) => cost.resource === 'mp').reduce(
            (sum, cost) => sum + cost.amount,
            0,
          ),
      )
    }
    if ('crossingMp' in example) {
      expect(identityUnit(out.state, 'enemy').mp).toBeLessThanOrEqual(125)
      expect(
        out.events.some(
          (event) =>
            event.event === 'resource_changed' &&
            event.actionId === root.abilityId &&
            event.targetCombatantId === 'enemy',
        ),
      ).toBe(true)
    }
    if (example.id === 'resonance.chronist-vanguard.linked-sequence') {
      expect(
        out.state.abilityRuntime!.controlled!.primes.some(
          (prime) => prime.abilityId === 'chronist.rewind-step',
        ),
      ).toBe(true)
      expect(
        out.events.filter(
          (event) => event.event === 'status_removed' && event.statusId === 'guarded',
        ),
      ).toHaveLength(2)
    }
    if (example.id === 'resonance.bastion-wildwarden.linked-sequence')
      expect(currentBarrierAmount(out.state, 'ally')).toBe(100)
    if (example.id === 'resonance.chronist-shadehand.linked-sequence') {
      expect(currentBarrierAmount(out.state, 'actor')).toBe(60)
      expect(
        out.events.some(
          (event) =>
            event.event === 'effect_pending' &&
            event.effectTag === 'covert' &&
            event.targetCombatantId === 'actor',
        ),
      ).toBe(true)
      expect(
        out.state.abilityRuntime!.controlled!.primes.some(
          (prime) => prime.abilityId === 'chronist.rewind-step',
        ),
      ).toBe(true)
      const prime = state.capturedAbilitySources!.find(
        (source) => source.abilityId === 'chronist.rewind-step',
      )!
      const cancelled = cancelCombatControlledAbility({
        state: cloned(state),
        actorId: 'actor',
        sourceInstanceId: prime.sourceInstanceId,
        behaviorId: prime.definition.behaviors[0]!.id,
      }).state
      const unprimed = commitCombatAbilityCommand(identityCommand(cancelled, root, selection))
      expect(unprimed.state.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id))).toBe(
        false,
      )
      expect(currentBarrierAmount(unprimed.state, 'actor')).toBe(0)
      const foreign = identitySource(
        identityBaseline.records.find((row) => row.id === 'shadehand.feint')!,
        'enemy',
      )
      const admitted = reconcileCombatAbilitySources(cloned(state), [
        ...state.capturedAbilitySources!,
        foreign,
      ])
      const enemyTurn = advanceRosterTurns(admitted, 1)
      const unrelated = commitCombatAbilityCommand(
        identityCommand(enemyTurn, foreign, { kind: 'unit', combatantId: 'actor' }),
      )
      expect(
        unrelated.state.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id)),
      ).toBe(false)
      expect(currentBarrierAmount(unrelated.state, 'actor')).toBe(0)
    }
    if (example.id === 'resonance.cinderweaver-vanguard.linked-sequence') {
      expect(
        out.events.some(
          (event) =>
            event.event === 'status_removed' &&
            event.statusId === 'guarded' &&
            event.targetCombatantId === 'enemy',
        ),
      ).toBe(true)
      expect(
        out.events.some(
          (event) =>
            event.event === 'effect_pending' &&
            event.effectTag === 'exposed' &&
            event.targetCombatantId === 'actor',
        ),
      ).toBe(true)
      const activated = advanceRosterTurns(out.state, 4)
      expect(
        activated.statusState.find((unit) => unit.combatantId === 'actor')!.statuses,
      ).toContainEqual(expect.objectContaining({ statusId: 'exposed', potencyBasisPoints: 1000 }))
    }
    if (example.id === 'resonance.bastion-dawnshield.linked-sequence') {
      expect(currentBarrierAmount(out.state, 'actor')).toBe(50)
      expect(currentBarrierAmount(out.state, 'ally')).toBe(100)
    }
    if (example.id === 'resonance.chronist-ravager.linked-sequence') {
      expect(identityUnit(out.state).hp).toBeGreaterThan(300)
      expect(
        out.events.some(
          (event) =>
            event.event === 'effect_pending' &&
            event.effectTag === 'hexed' &&
            event.targetCombatantId === 'actor',
        ),
      ).toBe(true)
    }
  },
)

it('Ironfist/Wildwarden observes an actual enemy turn end while obtainable Normal Root and Mark remain active', () => {
  const row = identityResonances.find(
      (row) => row.id === 'resonance.ironfist-wildwarden.linked-sequence',
    )!,
    resonance = identitySource(row)
  const mark = identitySource(
    identityBaseline.records.find((row) => row.id === 'wildwarden.hunters-mark')!,
  )
  const snare = identitySource(
    identityBaseline.records.find((row) => row.id === 'wildwarden.snare')!,
  )
  const initial = identityState([resonance, mark, snare])
  identityUnit(initial).mp = 100
  const marked = commitCombatAbilityCommand(
    identityCommand(initial, mark, { kind: 'unit', combatantId: 'enemy' }),
  )
  const rooted = commitCombatAbilityCommand(
    identityCommand(marked.state, snare, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(
    rooted.events.some((event) => event.event === 'effect_pending' && event.effectTag === 'root'),
  ).toBe(true)
  const secondRound = advanceRosterTurns(rooted.state, 4)
  expect(secondRound.tactical.battle.round).toBe(2)
  expect(
    secondRound.statusState
      .find((unit) => unit.combatantId === 'enemy')!
      .statuses.filter((status) => status.statusId === 'root' || status.statusId === 'mark')
      .map((status) => status.statusId),
  ).toEqual(['mark', 'root'])
  expect(secondRound.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id))).toBe(false)
  const hp = identityUnit(secondRound).hp,
    mp = identityUnit(secondRound).mp
  const afterEnemyEnd = advanceRosterTurns(secondRound, 2)
  expect(afterEnemyEnd.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id))).toBe(true)
  expect(identityUnit(afterEnemyEnd).hp).toBe(hp - 8)
  expect(identityUnit(afterEnemyEnd).mp).toBe(mp + 5)
  expect(
    afterEnemyEnd.statusState
      .find((unit) => unit.combatantId === 'enemy')!
      .statuses.some((status) => status.statusId === 'root'),
  ).toBe(true)
})

it('Bastion/Ravager observes the actual owner turn start with its two maintained stances', () => {
  const row = identityResonances.find(
      (row) => row.id === 'resonance.bastion-ravager.linked-sequence',
    )!,
    source = identitySource(row)
  const initial = seedWitness(
    identityState([source]),
    row.after.ability.behaviors[0]!.requirements,
    { owner: 'actor', triggering: 'actor', selected: 'actor', affected: 'actor' },
  )!
  expect(initial.abilityRuntime!.usage).toEqual([])
  const started = advanceRosterTurns(initial, 4)
  expect(started.tactical.battle.currentTurn?.combatantId).toBe('actor')
  expect(started.tactical.battle.round).toBe(2)
  expect(started.abilityRuntime!.usage.some((usage) => usage.key.includes(row.id))).toBe(true)
})
