import type { CombatEffectDefinition } from './actions'
import type { ResonanceDefinition } from './resonance'

interface SequenceIdentity {
  discipline: string
  setupTag: string
  setupName: string
  prefix: string
  suffix: string
  payoff: CombatEffectDefinition
  result: string
}
const identities: readonly SequenceIdentity[] = [
  {
    discipline: 'bastion',
    setupTag: 'defense',
    setupName: 'defensive Skill',
    prefix: 'Tempered',
    suffix: 'Bulwark',
    payoff: { type: 'apply-status', recipient: 'actor', statusId: 'guarded', stacks: 1 },
    result: 'grant the attacker Guarded',
  },
  {
    discipline: 'ravager',
    setupTag: 'bleed',
    setupName: 'bleeding attack',
    prefix: 'Crimson',
    suffix: 'Fury',
    payoff: { type: 'healing', recipient: 'actor', amount: 4 },
    result: 'restore up to 4 HP to the attacker',
  },
  {
    discipline: 'edgedancer',
    setupTag: 'expose',
    setupName: 'exposure Skill',
    prefix: 'Poised',
    suffix: 'Edge',
    payoff: { type: 'apply-status', recipient: 'primary-unit', statusId: 'slow', stacks: 1 },
    result: 'Slow the selected enemy',
  },
  {
    discipline: 'wildwarden',
    setupTag: 'mark',
    setupName: 'mark',
    prefix: 'Quarry',
    suffix: 'Hunt',
    payoff: { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 4 },
    result: 'restore up to 4 MP to the attacker',
  },
  {
    discipline: 'runeblade',
    setupTag: 'drain',
    setupName: 'MP-draining attack',
    prefix: 'Runic',
    suffix: 'Sigil',
    payoff: { type: 'apply-status', recipient: 'primary-unit', statusId: 'exposed', stacks: 1 },
    result: 'Expose the selected enemy',
  },
  {
    discipline: 'dawnshield',
    setupTag: 'heal',
    setupName: 'healing Skill',
    prefix: 'Dawnlit',
    suffix: 'Aegis',
    payoff: { type: 'remove-status', recipient: 'actor', statusIds: ['burn', 'bleed', 'poison'] },
    result: 'cleanse Burn, Bleed and Poison from the attacker',
  },
  {
    discipline: 'cinderweaver',
    setupTag: 'burn',
    setupName: 'Burn Skill',
    prefix: 'Ember',
    suffix: 'Flare',
    payoff: { type: 'damage', recipient: 'primary-unit', amount: 4 },
    result: 'deal 4 additional base damage to the selected enemy',
  },
  {
    discipline: 'frostweaver',
    setupTag: 'control',
    setupName: 'movement-control Skill',
    prefix: 'Frozen',
    suffix: 'Crystal',
    payoff: { type: 'damage', recipient: 'primary-unit', amount: 4 },
    result: 'deal 4 additional base damage to the selected enemy',
  },
  {
    discipline: 'stormsinger',
    setupTag: 'drain',
    setupName: 'MP-draining attack',
    prefix: 'Charged',
    suffix: 'Thunder',
    payoff: { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 4 },
    result: 'restore up to 4 MP to the attacker',
  },
  {
    discipline: 'tidecaller',
    setupTag: 'heal',
    setupName: 'healing Skill',
    prefix: 'Renewing',
    suffix: 'Tide',
    payoff: { type: 'apply-status', recipient: 'actor', statusId: 'regeneration', stacks: 1 },
    result: 'grant the attacker Regeneration',
  },
  {
    discipline: 'chronist',
    setupTag: 'tempo',
    setupName: 'tempo Skill',
    prefix: 'Measured',
    suffix: 'Hour',
    payoff: { type: 'apply-status', recipient: 'actor', statusId: 'hastened', stacks: 1 },
    result: 'grant the attacker Hastened for the next round',
  },
]
const foundations = [
  { discipline: 'vanguard', suffix: 'Vanguard' },
  { discipline: 'lifebinder', suffix: 'Bloom' },
  { discipline: 'aetherist', suffix: 'Arc' },
  { discipline: 'farstrider', suffix: 'Volley' },
  { discipline: 'shadehand', suffix: 'Ambush' },
  { discipline: 'ironfist', suffix: 'Impact' },
]
function title(id: string): string {
  return id[0]!.toUpperCase() + id.slice(1)
}

/** Each new tradition contributes one explicit setup/conversion family. Pair order is
 * immaterial; the sequence always crosses the two equipped libraries. No blanket % bonuses. */
export const ADVANCED_RESONANCES: readonly ResonanceDefinition[] = identities.flatMap(
  (identity, index) =>
    [...foundations, ...identities.slice(0, index)].map((other) => {
      const pair = [identity.discipline, other.discipline].sort() as [string, string]
      const id = `resonance.${pair.join('-')}.linked-sequence`
      return {
        id,
        contentVersion: 1,
        enabled: true,
        disciplinePair: pair,
        name: `${identity.prefix} ${other.suffix}`,
        description: `${title(identity.discipline)} ${identity.setupName} sets up the next ${title(other.discipline)} attack to ${identity.result}. The setup is consumed by the payoff.`,
        trigger: {
          kind: 'skill-sequence' as const,
          setup: { sourceDisciplineId: identity.discipline, requiredTags: [identity.setupTag] },
          payoff: { sourceDisciplineId: other.discipline, requiredTags: ['attack'] },
          payoffEffects: [identity.payoff],
          aiSetupUtilityBonus: 10,
          aiPayoffUtilityBonus: 22,
        },
        media: { iconKey: `${id}.icon`, audioCueKey: `${id}.audio`, vfxKey: `${id}.vfx` },
        authoring: {
          schemaVersion: 1 as const,
          status: 'representative' as const,
          validationTags: ['p4', 'cross-library-sequence', 'no-percentage-bonus'],
        },
      }
    }),
)
