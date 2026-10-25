import assert from 'node:assert/strict'
import { test } from 'node:test'
import { browserCommands, preserveEvidence } from './run-browser-verification.mjs'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyChanges, CORE_SPECS } from './verification-plan.mjs'

const inventory = [
  ...CORE_SPECS,
  'battle-log-inline-reader.pw.ts',
  'character-secondary-build.pw.ts',
  'audio-workspace.pw.ts',
  'atlas-world.pw.ts',
]
function plan(paths, full = false) {
  return {
    schemaVersion: 1,
    execute: true,
    ...classifyChanges(
      paths.map((path) => ({ path, status: 'M' })),
      inventory,
      full,
    ),
  }
}
test('a local Audio plan runs core and Audio once across the original three projects without full/Edge', () => {
  const commands = browserCommands(plan(['apps/web/src/components/audio/audio-workspace.tsx']))
  assert.equal(commands.length, 1)
  assert.deepEqual(commands[0].files, [...CORE_SPECS, 'audio-workspace.pw.ts'].sort())
  assert.equal(
    commands[0].args.includes('--project=desktop-chromium'),
    false,
    'Default config retains all three projects',
  )
  assert.equal(commands[0].args.includes('--grep'), false)
  assert.equal(commands[0].args.includes('--retries'), false)
})
test('battle keeps original Edge keyboard cases without rerunning the focused Chromium subset', () => {
  const commands = browserCommands(plan(['apps/web/src/components/battle/battle-experience.tsx']))
  assert.equal(commands.length, 2)
  assert.equal(commands[0].files.includes('battle-log-inline-reader.pw.ts'), true)
  assert.equal(commands[0].files.includes('atlas-world.pw.ts'), false)
  assert.equal(new Set(commands[0].files).size, commands[0].files.length)
  assert.equal(commands[1].args.includes('--config=playwright.edge.config.ts'), true)
  assert.deepEqual(commands[1].files, [
    'battle-self-action-quick-commit.pw.ts',
    'battle-recovery-hotkey.pw.ts',
    'battle-support-action.pw.ts',
    'techniques-support-action.pw.ts',
  ])
})
test('full mode retains all default specs, repeat-two authoring authority and Edge coverage', () => {
  const commands = browserCommands(plan(['pnpm-lock.yaml']))
  assert.equal(commands.length, 3)
  assert.deepEqual(commands[0].files, [
    'master-complete-layout.pw.ts',
    'master-world-environment-cadence.pw.ts',
    'master-combat-content-authoring.pw.ts',
    'staff-selected-character-access.pw.ts',
    'master-players-recovery.pw.ts',
    'battle-wasd-backtracking.pw.ts',
  ])
  assert.equal(commands[0].args.includes('--repeat-each=2'), true)
  assert.equal(commands[0].args.includes('--project=desktop-chromium'), true)
  assert.deepEqual(
    commands[1].files,
    [],
    'Unfiltered full config includes every current and future specification',
  )
  assert.equal(commands[2].args.includes('--config=playwright.edge.config.ts'), true)
})
test('invalid/empty/missing-core selected plans fail instead of green no-tests invocations', () => {
  for (const p of [
    null,
    {},
    { schemaVersion: 1, execute: true, scope: 'none' },
    { schemaVersion: 1, execute: true, scope: 'targeted', nativeFiles: [] },
  ])
    assert.throws(() => browserCommands(p))
  const p = plan(['apps/web/src/components/audio/audio-workspace.tsx'])
  p.nativeFiles.push('../outside.pw.ts')
  assert.throws(() => browserCommands(p))
})
test('filename metacharacters are escaped as literal Playwright selectors and remain argv data', () => {
  const p = plan(['apps/web/src/components/audio/audio-workspace.tsx'])
  p.nativeFiles.push('audio-$(touch injected)[x].pw.ts')
  const command = browserCommands(p)[0]
  assert.equal(command.args.includes('e2e/audio-\\$\\(touch injected\\)\\[x\\]\\.pw\\.ts'), true)
  assert.equal(command.command, 'pnpm')
})
test('authority and rail captures survive the next invocation clearing its original output', () => {
  const root = mkdtempSync(join(tmpdir(), 'verification-evidence-'))
  const results = join(root, 'results'),
    authority = join(root, 'authority'),
    rails = join(root, 'rails')
  try {
    mkdirSync(join(results, 'master-case'), { recursive: true })
    writeFileSync(join(results, 'master-case', 'master-proof.png'), 'authority image')
    writeFileSync(join(results, 'master-case', 'unrelated.txt'), 'not selected')
    mkdirSync(join(results, 'pvp-map-sizes-phone'), { recursive: true })
    writeFileSync(join(results, 'pvp-map-sizes-phone', 'board.png'), 'rail image')
    preserveEvidence(results, authority, rails)
    rmSync(results, { recursive: true })
    assert.equal(readFileSync(join(authority, 'master-proof.png'), 'utf8'), 'authority image')
    assert.equal(
      readFileSync(join(rails, 'pvp-map-sizes-phone', 'board.png'), 'utf8'),
      'rail image',
    )
    assert.equal(existsSync(join(authority, 'unrelated.txt')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Master zoom and natural World evidence retain JSON, traces and screenshots from both native phases', () => {
  const root = mkdtempSync(join(tmpdir(), 'verification-master-evidence-'))
  const results = join(root, 'results'),
    master = join(root, 'master')
  try {
    for (const phase of ['authority', 'full']) {
      for (const spec of [
        'master-complete-layout-desktop',
        'master-world-environment-cadence-desktop',
      ]) {
        const directory = join(results, spec, 'attachments')
        mkdirSync(directory, { recursive: true })
        for (const name of ['metrics.json', 'trace.zip', 'master-state.png'])
          writeFileSync(join(directory, name), `${phase}:${spec}:${name}`)
      }
      preserveEvidence(results, join(root, 'authority'), join(root, 'rails'), master, phase)
      rmSync(results, { recursive: true })
    }
    for (const phase of ['authority', 'full'])
      for (const spec of [
        'master-complete-layout-desktop',
        'master-world-environment-cadence-desktop',
      ])
        for (const name of ['metrics.json', 'trace.zip', 'master-state.png'])
          assert.equal(
            readFileSync(join(master, phase, spec, 'attachments', name), 'utf8'),
            `${phase}:${spec}:${name}`,
          )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
