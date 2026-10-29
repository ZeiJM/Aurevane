import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
vi.mock('server-only', () => ({}))
import {
  builtinCombatContentManifest,
  builtinCombatContentSelectionManifest,
  builtinCombatContentDefinition,
} from './combat-content-builtin-index'
import { assertTagPublicationReady } from '@aurevane/game-core/content/authored-content'
it('supplies editable defaults for individual tags without creating publications on open', () => {
  for (const id of ['dispel', 'copy-buffs', 'copy-debuffs', 'guarded', 'vengeance']) {
    const definition = builtinCombatContentDefinition('tag', `tag.${id}`)
    expect(definition).toMatchObject({
      id: `tag.${id}`,
      tagId: id,
      contentVersion: 1,
      description: '{summary}',
      explanation: '{details}',
    })
    expect(() => assertTagPublicationReady(definition)).not.toThrow()
  }
})
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
  ).toEqual(manifest.filter((row: { contentKind: string }) => row.contentKind !== 'tag'))
  const tagMigration = readFileSync(
    resolve(
      process.cwd(),
      '../../supabase/migrations/20261028060810_master_effect_tag_wording_defaults.sql',
    ),
    'utf8',
  )
  expect(
    JSON.parse(
      tagMigration.match(/\$tag_wording_manifest\$([\s\S]*?)\$tag_wording_manifest\$/)![1]!,
    ),
  ).toEqual(manifest.filter((row: { contentKind: string }) => row.contentKind === 'tag'))
  expect(
    manifest.filter((r: { contentKey: string }) =>
      ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp'].includes(
        r.contentKey,
      ),
    ),
  ).toHaveLength(5)
})
it('every indexed implicit E/R selection is exactly the current executable selector result', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      '../../supabase/migrations/20261020205631_combat_content_reference_index.sql',
    ),
    'utf8',
  )
  expect(
    JSON.parse(
      migration.match(
        /\$builtin_selection_manifest\$([\s\S]*?)\$builtin_selection_manifest\$/,
      )![1]!,
    ),
  ).toEqual(builtinCombatContentSelectionManifest())
})
