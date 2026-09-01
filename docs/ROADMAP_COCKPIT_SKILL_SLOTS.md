# AUREVANE Cockpit Skill Slot Roadmap

## Purpose

The battle cockpit exposes four swappable combat skill slots alongside the two system commands, Inspect and Finish Turn. This document records the contract that later content, discipline, loadout, and editor work must preserve.

This cockpit work is compatible early-delivered infrastructure for Phase 3. It must be reused and reconciled with the canonical build system rather than rebuilt or allowed to redefine the approved pure/mixed Skill capacities.

## Operational categories

Every battle-usable cockpit skill has exactly one operational category:

- `movement`
- `attack`
- `defense`
- `heal`

The category controls which cockpit slot can present and activate the skill. It does **not** describe where the skill came from and it does **not** define the character's Discipline Skill capacity. Discipline, equipment, quest, class, ancestry, or other unlock/source metadata remains orthogonal to the operational category.

The initial skills are:

| Slot | Initial skill | Stable action/skill identity |
| --- | --- | --- |
| Movement | Move | `basic.move` |
| Attack | Basic Attack | `basic.attack.unarmed.basic` |
| Defense | Guard | `basic.guard` |
| Heal | HP Recovery | `basic.recover` |
| Heal alternate | MP Recovery | `basic.recover.mp` |

HP Recovery and MP Recovery currently cost 50 AP and restore 10% of the relevant maximum resource through the authoritative combat engine.

## Phase-3 capacity boundary

The four cockpit categories are a **presentation and action-selection surface**, not a replacement for the canonical Phase-3 build contract.

Phase 3 remains authoritative:

```text
PURE BUILD
Primary only
up to 8 equipped Discipline Skills
+ eligible Essence Skill outside that cap

MIXED BUILD
Primary + mastered Secondary
up to 6 equipped Discipline Skills across both Disciplines
+ resolved Resonance passive
```

Therefore:

- P3.4 must persist and validate the full committed 8-pure / 6-mixed Discipline Skill loadout independently of the four cockpit categories;
- the battle snapshot carries the complete committed Skill set, not only four currently visible category selections;
- a cockpit category selector may expose only Skills that are legal for the committed battle snapshot and belong to that operational category;
- changing the currently presented Skill inside a category is **not** a respec and cannot add an unlocked-but-unequipped Discipline Skill to the battle snapshot;
- category selection never bypasses Skill cooldown, AP, targeting, requirement, source, or other authoritative legality;
- the four universal baseline actions remain available according to combat authority and do not consume the 6/8 Discipline Skill capacity;
- future Essence, Equipment, Soulmark, Mantle, or other granted Skills keep their own source/cap rules even when presented through one of these operational categories.

If the eventual battle UX needs a different way to expose a large committed Skill set, change the presentation deliberately without changing the canonical build capacity merely to fit the current four-card cockpit.

## Cockpit interaction contract

Each category always renders one currently selected skill/action. The card body activates that selection through the existing preview/target/confirm flow. The artwork control is a separate interaction target: it opens the selector and must never execute the skill as a side effect.

The selector lists only skills/actions the committed combatant snapshot may currently present in that category. Choosing a selector item changes the currently presented action, clears incompatible planning when necessary, and does not itself commit a combat action or mutate the persistent character build.

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
- AI legality/valuation metadata without coupling AI decisions to which cockpit card happens to be visible

Do not hardcode affordability in cockpit presentation helpers. The equipped skill's rendered/authoritative cost must drive disabled state and execution legality.

## Persistence and loadouts

The current cockpit may keep the **currently presented category selection** locally for the active battle.

When persistent Phase-3 loadouts are introduced:

- persist the full authoritative pure/mixed Discipline Skill loadout according to P3.4;
- validate that full loadout server-side against Discipline source, mastery/unlock state, capacity, and other legality;
- snapshot that complete committed build when a battle starts;
- optionally persist a preferred/default presented Skill ID per operational category as presentation convenience only;
- validate any preferred category selection against the committed Skill set plus legal universal baseline actions;
- missing or invalid preferred selections may fall back deterministically to a legal baseline or committed Skill for that category;
- saved loadouts and category preferences never bypass attunement cooldowns or alter an already-committed battle snapshot.

## AI contract

Combat AI must reason from the same authoritative committed build snapshot as a human combatant. The four cockpit cards are a human presentation layer and must not become the AI action inventory.

As Phase 3 introduces data-driven Skills, AI candidate generation should enumerate currently legal actions/Skills from the committed snapshot, then apply decision-quality/valuation logic and deterministic tie-breaking. Cooldowns, targeting, requirements, Resonance/Essence effects, and other legality remain shared combat authority rather than AI exceptions.

## Presentation and media

Skill artwork is content data, not behavior. Dark-fantasy anime starter art can ship as defaults, but later content tools must be able to replace an icon without changing code or skill identity. Damage-oriented presentation uses red, healing uses green, and defensive/guard presentation uses blue in accordance with the battle UI color language.

## Regression gates

Before expanding the skill catalog, preserve tests for:

1. selector click versus action-card click separation;
2. category filtering and selected-skill switching;
3. slot hotkeys surviving visible-name changes;
4. HP Recovery and MP Recovery cost/effect authority;
5. stale preview clearing when an active slot changes skill;
6. PvE/PvP cockpit parity;
7. mobile and desktop layout/accessibility behavior;
8. skill-specific keyboard helpers not leaking onto unrelated skills in the same category;
9. category selection never exposes an unlocked-but-uncommitted Discipline Skill;
10. full 8-pure / 6-mixed committed Skill capacity remains independent from the four-card cockpit presentation;
11. AI legal action enumeration comes from the authoritative snapshot rather than currently visible cockpit selections.
