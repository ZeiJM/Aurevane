# AUREVANE — Roadmap: Living Economy, Social Identity & Owner Access

**Authority:** Roadmap integration for `docs/LIVING_ECONOMY_SOCIAL_IDENTITY.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`.

**Direction approved:** 2026-08-17.

This roadmap module does **not** replace the main roadmap. It expands the existing phase structure with the newly approved Wayfarer's Practice ritual, professions/gathering/crafting/Trade House, Vowbond, title/badge, and Owner/Staff access work.

The existing major ordering remains correct:

- offline-training foundation begins with character progression;
- world resource representation begins when the living world exists;
- social identity/marriage matures with the Social World;
- the complete professions/Trade House loop belongs with the Economy phase;
- the complete Owner/Staff operating system belongs with the Complete Master Panel phase;
- security/economic abuse are hardened before production scale.

## Production Pacing Locks

- First-cycle endgame/Rekindling eligibility remains designed around **approximately 180 days / six calendar months minimum** under production defaults.
- Profession Level 5 is a **soft approximately 28–35 day side-progression target** for an ordinary engaged player.
- Wayfarer's Practice remains secondary and does not grant Gathering/Crafting profession XP by default.
- Marriage/Vowbond and titles do not grant launch combat power.
- Crafted equipment cannot bypass normal character level, Horizon, region/content, item, or PvP eligibility.

---

# Phase 0 — Foundation Additions

Add architecture boundaries only; do not build the full features yet.

### Authorization / Owner foundation

- stable authenticated account/user principal identity separate from character display name;
- architecture capable of marking exactly one protected Owner principal;
- never key Owner access from the character name `Zei`;
- granular server-side permission checks rather than client-side `isAdmin` state;
- role/permission data boundaries that support immediate revocation later;
- audit-event schema conventions for privileged changes;
- protected-route architecture for future `/master`;
- no service-role/database secret in browser code;
- environment separation for future privileged operations.

### Economy/profession foundation

- item/material stable IDs already support recipe, source, provenance, Trade House, and profession references later;
- character data model can later hold one Craft specialization and one Gathering specialization without schema hacks;
- material/resource definitions can later carry profession and required-level metadata;
- item instances can retain crafted provenance and enchantment state later without duplicating static definition fields.

### Identity/title foundation

- public character presentation supports future Official Badge + Display Title as separate concepts;
- do not overload a free-form profile bio field as an authority badge.

**Gate addition:** the architecture can later express Owner identity, delegated permissions, profession state, crafted provenance, enchantment state, and title/badge state without trusting names or client flags.

---

# Phase 1 — Character Foundation Additions

## Ticket: Wayfarer's Practice “Set Practice” ritual

Extend the existing Phase 1 Wayfarer's Practice work so the player can deliberately prepare training before leaving.

Scope:

- Character → Training / Wayfarer's Practice entry;
- Balanced Practice available;
- planned practice-window presentation (`Short`, `Overnight`, `Extended`, `Until I Return` or data-equivalent);
- exact estimated outcome preview clearly labeled as an estimate;
- `[Set Practice]` action stores prospective focus/window preference server-side;
- automatic Balanced fallback remains if the player sets nothing;
- authoritative accrual begins only after legitimate offline threshold;
- browser/client clock cannot create time;
- no direct Might/Finesse/Intellect/Resolve passive training;
- Training Report remains idempotent and server-generated;
- telemetry distinguishes explicit `Set Practice` users from automatic fallback users.

Out of scope:

- Discipline Focus until Discipline/Mastery exists;
- profession XP;
- item/material production;
- economy rewards;
- hard exact-hour claim requirements.

## Ticket: Personal Title data boundary

Do not necessarily expose the final title customization yet, but ensure character identity can later represent:

- one immutable Personal Title text entitlement;
- one selected Display Title reference;
- Official Badge state separately derived from authority;
- earned title collection.

**Gate addition:** setting practice is a pleasant optional pre-logout ritual, and the character/profile model will not need a redesign when titles arrive.

---

# Phase 2 — Tactical Combat Core Additions

No full profession/social implementation.

Add only compatibility boundaries needed by later systems:

- equipment snapshot supports future enchantment effect reference;
- combat forecasts can eventually display an enchantment's typed Effect Catalog contribution without special-case “profession combat code”;
- official title/badge display remains cosmetic and cannot influence combat resolution;
- dense battle UI reserves only compact identity treatment, never large title clutter over tactical information.

---

# Phase 3 — Discipline Framework Additions

## Wayfarer's Practice Discipline Focus

Implement existing Discipline Focus plus the new intentional-setting UI:

