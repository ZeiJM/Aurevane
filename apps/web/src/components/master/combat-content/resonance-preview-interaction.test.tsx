import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const hooks = vi.hoisted(() => ({ index: 0, cells: [] as unknown[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells))
      hooks.cells[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [
      hooks.cells[i],
      (next: unknown) => {
        hooks.cells[i] =
          typeof next === 'function' ? (next as (old: unknown) => unknown)(hooks.cells[i]) : next
      },
    ]
  },
  useRef(initial: unknown) {
    const i = hooks.index++
    if (!(i in hooks.cells)) hooks.cells[i] = { current: initial }
    return hooks.cells[i]
  },
  useMemo: (fn: () => unknown) => fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import {
  resolveResonanceForPair,
  type AnyResonanceDefinition,
} from '@aurevane/game-core/combat/resonance'
import { renderToStaticMarkup } from 'react-dom/server'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from '@/server/master/combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from '@/server/master/combat-content-authoring-handler'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { resolveEssenceForBuild } from '@aurevane/game-core/combat/essence'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { ContentNativeSample } from './content-native-sample'
import { CombatContentPreviewReport } from './combat-content-preview-report'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import type { CombatContentPreviewSummary } from './combat-content-workflow'
import { AbilityPreviewSelector, ModifierPreviewRootSelector } from './ability-preview-selector'
type Props = Record<string, unknown> & { children?: ReactNode }
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
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
const records = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records as { id: string; after: AnyResonanceDefinition; beforeVersion: number }[]
const owner = '11111111-1111-4111-8111-111111111111'
class Store extends InMemoryCombatContentRepository {
  async getOperatorRole() {
    return 'owner' as const
  }
}
beforeEach(() => {
  hooks.index = 0
  hooks.cells = []
})
afterEach(() => vi.unstubAllGlobals())
function fixture(
  id = 'resonance.cinderweaver-tidecaller.linked-sequence',
  native?: object,
  kind: CombatContentKind = 'resonance',
) {
  let definition = (native ??
    records.find((row) => row.id === id)!.after) as CombatContentDefinition
  const store = new Store(),
    resolver = createCombatContentResolver({
      findCurrentSkill: (key) => store.findPublished(key, 'skill'),
      findSkillVersion: async () => null,
      findCurrentContent: (key, contentKind) => store.findPublished(key, contentKind),
      findContentVersion: async () => null,
    })
  const service = createCombatContentAuthoringService({ store, resolver }),
    requests: Record<string, unknown>[] = []
  let held = false,
    release: (() => void) | undefined
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string)
    requests.push(body)
    if (held)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return handleCombatContentAuthoringRequest(
      new Request('https://example.test/api/master/combat-content', init),
      { getActor: async () => ({ userId: owner }), createService: () => service },
    )
  })
  function render() {
    hooks.index = 0
    return ContentNativeSample({ kind, definition })
  }
  function button() {
    return find(
      render(),
      (node) => node.type === 'button' && node.props.children === 'Run native sample',
    )!
  }
  function preview() {
    return find(render(), (node) => node.type === CombatContentPreviewReport)!.props
      .preview as CombatContentPreviewSummary | null
  }
  async function run() {
    expect(button().props.disabled).toBe(false)
    ;(button().props.onClick as () => void)()
    await vi.waitFor(() => expect(button().props.disabled).toBe(false))
  }
  function select(id: string) {
    ;(
      find(render(), (node) => node.type === AbilityPreviewSelector)!.props.onChange as (
        id: string,
      ) => void
    )(id)
    render()
  }
  function root(next: Parameters<typeof ModifierPreviewRootSelector>[0]['root']) {
    ;(
      find(render(), (node) => node.type === ModifierPreviewRootSelector)!.props.onChange as (
        root: typeof next,
      ) => void
    )(next)
    render()
  }
  function reference(label: string, value: string) {
    ;(
      find(render(), (node) => node.props['aria-label'] === label)!.props.onChange as (
        event: unknown,
      ) => void
    )({ currentTarget: { value } })
    render()
  }
  return {
    render,
    requests,
    store,
    definition,
    button,
    preview,
    run,
    select,
    root,
    reference,
    hold() {
      held = true
    },
    release() {
      release?.()
    },
    edit(patch: Record<string, unknown>) {
      definition = { ...definition, ...patch }
      render()
    },
  }
}
it('runs each actual Manual group and invalidates the old result when selection changes', async () => {
  const f = fixture()
  await f.run()
  expect(f.preview()).toMatchObject({ behaviorId: 'quench', costs: { actionEconomy: 35, mp: 4 } })
  f.select('flare')
  expect(f.preview()).toBeNull()
  await f.run()
  expect(f.preview()).toMatchObject({ behaviorId: 'flare', costs: { actionEconomy: 50, mp: 6 } })
  expect(f.requests.every((row) => row.operation === 'preview')).toBe(true)
  expect(await f.store.findPublished(String(f.definition.id), 'resonance')).toBeNull()
})
it('discards an in-flight sample after a local definition edit', async () => {
  const f = fixture()
  f.hold()
  ;(f.button().props.onClick as () => void)()
  f.edit({ name: 'New local name' })
  f.release()
  await vi.waitFor(() => expect(f.button().props.disabled).toBe(false))
  expect(f.preview()).toBeNull()
})
it('discards an in-flight sample after the selected group changes', async () => {
  const f = fixture()
  f.hold()
  ;(f.button().props.onClick as () => void)()
  f.select('flare')
  f.release()
  await vi.waitFor(() => expect(f.button().props.disabled).toBe(false))
  expect(f.preview()).toBeNull()
})
it('renders genuine Automatic cleanse receipts including the removed status', async () => {
  const f = fixture('resonance.dawnshield-ironfist.linked-sequence')
  f.root({
    skillId: 'ironfist.rising-fist',
    eventSample: {
      referenceActor: 'owner',
      ownerHpPercent: 50,
      ownerMpPercent: 60,
      ownerStatus: 'poison',
    },
  })
  await f.run()
  expect(f.preview()?.eventSample?.ownerStatusChanges).toContainEqual({
    kind: 'removed',
    statusId: 'poison',
    name: 'Poison',
  })
  expect(renderToStaticMarkup(<CombatContentPreviewReport preview={f.preview()} />)).toContain(
    'Poison removed',
  )
  expect(f.requests[0]).toMatchObject({
    previewRootSkillId: 'ironfist.rising-fist',
    eventSample: { ownerStatus: 'poison' },
  })
})
it('keeps a disabled definition unsampled and does not fabricate a result', () => {
  const f = fixture()
  f.edit({ enabled: false })
  expect(f.button().props.disabled).toBe(true)
  expect(f.preview()).toBeNull()
  expect(f.requests).toEqual([])
})
it.each(['skill', 'essence'] as const)(
  'sends the selected %s ability body to the native lane',
  async (kind) => {
    const ability = records.find(
      (row) => row.id === 'resonance.cinderweaver-tidecaller.linked-sequence',
    )!.after.ability
    const original =
      kind === 'skill'
        ? resolveMatureSkillVersion('vanguard.forceful-strike')!
        : resolveEssenceForBuild('vanguard', null)!
    const definition =
      kind === 'skill'
        ? { ...original, ability }
        : {
            ...original,
            skill: {
              ...(original as ReturnType<typeof resolveEssenceForBuild> & object).skill,
              ability,
            },
          }
    const f = fixture(undefined, definition, kind)
    await f.run()
    expect(f.preview()).toMatchObject({ behaviorId: 'quench' })
    expect(f.requests[0]?.definition).toEqual(
      kind === 'skill' ? definition : (definition as { skill: unknown }).skill,
    )
  },
)
const historicalSequence = resolveResonanceForPair('lifebinder', 'vanguard')!
const historicalImmediate = resolveResonanceForPair('farstrider', 'lifebinder')!
it('samples historical sequence with explicit current setup and trigger references', async () => {
  const f = fixture(undefined, historicalSequence)
  expect(f.button().props.disabled).toBe(true)
  f.reference('Sample setup Skill', 'lifebinder.mending-light')
  f.reference('Sample trigger Skill', 'vanguard.forceful-strike')
  await f.run()
  expect(f.preview()?.historicalSample).toBeTruthy()
  expect(f.requests[0]).toMatchObject({
    previewSetupSkillId: 'lifebinder.mending-light',
    previewRootSkillId: 'vanguard.forceful-strike',
  })
  expect(f.requests[0]).not.toHaveProperty('behaviorId')
  f.reference('Sample trigger Skill', 'vanguard.cleave')
  expect(f.preview()).toBeNull()
})
it('samples immediate history with trigger only and never invents setup', async () => {
  const f = fixture(undefined, resolveResonanceForPair('farstrider', 'lifebinder')!)
  expect(find(f.render(), (node) => node.props['aria-label'] === 'Sample setup Skill')).toBeNull()
  f.reference('Sample trigger Skill', 'farstrider.aimed-shot')
  await f.run()
  expect(f.requests[0]).not.toHaveProperty('previewSetupSkillId')
  expect(f.requests[0]).not.toHaveProperty('behaviorId')
  expect(f.preview()?.historicalSample).toBeTruthy()
})
it('keeps a rejected current reference visible without substituting a built-in', async () => {
  const f = fixture(undefined, historicalSequence)
  f.reference('Sample setup Skill', 'missing.current')
  f.reference('Sample trigger Skill', 'vanguard.forceful-strike')
  await f.run()
  expect(f.preview()).toBeNull()
  expect(find(f.render(), (node) => node.props.role === 'alert')).toBeTruthy()
  expect(f.requests[0]?.previewSetupSkillId).toBe('missing.current')
})
it('renders actual native Summon addition/removal with absent resources as N/A', async () => {
  const { previewHistoricalResonanceCombatContentDefinition } =
    await import('@/server/master/combat-content-preview')
  const { resolveMatureSkillVersion, validateMatureSkillDefinition } =
    await import('@aurevane/game-core/combat/mature-skills')
  const setup = resolveMatureSkillVersion('wildwarden.renewing-herbs')!
  const trigger: MatureSkillDefinition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'circle', radius: 2 },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'all-except-actor',
    },
    effects: Array.from({ length: 4 }, () => ({
      type: 'damage' as const,
      recipient: 'affected-units' as const,
      amount: 20,
      durationTurns: 0,
    })),
  }
  expect(validateMatureSkillDefinition(trigger)).toEqual([])
  const preview = previewHistoricalResonanceCombatContentDefinition(historicalSequence, trigger, {
    setup,
    seed: 1,
  })
  expect(preview.legal).toBe(true)
  const html = renderToStaticMarkup(<CombatContentPreviewReport preview={preview} />)
  expect(html).toContain('Appeared')
  expect(html).toContain('Removed')
  expect(html).toContain('N/A → 36')
  expect(html).toContain('36 → N/A')
  expect(html).not.toContain('Deterministic preview')
})
it('does not label missing sample randomness information as unused', async () => {
  const { previewHistoricalResonanceCombatContentDefinition } =
    await import('@/server/master/combat-content-preview')
  const { resolveMatureSkillVersion } = await import('@aurevane/game-core/combat/mature-skills')
  const preview = previewHistoricalResonanceCombatContentDefinition(
    historicalImmediate,
    resolveMatureSkillVersion('farstrider.aimed-shot')!,
    { seed: 1 },
  )
  const html = renderToStaticMarkup(
    <CombatContentPreviewReport preview={{ ...preview, simulation: {} }} />,
  )
  expect(html).toContain('Local randomness: Unavailable.')
})
