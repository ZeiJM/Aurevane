export const DISCIPLINE_MASTERY_STAGES = {
  initiate: 1,
  practiced: 2,
  adept: 3,
  expert: 4,
  master: 5,
} as const

export type DisciplineMasteryStage =
  (typeof DISCIPLINE_MASTERY_STAGES)[keyof typeof DISCIPLINE_MASTERY_STAGES]
export type DisciplineAtlasBand =
  'foundation' | 'first-journey' | 'rekindling-1' | 'rekindling-2' | 'rekindling-3'
export type DisciplineAtlasPublication = 'published' | 'planned'
export type DisciplineAtlasDisclosure = 'open' | 'secret'
export type DisciplineAtlasState =
  'veiled' | 'rumored' | 'revealed' | 'unlocked' | 'testing' | 'planned'

export interface DisciplinePowerProfile {
  reliability: 1 | 2 | 3 | 4 | 5
  flexibility: 1 | 2 | 3 | 4 | 5
  setup: 1 | 2 | 3 | 4 | 5
  ruleAccess: 1 | 2 | 3 | 4 | 5
  execution: 1 | 2 | 3 | 4 | 5
}

export type DisciplineUnlockRule =
  | { kind: 'always' }
  | { kind: 'mastery'; disciplineId: string; minimumStage: DisciplineMasteryStage }
  | { kind: 'rekindling'; minimumCount: 1 | 2 | 3 }
  | { kind: 'flag'; id: string; label: string }
  | { kind: 'all'; rules: readonly DisciplineUnlockRule[] }
  | { kind: 'any'; rules: readonly DisciplineUnlockRule[] }
  | { kind: 'count-of'; count: number; rules: readonly DisciplineUnlockRule[] }

export interface DisciplineAtlasEntry {
  id: string
  name: string
  summary: string
  family: 'foundation' | 'martial' | 'hybrid' | 'mage' | 'support'
  band: DisciplineAtlasBand
  publication: DisciplineAtlasPublication
  disclosure: DisciplineAtlasDisclosure
  unlock: DisciplineUnlockRule
  reveal?: DisciplineUnlockRule
  masteryRite?: string
  power: DisciplinePowerProfile
}

export interface DisciplineAtlasContext {
  masteryByDiscipline: Readonly<Record<string, DisciplineMasteryStage | undefined>>
  rekindlingCount: number
  flags?: readonly string[]
  revealedDisciplineIds?: readonly string[]
  testingAccess?: boolean
}

export interface DisciplineAtlasEvaluation {
  state: DisciplineAtlasState
  releaseEligible: boolean
  effectiveSelectable: boolean
  revealed: boolean
  unmetRequirements: readonly string[]
}

const stageLabel: Readonly<Record<DisciplineMasteryStage, string>> = {
  1: 'Initiate',
  2: 'Practiced',
  3: 'Adept',
  4: 'Expert',
  5: 'Master',
}

const mastery = (
  disciplineId: string,
  minimumStage: DisciplineMasteryStage,
): DisciplineUnlockRule => ({
  kind: 'mastery',
  disciplineId,
  minimumStage,
})
const rekindling = (minimumCount: 1 | 2 | 3): DisciplineUnlockRule => ({
  kind: 'rekindling',
  minimumCount,
})
const flag = (id: string, label: string): DisciplineUnlockRule => ({ kind: 'flag', id, label })
const all = (...rules: readonly DisciplineUnlockRule[]): DisciplineUnlockRule => ({
  kind: 'all',
  rules,
})
const countOf = (
  count: number,
  ...rules: readonly DisciplineUnlockRule[]
): DisciplineUnlockRule => ({
  kind: 'count-of',
  count,
  rules,
})

function power(
  reliability: DisciplinePowerProfile['reliability'],
  flexibility: DisciplinePowerProfile['flexibility'],
  setup: DisciplinePowerProfile['setup'],
  ruleAccess: DisciplinePowerProfile['ruleAccess'],
  execution: DisciplinePowerProfile['execution'],
): DisciplinePowerProfile {
  return { reliability, flexibility, setup, ruleAccess, execution }
}

function entry(
  id: string,
  name: string,
  summary: string,
  family: DisciplineAtlasEntry['family'],
  band: DisciplineAtlasBand,
  publication: DisciplineAtlasPublication,
  disclosure: DisciplineAtlasDisclosure,
  unlock: DisciplineUnlockRule,
  profile: DisciplinePowerProfile,
  masteryRite?: string,
  reveal?: DisciplineUnlockRule,
): DisciplineAtlasEntry {
  return {
    id,
    name,
    summary,
    family,
    band,
    publication,
    disclosure,
    unlock,
    power: profile,
    masteryRite,
    reveal,
  }
}

