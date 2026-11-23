/** Offline audit/candidate preparation only. Never connects to a database or publishes. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  normalizeWholeAbilityRequirements,
  currentEffectRequirementIssues,
} from '../apps/web/src/lib/combat-whole-requirements.ts'

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}
const snapshotPath = option('--snapshot')
if (!snapshotPath)
  throw new Error('Provide --snapshot with a fresh read-only current catalogue export.')
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'))
const rows = snapshot.publications ?? snapshot.affected
if (!Array.isArray(rows))
  throw new Error('Expected current publication rows or the bounded SQL affected-record audit.')
const canonical = (value) =>
  JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)),
        )
      : entry,
  )
const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex')
const records = []
for (const row of rows) {
  const before = row.definition
  const issues = currentEffectRequirementIssues(before)
  if (!issues.length) continue
  const key = row.content_key ?? row.contentKey
  if (!key || (before?.id ?? before?.essenceId) !== key)
    throw new Error('A complete stable current identity is required.')
  const normalized = normalizeWholeAbilityRequirements(before)
  if (normalized.issues.length)
    throw new Error(
      `Unreviewed conditions remain for ${key}: ${normalized.issues.map((issue) => issue.path).join(', ')}`,
    )
  const beforeVersion = row.content_version ?? row.contentVersion
  if (!Number.isSafeInteger(beforeVersion) || before.contentVersion !== beforeVersion)
    throw new Error(`Invalid current version: ${key}`)
  const afterVersion =
    Math.max(
      beforeVersion,
      row.highest_version ?? beforeVersion,
      row.version_floor ?? beforeVersion,
    ) + 1
  const after = { ...normalized.definition, contentVersion: afterVersion }
  if (
    (row.content_kind ?? row.contentKind) === 'essence' &&
    after.skill?.contentVersion !== undefined
  )
    after.skill = { ...after.skill, contentVersion: afterVersion }
  records.push({
    id: key,
    kind: row.content_kind ?? row.contentKind,
    beforeVersion,
    afterVersion,
    baseline: {
      revision: row.revision ?? null,
      highestVersion: row.highest_version ?? null,
      versionFloor: row.version_floor ?? null,
      hasDraft: row.has_draft ?? null,
    },
    beforeDigest: digest(before),
    afterDigest: digest(after),
    corrections: normalized.corrections,
    before,
    after,
  })
}
const candidate = {
  schemaVersion: 1,
  status: 'prospective-not-published',
  sourceReadAt: snapshot.read_at ?? null,
  sourceCatalogueToken: snapshot.catalogue_token ?? null,
  scannedPublicationCount: snapshot.publication_count ?? rows.length,
  snapshotScope: snapshot.publications
    ? 'complete-current-export'
    : 'all-current-publications-scanned-in-SQL-only-affected-bodies-exported',
  records,
}
if (option('--output')) writeFileSync(option('--output'), JSON.stringify(candidate, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    sourceReadAt: candidate.sourceReadAt,
    scannedPublicationCount: candidate.scannedPublicationCount,
    affectedCount: records.length,
    affectedKeys: records.map((row) => row.id),
    candidateClean: true,
    published: false,
  }) + '\n',
)
if (args.includes('--check-current') && records.length) process.exitCode = 1
