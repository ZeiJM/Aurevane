# AUREVANE Cockpit Skill Slot Roadmap

## Purpose

The battle cockpit exposes four swappable combat skill slots alongside the two system commands, Inspect and Finish Turn. This document records the contract that later content, discipline, loadout, and editor work must preserve.

## Operational categories

Every battle-usable cockpit skill has exactly one operational category:

- `movement`
- `attack`
- `defense`
- `heal`

The category controls which cockpit slot can equip the skill. It does **not** describe where the skill came from. Discipline, equipment, quest, class, ancestry, or other unlock/source metadata remains orthogonal to the operational category.

The initial skills are:

| Slot | Initial skill | Stable action/skill identity |
| --- | --- | --- |
| Movement | Move | `basic.move` |
| Attack | Basic Attack | `basic.attack.unarmed.basic` |
| Defense | Guard | `basic.guard` |
| Heal | HP Recovery | `basic.recover` |
| Heal alternate | MP Recovery | `basic.recover.mp` |

HP Recovery and MP Recovery currently cost 50 AP and restore 10% of the relevant maximum resource through the authoritative combat engine.

## Cockpit interaction contract

Each category always renders one equipped skill. The card body activates that equipped skill through the existing preview/target/confirm flow. The artwork control is a separate interaction target: it opens the selector and must never execute the skill as a side effect.

The selector lists only skills the combatant can currently equip in that category. Choosing a selector item changes the equipped skill for the slot, clears incompatible planning when necessary, and does not commit an action.

Desktop cards show the slot hotkey, skill name, and AP cost on the left with artwork on the right. Mobile cards omit the hotkey but preserve the same name/cost/art hierarchy. Move displays its normal per-tile baseline as `25 AP`; Finish Turn retains `Choose facing + end`.

## Hotkey contract

Account keybind storage keeps the existing stable control IDs for backward compatibility:

- `move` = Movement Skill slot
- `basicAttack` = Attack Skill slot
- `guard` = Defense Skill slot
- `recover` = Heal Skill slot

A keybind belongs to the cockpit slot, not to the visible skill name. Changing HP Recovery to MP Recovery therefore does not change the player's Heal keybind. Hotkey dispatch must click the real slot control so previews, legality, confirmation, Action Economy, and server authority remain unchanged.

Skill-specific secondary keyboard behavior must remain skill-specific. For example, Move may use WASD path planning and Basic Attack may use adjacent target cycling, but a future Movement or Attack skill must not inherit those behaviors merely because it occupies the same category slot. Add explicit per-skill interaction metadata when a second skill requires different keyboard/targeting semantics.

## Content/editor requirements for Phase 3+

The content model and content panels should expose, at minimum:

- stable skill ID and display name
- operational category
- artwork/media asset reference with fallback
- Action Economy/AP cost source
- targeting/preview metadata
- authoritative effect/action definition reference
- unlock/source metadata (discipline, equipment, quest, etc.) independently from category
- availability requirements, cooldowns, statuses, or other gating as those systems arrive

Do not hardcode affordability in cockpit presentation helpers. The equipped skill's rendered/authoritative cost must drive disabled state and execution legality.

## Persistence and loadouts

The current cockpit may keep selection locally for the active battle. When persistent loadouts are introduced, store one equipped skill ID per operational category and validate the selection server-side against the combatant's unlocked/available skills. Missing or invalid selections should fall back deterministically to that category's baseline skill.

## Presentation and media

Skill artwork is content data, not behavior. Dark-fantasy anime starter art can ship as defaults, but later content tools must be able to replace an icon without changing code or skill identity. Damage-oriented presentation uses red, healing uses green, and defensive/guard presentation uses blue in accordance with the battle UI color language.

## Regression gates

Before expanding the skill catalog, preserve tests for:

1. selector click versus action-card click separation;
2. category filtering and equipped-skill switching;
3. slot hotkeys surviving visible-name changes;
4. HP Recovery and MP Recovery cost/effect authority;
5. stale preview clearing when an active slot changes skill;
6. PvE/PvP cockpit parity;
7. mobile and desktop layout/accessibility behavior;
8. skill-specific keyboard helpers not leaking onto unrelated skills in the same category.
