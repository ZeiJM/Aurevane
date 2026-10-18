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
import { CombatContentEditor } from './combat-content-editor'
import { EssenceContentEditor } from './essence-content-editor'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import { ResonanceContentEditor } from './resonance-content-editor'
import { CombatContentReviewPanel } from './combat-content-review-panel'
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
  overrides: Partial<Pick<AnyResonanceDefinition, 'enabled'>> = {},
  nativeDefinition?: AnyResonanceDefinition,
) {
  const record = nativeDefinition
    ? { after: nativeDefinition, beforeVersion: nativeDefinition.contentVersion }
    : records.find((r) => r.id === id)!
  const definition = { ...record.after, ...overrides }
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async () => null,
    findCurrentContent: (key, kind) => store.findPublished(key, kind),
    findContentVersion: async () => null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  const requests: Record<string, unknown>[] = []
  let release: (() => void) | undefined
  let held = false
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string)
    requests.push(body)
    if (body.operation === 'preview' && held)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return handleCombatContentAuthoringRequest(
      new Request('https://aurevane.test/api/master/combat-content', init),
      { getActor: async () => ({ userId: owner }), createService: () => service },
    )
  })
  function render() {
    hooks.index = 0
    return ResonanceContentEditor({
      resonances: [
        {
          id: definition.id,
          label: definition.name,
          disciplinePair: definition.disciplinePair,
          currentVersion: record.beforeVersion,
          baseVersion: definition.contentVersion,
          draftVersion: null,
          definition,
          initialDraft: { ...definition, flavorLine: 'Edited for preview.' },
          history: [],
        },
      ],
    })
  }
  function panel() {
    return find(render(), (n) => n.type === CombatContentReviewPanel)!
      .props as unknown as Parameters<typeof CombatContentReviewPanel>[0]
  }
  async function run(kind: 'onValidate' | 'onDiff' | 'onPreview') {
    panel()[kind]()
    await vi.waitFor(() => expect(panel().busy).toBe(false))
  }
  function publishDisabled() {
    return find(
      CombatContentReviewPanel(panel()),
      (n) => n.type === 'button' && n.props.children === 'Publish',
    )!.props.disabled
  }
  function select(group: string) {
    const node = find(panel().previewSelectionControl, (n) => n.type === AbilityPreviewSelector)
    expect(node).not.toBeNull()
    ;(node as ReactElement<{ onChange(id: string): void }>).props.onChange(group)
  }
  return {
    definition,
    store,
    requests,
    reference(label: string, skillId: string) {
      const input = find(panel().previewSelectionControl, (n) => n.props['aria-label'] === label)
      expect(input, label).not.toBeNull()
      ;(input!.props.onChange as (event: unknown) => void)({ currentTarget: { value: skillId } })
    },
    render,
    panel,
    run,
    select,
    publishDisabled,
    root(next: {
      skillId: string
      behaviorId?: string
      eventSample?: import('./combat-content-workflow').CombatContentEventSample
    }) {
      const node = find(
        panel().previewSelectionControl,
        (n) => n.type === ModifierPreviewRootSelector,
      )!
      ;(node.props.onChange as (next: { skillId: string; behaviorId?: string }) => void)(next)
    },
    hold: () => {
      held = true
    },
    release: () => release?.(),
  }
}

it('uses the real editor callbacks to review each group and invalidates the old group preview', async () => {
  const f = fixture()
  expect(f.publishDisabled()).toBe(true)
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.publishDisabled()).toBe(true)
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    behaviorId: 'quench',
    legal: true,
    costs: { actionEconomy: 35, mp: 4 },
  })
  expect(f.publishDisabled()).toBe(false)
  f.panel().onRequestPublish()
  expect(f.panel().publishConfirmationOpen).toBe(true)
  f.select('flare')
  expect(f.panel().preview).toBeNull()
  expect(f.panel().publishConfirmationOpen).toBe(false)
  expect(f.publishDisabled()).toBe(true)
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    behaviorId: 'flare',
    costs: { actionEconomy: 50, mp: 6 },
  })
  expect(f.publishDisabled()).toBe(false)
  expect(await f.store.findPublished(f.definition.id, 'resonance')).toBeNull()
})

