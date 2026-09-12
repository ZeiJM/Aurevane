import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
import { buildPrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { AurevaneError } from '@aurevane/game-core/errors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CharacterAttributeAllocationView } from '@/server/character/character-attribute-service'
import type { CharacterBuildContext } from '@/server/character/character-build-service'

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  activeBattle: vi.fn(),
  activeSpectating: vi.fn(),
  selectedCharacter: vi.fn(),
  levelCurve: vi.fn(),
  disciplineBuild: vi.fn(),
  attributeAllocation: vi.fn(),
  titleState: vi.fn(),
  displayState: vi.fn(),
  testKit: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: '127.0.0.1:3100' }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/supabase/config', () => ({ getOptionalPublicSupabaseConfig: () => ({}) }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.actor }))
vi.mock('@/server/account/active-game-session', () => ({
  getActiveBattleForUser: mocks.activeBattle,
  getActiveSpectatingForUser: mocks.activeSpectating,
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: mocks.selectedCharacter,
}))
vi.mock('@/server/progression/progression-service', () => ({
  loadLevelProgressionCurve: mocks.levelCurve,
}))
vi.mock('@/server/character/character-build-service', () => ({
  loadCharacterBuildContext: mocks.disciplineBuild,
}))
vi.mock('@/server/character/character-attribute-service', () => ({
  loadCharacterAttributeAllocation: mocks.attributeAllocation,
}))
vi.mock('@/server/character/character-title-service', () => ({
  loadCharacterTitleState: mocks.titleState,
}))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadCharacterProfileDisplay: mocks.displayState,
}))
vi.mock('@/server/character/pv2-buildcraft-test-kit', () => ({
  isPv2BuildcraftTestKitEnabled: mocks.testKit,
}))
vi.mock('@/server/progression/supabase-progression-repository', () => ({
  createSupabaseProgressionRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-attribute-repository', () => ({
  createSupabaseCharacterAttributeRepository: () => ({}),
}))
vi.mock('@/components/character/character-profile-shell', () => ({
  CharacterProfileShell: () => null,
}))
vi.mock('@/components/shell/authenticated-game-shell', () => ({
  AuthenticatedGameRecovery: () => null,
}))
vi.mock('@/server/logging', () => import('../../../server/logging'))

import { CharacterProfileShell } from '@/components/character/character-profile-shell'
import { AuthenticatedGameRecovery } from '@/components/shell/authenticated-game-shell'

import CharacterProfilePage from './page'

