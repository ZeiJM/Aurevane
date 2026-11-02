import { readFileSync } from 'node:fs'
import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'

const proposal = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { records: { kind: string; id: string; beforeVersion: number; after: unknown }[] }

/** These tests replay the saved October proposal against its captured builtin
 * baseline, not today's publication floors, Briar Snare or retired Guard. */
export function proposalBasicModule(
  actual: typeof import('@aurevane/game-core/combat/combat-basic-actions'),
) {
  return {
    ...actual,
    defaultBasicSkills: () =>
      proposal.records
        .filter((row) => row.kind === 'basic')
        .map((row) => structuredClone(row.after) as BasicSkillDefinition),
  }
}
export function proposalMatureSkillModule(
  actual: typeof import('@aurevane/game-core/combat/mature-skills'),
) {
  const rows = proposal.records.filter((row) => row.kind === 'skill')
  const versions = new Map(rows.map((row) => [row.id, row.beforeVersion]))
  return {
    ...actual,
    resolveMatureSkillVersion: (id: string, version?: number) =>
      actual.resolveMatureSkillVersion(id, version ?? versions.get(id)),
    highestBuiltinMatureSkillVersion: (id: string) =>
      versions.get(id) ?? actual.highestBuiltinMatureSkillVersion(id),
    latestEnabledMatureSkills: (
      definitions?: Parameters<typeof actual.latestEnabledMatureSkills>[0],
    ) =>
      definitions
        ? actual.latestEnabledMatureSkills(definitions)
        : rows.map((row) => {
            const pinned = actual.resolveMatureSkillVersion(row.id, row.beforeVersion)
            if (!pinned) throw new Error(`Missing proposal baseline ${row.id}@${row.beforeVersion}`)
            return pinned
          }),
  }
}
