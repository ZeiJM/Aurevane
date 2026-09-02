from pathlib import Path
import subprocess

ROOT = Path('.')
OLD_REF = 'origin/agent/final-facing-hotkey-reliability-v2'

COPY_FILES = [
    'apps/web/e2e/battle-self-action-quick-commit.pw.ts',
    'apps/web/src/components/battle/battle-client-boundary.tsx',
    'apps/web/src/components/battle/battle-experience.tsx',
    'apps/web/src/components/battle/battle-finish-turn-keyboard-assist.tsx',
    'apps/web/src/components/battle/battle-keyboard-assist.tsx',
    'apps/web/src/components/battle/battle-self-action-quick-commit-assist.test.ts',
    'apps/web/src/components/battle/battle-self-action-quick-commit-assist.tsx',
    'apps/web/src/components/battle/desktop-battle-combatant-inspect.module.css',
    'apps/web/src/components/battle/desktop-battle-combatant-inspect.tsx',
    'apps/web/src/components/battle/mobile-battle-combatant-popup.module.css',
    'apps/web/src/components/battle/mobile-battle-combatant-popup.tsx',
    'apps/web/src/components/battle/pvp-battle-experience.module.css',
    'apps/web/src/components/battle/pvp-battle-inspect-popup.tsx',
    'apps/web/src/components/battle/pvp-battle-keyboard-assist.tsx',
    'apps/web/src/components/battle/pvp-six-combatant-rails.module.css',
    'apps/web/src/components/battle/battle-skill-command.module.css',
    'apps/web/src/components/battle/unified-battle-experience.module.css',
]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old!r}')
    write(path, text.replace(old, new, 1))


subprocess.run(['git', 'checkout', OLD_REF, '--', *COPY_FILES], check=True)

# Physical keyboard ownership is independent of viewport width.
finish_path = 'apps/web/src/components/battle/battle-finish-turn-keyboard-assist.tsx'
finish = read(finish_path)
width_guard = """      if (!window.matchMedia(DESKTOP_QUERY).matches) {
        markDecision(observedRoot, 'not-desktop', event)
        return
      }

"""
if width_guard not in finish:
    raise SystemExit('Finish Turn viewport-width guard not found')
finish = finish.replace(width_guard, '', 1)
finish = finish.replace(
    "      if (isTextEntryTarget(event.target)) {\n",
    "      if (event.isComposing) {\n        markDecision(observedRoot, 'composing', event)\n        return\n      }\n      if (isTextEntryTarget(event.target)) {\n",
    1,
)
if 'DESKTOP_QUERY' in finish:
    raise SystemExit('Finish Turn still references DESKTOP_QUERY')
write(finish_path, finish)

quick_path = 'apps/web/src/components/battle/battle-self-action-quick-commit-assist.tsx'
quick = read(quick_path)
replace_from = """      if (
        isTextEntryTarget(event.target) ||
"""
replace_to = """      if (
        event.isComposing ||
        isTextEntryTarget(event.target) ||
"""
if replace_from not in quick:
    raise SystemExit('Quick-commit keydown guard not found')
quick = quick.replace(replace_from, replace_to, 1)
if "matchMedia('(min-width: 821px)')" in quick:
    raise SystemExit('Quick-commit still has viewport-width ownership')
write(quick_path, quick)

