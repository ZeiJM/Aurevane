from pathlib import Path

path = Path('.github/scripts/one-shot-battle-input-consistency-v3.py')
text = path.read_text()
old = '''# Remove the later duplicate owner; the early owner now registers before BattleExperience.
late_owner = "      <BattleSelfActionQuickCommitAssist />\\n"
if boundary.count(late_owner) != 1:
    raise SystemExit(f'Expected one late quick-commit owner, found {boundary.count(late_owner)}')
boundary = boundary.replace(late_owner, '', 1)
'''
new = '''# Remove the later owner specifically from its post-battle helper location. The provider-owned
# instance above BattleExperience must remain first in registration order.
late_owner_block = """      <BattleDirectionalAttackAssist playerName={runtime.playerName} />
      <BattleSelfActionQuickCommitAssist />
      <BattleMobileTokenMeters initialBattle={initialBattle} combatantNames={combatantNames} />
"""
late_owner_replacement = """      <BattleDirectionalAttackAssist playerName={runtime.playerName} />
      <BattleMobileTokenMeters initialBattle={initialBattle} combatantNames={combatantNames} />
"""
if late_owner_block not in boundary:
    raise SystemExit('Late quick-commit owner location not found')
boundary = boundary.replace(late_owner_block, late_owner_replacement, 1)
'''
if text.count(old) != 1:
    raise SystemExit(f'Expected one patch-script target, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Corrected clean-patch targeting.')
