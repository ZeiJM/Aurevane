import type { CombatEndureProfile } from '@aurevane/game-core/combat/actions'

/** Captured public parameters only; the accumulated damage remains private. */
export function endureDescription(profile: CombatEndureProfile): string {
  const target =
    profile.targetTeams === 'enemies' ? 'enemy' : profile.targetTeams === 'allies' ? 'ally' : 'unit'
  return `Cannot attack. When Endure expires, each ${target} within ${profile.radiusTiles} ${profile.radiusTiles === 1 ? 'tile' : 'tiles'} takes ${profile.releaseBasisPoints / 100}% of the HP damage you received. Cannot be dispelled; defeat cancels the burst.`
}

/** Generic tag help describes the rule; individual Skill readers supply its saved values. */
const descriptions: Readonly<Record<string, string>> = {
  reversal:
    'Arms immediately after paid Controlled preparation. Prevents the first qualifying hostile front/side direct hit in its saved family, then returns the chosen percentage of prevented HP damage. Remains armed until triggered or cancelled; Reveal, defeat or battle end also disarm it. Offensive attacks are blocked while armed. Ending causes Reversal Strain.',
  'weak-point':
    'Guarantees a critical hit when the enemy has more active debuffs than the chosen threshold. The attack must still hit. Pierce cannot critically hit.',
  spike: 'Doubles the damage of this Skill’s critical hits. Pierce cannot critically hit.',
  ruin: 'In current battles, the first landed hit gains the chosen percentage per consumable debuff captured on its target, then consumes those debuffs. Later hits cannot reuse that bonus. Debuffs applied afterward remain. Historical battles keep their recorded Ruin rules.',
  'stat-bonus':
    'Adds the authored flat amount to the chosen combat stat while this passive source is active. Its conditions still apply.',
  loot: 'An inert Pilfer marker. It currently grants no items, currency or rewards.',
  damage: 'Deals damage using the Skill’s power and Physical or Mystic damage type.',
  pierce:
    'Breaks Barriers and ignores the chosen share of equipment Armor. Physical and Mystic Defense still apply. Pierce cannot critically hit.',
  counter:
    'Returns the chosen percentage of incoming damage to its source, counting HP loss and damage absorbed by Barrier. Choose Physical Reflect, Magical Reflect or Full Reflect, its potency and duration.',
  endure:
    'Locks attacks while storing HP damage received. On expiry, releases the chosen percentage to nearby targets. Cannot be dispelled; defeat cancels the burst.',
  vengeance: 'Deals damage based on damage previously received, within its saved limits.',
  'hp-recovery': 'Restores a percentage of the target’s maximum HP.',
  'mp-recovery':
    'Restores MP using the saved percentage or fixed amount and number of applications.',
  'mp-restore': 'Restores a fixed amount of MP.',
  'mp-drain': 'Removes a percentage of the target’s maximum MP.',
  barrier: 'Absorbs incoming damage before HP is lost, until depleted or expired.',
  burn: 'Deals damage at turn end based on the attack’s actual HP damage. Tick damage follows its saved decay. A burning unit also takes backlash when it damages enemies.',
  bleed:
    'Deals damage at turn end based on the attack’s actual HP damage. Each application has its own potency and duration.',
  poison:
    'Deals damage at turn end based on the attack’s actual HP damage. Moving the chosen number of tiles, including Push and Pull, refreshes its duration.',
  'copy-buffs': 'Copies the selected eligible buffs. The source keeps them.',
  'copy-debuffs': 'Copies the selected eligible debuffs onto the target. The source keeps them.',
  cleanse: 'Removes all removable debuffs from the target.',
  dispel: 'Removes the selected buffs from the target.',
  'conditional-cleanse': 'Removes only the selected debuffs from the target.',
  'cleanse-chilled': 'Removes Chilled.',
  reveal:
    'Can target Invisible and Covert units, and armed Reversal independently qualifies. A successful hit removes both concealments, disarms Reversal with Reversal Strain, and applies Revealed: incoming attacks have 100% accuracy and deal increased damage for the chosen duration.',
  rewind:
    'Records each target’s position for a later return. The return must be legal and does not restore HP, MP or AP.',
  'freeze-ground':
    'Retained Freeze Ground is replaced by Chilled Ground in current drafts. Active Chilled tiles apply the ordinary facing restriction on contact without increasing Skill AP costs. Historical battles keep their captured terrain rules.',
  push: 'Moves the target away from the caster by the chosen number of tiles. Rooted units and blocked tiles stop the move.',
  pull: 'Moves the target toward the caster by the chosen number of tiles, stopping before the caster. Rooted units and blocked tiles stop the move.',
  move: 'Moves the caster to a reachable, unoccupied Ground tile within the chosen distance and Jump limits.',
  summon:
    'Creates a temporary ally with its own core stats and Skills. Set its lifetime and damage ceiling relative to the summoner’s Basic Attack.',
  'status:guarded': 'Reduces incoming damage for the chosen duration.',
  'status:exposed': 'Increases damage taken for the chosen duration.',
  'status:lowered-guard':
    'Increases damage taken for the chosen duration. Set the percentage of normal damage the target receives.',
  'status:covert': 'Conceals the target’s buffs from enemies until revealed.',
  'status:revealed':
    'Incoming attacks have 100% accuracy and deal increased damage for the chosen duration.',
  'status:wet': 'Reduces Initiative and increases Storm damage taken. Set each value separately.',
  'status:frozen': 'Prevents the target from choosing its final facing.',
  'status:conductive':
    'Increases the next Storm hit’s damage. Storm consumes the existing charge before applying a new one.',
  'status:inspired': 'Increases outgoing damage for the chosen duration.',
  'status:blindside':
    'Increases Skill damage from the side and rear by separately chosen amounts, until the affected unit’s turn ends.',
  'status:blindside-vulnerability':
    'Increases Skill damage taken from the side and rear. Front hits and Basic Attack are unchanged.',
  'status:suppress':
    'Reduces outgoing direct damage. Reapplication keeps the strongest potency and longest remaining duration. Existing damage-over-time ticks are unchanged.',
  'status:hexed': 'Reduces HP and MP recovery received.',
  'status:invisible':
    'Prevents selection by ordinary hostile unit attacks. Ground effects and Reveal can still hit. Attacking or taking damage ends Invisible.',
  'status:airborne':
    'Ignores Ground effects, temporarily raises Jump and lets Attack Skills reach elevated targets.',
  'status:haste':
    'Movement costs less AP per entered tile and can reach 0 AP. Movement allowance is unchanged.',
  'status:slow':
    'Increases movement AP cost per tile by the chosen amount. Movement allowance is unchanged.',
  'status:blind':
    'Reduces the affected character’s Accuracy by the authored number of percentage points, to a minimum of 0%. Automatic Hit remains automatic.',
  'status:root': 'Prevents movement. Attacks, Skills and facing remain available.',
  'status:reckless': 'Increases damage dealt and damage taken for the same duration.',
  'status:fortified':
    'Increases Physical and Mystic Defense while reducing outgoing damage by the same percentage.',
  'status:challenged': 'Reduces damage dealt to anyone except the unit that applied Taunt.',
  'status:mark':
    'Increases the source’s Accuracy against the target. Other attackers gain no bonus.',
  'status:warded': 'Reduces damage from attackers affected by Burn.',
}
export function effectTagDescription(id: string): string | undefined {
  return descriptions[id]
}
