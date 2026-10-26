import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Real local Supabase producers + application routes/UI. No route mocks or hosted URL.
test('shared Skill automatic provenance persists through the actual route and refresh, without earning testing access', async ({
  page,
  baseURL,
}, testInfo) => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname)
  const containers = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
  expect(containers).toHaveLength(1)
  const container = containers[0]!
  expect(container).toMatch(/^supabase_db_/)
  const sql = (query: string) =>
    execFileSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        query,
      ],
      { encoding: 'utf8' },
    ).trim()
  const token = Date.now()
    .toString()
    .split('')
    .map((n) => String.fromCharCode(65 + Number(n)))
    .join('')
  const { userId } = await provisionAccountAndEnterCharacter({
    page,
    email: `stage-b-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Stage-B-native-browser-2026!',
    characterName: `Scholar ${token}`,
  })
  expect(['localhost', '127.0.0.1']).toContain(new URL(page.url()).hostname)
  const characterId = sql(`select id from public.characters where user_id='${userId}'`)
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)
  // Existing retained Skill and exact learned version; no publication or rebalance.
  const skill = JSON.parse(
    sql(
      "select row_to_json(s) from (select skill_id,content_version from app_private.phase4_skill_catalog where discipline_id='lifebinder' and skill_id='lifebinder.barrier') s",
    ),
  ) as { skill_id: string; content_version: number }
  sql(
    `select app_private.grant_discipline_skill_v1('${characterId}','${skill.skill_id}',${skill.content_version},'lifebinder','vanguard','support','discipline-testing-open:v1',false)`,
  )
  sql(
    `select * from public.record_character_discipline_mastery_v1('${characterId}','lifebinder','owner','native-shared-browser')`,
  )
  sql(
    `select app_private.grant_discipline_skill_v1('${characterId}','${skill.skill_id}',${skill.content_version},'lifebinder','lifebinder','gameplay','native-earned-source',true)`,
  )
  const version = sql(
    `select build_version from app_private.character_active_builds where character_id='${characterId}'`,
  )
  sql(
    `select * from public.change_character_disciplines_v3('${userId}','${characterId}',${version},false,null,true,'lifebinder',gen_random_uuid(),'native-shared-secondary')`,
  )
  const selectedVersion = sql(
    `select build_version from app_private.character_active_builds where character_id='${characterId}'`,
  )
  sql(
    `select * from public.save_character_discipline_skill_loadout_v1('${userId}','${characterId}',${selectedVersion},'[]'::jsonb,gen_random_uuid(),'native-shared-empty')`,
  )
  await page.goto('/game/nexus')
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  await expect(page.getByRole('combobox', { name: /Eligible Discipline/ })).toHaveCount(0)
  const saved = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/character/build/skills' && r.request().method() === 'PUT',
  )
  const barrier = page.getByRole('checkbox', { name: 'Select Barrier', exact: true })
  if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
    await barrier.click()
    await page.getByRole('button', { name: 'Equip technique', exact: true }).click()
  } else {
    await barrier.check()
  }
  const response = await saved
  expect(response.ok()).toBe(true)
  expect(response.request().postDataJSON().eligibilitySelections).toContainEqual({
    skillId: skill.skill_id,
    eligibilityDisciplineId: 'vanguard',
  })
  await page.reload()
  await expect(page.getByRole('combobox', { name: /Eligible Discipline/ })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Unselect Barrier', exact: true })).toBeChecked()
  const facts = JSON.parse(
    sql(`select public.get_character_committed_build_snapshot_v2('${userId}','${characterId}')`),
  )
  expect(facts.disciplineSkills).toContainEqual(
    expect.objectContaining({
      skillId: skill.skill_id,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'vanguard',
      earnedEligibility: false,
    }),
  )
  // Seed an already-equipped secondary grant through the real validated authority,
  // then prove another ordinary UI selection preserves that provenance.
  const currentVersion = sql(
    `select build_version from app_private.character_active_builds where character_id='${characterId}'`,
  )
  const secondaryLoadout = JSON.stringify([
    {
      skillId: skill.skill_id,
      contentVersion: skill.content_version,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'lifebinder',
    },
  ])
  sql(
    `select * from public.save_character_discipline_skill_loadout_v1('${userId}','${characterId}',${currentVersion},'${secondaryLoadout}'::jsonb,gen_random_uuid(),'native-retained-secondary')`,
  )
  await page.reload()
  const changed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/character/build/skills' &&
      response.request().method() === 'PUT',
  )
  const forceful = page.getByRole('checkbox', { name: 'Select Forceful Strike', exact: true })
  if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
    await forceful.click()
    await page.getByRole('button', { name: 'Equip technique', exact: true }).click()
  } else await forceful.check()
  const changedResponse = await changed
  expect(changedResponse.ok()).toBe(true)
  expect(changedResponse.request().postDataJSON().eligibilitySelections).toContainEqual({
    skillId: skill.skill_id,
    eligibilityDisciplineId: 'lifebinder',
  })
  await page.reload()
  const selected = JSON.parse(
    sql(`select public.get_character_committed_build_snapshot_v2('${userId}','${characterId}')`),
  )
  expect(selected.disciplineSkills).toContainEqual(
    expect.objectContaining({
      skillId: skill.skill_id,
      eligibilityDisciplineId: 'lifebinder',
      earnedEligibility: true,
    }),
  )
  const restoreVersion = sql(
    `select build_version from app_private.character_active_builds where character_id='${characterId}'`,
  )
  const primaryLoadout = JSON.stringify([
    {
      skillId: skill.skill_id,
      contentVersion: skill.content_version,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'vanguard',
    },
  ])
  sql(
    `select * from public.save_character_discipline_skill_loadout_v1('${userId}','${characterId}',${restoreVersion},'${primaryLoadout}'::jsonb,gen_random_uuid(),'native-retained-primary')`,
  )
  sql(
    `select app_private.grant_discipline_skill_v1('${characterId}','${skill.skill_id}',${skill.content_version},'lifebinder','vanguard','gameplay','native-earned-upgrade',true)`,
  )
  await page.reload()
  const earned = JSON.parse(
    sql(`select public.get_character_committed_build_snapshot_v2('${userId}','${characterId}')`),
  )
  expect(earned.disciplineSkills).toContainEqual(
    expect.objectContaining({
      skillId: skill.skill_id,
      eligibilityDisciplineId: 'vanguard',
      earnedEligibility: true,
    }),
  )
  await expect(page.getByRole('combobox', { name: /Eligible Discipline/ })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Unselect Barrier', exact: true })).toBeChecked()
})
