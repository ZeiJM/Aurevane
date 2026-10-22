import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({ id: 'selected' }),
}))
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import { postCombatContentAuthoring } from '@/components/master/combat-content/combat-content-client'
import { combatContentCategory } from '../combat/combat-content-categories'

const legacy = {
  schemaVersion: 1,
  id: 'discipline.ready',
  contentVersion: 1,
  name: 'Ready',
  description: 'Ready Discipline.',
  sortOrder: 0,
  enabled: true,
  media: {},
  core: { might: 7, finesse: 5, vitality: 5, agility: 5, intellect: 5, resolve: 4 },
  focus: ['might', 'intellect'],
  enabledForPrimary: true,
  enabledForSecondary: true,
  linkedSkills: [],
  unlock: { kind: 'unavailable' },
}
const complete = {
  ...legacy,
  skillStages: [],
  unlock: { kind: 'always' },
  essenceId: 'essence.ready',
  resonanceSelections: [{ withDisciplineId: 'vanguard', resonanceId: 'resonance.ready' }],
  atlas: {
    family: 'mage',
    band: 'first-journey',
    disclosure: 'open',
    power: { reliability: 1, flexibility: 2, setup: 3, ruleAccess: 4, execution: 5 },
  },
}
function retainedRecord(definition: Record<string, unknown>) {
  return {
    contentKey: legacy.id,
    contentKind: 'discipline',
    lifecycle: 'draft',
    revision: 2,
    versionFloor: 0,
    createdBy: 'owner',
    createdAt: '2026-10-20',
    draft: {
      definition,
      draftVersion: 4,
      baseVersion: null,
      updatedBy: 'owner',
      updatedAt: '2026-10-20',
      restoredFrom: null,
      restoredBy: null,
    },
    current: null,
    history: [],
    usedBy: [],
    links: [],
  }
}
const call = (command: unknown) =>
  handleCombatContentAuthoringRequest(
    new Request('https://example.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify({ operation: 'record', command }),
    }),
  )
const publish = () =>
  call({
    action: 'publish',
    contentKey: legacy.id,
    expectedDraftVersion: 4,
    expectedBaseVersion: null,
  })