/**
 * Canonical identity-level roster. Planned entries deliberately carry no combat coefficients, base
 * profiles, Skills, Essences or Resonances: publication remains a separate content gate.
 */
export const DISCIPLINE_ATLAS: readonly DisciplineAtlasEntry[] = [
  entry(
    'vanguard',
    'Vanguard',
    'Armed generalist built around pressure, Guard and dependable frontline decisions.',
    'foundation',
    'foundation',
    'published',
    'open',
    { kind: 'always' },
    power(5, 4, 1, 1, 2),
    'The Unbroken Line',
  ),
  entry(
    'farstrider',
    'Farstrider',
    'Ranged awareness, marks, firing lanes and mobile battlefield control.',
    'foundation',
    'foundation',
    'published',
    'open',
    { kind: 'always' },
    power(5, 4, 2, 2, 2),
    'The Long Hunt',
  ),
  entry(
    'shadehand',
    'Shadehand',
    'Mobility, deception and opportunistic attacks that turn openings into advantage.',
    'foundation',
    'foundation',
    'published',
    'open',
    { kind: 'always' },
    power(4, 4, 3, 2, 3),
    'The Perfect Opening',
  ),
  entry(
    'ironfist',
    'Ironfist',
    'Unarmed pressure, counters and close-range sequencing.',
    'foundation',
    'foundation',
    'published',
    'open',
    { kind: 'always' },
    power(5, 3, 2, 2, 3),
    'The Empty Hand',
  ),
  entry(
    'aetherist',
    'Aetherist',
    'Flexible offensive magic and the broad foundation for specialist spell traditions.',
    'foundation',
    'foundation',
    'published',
    'open',
    { kind: 'always' },
    power(4, 5, 2, 2, 3),
    'The Living Formula',
  ),
  entry(
    'lifebinder',
    'Lifebinder',
    'Healing, cleansing, barriers and measured support under pressure.',
    'foundation',
    'foundation',
    'published',
    'open',
    { kind: 'always' },
    power(5, 4, 2, 2, 3),
    'No One Falls',
  ),

  entry(
    'bastion',
    'Bastion',
    'Heavy defender specializing in protection, interception and denying enemy pressure.',
    'martial',
    'first-journey',
    'published',
    'open',
    mastery('vanguard', 3),
    power(5, 3, 3, 2, 3),
    'Last One Standing',
  ),
  entry(
    'ravager',
    'Ravager',
    'High-risk attacker that trades safety for violent tempo and bleeding pressure.',
    'martial',
    'first-journey',
    'published',
    'open',
    mastery('vanguard', 3),
    power(3, 3, 3, 3, 4),
  ),
  entry(
    'edgedancer',
    'Edgedancer',
    'Precision duelist using facing, lunges, openings and carefully timed answers.',
    'martial',
    'first-journey',
    'published',
    'open',
    all(mastery('vanguard', 2), mastery('shadehand', 2)),
    power(4, 4, 3, 3, 4),
  ),
  entry(
    'skywarden',
    'Skywarden',
    'Spear fighter who turns height, jumps and landing position into pressure.',
    'hybrid',
    'first-journey',
    'planned',
    'open',
    all(mastery('vanguard', 2), mastery('farstrider', 2)),
    power(4, 4, 3, 4, 4),
  ),
  entry(
    'blade-saint',
    'Blade Saint',
    'Patient swordmaster rewarded for restraint, timing and perfect responses.',
    'martial',
    'rekindling-1',
    'planned',
    'open',
    all(
      rekindling(1),
      mastery('vanguard', 4),
      mastery('ironfist', 3),
      flag('rite:blade-saint:still-blade', 'Complete the Still Blade initiation'),
    ),
    power(3, 3, 4, 4, 5),
  ),
  entry(
    'nightveil',
    'Nightveil',
    'Stealth assassin using smoke, clones, silence and positional pressure rather than instant kills.',
    'martial',
    'first-journey',
    'planned',
    'open',
    all(mastery('shadehand', 3), mastery('ironfist', 2)),
    power(3, 4, 4, 4, 5),
  ),
  entry(
    'wildwarden',
    'Wildwarden',
    'Hunter that controls a quarry through traps, marks and terrain pressure.',
    'martial',
    'first-journey',
    'published',
    'open',
    mastery('farstrider', 3),
    power(4, 4, 3, 3, 4),
  ),
  entry(
    'beastbinder',
    'Beastbinder',
    'Creature partnership and coordinated companion commands.',
    'hybrid',
    'first-journey',
    'planned',
    'open',
    all(mastery('farstrider', 3), mastery('ironfist', 2)),
    power(3, 5, 4, 4, 4),
  ),
  entry(
    'runeblade',
    'Runeblade',
    'Weapon-and-magic hybrid built around runes, mystic pressure and resource control.',
    'hybrid',
    'first-journey',
    'published',
    'open',
    all(mastery('vanguard', 2), mastery('aetherist', 2)),
    power(4, 5, 3, 3, 4),
  ),
  entry(
    'dawnshield',
    'Dawnshield',
    'Protective sacred warrior combining defense, restoration and purification.',
    'hybrid',
    'first-journey',
    'published',
    'open',
    all(mastery('vanguard', 3), mastery('lifebinder', 3)),
    power(5, 4, 3, 3, 4),
  ),
  entry(
    'dreadblade',
    'Dreadblade',
    'Dark offensive knight whose power comes with deliberate danger and resource cost.',
    'hybrid',
    'first-journey',
    'planned',
    'open',
    all(mastery('vanguard', 3), mastery('aetherist', 3)),
    power(3, 4, 4, 4, 4),
  ),
  entry(
    'cantor',
    'Cantor',
    'Musical battlefield support that changes team tempo through songs and sequencing.',
    'support',
    'first-journey',
    'planned',
    'open',
    all(mastery('farstrider', 2), mastery('lifebinder', 2)),
    power(4, 5, 3, 4, 4),
  ),
  entry(
    'alchemist',
    'Alchemist',
    'Reactive chemistry, concoction zones and environmental combinations.',
    'hybrid',
    'first-journey',
    'planned',
    'open',
    all(mastery('shadehand', 2), mastery('aetherist', 2)),
    power(3, 5, 4, 4, 4),
  ),
  entry(
    'warcaller',
    'Warcaller',
    'Formation and command specialist whose best turns are created with allies.',
    'support',
    'rekindling-1',
    'planned',
    'open',
    all(rekindling(1), mastery('bastion', 2), mastery('cantor', 2)),
    power(4, 5, 4, 4, 5),
  ),

  entry(
    'cinderweaver',
    'Cinderweaver',
    'Fire, Scorch and explosive area denial.',
    'mage',
    'first-journey',
    'published',
    'open',
    mastery('aetherist', 2),
    power(4, 4, 3, 3, 3),
  ),
  entry(
    'frostweaver',
    'Frostweaver',
    'Ice control, barriers, roots and movement denial.',
    'mage',
    'first-journey',
    'published',
    'open',
    mastery('aetherist', 2),
    power(5, 4, 3, 3, 3),
  ),
  entry(
    'stormsinger',
    'Stormsinger',
    'Lightning and wind magic emphasizing lanes, mobility and resource disruption.',
    'mage',
    'first-journey',
    'published',
    'open',
    all(mastery('aetherist', 2), mastery('farstrider', 1)),
    power(4, 4, 3, 4, 4),
  ),
  entry(
    'stonebinder',
    'Stonebinder',
    'Earth magic that creates and reshapes battlefield terrain.',
    'mage',
    'first-journey',
    'planned',
    'open',
    all(mastery('aetherist', 2), mastery('vanguard', 1)),
    power(4, 4, 4, 4, 4),
  ),
  entry(
    'tidecaller',
    'Tidecaller',
    'Water, mist, cleansing and fluid movement control.',
    'mage',
    'first-journey',
    'published',
    'open',
    all(mastery('aetherist', 2), mastery('lifebinder', 1)),
    power(4, 5, 3, 4, 4),
  ),
  entry(
    'chronist',
    'Chronist',
    'Time specialist that manipulates initiative, delay and future timing without resetting battles.',
    'mage',
    'rekindling-1',
    'planned',
    'open',
    all(rekindling(1), mastery('aetherist', 3)),
    power(3, 5, 4, 5, 5),
    'The Borrowed Minute',
  ),
  entry(
    'riftwalker',
    'Riftwalker',
    'Spatial specialist using teleportation, portals and unusual displacement.',
    'mage',
    'rekindling-1',
    'planned',
    'open',
    all(rekindling(1), mastery('aetherist', 3), mastery('shadehand', 1)),
    power(3, 5, 4, 5, 5),
    'No Straight Road',
  ),
  entry(
    'veilweaver',
    'Veilweaver',
    'Illusions, decoys, false terrain and information pressure.',
    'mage',
    'first-journey',
    'planned',
    'open',
    all(mastery('aetherist', 2), mastery('shadehand', 2)),
    power(3, 5, 4, 5, 5),
  ),
  entry(
    'gravebinder',
    'Gravebinder',
    'Necromancy, servants and attrition shaped around unresolved death.',
    'mage',
    'rekindling-1',
    'planned',
    'secret',
    all(
      rekindling(1),
      mastery('aetherist', 3),
      mastery('lifebinder', 2),
      flag('unlock:gravebinder', 'Resolve the hidden Gravebinder initiation'),
    ),
    power(3, 5, 4, 5, 5),
    undefined,
    flag('reveal:gravebinder', 'Discover the funerary contradiction'),
  ),
  entry(
    'eidolist',
    'Eidolist',
    'Dedicated magical summoner managing spirits, pacts and additional battlefield actors.',
    'mage',
    'rekindling-1',
    'planned',
    'open',
    all(rekindling(1), mastery('aetherist', 3), mastery('lifebinder', 3)),
    power(3, 5, 5, 5, 5),
  ),
  entry(
    'oracle',
    'Oracle',
    'Prediction, pre-emption and fate support built around acting before certainty.',
    'support',
    'rekindling-1',
    'planned',
    'secret',
    all(
      rekindling(1),
      mastery('lifebinder', 3),
      mastery('aetherist', 1),
      flag('unlock:oracle', 'Complete the hidden Oracle proof'),
    ),
    power(3, 5, 4, 5, 5),
    undefined,
    flag('reveal:oracle', 'Follow a pattern of fulfilled foretellings'),
  ),
  entry(
    'hexbinder',
    'Hexbinder',
    'Curses, debuffs and bounded Hex extension/spread.',
    'mage',
    'first-journey',
    'planned',
    'open',
    all(mastery('aetherist', 2), mastery('shadehand', 3)),
    power(4, 4, 4, 4, 4),
  ),
  entry(
    'sanguinist',
    'Sanguinist',
    'Blood magic that converts HP, healing and Bleeding into dangerous tactical resources.',
    'mage',
    'rekindling-1',
    'planned',
    'secret',
    all(
      rekindling(1),
      mastery('lifebinder', 2),
      mastery('aetherist', 3),
      flag('unlock:sanguinist', 'Complete the hidden Sanguinist initiation'),
    ),
    power(2, 5, 5, 5, 5),
    undefined,
    flag('reveal:sanguinist', 'Discover the blood-price tradition'),
  ),
  entry(
    'loreeater',
    'Loreeater',
    'Monster scholar who learns bounded supernatural Techniques from studied prey.',
    'hybrid',
    'first-journey',
    'planned',
    'secret',
    all(
      mastery('farstrider', 2),
      mastery('aetherist', 2),
      flag('unlock:loreeater', 'Complete the hidden monster-scholar initiation'),
    ),
    power(3, 5, 5, 5, 5),
    'What Have You Learned?',
    flag('reveal:loreeater', 'Be noticed for repeated monster study'),
  ),
  entry(
    'starcaller',
    'Starcaller',
    'Astral and gravitational high magic that bends mass, space and celestial phenomena.',
    'mage',
    'rekindling-2',
    'planned',
    'secret',
    all(
      rekindling(2),
      mastery('aetherist', 5),
      mastery('chronist', 3),
      mastery('riftwalker', 3),
      flag('unlock:starcaller', 'Resolve the hidden celestial contradiction'),
    ),
    power(2, 5, 5, 5, 5),
    undefined,
    flag('reveal:starcaller', 'Find incompatible skies in the Unwritten Reach'),
  ),
  entry(
    'spellwright',
    'Spellwright',
    'Apex metamagic that changes how other spells behave instead of merely casting stronger spells.',
    'mage',
    'rekindling-3',
    'planned',
    'secret',
    all(
      rekindling(3),
      mastery('aetherist', 5),
      countOf(
        3,
        mastery('cinderweaver', 5),
        mastery('frostweaver', 5),
        mastery('stormsinger', 5),
        mastery('stonebinder', 5),
        mastery('tidecaller', 5),
        mastery('chronist', 5),
        mastery('riftwalker', 5),
        mastery('veilweaver', 5),
        mastery('gravebinder', 5),
        mastery('eidolist', 5),
        mastery('oracle', 5),
        mastery('hexbinder', 5),
        mastery('sanguinist', 5),
      ),
      flag('unlock:spellwright', 'Complete the Grand Formula examination'),
    ),
    power(2, 5, 5, 5, 5),
    'The Grand Formula',
    flag('reveal:spellwright', 'Earn recognition as a master of several magical traditions'),
  ),
]

