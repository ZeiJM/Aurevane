import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function provision(page: Page, prefix: string) {
  const seed = randomUUID()
  const name = `${prefix} ${seed.replace(/[^a-z]/g, '').slice(0, 8)}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `${prefix}-${seed}@example.com`,
    password: 'Spectator-title-disposable-2026!',
    characterName: name,
  })
  return name
}

async function stableGeometry(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  return page.locator('main[data-pvp-spectator]').evaluate((root) =>
    [
      ...root.querySelectorAll(
        '#battlefield [data-board-auto-fit], [data-battle-combatant-card], [data-battle-combatant-card] [data-av-square-media]',
      ),
    ].map((node) => {
      const bounds = node.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    }),
  )
}

test('keeps the complete acting title clear of VS without resizing spectator artwork', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'Representative desktop and native mobile geometry',
  )
  test.setTimeout(180_000)
  const contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        baseURL,
        viewport: testInfo.project.use.viewport,
        isMobile: testInfo.project.use.isMobile,
        hasTouch: testInfo.project.use.hasTouch,
      }),
    ),
  )
  const [host, guest, watcher] = await Promise.all(contexts.map((context) => context.newPage()))
  try {
    const hostName = await provision(host!, 'TitleHost')
    const guestName = await provision(guest!, 'TitleGuest')
    await provision(watcher!, 'TitleWatcher')
    await host!.goto('/game/battle')
    await host!.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
    const created = host!.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/pvp/lobbies',
    )
    await host!.getByRole('button', { name: 'Create Battle Lobby' }).click()
    const createdResponse = await created
    expect(createdResponse.ok()).toBe(true)
    const { lobby } = await createdResponse.json()
    await guest!.goto(`/game/battle?join=${encodeURIComponent(lobby.lobbyKey)}`)
    await guest!
      .getByRole('dialog', { name: 'The arena is waiting.' })
      .getByRole('button', { name: 'Mark Ready' })
      .click()
    await host!
      .getByRole('dialog', { name: 'The arena is waiting.' })
      .getByRole('button', { name: 'Mark Ready' })
      .click()
    await expect(host!).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    const key = (await host!.locator('[data-pvp-spectator-key] strong').textContent())!.trim()
    await watcher!.goto(`/game/battle/spectate/${key}`)
    await expect(watcher!.locator('[data-battle-versus]')).toBeVisible()
    const baseline = await stableGeometry(watcher!)
    const response = await watcher!.request.get(`/api/pvp/spectate/${key}`)
    expect(response.ok()).toBe(true)
    const { spectator } = await response.json()
    const activeId = spectator.battle.snapshot.tactical.battle.currentTurn.combatantId
    const active = spectator.participants.find(
      (participant: { combatantId: string }) => participant.combatantId === activeId,
    )
    const title = `WWWWWWWWWWWW${randomUUID().replaceAll('-', '').slice(0, 8)}`
    expect(title).toHaveLength(20)
    const actor = active.characterName === hostName ? host! : guest!
    expect([hostName, guestName]).toContain(active.characterName)
    const saved = await actor.request.post('/api/account/titles/personal', {
      data: { characterId: active.characterId, title },
    })
    expect(saved.ok(), JSON.stringify(await saved.json())).toBe(true)
    const titleNode = watcher!.getByText(title, { exact: true })
    await expect(titleNode).toBeVisible()
    const titled = await stableGeometry(watcher!)
    expect(titled).toHaveLength(baseline.length)
    for (const [index, box] of titled.entries()) {
      expect(
        Math.abs(box.width - baseline[index]!.width),
        'title preserves board/card/portrait width',
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(box.height - baseline[index]!.height),
        'title preserves board/card/portrait height',
      ).toBeLessThanOrEqual(1)
    }
    const viewports =
      testInfo.project.name === 'desktop-chromium'
        ? [
            { width: 850, height: 600 },
            { width: 1366, height: 768 },
            { width: 1920, height: 768 },
          ]
        : [
            { width: 320, height: 700 },
            { width: 390, height: 844 },
          ]
    for (const viewport of viewports) {
      await watcher!.setViewportSize(viewport)
      for (const fontSize of [16, 20]) {
        await watcher!.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`
        }, fontSize)
        await stableGeometry(watcher!)
        const geometry = await titleNode.evaluate((node) => {
          const title = node.getBoundingClientRect()
          const preview = document
            .querySelector('[data-battle-preview-strip]')!
            .getBoundingClientRect()
          const versus = document.querySelector('[data-battle-versus]')!.getBoundingClientRect()
          const range = document.createRange()
          range.selectNodeContents(node)
          const text = [...range.getClientRects()].map((line) => line.toJSON())
          return {
            title: title.toJSON(),
            preview: preview.toJSON(),
            versus: versus.toJSON(),
            text,
            label: node.getAttribute('aria-label'),
            scrollWidth: document.documentElement.scrollWidth,
            width: innerWidth,
          }
        })
        expect(geometry.label).toBe(`${active.characterName} title`)
        expect(geometry.title.top, 'title is separated from the VS seam').toBeGreaterThanOrEqual(
          geometry.versus.bottom,
        )
        for (const line of geometry.text) {
          expect(line.left).toBeGreaterThanOrEqual(geometry.preview.left - 1)
          expect(line.right).toBeLessThanOrEqual(geometry.preview.right + 1)
          expect(line.top).toBeGreaterThanOrEqual(geometry.preview.top - 1)
          expect(line.bottom).toBeLessThanOrEqual(geometry.preview.bottom + 1)
        }
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1)
      }
      await testInfo.attach(`spectator-title-${viewport.width}`, {
        body: await watcher!.screenshot({
          path: testInfo.outputPath(`spectator-title-${viewport.width}.png`),
          fullPage: testInfo.project.name === 'mobile-chromium',
        }),
        contentType: 'image/png',
      })
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