it('discards an in-flight preview after the draft changes', async () => {
  const f = fixture()
  await f.run('onValidate')
  await f.run('onDiff')
  f.hold()
  f.panel().onPreview()
  await vi.waitFor(() => expect(f.panel().busy).toBe(true))
  const input = find(f.render(), (n) => n.props['aria-label'] === 'Resonance flavor line')!
  ;(input.props.onChange as (event: unknown) => void)({
    currentTarget: { value: 'Changed during request.' },
  })
  f.release()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  expect(f.panel().preview).toBeNull()
  expect(f.panel().validation).toBeNull()
  expect(f.publishDisabled()).toBe(true)
})

it('retains illegal native Requirements results as visible fixture information', async () => {
  const f = fixture('resonance.aetherist-edgedancer.linked-sequence')
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({ behaviorId: 'gather', legal: false })
  expect(f.publishDisabled()).toBe(false)
  expect(
    find(CombatContentReviewPanel(f.panel()), (n) => n.props['aria-label'] === 'Preview issues'),
  ).not.toBeNull()
  expect(await f.store.findPublished(f.definition.id, 'resonance')).toBeNull()
})

it('preserves the existing review workflow for a Resonance with no Manual action', async () => {
  const f = fixture('resonance.aetherist-farstrider.arcane-hunt')
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.panel().previewRequired).toBe(false)
  expect(f.publishDisabled()).toBe(false)
  expect(f.panel().preview).toBeNull()
  expect(await f.store.findPublished(f.definition.id, 'resonance')).toBeNull()
})

it('publishes a current reviewed text edit while reporting unmet Covert Requirements truthfully', async () => {
  const f = fixture('resonance.shadehand-vanguard.broken-line')
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.publishDisabled()).toBe(true)
  await f.run('onPreview')
  expect(f.panel().preview?.legal).toBe(false)
  expect(f.publishDisabled()).toBe(false)
  f.panel().onRequestPublish()
  f.panel().onConfirmPublish()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  const saved = await f.store.findPublished(f.definition.id, 'resonance')
  expect(saved?.definition.flavorLine).toBe('Edited for preview.')
  expect(saved?.definition.ability).toEqual(f.definition.ability)
})

it('publishes a loaded disabled Manual draft without fabricating an enabled preview', async () => {
  const f = fixture('resonance.cinderweaver-tidecaller.linked-sequence', { enabled: false })
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.panel().validation?.valid).toBe(true)
  expect(f.publishDisabled()).toBe(false)
  expect(f.panel().preview).toBeNull()
  f.panel().onRequestPublish()
  f.panel().onConfirmPublish()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  const saved = await f.store.findPublished(f.definition.id, 'resonance')
  expect(saved?.definition.enabled).toBe(false)
  expect(saved?.definition.flavorLine).toBe('Edited for preview.')
})

it('previews a modifier using the chosen native root and invalidates confirmation on root change', async () => {
  const f = fixture('resonance.aetherist-farstrider.arcane-hunt')
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    legal: false,
    referenceAction: { id: 'unarmed.basic' },
  })
  f.panel().onRequestPublish()
  expect(f.panel().publishConfirmationOpen).toBe(true)
  f.root({ skillId: 'farstrider.aimed-shot' })
  expect(f.panel().preview).toBeNull()
  expect(f.panel().publishConfirmationOpen).toBe(false)
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    legal: true,
    referenceAction: { id: 'farstrider.aimed-shot' },
  })
})

it('discards a held modifier preview after a queued root change', async () => {
  const f = fixture('resonance.aetherist-farstrider.arcane-hunt')
  await f.run('onValidate')
  await f.run('onDiff')
  const control = find(
    f.panel().previewSelectionControl,
    (n) => n.type === ModifierPreviewRootSelector,
  )!
  f.hold()
  f.panel().onPreview()
  await vi.waitFor(() => expect(f.panel().busy).toBe(true))
  ;(control.props.onChange as (r: { skillId: string }) => void)({
    skillId: 'farstrider.aimed-shot',
  })
  f.release()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  expect(f.panel().preview).toBeNull()
  expect(f.panel().publishConfirmationOpen).toBe(false)
})

