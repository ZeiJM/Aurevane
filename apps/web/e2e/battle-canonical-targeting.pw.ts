import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

test('captured targeting collects explicit plural targets and Manual behavior choices in both battle modes', async ({}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'One matrix covers desktop/mobile PvE and PvP.',
  )
  test.setTimeout(120_000)
  const output = info.outputPath('canonical-targeting-evidence')
  const result = await promisify(execFile)(
    process.execPath,
    [resolve('scripts/battle-canonical-targeting-browser-regression.mjs')],
    {
      cwd: process.cwd(),
      env: { ...process.env, AV_TARGETING_EVIDENCE_DIR: output },
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  expect(result.stdout).toContain('14 canonical controller cases passed')
  const report = JSON.parse(await readFile(resolve(output, 'results.json'), 'utf8'))
  expect(report.cases).toBe(14)
  expect(report.errors).toEqual([])
  await info.attach('Canonical targeting', {
    path: resolve(output, 'results.json'),
    contentType: 'application/json',
  })
})

test('captured Move chooses a destination then an explicit follow-up with one payment in both battle modes', async ({}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'One matrix covers desktop/mobile PvE and PvP.',
  )
  test.setTimeout(120_000)
  const output = info.outputPath('canonical-move-evidence')
  const result = await promisify(execFile)(
    process.execPath,
    [resolve('scripts/battle-canonical-targeting-browser-regression.mjs')],
    {
      cwd: process.cwd(),
      env: { ...process.env, AV_CANONICAL_MOVE: '1', AV_TARGETING_EVIDENCE_DIR: output },
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  expect(result.stdout).toContain('18 canonical Move controller cases passed')
  const report = JSON.parse(await readFile(resolve(output, 'results.json'), 'utf8'))
  expect(report.cases).toBe(18)
  expect(report.errors).toEqual([])
  await info.attach('Canonical Move', {
    path: resolve(output, 'results.json'),
    contentType: 'application/json',
  })
})
