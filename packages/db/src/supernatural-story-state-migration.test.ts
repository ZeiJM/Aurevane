import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

let db: PGlite

const owner = '00000000-0000-4000-8000-000000000921'
const other = '00000000-0000-4000-8000-000000000922'
const character = '00000000-0000-4000-8000-000000000923'
const command = '00000000-0000-4000-8000-000000000924'

const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/20260924003000_phase5_supernatural_story_state.sql',
    import.meta.url,
  ),
  'utf8',
)

async function initialize(userId = owner) {
  return db.query<{
    character_id: string
    state_version: number
    path: string
    story_id: string
    node_id: string
  }>('select * from public.initialize_character_supernatural_story_state_v1($1,$2,$3,$4,$5)', [
    userId,
    character,
    'supernatural.main',
    1,
    'awakening.threshold',
  ])
}

async function transition(
  input: {
    userId?: string
    expectedVersion?: number
    commandId?: string
    fingerprint?: string
    fromNode?: string
    toNode?: string
    nextPath?: string
    ascensionId?: string | null
    ascensionVersion?: number | null
    severenceId?: string | null
    severenceVersion?: number | null
  } = {},
) {
  return db.query<{
    state_version: number
    path: string
    ascension_id: string | null
    severence_id: string | null
    chosen_at: string | null
    replayed: boolean
  }>(
    `select * from public.commit_character_supernatural_story_transition_v1(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    )`,
    [
      input.userId ?? owner,
      character,
      input.expectedVersion ?? 1,
      input.commandId ?? command,
      input.fingerprint ?? 'transition-one',
      'supernatural.main.choose-path',
      1,
      'supernatural.main',
      1,
      input.fromNode ?? 'awakening.threshold',
      input.toNode ?? 'awakening.bound',
      input.nextPath ?? 'ascended',
      input.ascensionId === undefined ? 'ascension.proof' : input.ascensionId,
      input.ascensionVersion === undefined ? 1 : input.ascensionVersion,
      input.severenceId ?? null,
      input.severenceVersion ?? null,
    ],
  )
}

async function rejected(operation: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected')
}

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema app_private;

    create table public.characters (
      id uuid primary key,
      user_id uuid not null
    );

    create table app_private.idempotency_records (
      actor_key text not null,
      command_name text not null,
      idempotency_key uuid not null,
      request_fingerprint text not null,
      result jsonb not null,
      created_at timestamptz not null default now(),
      primary key (actor_key, command_name, idempotency_key)
    );

    revoke all on table app_private.idempotency_records from public, anon, authenticated;
  `)
  await db.exec(migration)
})

beforeEach(async () => {
  await db.exec('begin')
  await db.query('insert into public.characters(id,user_id) values($1,$2)', [character, owner])
})

afterEach(async () => {
  await db.exec('rollback')
})

afterAll(async () => {
  await db?.close()
})

describe('Phase 5 supernatural story-state migration', () => {
  it('keeps the state table and mutation RPCs unavailable to browser roles', async () => {
    const privilege = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','public.commit_character_supernatural_story_transition_v1(uuid,uuid,integer,uuid,text,text,integer,text,integer,text,text,text,text,integer,text,integer)','execute') allowed",
    )
    expect(privilege.rows[0]?.allowed).toBe(false)

    await db.exec('set local role authenticated')
    await rejected(
      () => db.query('select * from app_private.character_supernatural_story_state'),
      'permission denied',
    )
    await db.exec('reset role')
  })

  it('initializes exactly one owned Unawakened story state', async () => {
    const first = await initialize()
    const replay = await initialize()

    expect(first.rows[0]).toMatchObject({
      character_id: character,
      state_version: 1,
      story_id: 'supernatural.main',
      node_id: 'awakening.threshold',
      path: 'unawakened',
    })
    expect(replay.rows[0]).toMatchObject(first.rows[0]!)
    await rejected(() => initialize(other), 'CHARACTER_NOT_FOUND')
  })

  it('commits Ascension once and replays the durable idempotency receipt', async () => {
    await initialize()

    const first = await transition()
    const replay = await transition()

    expect(first.rows[0]).toMatchObject({
      state_version: 2,
      path: 'ascended',
      ascension_id: 'ascension.proof',
      severence_id: null,
      replayed: false,
    })
    expect(first.rows[0]?.chosen_at).toBeTruthy()
    expect(replay.rows[0]).toMatchObject({
      state_version: 2,
      path: 'ascended',
      ascension_id: 'ascension.proof',
      replayed: true,
    })
    expect(replay.rows[0]?.chosen_at).toStrictEqual(first.rows[0]?.chosen_at)
  })

  it('rejects conflicting idempotency fingerprints and stale state versions', async () => {
    await initialize()
    await transition()

    await rejected(
      () => transition({ fingerprint: 'different-intent' }),
      'SUPERNATURAL_IDEMPOTENCY_CONFLICT',
    )
    await rejected(
      () =>
        transition({
          expectedVersion: 1,
          commandId: '00000000-0000-4000-8000-000000000925',
        }),
      'SUPERNATURAL_STATE_VERSION_CONFLICT',
    )
  })

  it('makes the ordinary Ascension / Severence fork permanent at the write boundary', async () => {
    await initialize()
    await transition()

    await rejected(
      () =>
        transition({
          expectedVersion: 2,
          commandId: '00000000-0000-4000-8000-000000000926',
          fingerprint: 'try-switch-path',
          fromNode: 'awakening.bound',
          toNode: 'awakening.illegal',
          nextPath: 'severed',
          ascensionId: null,
          ascensionVersion: null,
          severenceId: 'severence.proof',
          severenceVersion: 1,
        }),
      'SUPERNATURAL_PATH_PERMANENT',
    )
  })

  it('uses database constraints to reject impossible persisted identity shapes', async () => {
    await initialize()
    await rejected(
      () =>
        db.query(
          "update app_private.character_supernatural_story_state set path='ascended', chosen_at=now() where character_id=$1",
          [character],
        ),
      'character_supernatural_identity_shape',
    )
  })
})