function skillModifierFixture(
  kind: 'skill' | 'essence',
  disabled = false,
  skillId = 'farstrider.keen-focus',
) {
  const record = records.find((r) => r.id === skillId)! as unknown as {
    after: MatureSkillDefinition
    beforeVersion: number
  }
  const skill = { ...record.after, enabled: !disabled }
  const baseEssence = records.find(
    (r) =>
      'essenceId' in r.after &&
      (r.after as unknown as EssenceDefinition).sourceDisciplineId === skill.sourceDisciplineId,
  )! as unknown as { after: EssenceDefinition; beforeVersion: number }
  const essence: EssenceDefinition = {
    ...baseEssence.after,
    ability: skill.ability,
    skill: { ...baseEssence.after.skill, ability: skill.ability, enabled: !disabled },
  }
  const store = new Store()
  const resolver = createCombatContentResolver({
    findCurrentSkill: async () => null,
    findSkillVersion: async () => null,
    findCurrentContent: (id, k) => store.findPublished(id, k),
    findContentVersion: async () => null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  const sent: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string))
    return handleCombatContentAuthoringRequest(
      new Request('https://aurevane.test/api/master/combat-content', init),
      { getActor: async () => ({ userId: owner }), createService: () => service },
    )
  })
  function render() {
    hooks.index = 0
    return kind === 'skill'
      ? CombatContentEditor({
          skills: [
            {
              id: skill.id,
              label: skill.id,
              sourceDisciplineId: skill.sourceDisciplineId,
              currentVersion: record.beforeVersion,
              baseVersion: record.beforeVersion,
              draftVersion: null,
              derivedTags: [],
              definition: skill,
              initialDraft: { ...skill, flavorLine: 'Edited modifier.' },
              history: [],
            },
          ],
        })
      : EssenceContentEditor({
          essences: [
            {
              id: essence.essenceId,
              label: essence.name,
              sourceDisciplineId: essence.sourceDisciplineId,
              currentVersion: baseEssence.beforeVersion,
              baseVersion: baseEssence.beforeVersion,
              draftVersion: null,
              derivedTags: [],
              definition: essence,
              initialDraft: { ...essence, flavorLine: 'Edited modifier.' },
              history: [],
            },
          ],
        })
  }
  function panel() {
    return find(render(), (n) => n.type === CombatContentReviewPanel)!
      .props as unknown as Parameters<typeof CombatContentReviewPanel>[0]
  }
  async function run(callback: 'onValidate' | 'onDiff' | 'onPreview') {
    panel()[callback]()
    await vi.waitFor(() => expect(panel().busy).toBe(false))
  }
  return {
    panel,
    run,
    sent,
    store,
    id: kind === 'skill' ? skill.id : essence.essenceId,
    root(next: {
      skillId: string
      eventSample?: import('./combat-content-workflow').CombatContentEventSample
    }) {
      const control = find(
        panel().previewSelectionControl,
        (n) => n.type === ModifierPreviewRootSelector,
      )!
      ;(control.props.onChange as (r: { skillId: string }) => void)(next)
    },
  }
}
it.each(['skill', 'essence'] as const)(
  'uses the actual %s editor, client and service for a complete modifier quote',
  async (kind) => {
    const f = skillModifierFixture(kind)
    await f.run('onValidate')
    expect(f.panel().validation?.valid).toBe(true)
    await f.run('onDiff')
    await f.run('onPreview')
    expect(f.panel().preview).toMatchObject({
      legal: false,
      referenceAction: { id: 'unarmed.basic' },
    })
    expect(f.panel().requireLegalPreview).toBe(false)
    f.root({ skillId: 'farstrider.aimed-shot' })
    expect(f.panel().preview).toBeNull()
    await f.run('onPreview')
    expect(f.panel().preview).toMatchObject({
      legal: true,
      referenceAction: { id: 'farstrider.aimed-shot' },
    })
    expect(f.sent.at(-1)).toMatchObject({
      operation: 'preview',
      previewRootSkillId: 'farstrider.aimed-shot',
    })
  },
)

