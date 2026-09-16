from pathlib import Path

path = Path('packages/game-core/src/combat/recruit-ai-build.ts')
text = path.read_text()

def replace(old: str, new: str, count: int = 1) -> None:
    global text
    actual = text.count(old)
    assert actual == count, (old[:120], actual, count)
    text = text.replace(old, new, count)

replace(
    "import type { CombatActionEvaluation, CombatTargetSelection } from './actions'",
    "import type { CombatActionEvaluation, CombatEffectDefinition, CombatTargetSelection } from './actions'",
)
replace(
    'projectedEffectUtility(evaluated.evaluation, state) +',
    'projectedCombatEffectUtility(evaluated.evaluation, state, definition.effects) +',
)
replace(
    '''function projectedEffectUtility(
  evaluation: CombatActionEvaluation,
  state: StatDrivenCombatEncounterState,
): number {
  const actorTeam = state.tactical.battle.combatants.find(
''',
    '''export function projectedCombatEffectUtility(
  evaluation: CombatActionEvaluation,
  state: StatDrivenCombatEncounterState,
  effects: readonly CombatEffectDefinition[],
): number {
  const copyMode = effects.find((effect) => effect.type === 'copy-statuses')?.mode
  const actorTeam = state.tactical.battle.combatants.find(
''',
)
replace(
    '''      if (effect.before === effect.after) return utility
      if (effect.effectType === 'remove-status')
''',
    '''      if (effect.before === effect.after) return utility
      if (effect.effectType === 'copy-statuses') {
        if (!copyMode) return utility
        // Clone projections already passed authoritative legality/eligibility. Reuse the
        // ordinary status utility magnitude and score only the actual projected recipient.
        return utility + (copyMode === 'amplify' ? 8 * sign : -8 * sign)
      }
      if (effect.effectType === 'remove-status')
''',
)
path.write_text(text)

docs = Path('docs/COMBAT.md')
docs.write_text(
    docs.read_text().rstrip()
    + '''\n\n## Amplify/Curse Recruit AI forecast utility (staged K4 acceptance)\n\nBuild-aware Recruit AI scores cloning only from the same legal authoritative preview projections\nused by player forecast/commit. Each changed `copy-statuses` projection uses the existing ordinary\nstatus utility magnitude: Amplify is beneficial when the projected recipient is allied with the\nactor, while Curse is beneficial when the projected recipient is hostile. An unchanged projection\nor an explicitly allowed empty clone block contributes no cloning utility; independently meaningful\nlater effects retain their existing utility. The mode is read from the typed authored clone block,\nnever inferred from status names, projection text, or hidden state. Preview scoring consumes no RNG\nand does not bypass target legality, copy eligibility, or the existing committed-build boundary.\n\nThis adds AI expected-value support for the already integrated clone kernel only. It does not publish\nAmplify/Curse Skills, remove the `effects.status-copy-staged` publication guard, define consecutive-use\nfalloff for cloning, add area/multi-source copying, or deploy content.\n'''
)
