from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    target.write_text(text.replace(old, new), encoding='utf-8')


actions = 'packages/game-core/src/combat/actions.ts'
replace_once(
    actions,
    "import type { SkillNarrationTemplate } from './battle-narration'\n",
    "import type { SkillNarrationTemplate } from './battle-narration'\nimport {\n  applySkillCooldown,\n  readSkillCooldown,\n  validateSkillCooldownDefinition,\n  type SkillCooldownDefinition,\n  type SkillCooldownEvent,\n} from './skill-cooldowns'\n",
)
replace_once(
    actions,
    "  requirements: readonly CombatUseRequirement[]\n  narration?: SkillNarrationTemplate\n",
    "  requirements: readonly CombatUseRequirement[]\n  cooldown?: SkillCooldownDefinition\n  narration?: SkillNarrationTemplate\n",
)
replace_once(
    actions,
    "export type CombatResolutionEvent =\n  | TacticalBattleEvent\n",
    "export type CombatResolutionEvent =\n  | TacticalBattleEvent\n  | SkillCooldownEvent\n",
)
replace_once(
    actions,
    "  const actor = getCombatant(battle, actorId)\n  if (actor.mp < action.cost.mp) {\n",
    "  const actor = getCombatant(battle, actorId)\n  if (action.cooldown) {\n    const cooldown = readSkillCooldown(actor, action.cooldown)\n    if (cooldown.active) {\n      issues.push({\n        code: 'cooldown-active',\n        message: `That Skill is cooling down (${cooldown.ticksRemaining} owner-turn tick${cooldown.ticksRemaining === 1 ? '' : 's'} remain).`,\n      })\n    }\n  }\n  if (actor.mp < action.cost.mp) {\n",
)
replace_once(
    actions,
    "  for (const effect of action.effects) {\n    const recipients = resolveEffectRecipients(\n      actorId,\n      evaluation.primaryCombatantId,\n      evaluation.affectedCombatantIds,\n      effect.recipient,\n    )\n\n    for (const recipientId of recipients) {\n      const applied = applyEffect(nextState, actorId, recipientId, action.id, effect, content)\n      nextState = applied.state\n      events.push(...applied.events)\n    }\n  }\n\n  const completion = completeBattleIfResolved(nextState)\n",
    "  for (const effect of action.effects) {\n    const recipients = resolveEffectRecipients(\n      actorId,\n      evaluation.primaryCombatantId,\n      evaluation.affectedCombatantIds,\n      effect.recipient,\n    )\n\n    for (const recipientId of recipients) {\n      const applied = applyEffect(nextState, actorId, recipientId, action.id, effect, content)\n      nextState = applied.state\n      events.push(...applied.events)\n    }\n  }\n\n  if (action.cooldown) {\n    const cooldown = applySkillCooldown(\n      getCombatant(nextState.tactical.battle, actorId),\n      action.cooldown,\n      { actionId: action.id, definitionVersion: action.version },\n    )\n    nextState = withUpdatedCombatant(nextState, actorId, cooldown.combatant)\n    events.push(...cooldown.events)\n  }\n\n  const completion = completeBattleIfResolved(nextState)\n",
)
replace_once(
    actions,
    "  assertPositiveSafeInteger(action.version, 'action version')\n  assertKnownString(\n",
    "  assertPositiveSafeInteger(action.version, 'action version')\n  if (action.cooldown) {\n    const cooldownIssues = validateSkillCooldownDefinition(action.cooldown)\n    if (cooldownIssues.length > 0) {\n      throw new TypeError(`Invalid action cooldown definition: ${cooldownIssues.join(', ')}.`)\n    }\n  }\n  assertKnownString(\n",
)

mature = 'packages/game-core/src/combat/mature-skills.ts'
replace_once(
    mature,
    "    requirements: resolved.requirements,\n    effects: resolved.effects,\n",
    "    requirements: resolved.requirements,\n    cooldown: resolved.cooldown,\n    effects: resolved.effects,\n",
)

mature_test = 'packages/game-core/src/combat/mature-skills.test.ts'
replace_once(
    mature_test,
    "    const resolved = executeCombatAction(state, action, { kind: 'self' }, { statuses: [] })\n    expect(resolved.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(\n      46,\n    )\n",
    "    const resolved = executeCombatAction(state, action, { kind: 'self' }, { statuses: [] })\n    expect(resolved.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(\n      46,\n    )\n    const actor = resolved.state.tactical.battle.combatants.find((row) => row.id === 'player')\n    if (!actor) throw new Error('Expected player combatant after Skill use.')\n    expect(readSkillCooldown(actor, definition.cooldown)).toMatchObject({\n      active: true,\n      ownerTurns: 2,\n      ticksRemaining: 3,\n    })\n    const blocked = evaluateCombatAction(\n      resolved.state,\n      action,\n      { kind: 'self' },\n      { statuses: [] },\n    )\n    expect(blocked.legal).toBe(false)\n    expect(blocked.issues).toContainEqual(expect.objectContaining({ code: 'cooldown-active' }))\n",
)