# React-owned lifecycle bridge: popup dismissal clears BattleExperience Inspect mode.
lifecycle_path = ROOT / 'apps/web/src/components/battle/battle-interaction-lifecycle.tsx'
lifecycle_path.write_text("""'use client'

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'

type InspectCloseHandler = () => void

type BattleInteractionLifecycleValue = {
  registerInspectCloseHandler: (handler: InspectCloseHandler) => () => void
  closeInspectMode: () => void
}

const EMPTY_LIFECYCLE: BattleInteractionLifecycleValue = {
  registerInspectCloseHandler: () => () => undefined,
  closeInspectMode: () => undefined,
}

const BattleInteractionLifecycleContext =
  createContext<BattleInteractionLifecycleValue>(EMPTY_LIFECYCLE)

export function BattleInteractionLifecycleProvider({ children }: { children: ReactNode }) {
  const inspectCloseHandlerRef = useRef<InspectCloseHandler | null>(null)

  const registerInspectCloseHandler = useCallback((handler: InspectCloseHandler) => {
    inspectCloseHandlerRef.current = handler
    return () => {
      if (inspectCloseHandlerRef.current === handler) inspectCloseHandlerRef.current = null
    }
  }, [])

  const closeInspectMode = useCallback(() => {
    inspectCloseHandlerRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ registerInspectCloseHandler, closeInspectMode }),
    [closeInspectMode, registerInspectCloseHandler],
  )

  return (
    <BattleInteractionLifecycleContext.Provider value={value}>
      {children}
    </BattleInteractionLifecycleContext.Provider>
  )
}

export function useBattleInteractionLifecycle(): BattleInteractionLifecycleValue {
  return useContext(BattleInteractionLifecycleContext)
}
""")

boundary_path = 'apps/web/src/components/battle/battle-client-boundary.tsx'
boundary = read(boundary_path)
if "import { BattleInteractionLifecycleProvider }" not in boundary:
    boundary = boundary.replace(
        "import { BattleHeaderMatchMessage } from './battle-header-message-cycle'\n",
        "import { BattleHeaderMatchMessage } from './battle-header-message-cycle'\nimport { BattleInteractionLifecycleProvider } from './battle-interaction-lifecycle'\n",
        1,
    )
old_open = """    <BattleRuntimeProvider playerName={runtime.playerName} combatantAccents={combatantAccents}>
      <BattleFinishTurnKeyboardAssist playerName={runtime.playerName} />
      <BattleExperience
"""
new_open = """    <BattleRuntimeProvider playerName={runtime.playerName} combatantAccents={combatantAccents}>
      <BattleInteractionLifecycleProvider>
        <BattleSelfActionQuickCommitAssist />
        <BattleFinishTurnKeyboardAssist playerName={runtime.playerName} />
        <BattleExperience
"""
if old_open not in boundary:
    raise SystemExit('Battle boundary opening block not found')
boundary = boundary.replace(old_open, new_open, 1)
# Remove the later duplicate owner; the early owner now registers before BattleExperience.
late_owner = "      <BattleSelfActionQuickCommitAssist />\n"
if boundary.count(late_owner) != 1:
    raise SystemExit(f'Expected one late quick-commit owner, found {boundary.count(late_owner)}')
boundary = boundary.replace(late_owner, '', 1)
old_close = """      <BattleScreenVisualContract />
    </BattleRuntimeProvider>
"""
new_close = """      <BattleScreenVisualContract />
      </BattleInteractionLifecycleProvider>
    </BattleRuntimeProvider>
"""
if old_close not in boundary:
    raise SystemExit('Battle boundary closing block not found')
boundary = boundary.replace(old_close, new_close, 1)
write(boundary_path, boundary)

experience_path = 'apps/web/src/components/battle/battle-experience.tsx'
experience = read(experience_path)
old_import = """import {
  BATTLE_INSPECT_CLOSED_EVENT,
  type BattleInspectClosedDetail,
} from './battle-inspect-lifecycle'
"""
if old_import not in experience:
    raise SystemExit('Old Inspect lifecycle import not found')
experience = experience.replace(
    old_import,
    "import { useBattleInteractionLifecycle } from './battle-interaction-lifecycle'\n",
    1,
)
mode_marker = """  const modeRef = useRef<Mode>('none')
  modeRef.current = mode

  const { selectedSkillId, selectSkill } = useBattleSkillSelections(
"""
mode_replacement = """  const modeRef = useRef<Mode>('none')
  modeRef.current = mode
  const { registerInspectCloseHandler } = useBattleInteractionLifecycle()

  const { selectedSkillId, selectSkill } = useBattleSkillSelections(
"""
if mode_marker not in experience:
    raise SystemExit('BattleExperience mode marker not found')