const character: PersistedCharacter = {
  id: '00000000-0000-4000-8000-000000000901',
  userId: '00000000-0000-4000-8000-000000000902',
  slotIndex: 0,
  rulesVersion: 1,
  name: 'Profile Tester',
  nameKey: 'profiletester',
  presentationId: 'androgynous',
  pronounPresetId: 'they_them',
  portraitRef: 'portrait.starter.wayfarer-01',
  starterAppearanceRef: 'appearance.starter.roadworn',
  foundationDisciplineId: 'vanguard',
  attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
  level: 1,
  xp: 0,
  progressionCycle: { number: 1 },
  createdAt: '2026-09-12T00:00:00.000Z',
  cycleStartedAt: '2026-09-12T00:00:00.000Z',
  lastActiveAt: '2026-09-12T00:00:00.000Z',
}
const primaryDefinition = {
  id: 'vanguard',
  definitionVersion: 1,
  name: 'Vanguard',
  summary: 'Vanguard profile fixture.',
  enabledForPrimary: true,
  enabledForSecondary: true,
}
const primaryProfile = { disciplineId: 'vanguard', profileVersion: 1, statOffsets: {} }
const attunementPolicy = {
  version: 1,
  primaryCooldownSeconds: 14_400,
  secondaryCooldownSeconds: 14_400,
}
const disciplineBuild: CharacterBuildContext = {
  build: {
    characterId: character.id,
    schemaVersion: 4,
    buildVersion: 1,
    primaryDefinition,
    primaryProfile,
    secondaryDefinition: null,
    primaryAttunementLockedUntil: null,
    secondaryAttunementLockedUntil: null,
    attunementPolicy,
    serverNow: character.createdAt,
    updatedAt: character.createdAt,
  },
  current: buildPrimaryDisciplinePreview({
    attributes: character.attributes,
    level: character.level,
    primaryDefinition,
    primaryProfile,
  }),
  currentSecondary: null,
  availablePrimaries: [
    { definition: primaryDefinition, profile: primaryProfile, masteredAt: null },
  ],
  availableSecondaries: [],
  attunement: {
    policy: attunementPolicy,
    serverNow: character.createdAt,
    primaryLockedUntil: null,
    secondaryLockedUntil: null,
    primaryRemainingSeconds: 0,
    secondaryRemainingSeconds: 0,
  },
  disciplineSkills: {
    capacity: 4,
    learnedSkills: [],
    equippedSkills: [],
    extensions: {
      resonance: null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  },
}
const attributeAllocation: CharacterAttributeAllocationView = {
  characterId: character.id,
  attributes: character.attributes,
  baseAttributes: character.attributes,
  level: 1,
  pointPool: 36,
  personalPointPool: 36,
  spentPoints: 36,
  unspentPoints: 0,
  conversionRequired: false,
  resetWindowStartedAt: null,
  resetUsed: 0,
  resetRemaining: 3,
  resetRenewsAt: null,
  serverNow: character.createdAt,
}

const recoveryStages = [
  ['selected_character', mocks.selectedCharacter],
  ['level_curve', mocks.levelCurve],
  ['discipline_build', mocks.disciplineBuild],
  ['attribute_allocation', mocks.attributeAllocation],
] as const

describe('Profile persistence recovery diagnostics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`)
    })
    mocks.actor.mockResolvedValue({ userId: character.userId })
    mocks.activeBattle.mockResolvedValue(null)
    mocks.activeSpectating.mockResolvedValue(null)
    mocks.selectedCharacter.mockResolvedValue(character)
    mocks.levelCurve.mockResolvedValue({
      version: 1,
      maxLevel: 50,
      cumulativeXpByLevel: Array.from({ length: 50 }, (_, index) => index * 100),
    })
    mocks.disciplineBuild.mockResolvedValue(disciplineBuild)
    mocks.attributeAllocation.mockResolvedValue(attributeAllocation)
    mocks.titleState.mockResolvedValue({ personalTitle: null, personalTitleSetAt: null })
    mocks.displayState.mockResolvedValue({ imageUrl: null })
    mocks.testKit.mockResolvedValue(false)
  })

  afterEach(() => vi.restoreAllMocks())

  it.each(recoveryStages)('records the %s stage when rendering recovery', async (stage, load) => {
    load.mockRejectedValue(
      new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Private query detail', {
        cause: new Error('Private connection detail'),
      }),
    )

    const page = await CharacterProfilePage()

    expect(page.type).toBe(AuthenticatedGameRecovery)
    expect(console.error).toHaveBeenCalledOnce()
    const entry = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]))
    expect(entry).toEqual({
      timestamp: expect.any(String),
      level: 'error',
      event: 'character_profile.persistence_unavailable',
      route: '/game/character',
      stage,
      code: 'PERSISTENCE_UNAVAILABLE',
    })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('renders healthy Profile data without a recovery log', async () => {
    const page = await CharacterProfilePage()

    expect(page.type).toBe(CharacterProfileShell)
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each(recoveryStages)('propagates unexpected %s failures', async (_stage, load) => {
    const failure = new TypeError('Unexpected programming failure')
    load.mockRejectedValue(failure)

    await expect(CharacterProfilePage()).rejects.toBe(failure)
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([mocks.titleState, mocks.displayState])(
    'keeps cosmetic failures optional',
    async (load) => {
      load.mockRejectedValue(
        new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Cosmetic lookup unavailable'),
      )

      const page = await CharacterProfilePage()

      expect(page.type).toBe(CharacterProfileShell)
      expect(console.error).not.toHaveBeenCalled()
    },
  )

  it('preserves active-battle redirection before character recovery', async () => {
    mocks.activeBattle.mockResolvedValue({
      battleSessionId: 'active-battle',
      battleId: 'battle',
      lifecycle: 'active',
      updatedAt: character.createdAt,
      isPvp: false,
    })
    mocks.selectedCharacter.mockRejectedValue(
      new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Unavailable'),
    )

    await expect(CharacterProfilePage()).rejects.toThrow('redirect:/game/battle/active-battle')
    expect(console.error).not.toHaveBeenCalled()
  })
})
