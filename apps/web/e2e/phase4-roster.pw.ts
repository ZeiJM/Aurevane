import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Keep the screenshots and interaction trace when this release gate passes, too.
test.use({ trace: 'on' })

test('Ironfist provisions normally and Skill details preserve selection on phone and desktop', async ({
  page,
}, testInfo) => {
  test.setTimeout(150000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `phase4-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'Phase4-disposable-browser-2026!',
    characterName: `Roster ${suffix}`,
  })
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(management).toBeVisible()
  await page.reload()
  await expect(management).toBeVisible()
  await management
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
    .selectOption('ironfist')
  await page.getByRole('button', { name: 'Commit Ironfist as Primary' }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Ironfist')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const list = page.getByTestId('learned-skill-list')
  await expect(list.locator('article')).toHaveCount(8)
  await expect(page.getByTestId('active-essence')).toHaveText('Hundredfold Rush')
  const essenceArtwork = dialog.locator('img[src*="ironfist-256-v01.webp"]').first()
  await expect(essenceArtwork).toBeVisible()
  await expect
    .poll(() => essenceArtwork.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
  const palm = list.locator('article').filter({ hasText: 'Counter Palm' })
  await palm.locator('summary').click()
  await expect(palm).toContainText('Requires Guarded on yourself.')
  await expect(palm).toContainText('1 tile')
  await expect(palm.getByRole('checkbox')).not.toBeChecked()
  const sweep = list.locator('article').filter({ hasText: 'Sweep' })
  await expect(sweep).toContainText('Area · radius 1')
  for (const name of ['Rising Fist', 'Sweep', 'Breakfall', 'Counter Palm']) {
    await list.locator('article').filter({ hasText: name }).getByRole('checkbox').check()
  }
  // The profile refresh can remount the panel and clear its transient status.
  // Verify the authoritative save, then independently check persisted selections.
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(list.locator('input:checked')).toHaveCount(4)
  for (const name of ['Rising Fist', 'Sweep', 'Breakfall', 'Counter Palm']) {
    await expect(
      list.locator('article').filter({ hasText: name }).getByRole('checkbox'),
    ).toBeChecked()
  }
  await palm.locator('summary').click()
  const overflow = await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)
  expect(overflow).toBe(false)
  expect(await palm.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(
    false,
  )
  await testInfo.attach(`phase4-skills-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  const arena = page.getByLabel('AI sparring arena')
  await expect(arena).toBeVisible()
  await arena.selectOption('crossroads-court')
  await expect(arena).toHaveValue('crossroads-court')
  await arena.selectOption('terraced-yard')
  await expect(arena).toHaveValue('terraced-yard')
  await testInfo.attach(`phase4-arena-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  for (const [id, dimensions, tiles, name] of [
    ['crossroads-court', '7x7', 49, 'Crossroads Court'],
    ['terraced-yard', '11x7', 77, 'Terraced Yard'],
  ] as const) {
    await arena.selectOption(id)
    await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
    const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
    const board = root.locator('#battlefield [data-board-auto-fit]')
    await expect(board).toHaveAttribute('data-board-auto-fit', dimensions)
    await expect(board.locator('button[aria-label^="Tile "]')).toHaveCount(tiles)
    await page.reload()
    await expect(board).toHaveAttribute('data-board-auto-fit', dimensions)
    if (id === 'crossroads-court') {
      const audioRequests: string[] = []
      const trackAudio = (request: import('@playwright/test').Request) => {
        if (/\/api\/battles\/[^/]+\/audio\?/.test(request.url())) audioRequests.push(request.url())
      }
      page.on('request', trackAudio)
      await root.getByRole('button', { name: /Choose Guard skill/ }).click()
      await page.getByRole('option', { name: 'Breakfall 25 AP', exact: true }).click()
      await root.getByRole('button', { name: 'Breakfall, 25 AP', exact: true }).click()
      await expect(root.getByRole('button', { name: 'Confirm Action', exact: true })).toBeEnabled()
      expect(audioRequests).toEqual([])
      const committed = page.waitForResponse(
        (response) => response.url().endsWith('/intents') && response.request().method() === 'POST',
      )
      const cue = page.waitForResponse((response) =>
        /\/api\/battles\/[^/]+\/audio\?/.test(response.url()),
      )
      const sound = page.waitForResponse((response) =>
        response.url().includes('/media/audio/sfx/phase4/ironfist-action-'),
      )
      await root.getByRole('button', { name: 'Confirm Action', exact: true }).click()
      const committedResponse = await committed
      expect(committedResponse.status()).toBe(200)
      const battle = (await committedResponse.json()).battle
      expect(await (await cue).json()).toEqual({
        battleVersion: battle.battleVersion,
        cues: [
          {
            assetId: `audio.phase4.ironfist-action-v01-${(battle.battleVersion % 3) + 1}`,
            priority: 70,
          },
        ],
      })
      const assetResponse = await sound
      expect([200, 206]).toContain(assetResponse.status())
      expect(assetResponse.headers()['content-type']).toContain('audio/mpeg')
      expect((await assetResponse.body()).byteLength).toBeGreaterThan(0)
      expect(
        battle.snapshot.statusState.flatMap((row: { statuses: unknown[] }) => row.statuses),
      ).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'guarded' })]))
      page.off('request', trackAudio)
    }
    await testInfo.attach(`phase4-${id}-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await root.getByRole('button', { name: 'Surrender', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Surrender this battle?' })
      .getByRole('button', { name: 'Confirm Surrender' })
      .click()
    const result = page.getByTestId('battle-result-overlay')
    await expect(result).toBeVisible()
    await expect(result).toContainText(name)
    await result.getByRole('button', { name: 'Return to Battle Hall' }).click()
    await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  }
  expect(errors).toEqual([])
})

test('Phase 4 preserves testing access and shows advanced Skills and descriptive tradeoffs', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_PV2_TEST_MODE !== '1',
    'Uses the existing isolated CI mastery fixture.',
  )
  test.setTimeout(150000)
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await provisionAccountAndEnterCharacter({
    page,
    email: `p4-advanced-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'P4-advanced-disposable-2026!',
    characterName: `Mastery ${suffix}`,
  })
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management' })
  const atlasResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/mastery') && response.request().method() === 'GET',
  )
  await management.getByText('Discipline Atlas & Mastery', { exact: true }).click()
  const atlasResult = await atlasResponse
  expect(atlasResult.status()).toBe(200)
  const atlasBody = (await atlasResult.json()) as {
    progress: Array<{
      disciplineId: string
      xp: number
      stage: number
      unlocked: boolean
      releaseUnlocked: boolean
      testingAccess: boolean
    }>
    atlas: {
      totalDisciplines: number
      publishedDisciplines: number
      testingAccess: boolean
      entries: Array<{ disciplineId: string | null; publication: 'published' | 'planned' }>
    }
  }
  expect(atlasBody.atlas.totalDisciplines).toBe(36)
  expect(atlasBody.atlas.publishedDisciplines).toBe(17)
  expect(atlasBody.atlas.testingAccess).toBe(true)
  expect(atlasBody.atlas.entries).toHaveLength(36)
  expect(atlasBody.atlas.entries.filter((entry) => entry.disciplineId === null)).toHaveLength(6)
  expect(atlasBody.progress).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        disciplineId: 'bastion',
        xp: 0,
        stage: 1,
        unlocked: true,
        releaseUnlocked: false,
        testingAccess: true,
      }),
    ]),
  )
  await expect(management).toContainText('36 Disciplines')
  await expect(management).toContainText('Testing access is open.')
  const primary = management
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
  await expect(primary.locator('option[value="bastion"]')).toHaveCount(1)
  // Existing Owner-authorized testing access covers all published Disciplines without fake Mastery.
  // Earned prerequisites and 4/2/2 acquisition are independently verified in database CI.
  await primary.selectOption('bastion')
  await page.getByRole('button', { name: 'Commit Bastion as Primary' }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Bastion')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const list = page.getByTestId('learned-skill-list')
  await expect(list.locator('article')).toHaveCount(8)
  await expect(page.getByTestId('active-essence')).toHaveText('Last Bastion')
  const essenceArt = page
    .locator('img[src="/media/art/disciplines/phase4/bastion-256-v01.webp"]')
    .first()
  await expect(essenceArt).toBeVisible()
  await expect
    .poll(() =>
      essenceArt.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true)
  const fortress = list.locator('article').filter({ hasText: 'Fortress' })
  await expect(fortress).toContainText('Fortified')
  await fortress.locator('summary').click()
  await expect(fortress).toContainText('Take 30% less damage and deal 20% less damage.')
  await expect(fortress).toContainText('to yourself')
  expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
    false,
  )
  await testInfo.attach(`phase4-advanced-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await fortress.getByRole('checkbox').check()
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  expect((await saved).status()).toBe(200)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('mastery-trial')
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('AI sparring arena')).toHaveValue('crossroads-court')
  await expect(page.getByText(/50 Mastery XP/)).toBeVisible()
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  const audioRequests: string[] = []
  page.on('request', (request) => {
    if (/\/api\/battles\/[^/]+\/audio\?/.test(request.url())) audioRequests.push(request.url())
  })
  await root.getByRole('button', { name: /Choose Guard skill/ }).click()
  await page.getByRole('option', { name: 'Fortress 30 AP', exact: true }).click()
  await root.getByRole('button', { name: 'Fortress, 30 AP', exact: true }).click()
  await expect(root.getByRole('button', { name: 'Confirm Action', exact: true })).toBeEnabled()
  const selfPreview = page.waitForResponse(
    (response) => response.url().endsWith('/preview') && response.request().method() === 'POST',
  )
  // Re-selecting the caster on the board must not replace self with an illegal unit target.
  await root.getByRole('button', { name: new RegExp(`occupied by Mastery ${suffix}$`) }).click()
  const previewResponse = await selfPreview
  expect(previewResponse.request().postDataJSON().intent.target).toEqual({ kind: 'self' })
  const preview = (await previewResponse.json()).battlePreview.preview
  expect(preview.legal).toBe(true)
  expect(preview.projectedStatuses).toEqual(
    expect.arrayContaining([expect.objectContaining({ statusId: 'fortified' })]),
  )
  const committed = page.waitForResponse(
    (response) => response.url().endsWith('/intents') && response.request().method() === 'POST',
  )
  expect(audioRequests).toEqual([])
  const committedAudio = page.waitForResponse((response) =>
    /\/api\/battles\/[^/]+\/audio\?/.test(response.url()),
  )
  const playedAsset = page.waitForResponse((response) =>
    response.url().includes('/media/audio/sfx/phase4/bastion-action-'),
  )
  await root.getByRole('button', { name: 'Confirm Action', exact: true }).click()
  const commitResponse = await committed
  expect(commitResponse.status()).toBe(200)
  const battle = (await commitResponse.json()).battle
  const audioResponse = await committedAudio
  expect(audioResponse.status()).toBe(200)
  expect(await audioResponse.json()).toEqual({
    battleVersion: battle.battleVersion,
    cues: [
      {
        assetId: `audio.phase4.bastion-action-v01-${(battle.battleVersion % 3) + 1}`,
        priority: 70,
      },
    ],
  })
  const audioAssetResponse = await playedAsset
  // HTMLAudioElement may request a byte range; 206 is successful media delivery.
  expect([200, 206]).toContain(audioAssetResponse.status())
  expect(audioAssetResponse.headers()['content-type']).toContain('audio/mpeg')
  expect((await audioAssetResponse.body()).byteLength).toBeGreaterThan(0)
  expect(
    battle.snapshot.statusState.flatMap((row: { statuses: unknown[] }) => row.statuses),
  ).toEqual(expect.arrayContaining([expect.objectContaining({ statusId: 'fortified' })]))
  await testInfo.attach(`phase4-fortress-battle-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await root.getByRole('button', { name: 'Surrender', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Surrender', exact: true }).click()
  await expect(page.getByTestId('battle-result-overlay')).toBeVisible()
  expect(errors).toEqual([])
})

test('Chronist provisions its full testing library, Essence artwork and explicit temporal rules', async ({
  page,
}, testInfo) => {
  test.setTimeout(150000)
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `p4-chronist-${testInfo.project.name}-${Date.now()}@example.com`,
    password: 'P4-chronist-disposable-2026!',
    characterName: `Chronist ${suffix}`,
  })
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management' })
  await management
    .locator('label')
    .filter({ hasText: /^Proposed Primary/ })
    .locator('select')
    .selectOption('chronist')
  await page.getByRole('button', { name: 'Commit Chronist as Primary' }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Chronist')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const list = page.getByTestId('learned-skill-list')
  await expect(list.locator('article')).toHaveCount(8)
  await expect(page.getByTestId('active-essence')).toHaveText('Borrowed Hour')
  const artwork = dialog.locator('img[src*="chronist-256-v01.webp"]').first()
  await expect(artwork).toBeVisible()
  await expect
    .poll(() => artwork.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
  const haste = list.locator('article').filter({ has: page.getByText('Haste', { exact: true }) })
  await haste.locator('summary').click()
  await expect(haste).toContainText('next round')
  const rewind = list.locator('article').filter({ hasText: 'Rewind Step' })
  await rewind.locator('summary').click()
  await expect(rewind).toContainText('turn')
  expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1)).toBe(
    false,
  )
  await testInfo.attach(`phase4-chronist-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
