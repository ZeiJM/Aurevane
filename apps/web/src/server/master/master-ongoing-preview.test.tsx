import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import {
  previewActionSelection,
  AbilityPreviewSelector,
} from '@/components/master/combat-content/ability-preview-selector'
import {
  type MatureSkillDefinition,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import { previewCombatContentDefinition } from './combat-content-preview'

vi.mock('server-only', () => ({}))
const records = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const owner = '11111111-1111-4111-8111-111111111111'
class LocalStore extends InMemoryCombatContentRepository {
  async getOperatorRole(id: string) {
    return id === owner ? ('owner' as const) : null
  }
}
async function request(
  definition: unknown,
  overrides: Record<string, unknown> = {},
  userId = owner,
  publishedRoot?: MatureSkillDefinition,
) {
  const store = new LocalStore()
  if (publishedRoot)
    await store.publish({
      contentKey: publishedRoot.id,
      contentKind: 'skill',
      definition: { ...publishedRoot },
      expectedBaseVersion: null,
      versionFloor: publishedRoot.contentVersion - 1,
      actorUserId: owner,
    })
  const resolver = createCombatContentResolver({
    findCurrentSkill: (id) => store.findPublished(id, 'skill'),
    findSkillVersion: async () => null,
    findCurrentContent: (id, kind) => store.findPublished(id, kind),
    findContentVersion: async () => null,
  })
  const service = createCombatContentAuthoringService({ store, resolver })
  return handleCombatContentAuthoringRequest(
    new Request('https://aurevane.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify({
        operation: 'preview',
        contentKind: 'resonance',
        definition,
        behaviorId: 'linked-sequence',
        previewRootSkillId: 'aetherist.arc-bolt',
        ...overrides,
      }),
    }),
    { getActor: async () => ({ userId }), createService: () => service },
  )
}
const ids = [
  'resonance.aetherist-ravager.linked-sequence',
  'resonance.aetherist-chronist.linked-sequence',
]
it.each(ids)(
  'offers and natively previews conditional Ongoing source %s without inventing a Manual attachment',
  async (id) => {
    const definition = records.find((r: { id: string }) => r.id === id).after
    const before = JSON.stringify(definition)
    const selection = previewActionSelection(definition, 'linked-sequence')
    expect(selection).toMatchObject({ available: true, behaviorId: 'linked-sequence' })
    const html = renderToStaticMarkup(
      <AbilityPreviewSelector selection={selection} busy={false} onChange={() => {}} />,
    )
    expect(html).toContain('Ongoing Modifier')
    expect(html).not.toContain('Manual Modifier')
    const response = await request(definition)
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    const { preview } = await response.json()
    expect(preview).toMatchObject({
      legal: true,
      modifier: { activation: 'ongoing', mode: 'modifier' },
      referenceAction: { id: 'aetherist.arc-bolt' },
      simulation: { rngConsumed: false },
    })
    const baseline = previewCombatContentDefinition(
      resolveMatureSkillVersion('aetherist.arc-bolt')!,
    )
    expect(preview.costs).toEqual(baseline.costs)
    expect(preview.projections.effects).toEqual(baseline.projections.effects)
    expect(JSON.stringify(preview)).not.toMatch(
      /sourceInstanceId|capturedAbilitySources|effectOrigins|chanceBasisPoints|conditionTruth|sourceDisciplineId/,
    )
    expect(JSON.stringify(definition)).toBe(before)
    expect(await (await request(definition)).json()).toEqual({ preview })
  },
)
it.each(['pve', 'pvp'])(
  'uses native maintenance for an eligible authored Ongoing modifier in %s',
  async (combatContext) => {
    const definition = structuredClone(records.find((r: { id: string }) => r.id === ids[0]).after)
    // This is an explicit authored draft, not a fixture that strips or satisfies Requirements.
    definition.ability.behaviors[0].requirements = {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'hp',
      comparison: 'at-most',
      basisPoints: 10000,
    }
    const response = await request(definition, { combatContext })
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    const { preview } = await response.json()
    const baseline = previewCombatContentDefinition(
      resolveMatureSkillVersion('aetherist.arc-bolt')!,
      { combatContext: combatContext as 'pve' | 'pvp' },
    )
    expect(preview.modifier).toMatchObject({ activation: 'ongoing' })
    expect(preview.costs).toEqual(baseline.costs)
    const damage = (
      effects: readonly {
        effectType: string
        before: number | string | boolean | null
        after: number | string | boolean | null
      }[],
    ) =>
      effects
        .filter((row) => row.effectType === 'damage')
        .reduce((total, row) => total + Number(row.before) - Number(row.after), 0)
    expect(damage(baseline.projections.effects)).toBeGreaterThan(0)
    expect(damage(preview.projections.effects)).toBeGreaterThan(
      damage(baseline.projections.effects),
    )
  },
)
it('keeps disabled, unknown reference and unauthorized Ongoing previews closed', async () => {
  const definition = records.find((r: { id: string }) => r.id === ids[0]).after
  expect((await request({ ...definition, enabled: false })).status).toBe(400)
  expect((await request(definition, { previewRootSkillId: 'unknown.root' })).status).toBe(400)
  expect((await request(definition, {}, 'outsider')).status).toBe(403)
})

it.each(
  (['native', 'canonical'] as const).flatMap((rootKind) =>
    (
      [
        ['at-most', 27, true],
        ['at-least', 30, false],
      ] as const
    ).map(([comparison, amount, amplified]) => ({ rootKind, comparison, amount, amplified })),
  ),
)(
  'does not claim a pre-payment activation state for $rootKind root at $comparison MP $amount',
  async ({ rootKind, comparison, amount, amplified }) => {
    const definition = structuredClone(records.find((r: { id: string }) => r.id === ids[0]).after)
    definition.ability.behaviors[0].requirements = {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'mp',
      comparison,
      amount,
    }
    const root =
      rootKind === 'canonical'
        ? (records.find((r: { id: string }) => r.id === 'aetherist.arc-bolt')
            .after as MatureSkillDefinition)
        : resolveMatureSkillVersion('aetherist.arc-bolt')!
    const response = await request(
      definition,
      {},
      owner,
      rootKind === 'canonical' ? root : undefined,
    )
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200)
    const { preview } = await response.json()
    expect(preview.modifier).toEqual({ activation: 'ongoing', mode: 'modifier' })
    const baseline = previewCombatContentDefinition(
      root,
      rootKind === 'canonical' ? { behaviorId: 'arc-bolt' } : {},
    )
    const damage = (effects: readonly { effectType: string; before: unknown; after: unknown }[]) =>
      effects
        .filter((row) => row.effectType === 'damage')
        .reduce((total, row) => total + Number(row.before) - Number(row.after), 0)
    expect(preview.costs).toEqual(baseline.costs)
    if (amplified)
      expect(damage(preview.projections.effects)).toBeGreaterThan(
        damage(baseline.projections.effects),
      )
    else expect(damage(preview.projections.effects)).toBe(damage(baseline.projections.effects))
  },
)