experience = experience.replace(mode_marker, mode_replacement, 1)
old_effect = """  useEffect(() => {
    function handleInspectClosed(event: Event) {
      const detail = (event as CustomEvent<BattleInspectClosedDetail>).detail
      if (detail?.battleSessionId !== initialBattle.battleSessionId || modeRef.current !== 'inspect') {
        return
      }

      clearPlanning()
      setNotice('Inspection closed. Choose your action.')
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('main[data-unified-battle="true"]')
          ?.focus({ preventScroll: true })
      })
    }

    window.addEventListener(BATTLE_INSPECT_CLOSED_EVENT, handleInspectClosed)
    return () => window.removeEventListener(BATTLE_INSPECT_CLOSED_EVENT, handleInspectClosed)
  }, [clearPlanning, initialBattle.battleSessionId])

"""
new_effect = """  useEffect(() => {
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
if old_effect not in experience:
    raise SystemExit('Old BattleExperience Inspect close effect not found')
experience = experience.replace(old_effect, new_effect, 1)
if 'data-battle-keyboard-focus-root="true"' not in experience or 'tabIndex={-1}' not in experience:
    raise SystemExit('Neutral battle focus root is missing')
write(experience_path, experience)

for popup_path in [
    'apps/web/src/components/battle/desktop-battle-combatant-inspect.tsx',
    'apps/web/src/components/battle/mobile-battle-combatant-popup.tsx',
    'apps/web/src/components/battle/pvp-battle-inspect-popup.tsx',
]:
    popup = read(popup_path)
    old_popup_import = "import { dispatchBattleInspectClosed } from './battle-inspect-lifecycle'"
    if old_popup_import not in popup:
        raise SystemExit(f'{popup_path}: old Inspect lifecycle import not found')
    popup = popup.replace(
        old_popup_import,
        "import { useBattleInteractionLifecycle } from './battle-interaction-lifecycle'",
        1,
    )
    marker = "  const [selected, setSelected] = useState<SelectedCombatant | null>(null)\n  const openRef = useRef(false)\n"
    if marker not in popup:
        raise SystemExit(f'{popup_path}: open state marker not found')
    popup = popup.replace(marker, marker + "  const { closeInspectMode } = useBattleInteractionLifecycle()\n", 1)
    if '    dispatchBattleInspectClosed(battleSessionId)\n' not in popup:
        raise SystemExit(f'{popup_path}: old close dispatch not found')
    popup = popup.replace('    dispatchBattleInspectClosed(battleSessionId)\n', '    closeInspectMode()\n', 1)
    if '  }, [battleSessionId])\n' not in popup:
        raise SystemExit(f'{popup_path}: close callback dependency not found')
    popup = popup.replace('  }, [battleSessionId])\n', '  }, [closeInspectMode])\n', 1)
    write(popup_path, popup)

# Validate the intentionally small responsive presentation surface.
presentation_assertions = {
    'apps/web/src/components/battle/unified-battle-experience.module.css': [
        "@media (min-width: 821px), (any-hover: hover) and (any-pointer: fine) {",
        "@media (max-width: 820px) and (any-hover: none) and (any-pointer: coarse) {",
    ],
    'apps/web/src/components/battle/pvp-battle-experience.module.css': [
        "@media (max-width: 820px) and (any-hover: none) and (any-pointer: coarse) {",
    ],
    'apps/web/src/components/battle/mobile-battle-combatant-popup.module.css': [
        "@media (max-width: 880px) and (any-hover: none) and (any-pointer: coarse) {",
    ],
    'apps/web/src/components/battle/desktop-battle-combatant-inspect.module.css': [
        "@media (min-width: 881px), (any-hover: hover) and (any-pointer: fine) {",
    ],
    'apps/web/src/components/battle/battle-skill-command.module.css': [
        "@media (max-width: 820px) and (any-hover: none) and (any-pointer: coarse) {",
    ],
    'apps/web/src/components/battle/pvp-six-combatant-rails.module.css': [
        "@media (min-width: 821px), (any-hover: hover) and (any-pointer: fine) {",
    ],
}
for path, needles in presentation_assertions.items():
    text = read(path)
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'{path}: expected responsive rule missing: {needle}')

# Expand rendered regression: narrow fine-pointer desktop, Inspect close, resize churn, 10 handoffs.
test_path = 'apps/web/e2e/battle-self-action-quick-commit.pw.ts'
test_text = read(test_path)
helper_marker = "async function openInspectAndDismiss(page: Page, root: Locator, targetName: string) {\n"
helper = """async function expectFinePointerDesktopPresentation(page: Page, root: Locator) {
  expect(
    await page.evaluate(() =>
      window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches,
    ),
  ).toBe(true)
  await expect(root.locator('section[aria-label="Battle roster"]')).toBeHidden()
  const rails = root.locator('aside[data-unified-combatant-rail="true"]')
  await expect(rails).toHaveCount(2)
  await expect(rails.first()).toBeVisible()
  await expect(page.locator('[data-mobile-battle-popup]')).toHaveCount(0)
}

