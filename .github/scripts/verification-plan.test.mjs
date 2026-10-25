import assert from 'node:assert/strict'
import * as planner from './verification-plan.mjs'
import { test } from 'node:test'
import {
  classifyChanges,
  mergedRunProof,
  gateResult,
  findReuseProof,
  eventPlan,
  changedFiles,
} from './verification-plan.mjs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const specs = [
  'account-entry.pw.ts',
  'loadout-navigation.pw.ts',
  'battle-move-preview-polish.pw.ts',
  'ci-changed-assets.pw.ts',
  'battle-log-inline-reader.pw.ts',
  'pvp-mobile-unified-battle.pw.ts',
  'character-secondary-build.pw.ts',
  'audio-workspace.pw.ts',
  'manual-index-layout-regression.pw.ts',
  'atlas-world.pw.ts',
  'master-combat-content-authoring.pw.ts',
]
const changes = (...paths) => paths.map((path) => ({ status: 'M', path }))
test('documentation resolves without application suites, including nested agent guidance', () => {
  const p = classifyChanges(
    changes('docs/COMBAT.md', 'AGENTS.md', 'apps/web/src/components/battle/AGENTS.md'),
    specs,
  )
  assert.equal(p.scope, 'none')
  assert.deepEqual(p.nativeFiles, [])
})
test('isolated Audio retains core entry/session/navigation/legal command plus Audio, not World or Master', () => {
  const p = classifyChanges(
    changes('apps/web/src/components/audio/audio-workspace.module.css'),
    specs,
  )
  assert.equal(p.scope, 'targeted')
  assert.deepEqual(p.nativeFiles, [
    'account-entry.pw.ts',
    'audio-workspace.pw.ts',
    'battle-move-preview-polish.pw.ts',
    'ci-changed-assets.pw.ts',
    'loadout-navigation.pw.ts',
  ])
  assert.equal(p.battle, false)
  assert.equal(p.edge, false)
})
test('battle and character presentation union their cases, all projects, component and Edge protection', () => {
  const p = classifyChanges(
    changes(
      'apps/web/src/components/battle/battle-mobile-layout.module.css',
      'apps/web/src/components/character/character-skill-build-panel.tsx',
    ),
    specs,
  )
  assert.equal(p.scope, 'targeted')
  assert.deepEqual(p.nativeFiles, [
    'account-entry.pw.ts',
    'battle-log-inline-reader.pw.ts',
    'battle-move-preview-polish.pw.ts',
    'character-secondary-build.pw.ts',
    'ci-changed-assets.pw.ts',
    'loadout-navigation.pw.ts',
    'pvp-mobile-unified-battle.pw.ts',
  ])
  assert.equal(p.battle, true)
  assert.equal(p.edge, true)
})
test('Skill raster artwork keeps real decoding and core without unrelated gameplay', () => {
  const p = classifyChanges(changes('apps/web/public/media/skills/defenseless.webp'), specs)
  assert.equal(p.scope, 'targeted')
  assert.deepEqual(p.assets, ['/media/skills/defenseless.webp'])
  assert.equal(p.nativeFiles.includes('ci-changed-assets.pw.ts'), true)
  assert.equal(p.nativeFiles.includes('atlas-world.pw.ts'), false)
})
for (const path of [
  'apps/web/src/app/globals.css',
  'apps/web/src/components/shell/account-menu.tsx',
  'apps/web/src/components/character/character-presence-heartbeat.tsx',
  'apps/web/src/components/character/character-identity-card.tsx',
  'apps/web/src/components/character/character-portrait-image.tsx',
  'apps/web/src/components/character/skill-effect-timing-context.tsx',
  'apps/web/src/components/character/skill-details.tsx',
  'apps/web/src/components/character/skill-detail-presentation.ts',
  'apps/web/src/components/public-information/options.toml',
  'apps/web/src/app/manual/config.json',
  'apps/web/src/app/manual/route.ts',
  'apps/web/src/components/battle/battle-return-navigation.ts',
  'apps/web/src/components/battle/pvp-battle-key-input-assist.tsx',
  'apps/web/src/server/battle/battle-session-service.ts',
  'apps/web/src/server/auth/session.ts',
  'apps/web/src/components/world/map-renderer.ts',
  'packages/game-core/src/combat/actions.ts',
  'supabase/migrations/new.sql',
  'pnpm-lock.yaml',
  'apps/web/next.config.ts',
  '.github/workflows/browser-smoke.yml',
  '.github/actions/verification-plan/action.yml',
  'apps/web/vercel.json',
  'apps/web/src/new-unknown-feature.ts',
])
  test(`shared, sensitive or unknown ${path} requires full coverage`, () => {
    const p = classifyChanges(changes(path), specs)
    assert.equal(p.scope, 'full')
    assert.deepEqual(p.nativeFiles, [...specs].sort())
    assert.equal(p.battle, true)
    assert.equal(p.edge, true)
  })
