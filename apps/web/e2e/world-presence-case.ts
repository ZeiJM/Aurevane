import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'
import { GRID_HEIGHT, GRID_WIDTH } from '../src/world/catalog'
import type { WorldView } from '../src/world/types'

export async function verifyWorldScenePresence(
  page: Page,
  browser: Browser,
  info: TestInfo,
  {
    enter,
    world,
    place,
    sql,
    capture,
  }: {
    enter: (page: Page) => Promise<string>
    world: (page: Page) => Promise<WorldView>
    place: (id: string, sector: string, x: number, y: number, safe?: boolean) => void
    sql: (query: string) => string
    capture: (page: Page, info: TestInfo, name: string) => Promise<void>
  },
) {
  test.skip(info.project.name !== 'desktop-chromium', 'Exercise two-account presence once.')
  test.setTimeout(120000)
  await enter(page)
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const other = await context.newPage()
    await enter(other)
    const owner = await world(page),
      target = await world(other),
      id = target.characterId
    // Stop the target's heartbeat before testing deliberately aged presence.
    await other.goto('about:blank')
    for (const uuid of [owner.characterId, id]) expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    place(owner.characterId, 'atlas:58:28', 12, 4)
    place(id, 'atlas:59:28', 0, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]'),
      player = page.locator(`[data-world-player="${id}"]`)
    await expect(player).toBeVisible({ timeout: 15000 })
    await expect(player.locator('img')).toHaveAttribute('src', /starter-portrait/)
    await expect(player.getByRole('button', { name: 'Attack', exact: true })).toHaveCount(0)
    const scene = await world(page)
    expect(scene.players.some((p) => p.characterId === owner.characterId)).toBe(false)
    expect(scene.players.find((p) => p.characterId === id)).toMatchObject({
      position: { sectorId: 'atlas:59:28', x: 0, y: 4 },
      online: true,
      attackable: false,
    })
    expect(scene.sectors.length).toBeLessThanOrEqual(25)
    await capture(page, info, 'nearby-across-sector-boundary')

    // Choose a real loaded land tile outside this viewport, but inside the wider
    // view at 60% zoom. No intercepted presence responses or fabricated players.
    const box = (await canvas.boundingBox())!,
      metrics = await canvas.evaluate((el) => ({
        x: Number(el.dataset.cameraX),
        y: Number(el.dataset.cameraY),
        tile: Number(el.dataset.tileSize),
      }))
    const outside = scene.sectors.flatMap((sector) =>
      sector.cells
        .filter((cell) => cell.walkable)
        .flatMap((cell) => {
          const dx = (sector.atlasColumn ?? 0) * GRID_WIDTH + cell.x + 0.5 - metrics.x,
            dy = (sector.atlasRow ?? 0) * GRID_HEIGHT + cell.y + 0.5 - metrics.y,
            sx = (dx - dy) * metrics.tile * 0.85,
            sy = (dx + dy) * metrics.tile * 0.44,
            offscreen = Math.abs(sx) > box.width / 2 + 35 || Math.abs(sy) > box.height / 2 + 55,
            zoomedInside =
              Math.abs(sx * 0.6) < box.width / 2 - 40 && Math.abs(sy * 0.6) < box.height / 2 - 60
          return offscreen && zoomedInside ? [{ sector, cell }] : []
        }),
    )[0]
    expect(outside).toBeDefined()
    place(id, outside!.sector.id, outside!.cell.x, outside!.cell.y)
    await page.reload()
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(true)
    await expect(player).toHaveCount(0)
    await page.getByRole('button', { name: 'Map settings', exact: true }).click()
    const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await zoom.focus()
    await zoom.press('Home')
    await expect(zoom).toHaveValue('60')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(player).toBeVisible({ timeout: 10000 })
    await capture(page, info, 'nearby-follows-zoom-viewport')

    // The same authenticated API must suppress undiscovered and remote positions.
    place(owner.characterId, 'survey-01', 6, 8)
    place(id, 'survey-01', 11, 1)
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)
    place(owner.characterId, 'atlas:58:28', 12, 4)
    place(id, 'atlas:0:0', 0, 4)
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)

    // Idle visibility retains the original authority's ten-minute open-ground
    // expiry and safe-town offline presence. No combat eligibility is broadened.
    place(id, 'atlas:59:28', 0, 4)
    sql(
      `update app_private.character_world_state set last_seen_at=now()-interval '11 minutes' where character_id='${id}'`,
    )
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)
    place(id, 'atlas:59:28', 0, 4, true)
    const offline = (await world(page)).players.find((p) => p.characterId === id)
    expect(offline).toMatchObject({ online: false, attackable: false })
    place(id, 'atlas:59:28', 0, 4)
    sql(
      `update app_private.character_world_state set last_seen_at=now()-interval '2 minutes' where character_id='${id}'`,
    )
    expect((await world(page)).players.find((p) => p.characterId === id)).toMatchObject({
      online: false,
      attackable: false,
    })
    sql(
      `insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) select id,user_id,now(),now()+interval '24 hours' from public.characters where id='${id}'`,
    )
    try {
      expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)
    } finally {
      sql(`delete from app_private.character_deletion_requests where character_id='${id}'`)
    }

    const signature = 'public.read_world_scene_players_v1(uuid,uuid,bigint,text[],jsonb)'
    expect(
      sql(
        `select has_function_privilege('anon','${signature}','EXECUTE'),has_function_privilege('authenticated','${signature}','EXECUTE'),has_function_privilege('service_role','${signature}','EXECUTE')`,
      ),
    ).toBe('f|f|t')
    const args = `c.user_id,c.id,(w.state->>'version')::bigint,array['atlas:58:28','atlas:59:28'],w.state->'position'`,
      from = `from public.characters c join app_private.character_world_state w on w.character_id=c.id where c.id='${owner.characterId}'`
    expect(
      sql(
        `select public.read_world_scene_players_v1(c.user_id,c.id,(w.state->>'version')::bigint+1,array['atlas:58:28'],w.state->'position')->'players' ${from}`,
      ),
    ).toBe('[]')
    expect(
      sql(
        `select jsonb_array_length(public.read_world_scene_players_v1(${args})->'players')<=200 ${from}`,
      ),
    ).toBe('t')
    sql(
      `do $$ declare c record; begin select ch.user_id,ch.id,w.state into c from public.characters ch join app_private.character_world_state w on w.character_id=ch.id where ch.id='${owner.characterId}'; begin perform public.read_world_scene_players_v1(c.user_id,c.id,1,array_fill('atlas:58:28'::text,array[26]),c.state->'position'); raise exception 'Invalid scene was accepted'; exception when invalid_parameter_value then null; end; begin perform public.read_world_scene_players_v1('00000000-0000-4000-8000-000000000099',c.id,1,array['atlas:58:28'],c.state->'position'); raise exception 'Wrong owner was accepted'; exception when insufficient_privilege then null; end; end $$`,
    )
  } finally {
    await context.close()
  }
}