"""
if helper_marker not in test_text:
    raise SystemExit('E2E helper insertion point not found')
test_text = test_text.replace(helper_marker, helper + helper_marker, 1)
old_narrow_prelude = """  const playerTile = root.locator('#battlefield button[aria-label*="occupied by"]').first()
  const targetName = ((await playerTile.getAttribute('aria-label')) ?? '').includes('Recruit')
    ? 'QuickGuard'
    : 'Recruit'

  const inspect = root.locator(
"""
new_narrow_prelude = """  await expectFinePointerDesktopPresentation(page, root)

  const inspect = root.locator(
"""
if old_narrow_prelude not in test_text:
    raise SystemExit('Narrow Guard regression prelude not found')
test_text = test_text.replace(old_narrow_prelude, new_narrow_prelude, 1)
if '    for (let cycle = 0; cycle < 3; cycle += 1) {\n' not in test_text:
    raise SystemExit('PvP cycle loop not found')
test_text = test_text.replace('    for (let cycle = 0; cycle < 3; cycle += 1) {\n', '    for (let cycle = 0; cycle < 5; cycle += 1) {\n', 1)
old_cycle = """        await expect(first.root).toBeVisible()
        await expect(second.root).toBeVisible()
        await openInspectAndDismiss(first.page, first.root, second.name)
      }

      await finishTurnKeepingFacing(first.page, first.root, cycle === 0)
"""
new_cycle = """        await expectFinePointerDesktopPresentation(first.page, first.root)
        await expectFinePointerDesktopPresentation(second.page, second.root)
        await openInspectAndDismiss(first.page, first.root, second.name)
      } else if (cycle === 3) {
        await Promise.all([
          first.page.setViewportSize({ width: 1280, height: 900 }),
          second.page.setViewportSize({ width: 1280, height: 900 }),
        ])
        await expectFinePointerDesktopPresentation(first.page, first.root)
        await openInspectAndDismiss(second.page, second.root, first.name)
      } else if (cycle === 4) {
        await Promise.all([
          first.page.setViewportSize({ width: 750, height: 900 }),
          second.page.setViewportSize({ width: 750, height: 900 }),
        ])
        await expectFinePointerDesktopPresentation(first.page, first.root)
        await expectFinePointerDesktopPresentation(second.page, second.root)
      }

      await finishTurnKeepingFacing(first.page, first.root, cycle === 0)
"""
if old_cycle not in test_text:
    raise SystemExit('PvP resize cycle block not found')
test_text = test_text.replace(old_cycle, new_cycle, 1)
write(test_path, test_text)

# Static ownership invariants.
for path in [
    'apps/web/src/components/battle/battle-keyboard-assist.tsx',
    'apps/web/src/components/battle/pvp-battle-keyboard-assist.tsx',
]:
    text = read(path)
    if "if (isSharedCategoryAction(action) || action === 'endTurn') return" not in text:
        raise SystemExit(f'{path}: unconditional legacy yield is missing')
    if "window.matchMedia('(min-width: 821px)').matches" in text:
        raise SystemExit(f'{path}: legacy width-based input ownership remains')

# The old DOM CustomEvent bridge must not survive on this clean branch.
old_lifecycle = ROOT / 'apps/web/src/components/battle/battle-inspect-lifecycle.ts'
if old_lifecycle.exists():
    old_lifecycle.unlink()

print('Clean battle input/responsive consistency patch applied.')
