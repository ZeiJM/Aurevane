import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function expectKeyboardContained(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true)
  const controls = dialog.locator('input:enabled, button:enabled')
  await controls.first().focus()
  await page.keyboard.press('Shift+Tab')
  await expect(controls.last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(controls.first()).toBeFocused()
  await page.getByTestId('delete-account-button').evaluate((element) => element.focus())
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
}

for (const kind of ['character', 'account'] as const) {
  test(`${kind} deletion keeps focus contained and cannot dismiss a pending request`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000)
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
    if (!['localhost', '127.0.0.1'].includes(host))
      throw new Error('Deletion dialog review requires disposable local Supabase.')

    const suffix = `${Date.now()}${info.workerIndex}`
      .split('')
      .map((digit) => String.fromCharCode(65 + Number(digit)))
      .join('')
    const characterName = `Aurelia ${suffix}`
    const password = 'Disposable-dialog-review-2026!'
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await provisionAccountAndEnterCharacter({
      page,
      email: `dialog-${kind}-${info.project.name}-${Date.now()}@example.test`,
      password,
      characterName,
    })
    await page.goto('/game')
    const opener =
      kind === 'character'
        ? page.getByRole('button', { name: 'Delete Character', exact: true })
        : page.getByTestId('delete-account-button')
    const dialog = page.getByRole('dialog')
    const originalOverflow = await page.evaluate(() => document.documentElement.style.overflow)
    await opener.click()
    await expectKeyboardContained(page, dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe(
      originalOverflow,
    )

    await opener.click()
    await page.mouse.click(2, 2)
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()

    await opener.click()
    const submit = dialog.getByRole('button', {
      name: kind === 'character' ? 'Start 24-hour deletion' : 'Start 24-hour account deletion',
      exact: true,
    })
    await expect(submit).toBeDisabled()
    await dialog.locator('input').fill(kind === 'character' ? `DELETE ${characterName}` : password)
    await expect(submit).toBeEnabled()
    const requests: { method: string; body: Record<string, unknown> }[] = []
    let releaseFailure: () => void = () => {
      throw new Error('The response gate was not initialized.')
    }
    const responseGate = new Promise<void>((resolve) => {
      releaseFailure = resolve
    })
    const routePattern =
      kind === 'character' ? '**/api/characters/*/deletion' : '**/api/account/deletion'
    // Only the failure response is simulated. Account/character creation above is real.
    await page.route(routePattern, async (route) => {
      requests.push({ method: route.request().method(), body: route.request().postDataJSON() })
      await responseGate
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Temporary deletion-test interruption.' } }),
      })
    })
    await submit.click()
    await expect(dialog).toHaveAttribute('aria-busy', 'true')
    await expect(dialog.locator('input:enabled, button:enabled')).toHaveCount(0)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.mouse.click(2, 2)
    await expect(dialog).toBeVisible()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual({
      method: 'POST',
      body: kind === 'character' ? { confirmationPhrase: `DELETE ${characterName}` } : { password },
    })
    releaseFailure()
    await expect(dialog.getByRole('alert')).toHaveText('Temporary deletion-test interruption.')
    await expect(dialog).not.toHaveAttribute('aria-busy', 'true')
    await expectKeyboardContained(page, dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(requests).toHaveLength(1) // Dismissal must not send a deletion/cancellation request.
    await page.unroute(routePattern)

    if (kind === 'account') {
      // Real disposable-account scheduling and cancellation, not a fabricated pending flag.
      await opener.click()
      await dialog.getByLabel('Current account password').fill(password)
      await dialog.getByRole('button', { name: 'Start 24-hour account deletion' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(opener).toContainText('Account deletion')
      await opener.click()
      await expectKeyboardContained(page, dialog)
      await expect(dialog).toContainText('Your account is in its 24-hour grace period.')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await page.reload()
      await expect(page.getByTestId('delete-account-button')).toContainText('Account deletion')
      await page.getByTestId('delete-account-button').click()
      await dialog.getByRole('button', { name: 'Cancel account deletion', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByTestId('delete-account-button')).toHaveText('Delete Account')
    }
    expect(errors).toEqual([])
  })
}
