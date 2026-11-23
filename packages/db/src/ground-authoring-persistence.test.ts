import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const owner = '00000000-0000-4000-8000-000000000071'
const stranger = '00000000-0000-4000-8000-000000000072'
const presets = [
  'embers',
  'frost',
  'arcane-pulse',
  'water',
  'ripples',
  'lightning',
  'poison',
  'healing',
  'sand',
  'wind',
  'vines',
  'shadow',
  'lava',
  'rain',
  'snow',
  'holy-light',
  'void',
  'runes',
  'crystals',
  'spores',
] as const
const teams = ['all', 'all-except-self', 'enemies', 'allies', 'allies-except-self', 'self'] as const
type Definition = Record<string, unknown>
interface ContentRecord {
  revision: number
  draft: { draftVersion: number; definition: Definition } | null
  current: { contentVersion: number; definition: Definition } | null
}
let db: PGlite

beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(`insert into auth.users(id) values('${owner}'),('${stranger}');
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');`)
}, 60000)
afterAll(async () => {
  await db?.close()
})

async function write(key: string, command: Definition, actor = owner) {
  return (
    await db.query<{ record: ContentRecord }>(
      'select public.write_combat_content_record_v1($1,null,$2,$3::jsonb) record',
      [actor, key, JSON.stringify(command)],
    )
  ).rows[0]!.record
}
async function publish(key: string, record: ContentRecord) {
  return (
    await db.query<{ record: ContentRecord }>(
      'select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,public.read_combat_content_catalogue_token_v1(),1) record',
      [owner, key, record.draft!.draftVersion, record.current?.contentVersion ?? null],
    )
  ).rows[0]!.record
}
function definition(key: string, canonical: boolean, area: Definition): Definition {
  const target = {
    kind: 'ground-tile',
    geometryVersion: 3,
    categories: ['ground'],
    teamPolicy: 'enemy',
    friendlyFire: 'enemies-only',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 4,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
  }
  const effect = { type: 'damage', recipient: 'affected-units', amount: 10 }
  const groundArea = {
    durationRounds: 3,
    visualPresetId: 'embers',
    timing: 'next-round',
    ...(canonical ? { entryEffectIds: ['hit'] } : { entryEffectOrdinals: [0] }),
    ...area,
  }
  return {
    id: key,
    contentVersion: 1,
    name: 'Persistent Ground',
    sourceDisciplineId: 'vanguard',
    requirements: {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'mp',
      comparison: 'at-least',
      amount: 2,
    },
    ...(canonical
      ? {
          ability: {
            schemaVersion: 1,
            behaviors: [
              {
                id: 'field',
                activation: 'manual',
                mode: 'action',
                classification: 'attack',
                attackFamily: 'physical',
                costs: [{ resource: 'mp', amount: 2 }],
                cooldown: null,
                requirements: null,
                targeting: target,
                effects: [{ id: 'hit', payload: effect }],
                groundArea,
              },
            ],
          },
        }
      : { target, effects: [effect], groundArea }),
  }
}

