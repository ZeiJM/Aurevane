import { execFileSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'

const repository = 'ZeiJM/Aurevane'
const token = process.env.GITHUB_TOKEN
const mode = (process.env.CLEANUP_MODE || 'dry-run').toLowerCase()
const currentBranch = process.env.GITHUB_REF_NAME || ''
const cutoff = Date.now() - 14 * 86400_000
const prefix = '/repos/' + repository

if (process.env.GITHUB_REPOSITORY !== repository || !token) {
  throw new Error('Repository identity or GitHub Actions token is missing')
}
if (!['dry-run', 'apply'].includes(mode)) {
  throw new Error('Unknown cleanup mode: ' + mode)
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim()

async function api(path, method = 'GET', allowMissing = false) {
  const response = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'aurevane-safe-branch-hygiene',
    },
  })
  if (allowMissing && response.status === 404) return null
  if (!response.ok) {
    const message = (await response.text()).slice(0, 350)
    throw new Error(method + ' ' + path + ': HTTP ' + response.status + ': ' + message)
  }
  return response.status === 204 ? null : response.json()
}

async function listAll(path) {
  const records = []
  for (let page = 1; page <= 50; page++) {
    const separator = path.includes('?') ? '&' : '?'
    const batch = await api(prefix + path + separator + 'per_page=100&page=' + page)
    if (!Array.isArray(batch)) throw new Error('Unexpected list response for ' + path)
    records.push(...batch)
    if (batch.length < 100) return records
  }
  throw new Error('Exceeded pagination safety bound for ' + path)
}

