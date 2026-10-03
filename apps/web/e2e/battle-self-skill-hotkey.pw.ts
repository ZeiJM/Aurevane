import { expect, test } from '@playwright/test'
import type { CharacterBuildContext } from '../src/server/character/character-build-service'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('self Skill second press waits for legality and respects text focus during the preview', async ({
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

  let releasePreview: () => void = () => undefined
  const previewGate = new Promise<void>((resolve) => {
    releasePreview = resolve
  })
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
  await page.route('**/api/battles/*/preview', async (route) => {
    const response = await route.fetch()
    await previewGate
    // The second gesture waits for this same forecast; only its live legal receipt can commit.
    if (route.request().failure()) return
    await route.fulfill({ response })
  })
  const pendingPreview = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/preview'),
  )
  const hotkeyCode = `Digit${hotkey}`
  await skill.evaluate((button, code) => {
    const observer = new MutationObserver(() => {
      if (button.getAttribute('aria-pressed') !== 'true') return
      observer.disconnect()
      // This native event arrives after the selection DOM commits, before passive effects run.
      button.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }))
    })
    observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] })
  }, hotkeyCode)
  await root.focus()
  await page.keyboard.press(hotkey)
  await expect(skill).toHaveAttribute('aria-pressed', 'true')
  await pendingPreview
  await expect(skill).toBeDisabled()
  expect(previewRequests).toHaveLength(1)
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.id = 'self-hotkey-focus-input'
    input.setAttribute('aria-label', 'Keyboard focus boundary')
    document.body.append(input)
    input.focus()
  })
  releasePreview()
  await expect(skill).toBeEnabled()
  expect(commitRequests).toHaveLength(0)
  expect(previewRequests).toHaveLength(1)
  await page.unroute('**/api/battles/*/preview')
  await root.getByRole('button', { name: 'Cancel Action', exact: true }).click()
  await root.focus()
  await root.locator('[data-battle-notice]').evaluate((notice) => {
    const observer = new MutationObserver(() => {
      if (!notice.textContent?.includes('Skill ready')) return
      observer.disconnect()
      notice.closest('main')!.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Enter',
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    observer.observe(notice, { childList: true, subtree: true, characterData: true })
  })
  const committed = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/intents'),
  )
  await page.keyboard.press(hotkey)
  expect((await committed).postDataJSON()).toMatchObject({
    intent: { kind: 'action', actionId: 'vanguard.brace', target: { kind: 'self' } },
  })
  expect(commitRequests).toHaveLength(1)
  expect(previewRequests).toHaveLength(2)
})