export const DISCIPLINE_ATLAS_BY_ID: Readonly<Record<string, DisciplineAtlasEntry>> =
  Object.fromEntries(DISCIPLINE_ATLAS.map((discipline) => [discipline.id, discipline]))

export function disciplineMasteryStageLabel(stage: DisciplineMasteryStage): string {
  return stageLabel[stage]
}

export function describeDisciplineUnlockRule(rule: DisciplineUnlockRule): string {
  if (rule.kind === 'always') return 'Available from the beginning'
  if (rule.kind === 'mastery') {
    const discipline = DISCIPLINE_ATLAS_BY_ID[rule.disciplineId]
    return `${discipline?.name ?? rule.disciplineId} ${stageLabel[rule.minimumStage]}`
  }
  if (rule.kind === 'rekindling') return `Rekindling ${rule.minimumCount}`
  if (rule.kind === 'flag') return rule.label
  if (rule.kind === 'all') return rule.rules.map(describeDisciplineUnlockRule).join(' + ')
  if (rule.kind === 'any') return rule.rules.map(describeDisciplineUnlockRule).join(' or ')
  return `${rule.count} of: ${rule.rules.map(describeDisciplineUnlockRule).join(', ')}`
}

function evaluateRule(rule: DisciplineUnlockRule, context: DisciplineAtlasContext): boolean {
  if (rule.kind === 'always') return true
  if (rule.kind === 'mastery')
    return (context.masteryByDiscipline[rule.disciplineId] ?? 1) >= rule.minimumStage
  if (rule.kind === 'rekindling') return context.rekindlingCount >= rule.minimumCount
  if (rule.kind === 'flag') return context.flags?.includes(rule.id) ?? false
  if (rule.kind === 'all') return rule.rules.every((candidate) => evaluateRule(candidate, context))
  if (rule.kind === 'any') return rule.rules.some((candidate) => evaluateRule(candidate, context))
  return rule.rules.filter((candidate) => evaluateRule(candidate, context)).length >= rule.count
}

