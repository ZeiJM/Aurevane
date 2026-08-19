import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  return `Diag${Date.now()}`
}

test.only('diagnoses A2 movement preview path', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  test.slow()

  const characterName = uniqueCharacterName()
  const previewRequests: string[] = []
  const previewResponses: string[] = []

  page.on('request', (request) => {
    if (!request.url().includes('/preview')) return
    const line = `${request.method()} ${request.url()} ${request.postData() ?? ''}`
    previewRequests.push(line)
    console.log(`A2_DIAG_REQUEST ${line}`)
  })
  page.on('response', async (response) => {
    if (!response.url().includes('/preview')) return
    let body = '<unreadable>'
    try {
      body = await response.text()
    } catch {}
    const line = `${response.status()} ${response.url()} ${body}`
    previewResponses.push(line)
    console.log(`A2_DIAG_RESPONSE ${line}`)
  })
  page.on('requestfailed', (request) => {
    if (request.url().includes('/preview')) {
      console.log(`A2_DIAG_FAILED ${request.url()} ${request.failure()?.errorText ?? 'unknown'}`)
    }
  })
  page.on('console', (message) => console.log(`A2_DIAG_BROWSER ${message.type()} ${message.text()}`))

  await createAccountAndEnterCharacter({
    page,
    email: `a2-diag-${Date.now()}@example.com`,
    password: 'A2-movement-diag-2026!',
    characterName,
  })

  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await page.getByRole('button', { name: /Strike Drill/ }).click()
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const instruction = page.getByTestId('combat-mode-instruction')
  const progress = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  const moveButton = page.getByRole('region', { name: 'Command Deck' }).getByRole('button', {
    name: /Move/,
  })
  const target = page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ })
  const playerTile = page.getByRole('button', { name: new RegExp(`occupied by ${characterName}`) })

  console.log(`A2_DIAG_PLAYER_TILE ${await playerTile.getAttribute('aria-label')}`)
  console.log(`A2_DIAG_TARGET_CLASS_BEFORE ${await target.getAttribute('class')}`)
  console.log(`A2_DIAG_AP ${await progress.getAttribute('aria-valuenow')}`)

  await moveButton.click()
  await expect(instruction).toContainText('Move · 25 AP per normal tile')
  console.log(`A2_DIAG_MODE ${await instruction.textContent()}`)
  console.log(`A2_DIAG_TARGET_CLASS_MOVE ${await target.getAttribute('class')}`)

  await target.click()
  await page.waitForTimeout(2_000)

  console.log(`A2_DIAG_AFTER ${await instruction.textContent()}`)
  console.log(`A2_DIAG_TARGET_CLASS_AFTER ${await target.getAttribute('class')}`)
  console.log(`A2_DIAG_PREVIEW_REQUEST_COUNT ${previewRequests.length}`)
  console.log(`A2_DIAG_PREVIEW_RESPONSE_COUNT ${previewResponses.length}`)
  console.log(
    `A2_DIAG_CONFIRM_ENABLED ${await page.getByRole('button', { name: 'Confirm Action' }).isEnabled()}`,
  )
  console.log(`A2_DIAG_PROPOSED_COUNT ${await page.getByText(/AP proposed/).count()}`)

  expect(previewRequests.length, 'movement click must send a preview request').toBeGreaterThan(0)
  expect(previewResponses.length, 'movement preview request must receive a response').toBeGreaterThan(0)
  await expect(instruction).toContainText('Movement path ready')
})
