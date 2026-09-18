import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

test('Account gateway keeps the desktop entry workspace clear and readable', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop account composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')

  const shell = page.getByTestId('account-shell')
  const heroHeading = page.getByRole('heading', { level: 1, name: 'AUREVANE' })
  const entryHeading = page.getByRole('heading', { level: 2, name: 'Begin or return.' })
  const entryCard = entryHeading.locator('xpath=ancestor::*[@data-account-concept="true"]')
  const submit = page.getByRole('button', { name: 'Enter AUREVANE' })
  const footer = shell.locator('footer')

  await expect(shell).toBeVisible()
  await expect(heroHeading).toBeVisible()
  await expect(entryHeading).toBeVisible()
  await expect(submit).toBeVisible()
  await expect(footer).toBeVisible()
  await expect(
    page.getByText(/Sign in to resume your account, or create the account/i),
  ).toHaveCount(0)
  await expect(
    page.getByText('Your account identity stays separate from your future character identity.'),
  ).toHaveCount(0)
  await expect(page.getByText('Account & Security', { exact: true })).toHaveCount(0)
  await settle(page)

  const email = page.getByLabel('Email')
  const password = page.getByLabel('Password')
  await email.fill('layout@example.com')
  await password.fill('AurevaneTest!42')

  const metrics = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const card = document.querySelector<HTMLElement>('[data-account-concept="true"]')!
    const footerElement = document.querySelector<HTMLElement>(
      '[data-testid="account-shell"] > footer',
    )!
    const submitButton = Array.from(card.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enter AUREVANE'),
    )!
    const emailInput = card.querySelector<HTMLInputElement>('input[type="email"]')!
    const heading = hero.querySelector('h1')!
    const heroBox = hero.getBoundingClientRect()
    const headingBox = heading.getBoundingClientRect()
    const cardBox = card.getBoundingClientRect()
    const submitBox = submitButton.getBoundingClientRect()
    const footerBox = footerElement.getBoundingClientRect()
    const inputStyle = getComputedStyle(emailInput)
    const cardStyle = getComputedStyle(card)
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      heroLeft: heroBox.left,
      heroRight: heroBox.right,
      heroTop: heroBox.top,
      heroBottom: heroBox.bottom,
      headingTop: headingBox.top,
      cardLeft: cardBox.left,
      cardRight: cardBox.right,
      cardTop: cardBox.top,
      cardBottom: cardBox.bottom,
      cardScroll: card.scrollHeight - card.clientHeight,
      cardOverflowY: cardStyle.overflowY,
      submitBottom: submitBox.bottom,
      footerTop: footerBox.top,
      inputColor: inputStyle.color,
      inputFillColor: inputStyle.webkitTextFillColor,
    }
  })

  expect
    .soft(metrics.overflow, 'desktop account gateway has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect
    .soft(metrics.heroRight, 'desktop hero stays to the left of account entry')
    .toBeLessThanOrEqual(metrics.cardLeft + 1)
  expect
    .soft(metrics.cardBottom, 'desktop account card stays above the footer')
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  expect
    .soft(metrics.submitBottom, 'desktop submit action stays above the footer')
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  expect
    .soft(metrics.cardScroll, 'desktop account card has no internal scroll')
    .toBeLessThanOrEqual(1)
  expect
    .soft(metrics.cardOverflowY, 'desktop account card is not a scroll box')
    .not.toMatch(/auto|scroll/)
  expect
    .soft(metrics.headingTop, 'AUREVANE title is restored to the lower hero composition')
    .toBeGreaterThan(metrics.heroTop + (metrics.heroBottom - metrics.heroTop) * 0.45)
  expect
    .soft(metrics.inputColor, 'typed account text is white and readable')
    .toBe('rgb(255, 253, 247)')
  expect
    .soft(metrics.inputFillColor, 'browser text fill stays white and readable')
    .toBe('rgb(255, 253, 247)')
  await expect(entryCard).toHaveAttribute('data-av-surface', 'moonstone')

  const aetherMotion = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const shade = hero.children[1] as HTMLElement
    return {
      teal: getComputedStyle(shade, '::before').animationName,
      gold: getComputedStyle(shade, '::after').animationName,
      motes: getComputedStyle(hero, '::after').animationName,
    }
  })
  expect.soft(aetherMotion.teal, 'login has a flowing teal aether current').not.toBe('none')
  expect.soft(aetherMotion.gold, 'login has a flowing gold aether current').not.toBe('none')
  expect.soft(aetherMotion.motes, 'login has sparse drifting aether motes').not.toBe('none')

  const aetherStart = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const shade = hero.children[1] as HTMLElement
    return getComputedStyle(shade, '::before').transform
  })
  await page.waitForTimeout(600)
  const aetherAfter = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const shade = hero.children[1] as HTMLElement
    return getComputedStyle(shade, '::before').transform
  })
  expect.soft(aetherAfter, 'login aether current actually advances').not.toBe(aetherStart)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const shade = hero.children[1] as HTMLElement
    return {
      teal: getComputedStyle(shade, '::before').animationName,
      gold: getComputedStyle(shade, '::after').animationName,
      motes: getComputedStyle(hero, '::after').animationName,
    }
  })
  expect.soft(reducedMotion.teal, 'reduced motion disables teal aether flow').toBe('none')
  expect.soft(reducedMotion.gold, 'reduced motion disables gold aether flow').toBe('none')
  expect.soft(reducedMotion.motes, 'reduced motion disables aether motes').toBe('none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'account-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('Account gateway keeps mobile entry controls clear of the footer', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone account composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const shell = page.getByTestId('account-shell')
  const footer = shell.locator('footer')
  const email = page.getByLabel('Email')
  const password = page.getByLabel('Password')
  const submit = page.getByRole('button', { name: 'Enter AUREVANE' })

  await expect(shell).toBeVisible()
  await expect(page.getByRole('link', { name: 'News' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Manual' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Rules' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sound settings' })).toBeVisible()
  await settle(page)

  const initialMetrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    pageScroll: document.documentElement.scrollHeight - innerHeight,
  }))
  expect
    .soft(initialMetrics.overflow, 'phone account gateway has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect
    .soft(initialMetrics.pageScroll, 'phone account gateway never reports negative scroll range')
    .toBeGreaterThanOrEqual(0)
  await expect(page.getByText('Account & Security', { exact: true })).toHaveCount(0)
  await expect(
    page.getByText('Your account identity stays separate from your future character identity.'),
  ).toHaveCount(0)

  await email.scrollIntoViewIfNeeded()
  await expect(email).toBeInViewport({ ratio: 1 })
  await email.fill('layout@example.com')
  await password.fill('AurevaneTest!42')
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport({ ratio: 1 })
  const overlap = await page.evaluate(() => {
    const submit = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enter AUREVANE'),
    )!
    const footer = document.querySelector<HTMLElement>('[data-testid="account-shell"] > footer')!
    const submitRect = submit.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    return Math.max(
      0,
      Math.min(submitRect.bottom, footerRect.bottom) - Math.max(submitRect.top, footerRect.top),
    )
  })
  expect.soft(overlap, 'footer does not cover the mobile submit action').toBe(0)

  await footer.scrollIntoViewIfNeeded()
  await expect(footer).toBeInViewport({ ratio: 0.99 })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'account-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
