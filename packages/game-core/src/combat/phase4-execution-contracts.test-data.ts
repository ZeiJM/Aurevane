import type { CombatActionIssueCode } from './actions'

export type ContractCombatant = 'actor' | 'enemy' | 'other' | 'ally'
type ResourceDeltas = Partial<Record<ContractCombatant, readonly [number, number]>>
type StatusChanges = Partial<Record<ContractCombatant, readonly string[]>>

export interface PublishedSkillContract {
  id: string
  contentVersion?: number
  /** PvE AP, MP, and an optional different PvP AP cost. */
  cost: readonly [number, number, number?]
  /** Actual recipient deltas on the first and consecutive use, before resource caps. */
  hp?: ResourceDeltas
  mp?: ResourceDeltas
  applied?: StatusChanges
  removed?: StatusChanges
  repeatRemoved?: StatusChanges
  repeatBlocked?: CombatActionIssueCode
  positions?: Partial<Record<ContractCombatant, { x: number; y: number }>>
  frozenTiles?: readonly { x: number; y: number }[]
}

// Independent, hand-checked outcomes for the published roster on the fixture's flat board.
// These values do not call the effect resolver or copy its projections. A recipient-routing,
// omitted-effect, cost, repeat-scaling or execution-order regression must change an outcome.
const cleanse = ['burn', 'bleed', 'poison', 'slow', 'root', 'exposed', 'marked', 'challenged']
const enemy = (first: number, repeat: number): ResourceDeltas => ({ enemy: [first, repeat] })
const enemies = (first: number, repeat: number): ResourceDeltas => ({
  enemy: [first, repeat],
  other: [first, repeat],
})
const actor = (first: number, repeat: number): ResourceDeltas => ({ actor: [first, repeat] })
const allies = (first: number, repeat: number): ResourceDeltas => ({
  actor: [first, repeat],
  ally: [first, repeat],
})

