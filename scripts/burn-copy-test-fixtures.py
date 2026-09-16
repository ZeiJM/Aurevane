from pathlib import Path

path = Path('packages/game-core/src/combat/combat-burn-copy.test.ts')
text = path.read_text()

old = """function applyBurn(
  state: CombatEncounterState,
  targetId: string,
  copyable: unknown = DEFAULT_COPY_POLICY,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  return executeCombatAction(
    state,
    burnAction(copyable === DEFAULT_COPY_POLICY ? true : copyable, actionId),"""
new = """function applyBurn(
  state: CombatEncounterState,
  targetId: string,
  copyable?: unknown,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  const authoredCopyable = arguments.length >= 3 ? copyable : true
  return executeCombatAction(
    state,
    burnAction(authoredCopyable, actionId),"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)

old = """function burn(
  state: CombatEncounterState,
  targetId = 'actor',
  stage = 0,
  copyable: unknown = DEFAULT_COPY_POLICY,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  return withStage(applyBurn(state, targetId, copyable, actionId), targetId, stage)
}"""
new = """function burn(
  state: CombatEncounterState,
  targetId = 'actor',
  stage = 0,
  copyable?: unknown,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  const authoredCopyable = arguments.length >= 4 ? copyable : true
  return withStage(applyBurn(state, targetId, authoredCopyable, actionId), targetId, stage)
}"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)

old = "const DEFAULT_COPY_POLICY = Symbol('default-burn-copy-policy')\n"
assert text.count(old) == 1, text.count(old)
text = text.replace(old, '')

path.write_text(text)
