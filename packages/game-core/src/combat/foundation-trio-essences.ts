const mysticEnemyTarget = {
  kind: 'unit',
  teamPolicy: 'enemy',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 4,
  requiresLineOfSight: true,
  maximumElevationDifference: 2,
  friendlyFire: 'enemies-only',
} as const

const farEnemyTarget = {
  kind: 'unit',
  teamPolicy: 'enemy',
  shape: { kind: 'single' },
  minimumRange: 2,
  maximumRange: 6,
  requiresLineOfSight: true,
  maximumElevationDifference: 3,
  friendlyFire: 'enemies-only',
} as const

const meleeEnemyTarget = {
  kind: 'unit',
  teamPolicy: 'enemy',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 1,
  requiresLineOfSight: false,
  maximumElevationDifference: 1,
  friendlyFire: 'enemies-only',
} as const

function media(essenceId: string) {
  return {
    iconKey: `${essenceId}.icon`,
    audioCueKey: `${essenceId}.audio`,
    vfxKey: `${essenceId}.vfx`,
  }
}

function skillAuthoring(disciplineId: string) {
  return {
    schemaVersion: 1 as const,
    status: 'representative' as const,
    validationTags: ['p3.6', 'representative', 'essence', 'pure-only', disciplineId],
  }
}

function essenceAuthoring(disciplineId: string) {
  return {
    schemaVersion: 1 as const,
    status: 'representative' as const,
    validationTags: ['p3.6', 'representative', 'pure-only', disciplineId],
  }
}

export const FOUNDATION_TRIO_ESSENCES = [
  {
    essenceId: 'essence.aetherist.aether-nova',
    contentVersion: 1,
    enabled: true,
    sourceDisciplineId: 'aetherist',
    name: 'Aether Nova',
    description:
      'A pure Aetherist Essence Skill: collapse a dense knot of aether into a wide destructive nova.',
    skill: {
      id: 'essence.aetherist.aether-nova',
      contentVersion: 1,
      enabled: true,
      nameRef: 'essence.aetherist.aether-nova.name',
      descriptionRef: 'essence.aetherist.aether-nova.description',
      sourceDisciplineId: 'aetherist',
      unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
      apCost: 60,
      target: {
        ...mysticEnemyTarget,
        maximumRange: 3,
        shape: { kind: 'circle', radius: 2 },
      },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'affected-units', amount: 14 }],
      tags: ['essence', 'aetherist', 'attack', 'mystic', 'ranged', 'area', 'cockpit:attack'],
      cooldown: { key: 'essence.aetherist.aether-nova', ownerTurns: 4 },
      ai: {
        enabled: true,
        baseUtility: 94,
        purposeTags: ['damage', 'area', 'pure-build'],
      },
      overrides: { pvp: { apCost: 65 } },
      media: media('essence.aetherist.aether-nova'),
      authoring: skillAuthoring('aetherist'),
    },
    authoring: essenceAuthoring('aetherist'),
  },
  {
    essenceId: 'essence.farstrider.deadeye-barrage',
    contentVersion: 1,
    enabled: true,
    sourceDisciplineId: 'farstrider',
    name: 'Deadeye Barrage',
    description:
      'A pure Farstrider Essence Skill: thread a lethal barrage through a distant firing lane.',
    skill: {
      id: 'essence.farstrider.deadeye-barrage',
      contentVersion: 1,
      enabled: true,
      nameRef: 'essence.farstrider.deadeye-barrage.name',
      descriptionRef: 'essence.farstrider.deadeye-barrage.description',
      sourceDisciplineId: 'farstrider',
      unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
      apCost: 60,
      target: {
        ...farEnemyTarget,
        shape: { kind: 'line', length: 5 },
      },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'affected-units', amount: 15 }],
      tags: ['essence', 'farstrider', 'attack', 'ranged', 'precision', 'area', 'cockpit:attack'],
      cooldown: { key: 'essence.farstrider.deadeye-barrage', ownerTurns: 4 },
      ai: {
        enabled: true,
        baseUtility: 94,
        purposeTags: ['damage', 'precision', 'pure-build'],
      },
      overrides: { pvp: { apCost: 65 } },
      media: media('essence.farstrider.deadeye-barrage'),
      authoring: skillAuthoring('farstrider'),
    },
    authoring: essenceAuthoring('farstrider'),
  },
  {
    essenceId: 'essence.shadehand.perfect-opening',
    contentVersion: 1,
    enabled: true,
    sourceDisciplineId: 'shadehand',
    name: 'Perfect Opening',
    description:
      'A pure Shadehand Essence Skill: convert angle and timing into a single devastating opening.',
    skill: {
      id: 'essence.shadehand.perfect-opening',
      contentVersion: 1,
      enabled: true,
      nameRef: 'essence.shadehand.perfect-opening.name',
      descriptionRef: 'essence.shadehand.perfect-opening.description',
      sourceDisciplineId: 'shadehand',
      unlockRequirement: { kind: 'discipline-mastery', minimumStage: 1 },
      apCost: 60,
      target: meleeEnemyTarget,
      requirements: [],
      effects: [
        {
          type: 'damage',
          recipient: 'primary-unit',
          amount: 14,
          facingModifiersBasisPoints: { front: 12_000, side: 16_000, rear: 22_000 },
        },
      ],
      tags: ['essence', 'shadehand', 'attack', 'melee', 'opportunist', 'finisher', 'cockpit:attack'],
      cooldown: { key: 'essence.shadehand.perfect-opening', ownerTurns: 4 },
      ai: {
        enabled: true,
        baseUtility: 96,
        purposeTags: ['damage', 'flank', 'pure-build'],
      },
      overrides: { pvp: { apCost: 65 } },
      media: media('essence.shadehand.perfect-opening'),
      authoring: skillAuthoring('shadehand'),
    },
    authoring: essenceAuthoring('shadehand'),
  },
] as const
