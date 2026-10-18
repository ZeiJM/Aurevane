import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CombatContentEditor } from '@/components/master/combat-content/combat-content-editor'
import { SkillDetails } from '@/components/character/skill-details'
import { SkillParameters } from '@/components/character/skill-parameters'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { previewCombatContentDefinition } from './combat-content-preview'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryCombatContentRepository } from '@aurevane/db/combat-content'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))

const OWNER = '11111111-1111-4111-8111-111111111111'
const manifest = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: {
    kind: 'skill' | 'essence' | 'resonance' | 'basic'
    id: string
    beforeVersion: number
    after: Record<string, unknown>
  }[]
}
class LocalAuthoringStore extends InMemoryCombatContentRepository {
  async getOperatorRole(userId: string) {
    return userId === OWNER ? ('owner' as const) : null
  }
}
function fixture() {
  const store = new LocalAuthoringStore()
  const resolver = createCombatContentResolver({
    findCurrentSkill: (key) => store.findPublished(key, 'skill'),
    findSkillVersion: async (key, version) =>
      (await store.listPublishedVersions(key)).find(
        (row) => row.contentKind === 'skill' && row.contentVersion === version,
      ) ?? null,
    findCurrentContent: (key, kind) => store.findPublished(key, kind),
    findContentVersion: async (key, kind, version) =>
      (await store.listPublishedVersions(key)).find(
        (row) => row.contentKind === kind && row.contentVersion === version,
      ) ?? null,
  })
  return { store, resolver, service: createCombatContentAuthoringService({ store, resolver }) }
}

describe('accepted complete roster through real Master publication validation', () => {
  const { service } = fixture()
  it.each(manifest.records)('$kind $id passes the actual authoring boundary', (row) => {
    const before = JSON.stringify(row.after)
    const result =
      row.kind === 'essence'
        ? service.validateEssenceDefinition(row.after)
        : row.kind === 'resonance'
          ? service.validateResonanceDefinition(row.after)
          : service.validateSkillDefinition(row.after)
    expect(result.issues, `${row.kind}:${row.id}`).toEqual([])
    expect(result.valid).toBe(true)
    expect(JSON.stringify(row.after)).toBe(before)
  })
})

describe('accepted versions through local publication and current/pinned resolution', () => {
  it.each(manifest.records.filter((row) => row.kind !== 'basic'))(
    '$kind $id appends its version and preserves the previous definition',
    async (row) => {
      const { store, resolver, service } = fixture()
      const resolve = (version?: number) => {
        if (row.kind === 'essence') {
          const discipline = row.after.sourceDisciplineId as string
          return version === undefined
            ? resolver.resolveCurrentEssenceDefinition!(discipline, null)
            : resolver.resolvePinnedEssenceDefinition!(discipline, null, row.id, version)
        }
        if (row.kind === 'resonance') {
          const [primary, secondary] = row.after.disciplinePair as [string, string]
          return version === undefined
            ? resolver.resolveCurrentResonanceDefinition!(primary, secondary)
            : resolver.resolvePinnedResonanceDefinition!(primary, secondary, row.id, version)
        }
        return version === undefined
          ? resolver.resolveCurrentSkillDefinition(row.id)
          : resolver.resolvePinnedSkillDefinition(row.id, version)
      }
      const before = structuredClone(await resolve(row.beforeVersion))
      expect(before?.contentVersion).toBe(row.beforeVersion)
      const input = {
        actorUserId: OWNER,
        definition: row.after,
        expectedBaseVersion: row.beforeVersion,
      }
      const published =
        row.kind === 'essence'
          ? await service.publishEssence(input)
          : row.kind === 'resonance'
            ? await service.publishResonance(input)
            : await service.publishSkill(input)
      expect(published.contentVersion).toBe(row.after.contentVersion)
      expect(published.definition).toEqual(row.after)
      expect(await resolve()).toEqual(row.after)
      expect(await resolve(published.contentVersion)).toEqual(row.after)
      expect(await resolve(row.beforeVersion)).toEqual(before)
      expect(await store.listPublishedVersions(row.id)).toHaveLength(1)
      await expect(
        row.kind === 'essence'
          ? service.publishEssence(input)
          : row.kind === 'resonance'
            ? service.publishResonance(input)
            : service.publishSkill(input),
      ).rejects.toMatchObject({ code: 'STALE_VERSION' })
      expect(await store.listPublishedVersions(row.id)).toHaveLength(1)
    },
  )
  it.each(manifest.records.filter((row) => row.kind === 'basic'))(
    'retains $id without a cosmetic publication',
    async (row) => {
      const { store, resolver } = fixture()
      const basics = await resolver.resolveCurrentBasicSkillDefinitions!([
        row.id as import('@aurevane/game-core/combat/combat-basic-actions').BasicSkillId,
      ])
      expect(
        basics.get(
          row.id as import('@aurevane/game-core/combat/combat-basic-actions').BasicSkillId,
        ),
      ).toEqual(row.after)
      expect(await store.listPublishedVersions(row.id)).toEqual([])
    },
  )
})