it.each(['skill', 'essence'] as const)(
  'publishes a disabled %s modifier revision without an enabled simulation',
  async (kind) => {
    const f = skillModifierFixture(kind, true)
    await f.run('onValidate')
    expect(f.panel().validation?.valid).toBe(true)
    await f.run('onDiff')
    expect(f.panel().previewRequired).toBe(false)
    const sent = f.sent.length
    await f.run('onPreview')
    expect(f.sent).toHaveLength(sent)
    expect(f.panel().preview).toBeNull()
    expect(
      find(
        CombatContentReviewPanel(f.panel()),
        (n) => n.type === 'button' && n.props.children === 'Publish',
      )!.props.disabled,
    ).toBe(false)
    f.panel().onRequestPublish()
    f.panel().onConfirmPublish()
    await vi.waitFor(() => expect(f.panel().busy).toBe(false))
    const published = await f.store.findPublished(f.id, kind)
    expect(published?.definition.flavorLine).toBe('Edited modifier.')
    if (kind === 'skill') expect(published?.definition.enabled).toBe(false)
    else expect((published?.definition.skill as { enabled: boolean }).enabled).toBe(false)
  },
)
it('offers an optional truthful Ongoing root preview and invalidates it on reference changes', async () => {
  const f = fixture('resonance.aetherist-ravager.linked-sequence')
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.panel().previewRequired).toBe(false)
  expect(f.panel().previewOptional).toBe(true)
  expect(f.publishDisabled()).toBe(false)
  f.root({ skillId: 'aetherist.arc-bolt' })
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    referenceAction: { id: 'aetherist.arc-bolt' },
    modifier: { activation: 'ongoing' },
    legal: true,
  })
  const rendered = JSON.stringify(CombatContentReviewPanel(f.panel()))
  expect(rendered).toContain('Native Requirements determine which Ongoing bonuses apply')
  expect(rendered).not.toContain('Costs and projections include the root and selected modifier.')
  f.panel().onRequestPublish()
  expect(f.panel().publishConfirmationOpen).toBe(true)
  f.root({ skillId: 'farstrider.aimed-shot' })
  expect(f.panel().preview).toBeNull()
  expect(f.panel().publishConfirmationOpen).toBe(false)
  expect(await f.store.findPublished(f.definition.id, 'resonance')).toBeNull()
})

it('samples Automatic Resonance through real callbacks without turning passive publication into a cast requirement', async () => {
  const f = fixture('resonance.dawnshield-vanguard.linked-sequence')
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.panel().previewRequired).toBe(false)
  expect(f.panel().previewOptional).toBe(true)
  expect(f.publishDisabled()).toBe(false)
  const eventSample = {
    referenceActor: 'owner' as const,
    ownerHpPercent: 60,
    ownerMpPercent: 60,
    ownerStatus: 'none' as const,
  }
  f.root({ skillId: 'vanguard.forceful-strike', eventSample })
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    eventSample: { ran: true, activated: true, scenario: eventSample },
    referenceAction: { id: 'vanguard.forceful-strike' },
  })
  const rendered = JSON.stringify(CombatContentReviewPanel(f.panel()))
  expect(rendered).toContain('Local event sample')
  expect(rendered).toContain('Activated in this sample')
  expect(rendered).not.toContain('Costs and projections include the root and selected modifier.')
  f.panel().onRequestPublish()
  expect(f.panel().publishConfirmationOpen).toBe(true)
  f.root({
    skillId: 'vanguard.forceful-strike',
    eventSample: { ...eventSample, ownerHpPercent: 40 },
  })
  expect(f.panel().preview).toBeNull()
  expect(f.panel().publishConfirmationOpen).toBe(false)
})
it.each(['skill', 'essence'] as const)(
  'forwards the selected Automatic event sample from the %s editor',
  async (kind) => {
    const f = skillModifierFixture(kind, false, 'ironfist.counter-palm')
    const eventSample = {
      referenceActor: 'owner' as const,
      ownerHpPercent: 50,
      ownerMpPercent: 60,
      ownerStatus: 'poison' as const,
    }
    f.root({ skillId: 'vanguard.forceful-strike', eventSample })
    await f.run('onValidate')
    await f.run('onDiff')
    await f.run('onPreview')
    expect(f.sent.at(-1)).toMatchObject({
      operation: 'preview',
      eventSample,
      previewRootSkillId: 'vanguard.forceful-strike',
    })
    expect(f.panel().preview).toMatchObject({
      eventSample: { ran: true, activated: true, scenario: eventSample },
    })
    expect(f.panel().requireLegalPreview).toBe(false)
  },
)
it.each(['skill', 'essence'] as const)(
  'can publish a disabled Automatic %s without trying to execute it',
  async (kind) => {
    const f = skillModifierFixture(kind, true, 'ironfist.counter-palm')
    await f.run('onValidate')
    await f.run('onDiff')
    const before = f.sent.length
    await f.run('onPreview')
    expect(f.sent).toHaveLength(before)
    expect(f.panel().previewRequired).toBe(false)
    expect(
      find(
        CombatContentReviewPanel(f.panel()),
        (n) => n.type === 'button' && n.props.children === 'Publish',
      )!.props.disabled,
    ).toBe(false)
    f.panel().onRequestPublish()
    f.panel().onConfirmPublish()
    await vi.waitFor(() => expect(f.panel().busy).toBe(false))
    const published = await f.store.findPublished(f.id, kind)
    expect(published).not.toBeNull()
  },
)

