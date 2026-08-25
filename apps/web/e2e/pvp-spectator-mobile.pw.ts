import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import {
  createAccountAndEnterCharacter,
  signOutFromAccountMenu,
} from './pv1f-test-helpers'

const BASE_URL = 'http://127.0.0.1:3100'

function uniqueCharacterName(prefix: string): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `${prefix} ${letters}`
}

function createTestAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !secretKey) throw new Error('Local Supabase admin credentials are required.')
  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

test(
  'mobile spectator renders the full 9x7 PvP battlefield',
  async ({ browser, page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'This regression is mobile-specific.')
    test.setTimeout(120_000)

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const password = 'PvP-spectator-browser-2026!'
    const viewerEmail = `spectator-viewer-${runId}@example.com`

    await createAccountAndEnterCharacter({
      page,
      email: `spectator-host-${runId}@example.com`,
      password,
      characterName: uniqueCharacterName('Host'),
    })
    const hostStorage = await page.context().storageState()
    await signOutFromAccountMenu(page)

    await createAccountAndEnterCharacter({
      page,
      email: `spectator-guest-${runId}@example.com`,
      password,
      characterName: uniqueCharacterName('Guest'),
    })
    const guestStorage = await page.context().storageState()
    await signOutFromAccountMenu(page)

    await createAccountAndEnterCharacter({
      page,
      email: viewerEmail,
      password,
      characterName: uniqueCharacterName('Viewer'),
    })

    const hostContext = await browser.newContext({
      baseURL: BASE_URL,
      storageState: hostStorage,
    })
    const guestContext = await browser.newContext({
      baseURL: BASE_URL,
      storageState: guestStorage,
    })
    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()

    try {
      await host.goto('/game/battle')
      await host.getByRole('button', { name: /Player vs Player/ }).click()
      await host.getByRole('button', { name: 'Create Battle Lobby' }).click()
      const hostLobby = host.getByRole('dialog', { name: 'The arena is waiting.' })
      await expect(hostLobby).toBeVisible()
      const lobbyKey = (
        await hostLobby
          .locator('button')
          .filter({ hasText: 'Lobby Key' })
          .locator('strong')
          .textContent()
      )?.trim()
      expect(lobbyKey).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

      await guest.goto(`/game/battle?join=${encodeURIComponent(lobbyKey ?? '')}`)
      const guestLobby = guest.getByRole('dialog', { name: 'The arena is waiting.' })
      await expect(guestLobby).toBeVisible({ timeout: 15_000 })

      await guestLobby.getByRole('button', { name: 'Mark Ready' }).click()
      await hostLobby.getByRole('button', { name: 'Mark Ready' }).click()

      await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
      const battleKey = (
        await host.locator('[data-pvp-spectator-key="true"] strong').textContent()
      )?.trim()
      expect(battleKey).toMatch(/^AVB-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

      const admin = createTestAdminClient()
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      expect(usersError).toBeNull()
      const viewer = users?.users.find((candidate) => candidate.email === viewerEmail)
      expect(viewer?.id).toBeTruthy()

      const spectatorViewRpc = await admin.rpc('get_pvp_spectator_view_v1', {
        p_battle_key: battleKey,
      })
      console.log('spectator view rpc probe', {
        error: spectatorViewRpc.error,
        hasData: Boolean(spectatorViewRpc.data),
      })
      expect(spectatorViewRpc.error).toBeNull()
      expect(spectatorViewRpc.data).toBeTruthy()

      const spectatorJoinRpc = await admin.rpc('join_pvp_spectator_v1', {
        p_user_id: viewer?.id ?? '',
        p_battle_key: battleKey,
      })
      console.log('spectator join rpc probe', {
        error: spectatorJoinRpc.error,
        data: spectatorJoinRpc.data,
      })
      expect(spectatorJoinRpc.error).toBeNull()

      await page.goto(`/__diagnostics/mobile-spectator/${encodeURIComponent(battleKey ?? '')}`)
      await expect(page).toHaveURL(/\/__diagnostics\/mobile-spectator\/AVB-[A-Z0-9-]+$/, {
        timeout: 15_000,
      })

      const battlefield = page.getByRole('region', { name: 'Live battlefield' })
      const boardScroller = battlefield.locator(':scope > div').nth(1)
      const board = boardScroller.locator(':scope > div')
      const tiles = battlefield.getByRole('button', { name: /^Tile / })

      await expect(battlefield).toBeVisible()
      await expect(tiles).toHaveCount(63)

      const measurements = await page.evaluate(() => {
        const battlefield = document.querySelector<HTMLElement>('#battlefield')
        const scroller = battlefield?.children.item(1) as HTMLElement | null
        const board = scroller?.firstElementChild as HTMLElement | null
        const tile =
          board?.querySelector<HTMLElement>('button[aria-label^="Tile "]') ?? null
        const measure = (element: HTMLElement | null) => {
          if (!element) return null
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return {
            width: rect.width,
            height: rect.height,
            display: style.display,
            overflow: style.overflow,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            gridTemplateRows: style.gridTemplateRows,
            gridTemplateColumns: style.gridTemplateColumns,
            aspectRatio: style.aspectRatio,
            minHeight: style.minHeight,
            maxHeight: style.maxHeight,
          }
        }
        return {
          battlefield: measure(battlefield),
          scroller: measure(scroller),
          board: measure(board),
          tile: measure(tile),
        }
      })

      console.log('mobile spectator battlefield measurements', measurements)

      const scrollerBox = await boardScroller.boundingBox()
      const boardBox = await board.boundingBox()
      const firstTileBox = await tiles.first().boundingBox()

      expect(scrollerBox).not.toBeNull()
      expect(scrollerBox?.height ?? 0).toBeGreaterThan(0)
      expect(boardBox).not.toBeNull()
      expect(boardBox?.height ?? 0).toBeGreaterThan(0)
      expect(firstTileBox).not.toBeNull()
      expect(firstTileBox?.width ?? 0).toBeGreaterThan(0)
      expect(firstTileBox?.height ?? 0).toBeGreaterThan(0)
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  },
)
