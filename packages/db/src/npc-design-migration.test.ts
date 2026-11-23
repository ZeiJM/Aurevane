import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const root = resolve(process.cwd(), '../../supabase')

it('preserves NPC publication and shared ferry presence after the full migration chain', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,updated_at timestamptz,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create schema realtime; create table realtime.messages(extension text,topic text,payload jsonb);
    create function realtime.topic() returns text language sql as $$ select null::text $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages values($2,$3,$1) $$;
    create schema cron; create table cron.job(jobid bigint generated always as identity,jobname text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname) values($1) returning jobid $$;
    create function cron.unschedule(bigint) returns boolean language sql as $$ delete from cron.job where jobid=$1 returning true $$;`)
    for (const name of readdirSync(resolve(root, 'migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      const sql = readFileSync(resolve(root, 'migrations', name), 'utf8')
        .replace(/create extension if not exists pg_cron(?: with schema pg_catalog)?;/gi, '')
        .replace(/set compression lz4/gi, 'set compression pglz')
      try {
        await db.exec(sql)
      } catch (error) {
        throw new Error(`Migration ${name}: ${String(error)}`, { cause: error })
      }
    }
    await db.exec(readFileSync(resolve(root, 'tests/npc_design_arena_opponents.sql'), 'utf8'))
    await db.exec(readFileSync(resolve(root, 'tests/world_ferry_shared_presence.sql'), 'utf8'))
    expect(
      (await db.query('select count(*)::int as count from app_private.npc_designs')).rows,
    ).toEqual([{ count: 0 }])
  } finally {
    await db.close()
  }
}, 60_000)
