from pathlib import Path

path = Path('packages/game-core/src/combat/combat-burn-copy.test.ts')
text = path.read_text()

anchor = "import { validateCombatActionDefinition } from './combat-authoring-validation'"
assert text.count(anchor) == 1
text = text.replace(
    anchor,
    anchor + "\nimport { createStatDrivenCombatEncounterState } from './stat-driven-combat'",
)

anchor = "const TARGET = { kind: 'unit' as const, combatantId: 'target' }"
addition = """
const BURN_REMOVAL_STATUS: CombatStatusDefinition = {
  id: 'burn',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 1,
  damageTakenMultiplierBasisPoints: 10_000,
}
const DEFAULT_COPY_POLICY = Symbol('default-burn-copy-policy')
"""
assert text.count(anchor) == 1
text = text.replace(anchor, anchor + addition)

old = """function applyBurn(
  state: CombatEncounterState,
  targetId: string,
  copyable: unknown = true,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  return executeCombatAction(
    state,
    burnAction(copyable, actionId),"""
new = """function applyBurn(
  state: CombatEncounterState,
  targetId: string,
  copyable: unknown = DEFAULT_COPY_POLICY,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  return executeCombatAction(
    state,
    burnAction(copyable === DEFAULT_COPY_POLICY ? true : copyable, actionId),"""
assert text.count(old) == 1
text = text.replace(old, new)

old = """function burn(
  state: CombatEncounterState,
  targetId = 'actor',
  stage = 0,
  copyable: unknown = true,"""
new = """function burn(
  state: CombatEncounterState,
  targetId = 'actor',
  stage = 0,
  copyable: unknown = DEFAULT_COPY_POLICY,"""
assert text.count(old) == 1
text = text.replace(old, new)

anchor = "function damageAction(): CombatActionDefinition {"
helper = """function withAccuracyProfiles(state: CombatEncounterState): CombatEncounterState {
  return createStatDrivenCombatEncounterState(
    state,
    state.tactical.battle.combatants.map((unit) => ({
      combatantId: unit.id,
      provenance: {
        kind: 'scenario' as const,
        sourceId: `scenario:${unit.id}`,
        sourceRulesVersion: 2,
      },
      accuracy: unit.id === 'actor' ? 0 : 5_000,
      evasion: unit.id === 'target' ? 10_000 : 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 30,
      mysticPower: 30,
    })),
  )
}

"""
assert text.count(anchor) == 1
text = text.replace(anchor, helper + anchor)

old = """    const cleared = executeCombatAction(
      targetTurn,
      action,
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )"""
new = """    const cleared = executeCombatAction(
      targetTurn,
      action,
      { kind: 'unit', combatantId: 'target' },
      { statuses: [...CONTENT.statuses, BURN_REMOVAL_STATUS] },
    )"""
assert text.count(old) == 1
text = text.replace(old, new)

old = "    const state = burn(world(1), 'actor', 2, true)"
new = "    const state = burn(withAccuracyProfiles(world(1)), 'actor', 2, true)"
assert text.count(old) == 1
text = text.replace(old, new)

path.write_text(text)