function protectedByName(name) {
  if (name === 'main' || name === currentBranch) return true
  if (/^(release|hotfix|production|stable|archive|backup|recovery|maintenance)\//i.test(name)) return true
  if (/(?:^|[-_/])(backup|recovery|rollback|checkpoint|restore|production|archive)(?:[-_/]|$)/i.test(name)) return true
  return !/^(agent|preview|fix|review|docs|ui|batch|feat|feature|perf|tmp|art|codex|combat|audit|polish|sync|closeout)\//.test(name)
}

function asOpenReferences(pulls) {
  const names = new Set()
  for (const pr of pulls) {
    if (pr.head?.ref) names.add(pr.head.ref)
    if (pr.base?.ref) names.add(pr.base.ref)
  }
  return names
}

function makeSummary(report) {
  return [
    '## Aurevane branch hygiene',
    '',
    '- Mode: **' + report.mode + '**',
    '- Branches inspected: **' + report.branchCount + '**',
    '- Open pull requests: **' + report.openPRCount + '**',
    '- Safe cleanup candidates (at least 14 days old): **' + report.candidates.length + '**',
    '- Removed: **' + report.deleted.length + '**',
    '- Skipped because refs changed or are protected: **' + report.skipped.length + '**',
    '- Deletion errors: **' + report.errors.length + '**',
    '',
    'Only branches wholly contained in main, or branches with an exact-tip PR already merged into main, are eligible. Open-PR branches, protected refs and recovery/release branches are excluded. Full names, commit SHAs and evidence are in the attached JSON audit.',
    '',
  ].join('\n')
}

async function main() {
  const repo = await api(prefix)
  if (repo.default_branch !== 'main' || repo.delete_branch_on_merge !== true) {
    throw new Error('Expected default branch and auto-delete-on-merge settings have changed')
  }
  const [serverBranches, allPRs] = await Promise.all([
    listAll('/branches'),
    listAll('/pulls?state=all'),
  ])
  const branchByName = new Map(serverBranches.map((b) => [b.name, b]))
  const localRefLines = git(
    'for-each-ref',
    '--format=%(refname:strip=3)%00%(objectname)%00%(committerdate:iso8601-strict)',
    'refs/remotes/origin',
  )
  const localRefs = localRefLines.split('\n').filter(Boolean).map((line) => {
    const [name, sha, date] = line.split('\0')
    return { name, sha, date }
  }).filter((item) => item.name !== 'HEAD')
  const localMainSHA = git('rev-parse', 'refs/remotes/origin/main')
  if (branchByName.get('main')?.commit?.sha !== localMainSHA) {
    throw new Error('Main moved since checkout: aborting stale audit')
  }
  const localNames = new Set(localRefs.map((b) => b.name))
  if (localNames.size !== branchByName.size ||
      [...localNames].some((name) => !branchByName.has(name))) {
    throw new Error('Remote branches changed during checkout: aborting stale audit')
  }

  const fullyMerged = new Set(git(
    'for-each-ref',
    '--merged=refs/remotes/origin/main',
    '--format=%(refname:strip=3)',
    'refs/remotes/origin',
  ).split('\n').filter(Boolean))
  const openPRs = allPRs.filter((pr) => pr.state === 'open')
  const openReferences = asOpenReferences(openPRs)
  const mergedPRsByBranch = new Map()
  for (const pr of allPRs) {
    if (!pr.merged_at || !pr.head?.ref || !pr.head?.sha ||
        pr.base?.ref !== 'main' || pr.head.repo?.full_name !== repository ||
        Date.parse(pr.merged_at) > cutoff) continue
    const list = mergedPRsByBranch.get(pr.head.ref) || []
    list.push(pr)
    mergedPRsByBranch.set(pr.head.ref, list)
  }

  const candidates = []
  const retainedReasons = {}
  for (const branch of localRefs) {
    const server = branchByName.get(branch.name)
    let exclusion = null
    if (protectedByName(branch.name)) exclusion = 'reserved-name'
    else if (server.protected) exclusion = 'github-protected'
    else if (server.commit.sha !== branch.sha) exclusion = 'changed-tip'
    else if (openReferences.has(branch.name)) exclusion = 'open-pull-request'
    else if (!Number.isFinite(Date.parse(branch.date)) || Date.parse(branch.date) > cutoff) {
      exclusion = 'recent-or-undated'
    }

    const match = (mergedPRsByBranch.get(branch.name) || []).find(
      (pr) => pr.head.sha === branch.sha,
    )
    const proof = fullyMerged.has(branch.name)
      ? 'ancestor-of-main'
      : match
        ? 'merged-PR-' + match.number + '-exact-head'
        : null
    if (!exclusion && !proof) exclusion = 'unmerged-or-unverified-commits'

    if (exclusion) {
      retainedReasons[exclusion] = (retainedReasons[exclusion] || 0) + 1
    } else {
      candidates.push({
        branch: branch.name,
        sha: branch.sha,
        lastCommit: branch.date,
        proof,
      })
    }
  }
  const report = {
    repository,
    generatedAt: new Date().toISOString(),
    mode,
    mainSHA: localMainSHA,
    branchCount: localRefs.length,
    openPRCount: openPRs.length,
    minimumAgeDays: 14,
    retainedReasons,
    candidates,
    deleted: [],
    skipped: [],
    errors: [],
  }

  if (mode === 'apply') {
    let refreshedOpen = asOpenReferences(await listAll('/pulls?state=open'))
    for (const [i, candidate] of candidates.entries()) {
      if (i > 0 && i % 25 === 0) {
        refreshedOpen = asOpenReferences(await listAll('/pulls?state=open'))
      }
      if (refreshedOpen.has(candidate.branch)) {
        report.skipped.push({ branch: candidate.branch, reason: 'new-open-PR' })
        continue
      }
      const refPath = prefix + '/git/ref/heads/' +
        candidate.branch.split('/').map(encodeURIComponent).join('/')
      const live = await api(refPath, 'GET', true)
      if (!live || live.object?.sha !== candidate.sha) {
        report.skipped.push({ branch: candidate.branch, reason: 'tip-moved-or-deleted' })
        continue
      }
      try {
        await api(prefix + '/git/refs/heads/' +
          candidate.branch.split('/').map(encodeURIComponent).join('/'), 'DELETE')
        report.deleted.push(candidate)
        console.log('Removed: ' + candidate.branch + ' (' + candidate.proof + ')')
      } catch (error) {
        report.errors.push({ branch: candidate.branch, message: String(error).slice(0, 500) })
        break
      }
    }
  }

  writeFileSync('branch-hygiene-report.json', JSON.stringify(report, null, 2) + '\n')
  console.log(makeSummary(report))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, makeSummary(report))
  }
  if (report.errors.length) process.exitCode = 1
}

await main()
