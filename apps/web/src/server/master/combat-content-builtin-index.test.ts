import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
vi.mock('server-only', () => ({}))
import { builtinCombatContentManifest } from './combat-content-builtin-index'
it('builtin SQL identity/search/floor manifest exactly covers the current executable catalogue without storing mechanics', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), '../../supabase/content-builtin-manifest.json'), 'utf8'),
  )
  expect(manifest).toEqual(builtinCombatContentManifest())
  const migration = readFileSync(
    resolve(
      process.cwd(),
      '../../supabase/migrations/20261020204946_combat_content_builtin_identity_index.sql',
    ),
    'utf8',
  )
  expect(
    JSON.parse(migration.match(/\$builtin_manifest\$([\s\S]*?)\$builtin_manifest\$/)![1]!),
  ).toEqual(manifest)
  expect(
    manifest.filter((r: { contentKey: string }) =>
      ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp'].includes(
        r.contentKey,
      ),
    ),
  ).toHaveLength(5)
})
