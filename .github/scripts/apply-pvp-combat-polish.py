from pathlib import Path


def update(path: str, transform) -> None:
    file = Path(path)
    before = file.read_text()
    after = transform(before)
    if after == before:
        return
    file.write_text(after)


def fix_chat(text: str) -> str:
    old = """  useEffect(() => {
    setTab(requestedTab)
  }, [requestedTab])
"""
    new = """  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setTab(requestedTab))
    return () => window.cancelAnimationFrame(frame)
  }, [requestedTab])
"""
    if old in text:
        return text.replace(old, new, 1)
    return text


def fix_parity(text: str) -> str:
    if "function activeEconomy(combatant: Combatant | null)" in text:
        return text
    type_marker = "type CombatStatus = BattleSnapshot['statusState'][number]['statuses'][number]\n"
    if type_marker not in text:
        raise SystemExit("PvP desktop parity type marker was not found")
    insertion = type_marker + "\nconst ACTION_ECONOMY_KEY = 'pv1f.action-economy'\n\nfunction activeEconomy(combatant: Combatant | null): number | null {\n  if (!combatant) return null\n  return (\n    combatant.temporaryResources.find((resource) => resource.key === ACTION_ECONOMY_KEY)?.current ??\n    null\n  )\n}\n"
    return text.replace(type_marker, insertion, 1)


update("apps/web/src/components/battle/pvp-battle-chat.tsx", fix_chat)
update("apps/web/src/components/battle/pvp-desktop-parity.tsx", fix_parity)
