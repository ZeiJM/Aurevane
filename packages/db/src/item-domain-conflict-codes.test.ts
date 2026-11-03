import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const migration = '20261103120305_item_domain_conflict_codes.sql'
const pattern = "errcode[[:space:]]*=[[:space:]]*'40001'"
interface Definition {
  signature: string
  definition: string
  acl: string | null
  owner: number
  count: number
}
let db: PGlite
let predecessors: Definition[] = []
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name === migration) {
      predecessors = (
        await database.query<Definition>(
          `select format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) signature,
          pg_get_functiondef(p.oid) definition,proacl::text acl,proowner owner,
          (select count(*)::int from regexp_matches(p.prosrc,$1,'gi')) count
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname in ('public','app_private') and p.prosrc ~* $1 order by signature`,
          [pattern],
        )
      ).rows
    }
  })
}, 60000)
afterAll(async () => db?.close())
it('changes exactly the 17 Item domain conflicts and preserves all function bodies, owners and ACLs', async () => {
  expect(predecessors).toHaveLength(12)
  expect(predecessors.reduce((sum, row) => sum + row.count, 0)).toBe(17)
  for (const before of predecessors) {
    const after = (
      await db.query<Definition>(
        'select pg_get_functiondef(oid) definition,proacl::text acl,proowner owner from pg_proc where oid=$1::regprocedure',
        [before.signature],
      )
    ).rows[0]!
    expect(after.definition, before.signature).toBe(
      before.definition.replace(/errcode\s*=\s*'40001'/gi, "errcode='PT409'"),
    )
    expect(after.acl, before.signature).toBe(before.acl)
    expect(after.owner, before.signature).toBe(before.owner)
  }
  expect(
    (
      await db.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','app_private') and p.prosrc ~* $1`,
        [pattern],
      )
    ).rows,
  ).toEqual([])
})
