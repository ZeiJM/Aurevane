import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import { applyAbilityTimingDefaults } from '@aurevane/game-core/combat/combat-definition'
import {
  CONTROLLED_COMBAT_TIMING_TAGS,
  parseStoredCombatEffectTimingPolicy,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { essenceCombatSkill, type EssenceDefinition } from '@aurevane/game-core/combat/essence'
import { resolveCombatContentCatalogueSnapshot } from '@/server/combat/combat-content-resolver'
import { validateCombatCatalogueTiming } from '@/server/combat/combat-catalogue-timing-compatibility'

vi.mock('server-only', () => ({}))

const manifestBytes = readFileSync(
  new URL(
    '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
    import.meta.url,
  ),
)
const manifest = JSON.parse(manifestBytes.toString()) as {
  requiredRecordCount: number
  records: {
    kind: 'skill' | 'essence' | 'resonance' | 'basic'
    id: string
    beforeVersion: number
    beforeDigest: string
    after: Record<string, unknown> & { contentVersion: number; enabled: boolean }
  }[]
}
// Captured by a read-only hosted transaction. These are historical settings, not a live query.
const observed = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/verification/2026-10-17-combat-catalogue-observation.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { policy: unknown }
const policy = parseStoredCombatEffectTimingPolicy(observed.policy)
const token = '0'.repeat(32) // Local resolver fixture; never a hosted catalogue/CAS token.
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  return value && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, sorted(v)]),
      )
    : value
}
function digest(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sorted(value)))
    .digest('hex')
}
const publications: CombatContentVersionRecord[] = manifest.records
  .filter((row) => row.kind !== 'basic')
  .map((row) => ({
    id: `local-proposal:${row.id}`,
    contentKey: row.id,
    contentKind: row.kind === 'basic' ? 'skill' : row.kind,
    contentVersion: row.after.contentVersion,
    definition: structuredClone(row.after),
    publishedBy: '11111111-1111-4111-8111-111111111111',
    publishedAt: '2026-10-17T11:04:17.539348Z',
  }))

it('reconciles every before identity, version and digest with the actual builtin catalogue', () => {
  const current = resolveCombatContentCatalogueSnapshot({ token, policy, publications: [] })
  expect(current.entries).toHaveLength(294)
  expect(manifest.requiredRecordCount).toBe(294)
  expect(manifest.records).toHaveLength(294)
  expect(new Set(manifest.records.map((row) => row.id)).size).toBe(294)
  expect(manifest.records.map((row) => row.id).sort()).toEqual(
    current.entries.map((entry) => entry.contentKey).sort(),
  )
  for (const row of manifest.records) {
    const before = current.entries.find((entry) => entry.contentKey === row.id)!
    expect(before.category, row.id).toBe(row.kind)
    expect(before.contentVersion, row.id).toBe(row.beforeVersion)
    expect(digest(before.definition), row.id).toBe(row.beforeDigest)
    expect(row.after.contentVersion, row.id).toBe(
      row.beforeVersion + (row.kind === 'basic' ? 0 : 1),
    )
  }
})

it('resolves the full proposed catalogue with captured hosted policy, preserving all definitions and five retained Basics', () => {
  const before = JSON.stringify({ manifest, publications, policy })
  const current = resolveCombatContentCatalogueSnapshot({ token, policy, publications })
  expect(publications).toHaveLength(289)
  expect(current.entries).toHaveLength(294)
  expect(
    current.entries.filter((entry) => entry.source === 'builtin').map((entry) => entry.category),
  ).toEqual(Array(5).fill('basic'))
  for (const row of manifest.records) {
    const entry = current.entries.find((entry) => entry.contentKey === row.id)!
    expect(entry.definition, row.id).toEqual(row.after)
    expect(entry.contentVersion, row.id).toBe(row.after.contentVersion)
    expect(entry.definition.enabled, row.id).toBe(true)
    expect(entry.source, row.id).toBe(row.kind === 'basic' ? 'builtin' : 'published')
  }
  expect(current.policy).toEqual(policy)
  expect(validateCombatCatalogueTiming(current)).toEqual([])
  expect(JSON.stringify({ manifest, publications, policy })).toBe(before)
  // October18 I1 repair: four unpublished defensive definitions only; baseline
  // identity/digests and all five retained Basics remain checked above.
  expect(createHash('sha256').update(manifestBytes).digest('hex')).toBe(
    '35bbb1f96c9ce4dc2a5e33c34bfb7ec809de865f3149746173717d2aadb1a23d',
  )
})

it.each(manifest.records.filter((row) => row.kind === 'essence'))(
  '$id uses battle-selected mechanics for every registered Controlled default',
  (row) => {
    const current = resolveCombatContentCatalogueSnapshot({ token, policy, publications })
    const entry = current.entries.find((entry) => entry.contentKey === row.id)!
    const definition = entry.definition as EssenceDefinition
    const before = JSON.stringify(entry)
    for (const tag of CONTROLLED_COMBAT_TIMING_TAGS) {
      const proposed = { version: policy.version, modes: { [tag]: 'controlled' as const } }
      const expected = essenceCombatSkill(definition).ability!.behaviors.flatMap((behavior) => {
        try {
          applyAbilityTimingDefaults(behavior, proposed)
          return []
        } catch {
          return [
            {
              contentKey: row.id,
              behaviorId: behavior.id,
              code: 'unsupported-controlled-behavior',
            },
          ]
        }
      })
      expect(
        validateCombatCatalogueTiming({ token, policy: proposed, entries: [entry] }),
        `${row.id}:${tag}`,
      ).toEqual(expected)
    }
    expect(JSON.stringify(entry)).toBe(before)
  },
)
