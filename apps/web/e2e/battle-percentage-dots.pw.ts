import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

test('percentage Skill/Essence and active/pending readers across desktop/mobile PvE/PvP and spectators', async ({}, testInfo) => {
  // One matrix already mounts both breakpoints and modes, using the production component and styles.
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The desktop project runs the complete cross-mode matrix once.',
  )
  test.setTimeout(240_000)
  const output = testInfo.outputPath('percentage-dot-evidence')
  const result = await promisify(execFile)(
    process.execPath,
    [resolve('scripts/battle-percentage-dot-browser-regression.mjs')],
    {
      cwd: process.cwd(),
      env: { ...process.env, AV_PERCENTAGE_DOT_EVIDENCE_DIR: output },
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  expect(result.stdout).toContain(
    '60 percentage Skill/Essence and active/pending rail cases passed',
  )
  const results = JSON.parse(await readFile(resolve(output, 'results.json'), 'utf8'))
  expect(results.cases).toBe(60)
  expect(results.errors).toEqual([])
  await testInfo.attach('Percentage readers', {
    path: resolve(output, 'results.json'),
    contentType: 'application/json',
  })
})