economy = 'packages/game-core/src/combat/pv1f-action-economy.ts'
replace_once(
    economy,
    "import type { BattleCombatant, BattleFacing, BattleTemporaryResource } from './battle-state'\n",
    "import type { BattleCombatant, BattleFacing, BattleTemporaryResource } from './battle-state'\nimport {\n  resolveMatureSkillForContext,\n  toCombatActionDefinition,\n  type MatureSkillCombatContext,\n  type MatureSkillDefinition,\n} from './mature-skills'\n",
)
replace_once(
    economy,
    "export function evaluatePv1fMovement(\n",
    "export function evaluatePv1fMatureSkill(\n  state: StatDrivenCombatEncounterState,\n  definition: MatureSkillDefinition,\n  target: CombatTargetSelection,\n  combatContext: MatureSkillCombatContext = 'pve',\n): {\n  prepared: StatDrivenCombatEncounterState\n  action: CombatActionDefinition\n  cost: number\n  evaluation: CombatActionEvaluation\n} {\n  const prepared = preparePv1fTurnEconomy(state)\n  const resolved = resolveMatureSkillForContext(definition, combatContext)\n  const action = toCombatActionDefinition(definition, combatContext)\n  return {\n    prepared,\n    action,\n    cost: resolved.apCost,\n    evaluation: evaluateCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT),\n  }\n}\n\nexport function executePv1fMatureSkill(\n  state: StatDrivenCombatEncounterState,\n  definition: MatureSkillDefinition,\n  target: CombatTargetSelection,\n  combatContext: MatureSkillCombatContext = 'pve',\n): Pv1fTransition {\n  const { prepared, action, cost, evaluation } = evaluatePv1fMatureSkill(\n    state,\n    definition,\n    target,\n    combatContext,\n  )\n  if (!evaluation.legal) {\n    throw new Error(evaluation.issues[0]?.message ?? 'That mature Skill is not legal.')\n  }\n  if (!canAffordPv1fEconomy(prepared, cost)) {\n    throw new Error('Not enough Action Economy remains for that mature Skill.')\n  }\n  const actorId = prepared.tactical.battle.currentTurn?.combatantId\n  if (!actorId) throw new Error('Mature Skill execution requires an active turn.')\n  const resolved = executeCombatAction(prepared, action, target, PV1F_COMBAT_CONTENT)\n  let next = reattachStatDrivenCombatBridge(resolved.state, prepared.statBridge)\n  next = spendPv1fActionEconomyForActor(next, actorId, cost)\n  const remaining = readPv1fActionEconomy(next, actorId)?.current ?? 0\n  return {\n    state: next,\n    events: [\n      ...resolved.events,\n      { event: 'action_economy_spent', combatantId: actorId, amount: cost, remaining },\n    ],\n  }\n}\n\nexport function evaluatePv1fMovement(\n",
)

economy_test = 'packages/game-core/src/combat/pv1f-action-economy.test.ts'
replace_once(
    economy_test,
    "import { describe, expect, it } from 'vitest'\n",
    "import { describe, expect, it } from 'vitest'\n\nimport { resolveMatureSkillVersion } from './mature-skills'\n",
)
replace_once(
    economy_test,
    "  evaluatePv1fAction,\n  executePv1fAction,\n  finishPv1fTurn,\n  readPv1fActionCooldown,\n",
    "  evaluatePv1fAction,\n  evaluatePv1fMatureSkill,\n  executePv1fAction,\n  executePv1fMatureSkill,\n  finishPv1fTurn,\n  readPv1fActionCooldown,\n  readPv1fActionEconomy,\n",
)
with Path(economy_test).open('a', encoding='utf-8') as handle:
    handle.write(r'''\n\ndescribe('P3.3 mature Skill Action Economy integration', () => {\n  it('spends authored AP, starts cooldown, and remains blocked after reconnect', () => {\n    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)\n    if (!definition) throw new Error('Expected representative Lifebinder Skill.')\n    const state = lethalEncounter('player')\n    const player = state.tactical.battle.combatants.find((combatant) => combatant.id === 'player')\n    if (!player) throw new Error('Expected player combatant.')\n    player.hp = 25\n\n    const used = executePv1fMatureSkill(state, definition, { kind: 'self' })\n    expect(readPv1fActionEconomy(used.state, 'player')?.current).toBe(55)\n    expect(used.events).toContainEqual(\n      expect.objectContaining({\n        event: 'skill_cooldown_started',\n        actionId: definition.id,\n        definitionVersion: definition.contentVersion,\n      }),\n    )\n\n    const reconnected = JSON.parse(JSON.stringify(used.state)) as StatDrivenCombatEncounterState\n    const blocked = evaluatePv1fMatureSkill(reconnected, definition, { kind: 'self' })\n    expect(blocked.evaluation.legal).toBe(false)\n    expect(blocked.evaluation.issues).toContainEqual(\n      expect.objectContaining({ code: 'cooldown-active' }),\n    )\n  })\n})\n''')
