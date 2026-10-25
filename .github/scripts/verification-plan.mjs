import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  readFileSync,
  readdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

export const CORE_SPECS = [
  'account-entry.pw.ts',
  'loadout-navigation.pw.ts',
  'battle-move-preview-polish.pw.ts',
  'ci-changed-assets.pw.ts',
]
const shaPattern = /^[a-f0-9]{40}$/
const workflowPattern = /^[a-z0-9-]+\.yml$/
const imagePattern = /^apps\/web\/public\/media\/skills\/.+\.(png|jpe?g|webp|avif)$/i
const groupSpecs = {
  battle:
    /^(ai-|battle-|pvp-|combat-summon|refined-battle|mobile-battle|shared-battle|phase4-ground-targeting|hall-|training-)/,
  character:
    /^(character-|creation-|profile-|technique|mobile-techniques|nexus-|discipline-|mixed-build|p3-8-|phase4-(atlas|roster|mastery)|adventurers-|titles-|wayfarers-)/,
  audio: /^audio-workspace\./,
  public: /^(public-information\.|manual-|rules-|news-)/,
}
export function safePath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    ![...path].some(
      (char) => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) &&
    !path.startsWith('/') &&
    !path.split('/').some((p) => !p || p === '..' || p === '.')
  )
}
function documentation(path) {
  return (
    path.startsWith('docs/') ||
    /(^|\/)AGENTS\.md$/.test(path) ||
    ['README.md', 'TASKS.md', 'apps/web/DEPLOYMENT.md'].includes(path) ||
    /^content\/(art|audio)-requests\//.test(path)
  )
}
function sourceGroup(path) {
  if (imagePattern.test(path)) return 'artwork'
  const presentationSource = /\.(tsx?|module\.css)$/.test(path)
  if (presentationSource && path.startsWith('apps/web/src/components/battle/'))
    return /battle-return-navigation|pvp-battle-key-input-assist/.test(path) ? null : 'battle'
  if (presentationSource && path.startsWith('apps/web/src/components/character/'))
    return /\/(character-(skill-build-panel|discipline-build-panel|attribute-allocation-panel|profile-shell|arsenal-shell|pv2-test-kit)|discipline-mastery-panel|discipline-sigil)[\w.-]*\.(tsx?|module\.css)$/.test(
      path,
    )
      ? 'character'
      : null
  if (/^apps\/web\/src\/components\/audio\/audio-workspace\.(tsx|module\.css)$/.test(path))
    return 'audio'
  if (
    /\.(tsx|module\.css)$/.test(path) &&
    (path.startsWith('apps/web/src/components/public-information/') ||
      /^apps\/web\/src\/app\/(news|manual|rules)\//.test(path))
  )
    return 'public'
  if (/^apps\/web\/scripts\/(battle-|skill-parameter-|management-mobile-)/.test(path))
    return 'battle'
  const spec = path.match(/^apps\/web\/e2e\/(.+\.pw\.ts)$/)?.[1]
  if (CORE_SPECS.includes(spec)) return 'core'
  return spec
    ? (Object.entries(groupSpecs).find(([, pattern]) => pattern.test(spec))?.[0] ?? null)
    : null
}
export function classifyChanges(changes, specs, forceFull = false) {
  if (!Array.isArray(specs) || CORE_SPECS.some((s) => !specs.includes(s)))
    throw new Error('Essential browser specifications are missing')
  const inventory = [...new Set(specs)].sort()
  if (inventory.some((s) => !safePath(s) || !s.endsWith('.pw.ts')))
    throw new Error('Invalid browser inventory')
  if (changes !== null && !Array.isArray(changes)) throw new Error('Invalid change metadata')
  for (const c of changes ?? [])
    if (!c || !safePath(c.path) || !['A', 'M', 'D', 'T'].includes(c.status))
      throw new Error('Invalid changed-file record')
  const assets = [
    ...new Set(
      (changes ?? [])
        .filter((c) => ['A', 'M'].includes(c.status) && imagePattern.test(c.path))
        .map((c) => c.path.slice('apps/web/public'.length)),
    ),
  ].sort()
  const full = (reason) => ({
    scope: 'full',
    reason,
    groups: ['full'],
    nativeFiles: inventory,
    assets,
    battle: true,
    edge: true,
  })
  if (forceFull) return full('explicit-full-request')
  if (!changes?.length) return full('diff-unavailable-or-empty')
  const runtime = changes.filter((c) => !documentation(c.path))
  if (!runtime.length)
    return {
      scope: 'none',
      reason: 'documentation-only',
      groups: [],
      nativeFiles: [],
      assets: [],
      battle: false,
      edge: false,
    }
  if (runtime.some((c) => !['A', 'M'].includes(c.status)))
    return full('runtime-deletion-or-type-change')
  if (runtime.some((c) => c.status === 'A' && !imagePattern.test(c.path)))
    return full('new-executable-or-unmapped-file')
  const groups = new Set()
  for (const c of runtime) {
    const group = sourceGroup(c.path)
    if (!group) return full('shared-sensitive-or-unmapped-path')
    if (!['core', 'artwork'].includes(group)) groups.add(group)
  }
  if (groups.size > 1 && ![...groups].every((g) => ['battle', 'character'].includes(g)))
    return full('unrelated-multi-system-change')
  if (groups.has('battle') || groups.has('character')) {
    groups.add('battle')
    groups.add('character')
  }
  const selected = new Set(CORE_SPECS)
  for (const group of groups) {
    const affected = inventory.filter((s) => groupSpecs[group].test(s))
    if (!affected.length) return full('affected-group-has-no-specifications')
    affected.forEach((s) => selected.add(s))
  }
  return {
    scope: 'targeted',
    reason: 'core-plus-affected-features',
    groups: [...groups].sort(),
    nativeFiles: [...selected].sort(),
    assets,
    battle: groups.has('battle'),
    edge: groups.has('battle'),
  }
}
function newestRun(runs) {
  if (
    !Array.isArray(runs) ||
    !runs.length ||
    runs.some(
      (r) => !Number.isSafeInteger(r.id) || r.id < 1 || !Number.isFinite(Date.parse(r.updated_at)),
    )
  )
    return null
  return [...runs].sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id,
  )[0]
}
export function verificationReceipt({ plan, event, repository, workflow, runId, runAttempt }) {
  const pr = event.pull_request
  if (
    !shaPattern.test(plan?.checkoutSha) ||
    !shaPattern.test(plan?.treeSha) ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') ||
    !workflowPattern.test(workflow) ||
    !Number.isSafeInteger(pr?.number) ||
    pr.number < 1 ||
    !shaPattern.test(pr?.head?.sha) ||
    !Number.isSafeInteger(Number(runId)) ||
    Number(runId) < 1 ||
    !Number.isSafeInteger(Number(runAttempt)) ||
    Number(runAttempt) < 1
  )
    throw new Error('Invalid tested-source receipt')
  return {
    schemaVersion: 1,
    repository,
    prNumber: pr.number,
    workflow,
    headSha: pr.head.sha,
    checkoutSha: plan.checkoutSha,
    treeSha: plan.treeSha,
    runId: Number(runId),
    runAttempt: Number(runAttempt),
  }
}
export function readProofArchive(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 65536)
    throw new Error('Invalid proof archive size')
  const directory = mkdtempSync(join(tmpdir(), 'verification-proof-'))
  try {
    const archive = join(directory, 'proof.zip')
    writeFileSync(archive, bytes)
    // Stream one fixed entry to stdout; never extract an archive path to disk.
    const json = execFileSync('unzip', ['-p', archive, 'verification-proof.json'], {
      encoding: 'utf8',
      maxBuffer: 4096,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return JSON.parse(json)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
export function mergedRunProof({ sha, workflow, now, commit, pr, headCommit, runs, tested }) {
  try {
    if (
      !shaPattern.test(sha) ||
      !workflowPattern.test(workflow) ||
      !Number.isFinite(now) ||
      commit.sha !== sha ||
      !shaPattern.test(commit.commit.tree.sha) ||
      pr.merged !== true ||
      pr.state !== 'closed' ||
      pr.base.ref !== 'main' ||
      pr.merge_commit_sha !== sha ||
      !Number.isSafeInteger(pr.number) ||
      pr.number < 1 ||
      !shaPattern.test(pr.head.sha) ||
      headCommit.sha !== pr.head.sha ||
      headCommit.commit.tree.sha !== commit.commit.tree.sha ||
      !newestRun(runs)
    )
      return null
    // Never select an older success over a newer failed, cancelled or running attempt.
    const latest = newestRun(runs),
      updated = Date.parse(latest.updated_at)
    if (
      latest.event !== 'pull_request' ||
      latest.head_sha !== pr.head.sha ||
      latest.path !== `.github/workflows/${workflow}` ||
      latest.status !== 'completed' ||
      latest.conclusion !== 'success' ||
      !Number.isSafeInteger(latest.run_attempt) ||
      latest.run_attempt < 1 ||
      tested?.schemaVersion !== 1 ||
      tested.repository !== pr.base.repo?.full_name ||
      tested.prNumber !== pr.number ||
      tested.workflow !== workflow ||
      tested.headSha !== pr.head.sha ||
      tested.runId !== latest.id ||
      tested.runAttempt !== latest.run_attempt ||
      !shaPattern.test(tested.checkoutSha) ||
      tested.treeSha !== commit.commit.tree.sha ||
      !Number.isFinite(updated) ||
      updated < now - 86400000 ||
      updated > now + 300000
    )
      return null
    return {
      prNumber: pr.number,
      mergeSha: sha,
      headSha: pr.head.sha,
      treeSha: commit.commit.tree.sha,
      runId: latest.id,
      runAttempt: latest.run_attempt,
      testedCheckoutSha: tested.checkoutSha,
      workflow,
    }
  } catch {
    return null
  }
}
export function gateResult(planResult, plan, executions) {
  if (
    planResult !== 'success' ||
    plan?.schemaVersion !== 1 ||
    typeof plan.execute !== 'boolean' ||
    !Array.isArray(executions) ||
    !executions.length
  )
    return false
  if (plan.execute)
    return ['targeted', 'full'].includes(plan.scope) && executions.every((r) => r === 'success')
  if (!executions.every((r) => r === 'skipped')) return false
  if (plan.scope === 'none') return plan.reason === 'documentation-only'
  const p = plan.proof
  return (
    plan.scope === 'reuse' &&
    Number.isSafeInteger(p?.prNumber) &&
    p.prNumber > 0 &&
    Number.isSafeInteger(p?.runId) &&
    p.runId > 0 &&
    Number.isSafeInteger(p?.runAttempt) &&
    p.runAttempt > 0 &&
    shaPattern.test(p?.testedCheckoutSha) &&
    shaPattern.test(p?.headSha) &&
    shaPattern.test(p?.treeSha) &&
    p.treeSha === plan.treeSha &&
    p.mergeSha === plan.checkoutSha &&
    shaPattern.test(p.mergeSha) &&
    workflowPattern.test(p?.workflow)
  )
}
export async function findReuseProof({ sha, workflow, repository, api, now = Date.now() }) {
  try {
    if (
      !shaPattern.test(sha) ||
      !workflowPattern.test(workflow) ||
      !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')
    )
      return null
    const commit = await api(`/commits/${sha}`),
      pulls = await api(`/commits/${sha}/pulls?per_page=100`)
    if (!Array.isArray(pulls) || pulls.length >= 100) return null
    for (const associated of pulls) {
      if (!Number.isSafeInteger(associated.number)) return null
      const pr = await api(`/pulls/${associated.number}`)
      if (
        pr.base?.repo?.full_name !== repository ||
        pr.merge_commit_sha !== sha ||
        pr.merged !== true
      )
        continue
      if (!shaPattern.test(pr.head?.sha ?? '')) return null
      const headCommit = await api(`/commits/${pr.head.sha}`)
      const response = await api(
        `/actions/workflows/${workflow}/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`,
      )
      if (
        !Number.isSafeInteger(response.total_count) ||
        response.total_count < 0 ||
        !Array.isArray(response.workflow_runs) ||
        response.workflow_runs.length >= 100 ||
        response.total_count !== response.workflow_runs.length
      )
        return null
      const latest = newestRun(response.workflow_runs)
      if (
        !latest ||
        latest.status !== 'completed' ||
        latest.conclusion !== 'success' ||
        !Number.isSafeInteger(latest.run_attempt) ||
        latest.run_attempt < 1
      )
        return null
      const artifacts = await api(`/actions/runs/${latest.id}/artifacts?per_page=100`)
      if (
        !Number.isSafeInteger(artifacts.total_count) ||
        artifacts.total_count < 0 ||
        !Array.isArray(artifacts.artifacts) ||
        artifacts.artifacts.length >= 100 ||
        artifacts.total_count !== artifacts.artifacts.length
      )
        return null
      const matches = artifacts.artifacts.filter(
        (a) => a.name === `verification-proof-${workflow}-${latest.id}-${latest.run_attempt}`,
      )
      if (matches.length !== 1) return null
      const artifact = matches[0]
      if (
        artifact.expired !== false ||
        !Number.isSafeInteger(artifact.id) ||
        artifact.id < 1 ||
        !Number.isSafeInteger(artifact.size_in_bytes) ||
        artifact.size_in_bytes < 1 ||
        artifact.size_in_bytes > 65536
      )
        return null
      const tested = readProofArchive(await api(`/actions/artifacts/${artifact.id}/zip`, true))
      const proof = mergedRunProof({
        sha,
        workflow,
        now,
        commit,
        pr,
        headCommit,
        runs: response.workflow_runs,
        tested,
      })
      if (proof) return proof
    }
    return null
  } catch {
    return null
  } // Read/API/permission uncertainty always means normal execution.
}
function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd()
}
export function changedFiles(base, head) {
  if (!shaPattern.test(base ?? '') || !shaPattern.test(head ?? '')) return null
  try {
    git('merge-base', '--is-ancestor', base, head)
    const fields = git('diff', '--name-status', '--no-renames', '-z', base, head, '--').split('\0')
    if (fields.at(-1) === '') fields.pop()
    if (fields.length % 2) return null
    return Array.from({ length: fields.length / 2 }, (_, i) => ({
      status: fields[i * 2],
      path: fields[i * 2 + 1],
    }))
  } catch {
    return null
  }
}
export function specInventory(directory = 'apps/web/e2e', prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? specInventory(resolve(directory, item.name), `${prefix}${item.name}/`)
      : item.name.endsWith('.pw.ts')
        ? [`${prefix}${item.name}`]
        : [],
  )
}
export async function eventPlan({
  eventName,
  event,
  sha,
  workflow,
  repository,
  api,
  specs,
  changes,
  treeSha,
}) {
  if (!shaPattern.test(sha) || !shaPattern.test(treeSha) || !workflowPattern.test(workflow))
    throw new Error('Invalid immutable verification source')
  if (eventName === 'push' && event.ref === 'refs/heads/main' && api) {
    const proof = await findReuseProof({ sha, workflow, repository, api })
    if (proof)
      return {
        schemaVersion: 1,
        execute: false,
        scope: 'reuse',
        reason: 'identical-successful-pr-tree',
        checkoutSha: sha,
        treeSha,
        proof,
        battle: false,
        edge: false,
        nativeFiles: [],
        assets: [],
      }
    return {
      schemaVersion: 1,
      execute: true,
      checkoutSha: sha,
      treeSha,
      ...classifyChanges(changes, specs, true),
    }
  }
  const forceFull =
    eventName !== 'pull_request' || event.pull_request?.labels?.some((l) => l.name === 'ci:full')
  const selected = classifyChanges(changes, specs, forceFull)
  return {
    schemaVersion: 1,
    execute: selected.scope !== 'none',
    checkoutSha: sha,
    treeSha,
    ...selected,
  }
}
async function cli() {
  if (process.argv[2] === 'gate') {
    const plan = JSON.parse(process.env.AV_VERIFICATION_PLAN || 'null'),
      executions = JSON.parse(process.env.AV_EXECUTION_RESULTS || '[]')
    if (!gateResult(process.env.AV_PLAN_RESULT, plan, executions))
      throw new Error('Required verification did not complete successfully')
    if (
      process.env.GITHUB_SHA &&
      (plan.checkoutSha !== process.env.GITHUB_SHA ||
        plan.treeSha !== git('rev-parse', 'HEAD^{tree}') ||
        plan.checkoutSha !== git('rev-parse', 'HEAD'))
    )
      throw new Error('Required verification is bound to another source tree')
    if (process.env.AV_PROOF_OUTPUT && process.env.GITHUB_EVENT_NAME === 'pull_request')
      writeFileSync(
        process.env.AV_PROOF_OUTPUT,
        JSON.stringify(
          verificationReceipt({
            plan,
            event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
            repository: process.env.GITHUB_REPOSITORY,
            workflow: process.env.AV_WORKFLOW_FILE,
            runId: process.env.GITHUB_RUN_ID,
            runAttempt: process.env.GITHUB_RUN_ATTEMPT,
          }),
        ) + '\n',
      )
    console.log(
      plan.scope === 'reuse'
        ? `Verified identical-tree reuse from PR #${plan.proof.prNumber}, run ${plan.proof.runId}`
        : `Verification satisfied: ${plan.scope}`,
    )
    return
  }
  const head = git('rev-parse', 'HEAD'),
    treeSha = git('rev-parse', 'HEAD^{tree}')
  if (process.argv[2] === 'preview') {
    const selected = classifyChanges(changedFiles(process.argv[3], head), specInventory())
    console.log(
      JSON.stringify(
        {
          schemaVersion: 1,
          execute: selected.scope !== 'none',
          checkoutSha: head,
          treeSha,
          ...selected,
        },
        null,
        2,
      ),
    )
    return
  }
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
    eventName = process.env.GITHUB_EVENT_NAME
  const sha = process.env.GITHUB_SHA,
    workflow = process.env.AV_WORKFLOW_FILE,
    repository = process.env.GITHUB_REPOSITORY
  if (sha !== head || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? ''))
    throw new Error('Checkout does not match the requested immutable source')
  const api = async (path, binary = false) => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.AV_GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) throw new Error(`GitHub read failed (${response.status})`)
    if (binary) {
      const chunks = [],
        limit = 65536
      let length = 0
      for await (const chunk of response.body) {
        length += chunk.length
        if (length > limit) throw new Error('Proof download exceeds size limit')
        chunks.push(chunk)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      return bytes
    }
    return response.json()
  }
  const plan = await eventPlan({
    eventName,
    event,
    sha,
    treeSha,
    workflow,
    repository,
    api,
    specs: specInventory(),
    changes: changedFiles(event.pull_request?.base?.sha ?? event.before, sha),
  })
  const json = JSON.stringify(plan)
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `plan=${json}\nexecute=${plan.execute}\nbattle=${Boolean(plan.battle)}\n`,
    )
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Verification plan\n\nMode: **${plan.scope}**. Reason: ${plan.reason}.\n\nSource tree: \`${treeSha}\`. Selected native files: ${plan.nativeFiles.length}. Chromium projects: desktop, laptop, mobile.\n\n${plan.proof ? `Reuses PR #${plan.proof.prNumber}, [run ${plan.proof.runId}](https://github.com/${repository}/actions/runs/${plan.proof.runId}).` : `Groups: ${(plan.groups ?? []).join(', ') || 'documentation'}. Edge: ${Boolean(plan.edge)}.`}\n`,
    )
  console.log(json)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  cli().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
