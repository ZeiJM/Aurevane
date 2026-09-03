# AUREVANE Cockpit Skill Slot Roadmap

## Purpose

The battle cockpit exposes four **battle-facing operational selectors** alongside the two system commands, Inspect and Finish Turn. This document records the contract that later content, Discipline, loadout, and editor work must preserve.

The cockpit is an action-selection surface. It is **not** the canonical persistent build-capacity model.

Canonical Phase-3 Skill capacity remains:

```text
Pure build:  up to 8 Primary Discipline Skills + 1 Essence Skill outside the cap
Mixed build: 6 total Discipline Skills across Primary + Secondary + Resonance passive
```

The complete committed build snapshot is the source of truth. The four cockpit categories expose legal battle actions from that snapshot; they do not reduce a character's build to four total Skills.

## Operational categories

Every battle-usable cockpit-selectable action has exactly one operational category:

- `movement`
- `attack`
- `defense`
- `heal`

The category controls which cockpit selector can expose the action. It does **not** describe where the action came from. Discipline, equipment, quest, superclass, Essence, or other unlock/source metadata remains orthogonal to the operational category.

The initial battle-platform actions are:

| Slot | Initial action | Stable action/skill identity |
| --- | --- | --- |
| Movement | Move | `basic.move` |
| Attack | Basic Attack | `basic.attack.unarmed.basic` |
| Defense | Guard | `basic.guard` |
| Heal | HP Recovery | `basic.recover` |
| Heal alternate | MP Recovery | `basic.recover.mp` |

HP Recovery and MP Recovery currently cost 50 AP and restore 10% of the relevant maximum resource through the authoritative combat engine.

These current baseline battle-platform actions are not evidence that a future character has only four Discipline Skill slots. Movement, Basic Attack and Guard remain basic combat commands under the canonical Phase-3 rules; Recover/Heal should be reconciled to the mature Skill/cooldown design when P3.3 is implemented rather than assumed from this early cockpit proof.

## Cockpit interaction contract

Each category renders one currently selected battle action. The card body activates that action through the existing preview/target/confirm flow. The artwork control is a separate interaction target: it opens the selector and must never execute the action as a side effect.

The selector lists only actions the combatant can legally access in that category from the authoritative battle/build snapshot plus any canonical universal baseline actions. Choosing a selector item changes which action is surfaced in that cockpit category, clears incompatible planning when necessary, and does not commit an action.

Desktop cards show the slot hotkey, action name, and AP cost on the left with artwork on the right. Mobile cards omit the hotkey but preserve the same name/cost/art hierarchy. Move displays its normal per-tile baseline as `25 AP`; Finish Turn retains `Choose facing + end`.

## Hotkey contract

Account keybind storage keeps the existing stable control IDs for backward compatibility:

- `move` = Movement cockpit category
- `basicAttack` = Attack cockpit category
- `guard` = Defense cockpit category
- `recover` = Heal cockpit category

A keybind belongs to the cockpit category, not to the visible action name. Changing HP Recovery to MP Recovery therefore does not change the player's Heal keybind. Hotkey dispatch must route through the real cockpit control so previews, legality, confirmation, Action Economy, and server authority remain unchanged.

Skill-specific secondary keyboard behavior must remain action-specific. For example, Move may use WASD path planning and Basic Attack may use adjacent target cycling, but a future Movement or Attack Skill must not inherit those behaviors merely because it occupies the same category. Add explicit per-skill interaction metadata when another Skill requires different keyboard/targeting semantics.

## Phase-3 integration contract

Phase 3 must **reuse** the cockpit architecture already delivered rather than replacing it, while moving legality and persistence to the mature build system.

The integration model is:

1. Profile owns the persistent legal build.
2. Server commits the legal build snapshot.
3. Battle initialization captures an immutable/versioned snapshot for that battle.
4. The cockpit derives legal category actions from that snapshot plus canonical basic actions.
5. Category selectors change which eligible action is surfaced for immediate battle use; they do not rewrite the persistent build or bypass cooldown/legality.
6. AI enumerates all legal actions from the authoritative snapshot and combat state, not merely the four actions currently visible in the human cockpit.
7. PvE and PvP consume the same snapshot/legality rules.

The four cockpit categories therefore remain a **presentation/action-selection layer**, while P3.4 remains the canonical 8-pure/6-mixed persistent Discipline Skill-capacity authority.

## Content/editor requirements for Phase 3+

The mature content model and content panels should expose, at minimum:

- stable Skill/action ID and display name;
- operational category;
- source metadata independent from category;
- artwork/media asset reference with fallback;
- Action Economy/AP cost source;
- targeting/preview metadata;
- authoritative effect/action definition reference;
- mastery/unlock requirements;
- cooldown definition/state hooks;
- statuses or other availability requirements;
- AI legality/valuation metadata;
- PvE/PvP override hooks where explicitly approved;
- content version and authoring/validation metadata.

Do not hardcode affordability in cockpit presentation helpers. The authoritative action/Skill cost and legality must drive disabled state and execution.

## Persistence and loadouts

Do **not** persist "one Skill per cockpit category" as the complete character build.

When Phase-3 persistent loadouts arrive:

- persist the full legal build state defined by the canonical Phase-3 capacity rules;
- validate all selected Skills server-side against Primary/Secondary, mastery, source, content version and other legality;
- capture that full committed state into the battle snapshot;
- derive cockpit selector options from that snapshot;
- keep any battle-local category selection ephemeral unless a later explicit UX design adds a safe convenience preference;
- deterministic fallback may select a canonical basic action for an empty/invalid cockpit surface, but fallback must never silently mutate the persistent build.

Saved loadouts must never bypass attunement cooldowns, mastery, item ownership, Skill capacity or other authoritative build constraints.

## Presentation and media

Skill artwork is content data, not behavior. Dark-fantasy anime starter art can ship as defaults, but later content tools must be able to replace an icon without changing code or Skill identity. Damage-oriented presentation uses red, healing uses green, and defensive/guard presentation uses blue in accordance with the battle UI color language.

## Early-delivered Phase-3 credit

The following compatible foundations already exist from Phase 2 and should receive reuse credit during Phase 3:

- four stable operational cockpit categories;
- same-slot action swapping demonstrated by HP/MP Recovery;
- selector-versus-execute interaction separation;
- slot-owned stable hotkeys independent of visible action name;
- artwork/media hooks;
- shared PvE/PvP cockpit presentation foundations;
- battle-side legality/preview/confirm routing through existing authoritative combat paths.

This does **not** mark P3.3 or P3.4 complete. Mature Skill definitions, generic cooldowns, persistent build capacity, Primary/Secondary source legality, Resonance/Essence and full build snapshots remain Phase-3 work.

## Regression gates

Before expanding the Skill catalog, preserve tests for:

1. selector click versus action-card click separation;
2. category filtering and surfaced-action switching;
3. slot hotkeys surviving visible-name changes;
4. HP Recovery and MP Recovery cost/effect authority;
5. stale preview clearing when an active category changes action;
6. PvE/PvP cockpit parity;
7. mobile and desktop layout/accessibility behavior;
8. Skill-specific keyboard helpers not leaking onto unrelated actions in the same category;
9. full build snapshot remaining authoritative even when only four cockpit actions are visible;
10. AI legal-action enumeration not being limited to the human cockpit's visible four cards.