// Combat semantics are validated by the server's shared TypeScript parsers before
// these service-only RPCs. The installed SQL validates identity/command authority
// and persists complete JSONB; a second Ground grammar in SQL is unnecessary.
it.each([false, true])(
  'roundtrips every Ground preset and optional policy through installed draft/publication/history RPCs (canonical=%s)',
  async (canonical) => {
    const key = canonical ? 'ground.canonical-persistence' : 'ground.native-persistence'
    await db.exec('begin')
    try {
      const legacy = definition(key, canonical, {})
      let record = await write(key, {
        action: 'create',
        requestId: randomUUID(),
        contentKind: 'skill',
        definition: legacy,
      })
      expect(record.draft!.definition).toEqual(legacy)
      record = await publish(key, record)
      const legacyVersion = record.current!
      const retained = (
        await db.query('select * from app_private.combat_content_versions where content_key=$1', [
          key,
        ])
      ).rows

      for (const [index, visualPresetId] of presets.entries()) {
        const authored = definition(key, canonical, {
          placementTimingVersion: 1,
          targetTeams: teams[index % teams.length],
          visualPresetId,
        })
        const currentBeforeSave = record.current
        record = await write(key, {
          action: 'save',
          expectedRevision: record.revision,
          definition: authored,
        })
        expect(record.draft!.definition).toEqual(authored)
        expect(record.current).toEqual(currentBeforeSave)
        record = await publish(key, record)
        expect(record.current!.definition).toEqual({
          ...authored,
          contentVersion: legacyVersion.contentVersion + index + 1,
        })
        const current = await db.query<{ definition: Definition }>(
          "select * from public.read_current_combat_content_v1($1,'skill')",
          [key],
        )
        expect(current.rows[0]!.definition).toEqual(record.current!.definition)
      }
      expect(
        (
          await db.query(
            'select * from app_private.combat_content_versions where content_key=$1 and content_version=$2',
            [key, legacyVersion.contentVersion],
          )
        ).rows,
      ).toEqual(retained)
      expect(
        (
          await db.query<{ definition: Definition }>(
            "select * from public.read_combat_content_version_v1($1,'skill',$2)",
            [key, legacyVersion.contentVersion],
          )
        ).rows[0]!.definition,
      ).toEqual(legacyVersion.definition)
      expect(
        (
          await db.query('select 1 from app_private.combat_content_versions where content_key=$1', [
            key,
          ])
        ).rows,
      ).toHaveLength(21)
    } finally {
      await db.exec('rollback')
    }
  },
)

it('retains Ground authoring RPC authority, closed command keys, private tables and immutable published definitions', async () => {
  await db.exec('begin')
  try {
    const key = 'ground.authority'
    const command = {
      action: 'create',
      requestId: randomUUID(),
      contentKind: 'skill',
      definition: definition(key, false, {
        placementTimingVersion: 1,
        targetTeams: 'allies',
        visualPresetId: 'water',
      }),
    }
    async function denied(run: () => Promise<unknown>, message: RegExp) {
      await db.exec('savepoint rejected')
      await expect(run()).rejects.toThrow(message)
      await db.exec('rollback to savepoint rejected')
    }
    await denied(() => write(key, command, stranger), /OPERATOR_REQUIRED/)
    await denied(() => write(key, { ...command, sourceDefinition: {} }), /COMMAND_INVALID/)
    await denied(
      () => write(key, { ...command, definition: { ...command.definition, id: 'ground.other' } }),
      /IDENTITY_MISMATCH/,
    )
    for (const signature of [
      'public.write_combat_content_record_v1(uuid,uuid,text,jsonb)',
      'public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)',
    ]) {
      expect(
        (
          await db.query(
            "select has_function_privilege('anon',$1,'execute') anon,has_function_privilege('authenticated',$1,'execute') authenticated,has_function_privilege('service_role',$1,'execute') service",
            [signature],
          )
        ).rows,
      ).toEqual([{ anon: false, authenticated: false, service: true }])
    }
    for (const table of ['records', 'drafts', 'versions', 'publications']) {
      expect(
        (
          await db.query(
            "select relrowsecurity rls,has_table_privilege('authenticated',oid,'select,insert,update,delete') client from pg_class where oid=$1::regclass",
            [`app_private.combat_content_${table}`],
          )
        ).rows,
      ).toEqual([{ rls: true, client: false }])
    }
    const record = await publish(key, await write(key, command))
    await denied(
      () =>
        db.query(
          "update app_private.combat_content_versions set definition='{}' where content_key=$1",
          [key],
        ),
      /VERSION_IMMUTABLE/,
    )
    expect(
      (
        await db.query<{ definition: Definition }>(
          "select * from public.read_current_combat_content_v1($1,'skill')",
          [key],
        )
      ).rows[0]!.definition,
    ).toEqual(record.current!.definition)
  } finally {
    await db.exec('rollback')
  }
})
