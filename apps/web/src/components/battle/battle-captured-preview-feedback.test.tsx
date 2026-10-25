import { isValidElement, type ReactNode, type ReactElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.cells))
      hooks.cells[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[index],
      (next: unknown) => {
        hooks.cells[index] =
          typeof next === 'function'
            ? (next as (old: unknown) => unknown)(hooks.cells[index])
            : next
      },
    ]
  },
  useRef: (initial: unknown) => {
    const index = hooks.index++
    if (!(index in hooks.cells)) hooks.cells[index] = { current: initial }
    return hooks.cells[index]
  },
  useCallback: (callback: unknown) => callback,
  useMemo: (callback: () => unknown) => callback(),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useContext: (context: { _currentValue: unknown }) => context._currentValue,
  useSyncExternalStore: (_subscribe: unknown, _get: unknown, server: () => unknown) => server(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
import { BattleExperience } from './battle-experience'
import { BattleSkillCommand } from './battle-skill-command'
import { capturedBasicBattle } from './battle-basic-actions.test-utils'
import type { BattleRuntime } from './battle-runtime'
import { createBattlePreviewService } from '@/server/battle/battle-preview-service'
import type { BattleSessionRecord, BattleSessionRepository } from '@aurevane/db/battle-session'
import type { SupportActionId } from '@aurevane/game-core/combat/support-actions'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'

type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
): ReactElement<Props> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate)
      if (found) return found
    }
  }
  if (!isValidElement<Props>(node)) return null
  return predicate(node) ? node : find(node.props.children, predicate)
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
  vi.stubGlobal('document', {
    querySelector: () => null,
    hidden: false,
    hasFocus: () => true,
    activeElement: null,
  })
  vi.stubGlobal('HTMLElement', class {})
  vi.stubGlobal('window', { requestAnimationFrame: () => 0 })
})
afterEach(() => vi.unstubAllGlobals())
function fixture(
  support: SupportActionId,
  mode: 'pve' | 'pvp',
  options: {
    controlledAttack?: boolean
    delayed?: boolean
    stale?: boolean
    blocked?: boolean
  } = {},
) {
  const input = capturedBasicBattle(support)
  let state: StatDrivenCombatEncounterState = {
    ...input.state,
    tactical: {
      ...input.state.tactical,
      battle: {
        ...input.state.tactical.battle,
        combatants: input.state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 500, mp: 10 } : unit,
        ),
      },
    },
  }
  // Build a separate initial Controlled encounter; captured definitions cannot be edited in place.
  if (options.controlledAttack) {
    const sources = state.capturedAbilitySources!.map((source) => {
      if (source.abilityId !== 'unarmed.basic') return source
      const definition = parseAbilityDefinition({
        ...source.definition,
        behaviors: source.definition.behaviors.map((behavior) => ({
          ...behavior,
          effects: behavior.effects.map((effect) => ({ ...effect, timing: 'controlled' })),
        })),
      })
      return {
        ...source,
        sourceInstanceId: source.sourceInstanceId + '.controlled',
        contentVersion: 3,
        definition,
        basic: { ...source.basic!, contentVersion: 3, ability: definition },
      }
    })
    state = {
      ...reconcileCombatAbilitySources(
        { ...state, capturedAbilitySources: undefined, abilityRuntime: undefined },
        sources,
      ),
      statBridge: state.statBridge,
    }
    const source = sources.find((source) => source.abilityId === 'unarmed.basic')!
    state = {
      ...primeCombatControlledAbility({
        state,
        actorId: 'actor',
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: 'use',
      }).state,
      statBridge: state.statBridge,
    }
  }
  const view = {
    ...input.view,
    snapshot: projectBattleSnapshot(
      state,
      deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, ['actor']),
    ),
  }
  const record: BattleSessionRecord = {
    battleSessionId: view.battleSessionId,
    battleId: state.tactical.battle.battleId,
    battleVersion: view.battleVersion,
    rulesVersion: state.tactical.battle.rulesVersion,
    contentVersion: state.tactical.battle.contentVersion,
    lifecycle: state.tactical.battle.lifecycle,
    snapshot: state,
    controlledCombatantIds: ['actor'],
    updatedAt: '2026-10-16T20:40:43Z',
  }
  const commit = vi.fn(async () => {
    throw new Error('A forecast cannot commit')
  })
  const unused = async () => {
    throw new Error('Unexpected repository operation')
  }
  const repository: BattleSessionRepository = {
    findBattleSession: async () => record,
    createBattleSession: unused,
    findBattleIntentReplay: unused,
    commitBattleIntent: commit,
  }
  const service = createBattlePreviewService(repository)
  const previews: Awaited<ReturnType<typeof service.previewIntent>>[] = []
  const requests: {
    expectedBattleVersion: number
    intent: Parameters<typeof service.previewIntent>[0]['intent']
  }[] = []
  let release: (() => void) | undefined
  const network = vi.fn<typeof fetch>(async (_url, requestOptions) => {
    const body = JSON.parse(String(requestOptions?.body))
    requests.push(body)
    const battlePreview = await service.previewIntent({
      ...body,
      userId: 'owner',
      battleSessionId: view.battleSessionId,
    })
    previews.push(battlePreview)
    if (options.delayed)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return Response.json({
      battlePreview: options.stale
        ? { ...battlePreview, battleVersion: 0 }
        : options.blocked
          ? {
              ...battlePreview,
              preview: {
                ...battlePreview.preview,
                legal: false,
                issues: [{ code: 'blocked', message: 'Release is blocked.' }],
              },
            }
          : battlePreview,
    })
  })
  vi.stubGlobal('fetch', network)
  const runtime: BattleRuntime =
    mode === 'pve'
      ? {
          kind: 'pve',
          playerName: 'Wayfarer',
          playerLevel: 1,
          playerPortraitAssetId: 'character.creation.square-portrait-01',
          playerProfileImageUrl: null,
          supportActionId: support,
        }
      : {
          kind: 'pvp',
          playerName: 'Wayfarer',
          supportActionId: support,
          metadata: {
            lobbyId: 'lobby',
            battleKey: 'key',
            mode: '1v1',
            localCharacterId: 'owner',
            participants: state.tactical.battle.combatants.map((unit, index) => ({
              combatantId: unit.id,
              characterId: index === 0 ? 'owner' : 'other',
              characterName: unit.id,
              teamIndex: index,
              seatIndex: 0,
              characterLevel: 1,
              portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
              profileImageUrl: null,
            })),
          },
        }
  const render = () => {
    hooks.index = 0
    const wrapper = BattleExperience({ initialBattle: view, runtime })
    const content = wrapper.props.children.props.children
    return content.type(content.props)
  }
  const notice = () => {
    const row = find(render(), (node) => node.props['data-battle-notice'] === 'true')!
    return find(row, (node) => node.type === 'span')!.props.children
  }
  const begin = (slot = 'guard') => {
    const button = find(
      render(),
      (node) => node.type === BattleSkillCommand && node.props.slot === slot,
    )!
    expect(button.props.disabled).not.toBe(true)
    ;(button.props.onActivate as () => void)()
  }
  const activate = async (slot = 'guard') => {
    begin(slot)
    await vi.waitFor(() => expect(previews, String(notice())).toHaveLength(1))
    await vi.waitFor(() =>
      expect(notice()).not.toBe('Your turn. Choose any action when you are ready.'),
    )
  }
  return {
    state,
    record,
    network,
    requests,
    previews,
    commit,
    render,
    notice,
    activate,
    begin,
    release: () => release!(),
  }
}
for (const mode of ['pve', 'pvp'] as const) {
  it(mode + ' opens final facing only in the preview without duplicate cockpit arrows', () => {
    const input = fixture('basic.guard', mode)
    input.begin('finish')
    const tree = input.render()
    const deck = find(tree, (node) => node.props['data-unified-command-deck'] === 'true')!
    const finish = find(
      deck,
      (node) => node.type === BattleSkillCommand && node.props.slot === 'finish',
    )!
    expect(finish.props.children).toBeUndefined()
    const preview = find(tree, (node) => node.props['data-battle-preview-strip'] === 'true')!
    const facing = find(preview, (node) => node.props['aria-label'] === 'Choose final facing')!
    expect(facing).not.toBeNull()
    for (const direction of ['north', 'south', 'west', 'east']) {
      expect(
        find(facing, (node) => node.props['aria-label'] === `Face ${direction}`),
      ).not.toBeNull()
    }
    expect(input.commit).not.toHaveBeenCalled()
  })
  it.each(['basic.guard', 'basic.recover', 'basic.recover.mp'] as const)(
    mode + ' feedback uses the captured %s name without restoring stock cost or effect claims',
    async (support) => {
      const input = fixture(support, mode)
      const before = JSON.stringify(input.state)
      await input.activate()
      expect(input.previews[0]!.preview).toMatchObject({
        kind: 'action',
        legal: true,
        commandCosts: [
          { resource: 'ap', amount: 47 },
          { resource: 'mp', amount: 3 },
          { resource: 'hp', amount: 2 },
        ],
      })
      expect(input.notice()).toBe('Second Wind forecast ready.')
      expect(input.requests[0]!.intent).toMatchObject({
        kind: 'action',
        actionId: support,
        target: { kind: 'self' },
      })
      expect(input.commit).not.toHaveBeenCalled()
      expect(JSON.stringify(input.state)).toBe(before)
    },
  )
}

