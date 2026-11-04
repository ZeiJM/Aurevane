# November 4 Items and shared report followup

Status: source implementation complete; not deployed. Verification and remaining release gates are recorded in `docs/verification/2026-11-04-items-presentation-followup.md`. This is the current Owner-approved direction. November 3 release receipts describe the previous live build and remain historical evidence, not a template for new work.

## Equipment and inventory

- Eight equipment positions: Head, Body, Pants, Boots, Main Hand, Off Hand, Consumable 1 and Consumable 2. Every equipped piece counts toward the character's 100 QP cap.
- Main Hand holds a weapon or shield (`weapon` class). Off Hand holds passive hand armor (`hand-armor`). A two-handed Main Hand blocks Off Hand only; both consumable positions remain usable.
- Battle items belong in the two consumable positions. The same stack may fill both only with at least two owned units; each equipped position has its own QP contribution and captured battle uses. Starter battle uses refill per battle without consuming inventory quantities.
- Current equipment admission captures schema version 2. Schema version 1 retains its original six-position hand rules, support selection, weapons and pinned definitions. Never reconstruct old encounters from current content.
- Additive migration moves unambiguous old held supplies/passives/weapons into their current positions. Preserve unresolved assignments for visible repair; do not silently delete equipment, inventory, active captures or history.
- Cockpit begins **Inspect → Item → Move → Basic Attack → Support**. Keep internal binding IDs and custom key assignments.
- Items page removes the introductory hero and global Reload button. Keep contextual retry when loading fails. At normal desktop 100% zoom, all eight equipment positions and QP fit without scrolling the Equipment pane.
- Inventory categories, search/filter/sort and cards are compact and readable. Filtered matches pack at the top; viewing a filter must not rewrite saved inventory order. Only Save order persists sorting. Item artwork uses a consistent square area without an empty card footer.
- Equipment uses a detailed, neutral, **faceless** fantasy mannequin selected from the character's saved masculine/feminine/androgynous presentation. Templates differ through clothing/body build; no face, hair or exposed human skin. The figure is decorative, not a promise of live gear rendering.

## Reports, text and stats

- Skill, Support, weapon and battle-item reports share the current Parameters contract and semantic tag explanations. No redundant per-effect target arrows, flavor paragraphs or repeated teaching explanation for the same tag. Preserve authored effect rows, prerequisites, costs and captured mechanical distinctions.
- Each effect heading and its brackets stay together on one line in ordinary desktop popups; adjust available width and spacing. Narrow layouts retain accessible reading without page overflow or unreadable font reduction.
- Battle-item information shows a small thumbnail, actual skill mechanics and remaining uses; it does not reuse the oversized inventory report. Item inventory details use compact art/facts and Parameters. Already-equipped slot inspection offers Unequip without comparing the item to itself.
- Current standard Damage explicitly reports **[Instant]** when it actually resolves instantly. Deliberately authored timing and historical execution remain authoritative.
- Use **Turns** for compact effect-duration labels. Preserve the actual pinned expiry clock in precise explanatory help; terminology changes do not rebalance execution or usage-reset boundaries.
- Current Chilled-only removal is **Conditional Cleanse**, configured to Chilled. Do not offer Cleanse Chilled as a standalone current authoring/default tag. Retained IDs remain compatibility data only and may not restore the retired visible design or change old Cleanse/Suppress execution.
- Profile Combat Stats show actual equipped totals and colored bracket deltas, with a named-equipment source breakdown on hover/tap. Invalid loadouts say the contribution is unverified. Core attributes are not fabricated from unrelated derived-stat bonuses. Battle compilation and Profile share the same effective equipment rules without double counting or mutating base stats.
- Every editable Description, Flavor line, Chronicle text and tag wording field has persistent, accurate guidance identifying its actual display surfaces. Shared guidance serves inline hints and information dialogs; no speculative promises that text appears everywhere. Standardized cockpit Parameters must not regain removed flavor prose just to satisfy an old hint.

## Starter content

- Three additional real equipment Support choices: Emberbrand's Kindle, Stormcaller Staff's Storm Ward, Twinfang Blade's Quickstep. They compete for the single existing Support selection and use normal battle authority. Tower Guard remains supported.
- Starter consumables cost 10–30 AP in steps of 5: Mender Salve 20; Clarity Draught 20; Purifying Incense 30; Whetstone Charm 15; Ironbark Tonic 10; Swiftleaf Tea 25; Emberflask 20; Vulnerability Oil 15; Frostbind Powder 30; Smoke Veil 20; Ward Sigil Scroll 30. Source definitions, not this prose, own exact item names and mechanics.
- Changed default bodies receive new content versions. Preserve old source versions, owned quantities and the original starter grant receipt. Do not republish unrelated Skills or overwrite Owner drafts.

## Regression prevention and release boundaries

Use the shared equipment-position helper, Parameters adapters, semantic tag explanation grouping and shared editor text guidance. Extend those sources rather than copying an older implementation from a historical fixture or release screenshot. Current authority overrides older statements about six equipment positions, consumables occupying hands, Item after Basic Attack, ordinary Damage hiding Instant, mixed duration labels and faceless-template placeholders.

Keep focused regression coverage for current eight-position admission, legacy captures, QP/quantity/hand conflicts, support injection, Profile/battle parity and native browser fit. Historical tests should clearly identify their pinned schema; current fixtures must use the current contract. Preserve full configured quality/CI gates. No hosted migration, catalogue publication, application deployment or Phase 5 closure is implied by implementation or passing local checks.
