import { buildPrimaryDisciplinePreview } from '@aurevane/game-core/character/discipline-build'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import type { ItemInventorySnapshot } from '@aurevane/game-core/character/item-inventory'
import {
  loadCharacterItems,
  type CharacterItemsRepository,
} from '@/server/character/character-items-service'

import { CharacterProfileShell, type CharacterWorkspaceProps } from './character-profile-shell'

vi.mock('server-only', () => ({}))

vi.mock('./character-attribute-allocation-panel', () => ({
  CharacterAttributeAllocationPanel: () => null,
}))
vi.mock('./character-portrait-image', () => ({ CharacterPortraitImage: () => null }))
vi.mock('./character-rail-synchronized-layout', () => ({
  CharacterRailSynchronizedLayout: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))

const attributes = { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 }

it('shows real equipped combat totals with signed source indicators without altering Core Stats', () => {
  const equipmentBonuses = [
    {
      itemId: 'cowl',
      itemName: 'Ember-Stitched Cowl',
      position: 'head' as const,
      stat: 'mystic-power' as const,
      amount: 12,
      conditional: false,
    },
    {
      itemId: 'penalty',
      itemName: 'Heavy Gear',
      position: 'body' as const,
      stat: 'physical-power' as const,
      amount: -21,
      conditional: false,
    },
  ]
  const markup = renderToStaticMarkup(
    createElement(CharacterProfileShell, { ...props, equipmentBonuses }),
  )
  expect(markup).toContain('data-equipment-stat-delta="12"')
  expect(markup).toContain('(+12)')
  expect(markup).toContain('data-equipment-stat-delta="-21"')
  expect(markup).toContain('(-21)')
  expect(markup).toContain(
    `Physical Power, ${props.disciplineBuild.current.derived.stats.physicalPower.value - 21}.`,
  )
  expect(markup).toContain('data-testid="profile-attribute-might"')
})
it('carries owned equipped Items through the service into Profile totals exactly once', async () => {
  const definitions = Object.fromEntries(starterItemDefinitions().map((item) => [item.id, item]))
  const snapshot: ItemInventorySnapshot = {
    characterId: props.profile.characterId,
    revision: 4,
    stacks: ['ember-stitched-cowl', 'galewalker-boots', 'iron-shortsword'].map((id, slotIndex) => ({
      id,
      itemId: id,
      characterId: props.profile.characterId,
      inventoryCategory: 'gear',
      slotIndex,
      quantity: 1,
      acquiredAt: '',
      acquiredContentVersion: 1,
      provenance: 'private-receipt',
    })),
    equipment: { head: 'ember-stitched-cowl', boots: 'galewalker-boots' },
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    previousBasicSupport: 'basic.recover',
    grants: [],
  }
  const before = JSON.stringify({ snapshot, derived: props.disciplineBuild.current.derived })
  const repository: CharacterItemsRepository = {
    read: async () => ({ snapshot, definitions, catalogueToken: 'token', battleLocked: false }),
    write: vi.fn(async () => {
      throw new Error('Profile must not write Items.')
    }),
    grant: vi.fn(async () => {
      throw new Error('Profile must not grant Items.')
    }),
  }
  const view = await loadCharacterItems('user', props.profile.characterId, repository)
  expect(view.equipmentIssue).toBeNull()
  expect(view.statBonuses).toHaveLength(2)
  const markup = renderToStaticMarkup(
    createElement(CharacterProfileShell, { ...props, equipmentBonuses: view.statBonuses }),
  )
  expect(markup).toContain(
    `Mystic Power, ${props.disciplineBuild.current.derived.stats.mysticPower.value + 12}.`,
  )
  expect(markup).toContain(
    `Movement, ${props.disciplineBuild.current.derived.stats.movement.value + 2}.`,
  )
  expect(markup.match(/data-equipment-stat-delta=/g)).toHaveLength(2)
  expect(markup).not.toContain('private-receipt')
  expect(JSON.stringify({ snapshot, derived: props.disciplineBuild.current.derived })).toBe(before)

  const invalidView = await loadCharacterItems('user', props.profile.characterId, {
    ...repository,
    read: async () => ({ snapshot, definitions: {}, catalogueToken: 'token', battleLocked: false }),
  })
  expect(invalidView.equipmentIssue?.code).toBe('definition')
  expect(invalidView.statBonuses).toBeNull()
  const unavailableMarkup = renderToStaticMarkup(
    createElement(CharacterProfileShell, { ...props, equipmentBonuses: invalidView.statBonuses }),
  )
  expect(unavailableMarkup).toContain('Equipment bonuses could not be verified.')
  expect(unavailableMarkup).toContain(
    `Mystic Power, ${props.disciplineBuild.current.derived.stats.mysticPower.value}.`,
  )
  expect(unavailableMarkup).not.toContain('data-equipment-stat-delta=')
})

it('distinguishes verified empty equipment from unavailable bonuses', () => {
  const markup = renderToStaticMarkup(
    createElement(CharacterProfileShell, { ...props, equipmentBonuses: [] }),
  )
  expect(markup).not.toContain('Equipment bonuses could not be verified.')
  expect(markup).not.toContain('data-equipment-stat-delta=')
})

const primary = {
  id: 'aetherist' as const,
  definitionVersion: 1,
  name: 'Aetherist',
  summary: 'Arcane force.',
  enabledForPrimary: true,
  enabledForSecondary: true,
}
const props: CharacterWorkspaceProps = {
  profile: {
    characterId: 'profile-character',
    slotIndex: 0,
    identity: {
      name: 'Zei',
      presentationId: 'androgynous',
      presentationLabel: 'Androgynous',
      pronounPresetId: 'they_them',
      pronounLabel: 'They / Them',
      portraitRef: 'portrait.starter.wayfarer-01',
      starterAppearanceRef: 'appearance.starter.roadworn',
    },
    foundationDiscipline: primary,
    progression: {
      level: 1,
      xp: 0,
      cycleNumber: 1,
      progress: {
        curveVersion: 1,
        level: 1,
        maxLevel: 100,
        totalXp: 0,
        isMaxLevel: false,
        currentLevelThreshold: 0,
        nextLevelThreshold: 100,
        xpIntoLevel: 0,
        xpRequiredForNextLevel: 100,
        progressBasisPoints: 0,
      },
    },
    attributes,
    derived: buildPrimaryDisciplinePreview({
      attributes,
      level: 1,
      primaryDefinition: primary,
      primaryProfile: { disciplineId: primary.id, profileVersion: 1, statOffsets: {} },
    }).derived,
    timestamps: { createdAt: '', cycleStartedAt: '', lastActiveAt: '' },
  },
  attributeAllocation: {
    characterId: 'profile-character',
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
    serverNow: '2026-10-01T00:00:00Z',
  },
  disciplineBuild: {
    buildVersion: 1,
    current: buildPrimaryDisciplinePreview({
      attributes,
      level: 1,
      primaryDefinition: primary,
      primaryProfile: { disciplineId: primary.id, profileVersion: 1, statOffsets: {} },
    }),
    currentSecondary: null,
    availablePrimaries: [],
    availableSecondaries: [],
    attunement: {
      policy: { version: 1, primaryCooldownSeconds: 14400, secondaryCooldownSeconds: 14400 },
      serverNow: '',
      primaryLockedUntil: null,
      secondaryLockedUntil: null,
      primaryRemainingSeconds: 0,
      secondaryRemainingSeconds: 0,
    },
    disciplineSkills: {
      capacity: 4,
      learnedSkills: [],
      equippedSkills: [],
      extensions: { essence: null, resonance: null },
    },
  },
}

describe('Profile identity labels', () => {
  it('shows active discipline and personal title without a second identity card', () => {
    const markup = renderToStaticMarkup(
      createElement(CharacterProfileShell, {
        ...props,
        personalTitle: 'FrostShadow',
        disciplineBuild: {
          ...props.disciplineBuild,
          currentSecondary: {
            ...primary,
            id: 'lifebinder',
            name: 'Lifebinder',
          },
        },
      }),
    )
    expect(markup).not.toContain('data-testid="character-profile"')
    expect(markup).not.toContain('data-character-identity-copy')
    expect(markup).toContain('aria-label="Disciplines and titles"')
    expect(markup).toContain('data-testid="primary-discipline-chip">Aetherist')
    expect(markup).toContain('data-testid="secondary-discipline-chip">Lifebinder')
    expect(markup).toContain('aria-label="Primary Discipline"')
    expect(markup).toContain('aria-label="Secondary Discipline"')
    expect(markup).toContain('aria-label="Personal title"')
    expect(markup).not.toContain('<small>Primary Discipline</small>')
    expect(markup).not.toContain('<small>Secondary Discipline</small>')
    expect(markup).not.toContain('<small>Personal title</small>')
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('character-portrait-media')
    expect(markup).toContain('>FrostShadow</strong>')
  })

  it('omits absent secondary and title labels while retaining the primary', () => {
    const markup = renderToStaticMarkup(createElement(CharacterProfileShell, props))
    expect(markup).toContain('data-testid="primary-discipline-chip">Aetherist')
    expect(markup).not.toContain('secondary-discipline-chip')
    expect(markup).not.toContain('>Personal title</small>')
    expect(markup).not.toContain('FrostShadow')
    expect(markup).not.toContain('<details')
    expect(markup).not.toContain('character-portrait-media')
  })
})
