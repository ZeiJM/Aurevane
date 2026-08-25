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

    await createAccountAndEnterCharacter({ page, email: `spectator-host-${runId}@example.com`, password, characterName: uniqueCharacterName('Host') })
    const hostStorage = await page.context().storageState()
    await signOutFromAccountMenu(page)
    await createAccountAndEnterCharacter({ page, email: `spectator-guest-${runId}@example.com`, password, characterName: uniqueCharacterName('Guest') })
    const guestStorage = await page.context().storageState()
    await signOutFromAccountMenu(page)
    await createAccountAndEnterCharacter({ page, email: viewerEmail, password, characterName: uniqueCharacterName('Viewer') })

    const hostContext = await browser.newContext({ baseURL: BASE_URL, storageState: hostStorage })
    const guestContext = await browser.newContext({ baseURL: BASE_URL, storageState: guestStorage })
    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()

    try {
      await host.goto('/game/battle')
      await host.getByRole('button', { name: /Player vs Player/ }).click()
      await host.getByRole('button', { name: 'Create Battle Lobby' }).click()
      const hostLobby = host.getByRole('dialog', { name: 'The arena is waiting.' })
      await expect(hostLobby).toBeVisible()
      const lobbyKey = (await hostLobby.locator('button').filter({ hasText: 'Lobby Key' }).locator('strong').textContent())?.trim()
      expect(lobbyKey).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

      await guest.goto(`/game/battle?join=${encodeURIComponent(lobbyKey ?? '')}`)
      const guestLobby = guest.getByRole('dialog', { name: 'The arena is waiting.' })
      await expect(guestLobby).toBeVisible({ timeout: 15_000 })
      await guestLobby.getByRole('button', { name: 'Mark Ready' }).click()
      await hostLobby.getByRole('button', { name: 'Mark Ready' }).click()
      await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })

      const battleKey = (await host.locator('[data-pvp-spectator-key="true"] strong').textContent())?.trim()
      expect(battleKey).toMatch(/^AVB-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

      const admin = createTestAdminClient()
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      expect(usersError).toBeNull()
      const viewer = users?.users.find((candidate) => candidate.email === viewerEmail)
      expect(viewer?.id).toBeTruthy()

      const spectatorViewRpc = await admin.rpc('get_pvp_spectator_view_v1', { p_battle_key: battleKey })
      expect(spectatorViewRpc.error).toBeNull()
      expect(spectatorViewRpc.data).toBeTruthy()
      const rpcData = spectatorViewRpc.data as Record<string, any>
      console.log('spectator snapshot counts', {
        width: rpcData?.snapshot?.tactical?.width,
        height: rpcData?.snapshot?.tactical?.height,
        tiles: Array.isArray(rpcData?.snapshot?.tactical?.tiles) ? rpcData.snapshot.tactical.tiles.length : null,
        placements: Array.isArray(rpcData?.snapshot?.tactical?.placements) ? rpcData.snapshot.tactical.placements.length : null,
        combatants: Array.isArray(rpcData?.snapshot?.tactical?.battle?.combatants) ? rpcData.snapshot.tactical.battle.combatants.length : null,
      })

      const spectatorJoinRpc = await admin.rpc('join_pvp_spectator_v1', { p_user_id: viewer?.id ?? '', p_battle_key: battleKey })
      expect(spectatorJoinRpc.error).toBeNull()

      await page.goto(`/diagnostics/mobile-spectator/${encodeURIComponent(battleKey ?? '')}`)
      const battlefield = page.getByRole('region', { name: 'Live battlefield' })
      await expect(battlefield).toBeVisible()

      const diagnostics = await page.evaluate(() => {
        const battlefield = document.querySelector<HTMLElement>('#battlefield')
        const scroller = battlefield?.children.item(1) as HTMLElement | null
        const board = scroller?.firstElementChild as HTMLElement | null
        const tile = board?.querySelector<HTMLElement>('button[aria-label^="Tile "]') ?? null
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
            childElementCount: element.childElementCount,
            className: element.className,
          }
        }

        const matchedDisplayRules: Array<{
          sheet: string | null
          media: string | null
          selector: string
          display: string
          important: string
          cssText: string
        }> = []

        const visitRules = (rules: CSSRuleList, sheetHref: string | null, media: string | null) => {
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSMediaRule) {
              if (window.matchMedia(rule.conditionText).matches) {
                visitRules(rule.cssRules, sheetHref, rule.conditionText)
              }
              continue
            }
            if (!(rule instanceof CSSStyleRule) || !scroller) continue
            let matches = false
            try {
              matches = scroller.matches(rule.selectorText)
            } catch {
              matches = false
            }
            if (!matches || !rule.style.display) continue
            matchedDisplayRules.push({
              sheet: sheetHref,
              media,
              selector: rule.selectorText,
              display: rule.style.display,
              important: rule.style.getPropertyPriority('display'),
              cssText: rule.cssText,
            })
          }
        }

        for (const sheet of Array.from(document.styleSheets)) {
          try {
            visitRules(sheet.cssRules, sheet.href, null)
          } catch {
            // Ignore inaccessible cross-origin stylesheets; app CSS is same-origin in this test.
          }
        }

        return {
          measurements: {
            battlefield: measure(battlefield),
            scroller: measure(scroller),
            board: measure(board),
            tile: measure(tile),
          },
          matchedDisplayRules,
        }
      })
      console.log('mobile spectator battlefield diagnostics', diagnostics)

      const tiles = battlefield.getByRole('button', { name: /^Tile / })
      await expect(tiles).toHaveCount(63)
      expect(diagnostics.measurements.scroller?.height ?? 0).toBeGreaterThan(0)
      expect(diagnostics.measurements.board?.height ?? 0).toBeGreaterThan(0)
      expect(diagnostics.measurements.tile?.width ?? 0).toBeGreaterThan(0)
      expect(diagnostics.measurements.tile?.height ?? 0).toBeGreaterThan(0)
    } finally {
      await hostContext.close()
      await guestContext.close()
    }
  },
)