- choose one eligible unlocked Discipline before leaving;
- preview expected Mastery emphasis;
- offline Mastery ceiling;
- active proof/trial still required for true mastery;
- focus changes apply prospectively only;
- late-band/offline contribution tuning remains Master Panel configurable later.

No profession training is added to offline practice.

---

# Phase 4 — First Playable Discipline Set Additions

Use pacing/playtests to confirm:

- offline training is not becoming the best way to advance a Discipline;
- the `Set Practice` ritual is understandable and satisfying;
- direct offline XP/Mastery contribution remains modest in progression simulations;
- equipment Effect Catalog and item definitions can later accept crafted/enchantment effects without bespoke combat branches.

No requirement to build the Trade House or full profession loop here.

---

# Phase 5 — Living World, Story & Live Operations Additions

This phase begins the **world-side gathering foundation** because the map now exists.

## Ticket: Resource Site world model

Implement a small vertical slice sufficient to prove the living-map concept:

- authoritative Resource Site definition/state;
- region/node/location association;
- material yield references;
- profession family metadata (`Prospector`, `Forager`, `Tracker`);
- required gathering level metadata;
- hidden/visible/discovered state support;
- server-side eligibility/yield resolution;
- resource markers/hints that fit the world map instead of a spreadsheet overlay;
- no client-authoritative rare-resource spawn/yield;
- telemetry for site discovery/harvest attempts.

This slice may use test/temporary profession grants if the full profession selection UI is intentionally deferred to Phase 11.

## Ticket: Protected Master Panel access shell

Implement the existing `/master` Phase 5 shell with the following approved access pattern:

- same AUREVANE application, protected `/master` route;
- Profile/Account → `Master Panel` navigation only when the identity has `master.access`;
- manual URL entry by an unauthorized player still receives server denial;
- Owner authority resolves from stable authenticated Owner account ID, never character name;
- Zei is the intended Owner character presentation, not the authorization key;
- initial role/permission framework;
- current permission check on every privileged operation;
- audit trail;
- prompt revocation behavior.

## Ticket: Owner Official Badge foundation

When public identity/badge rendering exists:

- Owner principal derives official `WORLDWRIGHT` badge;
- initial visual family: solar-gold + deep-violet, with icon + text;
- presentation must not be user-editable;
- badge state and authorization state remain separate;
- moderation/operational stealth rules remain compatible with future staff badges.

## Ticket: Event title grant boundary

Live events should be able to reference an earned title reward definition later, but do not build an uncontrolled free-form staff title-grant command.

**Gate addition:** the map can express real profession-aware resource sites, and Zei/authorized staff can reach only the appropriate Master Panel surfaces through server-enforced permissions.

---

# Phase 6 — Party & Co-op Additions

Prepare Vowbond/social convenience interoperability without full marriage implementation:

- party invites and group state must not assume spouse status grants combat permission;
- future spouse `Rendezvous` cannot move a character into a party battle, Expedition, or restricted session;
- title/badge presentation in party UI remains compact;
- block/privacy rules remain capable of overriding future Vowbond social shortcuts.

---

# Phase 7 — Expeditions Additions

Add profession hooks only where the underlying resource system is stable:

- Expedition rooms may reference approved profession Resource Sites;
- profession-gated gathering opportunities never bypass Expedition progress/encounter rules;
- rare crafting materials may come from legitimate Expedition completion or profession interactions;
- suspended/reconnected runs cannot duplicate harvested materials;
- resource state is pinned/versioned consistently with the run where required;
- Rank 5 gathering must not reveal unreached boss/room spoilers.

No profession may turn an Expedition into a passive resource printer.

---

# Phase 8 — PvP Additions

Protect competitive integrity before crafted/enchanter gear becomes widespread:

- ranked equipment validation understands enchantment state;
- Arena Tempering/mode overrides may normalize enchantment coefficients/effects where needed;
- official badges/titles are presentation only;
- title cosmetics cannot obscure turn/timer/status information;
- Vowbond grants no PvP bonus;
- marriage cannot affect matchmaking, rating, rewards, or opponent visibility.

---

# Phase 9 — Full Discipline Roster Additions

As the item/build ecosystem expands:

- review every Discipline against Weaponwright/Outfitter/Enchanter item interaction coverage;
- prevent one crafted/enchantment effect family from becoming mandatory for an entire Discipline archetype;
- ensure crafted items create sidegrades/counterbuilds instead of only universal stat inflation;
- include crafted/enchantment interactions in representative AI/PvE/PvP regression suites.

---

# Phase 10 — Social World Additions

This is the primary phase for **Vowbond and player identity/title presentation**.