test('an unrelated multi-system batch and mixed documentation/code cannot narrow coverage', () => {
  assert.equal(
    classifyChanges(
      changes(
        'apps/web/src/components/audio/audio-workspace.tsx',
        'apps/web/src/components/battle/battle-experience.tsx',
      ),
      specs,
    ).scope,
    'full',
  )
  assert.equal(
    classifyChanges(changes('README.md', 'packages/db/src/index.ts'), specs).scope,
    'full',
  )
})
test('renames/deletions/type changes, unavailable diffs and manual full requests broaden coverage', () => {
  for (const status of ['D', 'T'])
    assert.equal(
      classifyChanges([{ status, path: 'apps/web/public/media/skills/old.webp' }], specs).scope,
      'full',
    )
  assert.equal(
    classifyChanges(
      [
        { status: 'D', path: 'docs/old.md' },
        { status: 'A', path: 'docs/new.md' },
      ],
      specs,
    ).scope,
    'none',
  )
  assert.equal(classifyChanges(null, specs).scope, 'full')
  assert.equal(classifyChanges([], specs).scope, 'full')
  assert.equal(classifyChanges(changes('README.md'), specs, true).scope, 'full')
})
test('new executable paths and unknown file types in feature folders require full coverage', () => {
  for (const path of [
    'apps/web/src/components/battle/new-system.tsx',
    'apps/web/scripts/battle-deploy.mjs',
  ])
    assert.equal(classifyChanges([{ status: 'A', path }], specs).scope, 'full')
  assert.equal(
    classifyChanges(changes('apps/web/src/components/battle/options.toml'), specs).scope,
    'full',
  )
})
test('missing essential specs and malformed paths fail instead of green empty selections', () => {
  assert.throws(() =>
    classifyChanges(
      changes('apps/web/src/components/audio/audio-workspace.tsx'),
      specs.filter((s) => s !== 'account-entry.pw.ts'),
    ),
  )
  for (const path of ['/tmp/file', '../README.md', 'docs/../apps/web/file', 'docs/a\nfile.md'])
    assert.throws(() => classifyChanges(changes(path), specs))
})

const sha = 'a'.repeat(40),
  head = 'b'.repeat(40),
  tree = 'c'.repeat(40)
