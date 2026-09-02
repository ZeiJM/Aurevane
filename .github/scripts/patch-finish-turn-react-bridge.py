from pathlib import Path

path = Path('apps/web/src/components/battle/battle-experience.tsx')
text = path.read_text()

old = "  const { registerInspectCloseHandler } = useBattleInteractionLifecycle()\n"
new = (
    "  const { registerFinishTurnHandler, registerInspectCloseHandler } =\n"
    "    useBattleInteractionLifecycle()\n"
)
if text.count(old) != 1:
    raise SystemExit(f'lifecycle destructure mismatch: {text.count(old)}')
text = text.replace(old, new, 1)

old = """  const planningDisabled =
    !localTurn || battleState.lifecycle !== 'active' || commitPending || recruitPending
"""
new = old + """  const planningDisabledRef = useRef(planningDisabled)
  planningDisabledRef.current = planningDisabled
"""
if text.count(old) != 1:
    raise SystemExit(f'planningDisabled mismatch: {text.count(old)}')
text = text.replace(old, new, 1)

marker = """  useEffect(() => {
    return registerInspectCloseHandler(() => {
      if (modeRef.current !== 'inspect') return
      clearPlanning()
      setNotice('Inspection closed. Choose your action.')
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('main[data-battle-keyboard-focus-root="true"]')
          ?.focus({ preventScroll: true })
      })
    })
  }, [clearPlanning, registerInspectCloseHandler])

"""
addition = marker + """  useEffect(() => {
    return registerFinishTurnHandler(() => {
      if (planningDisabledRef.current) return false
      clearPlanning('finish')
      setNotice('Choose final facing with the buttons, WASD, or arrow keys to end the turn.')
      return true
    })
  }, [clearPlanning, registerFinishTurnHandler])

"""
if text.count(marker) != 1:
    raise SystemExit(f'inspect lifecycle effect mismatch: {text.count(marker)}')
text = text.replace(marker, addition, 1)

path.write_text(text)