## Ticket: Title Collection & Personal Title

Implement:

- Official Badge + Display Title separation;
- one Personal Title custom string;
- server-side validation/normalization/reserved-term protection;
- exact preview before final lock;
- clear final confirmation explaining that the text becomes locked;
- one selected Display Title from eligible personal/earned titles;
- freely show/hide/switch displayed title without changing Personal Title text;
- profile/chat/social roster integration;
- compact battle/party treatment;
- title history required for moderation/support.

Do not allow custom Personal Titles to imitate official Owner/staff authority.

## Ticket: Earned/Event Titles

Implement:

- versioned title definitions;
- approved icon/palette metadata;
- event/achievement/profession/Vowbond eligibility hooks;
- authoritative grant/revoke;
- title collection UI;
- selectable display title;
- audited staff grant permission.

## Ticket: Staff Official Badges

Implement:

- aether-blue + silver official staff visual family;
- role-specific approved labels/icons where useful;
- derivation from active staff assignment/public-badge policy;
- automatic recomputation/removal when permissions/role are revoked;
- stealth/hidden badge option only when role/policy permits;
- no authority from badge presentation itself.

## Ticket: Vowbond / Marriage

Implement:

- explicit proposal and acceptance;
- one active Vowbond per character;
- partner profile link respecting privacy;
- Shared Hearth/private partner shortcut;
- safe-settlement `Rendezvous` convenience with strict world-state validation;
- optional ceremony presentation;
- dissolution and immediate safety/block override;
- optional short remarriage cooldown if telemetry/abuse warrants it;
- anniversary/Chronicle/title hooks.

Do not add launch combat/XP/Mastery/profession/loot/tax advantages.

## Ticket: Title Reforge entitlement boundary

Prepare the Personal Title service to consume a verified Premium Commerce `Title Reforge` entitlement. The actual shop publication may arrive with the monetization surface, but Social World owns the safe title-change domain command.

**Gate addition:** players can form visible social identities, collect titles, optionally form a Vowbond, and distinguish official staff/Owner badges from ordinary prestige without creating combat power.

---

# Phase 11 — Economy Additions

This is the primary implementation phase for the **complete profession and Trade House loop**.

## Ticket: Profession Selection

Implement exactly:

```text
ONE Craft specialization:
- Weaponwright
- Outfitter
- Enchanter

ONE Gathering specialization:
- Prospector
- Forager
- Tracker
```

Requirements:

- profession preview before commitment;
- independent Level 1–5 tracks;
- profession XP ledgers/state;
- authoritative selection/switch commands;
- changing one specialization wipes that specialization's XP/level and level-gated access after explicit confirmation;
- re-selecting an abandoned profession starts at Level 1;
- no paid XP preservation/respec shortcut.

## Ticket: Profession XP & 1–5 progression

Implement data-driven curves targeting approximately 28–35 days of ordinary engaged use to Level 5.

Include:

- relevant gather/craft XP;
- first discovery/craft bonuses where approved;
- sharply reduced/zero XP for content far below current profession level;
- no profession XP for market speculation/reselling;
- analytics for time-to-rank;
- accelerated non-production test configuration.

## Ticket: Gathering Map Experience

Complete Resource Site gameplay:

- Level 1 common visibility;
- Level 2 uncommon/expanded identification;
- Level 3 rare categories + Survey/Track utility where useful;
- Level 4 concealed/advanced/event/Expedition opportunities;
- Level 5 master-only/endgame-region resources subject to legitimate world access;
- server-authoritative spawn/state/yield;
- hybrid shared/player-scoped harvesting where needed to prevent total monopolization;
- anti-bot/rate-limit/telemetry protections.

## Ticket: Weaponwright

Implement representative recipes across ranks, including at least one high-rank signature weapon with a genuinely build-changing typed effect.

## Ticket: Outfitter

Implement representative armor/accessory recipes across ranks, including at least one high-rank signature defensive/mobility/utility piece.

## Ticket: Enchanter

Implement:

- one bounded enchantment slot on eligible equipment by default;
- deterministic enchantment preview;
- no item-destruction chance;
- replacement/rework material cost;
- high-rank signature enchantments;
- town/vendor/quest/dungeon/crafted gear may all opt into enchantability;
- Effect Catalog integration;
- PvP override compatibility.

## Ticket: Materials Inventory maturity

Implement:

- auto-stacking;
- search;
- source/region/rarity/profession filters;
- `Used In` recipe links;
- known source hints;
- pinned/favorite material/recipe support;
- owned/missing quantities;
- Trade House shortcuts;
- protection/reservation where useful.

## Ticket: Crafting Panel

Implement:

