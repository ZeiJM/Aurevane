import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { essenceSnapshotReference } from '@aurevane/game-core/combat/essence'
import { resonanceSnapshotReference } from '@aurevane/game-core/combat/resonance'
import {
  actorId,
  characterId,
  publishProposedRoster,
  resolver,
  rows,
} from '@/server/battle/roster-legal-build.test-utils'

const mocks = vi.hoisted(() => ({ session: vi.fn(), metadata: vi.fn(), resolver: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: '127.0.0.1:3100' }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error('redirect:' + path)
  },
}))
vi.mock('@/lib/supabase/config', () => ({ getOptionalPublicSupabaseConfig: () => ({}) }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: '11111111-1111-4111-8111-111111111111' }),
}))
vi.mock('@/server/battle/battle-session-service', () => ({
  createBattleSessionService: () => ({ getSession: mocks.session }),
}))
vi.mock('@/server/battle/supabase-battle-session-repository', () => ({
  createSupabaseBattleSessionRepository: () => ({}),
}))
vi.mock('@/server/battle/pvp-lobby-service', () => ({ getPvpBattleMetadata: mocks.metadata }))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({
    findByOwnerId: async () => ({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Wayfarer',
      level: 100,
      portraitRef: 'portrait.starter.wayfarer-01',
    }),
  }),
}))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadCharacterProfileDisplay: async () => ({ imageUrl: null }),
}))
vi.mock('@/server/combat/combat-content-resolver', async (original) => ({
  ...(await original<typeof import('@/server/combat/combat-content-resolver')>()),
  createServerCombatContentResolver: mocks.resolver,
}))
vi.mock('@/components/battle/battle-audio-gate', () => ({ BattleAudioGate: () => null }))
vi.mock('@/components/battle/battle-client-boundary', () => ({ BattleClientBoundary: () => null }))

import BattleSessionPage from './page'

beforeAll(publishProposedRoster, 30_000)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolver.mockReturnValue(resolver)
})

it.each(['pve', 'pvp'] as const)(
  'shows the captured published Essence in the %s cockpit without manually equipping it',
  async (mode) => {
    const row = rows.find(
      (entry) => entry.kind === 'essence' && entry.id === 'essence.edgedancer.sevenfold-cut',
    )!
    if (row.kind !== 'essence') throw new Error('Missing published Essence fixture.')
    mocks.session.mockResolvedValue({
      battleSessionId: '33333333-3333-4333-8333-333333333333',
      battleVersion: 1,
      snapshot: {
        tactical: { battle: { lifecycle: 'active' } },
        statBridge: {
          combatants: [{ provenance: { kind: 'character-derived', sourceId: actorId } }],
        },
        buildAuthority: {
          schemaVersion: 1,
          catalogVersion: 3,
          combatContext: mode,
          combatants: [
            {
              combatantId: actorId,
              characterId,
              primary: { disciplineId: 'edgedancer' },
              secondary: null,
              disciplineSkills: [],
              extensions: { essence: essenceSnapshotReference(row.after), resonance: null },
            },
          ],
        },
      },
    })
    mocks.metadata.mockResolvedValue(
      mode === 'pvp'
        ? {
            localCharacterId: characterId,
            participants: [
              {
                characterId,
                combatantId: actorId,
                characterName: 'Wayfarer',
                portraitRef: 'portrait.starter.wayfarer-01',
              },
            ],
          }
        : null,
    )
    const page = await BattleSessionPage({
      params: Promise.resolve({ battleSessionId: '33333333-3333-4333-8333-333333333333' }),
    })
    const boundary = (
      page as ReactElement<{
        children: ReactElement<{
          runtime: {
            essence: {
              id: string
              definition: { contentVersion: number; ability?: unknown }
            } | null
          }
        }>
      }>
    ).props.children
    expect(boundary.props.runtime.essence).toMatchObject({
      id: 'essence.edgedancer.sevenfold-cut',
      definition: { contentVersion: row.after.skill.contentVersion, ability: { schemaVersion: 1 } },
    })
  },
)

it('shows the exact captured published Resonance instead of losing it to the built-in catalogue', async () => {
  const row = rows.find(
    (entry) =>
      entry.kind === 'resonance' && entry.id === 'resonance.chronist-edgedancer.linked-sequence',
  )!
  if (row.kind !== 'resonance') throw new Error('Missing published Resonance fixture.')
  mocks.session.mockResolvedValue({
    battleSessionId: '33333333-3333-4333-8333-333333333333',
    battleVersion: 1,
    snapshot: {
      tactical: { battle: { lifecycle: 'active' } },
      statBridge: {
        combatants: [{ provenance: { kind: 'character-derived', sourceId: actorId } }],
      },
      buildAuthority: {
        schemaVersion: 1,
        catalogVersion: 3,
        combatContext: 'pve',
        combatants: [
          {
            combatantId: actorId,
            characterId,
            primary: { disciplineId: 'chronist' },
            secondary: { disciplineId: 'edgedancer' },
            disciplineSkills: [],
            extensions: { essence: null, resonance: resonanceSnapshotReference(row.after) },
          },
        ],
      },
    },
  })
  mocks.metadata.mockResolvedValue(null)
  const page = await BattleSessionPage({
    params: Promise.resolve({ battleSessionId: '33333333-3333-4333-8333-333333333333' }),
  })
  const boundary = (
    page as ReactElement<{
      children: ReactElement<{
        runtime: { resonance: { id: string; contentVersion: number } | null }
      }>
    }>
  ).props.children
  expect(boundary.props.runtime.resonance).toMatchObject({
    id: row.id,
    contentVersion: row.after.contentVersion,
  })
})
