# Quality Point items and equipment

Status: authorized implementation design, not released. The Owner's November 3 messages and later corrections are authoritative. The attached Claude outline is optional input; this design adapts it to the actual repository. The Owner instructed us to continue autonomously without another questionnaire. Items remain a separate continuation from the verified fixes checkpoint PR #1007 (`fa53b747`).

## Intent and delivery boundary

Make inexpensive and powerful equipment useful through build tradeoffs. Each character has a hard **100 equipped Quality Point** budget. Owned inventory does not spend QP. Items use the existing AbilityDefinition, target, cost, forecast, effect, cooldown, trigger, report and commit authorities. No second item effect interpreter.

Finish the current Skill corrections first: equal configured Reckless/Fortified pairs; whole-Skill authored Requirements; one bottom explanation per semantic Tag; Open Wound applies Bleed to a fresh eligible target. Historical battle captures and immutable published versions remain unchanged. The separate earlier checkpoint already covers Barrier damage events, Self damage, colors, Move elevation/LOS, upload fitting, support artwork and Vesper names/owner colors.

After implementation, publish one coordinated verified release through the existing Owner-controlled release process. No per-stage quota-consuming deployments. Provide an Owner checklist covering every requested change, including the earlier checkpoint. No shops, currency, crafting recipes, sets, trading, companion gameplay or new event mechanics in this release.

## Chosen approach

The Owner explicitly chose the existing skill engine. Extend current content publication and character/build capture with a typed runtime Item, owned stacks and equipment assignments. Reuse the existing Items route and Master Item category. A separate item combat engine would duplicate authoritative targeting/payment and is rejected. A cosmetic inventory without persistent server validation would not satisfy the request.

Calls made by the implementer: use six player-friendly category names, preserve retained draft-only Item V1, make runtime Item V2 explicit, count a two-handed unit once, select the main-hand weapon attack, and refill starter item uses per battle. The latter two choices were explicitly confirmed by the Owner's follow-up outline. Future consuming shop items are represented only if atomic ownership settlement is actually implemented; no UI may claim consumption before that path exists.

## Inventory, equipment and QP

- Categories: **Gear**, **Battle Items**, **Materials**, **General**, **Event**, **Companion**.
- Exactly 40 addressable inventory slots per category (stored indices0..39, presented1..40). One stack per slot. Gear has maximum stack 1; other identical items stack to at most 99. No silent overflow, lost grants or duplicated quantities. Event samples cannot be discarded; discard/sale is otherwise out of scope.
- Stack identity is character-owned and durable. Stable Item identity resolves the current published definition for current inventory and new battle admission; acquisition provenance is retained. Running battles pin the exact admitted version and media. A Master edit cannot rewrite a running battle.
- Six equipment positions: **Head, Body, Pants, Boots, Main Hand, Off Hand**. No accessories or neck/ring slots in this release.
- Each equipped armor, weapon, passive hand piece or battle item costs integer QP. Total must be <=100, validated by the server, including concurrent saves and battle admission. Non-equippable samples have zero QP.
- A one-hand object fits either hand. Two-handed weapons occupy main hand and block off hand, but QP counts once. Equipping a conflicting piece requires an explicit swap operation; do not silently delete or unequip unrelated pieces.
- Main hand supplies Basic Attack when it contains a weapon; otherwise an off-hand weapon supplies it; otherwise use the captured unarmed Basic Attack. With two one-handed weapons, the off-hand attack is not offered, but its authored passives remain active.
- Passive hand armor does not replace Basic Attack. Shields may be authored as passive hand armor or as a weapon with a weak bash.
- One equipped battle-item stack in a hand supplies one choice. Two hands supply two choices. A two-handed weapon leaves no hand for an item. If the same battle item is held twice, the two references/charge pools must remain unambiguous and ownership checks must reject using an unavailable stack.
- Equip/unequip/sort/support changes are forbidden during pending/active battle admission/session and use revision/CAS protection. All state survives refresh.
- If a later publication raises QP or invalidates a binding, show the exact issue and block new battle admission until repaired. Never alter an existing battle capture or silently destroy inventory.

## Runtime Item definition

