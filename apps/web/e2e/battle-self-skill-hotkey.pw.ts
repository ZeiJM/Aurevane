import { expect, test, type Route } from '@playwright/test'
import type { CharacterBuildContext } from '../src/server/character/character-build-service'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('self Skill second press commits directly and respects text focus during the preview', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Shared keyboard execution contract')
  test.slow()
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `self-hotkey-${Date.now()}@example.com`,
    password: 'Self-hotkey-browser-2026!',
    characterName: `Self ${suffix}`,
  })
  const buildResponse = await page.request.get('/api/character/build/skills')
  expect(buildResponse.ok()).toBe(true)
  const { context } = (await buildResponse.json()) as { context: CharacterBuildContext }
  expect(context.current.definition.id).toBe('vanguard')
  expect(
    context.disciplineSkills.learnedSkills.find(
      (entry) => entry.definition.id === 'vanguard.brace' && entry.activeSource,
    )?.definition.target.kind,
  ).toBe('self')
  await page.goto('/game/nexus')
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const brace = page
    .getByTestId('learned-skill-list')
    .locator('article')
    .filter({ has: page.getByText('Brace', { exact: true }) })
    .getByRole('checkbox')
  if (!(await brace.isChecked())) {
    const checked = page.getByTestId('learned-skill-list').getByRole('checkbox', { checked: true })
    if ((await checked.count()) >= context.disciplineSkills.capacity) {
      const removed = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/character/build/skills') &&
          response.request().method() === 'PUT',
      )
      await checked.first().uncheck()
      expect((await removed).ok()).toBe(true)
    }
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/skills') &&
        response.request().method() === 'PUT',
    )
    await brace.check()
    expect((await saved).ok()).toBe(true)
  }
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  const skill = root.getByRole('button', { name: /^Selected Brace,/ })
  await expect(skill).toBeEnabled()
  const hotkey = (await skill.getAttribute('data-battle-skill-hotkey'))!
  expect(hotkey).toMatch(/^[4-7]$/)

  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const sessionId = new URL(page.url()).pathname.split('/').at(-1)!
  const beforeResponse = await page.request.get(`/api/battles/${sessionId}`)
  expect(beforeResponse.ok()).toBe(true)
  const before = (await beforeResponse.json()).battle as BattleSessionView
  const commitRequests: unknown[] = []
  const previewRequests: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/intents')) {
      commitRequests.push(request.postDataJSON())
    }
    if (request.method() === 'POST' && request.url().endsWith('/preview')) {
      previewRequests.push(request.postDataJSON())
    }
  })
  let releasePreview!: () => void
  const previewGate = new Promise<void>((resolve) => {
    releasePreview = resolve
  })
  let observed!: () => void
  const previewReady = new Promise<void>((resolve) => {
    observed = resolve
  })
  let previewCost = 0
  let heldTask: Promise<void> | undefined
  const holdPreview = (route: Route) => {
    heldTask = (async () => {
      const response = await route.fetch()
      const preview = (await response.json()).battlePreview.preview
      expect(preview).toMatchObject({ legal: true, actionId: 'vanguard.brace' })
      previewCost = preview.actionEconomyCost
      observed()
      await previewGate
      if (!route.request().failure()) await route.fulfill({ response })
    })()
    return heldTask
  }
  await page.route('**/api/battles/*/preview', holdPreview, { times: 1 })
  const hotkeyCode = `Digit${hotkey}`
  try {
    await root.focus()
    await page.keyboard.press(hotkey)
    await expect(skill).toHaveAttribute('aria-pressed', 'true')
    await previewReady
    expect(commitRequests).toHaveLength(0)
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.id = 'self-hotkey-focus-input'
      input.setAttribute('aria-label', 'Keyboard focus boundary')
      document.body.append(input)
      input.focus()
    })
    await page.keyboard.press(hotkey)
    await page.keyboard.press('Enter')
    expect(commitRequests).toHaveLength(0)
    releasePreview()
    await heldTask
    await expect(skill).toBeEnabled()
    expect(commitRequests).toHaveLength(0)
    expect(previewRequests).toHaveLength(1)
    const unchangedResponse = await page.request.get(`/api/battles/${sessionId}`)
    expect(unchangedResponse.ok()).toBe(true)
    const unchanged = (await unchangedResponse.json()).battle as BattleSessionView
    expect(unchanged.battleVersion).toBe(before.battleVersion)
    expect(unchanged.snapshot).toEqual(before.snapshot)
  } finally {
    releasePreview()
    await heldTask
    await page.unroute('**/api/battles/*/preview', holdPreview)
  }
  await root.getByRole('button', { name: 'Cancel Action', exact: true }).click()
  await root.focus()
  let releaseExecutionPreview!: () => void
  let forecastReleased = false
  const executionPreviewGate = new Promise<void>((resolve) => {
    releaseExecutionPreview = () => {
      forecastReleased = true
      resolve()
    }
  })
  let executionPreviewTask: Promise<void> | undefined
  const holdExecutionPreview = (route: Route) => {
    executionPreviewTask = (async () => {
      await executionPreviewGate
      if (!route.request().failure()) await route.continue()
    })()
    return executionPreviewTask
  }
  await page.route('**/api/battles/*/preview', holdExecutionPreview, { times: 1 })
  // This second gesture arrives after selection DOM commits, before passive effects.
  // It must observe the selected self Skill immediately, without waiting for a forecast.
  await skill.evaluate((button, code) => {
    const observer = new MutationObserver(() => {
      if (button.getAttribute('aria-pressed') !== 'true') return
      observer.disconnect()
      button.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }))
    })
    observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] })
  }, hotkeyCode)
  const committed = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/intents'),
  )
  try {
    await page.keyboard.press(hotkey)
    const response = await committed
    const body = await response.json()
    expect(response.ok(), JSON.stringify(body)).toBe(true)
    expect(forecastReleased).toBe(false)
    expect(response.request().postDataJSON()).toMatchObject({
      expectedBattleVersion: before.battleVersion,
      intent: { kind: 'action', actionId: 'vanguard.brace', target: { kind: 'self' } },
    })
    expect(commitRequests).toHaveLength(1)
    const after = body.battle as BattleSessionView
    expect(after.battleVersion).toBe(before.battleVersion + 1)
    await expect(
      root.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', `${100 - previewCost}`)
  } finally {
    releaseExecutionPreview()
    await executionPreviewTask
    await page.unroute('**/api/battles/*/preview', holdExecutionPreview)
  }
  expect(commitRequests).toHaveLength(1)
})