it('renders a native Automatic cleanse outcome rather than only its payment', async () => {
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
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview?.eventSample?.ownerStatusChanges).toContainEqual({
    kind: 'removed',
    statusId: 'poison',
    name: 'Poison',
  })
  expect(JSON.stringify(CombatContentReviewPanel(f.panel()))).toContain('Poison removed')
})

const historicalSequence = resolveResonanceForPair('lifebinder', 'vanguard')!
const historicalImmediate = resolveResonanceForPair('farstrider', 'lifebinder')!
function historicalFixture(definition = historicalSequence) {
  return fixture(undefined, {}, definition)
}
function sampleDisabled(f: ReturnType<typeof fixture>) {
  return find(
    CombatContentReviewPanel(f.panel()),
    (n) => n.type === 'button' && n.props.children === 'Preview',
  )?.props.disabled
}
function selectSequence(f: ReturnType<typeof fixture>) {
  f.reference('Sample setup Skill', 'lifebinder.mending-light')
  f.reference('Sample trigger Skill', 'vanguard.forceful-strike')
}
it('samples historical sequence through real editor callbacks without imposing a publication prerequisite', async () => {
  const f = historicalFixture()
  expect(f.panel().previewOptional).toBe(true)
  expect(sampleDisabled(f)).toBe(true)
  await f.run('onValidate')
  await f.run('onDiff')
  expect(f.publishDisabled()).toBe(false)
  expect(sampleDisabled(f)).toBe(true)
  selectSequence(f)
  expect(sampleDisabled(f)).toBe(false)
  await f.run('onPreview')
  expect(f.requests.find((r) => r.operation === 'preview')).toMatchObject({
    contentKind: 'resonance',
    previewSetupSkillId: 'lifebinder.mending-light',
    previewRootSkillId: 'vanguard.forceful-strike',
  })
  expect(f.requests.find((r) => r.operation === 'preview')).not.toHaveProperty('behaviorId')
  expect(f.panel().preview).toMatchObject({
    historicalSample: { mode: 'sequence', sameTurnOnly: true },
  })
  const html = renderToStaticMarkup(<CombatContentReviewPanel {...f.panel()} />)
  expect(html).toContain('Historical Resonance sample')
  expect(html).toContain('Same-turn sample')
  expect(html.replace(/<[^>]+>/g, '')).toContain('lifebinder.mending-light v')
  expect(html.replace(/<[^>]+>/g, '')).toContain('vanguard.forceful-strike v')
  expect(html).toContain('Local randomness')
  expect(html).not.toContain('Deterministic preview')
  expect(await f.store.findPublished(f.definition.id, 'resonance')).toBeNull()
})
it('samples immediate history with trigger only and no fabricated setup or action group', async () => {
  const f = historicalFixture(historicalImmediate)
  expect(
    find(f.panel().previewSelectionControl, (n) => n.props['aria-label'] === 'Sample setup Skill'),
  ).toBeNull()
  f.reference('Sample trigger Skill', 'farstrider.aimed-shot')
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  const sent = f.requests.find((r) => r.operation === 'preview')!
  expect(sent.previewRootSkillId).toBe('farstrider.aimed-shot')
  expect(sent).not.toHaveProperty('previewSetupSkillId')
  expect(sent).not.toHaveProperty('behaviorId')
  expect(f.panel().preview).toMatchObject({
    historicalSample: { mode: 'immediate', steps: [expect.objectContaining({ ran: true })] },
  })
})
it('clears a historical sample and publish confirmation when references change, retaining validation and diff', async () => {
  const f = historicalFixture()
  selectSequence(f)
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  f.panel().onRequestPublish()
  expect(f.panel().publishConfirmationOpen).toBe(true)
  f.reference('Sample trigger Skill', 'lifebinder.mending-light')
  expect(f.panel().preview).toBeNull()
  expect(f.panel().publishConfirmationOpen).toBe(false)
  expect(f.panel().validation?.valid).toBe(true)
  expect(f.panel().diff).not.toBeNull()
  expect(f.publishDisabled()).toBe(false)
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({ historicalSample: { activated: false } })
})
it('discards a historical response after the selected reference changes', async () => {
  const f = historicalFixture()
  selectSequence(f)
  await f.run('onValidate')
  await f.run('onDiff')
  f.hold()
  f.panel().onPreview()
  await vi.waitFor(() => expect(f.panel().busy).toBe(true))
  f.reference('Sample trigger Skill', 'lifebinder.mending-light')
  f.release()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  expect(f.panel().preview).toBeNull()
})
it('discards a historical response after its draft changes', async () => {
  const f = historicalFixture()
  selectSequence(f)
  await f.run('onValidate')
  await f.run('onDiff')
  f.hold()
  f.panel().onPreview()
  await vi.waitFor(() => expect(f.panel().busy).toBe(true))
  const input = find(f.render(), (n) => n.props['aria-label'] === 'Resonance flavor line')!
  ;(input.props.onChange as (event: unknown) => void)({
    currentTarget: { value: 'Changed during historical sample.' },
  })
  f.release()
  await vi.waitFor(() => expect(f.panel().busy).toBe(false))
  expect(f.panel().preview).toBeNull()
  expect(f.panel().validation).toBeNull()
})
it('requires setup after switching an immediate draft to sequence and sends only references for its current mode', async () => {
  const f = historicalFixture(historicalImmediate)
  f.reference('Sample trigger Skill', 'farstrider.aimed-shot')
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  const mode = find(f.render(), (n) => n.props['aria-label'] === 'Resonance mode')!
  ;(mode.props.onChange as (event: unknown) => void)({ currentTarget: { value: 'sequence' } })
  expect(f.panel().preview).toBeNull()
  await f.run('onValidate')
  await f.run('onDiff')
  expect(sampleDisabled(f)).toBe(true)
  f.reference('Sample setup Skill', 'lifebinder.mending-light')
  await f.run('onPreview')
  expect(f.requests.filter((r) => r.operation === 'preview').at(-1)).toMatchObject({
    previewSetupSkillId: 'lifebinder.mending-light',
  })
})
it('keeps disabled historical drafts publishable after validation/diff but never executes a sample', async () => {
  const f = historicalFixture({ ...historicalSequence, enabled: false })
  await f.run('onValidate')
  await f.run('onDiff')
  expect(sampleDisabled(f)).toBe(true)
  expect(f.publishDisabled()).toBe(false)
  await f.run('onPreview')
  expect(f.requests.some((r) => r.operation === 'preview')).toBe(false)
})
it('shows a current canonical reference rejection without substituting a native builtin', async () => {
  const f = historicalFixture()
  const { resolveMatureSkillVersion } = await import('@aurevane/game-core/combat/mature-skills')
  const native = resolveMatureSkillVersion('vanguard.forceful-strike')!
  const proposed = records.find((r) => r.id === native.id)!.after
  await f.store.publish({
    contentKey: native.id,
    contentKind: 'skill',
    definition: { ...native, ability: proposed.ability },
    expectedBaseVersion: null,
    versionFloor: native.contentVersion,
    actorUserId: owner,
  })
  selectSequence(f)
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview).toBeNull()
  expect(f.panel().errorMessage).toMatch(/native reference/i)
  expect(f.publishDisabled()).toBe(false)
})
it('renders a blocked second command with its unpaid quote and permits validation/diff-only publication', async () => {
  const f = historicalFixture()
  const { resolveMatureSkillVersion } = await import('@aurevane/game-core/combat/mature-skills')
  for (const [id, apCost] of [
    ['lifebinder.mending-light', 50],
    ['vanguard.forceful-strike', 60],
  ] as const) {
    const root = resolveMatureSkillVersion(id)!
    await f.store.publish({
      contentKey: id,
      contentKind: 'skill',
      definition: { ...root, apCost },
      expectedBaseVersion: null,
      versionFloor: root.contentVersion,
      actorUserId: owner,
    })
  }
  selectSequence(f)
  await f.run('onValidate')
  await f.run('onDiff')
  await f.run('onPreview')
  expect(f.panel().preview).toMatchObject({
    legal: false,
    historicalSample: {
      steps: [expect.objectContaining({ ran: true }), expect.objectContaining({ ran: false })],
    },
  })
  const html = renderToStaticMarkup(<CombatContentReviewPanel {...f.panel()} />)
  expect(html).toContain('Sample stopped at an unavailable command.')
  expect(html).toContain('60 AP · 0 MP · not paid')
  expect(html).toContain('Not enough Action Economy')
  expect(f.publishDisabled()).toBe(false)
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
  const f = historicalFixture()
  const html = renderToStaticMarkup(<CombatContentReviewPanel {...f.panel()} preview={preview} />)
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
  const f = historicalFixture(historicalImmediate)
  const html = renderToStaticMarkup(
    <CombatContentReviewPanel {...f.panel()} preview={{ ...preview, simulation: {} }} />,
  )
  expect(html).toContain('Local randomness: Unavailable.')
})
