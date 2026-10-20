import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import type { EssenceDefinition } from '@aurevane/game-core/combat/essence'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import type { CombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import {
  createLegalRosterDuel,
  legalRosterCycleKits,
  playLegalRosterDuel,
} from '@/server/battle/roster-legal-duel.test-utils'
import {
  owner,
  store,
  resolver,
  publishProposedRoster,
} from '@/server/battle/roster-legal-build.test-utils'
import { createCombatContentAuthoringService } from './combat-content-authoring-service'
import { resolveCombatContentCatalogueSnapshot } from '@/server/combat/combat-content-resolver'
import { validateCombatCatalogueTiming } from '@/server/combat/combat-catalogue-timing-compatibility'

vi.mock('server-only', () => ({}))
type Row = {
  id: string
  beforeVersion: number
} & (
  | { kind: 'essence'; after: EssenceDefinition }
  | { kind: 'resonance'; after: AnyResonanceDefinition }
)
const read = (file: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../../docs/superpowers/specs/${file}`, import.meta.url), 'utf8'),
  )
const rows: Row[] = read('2026-10-19-essence-resonance-identity-cohort.json').records
const baseline = read('2026-10-18-modular-correction-cohort.json').records
const service = createCombatContentAuthoringService({ store, resolver })
const policy: CombatEffectTimingPolicy = {
  version: 8,
  tagAuthority: 'global',
  modes: {
    summon: 'instant',
    displace: 'instant',
    'mp-drain': 'instant',
    'remove-status': 'instant',
    'return-to-turn-start': 'controlled',
    'barrier-change': 'instant',
    blindside: 'instant',
  },
}

it.each(rows)('$kind $id passes the actual typed Master authoring boundary', (row) => {
  const result =
    row.kind === 'essence'
      ? service.validateEssenceDefinition(row.after)
      : service.validateResonanceDefinition(row.after)
  expect(result.issues).toEqual([])
  expect(result.valid).toBe(true)
})

let publication: Promise<void> | undefined
function publishIdentityRoster() {
  return (publication ??= (async () => {
    await publishProposedRoster()
    for (const row of baseline) {
      const input = {
        actorUserId: owner,
        definition: row.after,
        expectedBaseVersion: row.beforeVersion,
      }
      if (row.kind === 'essence') await service.publishEssence(input)
      else if (row.kind === 'resonance') await service.publishResonance(input)
      else await service.publishSkill(input)
    }
    const previous = new Map<string, CombatContentVersionRecord>()
    for (const row of baseline) {
      const record = await store.findPublished(row.id, row.kind === 'basic' ? 'skill' : row.kind)
      expect(record).not.toBeNull()
      previous.set(row.id, record!)
    }
    for (const row of rows) {
      const input = {
        actorUserId: owner,
        definition: row.after,
        expectedBaseVersion: row.beforeVersion,
      }
      const receipt =
        row.kind === 'essence'
          ? await service.publishEssence(input)
          : await service.publishResonance(input)
      expect(receipt.definition).toEqual(row.after)
      expect(receipt.contentVersion).toBe(row.beforeVersion + 1)
      expect(
        (await store.listPublishedVersions(row.id)).find(
          (value) => value.contentVersion === row.beforeVersion,
        ),
      ).toEqual(previous.get(row.id))
      if (row.kind === 'essence') {
        const discipline = row.after.sourceDisciplineId
        expect(await resolver.resolveCurrentEssenceDefinition!(discipline, null)).toEqual(row.after)
        expect(
          await resolver.resolvePinnedEssenceDefinition!(
            discipline,
            null,
            row.after.essenceId,
            row.beforeVersion,
          ),
        ).toEqual(previous.get(row.id)!.definition)
        expect(
          await resolver.resolveCurrentEssenceDefinition!(
            discipline,
            discipline === 'vanguard' ? 'aetherist' : 'vanguard',
          ),
        ).toBeNull()
        expect(await resolver.resolveCurrentResonanceDefinition!(discipline, null)).toBeNull()
      } else {
        const [first, second] = row.after.disciplinePair
        expect(await resolver.resolveCurrentResonanceDefinition!(first, second)).toEqual(row.after)
        expect(await resolver.resolveCurrentResonanceDefinition!(second, first)).toEqual(row.after)
        expect(
          await resolver.resolvePinnedResonanceDefinition!(
            first,
            second,
            row.id,
            row.beforeVersion,
          ),
        ).toEqual(previous.get(row.id)!.definition)
        expect(await resolver.resolveCurrentResonanceDefinition!(first, null)).toBeNull()
        expect(await resolver.resolveCurrentEssenceDefinition!(first, second)).toBeNull()
        expect(
          row.after.ability!.behaviors.every((behavior) => behavior.activation !== 'manual'),
        ).toBe(true)
      }
    }
    const publications: CombatContentVersionRecord[] = []
    for (const row of baseline) {
      const current = await store.findPublished(row.id, row.kind === 'basic' ? 'skill' : row.kind)
      const expected = rows.find((candidate) => candidate.id === row.id)
      expect(current!.definition).toEqual(expected?.after ?? row.after)
      if (!expected) expect(current).toEqual(previous.get(row.id))
      publications.push(current!)
    }
    expect(publications).toHaveLength(294)
    const catalogue = resolveCombatContentCatalogueSnapshot({
      token: 'a'.repeat(32),
      policy,
      publications,
    })
    expect(validateCombatCatalogueTiming(catalogue)).toEqual([])
    for (const row of rows)
      expect(catalogue.entries.find((entry) => entry.contentKey === row.id)!.definition).toEqual(
        row.after,
      )
  })())
}
it(
  'publishes only changed identities, preserves immutable history, and resolves current versus pinned pure/mixed definitions',
  publishIdentityRoster,
  120000,
)

const pairs = [
  'aetherist-shadehand',
  'chronist-edgedancer',
  'runeblade-vanguard',
  'cinderweaver-tidecaller',
]
it.each(
  legalRosterCycleKits.filter(
    (kit) => !kit.secondary || pairs.some((pair) => kit.name.startsWith(`resonance.${pair}.`)),
  ),
)(
  '$name admits an earned pure/mixed build with current extensions and unchanged Skills',
  async (kit) => {
    const duel = await createLegalRosterDuel({
      kit,
      level: 100,
      context: 'pvp',
      seed: 12345,
      prepareRoster: publishIdentityRoster,
      effectTimingPolicy: policy,
      modularSkillPolicyVersion: 1,
    })
    for (const participant of duel.participants) {
      for (const source of participant.sources) {
        const row =
          rows.find((row) => row.id === source.abilityId) ??
          baseline.find((row: { id: string }) => row.id === source.abilityId)
        expect(row, source.abilityId).toBeDefined()
        expect(source.contentVersion).toBe(row.after.contentVersion)
      }
      expect(
        participant.sources.some(
          (source) => source.sourceKind === (kit.secondary ? 'resonance' : 'essence'),
        ),
      ).toBe(true)
      expect(
        participant.sources.some(
          (source) => source.sourceKind === (kit.secondary ? 'essence' : 'resonance'),
        ),
      ).toBe(false)
    }
    const result = playLegalRosterDuel(duel, { maximumRounds: 2 })
    expect(result.errors).toEqual([])
    expect(result.commands.length).toBeGreaterThan(0)
  },
  30000,
)

it.each(['essence', 'resonance'] as const)(
  'denies non-operator %s publication without appending history',
  async (kind) => {
    await publishIdentityRoster()
    const row = rows.find((row) => row.kind === kind)!
    const before = await store.listPublishedVersions(row.id)
    const input = {
      actorUserId: '33333333-3333-4333-8333-333333333333',
      definition: row.after,
      expectedBaseVersion: row.beforeVersion,
    }
    await expect(
      kind === 'essence' ? service.publishEssence(input) : service.publishResonance(input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await store.listPublishedVersions(row.id)).toEqual(before)
  },
)
