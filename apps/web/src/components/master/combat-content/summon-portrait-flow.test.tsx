import { VESPER_SUMMON_PROFILE } from '@aurevane/game-core/combat/universal-support'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (callback: () => unknown) => callback(),
  useRef: (current: unknown) => ({ current }),
  useId: () => 'summon-portrait-guidance',
  useEffect: () => {},
}))
import { AbilityEffectEditor } from './ability-effect-editor'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  type AbilityEffect,
} from '@aurevane/game-core/combat/combat-definition'
import { SummonProfileEditor } from './summon-profile-editor'
import { FinalizedMediaEditor } from './finalized-media-editor'
import { validateSkillDefinition } from '@/server/master/combat-content-authoring-validation'
import {
  previewBasicCombatContentDefinition,
  previewCombatContentDefinition,
} from '@/server/master/combat-content-preview'
import { createCurrentStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { spawnCombatSummon } from '@aurevane/game-core/combat/combat-summons'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'
import { capturedBasicBattle } from '@/components/battle/battle-basic-actions.test-utils'
import {
  battlePresentationParticipantMap,
  type BattlePresentationParticipant,
} from '@/components/battle/battle-runtime'
import { BattleCombatantCard } from '@/components/battle/battle-combatant-card'
import { readSummonInspectMetadata } from '@/components/battle/battle-summon-inspect'
import type { SummonProfileDefinition } from '@aurevane/game-core/combat/summon-content'

const artwork = {
  id: '00000000-0000-4000-8000-000000000012',
  kind: 'image' as const,
  contentType: 'image/png' as const,
  checksum: 'a'.repeat(64),
  byteLength: 100,
  width: 4,
  height: 4,
  sourceWidth: 8,
  sourceHeight: 4,
  crop: { x: 2, y: 0, size: 4 },
}
type Props = Record<string, unknown> & { children?: ReactNode }
function all(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(all)
  return isValidElement<Props>(node) ? [node, ...all(node.props.children)] : []
}
it.each([false, true])(
  'captures the image-only Summon portrait editor into spawned public cards and inspection (canonical editor %s)',
  (canonical) => {
    const native = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!
    let profile = native.summonProfile!
    let effect: AbilityEffect = {
      id: 'spawn',
      timing: 'instant',
      payload: { type: 'summon', recipient: 'selected-tile', profile },
    }
    const parent = canonical
      ? all(
          AbilityEffectEditor({
            value: effect,
            onChange: (next) => {
              effect = next
              if (next.payload.type === 'summon') profile = next.payload.profile
            },
          }),
        ).find((node) => node.type === SummonProfileEditor)!
      : null
    const tree = SummonProfileEditor(
      parent
        ? (parent.props as never)
        : {
            value: profile,
            canonical,
            onChange: (next) => {
              profile = next
            },
          },
    )
    const editor = all(tree).find((node) => node.type === FinalizedMediaEditor)
    expect(
      editor,
      'The profile itself needs an image selector, independent of Skill artwork',
    ).toBeDefined()
    expect(editor!.props.allowAudio).toBe(false)
    ;(editor!.props.onChange as (value: unknown) => void)({ artwork: structuredClone(artwork) })
    expect(profile).toMatchObject({ media: { artwork } })
    const definition = canonical
      ? {
          ...defaultBasicSkills().find((row) => row.id === 'basic.invocation')!,
          ability: parseAbilityDefinition({
            schemaVersion: 1,
            behaviors: [
              {
                ...defaultBasicSkills().find((row) => row.id === 'basic.guard')!.ability
                  .behaviors[0]!,
                id: 'call',
                classification: 'utility',
                targeting: { ...native.target, geometryVersion: 3, maximumSelections: 1 },
                effects: [effect],
              },
            ],
          }),
        }
      : { ...native, summonProfile: profile }
    expect(validateSkillDefinition(definition).valid).toBe(true)
    const preview = canonical
      ? previewBasicCombatContentDefinition(
          definition as ReturnType<typeof defaultBasicSkills>[number],
        )
      : previewCombatContentDefinition(definition as typeof native)
    expect(preview.summon?.profile).toMatchObject({
      media: { artwork },
    })
    const fixture = capturedBasicBattle()
    const base = createCurrentStatDrivenCombatEncounterState(
      fixture.state,
      fixture.state.statBridge.combatants.map((row) => ({
        ...row,
        level: 1,
        physicalPower: 20,
        mysticPower: 20,
        criticalChance: 0,
      })),
    )
    const spawned = spawnCombatSummon(base, {
      ownerCombatantId: 'actor',
      sourceSkillId: native.id,
      sourceSkillVersion: native.contentVersion,
      profile,
      position: { x: 0, y: 3 },
      facing: 'east',
    }).state
    const snapshot = projectBattleSnapshot(
      spawned,
      deriveParticipantBattleViewerEntitlement(spawned.tactical.battle.combatants, ['actor']),
    )
    const view = { ...fixture.view, snapshot }
    const owner: BattlePresentationParticipant = {
      combatantId: 'actor',
      characterId: null,
      name: 'Owner',
      level: 1,
      teamIndex: 0,
      seatIndex: 0,
      profileImageUrl: null,
      portraitAssetId: null,
      local: true,
    }
    const id = snapshot.effectState!.summons![0]!.combatantId
    const participant = battlePresentationParticipantMap(view, [owner]).get(id)!
    const source = `/api/content-media/${artwork.id}`
    expect(participant.profileImageUrl).toBe(source)
    const html = renderToStaticMarkup(
      <BattleCombatantCard participant={participant} battle={view} teamCount={2} role="selected" />,
    )
    expect(html).toContain(`src="${source}"`)
    expect(html).not.toContain('/api/master/')
    expect(readSummonInspectMetadata(snapshot, id)).toMatchObject({ portraitUrl: source })
    ;(profile as unknown as { media: { artwork: { checksum: string } } }).media.artwork.checksum =
      'f'.repeat(64)
    expect(snapshot.effectState!.summons![0]!.profile).toMatchObject({
      media: { artwork: { checksum: 'a'.repeat(64) } },
    })
  },
)
it('rejects external URLs, audio, forged descriptors and extra portrait metadata', () => {
  const native = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!
  for (const media of [
    { artwork: 'https://external.test/private.png' },
    { artwork: { ...artwork, checksum: 'invalid' } },
    { artwork: { ...artwork, kind: 'audio' } },
    { artwork, privateSource: 'secret' },
    { artwork, audio: null },
  ]) {
    expect(
      validateSkillDefinition({ ...native, summonProfile: { ...native.summonProfile!, media } })
        .valid,
    ).toBe(false)
  }
  const historical: SummonProfileDefinition = native.summonProfile!
  expect(validateSkillDefinition({ ...native, summonProfile: historical }).valid).toBe(true)
})

it('projects Vesper static artwork into shared battle cards and Inspect without a hosted upload', () => {
  const fixture = capturedBasicBattle()
  const base = createCurrentStatDrivenCombatEncounterState(
    fixture.state,
    fixture.state.statBridge.combatants.map((row) => ({
      ...row,
      level: 1,
      physicalPower: 20,
      mysticPower: 20,
      criticalChance: 0,
    })),
  )
  const spawned = spawnCombatSummon(base, {
    ownerCombatantId: 'actor',
    sourceSkillId: 'basic.invocation',
    sourceSkillVersion: 1,
    profile: VESPER_SUMMON_PROFILE,
    position: { x: 0, y: 3 },
    facing: 'east',
  }).state
  const snapshot = projectBattleSnapshot(
    spawned,
    deriveParticipantBattleViewerEntitlement(spawned.tactical.battle.combatants, ['actor']),
  )
  const view = { ...fixture.view, snapshot }
  const owner: BattlePresentationParticipant = {
    combatantId: 'actor',
    characterId: null,
    name: 'Owner',
    level: 1,
    teamIndex: 0,
    seatIndex: 0,
    profileImageUrl: null,
    portraitAssetId: null,
    local: true,
  }
  const id = snapshot.effectState!.summons![0]!.combatantId
  const participant = battlePresentationParticipantMap(view, [owner]).get(id)!
  const src = '/media/art/support/vesper-portrait-v01.webp'
  expect(participant.profileImageUrl).toBe(src)
  expect(readSummonInspectMetadata(snapshot, id)).toMatchObject({
    name: 'Vesper',
    portraitUrl: src,
  })
  const html = renderToStaticMarkup(
    <BattleCombatantCard participant={participant} battle={view} teamCount={2} role="selected" />,
  )
  expect(html).toContain(`src="${src}"`)
})