Retain existing AuthoredItem V1 bytes and historical parsing. New/explicitly upgraded executable Items use schemaVersion2 and the existing identity fields (id, contentVersion, name, description, sortOrder, enabled, media).

Runtime fields:

- `inventoryCategory`: gear | battle-items | materials | general | event | companion.
- `itemClass`: armor | hand-armor | weapon | battle-item | material | general | event | companion.
- `tier`: D | C | B | A | S. This is a presentation/balance band, not an automatic power multiplier.
- `qualityPoints`: integer 1..100 for equippables; 0 for non-equippables.
- `equipment`: null or `{slot: head|body|pants|boots|hand, hands:1|2}`. Two hands only for weapons. Armor slots are exact, not arbitrary strings.
- `maximumStack`: 1 for gear, otherwise 1..99.
- `requirements`: null at the Item wrapper for this release. Combat Requirements belong to the bound ordinary ability groups. The existing combat RequirementNode does not supply persistent out-of-battle equip prerequisites; do not pretend that event/status/prime predicates are inventory eligibility. QP, ownership and slots are the equip constraints. Retained V1 drafts remain readable; an explicit V2 upgrade must resolve unsupported wrapper predicates rather than dropping them.
- `ability`: existing AbilityDefinition or null.
- `actions`: optional named bindings `attack`, `support`, `use`, each `{behaviorId, name}`. Binding points to one manual action group in the same captured Item definition. No floating unversioned Skill lookup.
- `battleUses`: null or integer1..99 for a battle-item use binding. Starter uses reset each battle; previews/rejections/retries do not spend uses, committed attempts do.
- `consumeOnUse`: false for the starter release. Supporting true requires atomic persistent-stack decrement in the same idempotent battle commit; reject executable true until implemented and tested.
- `tags`: bounded identity/filter tags; no executable free text.

Validation keeps unknown fields rejected, action bindings unique and real, all unbound manual actions rejected, passive groups compatible, media present, QP/slot/hand/category consistent. Disabled or V1 intent-only definitions cannot be newly equipped/admitted. Provide clear current-authoring errors while retained drafts/history remain readable. Extend only Item publication blockers; Ascension/Severence remain outside this release.

QP bands are guidance, not hard schema rules: D3–8, C6–14, B12–24, A20–38, S34–55. The actual cap remains100. S-tier two-handed Sunsplitter is50 QP so expensive armor requires a real tradeoff.

## Shared engine extensions and capture

