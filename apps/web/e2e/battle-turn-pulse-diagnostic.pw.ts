import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${suffix}`,
  }
}

async function enterGuidedBattle(page: Page) {
  const identity = uniqueIdentity('PulseTrace')
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const coach = page.getByRole('dialog', { name: 'Complete the tactical fundamentals' })
  await expect(coach).toBeVisible()
  await coach.getByRole('button', { name: 'Continue training' }).click()

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-local-turn', 'true')
  return root
}

test('diagnoses desktop Finish Turn battlefield geometry through Recruit handoff', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only geometry diagnostic')
  test.slow()

  const root = await enterGuidedBattle(page)

  await root.evaluate((element) => {
    type Geometry = {
      height: number
      top: number
      bottom: number
      display: string
      position: string
      cssHeight: string
      minHeight: string
      maxHeight: string
      gridTemplateRows: string
    }
    type Sample = {
      localTurn: string | undefined
      ariaBusy: string | null
      actionMode: string | undefined
      root: Geometry
      content: Geometry
      battlefield: Geometry
      viewport: Geometry
      board: Geometry
      deck: Geometry
      context: Geometry
      commands: Geometry
      footer: Geometry
    }
    const state = window as typeof window & {
      __pulseSamples?: Sample[]
      __stopPulseSamples?: boolean
    }
    const geometry = (node: Element | null): Geometry => {
      if (!(node instanceof HTMLElement)) {
        return {
          height: -1,
          top: -1,
          bottom: -1,
          display: 'missing',
          position: 'missing',
          cssHeight: 'missing',
          minHeight: 'missing',
          maxHeight: 'missing',
          gridTemplateRows: 'missing',
        }
      }
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return {
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        display: style.display,
        position: style.position,
        cssHeight: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        gridTemplateRows: style.gridTemplateRows,
      }
    }

    state.__pulseSamples = []
    state.__stopPulseSamples = false
    const sample = () => {
      const content = element.querySelector('[data-unified-battle-content="true"]')
      const battlefield = element.querySelector('#battlefield')
      const viewport = battlefield?.firstElementChild ?? null
      const board = battlefield?.querySelector('[data-board-auto-fit]') ?? null
      const deck = element.querySelector('[data-unified-command-deck="true"]')
      const context = deck?.children.item(0) ?? null
      const commands = deck?.children.item(1) ?? null
      const footer = element.querySelector('[data-unified-battle-footer="true"]')
      state.__pulseSamples?.push({
        localTurn: (element as HTMLElement).dataset.localTurn,
        ariaBusy: element.getAttribute('aria-busy'),
        actionMode: (element as HTMLElement).dataset.battleActionMode,
        root: geometry(element),
        content: geometry(content),
        battlefield: geometry(battlefield),
        viewport: geometry(viewport),
        board: geometry(board),
        deck: geometry(deck),
        context: geometry(context),
        commands: geometry(commands),
        footer: geometry(footer),
      })
      if (!state.__stopPulseSamples) window.requestAnimationFrame(sample)
    }
    sample()
  })

  const finalTurnResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/final-turn'),
  )
  const recruitTurnResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/recruit-turn'),
  )
  const finish = root.getByRole('button', { name: /Finish Turn/ })
  await finish.click()
  await finish.press('KeyD')
  await finalTurnResponse
  await recruitTurnResponse
  await expect(root).toHaveAttribute('data-local-turn', 'true', { timeout: 15_000 })

  const samples = await page.evaluate(() => {
    const state = window as typeof window & {
      __pulseSamples?: Array<Record<string, unknown>>
      __stopPulseSamples?: boolean
    }
    state.__stopPulseSamples = true
    return state.__pulseSamples ?? []
  })

  expect(samples.length).toBeGreaterThan(5)
  const simplified = samples.map((sample) => {
    const battlefield = sample.battlefield as { height: number }
    const content = sample.content as { height: number; gridTemplateRows: string }
    const deck = sample.deck as { height: number; gridTemplateRows: string }
    const context = sample.context as { height: number }
    const commands = sample.commands as { height: number }
    const footer = sample.footer as { height: number; top: number }
    return {
      localTurn: sample.localTurn,
      ariaBusy: sample.ariaBusy,
      actionMode: sample.actionMode,
      battlefieldHeight: battlefield.height,
      contentHeight: content.height,
      contentRows: content.gridTemplateRows,
      deckHeight: deck.height,
      deckRows: deck.gridTemplateRows,
      contextHeight: context.height,
      commandsHeight: commands.height,
      footerHeight: footer.height,
      footerTop: footer.top,
    }
  })
  const unique = simplified.filter(
    (sample, index, values) =>
      index === 0 || JSON.stringify(sample) !== JSON.stringify(values[index - 1]),
  )
  const battlefieldHeights = simplified.map((sample) => sample.battlefieldHeight)
  const variance = Math.max(...battlefieldHeights) - Math.min(...battlefieldHeights)
  if (variance > 1) {
    throw new Error(`Battlefield geometry pulse: ${JSON.stringify({ variance, unique })}`)
  }
})
