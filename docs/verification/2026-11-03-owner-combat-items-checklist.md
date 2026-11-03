# Owner testing checklist: combat corrections and Items

**Status: Items implementation and local automated verification complete on the feature branch; not live. Independent review, exact-head required CI and coordinated release remain open.** Fill the release receipt/source/migration/publication links here after the coordinated release. Leave human acceptance boxes unchecked until tested. Start fresh battles for newly captured gameplay policies; older saved battles deliberately retain their original mechanics.

Release URL: pending. Source/release receipt: pending controller integration. Database migration/publication receipt: pending.

Review [all 47 genuine starter Items: categories, quantities, QP, effects, AP and uses](2026-11-03-starter-items-reference.md) before gameplay checks. Automated checks do not fill human acceptance boxes.

## Combat and targeting

- [ ] Hit a Barrier with positive damage and confirm the appropriate damage-taken/dealt automatic ability activates even if HP loss is0.
- [ ] Break through part of a Barrier and confirm each damage packet triggers once, rather than once for Barrier and again for HP.
- [ ] Verify HP bars and damage totals still report actual HP loss; absorbed damage is reported as absorbed.
- [ ] Add Damage, change Enemy→Self, save/reload, and confirm Self remains selectable.
- [ ] Execute a Self-damage action: the caster takes damage/Barrier absorption through the normal engine.
- [ ] Try Anyone on the caster and All with the caster included. Verify exactly the intended recipients are affected.
- [ ] Confirm “all except actor” Ground damage still excludes the caster.
- [ ] Test a lethal self-inclusive area in a controlled setup: all packet recipients settle before the result/next turn, with a draw when both teams are defeated.
- [ ] Compare caster/enemy/allied damaging tiles: the same bright red appears, without a blue/green blend on the caster.
- [ ] Check ordinary ally recovery/utility and specialized target tags still show legal targets and execute their offered choices.
- [ ] Repeat key cases in PvE and PvP, with mouse and touch.

## Usage limits and Move

- [ ] Set Once per action and no cooldown. Use it once: its action becomes unavailable for the rest of that battle, including after advancing rounds.
- [ ] Set Once per round and no Once per action: use once this round, then verify it becomes available on its next legal turn in the next global round.
- [ ] Untick both, remove cooldown and retain sufficient resources: make several fresh uses, including a zero-AP test where valid.
- [ ] Check Controlled preparation/cancellation/release obey those same current limits and costs; historical captures remain literal.
- [ ] Open a Move-only Skill such as Fleetstep: Range & Area contains Move elevation and Move line-of-sight controls.
- [ ] Enter an elevation and verify a legal higher tile is highlighted and reachable; values beyond the authored setting stay blocked.
- [ ] Leave elevation blank and verify Character Jump is used.
- [ ] Enable line of sight, test an opaque obstruction, then disable it: highlighting and actual movement agree in each case.
- [ ] Save/reload the Move settings and verify mixed Move+follow-up actions still aim and pay correctly.
- [ ] Check the same shared controls in the applicable Essence/Resonance/Basic editors; no separate inconsistent editor behavior.

## Skill Requirements, effects and Chronicle

