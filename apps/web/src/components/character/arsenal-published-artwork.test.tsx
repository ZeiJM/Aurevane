import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CombatContentVersionRecord } from '@aurevane/db/combat-content'
import { buildPrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import { buildCharacterProfileReadModel } from '@aurevane/game-core/character/profile'
import { contentArtworkKey } from '@aurevane/game-core/combat/content-media'
import { battleSkillArtwork } from '../battle/battle-skill-presentation'
import {
  createResolvedBattleBuildAuthoritySnapshot,
  resolvePinnedBattleEssenceDefinition,
} from '@/server/battle/battle-build-authority'
import type { FinalizedContentImage } from '@aurevane/game-core/combat/content-media'
import {
  essenceSnapshotReference,
  resolveEssenceForBuild,
  type EssenceDefinition,
} from '@aurevane/game-core/combat/essence'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import {
  resonanceSnapshotReference,
  resolveResonanceForPair,
} from '@aurevane/game-core/combat/resonance'
import type { CharacterDisciplineSkillLoadoutView } from '@/server/character/character-build-service'
import { resolveCurrentCharacterSkillDetails } from '@/server/character/current-skill-detail-loader'
import { createCombatContentResolver } from '@/server/combat/combat-content-resolver'
import { CharacterArsenalShell, EssenceHoverPreview } from './character-arsenal-shell'
import type { CharacterWorkspaceProps } from './character-profile-shell'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {} }),
  usePathname: () => '/game/character/arsenal',
  useSearchParams: () => new URLSearchParams(),
}))