function unmetRules(rule: DisciplineUnlockRule, context: DisciplineAtlasContext): string[] {
  if (evaluateRule(rule, context)) return []
  if (rule.kind === 'all') return rule.rules.flatMap((candidate) => unmetRules(candidate, context))
  if (rule.kind === 'count-of') {
    const satisfied = rule.rules.filter((candidate) => evaluateRule(candidate, context)).length
    return [
      `${rule.count - satisfied} more requirement${rule.count - satisfied === 1 ? '' : 's'} from ${rule.rules.length} eligible traditions`,
    ]
  }
  return [describeDisciplineUnlockRule(rule)]
}

export function evaluateDisciplineAtlasEntry(
  discipline: DisciplineAtlasEntry,
  context: DisciplineAtlasContext,
): DisciplineAtlasEvaluation {
  const testingAccess = context.testingAccess === true
  const revealSatisfied =
    discipline.disclosure === 'open' ||
    testingAccess ||
    context.revealedDisciplineIds?.includes(discipline.id) ||
    (discipline.reveal ? evaluateRule(discipline.reveal, context) : false)
  const releaseEligible = evaluateRule(discipline.unlock, context)
  const effectiveSelectable =
    discipline.publication === 'published' && (testingAccess || releaseEligible)

  if (!revealSatisfied) {
    return {
      state: 'veiled',
      releaseEligible,
      effectiveSelectable: false,
      revealed: false,
      unmetRequirements: discipline.reveal ? unmetRules(discipline.reveal, context) : [],
    }
  }
  if (discipline.publication === 'planned') {
    return {
      state: releaseEligible
        ? 'revealed'
        : discipline.disclosure === 'secret'
          ? 'rumored'
          : 'planned',
      releaseEligible,
      effectiveSelectable: false,
      revealed: true,
      unmetRequirements: unmetRules(discipline.unlock, context),
    }
  }
  if (testingAccess) {
    return {
      state: 'testing',
      releaseEligible,
      effectiveSelectable: true,
      revealed: true,
      unmetRequirements: releaseEligible ? [] : unmetRules(discipline.unlock, context),
    }
  }
  return {
    state: releaseEligible ? 'unlocked' : 'revealed',
    releaseEligible,
    effectiveSelectable: releaseEligible,
    revealed: true,
    unmetRequirements: unmetRules(discipline.unlock, context),
  }
}

export function rekindlingCountFromCycleNumber(cycleNumber: number): number {
  return Math.max(0, Math.min(3, Math.trunc(cycleNumber) - 1))
}
