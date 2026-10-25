// Discovery only: no browser/server/database is started and no gameplay assertion is changed.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { classifyChanges, specInventory } from './verification-plan.mjs'
import { browserCommands } from './run-browser-verification.mjs'

const baseline = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(baseline ?? ''))
  throw new Error('Pass the immutable pre-change commit SHA')
const old = execFileSync('git', ['show', `${baseline}:.github/workflows/browser-smoke.yml`], {
  encoding: 'utf8',
})
const focused = old.slice(
  old.indexOf('# Catch shared battle composition'),
  old.indexOf('# Preserve the shared rail/map screenshots'),
)
assert.ok(
  focused.includes('--project=desktop-chromium --project=mobile-chromium'),
  'Baseline focused phase missing',
)
const focusedFiles = [...new Set(focused.match(/e2e\/[\w-]+\.pw\.ts/g))]
function discover(args) {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@aurevane/web',
      'exec',
      'playwright',
      'test',
      ...args,
      '--list',
      '--reporter=json',
    ],
    { encoding: 'utf8', shell: false, maxBuffer: 30 * 1024 * 1024 },
  )
  if (result.status !== 0) throw new Error(`Collection failed: ${result.stderr.slice(-1000)}`)
  const report = JSON.parse(result.stdout)
  assert.deepEqual(report.errors, [])
  function rows(suite) {
    return [
      ...(suite.specs ?? []).flatMap((spec) =>
        spec.tests.map((test) => ({
          file: spec.file,
          line: spec.line,
          title: spec.title,
          project: test.projectName,
        })),
      ),
      ...(suite.suites ?? []).flatMap(rows),
    ]
  }
  return report.suites.flatMap(rows)
}
const full = discover([]),
  key = (row) => JSON.stringify(row),
  fullIds = new Set(full.map(key))
const duplicates = [
  {
    phase: 'Old focused battle phase',
    args: [...focusedFiles, '--project=desktop-chromium', '--project=mobile-chromium'],
  },
  {
    phase: 'Old password and training phases',
    args: ['e2e/password-reset.pw.ts', 'e2e/battle-experience.pw.ts'],
  },
].map((phase) => {
  const rows = discover(phase.args)
  assert.ok(rows.length > 0)
  assert.ok(
    rows.every((row) => fullIds.has(key(row))),
    'A preliminary case/project is not in the full suite',
  )
  return {
    phase: phase.phase,
    alreadyInFull: rows.length,
    projects: [...new Set(rows.map((r) => r.project))],
  }
})
const examples = {
  documentation: 'docs/COMBAT.md',
  artwork: 'apps/web/public/media/skills/defenseless.webp',
  audio: 'apps/web/src/components/audio/audio-workspace.module.css',
  battle: 'apps/web/src/components/battle/battle-mobile-layout.module.css',
  shared: 'apps/web/src/app/globals.css',
}
const selections = []
for (const [name, path] of Object.entries(examples)) {
  const plan = {
    schemaVersion: 1,
    execute: true,
    ...classifyChanges([{ status: 'M', path }], specInventory()),
  }
  if (plan.scope === 'none') {
    selections.push({ name, mode: plan.scope, cases: 0 })
    continue
  }
  const native = browserCommands(plan).find((c) => c.name.includes('Chromium'))
  const rows = plan.scope === 'full' ? full : discover(native.args.slice(5))
  assert.ok(rows.length > 0 && rows.every((row) => fullIds.has(key(row))))
  assert.deepEqual([...new Set(rows.map((row) => row.project))].sort(), [
    'desktop-chromium',
    'laptop-chromium',
    'mobile-chromium',
  ])
  selections.push({
    name,
    mode: plan.scope,
    cases: rows.length,
    files: plan.nativeFiles.length,
    edge: plan.edge,
    components: plan.battle,
  })
}
const result = {
  baseline,
  fullCases: full.length,
  duplicates,
  selections,
  assertions:
    'Every removed preliminary case/project is retained in the full suite; selected cases retain their existing projects.',
}
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