const now = Date.parse('2026-10-25T12:00:00Z')
const good = () => ({
  sha,
  workflow: 'browser-smoke.yml',
  now,
  commit: { sha, commit: { tree: { sha: tree } } },
  pr: {
    number: 976,
    merged: true,
    state: 'closed',
    merge_commit_sha: sha,
    base: { ref: 'main', repo: { full_name: 'ZeiJM/Aurevane' } },
    head: { sha: head },
  },
  headCommit: { sha: head, commit: { tree: { sha: tree } } },
  tested: {
    schemaVersion: 1,
    repository: 'ZeiJM/Aurevane',
    prNumber: 976,
    workflow: 'browser-smoke.yml',
    headSha: head,
    checkoutSha: 'e'.repeat(40),
    treeSha: tree,
    runId: 100,
    runAttempt: 1,
  },
  runs: [
    {
      id: 100,
      run_attempt: 1,
      event: 'pull_request',
      head_sha: head,
      path: '.github/workflows/browser-smoke.yml',
      status: 'completed',
      conclusion: 'success',
      updated_at: '2026-10-25T11:50:00Z',
    },
  ],
})
test('only an actual merged PR with identical tested tree and fresh exact workflow success can be reused', () => {
  assert.deepEqual(mergedRunProof(good()), {
    prNumber: 976,
    mergeSha: sha,
    headSha: head,
    treeSha: tree,
    runId: 100,
    runAttempt: 1,
    testedCheckoutSha: 'e'.repeat(40),
    workflow: 'browser-smoke.yml',
  })
})
test('later failure, cancelled or queued attempts invalidate an older success', () => {
  for (const conclusion of ['failure', 'cancelled', null]) {
    const p = good()
    p.runs.push({
      ...p.runs[0],
      id: 101,
      conclusion,
      status: conclusion ? 'completed' : 'in_progress',
    })
    assert.equal(mergedRunProof(p), null)
  }
})
test('a failed rerun of an older run ID is newer evidence than a later-created successful run', () => {
  const p = good()
  p.runs.push({ ...p.runs[0], id: 99, conclusion: 'failure', updated_at: '2026-10-25T11:55:00Z' })
  assert.equal(mergedRunProof(p), null)
})
test('wrong source, merge association, tree, workflow, event, age or missing API fields cannot authorize reuse', () => {
  const mutations = [
    (p) => {
      p.pr.merged = false
    },
    (p) => {
      p.pr.state = 'open'
    },
    (p) => {
      p.pr.base.ref = 'other'
    },
    (p) => {
      p.pr.merge_commit_sha = head
    },
    (p) => {
      p.commit.sha = head
    },
    (p) => {
      p.headCommit.sha = sha
    },
    (p) => {
      p.headCommit.commit.tree.sha = 'd'.repeat(40)
    },
    (p) => {
      p.runs[0].head_sha = sha
    },
    (p) => {
      p.runs[0].path = '.github/workflows/ci.yml'
    },
    (p) => {
      p.runs[0].event = 'push'
    },
    (p) => {
      p.runs[0].updated_at = '2026-10-23T11:00:00Z'
    },
    (p) => {
      p.runs[0].updated_at = 'invalid'
    },
    (p) => {
      p.runs[0].updated_at = '2026-10-26T11:00:00Z'
    },
    (p) => {
      p.runs = []
    },
    (p) => {
      delete p.pr.head
    },
    (p) => {
      delete p.commit.commit.tree
    },
    (p) => {
      p.runs[0].id = null
    },
  ]
  for (const change of mutations) {
    const p = good()
    change(p)
    assert.equal(mergedRunProof(p), null)
  }
})
test('required result fails for planner failure or skipped/failed/cancelled selected execution', () => {
  const plan = { schemaVersion: 1, execute: true, scope: 'targeted' }
  assert.equal(gateResult('success', plan, ['success']), true)
  assert.equal(gateResult('failure', plan, ['skipped']), false)
  for (const result of ['skipped', 'failure', 'cancelled', undefined])
    assert.equal(gateResult('success', plan, [result]), false)
  assert.equal(gateResult('success', plan, ['success', 'failure']), false)
})
test('intentional no-work requires a valid docs plan or an explicit matching reuse proof', () => {
  assert.equal(
    gateResult(
      'success',
      { schemaVersion: 1, execute: false, scope: 'none', reason: 'documentation-only' },
      ['skipped'],
    ),
    true,
  )
  assert.equal(
    gateResult('success', { schemaVersion: 1, execute: false, scope: 'full' }, ['skipped']),
    false,
  )
  assert.equal(
    gateResult(
      'success',
      {
        schemaVersion: 1,
        execute: false,
        scope: 'reuse',
        checkoutSha: sha,
        treeSha: tree,
        proof: mergedRunProof(good()),
      },
      ['skipped'],
    ),
    true,
  )
  assert.equal(
    gateResult('success', { schemaVersion: 1, execute: false, scope: 'reuse' }, ['skipped']),
    false,
  )
  assert.equal(gateResult('success', null, ['skipped']), false)
  assert.equal(
    gateResult('success', { schemaVersion: 2, execute: false, scope: 'none' }, ['skipped']),
    false,
  )
})
test('a reuse proof for another tree or commit cannot satisfy the required gate', () => {
  const p = {
    schemaVersion: 1,
    execute: false,
    scope: 'reuse',
    checkoutSha: sha,
    treeSha: tree,
    proof: mergedRunProof(good()),
  }
  assert.equal(gateResult('success', { ...p, treeSha: 'd'.repeat(40) }, ['skipped']), false)
  assert.equal(gateResult('success', { ...p, checkoutSha: 'd'.repeat(40) }, ['skipped']), false)
})
test('read API failure, missing association, truncated results and changed trees run the full main gate', async () => {
  const input = {
    eventName: 'push',
    event: { ref: 'refs/heads/main' },
    sha,
    treeSha: tree,
    workflow: 'browser-smoke.yml',
    repository: 'ZeiJM/Aurevane',
    specs,
    changes: changes('README.md'),
  }
  for (const api of [
    async () => {
      throw new Error('rate limited')
    },
    async (path) => (path.includes('/pulls?') ? [] : good().commit),
  ]) {
    const plan = await eventPlan({ ...input, api })
    assert.equal(plan.execute, true)
    assert.equal(plan.scope, 'full')
  }
  const p = good()
  p.pr.base.repo = { full_name: 'ZeiJM/Aurevane' }
  p.runs[0].updated_at = new Date().toISOString()
  const api = async (path) =>
    path === `/commits/${sha}`
      ? p.commit
      : path.includes('/pulls?')
        ? [{ number: 976 }]
        : path === '/pulls/976'
          ? p.pr
          : path === `/commits/${head}`
            ? p.headCommit
            : path.includes('/artifacts?')
              ? {
                  total_count: 1,
                  artifacts: [
                    {
                      id: 9,
                      name: 'verification-proof-browser-smoke.yml-100-1',
                      size_in_bytes: 500,
                      expired: false,
                    },
                  ],
                }
              : path.endsWith('/zip')
                ? proofArchive(p.tested)
                : { total_count: p.runs.length, workflow_runs: p.runs }
  assert.equal((await eventPlan({ ...input, api })).scope, 'reuse')
  p.headCommit.commit.tree.sha = 'd'.repeat(40)
  assert.equal((await eventPlan({ ...input, api })).scope, 'full')
  assert.equal(
    await findReuseProof({
      sha,
      workflow: 'browser-smoke.yml',
      repository: 'ZeiJM/Aurevane',
      api: async () => ({}),
    }),
    null,
  )
})
test('PR labels can only broaden; manual dispatch and uncertain comparisons cannot select empty coverage', async () => {
  const input = {
    eventName: 'pull_request',
    event: { pull_request: { labels: [] } },
    sha,
    treeSha: tree,
    workflow: 'browser-smoke.yml',
    specs,
    changes: changes('apps/web/src/components/audio/audio-workspace.tsx'),
  }
  assert.equal((await eventPlan(input)).scope, 'targeted')
  assert.equal(
    (await eventPlan({ ...input, event: { pull_request: { labels: [{ name: 'ci:full' }] } } }))
      .scope,
    'full',
  )
  assert.equal((await eventPlan({ ...input, eventName: 'workflow_dispatch' })).scope, 'full')
  assert.equal((await eventPlan({ ...input, changes: null })).scope, 'full')
})
test('the real Git comparison includes deleted and renamed paths and handles unknown ancestors conservatively', () => {
  const root = mkdtempSync(join(tmpdir(), 'verification-git-')),
    previous = process.cwd()
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  try {
    git('init', '--initial-branch=main')
    mkdirSync(join(root, 'docs'))
    writeFileSync(join(root, 'docs', 'old.md'), 'old\n')
    writeFileSync(join(root, 'old.ts'), 'export {}\n')
    git('add', '.')
    git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-m', 'base')
    const base = git('rev-parse', 'HEAD')
    renameSync(join(root, 'docs', 'old.md'), join(root, 'docs', 'new.md'))
    renameSync(join(root, 'old.ts'), join(root, 'new.ts'))
    git('add', '-A')
    git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-m', 'rename')
    const next = git('rev-parse', 'HEAD')
    process.chdir(root)
    assert.deepEqual(changedFiles(base, next), [
      { status: 'A', path: 'docs/new.md' },
      { status: 'D', path: 'docs/old.md' },
      { status: 'A', path: 'new.ts' },
      { status: 'D', path: 'old.ts' },
    ])
    assert.equal(changedFiles('0'.repeat(40), next), null)
  } finally {
    process.chdir(previous)
    rmSync(root, { recursive: true, force: true })
  }
})

