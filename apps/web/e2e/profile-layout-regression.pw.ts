import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { SUPERNATURAL_STORY_DEFINITION } from '@aurevane/game-core/character/supernatural-content'
import type { SupernaturalStoryState } from '@aurevane/game-core/character/supernatural-state'
import type { SupernaturalChoiceOption } from '../src/components/character/character-supernatural-choice-controls'
import { previewDiscipline } from './discipline-library-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Exercise real authentication, character creation, production CSS and existing dialogs.
// Only disposable accounts in the local Supabase instance are used.
test('approved Profile and Haven keep the frame fixed and complete controls reachable', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname,
  )
  const suffix = `${Date.now()}${info.workerIndex}`.replace(/\d/g, (d) =>
    String.fromCharCode(65 + Number(d)),
  )
  await provisionAccountAndEnterCharacter({
    page,
    email: `adventure-${suffix}@example.test`,
    password: 'Disposable-layout-review-2026!',
    characterName: `Wayfarer ${suffix}`,
  })
  const mobile = info.project.name === 'mobile-chromium'
  await page.setViewportSize({ width: mobile ? 390 : 1366, height: mobile ? 844 : 900 })
  const shell = page.getByTestId('authenticated-shell')
  const rail = shell.locator('[data-av-game-rail]')
  await expect(rail).toBeVisible()
  await expect(shell.getByTestId('character-rail-profile')).toContainText(`Wayfarer ${suffix}`)
  for (const attribute of ['might', 'finesse', 'vitality', 'agility', 'intellect', 'resolve'])
    await expect(page.getByTestId(`profile-attribute-${attribute}`)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Core Stats', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Combat Stats', exact: true })).toBeVisible()
  const combatGrid = page.locator('[data-profile-combat-grid]')
  await expect(combatGrid.locator('[data-profile-stat-group]')).toHaveCount(6)
  if (!mobile) {
    for (const attribute of ['might', 'finesse', 'vitality', 'agility', 'intellect', 'resolve']) {
      const core = await page.getByTestId(`profile-attribute-${attribute}`).boundingBox()
      const combat = await combatGrid
        .locator(`[data-profile-stat-group="${attribute}"]`)
        .boundingBox()
      expect(combat!.y).toBeGreaterThan(core!.y + core!.height)
      expect(Math.abs(combat!.x - core!.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(combat!.width - core!.width)).toBeLessThanOrEqual(1)
    }
  }
  for (const stat of await combatGrid.getByRole('button').all()) {
    expect(await stat.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(
      1,
    )
  }
  await page.getByTestId('derived-stat-physicalPower').click()
  const statHelp = page.getByTestId('profile-detail-popover')
  await expect(statHelp.getByRole('heading', { name: 'Physical Power', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(statHelp).toHaveCount(0)
  await expect(combatGrid.locator('[data-profile-stat-group] > header')).toHaveCount(0)
  await expect(combatGrid.getByRole('button')).toHaveCount(13)
  {
    const fitViewports = mobile
      ? [
          [320, 740],
          [390, 844],
        ]
      : [
          [1280, 720],
          [1366, 768],
          [1536, 614],
          [1585, 900],
          [1440, 900],
          [1728, 887],
          [1917, 987],
          [1920, 1080],
        ]
    for (const [width, height] of fitViewports) {
      await page.setViewportSize({ width, height })
      const fit = await shell.locator('[data-profile-sheet]').evaluate((sheet, mobile) => {
        const bounds = sheet.getBoundingClientRect()
        const main = document.querySelector<HTMLElement>('#game-main')!
        const mainBounds = main.getBoundingClientRect()
        const controls = sheet.querySelectorAll<HTMLElement>(
          '[data-attribute], [data-profile-stat-group] button, [data-profile-reset-control] button, [data-testid="profile-build-tendencies"]',
        )
        return {
          overflow: sheet.scrollHeight - sheet.clientHeight,
          mainOverflow: main.scrollHeight - main.clientHeight,
          statCount: sheet.querySelectorAll('[data-attribute], [data-profile-stat-group] button')
            .length,
          textOverflow: [
            ...sheet.querySelectorAll<HTMLElement>(
              'button[data-attribute], [data-profile-stat-group] button',
            ),
          ].flatMap((button) => {
            const buttonBounds = button.getBoundingClientRect()
            return [...button.querySelectorAll('span, strong')].flatMap((label) => {
              const text = label.firstChild
              if (!text || text.nodeType !== Node.TEXT_NODE) return []
              return [...(text.textContent ?? '').matchAll(/\S+/g)].flatMap((word) => {
                const range = document.createRange()
                range.setStart(text, word.index!)
                range.setEnd(text, word.index! + word[0].length)
                const rects = [...range.getClientRects()]
                return rects.length > 1 ||
                  rects.some(
                    (rect) =>
                      rect.left < buttonBounds.left - 1 ||
                      rect.right > buttonBounds.right + 1 ||
                      rect.top < buttonBounds.top - 1 ||
                      rect.bottom > buttonBounds.bottom + 1,
                  )
                  ? [word[0]]
                  : []
              })
            })
          }),
          graphOverlap: [
            ...sheet.querySelectorAll('[data-testid="profile-build-tendencies"] svg g'),
          ].flatMap((group) => {
            const texts = group.querySelectorAll('text')
            if (texts.length !== 2) return []
            return texts[0].getBoundingClientRect().bottom >
              texts[1].getBoundingClientRect().top + 0.5
              ? [texts[0].textContent]
              : []
          }),
          clipped: [...controls]
            .filter((control) => {
              const rect = control.getBoundingClientRect()
              return (
                rect.top < (mobile ? bounds.top : Math.max(bounds.top, mainBounds.top)) - 1 ||
                rect.bottom >
                  (mobile ? bounds.bottom : Math.min(bounds.bottom, mainBounds.bottom)) + 1 ||
                rect.left < bounds.left - 1 ||
                rect.right > bounds.right + 1
              )
            })
            .map((control) => control.getAttribute('data-testid') ?? control.textContent),
        }
      }, mobile)
      if (!mobile)
        expect(fit.overflow, `Profile inner scrolling at ${width}×${height}`).toBeLessThanOrEqual(1)
      if (!mobile)
        expect(
          fit.mainOverflow,
          `Profile main scrolling at ${width}×${height}`,
        ).toBeLessThanOrEqual(1)
      expect(fit.statCount).toBe(19)
      expect(fit.textOverflow, `Profile broken or clipped words at ${width}×${height}`).toEqual([])
      expect(fit.graphOverlap, `Profile overlapping graph labels at ${width}×${height}`).toEqual([])
      expect(fit.clipped, `Profile clipped controls at ${width}×${height}`).toEqual([])
    }
    await page.setViewportSize({ width: mobile ? 390 : 1366, height: mobile ? 844 : 900 })
  }
  await page.getByRole('button', { name: 'About Build Tendencies', exact: true }).click()
  await expect(
    statHelp.getByRole('heading', { name: 'Build Tendencies', exact: true }),
  ).toBeVisible()
  await expect(statHelp).toContainText('scaled to your highest Core Stat')
  await expect(statHelp).toContainText('Damage follows Might')
  await page.keyboard.press('Escape')
  await expect(statHelp).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Current Path' })).toHaveCount(0)
  const headerBefore = await shell.locator(':scope > header').boundingBox()
  const railBefore = await rail.boundingBox()
  const footerBefore = await shell.locator(':scope > footer').boundingBox()
  await page.locator('#game-main').evaluate((node) => node.scrollTo(0, node.scrollHeight))
  expect(await shell.locator(':scope > header').boundingBox()).toEqual(headerBefore)
  expect(await rail.boundingBox()).toEqual(railBefore)
  expect(await shell.locator(':scope > footer').boundingBox()).toEqual(footerBefore)
  if (!mobile) expect(railBefore!.width).toBeCloseTo(190, 0)
  await page.getByRole('button', { name: 'Reset Stats' }).click()
  const reset = page.getByRole('dialog', { name: 'Redistribute Attributes' })
  await expect(reset).toBeVisible()
  for (const attribute of ['Might', 'Finesse', 'Vitality', 'Agility', 'Intellect', 'Resolve'])
    await expect(reset.getByRole('button', { name: `Increase ${attribute}` })).toBeVisible()
  await reset.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/haven')
  await expect(page.getByRole('heading', { name: /^Welcome home,/ })).toBeVisible()
  await expect(page.getByText('Current Path', { exact: true })).toBeVisible()
  await page.goto('/game/loadout')
  await expect(page).toHaveURL(/\/game\/nexus$/)
  const loadoutTabs = page.getByRole('navigation', { name: 'Loadout sections' })
  await expect(loadoutTabs.getByRole('link', { name: 'Nexus', exact: true })).toHaveAttribute(
    'href',
    '/game/nexus',
  )
  await expect(loadoutTabs.getByRole('link', { name: 'Items', exact: true })).toHaveAttribute(
    'href',
    '/game/loadout/items',
  )
  await page.goto('/game/nexus')
  for (const name of ['Manage Disciplines', 'Manage Techniques']) {
    await page.getByRole('button', { name: new RegExp(name) }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
})

test('a populated hybrid loadout keeps all four Techniques and management actions reachable', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
  const viewport =
    info.project.name === 'mobile-chromium'
      ? { width: 390, height: 844 }
      : info.project.name === 'laptop-chromium'
        ? { width: 980, height: 1000 }
        : { width: 1728, height: 887 }
  await page.setViewportSize(viewport)
  const characterName =
    info.project.name === 'mobile-chromium'
      ? 'Aster Dawn'
      : info.project.name === 'laptop-chromium'
        ? 'Aster Reed'
        : 'Aster Vale'
  await provisionAccountAndEnterCharacter({
    page,
    email: `populated-${info.project.name}-${Date.now()}@example.com`,
    password: 'Disposable-layout-review-2026!',
    characterName,
  })
  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  await page.locator('[data-testid="primary-build-panel"] > button').click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await previewDiscipline(management, 'Secondary', 'Lifebinder')
  const commitBuild = management.getByRole('button', { name: /Confirm Change/ })
  await expect(commitBuild).toBeEnabled()
  const buildSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/disciplines') &&
      response.request().method() === 'PUT',
  )
  await commitBuild.click()
  expect((await buildSaved).status()).toBe(200)
  await expect(page.getByTestId('secondary-discipline-chip')).toHaveText('Lifebinder')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('[data-testid="skill-build-panel"] > button').click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  await expect(techniques).toBeVisible()

  const squareFrames = techniques.locator('[data-av-square-media="true"]')
  expect(await squareFrames.count()).toBeGreaterThan(0)
  const frameMetrics = await squareFrames.evaluateAll((frames) =>
    frames.map((frame) => {
      const rect = frame.getBoundingClientRect()
      const image = frame.querySelector('img')
      return {
        width: rect.width,
        height: rect.height,
        fit: image ? getComputedStyle(image).objectFit : null,
      }
    }),
  )
  for (const metric of frameMetrics) {
    expect(Math.abs(metric.width - metric.height)).toBeLessThanOrEqual(1)
    if (metric.fit) expect(metric.fit).toBe('contain')
  }

  const choices = techniques
    .getByTestId('learned-skill-list')
    .locator('input[type="checkbox"]:enabled')
  expect(await choices.count()).toBeGreaterThanOrEqual(4)
  const coarseTechniquePointer = await page.evaluate(
    () => window.matchMedia('(hover: none), (pointer: coarse)').matches,
  )
  for (let index = 0; index < 4; index += 1) {
    const choice = choices.nth(index)
    if (await choice.isChecked()) continue
    const skillsSaved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/skills') &&
        response.request().method() === 'PUT',
    )
    if (coarseTechniquePointer) {
      await choice.locator('..').dblclick()
    } else {
      await choice.check()
    }
    expect((await skillsSaved).status()).toBe(200)
  }
  await expect(techniques.getByRole('button', { name: 'Commit Selected Techniques' })).toHaveCount(
    0,
  )
  await page.goto('/game/nexus')
  await expect(page.getByTestId('secondary-discipline-chip')).toHaveText('Lifebinder')
  const loadout = page.locator('[data-arsenal-workspace]')
  const equippedOverview = loadout.locator(
    '[data-arsenal-technique-row="true"][data-equipped="true"]',
  )
  await expect(equippedOverview).toHaveCount(4)
  for (const card of await equippedOverview.all()) {
    await expect(card).not.toContainText('AP')
  }
  await expect(page.locator('[aria-labelledby="nexus-attunement-heading"]')).toContainText(
    'Resonance',
  )
  await expect(page.getByText('Pronouns', { exact: true })).toHaveCount(0)
  const screenshot = await page.screenshot({ fullPage: true, scale: 'css' })
  const label = `profile-populated-${viewport.width}x${viewport.height}`
  await info.attach(label, { body: screenshot, contentType: 'image/png' })
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (output) {
    await writeFile(path.join(output, `${label}.png`), screenshot)
    await writeFile(
      path.join(output, `${label}-viewport.png`),
      await page.screenshot({ scale: 'css' }),
    )
  }
  expect(
    await loadout.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1)
  for (const selector of [
    '[data-testid="primary-build-panel"] > button',
    '[data-testid="skill-build-panel"] > button',
  ]) {
    const action = page.locator(selector)
    await action.scrollIntoViewIfNeeded()
    await action.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  }
})

for (const pathChoice of [
  { path: 'ascended', label: 'Ascension', identity: 'Ascended' },
  { path: 'severed', label: 'Severence', identity: 'Severed' },
] as const) {
  test(`Haven ${pathChoice.label} requires confirmation and stays bound after reload`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000)
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
    expect(['127.0.0.1', 'localhost']).toContain(api.hostname)
    const suffix = randomUUID()
      .replaceAll('-', '')
      .slice(0, 12)
      .replace(/[0-9]/g, (digit) => String.fromCharCode(65 + Number(digit)))
    const characterName = `Path ${suffix}`
    await provisionAccountAndEnterCharacter({
      page,
      email: `path-${randomUUID()}@example.com`,
      password: 'Disposable-path-review-2026!',
      characterName,
    })
    await page.goto('/game/haven')
    const panel = page.getByRole('complementary', { name: 'Current Path' })
    async function currentPath() {
      const response = await page.request.get('/api/character/supernatural')
      expect(response.ok()).toBe(true)
      return response.json() as Promise<{
        state: SupernaturalStoryState | null
        choices: SupernaturalChoiceOption[]
      }>
    }
    expect(await currentPath()).toEqual({ state: null, choices: [], currentIdentity: null })
    await expect(panel).toContainText('Path information is unavailable')
    await expect(panel.locator('[data-supernatural-choice]')).toHaveCount(0)

    // Disposable fixture setup only: make the existing authored threshold available.
    // Every choice below goes through the real authenticated API and private persistence.
    const container = execFileSync(
      'docker',
      ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')[0]
    if (!container) throw new Error('Disposable local database is unavailable.')
    expect(characterName).toMatch(/^Path [a-zA-Z]+$/)
    const story = SUPERNATURAL_STORY_DEFINITION
    execFileSync('docker', [
      'exec',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      `select public.initialize_character_supernatural_story_state_v1(c.user_id,c.id,'${story.id}',${story.contentVersion},'${story.initialNodeId}') from public.characters c where c.name='${characterName}';`,
    ])
    await page.reload()
    await expect(panel.getByRole('heading', { name: 'Unawakened', exact: true })).toBeVisible()
    const available = await currentPath()
    expect(available.state?.path).toBe('unawakened')
    expect(available.choices).toHaveLength(2)
    const choice = available.choices.find((option) => option.path === pathChoice.path)!
    const other = available.choices.find((option) => option.path !== pathChoice.path)!
    const command = {
      expectedStateVersion: available.state!.stateVersion,
      idempotencyKey: randomUUID(),
      transitionId: choice.transitionId,
      transitionContentVersion: choice.transitionContentVersion,
      confirmPermanentChoice: true,
    }
    const unconfirmed = await page.request.put('/api/character/supernatural', {
      data: { ...command, confirmPermanentChoice: false },
    })
    expect(unconfirmed.status()).toBe(400)
    expect((await unconfirmed.json()).error.code).toBe('INVALID_REQUEST')
    const unapproved = await page.request.put('/api/character/supernatural', {
      data: { ...command, transitionId: 'not.an.authored.transition' },
    })
    expect(unapproved.status()).toBe(400)
    expect((await unapproved.json()).error.code).toBe('INVALID_REQUEST')
    expect(await currentPath()).toEqual(available)

    let writes = 0
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().endsWith('/api/character/supernatural'))
        writes++
    })
    const choose = panel.getByRole('button', { name: `Choose ${pathChoice.label}`, exact: true })
    await choose.focus()
    await choose.press('Enter')
    await expect(panel).toContainText('Your path persists through Rekindling')
    expect(writes).toBe(0)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(writes).toBe(0)
    expect(await currentPath()).toEqual(available)
    await choose.click()
    const output = process.env.LAYOUT_REVIEW_OUTPUT
    if (output) {
      await mkdir(output, { recursive: true })
      await page.screenshot({
        path: path.join(output, `profile-path-confirm-${pathChoice.path}-${info.project.name}.png`),
        fullPage: true,
      })
    }
    const [request, response] = await Promise.all([
      page.waitForRequest(
        (request) =>
          request.method() === 'PUT' && request.url().endsWith('/api/character/supernatural'),
      ),
      page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().endsWith('/api/character/supernatural'),
      ),
      panel.getByRole('button', { name: `Confirm ${pathChoice.label}`, exact: true }).click(),
    ])
    expect(response.ok()).toBe(true)
    expect(writes).toBe(1)
    await expect(
      panel.getByRole('heading', { name: pathChoice.identity, exact: true }),
    ).toBeVisible()
    await expect(panel.locator('[data-supernatural-choice]')).toHaveCount(0)
    const bound = await currentPath()
    expect(bound.state?.path).toBe(pathChoice.path)
    expect(bound.state?.stateVersion).toBe(available.state!.stateVersion + 1)
    expect(bound.choices).toEqual([])
    await page.reload()
    await expect(
      panel.getByRole('heading', { name: pathChoice.identity, exact: true }),
    ).toBeVisible()
    expect(await currentPath()).toEqual(bound)
    // Stale retries and a forged opposite choice cannot switch the committed path.
    const replay = await page.request.put('/api/character/supernatural', {
      data: request.postDataJSON(),
    })
    expect(replay.status()).toBe(409)
    expect((await replay.json()).error.code).toBe('STALE_VERSION')
    const switched = await page.request.put('/api/character/supernatural', {
      data: {
        ...command,
        expectedStateVersion: bound.state!.stateVersion,
        idempotencyKey: randomUUID(),
        transitionId: other.transitionId,
        transitionContentVersion: other.transitionContentVersion,
      },
    })
    expect(switched.status()).toBe(400)
    expect((await switched.json()).error.code).toBe('INVALID_REQUEST')
    expect(await currentPath()).toEqual(bound)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    if (output)
      await page.screenshot({
        path: path.join(output, `profile-path-bound-${pathChoice.path}-${info.project.name}.png`),
        fullPage: true,
      })
  })
}