export const PUBLISHED_SKILL_CONTRACTS: readonly PublishedSkillContract[] = [
  { id: 'vanguard.forceful-strike', cost: [40, 0, 45], hp: enemy(-12, -6) },
  { id: 'vanguard.cleave', cost: [50, 0], hp: enemies(-8, -4) },
  { id: 'vanguard.guard-break', cost: [55, 0], hp: enemy(-15, -7) },
  {
    id: 'vanguard.brace',
    cost: [30, 0],
    applied: { actor: ['guarded'] },
    repeatBlocked: 'requirement-not-met',
  },
  { id: 'vanguard.rally', cost: [45, 0], hp: actor(8, 4), mp: actor(4, 2) },
  { id: 'vanguard.shield-bash', cost: [45, 0], hp: enemy(-9, -4), applied: { actor: ['guarded'] } },
  { id: 'vanguard.second-wind', cost: [40, 0], hp: actor(12, 6) },
  { id: 'vanguard.sweeping-strike', cost: [45, 0], hp: enemies(-7, -3) },

  { id: 'lifebinder.mending-light', cost: [45, 0], hp: actor(16, 8) },
  { id: 'lifebinder.mend', cost: [35, 0], hp: { ally: [12, 6] } },
  { id: 'lifebinder.barrier', cost: [40, 0], applied: { ally: ['guarded'] } },
  { id: 'lifebinder.renew', cost: [50, 0], hp: { ally: [10, 5] }, mp: { ally: [4, 2] } },
  { id: 'lifebinder.sanctuary', cost: [65, 0], hp: allies(8, 4) },
  {
    id: 'lifebinder.fortifying-light',
    cost: [55, 0],
    hp: { ally: [6, 3] },
    applied: { ally: ['guarded'] },
  },
  { id: 'lifebinder.vital-sever', cost: [40, 0], hp: enemy(-10, -5) },
  { id: 'lifebinder.searing-bloom', cost: [55, 0], hp: enemies(-7, -3) },

  { id: 'aetherist.arc-bolt', cost: [35, 0], hp: enemy(-9, -4) },
  { id: 'aetherist.mana-burst', cost: [50, 0], hp: enemies(-7, -3) },
  {
    id: 'aetherist.ward-pierce',
    cost: [45, 0],
    hp: enemy(-8, -4),
    applied: { enemy: ['exposed'] },
  },
  {
    id: 'aetherist.arcane-field',
    cost: [55, 0],
    hp: enemies(-6, -3),
    applied: { enemy: ['exposed'], other: ['exposed'] },
  },
  { id: 'aetherist.channel', cost: [25, 0], mp: actor(8, 4) },
  { id: 'aetherist.mana-shield', cost: [35, 0], applied: { actor: ['guarded'] } },
  { id: 'aetherist.chain-spark', cost: [50, 0], hp: enemies(-8, -4) },
  { id: 'aetherist.overchannel', cost: [65, 0], hp: enemy(-16, -8) },

  { id: 'farstrider.aimed-shot', cost: [40, 0], hp: enemy(-13, -6) },
  {
    id: 'farstrider.pinning-shot',
    cost: [40, 0],
    hp: enemy(-7, -3),
    applied: { enemy: ['exposed'] },
  },
  { id: 'farstrider.volley', cost: [55, 0], hp: enemies(-7, -3) },
  { id: 'farstrider.scouts-mark', cost: [30, 0], applied: { enemy: ['exposed'] } },
  { id: 'farstrider.longshot', cost: [55, 0], hp: enemy(-17, -8) },
  { id: 'farstrider.piercing-barrage', cost: [55, 0], hp: enemies(-9, -4) },
  { id: 'farstrider.fieldcraft', cost: [30, 0], hp: actor(6, 3), mp: actor(4, 2) },
  { id: 'farstrider.keen-focus', cost: [35, 0], applied: { actor: ['guarded'] } },

  { id: 'shadehand.backstab', cost: [40, 0], hp: enemy(-10, -5) },
  { id: 'shadehand.feint', cost: [35, 0], hp: enemy(-5, -2), applied: { enemy: ['exposed'] } },
  { id: 'shadehand.smoke-vial', cost: [35, 0], applied: { actor: ['guarded', 'invisible'] } },
  {
    id: 'shadehand.crippling-cut',
    cost: [45, 0],
    hp: enemy(-8, -4),
    applied: { enemy: ['exposed'] },
  },
  { id: 'shadehand.exploit-opening', cost: [45, 0], hp: enemy(-16, -8) },
  { id: 'shadehand.fan-of-knives', cost: [50, 0], hp: enemies(-7, -3) },
  { id: 'shadehand.quick-hands', cost: [25, 0], mp: actor(6, 3) },
  { id: 'shadehand.execution-cut', cost: [60, 0], hp: enemy(-16, -8) },

  { id: 'ironfist.rising-fist', cost: [35, 0], hp: enemy(-7, -3), applied: { enemy: ['exposed'] } },
  { id: 'ironfist.sweep', cost: [45, 0], hp: enemies(-7, -3) },
  { id: 'ironfist.focus-breath', cost: [35, 0], hp: actor(7, 3), mp: actor(5, 2) },
  { id: 'ironfist.counter-palm', cost: [35, 0], hp: enemy(-14, -7) },
  { id: 'ironfist.breakfall', cost: [25, 0], applied: { actor: ['guarded', 'airborne'] } },
  { id: 'ironfist.hammer-knuckle', cost: [45, 0], hp: enemy(-19, -9) },
  {
    id: 'ironfist.pressure-palm',
    cost: [45, 0],
    hp: enemy(-7, 0),
    applied: { actor: ['guarded'], enemy: ['displaced'] },
    positions: { enemy: { x: 3, y: 1 } },
    repeatBlocked: 'target-out-of-range',
  },
  { id: 'ironfist.last-stand', cost: [40, 0], hp: actor(12, 6), applied: { actor: ['guarded'] } },

  { id: 'chronist.temporal-bolt', cost: [35, 2], hp: enemy(-10, -5) },
  { id: 'chronist.haste', cost: [30, 2], applied: { ally: ['hastened'] } },
  { id: 'chronist.slow', cost: [35, 2], hp: enemy(-4, -2), applied: { enemy: ['slow'] } },
  { id: 'chronist.delay', cost: [35, 2], applied: { enemy: ['delayed'] } },
  { id: 'chronist.rewind-step', cost: [40, 2], positions: { actor: { x: 1, y: 1 } } },
  { id: 'chronist.time-lock', cost: [50, 3], applied: { enemy: ['root', 'delayed'] } },
  { id: 'chronist.temporal-ward', cost: [40, 2], applied: { actor: ['guarded', 'hastened'] } },
  { id: 'chronist.stolen-moment', cost: [45, 3], hp: enemy(-17, -8), mp: actor(3, 1) },

  { id: 'bastion.shield-bash', cost: [35, 0], hp: enemy(-6, -3), applied: { enemy: ['slow'] } },
  { id: 'bastion.cover', cost: [30, 0], applied: { ally: ['guarded'] } },
  { id: 'bastion.challenge', cost: [25, 0], applied: { enemy: ['challenged'] } },
  { id: 'bastion.fortress', cost: [30, 0], applied: { actor: ['fortified'] } },
  { id: 'bastion.hold-fast', cost: [40, 0], hp: actor(10, 5), applied: { actor: ['guarded'] } },
  { id: 'bastion.shield-line', cost: [45, 0], hp: enemies(-7, -3) },
  { id: 'bastion.stalwart-strike', cost: [40, 0], hp: enemy(-14, -7) },
  {
    id: 'bastion.steady-footing',
    cost: [30, 0],
    removed: { actor: ['slow', 'root'] },
    applied: { actor: ['guarded'] },
  },

  { id: 'ravager.frenzy', cost: [30, 0], applied: { actor: ['reckless'] } },
  { id: 'ravager.gash', cost: [35, 0], hp: enemy(-6, -3), applied: { enemy: ['bleed'] } },
  { id: 'ravager.cleaving-blow', cost: [45, 0], hp: enemies(-8, -4) },
  { id: 'ravager.blood-rush', cost: [35, 0], hp: actor(12, 6) },
  { id: 'ravager.war-roar', cost: [35, 0], applied: { enemy: ['exposed'], other: ['exposed'] } },
  { id: 'ravager.desperate-execution', cost: [45, 0], hp: enemy(-20, -10) },
  { id: 'ravager.blood-siphon', cost: [45, 0], hp: { enemy: [-7, -3], actor: [5, 2] } },
  { id: 'ravager.open-wound', cost: [40, 0], hp: enemy(-15, -7) },

  { id: 'edgedancer.lunge', cost: [40, 0], hp: enemy(-11, -5) },
  { id: 'edgedancer.riposte', cost: [35, 0], hp: enemy(-14, -7) },
  { id: 'edgedancer.hamstring', cost: [35, 0], hp: enemy(-5, -2), applied: { enemy: ['slow'] } },
  { id: 'edgedancer.flourish', cost: [35, 0], hp: enemy(-6, -3), applied: { enemy: ['exposed'] } },
  { id: 'edgedancer.poised-guard', cost: [25, 0], applied: { actor: ['guarded'] } },
  { id: 'edgedancer.flanking-cut', cost: [45, 0], hp: enemy(-9, -4) },
  {
    id: 'edgedancer.severing-cut',
    cost: [40, 0],
    hp: enemy(-7, -3),
    applied: { enemy: ['bleed'] },
  },
  { id: 'edgedancer.finishing-thrust', cost: [45, 0], hp: enemy(-20, -10) },

  { id: 'wildwarden.snare', cost: [40, 0], applied: { enemy: ['root'] } },
  { id: 'wildwarden.hunters-mark', cost: [25, 0], applied: { enemy: ['marked'] } },
  { id: 'wildwarden.venom-shot', cost: [40, 0], hp: enemy(-5, -2), applied: { enemy: ['poison'] } },
  { id: 'wildwarden.field-remedy', cost: [35, 0], hp: actor(5, 2), removed: { actor: cleanse } },
  {
    id: 'wildwarden.thorn-line',
    cost: [45, 0],
    hp: enemies(-6, -3),
    applied: { enemy: ['slow'], other: ['slow'] },
  },
  { id: 'wildwarden.pursuit-shot', cost: [40, 0], hp: enemy(-14, -7) },
  {
    id: 'wildwarden.renewing-herbs',
    cost: [30, 0],
    applied: { ally: ['regeneration', 'summoned'] },
  },
  { id: 'wildwarden.close-quarry', cost: [35, 0], hp: enemy(-10, -5), mp: actor(3, 1) },

  { id: 'runeblade.arc-edge', cost: [40, 2], hp: enemies(-10, -5) },
  { id: 'runeblade.rune-guard', cost: [30, 0], mp: actor(3, 1), applied: { actor: ['guarded'] } },
  {
    id: 'runeblade.siphon-slash',
    cost: [40, 0],
    hp: enemy(-6, -3),
    mp: { enemy: [-4, -2], actor: [4, 2] },
  },
  {
    id: 'runeblade.sigil-brand',
    cost: [35, 0],
    hp: enemy(-5, -2),
    applied: { enemy: ['exposed', 'hexed'] },
  },
  { id: 'runeblade.rune-burst', cost: [45, 3], hp: enemy(-18, -9) },
  { id: 'runeblade.unbinding-rune', cost: [35, 0], removed: { actor: cleanse } },
  {
    id: 'runeblade.aether-cut',
    cost: [35, 2],
    hp: enemy(-10, -6),
    removed: { enemy: ['summoned'] },
  },
  { id: 'runeblade.rune-mending', cost: [40, 0], hp: actor(10, 5) },

  {
    id: 'dawnshield.radiant-strike',
    cost: [35, 2],
    hp: enemy(-9, -4),
    applied: { actor: ['guarded'] },
  },
  {
    id: 'dawnshield.sacred-guard',
    cost: [35, 0],
    hp: { ally: [4, 2] },
    applied: { ally: ['guarded', 'inspired'] },
  },
  { id: 'dawnshield.purge', cost: [30, 0], removed: { ally: cleanse } },
  { id: 'dawnshield.consecrated-light', cost: [45, 0], hp: allies(8, 4) },
  { id: 'dawnshield.aegis', cost: [45, 0], applied: { actor: ['guarded'], ally: ['guarded'] } },
  {
    id: 'dawnshield.renewal',
    cost: [35, 0],
    applied: { actor: ['regeneration'] },
    removed: { actor: cleanse },
  },
  { id: 'dawnshield.judgment', cost: [45, 3], hp: enemy(-16, -8) },
  { id: 'dawnshield.last-light', cost: [40, 0], hp: actor(16, 8) },

  {
    id: 'cinderweaver.cinder-bolt',
    cost: [35, 2],
    hp: enemy(-6, -3),
    applied: { enemy: ['burn'] },
  },
  { id: 'cinderweaver.flame-burst', cost: [45, 3], hp: enemies(-8, -4) },
  {
    id: 'cinderweaver.ember-line',
    cost: [45, 3],
    hp: enemies(-5, -2),
    applied: { enemy: ['burn'], other: ['burn'] },
  },
  { id: 'cinderweaver.scorch', cost: [40, 2], hp: enemy(-16, -8) },
  { id: 'cinderweaver.ash-ward', cost: [30, 0], applied: { actor: ['warded'] } },
  {
    id: 'cinderweaver.flashfire',
    cost: [35, 2],
    hp: enemy(-11, -5),
    applied: { enemy: ['exposed'] },
  },
  { id: 'cinderweaver.banked-embers', cost: [35, 0], hp: actor(4, 2), mp: actor(8, 4) },
  { id: 'cinderweaver.blistering-heat', cost: [40, 0], applied: { enemy: ['burn', 'slow'] } },

  {
    id: 'frostweaver.ice-lance',
    cost: [35, 2],
    hp: enemy(-7, -3),
    applied: { enemy: ['slow', 'frozen'] },
  },
  { id: 'frostweaver.frost-guard', cost: [30, 0], applied: { actor: ['guarded'] } },
  {
    id: 'frostweaver.chilling-mist',
    cost: [45, 0],
    applied: { enemy: ['slow', 'frozen'], other: ['slow', 'frozen'] },
    frozenTiles: [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
    ],
  },
  { id: 'frostweaver.crystal-prison', cost: [45, 0], applied: { enemy: ['root'] } },
  { id: 'frostweaver.shatter', cost: [40, 2], hp: enemy(-16, -8) },
  { id: 'frostweaver.ice-line', cost: [45, 3], hp: enemies(-9, -4) },
  {
    id: 'frostweaver.thaw',
    cost: [30, 0],
    hp: { ally: [4, 2] },
    removed: { ally: ['root', 'slow', 'burn'] },
  },
  {
    id: 'frostweaver.brittle-ice',
    cost: [35, 2],
    hp: enemy(-5, -2),
    applied: { enemy: ['exposed'] },
  },

  { id: 'stormsinger.arc-spark', cost: [35, 2], hp: enemy(-10, -5) },
  { id: 'stormsinger.lightning-line', cost: [45, 3], hp: enemies(-9, -4) },
  {
    id: 'stormsinger.static-burst',
    cost: [45, 3],
    hp: enemies(-4, -2),
    applied: { enemy: ['slow', 'conductive'], other: ['slow', 'conductive'] },
    repeatRemoved: { enemy: ['conductive'], other: ['conductive'] },
  },
  {
    id: 'stormsinger.thunderclap',
    cost: [40, 2],
    hp: enemy(-8, -4),
    applied: { enemy: ['exposed'] },
  },
  {
    id: 'stormsinger.grounding',
    cost: [30, 0],
    mp: actor(3, 1),
    removed: { actor: ['slow', 'root', 'marked'] },
  },
  {
    id: 'stormsinger.static-drain',
    cost: [40, 2],
    hp: enemy(-4, -2),
    mp: { enemy: [-6, -3] },
    applied: { enemy: ['conductive'] },
    repeatRemoved: { enemy: ['conductive'] },
  },
  {
    id: 'stormsinger.conductive-bolt',
    cost: [45, 3],
    hp: enemy(-19, 0),
    removed: { enemy: ['conductive'] },
    repeatBlocked: 'requirement-not-met',
  },
  { id: 'stormsinger.storm-breath', cost: [35, 0], mp: actor(10, 5) },

  { id: 'tidecaller.water-lance', cost: [35, 2], hp: enemy(-10, -5), applied: { enemy: ['wet'] } },
  { id: 'tidecaller.mist-veil', cost: [30, 0], applied: { ally: ['guarded'] } },
  { id: 'tidecaller.undertow', cost: [40, 2], hp: enemy(-5, -2), applied: { enemy: ['slow'] } },
  {
    id: 'tidecaller.cleansing-rain',
    cost: [50, 0],
    hp: allies(3, 1),
    removed: { actor: cleanse, ally: cleanse },
  },
  {
    id: 'tidecaller.flood-line',
    cost: [45, 3],
    hp: enemies(-7, -3),
    applied: { enemy: ['slow', 'wet'], other: ['slow', 'wet'] },
  },
  { id: 'tidecaller.springwater', cost: [35, 0], applied: { ally: ['regeneration'] } },
  { id: 'tidecaller.still-water', cost: [35, 0], hp: actor(6, 3), mp: actor(5, 2) },
  { id: 'tidecaller.crushing-wave', cost: [45, 3], hp: enemy(-15, -7) },

  { id: 'essence.vanguard.unbroken-strike', cost: [55, 0, 60], hp: enemy(-20, -10) },
  { id: 'essence.lifebinder.verdant-rupture', cost: [55, 0, 60], hp: enemy(-18, -9) },
  { id: 'essence.aetherist.aether-nova', cost: [60, 0, 65], hp: enemies(-14, -7) },
  { id: 'essence.farstrider.deadeye-barrage', cost: [60, 0, 65], hp: enemies(-15, -7) },
  { id: 'essence.shadehand.perfect-opening', cost: [60, 0, 65], hp: enemy(-16, -8) },
  { id: 'essence.ironfist.hundredfold-rush', cost: [60, 0, 65], hp: enemy(-21, -9) },
  {
    id: 'essence.chronist.borrowed-hour',
    cost: [60, 4, 65],
    hp: { ally: [10, 5] },
    applied: { ally: ['borrowed-hour'] },
  },
  {
    id: 'essence.bastion.last-bastion',
    cost: [60, 0, 65],
    hp: actor(16, 8),
    applied: { actor: ['fortified'] },
  },
  {
    id: 'essence.ravager.red-tempest',
    cost: [65, 0, 70],
    hp: enemies(-13, -6),
    applied: { enemy: ['bleed'], other: ['bleed'] },
  },
  { id: 'essence.edgedancer.sevenfold-cut', cost: [65, 0, 70], hp: enemy(-21, -7) },
  {
    id: 'essence.wildwarden.apex-hunt',
    cost: [60, 0, 65],
    hp: enemy(-16, -8),
    applied: { enemy: ['root'] },
  },
  {
    id: 'essence.runeblade.runic-overdrive',
    cost: [60, 4, 65],
    hp: enemies(-16, -8),
    mp: actor(6, 3),
  },
  {
    id: 'essence.dawnshield.dawns-oath',
    cost: [60, 0, 65],
    hp: { ally: [16, 8] },
    removed: { ally: cleanse },
    applied: { ally: ['guarded'] },
  },
  {
    id: 'essence.cinderweaver.phoenix-wake',
    cost: [65, 4, 70],
    hp: enemies(-10, -5),
    applied: { enemy: ['burn'], other: ['burn'] },
  },
  {
    id: 'essence.frostweaver.absolute-winter',
    cost: [65, 4, 70],
    hp: enemies(-7, -3),
    applied: { enemy: ['root'], other: ['root'] },
  },
  { id: 'essence.stormsinger.skybreak', cost: [65, 4, 70], hp: enemies(-18, -9) },
  {
    id: 'essence.tidecaller.tidal-crown',
    cost: [65, 0, 70],
    hp: allies(10, 5),
    removed: { actor: cleanse, ally: cleanse },
    applied: { actor: ['regeneration'], ally: ['regeneration'] },
  },
]

