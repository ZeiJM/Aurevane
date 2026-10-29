import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const root = resolve(process.cwd(), '../../supabase')
const regression = readFileSync(
  resolve(root, 'tests/repeatable_default_portrait_choice.sql'),
  'utf8',
)
async function preservedState(db: PGlite) {
  const tables = (
    await db.query<{ name: string }>(`
    select format('%I.%I',n.nspname,c.relname) name from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','app_private') and c.relkind in ('r','p') order by 1
  `)
  ).rows
  const data = []
  for (const { name } of tables) {
    data.push([
      name,
      (
        await db.query(
          `select md5(coalesce(string_agg(to_jsonb(t)::text,',' order by to_jsonb(t)::text),'')) digest from ${name} t`,
        )
      ).rows,
    ])
  }
  const functions = (
    await db.query(`
    select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private') and p.prokind='f'
      and p.oid<>'public.set_character_default_portrait_v1(uuid,uuid,text)'::regprocedure
    order by 1
  `)
  ).rows
  const acl = (
    await db.query(
      "select proacl::text acl from pg_proc where oid='public.set_character_default_portrait_v1(uuid,uuid,text)'::regprocedure",
    )
  ).rows
  return { data, functions, acl }
}
it('keeps repeatable portrait authority after every canonical migration', async () => {
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
      // Only unavailable platform cron and storage codec behavior are substituted.
      const sql = readFileSync(resolve(root, 'migrations', name), 'utf8')
        .replace(/create extension if not exists pg_cron(?: with schema pg_catalog)?;/gi, '')
        .replace(/set compression lz4/gi, 'set compression pglz')
      try {
        let before: Awaited<ReturnType<typeof preservedState>> | undefined
        if (name.endsWith('_repeatable_default_portrait_choice.sql')) {
          // Simulate an existing account that already used its former one-time selection.
          await db.exec(
            regression
              .split('do $$')[0]!
              .replace('begin;', '')
              .replaceAll('82000000-', '83000000-')
              .replaceAll('Portrait Regression', 'Portrait Preservation')
              .replaceAll('portrait regression', 'portrait preservation'),
          )
          await db.exec(`update public.characters set default_portrait_changed_at='2026-10-03T00:00:00Z' where id='83000000-0000-4000-8000-000000000011';
            insert into public.character_profile_display(character_id,user_id,image_url) values('83000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000001','https://example.test/preserved.png');`)
          before = await preservedState(db)
        }
        await db.exec(sql)
        if (before) expect(await preservedState(db)).toEqual(before)
      } catch (error) {
        throw new Error(`Migration ${name}: ${String(error)}`, { cause: error })
      }
    }
    await db.exec(regression)
    expect(
      (
        await db.query(
          "select count(*)::integer count from auth.users where id='82000000-0000-4000-8000-000000000001'",
        )
      ).rows,
    ).toEqual([{ count: 0 }])
  } finally {
    await db.close()
  }
}, 60000)
