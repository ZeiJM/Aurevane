import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import {
  createPendingBattle,
  defeatCurrentCombatant,
  endTurn,
  selectFinalFacing,
  startBattle,
} from '../../game-core/src/combat/battle-state'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const npc = '77777777-7777-4777-8777-777777777777'
const command = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
const world = { ...position, radius: 2, greeting: 'The challenger is waiting.' }
const encounter = { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: ['wolf'] }
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  for (const [id, name] of [
    [owner, 'World player'],
    [other, 'Other player'],
  ]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `${id}@example.test`,
    ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
      presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
      might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
      values($1,$1,0,1,$2,$2,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, name],
    )
  }
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [owner],
  )
  for (const [id, spawn] of [
    [owner, position],
    [other, { ...position, x: 11 }],
  ]) {
    await db.query('select public.read_world_state_v1($1,$1,$2)', [
      id,
      { version: 1, position: spawn, route: [], nextStepAt: null, discoveries: {} },
    ])
  }
}, 60_000)
afterAll(async () => db.close())

it('admits one World-only published NPC and captures provenance for the exact replay', async () => {
  const save = (revision: number, placement: unknown) =>
    db.query("select public.write_master_npc_design_v1($1,null,$2,$3,'save',$4)", [
      owner,
      npc,
      revision,
      { name: 'Field opponent', portraitRef: null, uses: ['world'], arena: null, world: placement },
    ])
  const publish = (revision: number, kind = 'commit-world') =>
    db.query('select public.write_master_npc_design_v1($1,null,$2,$3,$4,null)', [
      owner,
      npc,
      revision,
      kind,
    ])
  const prepare = (actor: string, character = actor, version = 1) =>
    db.query<{ opponent: object }>('select public.read_world_npc_battle_v1($1,$2,$3,$4) opponent', [
      actor,
      character,
      npc,
      version,
    ])
  expect(
    (
      await db.query(`select
    has_function_privilege('authenticated','public.read_world_npc_battle_v1(uuid,uuid,uuid,bigint)','execute') as browser,
    has_table_privilege('service_role','app_private.world_npc_battles','insert,update,delete') as writes`)
    ).rows,
  ).toEqual([{ browser: false, writes: false }])
  await save(0, world)
  await publish(1)
  await expect(prepare(owner)).rejects.toThrow('WORLD_NPC_CHALLENGE_UNAVAILABLE')
  await expect(
    save(2, { ...world, encounter: { ...encounter, tags: ['wolf', 'wolf'] } }),
  ).rejects.toThrow('NPC_DESIGN_INVALID')
  await save(2, { ...world, encounter })
  await expect(prepare(owner)).rejects.toThrow('WORLD_NPC_CHALLENGE_UNAVAILABLE')
  await publish(3)
  await expect(prepare(other)).rejects.toThrow('WORLD_NPC_CHALLENGE_OUT_OF_RANGE')
  await expect(prepare(other, owner)).rejects.toThrow('WORLD_NOT_OWNED')
  await expect(prepare(owner, owner, 2)).rejects.toThrow('WORLD_STALE_VERSION')
  const { rows } = await prepare(owner)
  expect(rows[0]?.opponent).toMatchObject({
    id: npc,
    revision: 4,
    arenaId: 'duel-yard',
    aiDifficulty: 'standard',
  })
  expect(rows[0]?.opponent).not.toHaveProperty('tags')
  const player = {
    id: `character:${owner}`,
    teamId: 'players',
    initiative: 2,
    baseMovementBudget: 2,
    hp: 10,
    maxHp: 10,
    mp: 0,
    maxMp: 0,
  }
  const opponent = { ...player, id: 'recruit:fixture', teamId: 'opponents', initiative: 1 }
  const battle = startBattle(
    createPendingBattle({
      battleId: 'fixture-world-npc',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 100,
      combatants: [player, opponent],
    }),
  ).state
  const capture = (
    await db.query<{ capture: object }>(
      `select public.get_character_committed_build_snapshot_v2($1,$1) || jsonb_build_object('sourceHash',app_private.player_source_hash_v1($1)) capture`,
      [owner],
    )
  ).rows[0]!.capture
  const snapshot = {
    tactical: { battle },
    arenaNpc: { id: npc, revision: 4, name: 'Field opponent', portraitRef: null },
    worldBattleOrigin: 'npc',
    buildAuthority: { combatants: [{ ...capture, characterId: owner, combatantId: player.id }] },
  }
  const participants = [
    { combatant_id: player.id, participant_role: 'player', character_id: owner },
    { combatant_id: opponent.id, participant_role: 'opponent', character_id: null },
  ]
  const admit = (fingerprint = 'fixture:world') =>
    db.query<{ battle_session_id: string; replayed: boolean }>(
      "select * from public.start_world_npc_battle_v1($1,$1,1,$2,$3,$4,$5,'fixture-world-npc',1,1,$6,$7,null,null,null)",
      [owner, command, npc, fingerprint, 'fixture:canonical-battle', snapshot, participants],
    )
  const created = (await admit()).rows[0]!
  expect(created.replayed).toBe(false)
  const actual = await db.query(
    'select character_id,npc_id,npc_revision,opponent_combatant_id,placement,tags from app_private.world_npc_battles where battle_session_id=$1',
    [created.battle_session_id],
  )
  expect(actual.rows).toEqual([
    {
      character_id: owner,
      npc_id: npc,
      npc_revision: 4,
      opponent_combatant_id: opponent.id,
      placement: position,
      tags: ['wolf'],
    },
  ])
  await expect(admit('fixture:forged')).rejects.toThrow('WORLD_COMMAND_CONFLICT')
  await publish(4, 'retire-world')
  expect((await admit()).rows[0]).toEqual(
    expect.objectContaining({ battle_session_id: created.battle_session_id, replayed: true }),
  )
  const enemyTurn = endTurn(selectFinalFacing(battle, 'east').state).state
  const victory = defeatCurrentCombatant(enemyTurn, opponent.id)
  const result = await db.query<{ battle_version: number }>(
    'select * from public.commit_battle_intent_v3($1::text,gen_random_uuid(),$2,$1::uuid,$3,1,$4,$5,null)',
    [
      owner,
      'fixture:world-victory',
      created.battle_session_id,
      { ...snapshot, tactical: { battle: victory.state } },
      victory.events,
    ],
  )
  expect(result.rows[0]?.battle_version).toBe(2)
  expect(
    (
      await db.query('select event from app_private.battle_events where battle_session_id=$1', [
        created.battle_session_id,
      ])
    ).rows,
  ).toContainEqual({ event: { event: 'battle_completed', winningTeamId: 'players' } })
  expect(
    (await db.query('select count(*)::integer total from app_private.event_contributions')).rows,
  ).toEqual([{ total: 0 }])
  await expect(
    db.query('select * from public.claim_discipline_trial_v1($1,$2)', [
      owner,
      created.battle_session_id,
    ]),
  ).rejects.toThrow('MASTERY_TRIAL_REQUIRED')
  const current = await db.query<{ version: number }>(
    "select (state->>'version')::integer version from app_private.character_world_state where character_id=$1",
    [owner],
  )
  await expect(prepare(owner, owner, current.rows[0]!.version)).rejects.toThrow(
    'WORLD_NPC_CHALLENGE_UNAVAILABLE',
  )
})