- `Can Craft`, `All Recipes`, `Favorites`, `Commissions`;
- output preview;
- exact missing materials;
- deterministic optional material choice;
- resulting effect/stat preview;
- one atomic server-authoritative craft;
- provenance (`crafted by`, profession/level, recipe/version, materials, time, commission);
- profession XP on legitimate craft;
- rejected craft consumes nothing.

## Ticket: Trade House listings

Implement:

- browse/search/filter;
- material/equipment/eligible-good listings;
- authoritative escrow/locking;
- purchase/cancel idempotency;
- binding/quest/locked/loadout/equip validation;
- configurable listing/sale fees;
- item provenance display;
- economy telemetry.

## Ticket: Crafting Commission Board

Implement escrowed commissions for Weaponwright/Outfitter:

- exact recipe/output;
- buyer-supplied/crafter-supplied material rules;
- payment escrow;
- minimum profession level;
- deterministic material choice;
- output delivered directly to buyer;
- payment delivered to crafter on successful authoritative craft;
- profession XP awarded if eligible;
- no trust-based handoff scam path.

## Ticket: Enchantment Commissions

Extend commission escrow to Enchanter services:

- target item escrow without arbitrary crafter ownership;
- exact enchantment preview;
- buyer/crafter material contribution;
- atomic service result;
- item returned to buyer;
- payment/provenance/audit.

## Ticket: Crafted Gear Balance

Validate that:

- town/vendor gear remains genuinely usable;
- dungeon/quest/PvP/event gear remains relevant;
- crafted gear provides distinct authored identities/sidegrades;
- normal character level/Horizon gates remain enforced;
- no profession pairing can self-supply every important recipe;
- signature recipes require cross-profession and/or active-world materials;
- no gear-destruction gambling is needed as an economy sink.

**Gate addition:** a player can choose one craft + one gather profession, meaningfully progress each, discover resources on the map, make desirable items, enchant eligible gear, buy/sell materials/items, and use safe escrowed commissions without duplication or trust scams.

---

# Phase 12 — Nations Additions

Connect mature professions/economy to nations only where useful:

- nation regions may have distinct material distributions;
- nation campaigns/events may temporarily alter resource availability;
- essential competitive materials must retain recurring/alternate access and not be permanently locked behind one nation choice;
- nation profession rewards remain item/effect/version compatible;
- Trade House rules for nation restrictions, if any, require explicit design rather than accidental segmentation.

---

# Phase 13 — Complete Master Panel + Long-Horizon Operations Additions

## Owner / Staff security and access

Complete:

- Owner Command Center anchored to protected authenticated Owner account ID;
- Zei profile/account menu access to `/master` as convenience;
- custom role creation;
- granular permission grants/revocation;
- effective-permission preview;
- public staff badge policy;
- immediate revocation/session-grant-version behavior;
- no normal path to create/grant a second Owner;
- no delegated role manager can grant outside their allowed scope;
- MFA/step-up re-auth integration where supported;
- high-risk confirmation/reason/audit;
- break-glass Owner actions.

## Profession & Economy operations

Add:

- profession XP curve editor/simulator;
- profession level requirements;
- recipe editor/versioning;
- material/resource-site editor;
- gather visibility/level rules;
- yields/spawn/state controls;
- crafted/enchantment Effect Catalog validation;
- enchantment eligibility;
- Trade House fee/tax/rule controls;
- commission health;
- economy price/volume analytics;
- suspicious concentration/transfer analytics;
- emergency disable per recipe/material/site/enchantment;
- provenance/support inspection;
- rollback/version history.

## Identity / Title operations

Add permissions and tooling for:

```text
identity.titles.view
identity.titles.edit
identity.titles.grant
identity.titles.revoke
identity.titles.publish
```

plus:

- earned title editor;
- icon/palette controls from approved assets/tokens;
- Personal Title policy;
- reserved authority terms;
- support/moderation title correction;
- Title Reforge product linkage;
- title history/audit;
- global disable/repair for a broken title definition.

## Vowbond operations

Add:

- lookup/state inspection;
- safety/support dissolution;
- ceremony/anniversary config;
- earned-title hook configuration;
- privacy/moderation support;
- audit.

Staff tools must not casually force a Vowbond between players.

## Wayfarer's Practice operations

Add:

- planned practice-window presentation settings;
- late-band direct-XP decay/conversion;
- explicit-set vs automatic-default analytics;
- pacing alarms if offline progression grows too large a share of first-cycle progression.

**Gate addition:** Zei can safely run these systems without routine raw database edits and can delegate narrow operations that are promptly revocable and fully auditable.

---

# Phase 14 — Art & Audio Production Polish Additions

