# Owner checklist: Items and shared reports followup

This checklist targets the November 4 source followup. It is **not a claim that these changes are live**. Use it after the verified application, migration and changed current Item publications are released together. The [November 3 checklist](2026-11-03-owner-combat-items-checklist.md) covers the earlier combat/media/Items release and remains useful for its baseline tests.

At 100% browser zoom, refresh the game. Start a new battle for newly captured equipment/content; existing battles must retain their saved rules.

- [ ] Cockpit begins Inspect, Item, Move, Basic Attack, Support. Existing custom keybindings still work.
- [ ] Items has no introductory hero/global Reload button. A real loading failure still offers retry.
- [ ] On desktop, QP and all eight equipment slots are visible without scrolling Equipment. Inventory has useful scrolling space.
- [ ] Inventory controls and cards are smaller but readable; artwork is square and the empty card footer is gone.
- [ ] Search/filter matches appear at the top. Clearing the filter restores the saved arrangement; Save order persists a new sort.
- [ ] Masculine, feminine and androgynous characters use different standard equipment templates. Every template is neutral and faceless.
- [ ] Item details show compact artwork/facts and row-based Parameters. Ordinary desktop details fit without scrolling.
- [ ] Clicking an equipped slot shows details and Unequip, without comparing the item to itself. Inventory clicks still allow valid equip/swap comparisons.
- [ ] Weapons/shields equip to Main Hand; passive hand armor equips to Off Hand; battle supplies equip to Consumable 1/2.
- [ ] Sunsplitter is a testable two-handed weapon. It blocks Off Hand armor while both consumable slots remain usable.
- [ ] All eight positions count toward 100 QP. A setup above 100 is rejected without changing equipment.
- [ ] Equipping the same supply stack twice requires two owned units. Each position contributes QP and has independent battle uses.
- [ ] Profile Combat Stats change when gear is equipped. Colored bracket deltas identify the named contributing pieces on hover/tap. Core attribute allocation stays unchanged.
- [ ] Test Galewalker Boots for +2 Movement and Ember-Stitched Cowl for Mystic Power. Start a new battle and confirm the same bonuses apply there.
- [ ] Equip Emberbrand, Stormcaller Staff or Twinfang Blade. Select Kindle, Storm Ward or Quickstep in the one Support slot in Skill Manager, then verify that selected Support is available and works in battle.
- [ ] Battle supplies show their thumbnail when choosing Item. Their information popup is compact, with Parameters and remaining uses rather than inventory-only metadata.
- [ ] Consumable AP costs are in the 10–30 range, in steps of five. Test recovery, a temporary boost, damage modulation and a thrown attack.
- [ ] Weapon/Basic Attack and Support information use the current shared report style. No obsolete flavor paragraph or redundant target arrows appear.
- [ ] Current Fire companions display Conditional Cleanse configured to Chilled. Cleanse Chilled is absent from new authoring choices.
- [ ] Instant standard Damage explicitly shows [Instant]. Effect duration brackets consistently say Turns. Existing delayed/controlled effects retain their actual timing.
- [ ] Each ordinary effect heading and its brackets stay together on one line, including Barrier, on desktop and phone. Exceptionally long authored expressions remain readable without page overflow.
- [ ] In Skill/Essence/Resonance/Support/Item/Tag editors, text fields have persistent guidance saying where their text appears. The information button matches that guidance.
- [ ] Test Description, Flavor line, In-battle text and full/compact Tag wording separately against the named surfaces; do not expect a flavor field inside mechanics-only cockpit reports.
- [ ] Previous owned inventory, quantities, selected Support and active battle captures are preserved. Any unresolved old hand conflicts are clearly repairable rather than silently deleted.

Native local checks exercise browser geometry and real components, but do not replace your visual preference, authenticated production testing or a human multiplayer session.