const artwork: FinalizedContentImage = {
  id: '00000000-0000-4000-8000-000000000012',
  kind: 'image',
  checksum: 'a'.repeat(64),
  byteLength: 1024,
  contentType: 'image/png',
  width: 128,
  height: 128,
  sourceWidth: 128,
  sourceHeight: 128,
  crop: { x: 0, y: 0, size: 128 },
}
const oldEssence = resolveEssenceForBuild('aetherist', null)!
const oldSkill = resolveMatureSkillVersion('aetherist.arc-bolt')!
const oldResonance = resolveResonanceForPair('aetherist', 'vanguard')!
const customEssence: EssenceDefinition = {
  ...oldEssence,
  essenceId: 'custom.kamehameha',
  name: 'Kamehameha',
  contentVersion: 77,
  skill: {
    ...oldEssence.skill,
    id: 'custom.kamehameha',
    contentVersion: 77,
    media: { ...oldEssence.skill.media, artwork },
  },
}
const customSkill = {
  ...oldSkill,
  contentVersion: 77,
  media: { ...oldSkill.media, artwork: { ...artwork, id: '00000000-0000-4000-8000-000000000013' } },
}
const customResonance = {
  ...oldResonance,
  contentVersion: 77,
  media: {
    ...oldResonance.media!,
    artwork: { ...artwork, id: '00000000-0000-4000-8000-000000000014' },
  },
}
function publication(
  kind: CombatContentVersionRecord['contentKind'],
  key: string,
  definition: { readonly contentVersion: number },
): CombatContentVersionRecord {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    contentKey: key,
    contentKind: kind,
    contentVersion: definition.contentVersion,
    definition: structuredClone(definition) as Readonly<Record<string, unknown>>,
    publishedBy: '00000000-0000-4000-8000-000000000101',
    publishedAt: '2026-10-30T00:00:00.000Z',
  }
}
const publications = [
  publication('essence', customEssence.essenceId, customEssence),
  publication('skill', customSkill.id, customSkill),
  publication('resonance', customResonance.id, customResonance),
]
function publishedResolver(currentEssence = customEssence) {
  const versions = [
    ...publications,
    publication('essence', currentEssence.essenceId, currentEssence),
  ]
  return createCombatContentResolver({
    async findCurrentSkill(key) {
      return (
        publications.find((row) => row.contentKind === 'skill' && row.contentKey === key) ?? null
      )
    },
    async findSkillVersion(key, version) {
      return (
        versions.find(
          (row) =>
            row.contentKind === 'skill' && row.contentKey === key && row.contentVersion === version,
        ) ?? null
      )
    },
    async findContentVersion(key, kind, version) {
      return (
        versions.find(
          (row) =>
            row.contentKind === kind && row.contentKey === key && row.contentVersion === version,
        ) ?? null
      )
    },
    async readCurrentDisciplineSelection(_primary, secondary) {
      return {
        catalogueToken: 'test-current-publications',
        selectionVersion: 1,
        essence: secondary ? null : essenceSnapshotReference(currentEssence),
        resonance: secondary ? resonanceSnapshotReference(customResonance) : null,
      }
    },
  })
}
const resolver = publishedResolver()
function loadout(mixed = false): CharacterDisciplineSkillLoadoutView {
  return {
    capacity: 4,
    learnedSkills: [{ definition: oldSkill, learnedAt: '', activeSource: true }],
    equippedSkills: [{ definition: oldSkill, slotIndex: 1, equippedAt: '' }],
    extensions: {
      essence: mixed
        ? null
        : {
            ...customEssence,
            contentVersion: 76,
            skill: { ...customEssence.skill, contentVersion: 76, media: oldEssence.skill.media },
          },
      resonance: mixed ? oldResonance : null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}
function workspace(
  disciplineSkills: CharacterWorkspaceProps['disciplineBuild']['disciplineSkills'],
  mixed = false,
): CharacterWorkspaceProps {
  const attributes = { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 }
  const primary = {
    ...getFoundationDiscipline('aetherist')!,
    definitionVersion: 1,
    enabledForPrimary: true,
    enabledForSecondary: true,
  }
  const characterId = '00000000-0000-4000-8000-000000000102'
  return {
    profile: buildCharacterProfileReadModel(
      {
        id: characterId,
        userId: '00000000-0000-4000-8000-000000000101',
        slotIndex: 0,
        rulesVersion: 1,
        name: 'Artwork Reader',
        nameKey: 'artworkreader',
        presentationId: 'androgynous',
        pronounPresetId: 'they_them',
        portraitRef: 'portrait.starter.wayfarer-01',
        starterAppearanceRef: 'appearance.starter.roadworn',
        foundationDisciplineId: 'aetherist',
        attributes,
        level: 1,
        xp: 0,
        progressionCycle: { number: 1 },
        createdAt: '',
        cycleStartedAt: '',
        lastActiveAt: '',
      },
      {
        version: 1,
        maxLevel: 100,
        cumulativeXpByLevel: Array.from({ length: 100 }, (_, index) => index * 100),
      },
    ),
    attributeAllocation: {
      characterId,
      attributes,
      baseAttributes: attributes,
      level: 1,
      pointPool: 36,
      personalPointPool: 5,
      spentPoints: 36,
      unspentPoints: 0,
      conversionRequired: false,
      resetWindowStartedAt: null,
      resetUsed: 0,
      resetRemaining: 5,
      resetRenewsAt: null,
      serverNow: '2026-10-30T00:00:00Z',
    },
    disciplineBuild: {
      buildVersion: 1,
      current: buildPrimaryDisciplinePreview({
        attributes,
        level: 1,
        primaryDefinition: primary,
        primaryProfile: { disciplineId: primary.id, profileVersion: 1, statOffsets: {} },
      }),
      currentSecondary: mixed
        ? {
            ...getFoundationDiscipline('vanguard')!,
            definitionVersion: 1,
            enabledForPrimary: true,
            enabledForSecondary: true,
          }
        : null,
      availablePrimaries: [],
      availableSecondaries: [],
      attunement: {
        policy: { version: 1, primaryCooldownSeconds: 14400, secondaryCooldownSeconds: 14400 },
        serverNow: '2026-10-30T00:00:00Z',
        primaryLockedUntil: null,
        secondaryLockedUntil: null,
        primaryRemainingSeconds: 0,
        secondaryRemainingSeconds: 0,
      },
      disciplineSkills,
    },
  }
}

describe('Arsenal renders current published artwork through the validated public loadout reader', () => {
  it('shows the committed custom Essence image in Attunement instead of the unknown-ID fallback', async () => {
    const persisted = loadout()
    const before = JSON.stringify(persisted)
    const current = await resolveCurrentCharacterSkillDetails(persisted, resolver)
    expect(current.extensions.essence?.skill.media.artwork).toEqual(artwork)
    const html = renderToStaticMarkup(<CharacterArsenalShell {...workspace(current)} />)
    expect(html).toMatch(
      /aria-label="Preview Essence: Kamehameha"[\s\S]*?src="\/api\/content-media\/00000000-0000-4000-8000-000000000012"/,
    )
    expect(html).not.toContain('/media/skills/missing-art.svg')
    expect(html).not.toMatch(/accuracyMode|accuracyModifierBasisPoints|accuracyRule/)
    expect(JSON.stringify(persisted)).toBe(before)
  })

  it('shows equipped Technique publication artwork in the overview', async () => {
    const current = await resolveCurrentCharacterSkillDetails(loadout(), resolver)
    const html = renderToStaticMarkup(<CharacterArsenalShell {...workspace(current)} />)
    expect(html).toMatch(
      /data-arsenal-technique-row="true" data-equipped="true"[\s\S]*?src="\/api\/content-media\/00000000-0000-4000-8000-000000000013"/,
    )
    expect(
      html.match(/src="\/api\/content-media\/00000000-0000-4000-8000-000000000013"/g),
    ).toHaveLength(1)
  })

  it('preserves the current Resonance custom image and builtin Essence fallback', async () => {
    const current = await resolveCurrentCharacterSkillDetails(loadout(true), resolver)
    const html = renderToStaticMarkup(<CharacterArsenalShell {...workspace(current, true)} />)
    expect(html).toMatch(
      /aria-label="Preview Resonance:[\s\S]*?src="\/api\/content-media\/00000000-0000-4000-8000-000000000014"/,
    )
    const builtin = renderToStaticMarkup(<EssenceHoverPreview essence={oldEssence} />)
    expect(builtin).toContain('src="/media/art/essence-skills/aetherist-aether-nova-v01.webp"')
    const missing = renderToStaticMarkup(
      <EssenceHoverPreview
        essence={{
          ...customEssence,
          skill: {
            ...customEssence.skill,
            media: { iconKey: null, audioCueKey: null, vfxKey: null },
          },
        }}
      />,
    )
    expect(missing).toContain('src="/media/skills/missing-art.svg"')
  })
})

it.each(['pve', 'pvp'] as const)(
  'keeps the captured %s Essence artwork when the current publication changes',
  async (mode) => {
    const characterId = '00000000-0000-4000-8000-000000000102'
    const combatantId = `character:${characterId}`
    const inputs = [
      {
        combatantId,
        characterId,
        snapshot: {
          schemaVersion: 3 as const,
          buildVersion: 1,
          primary: { disciplineId: 'aetherist', definitionVersion: 1, profileVersion: 1 },
          secondary: null,
          disciplineSkills: [],
          extensions: {
            essence: essenceSnapshotReference(customEssence),
            resonance: null,
            equipmentSkills: [] as never[],
            supernatural: null,
            prestige: null,
          },
        },
      },
    ]
    const captured = await createResolvedBattleBuildAuthoritySnapshot(mode, inputs, resolver)
    const before = JSON.stringify(captured)
    const changed = {
      ...customEssence,
      contentVersion: 78,
      skill: {
        ...customEssence.skill,
        contentVersion: 78,
        media: {
          ...customEssence.skill.media,
          artwork: { ...artwork, id: '00000000-0000-4000-8000-000000000015' },
        },
      },
    }
    const updatedResolver = publishedResolver(changed)
    const newBattle = await createResolvedBattleBuildAuthoritySnapshot(
      mode,
      inputs,
      updatedResolver,
    )
    const [pinned, current] = await Promise.all([
      resolvePinnedBattleEssenceDefinition(captured, combatantId, updatedResolver),
      resolvePinnedBattleEssenceDefinition(newBattle, combatantId, updatedResolver),
    ])
    expect(pinned).not.toBeNull()
    expect(current).not.toBeNull()
    expect(battleSkillArtwork(pinned!.skill.id, contentArtworkKey(pinned!.skill.media))).toBe(
      '/api/content-media/00000000-0000-4000-8000-000000000012',
    )
    expect(battleSkillArtwork(current!.skill.id, contentArtworkKey(current!.skill.media))).toBe(
      '/api/content-media/00000000-0000-4000-8000-000000000015',
    )
    expect(JSON.stringify(captured)).toBe(before)
  },
)
