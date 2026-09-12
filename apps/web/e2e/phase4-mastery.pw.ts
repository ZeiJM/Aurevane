import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test.use({ trace: 'on' })

test('earns Mastery through a UI victory, claims once, reloads and retries without duplicate XP', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One complete acquisition run; responsive roster/media flows run on all viewports.',
  )
  test.skip(
    process.env.AUREVANE_ENV !== 'local' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321',
    'The acquisition fixture is strictly local CI; production testing grants are preserved.',
  )
  test.setTimeout(300000)
  const suffix = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')
  const email = `p4-earned-${Date.now()}@example.com`
  await provisionAccountAndEnterCharacter({
    page,
    email,
    password: 'P4-earned-local-fixture-2026!',
    characterName: `Earned ${suffix}`,
  })
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]!
  expect(container).toMatch(/^supabase_db_/)
  // Prepare only this newly-created local account at 250 XP. No battle, win,
  // command history or reward is injected; all subsequent gameplay uses the UI.
  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    {
      input: `begin; do $$ declare c uuid; begin
      select character.id into strict c from public.characters character join auth.users account on account.id=character.user_id where account.email='${email}';
      delete from app_private.character_discipline_masteries where character_id=c;
      update app_private.character_discipline_progress set mastery_xp=0,demonstrated_skills='{}' where character_id=c;
      update app_private.character_discipline_progress set mastery_xp=250 where character_id=c and discipline_id='vanguard';
      if app_private.discipline_unlocked_v1(c,'bastion') then raise exception 'Fixture already has Bastion'; end if;
    end $$; commit;`,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  await page.reload()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const techniques = page.getByRole('dialog', { name: 'Techniques', exact: true })
  const list = page.getByTestId('learned-skill-list')
  for (const name of ['Forceful Strike', 'Brace'])
    await list
      .locator('article')
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByRole('checkbox')
      .check()
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/character/build/skills') && r.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Commit Selected Techniques' }).click()
  expect((await saved).status()).toBe(200)
  await techniques.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('mastery-trial')
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/api/battles') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  const creation = await created
  expect(creation.status()).toBeLessThan(300)
  let battle: BattleSessionView = (await creation.json()).battle
  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  const playerId = battle.snapshot.tactical.battle.combatants.find(
    (unit) => unit.teamId === 'players',
  )!.id
  const enemyId = battle.snapshot.tactical.battle.combatants.find(
    (unit) => unit.teamId === 'opponents',
  )!.id
  const confirm = root.getByRole('button', { name: 'Confirm Action', exact: true })
  const finish = root.getByRole('button', { name: /Finish Turn/ })
  let skillCommands = 0
  let braced = false
  const commit = async () => {
    await expect(confirm).toBeEnabled()
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/intents') && r.request().method() === 'POST',
    )
    await confirm.click()
    const result = await response
    expect(result.status()).toBe(200)
    battle = (await result.json()).battle
  }
  const chooseSkill = async (category: string, id: string) => {
    await root.locator(`[data-battle-skill-selector-category="${category}"]`).click()
    await page.locator(`[data-battle-skill-option-id="${id}"]`).click()
  }
  await chooseSkill('Guard', 'vanguard.brace')
  await chooseSkill('Attack', 'vanguard.forceful-strike')
  for (
    let command = 0;
    command < 100 && battle.snapshot.tactical.battle.lifecycle === 'active';
    command++
  ) {
    await expect(finish).toBeEnabled({ timeout: 15000 })
    const tactical = battle.snapshot.tactical
    const player = tactical.placements.find((unit) => unit.combatantId === playerId)!.position
    const enemy = tactical.placements.find((unit) => unit.combatantId === enemyId)!.position
    const distance = Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y)
    const ap = tactical.battle.combatants
      .find((unit) => unit.id === playerId)!
      .temporaryResources.find((resource) => resource.key === 'pv1f.action-economy')!.current
    // A response can arrive before React renders its board/AP state. Follow the
    // committed budget and wait for its visible projection before the next input.
    await expect(
      root.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', String(ap))
    if (!braced && ap >= 30) {
      await root.getByRole('button', { name: 'Brace, 30 AP', exact: true }).click()
      await commit()
      braced = true
      skillCommands++
      continue
    }
    if (distance === 1 && ap >= (skillCommands < 3 ? 40 : 50)) {
      if (skillCommands < 3) {
        await root.getByRole('button', { name: 'Forceful Strike, 40 AP', exact: true }).click()
      } else {
        await chooseSkill('Attack', 'basic.attack.unarmed.basic')
        await root.locator('[data-battle-command="attack"]').click()
      }
      await root.getByRole('button', { name: new RegExp(`^Tile ${enemy.x}, ${enemy.y};`) }).click()
      await commit()
      if (skillCommands < 3) skillCommands++
      continue
    }
    if (distance > 1 && ap >= 20 && tactical.battle.currentTurn!.movementRemaining > 0) {
      await root.locator('[data-battle-command="move"]').click()
      const destination = await root.locator('button[data-reachable]').evaluateAll(
        (tiles, target) =>
          tiles
            .map((tile) => ({
              label: tile.getAttribute('aria-label') ?? '',
              xy: (tile.getAttribute('aria-label') ?? '').match(/^Tile (\d+), (\d+)/),
            }))
            .filter((tile) => tile.xy && !tile.label.includes('occupied by'))
            .map((tile) => ({
              label: tile.label,
              distance:
                Math.abs(Number(tile.xy![1]) - target.x) + Math.abs(Number(tile.xy![2]) - target.y),
            }))
            .sort((a, b) => a.distance - b.distance)[0] ?? null,
        enemy,
      )
      if (destination && destination.distance < distance) {
        await root.getByRole('button', { name: destination.label, exact: true }).click()
        await commit()
        continue
      }
    }
    const ended = page.waitForResponse(
      (r) => r.url().endsWith('/final-turn') && r.request().method() === 'POST',
    )
    const recruited = page.waitForResponse(
      (r) => r.url().endsWith('/recruit-turn') && r.request().method() === 'POST',
    )
    await finish.click()
    await root.getByRole('button', { name: 'Face east', exact: true }).click()
    expect((await ended).status()).toBe(200)
    const turn = await recruited
    expect(turn.status()).toBe(200)
    battle = (await turn.json()).battle
  }
  expect(skillCommands).toBeGreaterThanOrEqual(3)
  const result = page.getByTestId('battle-result-overlay')
  await expect(result.getByRole('heading', { name: 'Victory', exact: true })).toBeVisible()
  const claim = page.waitForResponse(
    (r) => r.url().endsWith('/mastery') && r.request().method() === 'POST',
  )
  await result.getByRole('button', { name: 'Claim Mastery', exact: true }).click()
  const awarded = await claim
  expect(awarded.status()).toBe(200)
  expect((await awarded.json()).mastery).toMatchObject({
    awardedXp: 50,
    xp: 300,
    stage: 3,
    replayed: false,
  })
  await expect(result).toContainText('+50 Mastery XP')
  await page.reload()
  const retry = page.waitForResponse(
    (r) => r.url().endsWith('/mastery') && r.request().method() === 'POST',
  )
  await result.getByRole('button', { name: 'Claim Mastery', exact: true }).click()
  expect((await (await retry).json()).mastery).toMatchObject({ xp: 300, replayed: true })
  await expect(result).toContainText('Already claimed')
  await testInfo.attach('phase4-earned-mastery', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.goto('/game/character')
  await page.getByRole('button', { name: /Manage Primary Discipline/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management' })
  await management.getByText('Mastery & unlocks', { exact: true }).click()
  await expect(management).toContainText('Adept · 300/1,000 XP')
  await expect(management.locator('select').first().locator('option[value="bastion"]')).toHaveCount(
    1,
  )
})
