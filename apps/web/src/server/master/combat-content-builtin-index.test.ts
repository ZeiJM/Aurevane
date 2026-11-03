import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
vi.mock('server-only', () => ({}))
import {
  builtinCombatContentManifest,
  builtinCombatContentSelectionManifest,
  builtinCombatContentDefinition,
} from './combat-content-builtin-index'
import { currentCombatTagName } from '@aurevane/game-core/combat/combat-effect-identities'
import { assertTagPublicationReady } from '@aurevane/game-core/content/authored-content'
it('supplies editable defaults for individual tags without creating publications on open', () => {
  for (const id of ['dispel', 'copy-buffs', 'copy-debuffs', 'guarded', 'vengeance', 'counter']) {
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
  // Applied source manifests remain historical. The additive support migration
  // adds current Support identities, the replacement class utility and passive stats.
  const current = manifest
    .filter((row: { contentKey: string }) => row.contentKey !== 'basic.guard')
    .map((row: { contentKind: string; contentKey: string; name: string }) => ({
      ...row,
      ...(row.contentKey === 'wildwarden.renewing-herbs'
        ? { name: 'Briar Snare', contentVersion: 7, versionFloor: 7 }
        : {
            name:
              row.contentKind === 'tag'
                ? currentCombatTagName(row.contentKey.replace(/^tag\./u, ''), row.name)
                : row.name,
          }),
    }))
  for (const [contentKey, name, contentKind] of [
    ['basic.pilfer', 'Pilfer', 'skill'],
    ['basic.fleetstep', 'Fleetstep', 'skill'],
    ['basic.invocation', 'Invocation', 'skill'],
    ['tag.loot', 'Loot', 'tag'],
    ['tag.stat-bonus', 'Stat Bonus', 'tag'],
  ])
    current.push({
      contentKey,
      name,
      contentKind,
      contentVersion: 1,
      versionFloor: 1,
      sourceDisciplineId: null,
    })
  expect(
    current.sort((a: { contentKey: string }, b: { contentKey: string }) =>
      a.contentKey.localeCompare(b.contentKey),
    ),
  ).toEqual(builtinCombatContentManifest())
  expect(
    builtinCombatContentManifest().filter((row) =>
      [
        'basic.move',
        'unarmed.basic',
        'basic.recover',
        'basic.recover.mp',
        'basic.pilfer',
        'basic.fleetstep',
        'basic.invocation',
      ].includes(row.contentKey),
    ),
  ).toHaveLength(7)
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
  ).toEqual(
    manifest.filter(
      (row: { contentKind: string; contentKey: string }) =>
        row.contentKind === 'tag' &&
        ![
          'tag.counter',
          'tag.endure',
          'tag.weak-point',
          'tag.spike',
          'tag.ruin',
          'tag.reversal',
          'tag.blind',
        ].includes(row.contentKey),
    ),
  )
  const attackMigration = readFileSync(
    resolve(
      process.cwd(),
      '../../supabase/migrations/20261031084705_attack_modifier_tag_identities.sql',
    ),
    'utf8',
  )
  const attackRows = JSON.parse(
    attackMigration.match(/\$attack_tag_manifest\$([\s\S]*?)\$attack_tag_manifest\$/)![1]!,
  )
  expect(
    attackRows.sort((a: { contentKey: string }, b: { contentKey: string }) =>
      a.contentKey.localeCompare(b.contentKey),
    ),
  ).toEqual(
    manifest.filter((row: { contentKey: string }) =>
      ['tag.weak-point', 'tag.spike', 'tag.ruin'].includes(row.contentKey),
    ),
  )
  const counterMigration = readFileSync(
    resolve(process.cwd(), '../../supabase/migrations/20261031081044_counter_tag_identity.sql'),
    'utf8',
  )
  expect(counterMigration).toContain(
    "values ('tag.counter', 'tag', 'active', 1, 1, 'Counter', null)",
  )
  expect(
    manifest.find((row: { contentKey: string }) => row.contentKey === 'tag.counter'),
  ).toMatchObject({ contentVersion: 1, versionFloor: 1, name: 'Counter' })
  const endureMigration = readFileSync(
    resolve(process.cwd(), '../../supabase/migrations/20261031084336_endure_tag_identity.sql'),
    'utf8',
  )
  expect(endureMigration).toContain("values ('tag.endure', 'tag', 'active', 1, 1, 'Endure', null)")
  expect(
    manifest.find((row: { contentKey: string }) => row.contentKey === 'tag.endure'),
  ).toMatchObject({ contentVersion: 1, versionFloor: 1, name: 'Endure' })
  const reversalMigration = readFileSync(
    resolve(process.cwd(), '../../supabase/migrations/20261031090902_reversal_tag_identity.sql'),
    'utf8',
  )
  expect(reversalMigration).toContain(
    "values ('tag.reversal', 'tag', 'active', 1, 1, 'Reversal', null)",
  )
  expect(
    manifest.find((row: { contentKey: string }) => row.contentKey === 'tag.reversal'),
  ).toMatchObject({ contentVersion: 1, versionFloor: 1, name: 'Reversal' })
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
