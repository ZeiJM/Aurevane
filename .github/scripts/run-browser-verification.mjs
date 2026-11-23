import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORE_SPECS, safePath } from './verification-plan.mjs'

export const AUTHORITY_SPECS = [
  'master-complete-layout.pw.ts',
  'master-world-environment-cadence.pw.ts',
  'master-combat-content-authoring.pw.ts',
  'staff-selected-character-access.pw.ts',
  'master-players-recovery.pw.ts',
  'battle-wasd-backtracking.pw.ts',
]
export const EDGE_SPECS = [
  'battle-self-action-quick-commit.pw.ts',
  'battle-recovery-hotkey.pw.ts',
  'battle-support-action.pw.ts',
  'techniques-support-action.pw.ts',
]
function selector(file) {
  return `e2e/${file}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
export function browserCommands(plan) {
  if (
    plan?.schemaVersion !== 1 ||
    plan.execute !== true ||
    !['targeted', 'full'].includes(plan.scope)
  )
    throw new Error('Invalid executable browser plan')
  if (
    !Array.isArray(plan.nativeFiles) ||
    CORE_SPECS.some((s) => !plan.nativeFiles.includes(s)) ||
    plan.nativeFiles.some((s) => !safePath(s) || !s.endsWith('.pw.ts'))
  )
    throw new Error('Invalid selected browser specifications')
  const command = (name, files, extra = []) => ({
    name,
    command: 'pnpm',
    files,
    args: [
      '--filter',
      '@aurevane/web',
      'exec',
      'playwright',
      'test',
      ...files.map(selector),
      ...extra,
    ],
  })
  const commands = []
  if (plan.scope === 'full')
    commands.push(
      command('Repeated authoring and authority', AUTHORITY_SPECS, [
        '--project=desktop-chromium',
        '--repeat-each=2',
      ]),
    )
  commands.push(
    command(
      plan.scope === 'full' ? 'Full Chromium regression' : 'Core and affected Chromium coverage',
      plan.scope === 'full' ? [] : [...new Set(plan.nativeFiles)].sort(),
    ),
  )
  if (plan.scope === 'full' || plan.edge === true)
    commands.push(
      command('Edge keyboard and Support Actions', EDGE_SPECS, [
        '--config=playwright.edge.config.ts',
        '--output=test-results-edge',
      ]),
    )
  return commands
}
export function preserveEvidence(
  root = 'apps/web/test-results',
  authority = '/tmp/combat-master-release-review',
  rails = '/tmp/battle-rail-review',
  master = '/tmp/master-full-integration-review',
  phase = 'standalone',
) {
  if (!existsSync(root)) return
  mkdirSync(authority, { recursive: true })
  mkdirSync(rails, { recursive: true })
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (/^(master-|staff-|battle-ground-).*\.png$/.test(entry.name))
        cpSync(path, resolve(authority, entry.name))
    }
  }
  visit(root)
  for (const entry of readdirSync(root, { withFileTypes: true }))
    if (
      entry.isDirectory() &&
      /^(master-complete-layout|master-world-environment-)/.test(entry.name)
    ) {
      const destination = resolve(master, phase, entry.name)
      mkdirSync(destination, { recursive: true })
      cpSync(resolve(root, entry.name), destination, { recursive: true })
    }
  for (const entry of readdirSync(root, { withFileTypes: true }))
    if (
      entry.isDirectory() &&
      /^(ai-grid-legend-regressio|pvp-map-sizes|pvp-spectator-title-layout)/.test(entry.name)
    )
      cpSync(resolve(root, entry.name), resolve(rails, entry.name), { recursive: true })
}
function cli() {
  const plan = JSON.parse(process.env.AV_VERIFICATION_PLAN || 'null')
  const commands = browserCommands(plan)
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(commands, null, 2))
    return
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
  if (plan.checkoutSha !== head || plan.treeSha !== tree)
    throw new Error('Browser plan is for a different source tree')
  if (
    !Array.isArray(plan.assets) ||
    plan.assets.some(
      (s) =>
        typeof s !== 'string' ||
        !/^\/media\/skills\/.+\.(png|jpe?g|webp|avif)$/i.test(s) ||
        !safePath(s.slice(1)),
    )
  )
    throw new Error('Invalid changed-image plan')
  for (const command of commands) {
    console.log(`::group::${command.name}`)
    const result = spawnSync(command.command, command.args, {
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, AV_CHANGED_PUBLIC_IMAGES: JSON.stringify(plan.assets) },
    })
    console.log('::endgroup::')
    // Edge writes separately; do not relabel retained Chromium captures as Edge evidence.
    preserveEvidence(
      command.args.includes('--output=test-results-edge')
        ? 'apps/web/test-results-edge'
        : 'apps/web/test-results',
      '/tmp/combat-master-release-review',
      '/tmp/battle-rail-review',
      '/tmp/master-full-integration-review',
      command.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    )
    if (result.error || result.status !== 0)
      throw new Error(`${command.name} did not pass${result.signal ? ` (${result.signal})` : ''}`)
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