it.each([
  { id: 'wildwarden.venom-shot', version: 8, rounds: 4 },
  { id: 'cinderweaver.flame-burst', version: 10, rounds: 3 },
  { id: 'frostweaver.chilling-mist', version: 8, rounds: 2 },
])(
  '$id@$version publishes its actual Ground group through preview, editor and public readers',
  async (test) => {
    const row = manifest.records.find((candidate) => candidate.id === test.id)!
    const { service, resolver } = fixture()
    const historical = structuredClone(
      await resolver.resolvePinnedSkillDefinition(row.id, row.beforeVersion),
    )
    const published = await service.publishSkill({
      actorUserId: OWNER,
      definition: row.after,
      expectedBaseVersion: row.beforeVersion,
    })
    expect(published.contentVersion).toBe(test.version)
    const definition = (await resolver.resolveCurrentSkillDefinition(row.id))!
    expect(definition.ability, 'actual published definition needs canonical Ground').toBeDefined()
    expect(await resolver.resolvePinnedSkillDefinition(row.id, test.version)).toEqual(definition)
    expect(await resolver.resolvePinnedSkillDefinition(row.id, row.beforeVersion)).toEqual(
      historical,
    )
    const before = JSON.stringify(definition)
    for (const combatContext of ['pve', 'pvp'] as const) {
      const preview = previewCombatContentDefinition(definition, { combatContext })
      expect(preview.legal).toBe(true)
      expect(preview.costs).toMatchObject({
        actionEconomy: definition.apCost,
        mp: definition.mpCost,
      })
      expect(preview.groundAreas).toHaveLength(1)
      expect(
        preview.groundAreas![0]!.expiresAtRound - preview.groundAreas![0]!.activationRound,
      ).toBe(test.rounds)
      expect(preview.simulation.rngConsumed).toBe(false)
      expect(JSON.stringify(preview.groundAreas)).not.toMatch(
        /caster|entryEffects|sourceCombatantId|effectOrigins|sourceCommandVisibility/,
      )
    }
    const editor = renderToStaticMarkup(
      createElement(CombatContentEditor, {
        skills: [
          {
            id: definition.id,
            sourceDisciplineId: definition.sourceDisciplineId,
            label: definition.id,
            currentVersion: definition.contentVersion,
            baseVersion: definition.contentVersion,
            draftVersion: null,
            derivedTags: [],
            definition,
          },
        ],
      }),
    )
    for (const label of [
      'Ground duration (rounds)',
      'Ground animation',
      'Group activation',
      'Group mode',
    ])
      expect(editor).toContain(`aria-label="${label}"`)
    expect(editor).not.toContain('Resolve compatibility before publishing')
    for (const node of [
      createElement(SkillDetails, { skill: definition, expanded: true }),
      createElement(SkillDetails, { skill: projectPublicCombat(definition) }),
      createElement(SkillParameters, { skill: projectPublicCombat(definition) }),
    ]) {
      const reader = renderToStaticMarkup(node)
      expect(
        reader.match(
          new RegExp(`Ground: stays on the affected tiles for ${test.rounds} rounds`, 'g'),
        ),
      ).toHaveLength(1)
      if (test.id === 'cinderweaver.flame-burst') expect(reader).toContain('Enemy / Ground')
      expect(reader).toContain('starting next round')
      expect(reader).toContain(
        'entering the active area applies only the effects marked for entry once per character',
      )
      expect(reader.match(/Repeats on entry/g)).toHaveLength(
        definition.ability!.behaviors[0]!.groundArea!.entryEffectIds.length,
      )
      expect(reader).not.toContain('Controlled Ground requires')
    }
    expect(JSON.stringify(definition)).toBe(before)
  },
)