// Final review regressions: actual successful checkout evidence and complete API pages.
test('the exact successful attempt must prove its synthetic checkout tree and PR identity', () => {
  for (const mutate of [
    (p) => {
      delete p.tested
    },
    (p) => {
      p.tested.treeSha = 'd'.repeat(40)
    },
    (p) => {
      p.tested.prNumber = 979
    },
    (p) => {
      p.tested.headSha = sha
    },
    (p) => {
      p.tested.workflow = 'ci.yml'
    },
    (p) => {
      p.tested.repository = 'other/repository'
    },
    (p) => {
      p.tested.runId = 99
    },
    (p) => {
      p.tested.runAttempt = 2
    },
    (p) => {
      p.tested.checkoutSha = 'not-a-sha'
    },
  ]) {
    const p = good()
    mutate(p)
    assert.equal(mergedRunProof(p), null)
  }
})
test('missing, invalid or inconsistent API totals cannot authorize reuse', async () => {
  for (const count of [undefined, -1, '1', 2, 100]) {
    const p = good()
    p.pr.base.repo = { full_name: 'ZeiJM/Aurevane' }
    const api = async (path) =>
      path === `/commits/${sha}`
        ? p.commit
        : path.includes('/pulls?')
          ? [{ number: 976 }]
          : path === '/pulls/976'
            ? p.pr
            : path === `/commits/${head}`
              ? p.headCommit
              : { total_count: count, workflow_runs: p.runs }
    assert.equal(
      await findReuseProof({
        sha,
        workflow: 'browser-smoke.yml',
        repository: 'ZeiJM/Aurevane',
        api,
        now,
      }),
      null,
    )
  }
})

