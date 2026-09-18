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
  await settle(page)

  const metrics = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const card = document.querySelector<HTMLElement>('[data-account-concept="true"]')!
    const footerElement = document.querySelector<HTMLElement>(
      '[data-testid="account-shell"] > footer',
    )!
    const submitButton = Array.from(card.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enter AUREVANE'),
    )!
    const heroBox = hero.getBoundingClientRect()
    const cardBox = card.getBoundingClientRect()
    const submitBox = submitButton.getBoundingClientRect()
    const footerBox = footerElement.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      heroLeft: heroBox.left,
      heroRight: heroBox.right,
      heroTop: heroBox.top,
      heroBottom: heroBox.bottom,
      cardLeft: cardBox.left,
      cardRight: cardBox.right,
      cardTop: cardBox.top,
      cardBottom: cardBox.bottom,
      submitBottom: submitBox.bottom,
      footerTop: footerBox.top,
    }
  })

  expect
    .soft(metrics.overflow, 'desktop account gateway has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect
    .soft(metrics.cardLeft, 'desktop account card stays inside the cinematic stage')
    .toBeGreaterThanOrEqual(metrics.heroLeft)
  expect
    .soft(metrics.cardRight, 'desktop account card stays inside the cinematic stage')
    .toBeLessThanOrEqual(metrics.heroRight)
  expect
    .soft(metrics.cardTop, 'desktop account card overlays the cinematic hero')
    .toBeGreaterThan(metrics.heroTop)
  expect
    .soft(metrics.cardBottom, 'desktop account card stays within the cinematic hero')
    .toBeLessThanOrEqual(metrics.heroBottom + 1)
  expect
    .soft(metrics.cardBottom, 'desktop account card stays above the footer')
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  expect
    .soft(metrics.submitBottom, 'desktop submit action stays above the footer')
    .toBeLessThanOrEqual(metrics.footerTop + 1)
  await expect(entryCard).toHaveAttribute('data-av-surface', 'moonstone')

  const ambientMotion = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const wordmark = document.querySelector<HTMLElement>('.brand__wordmark')!
    return {
      brand: getComputedStyle(wordmark, '::after').animationName,
      rune: getComputedStyle(hero, '::before').animationName,
      motes: getComputedStyle(hero, '::after').animationName,
    }
  })
  expect.soft(ambientMotion.brand, 'account wordmark has a restrained light sweep').not.toBe('none')
  expect.soft(ambientMotion.rune, 'account hero has a slow rune breath').not.toBe('none')
  expect.soft(ambientMotion.motes, 'account hero has sparse ambient motes').not.toBe('none')

  const moonlightStart = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const shade = hero.children[1] as HTMLElement
    return getComputedStyle(shade, '::after').transform
  })
  await page.waitForTimeout(600)
  const moonlightAfter = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const shade = hero.children[1] as HTMLElement
    return getComputedStyle(shade, '::after').transform
  })
  expect
    .soft(moonlightAfter, 'account moonlight transform actually advances')
    .not.toBe(moonlightStart)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('[aria-labelledby="aurevane-title"]')!
    const wordmark = document.querySelector<HTMLElement>('.brand__wordmark')!
    return {
      brand: getComputedStyle(wordmark, '::after').animationName,
      rune: getComputedStyle(hero, '::before').animationName,
      motes: getComputedStyle(hero, '::after').animationName,
    }
  })
  expect.soft(reducedMotion.brand, 'reduced motion disables the wordmark sweep').toBe('none')
  expect.soft(reducedMotion.rune, 'reduced motion disables the rune breath').toBe('none')
  expect.soft(reducedMotion.motes, 'reduced motion disables ambient mote drift').toBe('none')
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
  const security = page.getByText('Account & Security', { exact: true })

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
    .soft(initialMetrics.pageScroll, 'phone account gateway uses natural page scroll')
    .toBeGreaterThan(0)
  await expect(
    footer,
    'footer stays below the fold while entering account credentials',
  ).not.toBeInViewport()

  await email.scrollIntoViewIfNeeded()
  await expect(email).toBeInViewport({ ratio: 1 })
  await email.fill('layout@example.com')
  await password.fill('AurevaneTest!42')
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport({ ratio: 1 })
  await expect(footer, 'footer does not cover the mobile submit action').not.toBeInViewport()

  await security.scrollIntoViewIfNeeded()
  await expect(security).toBeInViewport({ ratio: 1 })
  await security.click()
  await expect(page.getByText(/one active gameplay login per account/i)).toBeVisible()

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