// Every still-enabled v1 replaced by the gameplay-tag publication keeps its old behavior.
// Unchanged quantitative expectations are shared; changed effects are stated explicitly.
const historicalOverrides: Record<string, Partial<PublishedSkillContract>> = {
  'shadehand.smoke-vial': { applied: { actor: ['guarded'] } },
  'ironfist.breakfall': { applied: { actor: ['guarded'] } },
  'ironfist.pressure-palm': {
    hp: enemy(-7, -3),
    applied: { actor: ['guarded'] },
    positions: undefined,
    repeatBlocked: undefined,
  },
  'tidecaller.water-lance': { applied: undefined },
  'tidecaller.flood-line': { applied: { enemy: ['slow'], other: ['slow'] } },
  'stormsinger.arc-spark': {},
  'stormsinger.static-burst': {
    applied: { enemy: ['slow'], other: ['slow'] },
    repeatRemoved: undefined,
  },
  'stormsinger.static-drain': { applied: undefined, repeatRemoved: undefined },
  'stormsinger.conductive-bolt': {
    hp: enemy(-16, -8),
    removed: undefined,
    repeatBlocked: undefined,
  },
  'cinderweaver.cinder-bolt': {},
  'cinderweaver.flame-burst': {},
  'cinderweaver.ember-line': {},
  'frostweaver.ice-lance': { applied: { enemy: ['slow'] } },
  'frostweaver.chilling-mist': {
    applied: { enemy: ['slow'], other: ['slow'] },
    frozenTiles: undefined,
  },
  'frostweaver.shatter': {},
  'wildwarden.renewing-herbs': { applied: { ally: ['regeneration'] } },
  'runeblade.sigil-brand': { applied: { enemy: ['exposed'] } },
  'runeblade.aether-cut': { hp: enemy(-12, -6), removed: undefined },
  'dawnshield.sacred-guard': { applied: { ally: ['guarded'] } },
  'ravager.open-wound': {},
}

export const HISTORICAL_SKILL_CONTRACTS: readonly PublishedSkillContract[] =
  PUBLISHED_SKILL_CONTRACTS.filter((contract) => contract.id in historicalOverrides).map(
    (contract) => ({
      ...contract,
      ...historicalOverrides[contract.id],
      contentVersion: 1,
    }),
  )