for (const mode of ['pve', 'pvp'] as const) {
  it(mode + ' announces the renamed Basic Attack from the real legal forecast', async () => {
    const input = fixture('basic.guard', mode)
    await input.activate('attack')
    expect(input.notice()).toBe('Open Palm forecast ready.')
    expect(input.previews[0]!.preview).toMatchObject({
      kind: 'action',
      legal: true,
      actionId: 'basic.attack.unarmed.basic',
    })
    expect(input.commit).not.toHaveBeenCalled()
  })
  it(
    mode + ' lights only the current native primed Controlled Attack after its legal forecast',
    async () => {
      const input = fixture('basic.guard', mode, { controlledAttack: true })
      const before = JSON.stringify(input.state)
      const artwork = () =>
        find(
          input.render(),
          (node) => node.type === BattleSkillCommand && node.props.slot === 'attack',
        )!.props
      expect(artwork().controlledReady).toBe(false)
      await input.activate('attack')
      expect(input.previews[0]!.preview).toMatchObject({
        kind: 'action',
        legal: true,
        controlledReady: true,
      })
      expect(input.notice()).toBe('Open Palm ready to release.')
      expect(artwork().controlledReady).toBe(true)
      expect(JSON.stringify(input.state)).toBe(before)
      expect(input.commit).not.toHaveBeenCalled()
    },
  )
  it(mode + ' rejects a stale-version response without a ready notice or glow', async () => {
    const input = fixture('basic.guard', mode, { controlledAttack: true, stale: true })
    await input.activate('attack')
    expect(input.notice()).toBe('That forecast is out of date. Choose a target to check it again.')
    expect(
      find(
        input.render(),
        (node) => node.type === BattleSkillCommand && node.props.slot === 'attack',
      )!.props.controlledReady,
    ).toBe(false)
    expect(input.commit).not.toHaveBeenCalled()
  })
  it(mode + ' keeps the blocked response explanation and suppresses readiness', async () => {
    const input = fixture('basic.guard', mode, { blocked: true })
    await input.activate()
    expect(input.notice()).toBe('Release is blocked.')
    expect(
      find(
        input.render(),
        (node) => node.type === BattleSkillCommand && node.props.slot === 'guard',
      )!.props.controlledReady,
    ).toBe(false)
    expect(input.commit).not.toHaveBeenCalled()
  })
  it(mode + ' discards a late legal Controlled forecast after leaving the action', async () => {
    const input = fixture('basic.guard', mode, { controlledAttack: true, delayed: true })
    input.begin('attack')
    await vi.waitFor(() => expect(input.previews, String(input.notice())).toHaveLength(1))
    const inspect = find(
      input.render(),
      (node) => node.type === BattleSkillCommand && node.props.slot === 'inspect',
    )!
    ;(inspect.props.onActivate as () => void)()
    expect(input.network.mock.calls[0]![1]!.signal!.aborted).toBe(true)
    input.release()
    await input.network.mock.results[0]!.value
    await Promise.resolve()
    await vi.waitFor(() =>
      expect(input.notice()).toBe('Choose a character or tile to inspect. No AP is spent.'),
    )
    expect(
      find(
        input.render(),
        (node) => node.type === BattleSkillCommand && node.props.slot === 'attack',
      )!.props.controlledReady,
    ).toBe(false)
    expect(input.commit).not.toHaveBeenCalled()
  })
}