- Keep the ordinary Skill usage-checkbox UI unchanged: both unchecked and no cooldown remains unlimited for ordinary Skills. The generic finite-use field is compiled explicitly from an Item use limit; shared reports show that explicit limit. Do not add an unsolicited third limit control to ordinary Skill editors in this release.
- Add a generic finite-use activation field, `AbilityBehavior.maximumUsesPerBattle?:number` (1..99 for Manual actions), backed by an optional `usageCount` on the existing private keyed usage row. No parallel item turn counter. A charged Item compiles its use limit into its captured use behavior. Existing Once per action/round and cooldowns still restrict it; the most restrictive bound wins.
- Add a generic ongoing Self `stat-bonus` effect for the actual missing passive-stat primitive. Initial supported stats: Movement, Jump, Physical/Mystic Power, Physical/Mystic Defense, Evasion and Initiative. Flat numeric units are explicit. Use shared getters/turn budget refresh; do not permanently mutate character base stats or double-apply after reload. Every ability family can use the primitive. Movement+1/+2 is a true Movement allowance bonus; AP and terrain costs remain enforced.
- Movement bonuses are captured at each own-turn start, including the initial turn after ability startup, as an explicit optional `movementBonusAtTurnStart` on the current turn. Keep original baseMovementBudget intact; validate maximum=base+capturedbonus and spent/remaining accounting. Conditional midturn changes affect the next own turn. Initiative uses effective base-plus-bonus before existing Drenched scaling and preserves already-acted/current-turn ordering.
- Elemental amplification applies to direct damage packets. Bleed/Burn/Poison keep their own captured magnitude/formula and are not multiplied again. Passive prose must say direct Fire damage when that is the implemented scope.
- A battle-item definition has exactly one Manual use behavior and one use binding, so the ordinary behavior-keyed finite-use ledger is unambiguous. No parallel manual groups or automatic/modifier siblings can bypass its use cap.
- If needed, extend the existing ongoing damage-bonus with an optional element filter so an Emberbrand passive boosts Fire packets rather than every packet in a mixed action. Use existing automatic modifier primitives where they already express the exact mechanic. Do not add item-name special cases.
- Reuse existing temporary status effects for AP-cost boosts, recovery, mitigation, weakening, damage, cleanse and Barrier. Do not invent speculative Speed/Attack stats when the real engine uses different fields.
- Extend committed build equipment references and the existing `sourceKind:'equipment'` captures. Item snapshots include equipment origin, exact definition/version/media, weapon/support/use bindings and use limits. Keep source instances private.
- Capture gear only after server proof of ownership, legal slots, QP<=100, current definitions and compatible Requirements. Admission locks/revisions must prevent equip racing battle creation across PvE, PvP, shared map entry and Master preview.
- Startup applies passives through the shared source pipeline. Weapon action is admitted as Basic Attack semantics where engine rules inspect that classification (Frozen Ground exemption, guards, etc.). Active item use remains a normal canonical action intent and quote/commit path.
- The one Support Action selection is a discriminated Basic-or-equipment reference. Granted support competes with HP/MP Recovery, Invocation, Pilfer and Fleetstep. Unequipping its source reverts to the prior valid Basic support (or HP Recovery) with an explicit notice, not a second support slot.
- Server admission must authorize each Manual equipment binding, not just hide it in the cockpit. A forged direct Item ID/behavior request cannot invoke an off-hand weapon attack or an unselected granted Support action. Keep full captures for passives/history, but resolve commands only through the frozen admitted role bindings.
- Action references distinguish item identity, hand and bound role (for example `item.<item-id>.main.use` versus `.off.use`) without leaking owned-stack UUIDs. Private source-instance metadata retains ownership provenance. Identical items in two hands never resolve by display name or an ambiguous shared action ID.
- Opponents/spectators never receive owned inventory or private charge ledgers. Visible committed Item events carry safe captured name/art context for Chronicle and clipboard after an Item has been consumed, disabled or changed.

## Persistence and publication

Use additive migrations and the existing current/pinned content readers and normal atomic Master Commit/version history. Do not rewrite historical publication JSON or broaden service-role-only access.

Create character-owned inventory/assignment state with a single revision and durable grant provenance. Category/slot uniqueness, quantity1..99, QP/slot/hand/ownership validation and outside-battle locks live in atomic service-only functions. Authenticated clients do not write raw inventory JSON. Read services verify account and character ownership; table RLS blocks cross-player reads/writes.

The source starter set must have an idempotent grant identity. Grant once for existing and new characters without resetting existing quantities or equipment. Repeated loads and concurrent first loads cannot duplicate items. Once a runtime Item has been published/distributed, its inventory category and gear/non-gear stack shape are stable identity. Reject publications that would relocate existing stacks or lower maximumStack below any owned quantity; require a new Item identity for a category change. Other gear slot changes may invalidate an assignment visibly and block new admission until unequipped; never lose its owned stack. Publication and acquisition must share catalogue/item locks so validation cannot race.

Current source defaults/publications must be available to the SQL validator from the same authoritative catalogue, not a second manually divergent QP table. Resolve ordinary current Item publications and pin exact Item versions for battle capture.

Sort commands persist category slot order atomically (name, tier, QP, quantity, newest, class). Reject invalid permutations/foreign stacks; do not move items across categories. Search/filter is presentation-only. Future acquisition can use the same bounded stack grant operation; reject full categories cleanly.

## Player and Master UI

Use the existing `/game/loadout/items` Arsenal Items tab; no second inventory destination. Equipment and inventory panels share the current dark/parchment style, with internal scrolling. QP meter shows used/100 and slot contributions. An over-budget attempted swap states the shortage and useful swap candidates; the server still decides.

Inventory: six category tabs,40-slot grid, stack thumbnails/counts, search, sort, slot/class/equippable filters. Detail: large art, tier, QP, slot/hands, remaining/maximum battle uses, flavor, shared mechanics report, comparison and explicit Equip/Unequip. Mobile stacks the panels and uses the existing accessible dialog/bottom-sheet pattern. Test390 and412 widths, especially the reference Samsung-sized viewport.