let saved = retainedRecord(complete)
let failure: { code: string; message: string; details?: string; hint?: string } | null = null
let publicationAttempts = 0
afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  saved = retainedRecord(complete)
  failure = null
  publicationAttempts = 0
  rpc.mockReset()
  rpc.mockImplementation(async (name: string) => {
    if (name === 'read_master_panel_operator_v1')
      return { data: [{ user_id: 'owner', enabled: true, role: 'owner' }], error: null }
    if (name === 'read_combat_content_record_v1') return { data: saved, error: null }
    if (name === 'read_combat_content_catalogue_v1')
      return {
        data: {
          token: 'a'.repeat(32),
          policy: { version: 1, modes: {} },
          publications: [],
          archivedKeys: [],
        },
        error: null,
      }
    if (name === 'publish_saved_combat_content_v1') {
      publicationAttempts++
      return { data: failure ? null : saved, error: failure }
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
})

it.each([
  ['name', 81],
  ['name', 120],
  ['description', 241],
  ['description', 4000],
] as const)(
  'reads the retained Stage A %s at length %s unchanged so it can be corrected',
  async (field, length) => {
    saved = retainedRecord({ ...legacy, [field]: 'x'.repeat(length) })
    const response = await call({ action: 'read', contentKey: legacy.id })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ record: saved })
  },
)
it.each([
  ['name', 121],
  ['description', 4001],
] as const)('keeps the former retained %s bound finite', async (field, length) => {
  saved = retainedRecord({ ...legacy, [field]: 'x'.repeat(length) })
  const response = await call({ action: 'read', contentKey: legacy.id })
  expect(response.status).toBe(503)
})
it.each(['current', 'history'] as const)(
  'retains long text in immutable %s bodies',
  async (field) => {
    const definition = { ...legacy, name: 'n'.repeat(120), description: 'd'.repeat(4000) }
    const version = {
      definition,
      contentVersion: 1,
      publishedBy: 'owner',
      publishedAt: '2026-10-20',
      authoredBy: null,
      authoredAt: null,
      restoredFrom: null,
      restoredBy: null,
    }
    const record = {
      ...retainedRecord(legacy),
      lifecycle: 'active',
      [field]: field === 'history' ? [version] : version,
    }
    rpc.mockImplementationOnce(async () => ({
      data: [{ user_id: 'owner', enabled: true, role: 'owner' }],
      error: null,
    }))
    // Both operator checks precede the actual complete-record read.
    rpc.mockImplementationOnce(async () => ({
      data: [{ user_id: 'owner', enabled: true, role: 'owner' }],
      error: null,
    }))
    rpc.mockImplementationOnce(async () => ({ data: record, error: null }))
    const response = await call({ action: 'read', contentKey: legacy.id })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ record })
  },
)
it.each([
  ['name', 81],
  ['description', 241],
] as const)(
  'rejects overlong %s at new authoring and saved-publication boundaries',
  async (field, length) => {
    const definition = { ...complete, [field]: 'x'.repeat(length) }
    saved = retainedRecord(definition)
    const descriptor = combatContentCategory('discipline')!
    expect(() => descriptor.parseAuthoring(definition)).toThrow(new RegExp(field))
    expect(() => descriptor.validatePublication!(definition)).toThrow(new RegExp(field))
    const response = await publish()
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_REQUEST', message: expect.stringContaining(field) },
    })
    expect(publicationAttempts).toBe(0)
  },
)
it('accepts exactly 80/240 for new authoring/readiness and preserves Core and eligibility validation in retained reads', async () => {
  saved = retainedRecord({ ...complete, name: 'n'.repeat(80), description: 'd'.repeat(240) })
  expect((await publish()).status).toBe(200)
  expect(publicationAttempts).toBe(1)
  const descriptor = combatContentCategory('discipline')!
  expect(() => descriptor.parseAuthoring(saved.draft.definition)).not.toThrow()
  for (const invalid of [
    { ...legacy, core: { ...legacy.core, might: 8 } },
    { ...legacy, focus: ['might', 'might'] },
    { ...complete, unlock: { kind: 'flag', id: 'unearned' } },
  ])
    expect(() => descriptor.parseRetained(invalid, legacy.id)).toThrow()
})
it.each([
  ['DISCIPLINE_ESSENCE_UNAVAILABLE', undefined, /essence.ready.*discipline.ready.*active Essence/i],
  ['DISCIPLINE_CORE_BASE_MUST_BE_UNIQUE', undefined, /discipline.ready.*Core.*different.*31/i],
  [
    'DISCIPLINE_RESONANCE_SELECTION_CONFLICT',
    'discipline.ready+vanguard',
    /discipline.ready.*vanguard.*both Discipline/i,
  ],
  [
    'DISCIPLINE_RESONANCE_SELECTION_CONFLICT',
    'aetherist+lifebinder',
    /aetherist.*lifebinder.*both Discipline/i,
  ],
  [
    'DISCIPLINE_RESONANCE_SELECTION_CONFLICT',
    undefined,
    /discipline.ready.*vanguard.*both Discipline/i,
  ],
] as const)(
  'returns actionable actual producer blocker %s through saved-publication HTTP',
  async (message, details, expectedMessage) => {
    failure = { code: '22023', message, ...(details ? { details } : {}), hint: 'SECRET SQL HINT' }
    const response = await publish()
    expect(publicationAttempts).toBe(1)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({
      error: { code: 'INVALID_REQUEST', message: expect.stringMatching(expectedMessage) },
    })
    expect(JSON.stringify(body)).not.toMatch(/SECRET|SQL HINT|DISCIPLINE_/)
  },
)
it.each([
  'vanguard+lifebinder\nSELECT secret FROM private',
  'vanguard+lifebinder+third',
  `${'x'.repeat(161)}+vanguard`,
])('never forwards malformed SQL details %j', async (details) => {
  failure = { code: '22023', message: 'DISCIPLINE_RESONANCE_SELECTION_CONFLICT', details }
  const response = await publish()
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body.error.message).toMatch(/discipline.ready.*vanguard.*both Discipline/i)
  expect(JSON.stringify(body)).not.toContain(details)
})

it('maps the real unique-Core SQLSTATE 23505 through HTTP and the operator client', async () => {
  failure = {
    code: '23505',
    message: 'DISCIPLINE_CORE_BASE_MUST_BE_UNIQUE',
    details: 'SECRET ROW',
    hint: 'SECRET SQL',
  }
  const response = await publish()
  expect(response.status).toBe(400)
  vi.stubGlobal('fetch', async () => response)
  await expect(
    postCombatContentAuthoring({ operation: 'record', command: { action: 'publish' } }),
  ).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
    message: expect.stringMatching(/discipline.ready.*Core.*different.*31/),
  })
})
it('does not turn unrelated database uniqueness failures into Discipline validation', async () => {
  failure = { code: '23505', message: 'UNKNOWN_UNIQUE_CONSTRAINT', details: 'SECRET ROW' }
  const response = await publish()
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({
    error: {
      code: 'PERSISTENCE_UNAVAILABLE',
      message: 'Master Panel combat content is unavailable right now.',
    },
  })
})
