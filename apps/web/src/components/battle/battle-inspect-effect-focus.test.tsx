import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  queue: [] as unknown[],
  layouts: [] as (() => unknown)[],
  reader: false,
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: () => [hooks.queue.shift(), vi.fn()],
  useEffect: () => {},
  useLayoutEffect: (callback: () => unknown) => hooks.layouts.push(callback),
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useId: () => 'inspection-help',
  useContext: () => (hooks.reader ? null : { closeInspectMode: vi.fn() }),
  useMemo: (compute: () => unknown) => compute(),
}))
import { DesktopBattleCombatantInspect } from './desktop-battle-combatant-inspect'
import { MobileBattleCombatantPopup } from './mobile-battle-combatant-popup'
import { PvpBattleInspectPopup } from './pvp-battle-inspect-popup'
import { BattleEffectPopover } from './battle-effect-information'
import { BattleInfoPopover } from './battle-info-popover'
type Props = Record<string, unknown> & { children?: ReactNode }
function find(node: ReactNode): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map(find).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return node.props.role === 'dialog' ? node : find(node.props.children)
}
function effectControl(node: ReactNode): ReactElement<Props> | null {
  if (Array.isArray(node)) return node.map(effectControl).find(Boolean) ?? null
  if (!isValidElement<Props>(node)) return null
  return node.type === BattleEffectPopover ? node : effectControl(node.props.children)
}
afterEach(() => vi.unstubAllGlobals())
it.each(['desktop', 'mobile', 'pvp'] as const)(
  'the actual %s inspection focuses its modal owner and restores its opener',
  (surface) => {
    hooks.reader = false
    hooks.queue = [true, true, null, null]
    hooks.layouts = []
    const opener = { focus: vi.fn(), isConnected: true }
    const owner = { focus: vi.fn() }
    vi.stubGlobal('document', { activeElement: opener })
    const tree =
      surface === 'desktop'
        ? DesktopBattleCombatantInspect({ battleSessionId: 'battle' })
        : surface === 'mobile'
          ? MobileBattleCombatantPopup({
              battleSessionId: 'battle',
              playerName: 'Archer',
              playerPortraitAssetId: 'character.portrait.starter.01' as never,
            })
          : PvpBattleInspectPopup({
              battleSessionId: 'battle',
              metadata: { participants: [] } as never,
            })
    const modal = find(tree)!
    const ref = modal.props.ref as { current: unknown } | undefined
    if (ref) ref.current = owner
    const cleanups = hooks.layouts.map((callback) => callback())
    expect(owner.focus).toHaveBeenCalledOnce()
    expect(modal.props['aria-describedby']).toBe('inspection-help')
    for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup()
    expect(opener.focus).toHaveBeenCalledOnce()
  },
)

it.each(['desktop', 'mobile', 'pvp'] as const)(
  'the actual %s effect passes its inspection host into the real portal',
  (surface) => {
    hooks.reader = false
    const status = {
      statusId: 'guarded',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'actor',
    }
    const selected = {
      name: 'Archer',
      combatant: {
        id: 'actor',
        hp: 100,
        maxHp: 100,
        mp: 10,
        maxMp: 10,
        initiative: 10,
        baseMovementBudget: 3,
      },
      profile: null,
      placement: { facing: 'east' },
      statuses: [status],
      summon: null,
      participant: null,
      isPlayer: true,
      active: true,
      actionEconomy: null,
    }
    hooks.queue = [true, false, null, selected]
    hooks.layouts = []
    const tree =
      surface === 'desktop'
        ? DesktopBattleCombatantInspect({ battleSessionId: 'battle' })
        : surface === 'mobile'
          ? MobileBattleCombatantPopup({
              battleSessionId: 'battle',
              playerName: 'Archer',
              playerPortraitAssetId: 'character.portrait.starter.01' as never,
            })
          : PvpBattleInspectPopup({
              battleSessionId: 'battle',
              metadata: { participants: [] } as never,
            })
    const modal = find(tree)!
    const host = { nodeType: 1 }
    const ref = modal.props.ref as { current: unknown }
    ref.current = host
    const effect = effectControl(tree)!
    expect(effect.props.portalHost).toBe(ref)
    const native = BattleEffectPopover(effect.props as Parameters<typeof BattleEffectPopover>[0])
    hooks.queue = [true, false, false, { left: 8, top: 8 }]
    hooks.reader = true
    const rendered = BattleInfoPopover(native.props)
    const portal = (rendered.props.children as unknown[]).find(
      (node) => typeof node === 'object' && node !== null && 'containerInfo' in node,
    ) as { containerInfo: unknown; children: ReactElement<Props> }
    expect(portal.containerInfo).toBe(host)
    expect(portal.children.props.role).toBe('dialog')
    expect(portal.children.props['data-battle-info-modal-owned']).toBe(true)
    expect(modal.props['aria-modal']).toBe('true')
  },
)