function proofArchive(receipt, filename = 'verification-proof.json') {
  const root = mkdtempSync(join(tmpdir(), 'verification-archive-'))
  try {
    writeFileSync(join(root, filename), JSON.stringify(receipt))
    execFileSync('zip', ['-q', 'proof.zip', filename], { cwd: root })
    return readFileSync(join(root, 'proof.zip'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
test('a bounded real ZIP receipt is read without extracting entries to the worktree', () => {
  assert.deepEqual(planner.readProofArchive(proofArchive(good().tested)), good().tested)
  assert.throws(() => planner.readProofArchive(proofArchive(good().tested, 'other.json')))
  assert.throws(() => planner.readProofArchive(proofArchive({ large: 'x'.repeat(100000) })))
  assert.throws(() => planner.readProofArchive(new Uint8Array(70000)))
  assert.throws(() => planner.readProofArchive(new Uint8Array([1, 2, 3])))
})
test('the receipt records the actual checked-out tree, exact PR, workflow and attempt', () => {
  const p = good(),
    plan = { schemaVersion: 1, checkoutSha: p.tested.checkoutSha, treeSha: tree }
  const input = {
    plan,
    event: { pull_request: { number: 976, head: { sha: head } } },
    repository: 'ZeiJM/Aurevane',
    workflow: 'browser-smoke.yml',
    runId: '100',
    runAttempt: '1',
  }
  assert.deepEqual(planner.verificationReceipt(input), p.tested)
  assert.throws(() => planner.verificationReceipt({ ...input, runAttempt: '0' }))
  assert.throws(() => planner.verificationReceipt({ ...input, event: {} }))
  assert.throws(() =>
    planner.verificationReceipt({ ...input, plan: { ...plan, treeSha: 'unknown' } }),
  )
})

test('missing, stale, corrupt or mismatched attempt receipts force full execution through the API adapter', async () => {
  const p = good(),
    artifact = {
      id: 9,
      name: 'verification-proof-browser-smoke.yml-100-1',
      size_in_bytes: 500,
      expired: false,
    }
  const lookup = (artifacts, archive) => async (path) =>
    path === `/commits/${sha}`
      ? p.commit
      : path.includes('/pulls?')
        ? [{ number: 976 }]
        : path === '/pulls/976'
          ? p.pr
          : path === `/commits/${head}`
            ? p.headCommit
            : path.includes('/artifacts?')
              ? artifacts
              : path.endsWith('/zip')
                ? archive
                : { total_count: 1, workflow_runs: p.runs }
  for (const [artifacts, archive] of [
    [{ total_count: 0, artifacts: [] }, proofArchive(p.tested)],
    [{ total_count: 2, artifacts: [artifact] }, proofArchive(p.tested)],
    [{ artifacts: [artifact] }, proofArchive(p.tested)],
    [{ total_count: 1, artifacts: [{ ...artifact, expired: true }] }, proofArchive(p.tested)],
    [
      {
        total_count: 1,
        artifacts: [{ ...artifact, name: 'verification-proof-browser-smoke.yml-100-2' }],
      },
      proofArchive(p.tested),
    ],
    [
      { total_count: 1, artifacts: [artifact] },
      proofArchive({ ...p.tested, treeSha: 'd'.repeat(40) }),
    ],
    [{ total_count: 1, artifacts: [artifact] }, proofArchive({ ...p.tested, prNumber: 979 })],
    [{ total_count: 1, artifacts: [artifact] }, proofArchive({ ...p.tested, runAttempt: 2 })],
    [{ total_count: 1, artifacts: [artifact] }, new Uint8Array([1, 2, 3])],
  ])
    assert.equal(
      await findReuseProof({
        sha,
        workflow: 'browser-smoke.yml',
        repository: 'ZeiJM/Aurevane',
        now,
        api: lookup(artifacts, archive),
      }),
      null,
    )
})
test('the real final-gate CLI writes a receipt only for the verified actual checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'verification-gate-')),
    script = resolve('.github/scripts/verification-plan.mjs')
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  try {
    git('init', '--initial-branch=main')
    git(
      '-c',
      'user.name=CI',
      '-c',
      'user.email=ci@example.test',
      'commit',
      '--allow-empty',
      '-m',
      'proof',
    )
    const source = git('rev-parse', 'HEAD'),
      sourceTree = git('rev-parse', 'HEAD^{tree}')
    const eventPath = join(root, 'event.json'),
      output = join(root, 'receipt.json')
    writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 976, head: { sha: head } } }))
    const env = {
      ...process.env,
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_SHA: source,
      GITHUB_REPOSITORY: 'ZeiJM/Aurevane',
      GITHUB_RUN_ID: '100',
      GITHUB_RUN_ATTEMPT: '1',
      AV_PROOF_OUTPUT: output,
      AV_WORKFLOW_FILE: 'browser-smoke.yml',
      AV_PLAN_RESULT: 'success',
      AV_EXECUTION_RESULTS: '["success"]',
      AV_VERIFICATION_PLAN: JSON.stringify({
        schemaVersion: 1,
        execute: true,
        scope: 'full',
        checkoutSha: source,
        treeSha: sourceTree,
      }),
    }
    execFileSync(process.execPath, [script, 'gate'], { cwd: root, env })
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), {
      ...good().tested,
      checkoutSha: source,
      treeSha: sourceTree,
    })
    rmSync(output)
    assert.throws(() =>
      execFileSync(process.execPath, [script, 'gate'], {
        cwd: root,
        env: { ...env, GITHUB_SHA: sha },
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )
    assert.throws(() => readFileSync(output))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
