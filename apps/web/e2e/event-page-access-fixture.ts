import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pageFixtureSql = readFileSync(
  resolve(__dirname, '../../../.github/scripts/event-page-access-fixture.sql'),
  'utf8',
)
const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`

/** Disposable local Owner bootstrap; actual page changes always call the protected RPC. */
export function createEventPageAccessFixture(query: (sql: string) => string) {
  if (
    query(
      "select count(*) from app_private.master_panel_role_assignments where role='game-owner' and enabled",
    ) !== '0'
  )
    throw new Error(
      'Events browser fixture requires no enabled Owner; unrelated grants are preserved.',
    )
  const originalPages: unknown = JSON.parse(
    query(
      "select (roles->'event-staff')::text from app_private.master_panel_role_defaults where singleton",
    ),
  )
  if (!Array.isArray(originalPages) || !originalPages.every((page) => typeof page === 'string'))
    throw new Error('Local Events page defaults are unavailable.')
  let changed = false
  function change(enabled: boolean, restorePages?: string[]) {
    query(`begin;
      do $bootstrap$ declare owner_id uuid:=gen_random_uuid(); begin
        if exists(select 1 from app_private.master_panel_role_assignments where role='game-owner' and enabled) then
          raise exception using errcode='42501',message='EVENT_FIXTURE_EXISTING_OWNER';
        end if;
        insert into auth.users(id,email,email_confirmed_at) values(owner_id,'event-page-owner-'||owner_id||'@example.test',now());
        insert into app_private.master_panel_role_assignments(user_id,role) values(owner_id,'game-owner');
        perform set_config('event_fixture.owner',owner_id::text,true);
      end; $bootstrap$;
      select set_config('event_fixture.enabled','${enabled}',true),set_config('event_fixture.restore_pages',${sqlLiteral(restorePages ? JSON.stringify(restorePages) : '')},true);
      set local role service_role;
      ${pageFixtureSql}
      reset role;
      delete from app_private.master_panel_role_assignments where user_id=current_setting('event_fixture.owner')::uuid and role='game-owner';
      commit;`)
    changed = true
  }
  return {
    set: (enabled: boolean) => change(enabled),
    restore: () => {
      if (!changed) return
      change(false, originalPages)
      changed = false
    },
  }
}
