from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new))


replace_once(
    'packages/game-core/src/combat/combat-status-copy-composition.test.ts',
    """    expect(statuses(result.state, 'actor')).toEqual([status(POSITIVE, 'actor', { stacks: 2 })])
    expect(statuses(result.state, 'target')).toEqual(statuses(state, 'target'))
    expect(combatant(result.state, 'target').hp).toBe(53)
""",
    """    expect(statuses(result.state, 'actor')).toEqual([status(POSITIVE, 'actor', { stacks: 2 })])
    expect(statuses(result.state, 'target')).toEqual(statuses(state, 'target'))
    expect(combatant(result.state, 'target').hp).toBe(55)
""",
)

replace_once(
    'packages/game-core/src/combat/combat-status-copy.test.ts',
    """  it('rejects mixed effect packages until ordered copying has a tested contract', () => {
    const action = {
      ...copying('amplify'),
      effects: [...copying('amplify').effects, ...attack().effects],
    }
    expect(() => validateCombatActionDefinition(action, CONTENT)).toThrow()
  })
""",
    """  it('rejects copy blocks placed after another authored effect', () => {
    const action = {
      ...copying('amplify'),
      effects: [...attack().effects, ...copying('amplify').effects],
    }
    expect(() => validateCombatActionDefinition(action, CONTENT)).toThrow()
  })
""",
)