- [ ] Inspect Stalwart Strike: Fortified is in the main Requirements; no hidden requirement remains only on the second Damage packet.
- [ ] Try it without its whole prerequisite: the action is rejected before payment. Meet the prerequisite and verify every programmed Damage packet resolves.
- [ ] Inspect a repeated Damage Tag: Effects still shows each packet; the bottom list has one Damage Tag explanation, retaining meaningful custom notes.
- [ ] Check the same grouping in Skill, Essence, Resonance and historical readers; different Tags sharing a display name remain distinct.
- [ ] Use Open Wound on a fresh, eligible enemy with no Bleed. On a landed damaging hit, Bleed applies and later ticks for its programmed duration.
- [ ] Reload a battle with Bleed pending/active and verify the scheduled ticks are preserved without duplicate applications.
- [ ] Check Reckless's displayed gain/drawback match and actual current damage follows them; implicit current default is40%/40%.
- [ ] Check current Fortified shows and applies the same Defense increase/outgoing reduction; implicit current default is15%/15%.
- [ ] Verify explicit custom magnitudes and custom Master Status definitions were preserved; old battle history did not change values.
- [ ] Check all audited combo Skills show their actual prerequisite at the top; do not expect a valid combo to activate before its stated prerequisite.
- [ ] Summon Vesper, use Moon Bolt, and inspect Chronicle/clipboard: the exact captured skill name appears without synthetic “Summon Vesper” wording.
- [ ] Compare several differently colored owners and summons, including identical visible names: each summon ring and arrow matches its owner, in PvE/PvP/spectator views.

## Images and existing editors

- [ ] Upload a valid image whose square PNG would exceed2MiB: finalization automatically fits it and Commit Now becomes usable after upload completes.
- [ ] Save/reload and verify the correct image and crop appear; do not need to manually recrop solely to avoid the finalized-PNG size error.
- [ ] Change Invocation's artwork and compare Master editor, Skill Manager, Arsenal and battle cockpit after their appropriate refresh/new capture: all current readers use the saved image.
- [ ] Check the replacement Pilfer image has a clear non-suggestive hand/purse composition.
- [ ] Check replacement Invocation is a generic summoning circle with no person or creature, suitable for future summons.
- [ ] Confirm the release deliberately selected new default art over any current custom override through a new versioned Commit; older captured custom art remains historical.

## Item inventory and equipment

- [ ] Open Arsenal→Items. The six categories are Gear, Battle Items, Materials, General, Event and Companion.
- [ ] Each category has40 inventory positions with internal scrolling, clear empty slots, search and useful sorting/filtering.
- [ ] Verify starter items are granted once, survive refresh/relogin, and repeated first loads do not duplicate them.
- [ ] For a first load with a full category or a pending/active battle, confirm the inventory remains readable, explains the deferred grant, and grants once when eligible.
- [ ] Archive/disable a default before first load: only current enabled available defaults are granted. Later unarchive does not top up a completed receipt.
- [ ] Archive/disable an already-owned Item: refresh still works, Unavailable includes it, Equippable excludes it, and All Items retains its row.
- [ ] Armor reports its armor position without a hand count; hand Items report their true hand requirement.
- [ ] Verify sample stacks12/40/99 show correctly. Identical stackable items never exceed99 in one slot; Gear remains one unit per slot.
- [ ] A full category rejects an extra unmergeable grant clearly and loses no existing items.
- [ ] Sort inventory, reload, and verify the order persists without changing quantities or categories.
- [ ] Inspect actual images for every starter/sample item, including dummy Materials/General/Event/Companion entries; none is a missing/placeholder asset.
- [ ] Noncombat samples explain their future purpose without offering nonexistent crafting/companion functions.
- [ ] Equipment has Head, Body, Pants, Boots, Main Hand and Off Hand; select each to inspect/change its legal piece.
- [ ] The QP meter sums all equipped armor and hand objects and never exceeds100.
- [ ] Equip exactly100QP successfully; attempt101 or more and check the stated shortage/swap suggestions and server rejection.
- [ ] Try a slot-incompatible or unowned item: no assignment or QP change is saved.
- [ ] Equip a one-handed piece in either hand. Explicit swaps replace only the selected conflicting piece(s).
- [ ] Equip a two-handed weapon: off hand is occupied/blocked, and that weapon's QP is counted once.
- [ ] Compare a50QP weapon build with expensive armor: the tradeoff is real rather than a cosmetic meter.
- [ ] Equip +1Movement and then +2Movement boots with a higher QP cost. New-turn Movement allowance changes correctly; AP, terrain and Jump still constrain routes.
- [ ] Refresh/reload/re-equip and ensure passive bonuses do not accumulate repeatedly.
- [ ] Enter a pending/active battle and verify equipment/sort mutations cannot race or alter its admitted loadout.

