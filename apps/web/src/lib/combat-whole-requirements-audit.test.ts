import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import {
  validateAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import {
  currentEffectRequirementIssues,
  normalizeWholeAbilityRequirements,
} from './combat-whole-requirements'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const snapshotPath =
  'docs/verification/release-assets/2026-11-03-whole-requirements-live-audit.json'
const candidatePath =
  'docs/verification/release-assets/2026-11-03-whole-requirements-candidate.json'
const candidate = JSON.parse(readFileSync(join(root, candidatePath), 'utf8')) as {
  records: { id: string; before: unknown; after: { ability: AbilityDefinition } }[]
}

it('reproduces the complete actual-current correction candidate using the offline audit command', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'whole-requirements-'))
  try {
    const output = join(temporary, 'candidate.json')
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
          '--experimental-strip-types',
          'scripts/audit-whole-requirements.mjs',
          '--snapshot',
          snapshotPath,
          '--output',
          output,
        ],
        { cwd: root, encoding: 'utf8' },
      ),
    )
    expect(result).toMatchObject({
      scannedPublicationCount: 303,
      affectedCount: 13,
      candidateClean: true,
      published: false,
    })
    expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(candidate)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

it.each(candidate.records)(
  'guards prospective current $id against hidden requirements and invalid behavior metadata',
  (row) => {
    expect(currentEffectRequirementIssues(row.after)).toEqual([])
    expect(validateAbilityDefinition(row.after.ability)).toEqual([])
    expect(currentEffectRequirementIssues(row.before).length).toBeGreaterThan(0)
    expect(normalizeWholeAbilityRequirements(row.after).definition).toEqual(row.after)
  },
)

it('blocks ambiguous differing conditions and area affected-subject promotions instead of inventing AND or a selected unit', () => {
  const group = candidate.records[0]!.after.ability.behaviors[0]!
  for (const requirements of [
    [
      { kind: 'status-presence', subject: 'owner', statusId: 'wet', present: true },
      { kind: 'status-presence', subject: 'owner', statusId: 'burn', present: true },
    ],
    [{ kind: 'status-presence', subject: 'affected', statusId: 'wet', present: true }],
  ]) {
    const input = {
      id: 'custom.unreviewed',
      ability: {
        schemaVersion: 1,
        behaviors: [
          {
            ...group,
            requirements: null,
            effects: requirements.map((requirement, index) => ({
              id: `hit-${index}`,
              payload: { type: 'damage', recipient: 'affected-units', amount: 2 },
              requirements: requirement,
            })),
          },
        ],
      },
    }
    const before = JSON.stringify(input)
    const result = normalizeWholeAbilityRequirements(input)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.definition).toEqual(input)
    expect(JSON.stringify(input)).toBe(before)
  }
})

it('makes the current-definition audit fail while hidden conditions exist and pass for the corrected current export', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'whole-requirements-current-'))
  try {
    const before = spawnSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        '--experimental-strip-types',
        'scripts/audit-whole-requirements.mjs',
        '--snapshot',
        snapshotPath,
        '--check-current',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    expect(before.status).toBe(1)
    expect(JSON.parse(before.stdout).affectedCount).toBe(13)
    const corrected = join(temporary, 'current.json')
    writeFileSync(
      corrected,
      JSON.stringify({
        publications: candidate.records.map((row) => ({
          content_key: row.id,
          definition: row.after,
        })),
      }),
    )
    const after = spawnSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        '--experimental-strip-types',
        'scripts/audit-whole-requirements.mjs',
        '--snapshot',
        corrected,
        '--check-current',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    expect(after.status).toBe(0)
    expect(JSON.parse(after.stdout).affectedCount).toBe(0)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

it('blocks a compound same-effect status gate without discarding its other legitimate predicate', () => {
  const group = candidate.records[0]!.after.ability.behaviors[0]!
  const input = {
    id: 'custom.compound',
    ability: {
      schemaVersion: 1,
      behaviors: [
        {
          ...group,
          requirements: null,
          effects: [
            {
              id: 'bleed',
              payload: {
                type: 'bleed',
                recipient: 'primary-unit',
                ticks: 3,
                damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
              },
              requirements: {
                kind: 'all',
                children: [
                  {
                    kind: 'status-presence',
                    subject: 'selected',
                    statusId: 'bleed',
                    present: true,
                  },
                  {
                    kind: 'resource-state',
                    subject: 'owner',
                    resource: 'hp',
                    comparison: 'less-than',
                    basisPoints: 5000,
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  }
  const result = normalizeWholeAbilityRequirements(input)
  expect(result.definition).toEqual(input)
  expect(result.issues).toHaveLength(1)
})
