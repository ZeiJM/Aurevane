function media(resonanceId: string) {
  return {
    iconKey: `${resonanceId}.icon`,
    audioCueKey: `${resonanceId}.audio`,
    vfxKey: `${resonanceId}.vfx`,
  }
}

function authoring(...tags: string[]) {
  return {
    schemaVersion: 1 as const,
    status: 'representative' as const,
    validationTags: ['p3.5', 'representative', 'foundation-trio', ...tags],
  }
}

export const FOUNDATION_TRIO_RESONANCES = [
  {
    id: 'resonance.aetherist-farstrider.arcane-hunt',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['aetherist', 'farstrider'],
    name: 'Arcane Hunt',
    description:
      "Farstrider's mark arms the line; the next Aetherist mystic attack detonates it for additional damage.",
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'farstrider', requiredTags: ['mark'] },
      payoff: { sourceDisciplineId: 'aetherist', requiredTags: ['attack', 'mystic'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
      aiSetupUtilityBonus: 12,
      aiPayoffUtilityBonus: 27,
    },
    media: media('resonance.aetherist-farstrider.arcane-hunt'),
    authoring: authoring('mark-payoff'),
  },
  {
    id: 'resonance.aetherist-lifebinder.vital-circuit',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['aetherist', 'lifebinder'],
    name: 'Vital Circuit',
    description:
      'A Lifebinder heal primes the circuit; the next Aetherist mystic attack gains a bounded damage surge.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'lifebinder', requiredTags: ['heal'] },
      payoff: { sourceDisciplineId: 'aetherist', requiredTags: ['attack', 'mystic'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 4 }],
      aiSetupUtilityBonus: 10,
      aiPayoffUtilityBonus: 24,
    },
    media: media('resonance.aetherist-lifebinder.vital-circuit'),
    authoring: authoring('heal-payoff'),
  },
  {
    id: 'resonance.aetherist-shadehand.veiled-conduit',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['aetherist', 'shadehand'],
    name: 'Veiled Conduit',
    description:
      'Aetherist exposure creates a hidden conduit; the next Shadehand melee attack cashes it in for bonus damage.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'aetherist', requiredTags: ['expose'] },
      payoff: { sourceDisciplineId: 'shadehand', requiredTags: ['attack', 'melee'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 6 }],
      aiSetupUtilityBonus: 13,
      aiPayoffUtilityBonus: 30,
    },
    media: media('resonance.aetherist-shadehand.veiled-conduit'),
    authoring: authoring('expose-payoff'),
  },
  {
    id: 'resonance.aetherist-vanguard.spellsteel-rhythm',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['aetherist', 'vanguard'],
    name: 'Spellsteel Rhythm',
    description:
      'A Vanguard melee attack establishes the rhythm; the next Aetherist mystic attack strikes harder.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'vanguard', requiredTags: ['attack', 'melee'] },
      payoff: { sourceDisciplineId: 'aetherist', requiredTags: ['attack', 'mystic'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
      aiSetupUtilityBonus: 9,
      aiPayoffUtilityBonus: 26,
    },
    media: media('resonance.aetherist-vanguard.spellsteel-rhythm'),
    authoring: authoring('attack-payoff'),
  },
  {
    id: 'resonance.farstrider-lifebinder.guided-renewal',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['farstrider', 'lifebinder'],
    name: 'Guided Renewal',
    description:
      'A Lifebinder heal steadies the shot; the next Farstrider ranged attack deals additional damage.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'lifebinder', requiredTags: ['heal'] },
      payoff: { sourceDisciplineId: 'farstrider', requiredTags: ['attack', 'ranged'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 4 }],
      aiSetupUtilityBonus: 10,
      aiPayoffUtilityBonus: 24,
    },
    media: media('resonance.farstrider-lifebinder.guided-renewal'),
    authoring: authoring('heal-payoff'),
  },
  {
    id: 'resonance.farstrider-shadehand.marked-opening',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['farstrider', 'shadehand'],
    name: 'Marked Opening',
    description:
      "Farstrider's mark exposes the route; the next Shadehand melee attack gains a stronger payoff.",
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'farstrider', requiredTags: ['mark'] },
      payoff: { sourceDisciplineId: 'shadehand', requiredTags: ['attack', 'melee'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 6 }],
      aiSetupUtilityBonus: 13,
      aiPayoffUtilityBonus: 30,
    },
    media: media('resonance.farstrider-shadehand.marked-opening'),
    authoring: authoring('mark-payoff'),
  },
  {
    id: 'resonance.farstrider-vanguard.covering-break',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['farstrider', 'vanguard'],
    name: 'Covering Break',
    description:
      'A Farstrider ranged attack opens the approach; the next Vanguard melee attack hits with extra force.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'farstrider', requiredTags: ['attack', 'ranged'] },
      payoff: { sourceDisciplineId: 'vanguard', requiredTags: ['attack', 'melee'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 4 }],
      aiSetupUtilityBonus: 9,
      aiPayoffUtilityBonus: 24,
    },
    media: media('resonance.farstrider-vanguard.covering-break'),
    authoring: authoring('attack-payoff'),
  },
  {
    id: 'resonance.lifebinder-shadehand.mercy-in-shadow',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['lifebinder', 'shadehand'],
    name: 'Mercy in Shadow',
    description:
      'A Lifebinder heal creates the opening; the next Shadehand melee attack turns that tempo into damage.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'lifebinder', requiredTags: ['heal'] },
      payoff: { sourceDisciplineId: 'shadehand', requiredTags: ['attack', 'melee'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
      aiSetupUtilityBonus: 10,
      aiPayoffUtilityBonus: 27,
    },
    media: media('resonance.lifebinder-shadehand.mercy-in-shadow'),
    authoring: authoring('heal-payoff'),
  },
  {
    id: 'resonance.shadehand-vanguard.broken-line',
    contentVersion: 1,
    enabled: true,
    disciplinePair: ['shadehand', 'vanguard'],
    name: 'Broken Line',
    description:
      'A Shadehand exposure fractures the defense; the next Vanguard melee attack receives a bounded damage payoff.',
    trigger: {
      kind: 'skill-sequence',
      setup: { sourceDisciplineId: 'shadehand', requiredTags: ['expose'] },
      payoff: { sourceDisciplineId: 'vanguard', requiredTags: ['attack', 'melee'] },
      payoffEffects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
      aiSetupUtilityBonus: 12,
      aiPayoffUtilityBonus: 27,
    },
    media: media('resonance.shadehand-vanguard.broken-line'),
    authoring: authoring('expose-payoff'),
  },
] as const