## Weapons, Support and battle items

- [ ] With no weapon, Basic Attack remains the normal captured unarmed attack.
- [ ] Equip a weapon and confirm Basic Attack uses its actual name, image, `i` report, cost, targets and effects.
- [ ] Equip two one-handed weapons: main hand supplies the attack; off-hand passives work. If only off hand has a weapon, it supplies the attack.
- [ ] Try the distinct weapon designs: actual double hit, modest dagger, defensive bash, elemental amplification and heavy two-handed strike—not prose-only twists.
- [ ] Compare attacks with a comparable Discipline Skill: weapons complement it and do not replace it as a universally stronger choice.
- [ ] Equip an item granting a Support Action. Select it in the existing Support area; it competes with HP/MP Recovery, Invocation, Pilfer and Fleetstep in one slot.
- [ ] Unequip its source and verify a valid previous/default Basic support is restored with a clear notice.
- [ ] Cockpit order is Inspect→Move→Basic Attack→Item→Support Action, followed by the remaining slots; Item is singular.
- [ ] Existing custom keyboard bindings still activate the same actions after the order change.
- [ ] With no held battle item, Item is unavailable. Merely owning a stack does not ready it.
- [ ] Ready one hand item: clicking Item shows one choice inside the battle preview pane with thumbnail, name, AP cost, uses left and `i`.
- [ ] Ready two hand items: two distinct choices appear; same-item hands remain unambiguous and require enough owned units.
- [ ] Clicking `i` shows the real shared mechanics without using the item. Selecting it uses normal targeting/forecast/confirm, including deliberate Self use.
- [ ] Try recovery, temporary offensive/defensive boosts, movement help, damage, weakening, cleanse and Barrier items; actual effects and AP payment match their reports.
- [ ] Spend the per-battle uses: the option becomes unavailable at its cap with a clear reason. Previews, canceled targeting, rejected/stale commands and retries do not spend additional uses.
- [ ] Start a new battle: starter supplies refill their use allowance and their owned stack quantity is unchanged.
- [ ] Equip a two-handed weapon and verify there is no hand left for a battle item/eligible Item button.
- [ ] Verify mixed-element damage only receives the matching element's passive bonus; periodic damage is not boosted twice.

## Master Item authoring and shared delivery

- [ ] Create/edit armor, passive hand armor, one/two-handed weapons, battle items and noncombat samples in the existing Master Item area.
- [ ] Check tier/QP/slot/hands/stack/use validation and required artwork; safe retained V1 drafts still open without silently becoming runtime items.
- [ ] Use the same sanitized Requirements/Effects/Range & Area editors and `i` readers; no hidden per-effect gating or duplicate Tag teaching list.
- [ ] Bind a real weapon attack, granted support or item use behavior; invalid/missing/duplicate bindings cannot publish.
- [ ] Save a draft, refresh, then Commit Now; current public readers use the committed image and mechanics while historical versions stay intact.
- [ ] Try incompatible category/stack-shape changes to an owned Item: publication rejects safely rather than moving/deleting stacks.
- [ ] Change QP or a legal action binding: existing inventory remains; invalid current equipment is explained and cannot enter a new battle until repaired.
- [ ] If duplicate/test-character grant is supplied, verify it obeys staff permissions and creates the expected audited, bounded result.
- [ ] Test the complete flow on desktop and at390/412px: panels/dialogs/preview choices remain readable and usable with touch/Escape/outside-click.
- [ ] Confirm the same applicable battle behavior in PvE and PvP, and that spectators/opponents cannot inspect another character's private inventory or charge ledger.
- [ ] Confirm the final release receipt names the exact source, applied migrations and deliberate current-content publications; no unverified task is silently marked done.