Master Item editor reuses shared Identity/Media/Requirements/Ability editors, with sanitized Class/Tier/QP/slot/hands/stack/use controls and bound attack/support/use selectors. A real Item preview uses the same player reader. Add duplicate and bounded test-character grant only through existing staff capability/identity/audit patterns; do not invent direct unauthenticated grant endpoints. Refresh preserves draft work and Commit publishes normal immutable versions.

Cockpit order is **Inspect → Move → Basic Attack → Item → Support Action → Skills → Essence/Resonance → supernatural placeholder → End Turn**. Visible Item is singular. Keep existing internal action-key bindings stable; order changes must not remap saved hotkeys.

The Item button is enabled only for an equipped, presently usable hand item. Explain disabled causes (no hand item, AP, Requirements, cooldown or uses). Clicking Item opens one/two choices **inside the battle preview pane**, each with a small actual image, name, AP cost, uses left and `i`. Choosing one enters normal targeting/forecast/confirm, including deliberate Self use. Clicking `i` does not fire the item. Keyboard/touch/Escape/focus behavior uses existing shared ownership. Weapon Basic Attack displays its own name/image/report.

## Starter content and art

Target the supplied broad starter coverage:11 armor,2 hand passives,8 weapons,11 battle items,15 noncombat samples. Names may be refined. All47 items require finished images. Use dark fantasy/anime item silhouettes, no people, text, baked tier frame or unrelated skill portraits. Store source/provenance and optimized per-item WebP thumbnails/previews; actual image paths must resolve in inventory, equipment, popups and battle choices. No placeholder may be presented as final art.

Armor includes inexpensive and costly alternatives for head/body/pants/boots. Trailbound Boots grant+1 Movement; Galewalker Boots grant+2 at higher QP. Map other ideas to supported Defense/Power/Evasion/Initiative or conditional damage modifiers; do not create fake HP/Speed text without actual mechanics.

Weapon identities: plain shortsword, low-cost dagger, weak Guard bash buckler, two reduced-power cuts, defensive tower shield, elemental staff, Fire amplifier blade,50-QP two-handed heavy blade. All stay below comparable Discipline attack output per AP; prefer roughly60–70% in comparable baseline scenarios. Build twists are actual engine effects, not prose. Optional weapon supports are embedded named bindings and consume the existing support slot.

Battle items cover HP/MP recovery, cleanse, offensive and defensive temporary boosts, movement help, modest thrown damage, vulnerability, chilling, mitigation and Barrier. AP values must use Aurevane's100-AP economy, not the outline's illustrative1–3 AP. Seed some stack quantities12/40/99 to exercise visible counts. Per-battle use caps and QP keep refillable supplies bounded.

Materials, General, Event and Companion samples are explicitly flavor/future-purpose examples; no fake crafting or companion actions. Inventory category sorting and thumbnails still work.

## Required verification and Owner checklist

Before release: failing-first domain/engine/UI regressions; migrated disposable DB tests for ownership/QP/stack/capacity/locks/CAS/grant idempotence; same-authority battle quotes/commits/reload/history; actual Master Commit/current reads; full quality/build gates; exact-head CI; independent review; native desktop/mobile PvE/PvP/spectator flows.

Test 100QP legal/101blocked, two-hand conflicts/QP counted once, two one-hand attack selection, source support fallback, zero/positive remaining uses and reset, stale/retried actions, same-item stack99/100overflow, fullcategory40/41, current publication changing QP/media, no inventory leakage, pending/active battle locks, movement boots without AP bypass, weapon versus unarmed/family guards, duplicate grants/sort/permutation ownership, readonly old V1 and historical battles.

Owner checklist must enumerate every requested old fix and new feature, with expected observable results and what requires a fresh battle. Record actual production source/migration/content publication and known limitations. Automated test passes do not mark human gameplay acceptance complete.

## Builder check resolved

A fresh independent builder identified two material gaps. They are resolved above: published/distributed inventory shape is stable (incompatible category/stack changes reject rather than moving/loss), and Item wrapper Requirements are null until a real persistent prerequisite model exists. Battle action Requirements remain fully supported. Both decisions are implementer calls within the Owner's requested scope; no extra feature or character progression cap is introduced.