Polish:

- profession icons for six specializations;
- Level 1–5 profession progression presentation;
- map resource-site symbols that fit each region;
- gathering interaction audio/VFX;
- crafted-item provenance treatment;
- Trade House visual identity;
- crafting/enchantment result presentation;
- Personal Title palette families;
- event-title themed palettes;
- `WORLDWRIGHT` Owner badge in solar-gold/deep-violet;
- staff badge family in aether-blue/silver;
- Vowbond profile/ceremony/anniversary presentation;
- Wayfarer's Practice before-bed setting and return report so it feels like character continuity rather than an idle-game claim chest.

Accessibility:

- official authority always uses icon/text as well as color;
- title contrast remains readable;
- ornate badges do not overpower tactical screens;
- reduced-motion options apply to title/crafting/claim flourishes.

---

# Phase 15 — Hardening Additions

## Profession / gathering / crafting

Test:

- profession switch/wipe correctness;
- no recovery of abandoned XP through stale requests/reconnects;
- rank requirement enforcement;
- low-tier XP relevance scaling;
- Resource Site race/depletion/player-scope behavior;
- yield/spawn authority;
- bot-like cadence/rate limits;
- craft consume/output atomicity;
- material reservation/overflow;
- crafted provenance integrity;
- enchantment replace/rework atomicity;
- no item destruction on rejected enchant;
- PvP enchantment normalization/disable behavior.

## Trade House

Test:

- double purchase;
- listing cancel/purchase races;
- escrow duplication;
- equipped/locked/bound/key-item rejection;
- price/input validation;
- commission cancel/accept/complete races;
- buyer/crafter material accounting;
- Enchanter target-item escrow;
- payment/output idempotency;
- economy abuse/concentration;
- support correction auditability.

## Titles / badges

Test:

- Unicode normalization/homograph edge cases;
- reserved official authority terms;
- injection/markup rejection;
- title lock/Title Reforge entitlement correctness;
- no title purchase can grant an Official Badge;
- staff badge removal when role revoked;
- hidden-badge/stealth behavior;
- badge/title readability in chat/social/battle surfaces.

## Owner / Staff access

Test:

- ordinary player direct `/master` denial;
- name `Zei` spoof does not grant Owner;
- character rename does not change Owner authority;
- permission escalation attempts;
- role manager grant-scope enforcement;
- immediate revocation/stale privileged session behavior;
- MFA/step-up flows where enabled;
- CSRF/rate limiting;
- audit immutability/searchability;
- break-glass safeguards.

## Vowbond

Test:

- proposal/acceptance consent;
- duplicate/multiple active bond prevention;
- dissolution;
- block/privacy override;
- Rendezvous location eligibility;
- no travel to locked regions/Expeditions/PvP/restricted states;
- no duplicated inventory/currency/loot state.

## Pacing

Validate production telemetry/simulations against:

- ~180-day first-cycle endgame target;
- ~28–35 day ordinary profession Level 5 target;
- modest offline direct progression share;
- no profession/offline/marriage/title shortcut around Horizon/endgame qualification.

---

# Closed Alpha Integration Target

The earliest Closed Alpha does not need every mature economy feature before combat/world testing can begin, but it should eventually include enough of this module to validate the social/economic loop before production:

- Wayfarer's Practice `Set Practice` ritual + automatic fallback;
- resource-site vertical slice in at least one or two regions;
- profession data model;
- at least one testable specialization from each craft/gather family during staged rollout;
- Materials inventory usability;
- representative crafted item + enchantment integration;
- basic Trade House listing flow before economy-scale testing;
- commission escrow before Enchanter is considered production-ready;
- Personal Title + earned title architecture;
- Owner `WORLDWRIGHT` badge;
- delegated staff badge/permission foundation;
- protected `/master` access anchored to stable Owner identity;
- Vowbond may enter later Alpha with Social World if it would distract from core combat/world validation earlier.

Production profession pacing may be accelerated in Alpha/test environments; production defaults remain the month-scale target.

---

# Ticket Rule Additions

Profession/economy tickets must state:

- profession(s) in scope;
- profession level(s) in scope;
- material/recipe/resource definitions touched;
- whether item instances/provenance/enchantment state change;
- transaction/idempotency boundaries;
- Trade House/economy impact;
- anti-abuse cases;
- production vs test pacing assumptions.

Title/role tickets must state:

- whether state is cosmetic presentation or actual authorization;
- exact permission required;
- reserved authority-spoofing protections;
- audit behavior;
- revocation behavior.

Master Panel tickets must never treat route hiding, a badge, a character name, or a client role flag as authorization.