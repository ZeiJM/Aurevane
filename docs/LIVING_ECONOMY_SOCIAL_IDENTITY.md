# AUREVANE — Living Economy, Social Identity & Owner Access

**Status:** Authoritative feature expansion subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/OFFLINE_PROGRESSION.md`, `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/MASTER_PANEL.md`, `docs/MONETIZATION.md`, `docs/SOCIAL_PRESENCE.md`, and `docs/WORLD.md`.

**Direction approved:** 2026-08-17.

This specification expands five connected systems:

1. the deliberate before-bed hook for Wayfarer's Practice;
2. gathering, crafting, professions, materials, enchantment, and the Trade House;
3. marriage / Vowbond as a lightweight social commitment;
4. personal, earned, staff, and Owner titles/badges;
5. secure Owner/Staff access to the Master Panel.

The systems are deliberately connected through identity and the living world, but they must not become alternate shortcuts around AUREVANE's core progression.

---

## 1. Progression Pacing Decision

The current production direction remains the existing **approximately 180-day / six-calendar-month minimum first-cycle journey** to complete endgame/Rekindling eligibility.

Do **not** silently shorten the production target to three months.

The new systems support that journey without replacing it:

- Wayfarer's Practice provides modest continuity while away;
- profession Rank 5 is a roughly one-month side progression target;
- marriage provides social convenience and identity rather than combat power;
- titles provide prestige and customization rather than power;
- crafted equipment remains subject to normal character level, Horizon, content, PvP, and item-balance rules.

Profession mastery is therefore a meaningful medium-horizon goal inside the longer character journey.

---

# PART I — WAYFARER'S PRACTICE: THE BEFORE-BED HOOK

## 2. Keep the Existing System; Improve the Ritual

AUREVANE already has the correct foundation in `docs/OFFLINE_PROGRESSION.md`: **Wayfarer's Practice**.

Do not create a second unrelated idle-training system.

Instead, make the existing system feel deliberately settable before a player leaves for work, school, sleep, travel, or another long absence.

The desired behavior is:

```text
PLAYER IS FINISHED FOR NOW
  ↓
Character → Training / Wayfarer's Practice
  ↓
Choose a Practice Focus
  ↓
Preview a planned practice window / estimated outcome
  ↓
[Set Practice]
  ↓
Player goes offline normally
  ↓
Server-authoritative practice accrues only while legitimately offline
  ↓
Player returns
  ↓
Training Report + next active goal
```

This creates the psychological hook:

> “Before I go to bed, what should Zei train tonight?”

without becoming:

> “If I forget to set an eight-hour timer, I wasted the night.”

## 3. Practice Focuses

Retain the existing focuses:

### Balanced Practice

Default and safest option.

- modest Character XP;
- modest eligible Discipline Mastery once Discipline training exists;
- Rested Momentum.

### Discipline Focus

- reduced Character XP;
- increased Mastery for one already unlocked eligible Discipline;
- cannot complete the final proof/trial required for actual Discipline Mastery.

### Recovery & Study

- little or no direct Character XP;
- emphasizes Rested Momentum for the next active session.

The player may change the selected focus while online. A focus change only applies prospectively; it never rewrites already accrued time.

## 4. Planned Practice Window

The UI may let the player choose a **planned practice window** such as:

- Short Session;
- Overnight;
- Extended;
- Until I Return.

The exact hour presets are presentation/tuning data, not security boundaries.

The planned window exists to make the system feel intentional and to give the player a useful estimate. It does **not** mean the browser owns a reward timer.

Rules:

- authoritative accrual begins only after the server considers the character offline under the normal threshold;
- returning early credits only legitimate elapsed time;
- returning late does not destroy rewards;
- if the player forgot to set anything, Balanced Practice still applies automatically;
- a browser tab left open cannot manufacture offline time;
- the client clock cannot accelerate the timer.

## 5. No Direct Passive Attribute Farming

Wayfarer's Practice should progress **Character XP**, eligible **Discipline Mastery**, and **Rested Momentum**.

It should **not** directly tick Might, Finesse, Intellect, Resolve, or arbitrary permanent stats upward while the player sleeps.

Attributes remain connected to the normal level/build system. Direct passive stat training would create an idle optimization layer that is much harder to balance and would make offline time feel mandatory.

## 6. Late-Band Protection

As characters approach late progression bands, direct passive XP may be reduced or increasingly converted into Rested Momentum through configurable curves.

This gives the Pacing Simulator another lever to prevent frequent offline claims from helping characters hit Level 100 or other numerical ceilings too early while still preserving a satisfying return report.

Wayfarer's Practice must remain a modest contributor to the six-month journey and must not progress Gathering/Crafting profession XP by default.

Professions should make the player go into the world, find things, make things, and interact with the economy.

---

# PART II — PROFESSIONS, GATHERING, CRAFTING & TRADE

## 7. Profession Structure: Two Specialization Slots

Each character may hold:

```text
ONE CRAFT SPECIALIZATION
+
ONE GATHERING SPECIALIZATION
```

There are three choices in each category.

This interpretation is intentional. A character gets one craft and one gather path, but cannot become every kind of producer. High-tier recipes deliberately require materials across multiple gathering specialties, so one character still depends on other players and the Trade House.

The six combinations do not exist as classes; the player simply owns one choice from each list, producing nine possible craft/gather pairings.

## 8. Craft Specializations

### 8.1 Weaponwright

Primary identity:

- weapons;
- shields/off-hands where appropriate;
- weapon components;
- offensive and tactical weapon-effect recipes;
- high-rank signature weapons.

Weaponwright items should not be nothing but bigger damage numbers. High-rank recipes may alter Basic Attacks, movement interactions, Guard interactions, terrain, setup/payoff tags, or other approved Effect Catalog behaviors.

### 8.2 Outfitter

Primary identity:

- armor;
- accessories;
- protective and mobility-oriented equipment;
- specialist field gear where it fits the item system;
- high-rank signature armor/accessories.

Outfitter recipes can emphasize defense, positioning, utility, status interaction, movement rules, or build-specific sidegrades rather than raw universal stat superiority.

### 8.3 Enchanter

Primary identity:

- enchantment sigils/components;
- applying bounded enchantments to eligible weapons, armor, and accessories;
- reworking or replacing an eligible enchantment through a controlled material cost;
- high-rank signature enchantments.

Enchanter is a service-heavy profession and must work cleanly through Trade House commissions/escrow so players do not need to hand valuable gear to strangers on trust.

Enchantment uses the existing typed Effect Catalog and item validation rules. It is not arbitrary scripting.

### Enchantment slot rule

Normal eligible equipment should support **one bounded enchantment slot** as the default design direction.

Do not create unlimited enhancement stacking.

Town/vendor, dungeon, quest, event, and crafted equipment may all be enchantable when their definition permits it. This is important: crafted gear should be attractive because of authored identity, provenance, and unique build options, not because every non-crafted item is intentionally obsolete.

## 9. Gathering Specializations

### 9.1 Prospector

Finds and gathers primarily:

- ores;
- metals;
- stone;
- crystals;
- geodes;
- mineral reagents;
- rare deposits.

### 9.2 Forager

Finds and gathers primarily:

- herbs;
- fibers;
- wood;
- resins;
- fungi;
- flowers;
- botanical reagents.

### 9.3 Tracker

Finds and gathers primarily:

- hides;
- bone;
- claws/fangs;
- monster organs/parts where appropriate;
- spoor/traces;
- creature essences;
- rare trophies/components from eligible defeated creatures or discovered sites.

Tracker gathering must not duplicate the entire combat loot table. It adds profession-specific harvest opportunities to the world/creature loop.

## 10. Cross-Profession Dependency

High-value recipes should rarely be self-contained inside one gathering path.

Example:

```text
Stormglass Pike

Weaponwright recipe
requires:
- Sky-Iron Ingot       → Prospector
- Stormwood Shaft      → Forager
- Tempest Core         → Tracker / encounter source
- Runic Temper         → Enchanter service/material
```

This creates the intended social economy:

- gatherers sell to crafters;
- crafters buy from multiple gathering types;
- players post commissions;
- Enchanters improve gear from multiple sources;
- towns still provide usable equipment;
- rare world/Expedition/event materials connect the economy to active content.

No single profession pairing should perfectly self-supply every important recipe.

---

## 11. Profession Levels 1–5

Each active specialization has a separate level:

```text
Profession Level 1
Profession Level 2
Profession Level 3
Profession Level 4
Profession Level 5
```

Craft and Gathering levels progress independently.

### Production pacing target

The target for an ordinary engaged player who meaningfully uses a profession is approximately:

```text
Level 1 → 2: ~2–3 days of normal use
Level 2 → 3: ~4–6 additional days
Level 3 → 4: ~7–10 additional days
Level 4 → 5: ~12–16 additional days

Total soft target: ~28–35 days
```

This is a **soft gameplay target**, not a literal thirty-day lockout.

Hardcore players may progress faster. Casual players may take longer. Exact XP curves belong in data and the Pacing Simulator.

Do not add a hard “wait until next Tuesday to become Level 4” requirement solely to force a calendar month.

## 12. Profession XP Rules

### Gathering XP

Award XP for:

- successful eligible gathers;
- higher-rank resources;
- first discovery/harvest of a material where appropriate;
- rare or difficult resource-site interaction;
- approved profession quests/challenges.

### Crafting XP

Award XP for:

- successfully producing an eligible recipe;
- completing a legitimate Trade House crafting commission;
- first-craft discovery bonuses where appropriate;
- higher-rank recipes/material combinations;
- approved profession quests/challenges.

### Anti-spam relevance scaling

Repeatedly crafting or harvesting content far below the profession's current level should provide sharply reduced or zero useful profession XP.

A Level 4 Weaponwright should not become Level 5 by creating ten thousand starter daggers.

This both improves pacing and reduces cheap-material bot/spam pressure.

Do not award profession XP merely for listing, buying, reselling, or moving goods through the Trade House.

## 13. Profession Switching Is a Real Commitment

A player may abandon and replace either specialization, but the abandoned specialization loses its progression.

When changing one profession slot:

- its current profession XP is erased;
- its current profession level is erased;
- level-gated recipe access becomes inactive;
- profession-specific map visibility becomes inactive;
- the new profession begins at Level 1;
- previously produced items remain legitimate and keep their provenance;
- Chronicle/history may remember that the old profession once existed, but it does not restore power or XP;
- re-selecting the old profession later starts again at Level 1.

The UI must show a strong explicit confirmation containing the exact profession, level, XP, and unlocks being lost.

There is no normal premium product that preserves profession XP through a switch.

The player should be able to inspect all six professions, example materials, sample high-rank recipes, and expected playstyle before committing.

## 14. Profession Titles After Abandonment

Profession achievement records may remain historical, but titles that imply current professional authority should become unavailable while that profession is inactive.

For example, a former Level 5 Weaponwright may retain a Chronicle record that they once mastered Weaponwright, but cannot actively display a current `Master Weaponwright` profession title while working as an Enchanter unless a separately authored historical title explicitly says otherwise.

This keeps titles truthful.

---

## 15. Gathering Makes the Map Feel Alive

Gathering should be visible in the world, not performed from a spreadsheet page.

The map/world system supports **Resource Sites** and profession-aware discovery.

Examples:

- ore seams in mountain routes;
- herb fields in wetlands;
- ancient trees in forest paths;
- beast spoor near creature territories;
- crystal eruptions after world events;
- rare gathering opportunities inside Expeditions;
- region-specific seasonal resources.

### Visibility by profession level

A gathering profession's level controls what the player can detect, identify, and harvest.

A recommended shape:

#### Level 1

- common resource sites;
- basic local markers after entering a nearby area;
- starter materials.

#### Level 2

- uncommon resource sites;
- better material identification;
- wider local survey range.

#### Level 3

- rare resource categories;
- richer region map hints;
- first active **Survey/Track** utility where useful.

#### Level 4

- concealed deposits/routes;
- advanced regional materials;
- event/Expedition profession opportunities where content permits.

#### Level 5

- master-only signatures;
- rare world-state resources;
- special resource-site interactions;
- endgame-region materials, but only in regions/content the character has legitimately unlocked.

Profession level never reveals inaccessible story zones or bypasses Horizon/world access.

## 16. Resource Node Model

Resource Sites are server-authoritative.

The browser never decides that a rare ore exists or what it yields.

Prefer a hybrid model that makes the world feel shared without allowing a tiny group of campers/bots to permanently monopolize every important material:

- the **site** can be shared world state;
- eligible harvest opportunities may be player- or cohort-scoped where needed;
- rare event/world resources may use genuinely shared depletion when that creates a good event;
- spawn/state/yield are server-generated;
- profession eligibility is validated server-side;
- suspicious harvesting cadence is rate-limited/observable.

Do not design the entire gathering economy around clicking a publicly known coordinate faster than everyone else.

## 17. No Punitive Profession Tool Chores

Do not add universal pickaxe durability, broken shears, repair fees, or multiple required tool inventory slots merely to imitate other MMOs.

If a profession needs a tool fantasy, use a profession toolkit/upgrade representation that does not create constant bag friction unless a later mechanic genuinely benefits from physical tools.

---

## 18. Crafted Equipment Philosophy

Crafted gear must be desirable without invalidating the rest of the game's loot.

AUREVANE should have three broad useful gear sources:

```text
TOWN / VENDOR / QUEST GEAR
→ reliable usable baseline and curated sidegrades

PVE / PVP / EVENT GEAR
→ authored encounter and progression identities

CRAFTED GEAR
→ player-made identity, deterministic material choices, provenance, and unique build effects
```

Crafted items may include **special unique weapons and armor** unavailable as ordinary town stock, but they should generally win through interesting identity rather than universally higher raw numbers.

Normal level/Horizon/equipment eligibility still applies.

## 19. Deterministic Material Influence

Avoid turning crafting into casino rerolling.

Where materials alter an output, the recipe should show the result before final craft whenever possible.

Example:

```text
Choose one Masterwork Temper:

Emberheart Alloy
→ first Basic Attack after Guard can apply Scorched under a bounded rule

Skyglass Alloy
→ a movement/initiative-oriented weapon modifier

Grave-Iron Alloy
→ a defensive/control-oriented modifier
```

The exact effects use the approved Effect Catalog and item power budget.

The player is making a build decision, not gambling for a 0.3% perfect affix.

## 20. Crafted Provenance

Important crafted equipment should remember provenance such as:

- crafter character ID;
- public crafter name at creation time;
- craft profession;
- profession level at craft time;
- recipe/version;
- major material choices;
- crafted-at timestamp;
- commission ID if applicable.

Player-facing inspection may show tasteful copy such as:

> **Forged by Zei**

This gives high-level crafters social reputation and creates stories around famous makers.

Renaming a crafter later must not corrupt provenance; store stable identity and a historical display snapshot where required.

---

# PART III — MATERIAL INVENTORY & CRAFTING UX

## 21. Materials Inventory

Extend the existing Materials view in `docs/ITEMS_INVENTORY_LOADOUTS.md` into a profession-friendly inventory.

The player can:

- search by material name;
- filter by source, region, rarity, gathering profession, and recipe use;
- see quantity and stack limits;
- favorite/pin materials;
- see `Used In` recipes the character legitimately knows;
- see known acquisition/source hints;
- see whether more is available in the Trade House;
- jump to a pinned recipe;
- protect reserved materials from bulk sale where useful.

Materials should auto-stack and avoid bag-management pain.

## 22. Crafting Panel

The Crafting panel should be simple enough to use without a wiki open beside it.

Recommended structure:

```text
CRAFTING

[Can Craft] [All Recipes] [Favorites] [Commissions]

Recipe list
  ↓
Output preview
  ↓
Required materials
  - owned quantity
  - missing quantity
  - known source
  - Trade House shortcut
  ↓
Optional deterministic material choice
  ↓
Exact output/effect preview
  ↓
[Craft]
```

The server performs one atomic authoritative craft:

```text
validate profession + level + recipe + item eligibility
→ lock/consume exact materials
→ create output instance
→ record provenance
→ award eligible profession XP
→ commit transaction
→ emit inventory/economy events
```

A rejected craft consumes nothing.

## 23. Enchantment UX

The Enchanter flow must clearly show:

- target item;
- whether the item is enchantable;
- current enchantment if any;
- selected enchantment recipe;
- materials;
- exact resulting effect;
- replacement warning if an enchantment already exists;
- PvP/mode override information where applicable;
- final item state before confirmation.

No hidden chance to destroy the item.

Do not use gear-destruction or downgrade gambling as an economy sink.

---

# PART IV — THE TRADE HOUSE

## 24. Purpose

The **Trade House** is AUREVANE's player economy hub.

It should let players acquire missing materials, buy player-made equipment, sell legitimate tradeable goods, and safely commission crafters/Enchanters.

It is not a real-money marketplace.

All normal in-game trade uses authoritative game currency such as Crowns and follows binding/tradability rules.

## 25. Trade House Surfaces

### Browse Listings

- materials;
- tradeable equipment;
- eligible consumables/components;
- crafted items with visible provenance;
- filters by item, category, level, rarity, profession source, region/source, and price.

### Sell

- select eligible item/stack;
- choose quantity;
- enter price within configurable anti-abuse bounds where useful;
- preview listing fee/tax;
- confirm;
- item is escrowed/locked so it cannot also be equipped, consumed, sold elsewhere, or duplicated.

### Crafting Commissions

A buyer may post a request for a known recipe or service.

A commission can define:

- exact output/recipe;
- required minimum profession level;
- whether the buyer supplies some/all materials;
- whether the crafter supplies missing materials;
- offered Crown payment;
- expiration;
- deterministic optional material choice;
- enchantment target item if applicable.

The Trade House escrows materials, target item, and/or payment as appropriate.

The crafter never gains arbitrary ownership of the buyer's valuable item.

When the authoritative craft succeeds:

- output goes to the buyer;
- payment goes to the crafter minus configured economy sinks if any;
- profession XP is awarded normally when eligible;
- the transaction records provenance and commission history.

### Enchantment Commissions

Use the same escrow model for Enchanter services.

This is essential to making a service profession safe and usable.

## 26. Trade House Economy Sinks

The economy may use modest configurable:

- listing fees;
- completed-sale transaction taxes;
- commission fees.

These are economic controls, not punitive friction.

The Owner should be able to tune them through the Master Panel and review price/volume analytics.

Avoid fees so high that direct-player scam-prone trading becomes the rational default.

## 27. Price Information

Once sufficient volume exists, the Trade House may show compact historical information such as:

- recent sale range;
- median/typical recent price;
- recent volume.

Do not create speculative stock-market UI before the economy needs it.

## 28. Anti-Exploit Rules

At minimum:

- server-authoritative ownership and quantities;
- atomic listing/escrow/purchase/cancel/commission completion;
- idempotent purchase and commission commands;
- no selling an equipped/locked/bound/quest item when rules forbid it;
- no duplication through reconnect/race conditions;
- no client-authoritative prices or output IDs;
- rate limits on high-volume listing churn;
- suspicious transfer/value patterns visible to economy analytics;
- staff support corrections use audited domain commands;
- premium/real-money entitlements cannot be laundered into Crowns unless explicitly designed as tradeable, which is not the default.

---

# PART V — MARRIAGE / VOWBOND

## 29. Player-Facing Identity

AUREVANE may call the system **Vowbond** in-world while clearly explaining that it is the game's marriage/partner system.

The feature exists for social identity and long-term attachment to the world, not for mandatory optimization.

## 30. Forming a Vowbond

Requirements:

- two eligible player characters;
- explicit proposal;
- explicit acceptance;
- confirmation of the public profile link/title presentation;
- one active spouse/Vowbond per character;
- server-authoritative state change.

A ceremony scene/quest may be added for presentation, but the underlying consent/state must not depend on a fragile client sequence.

## 31. Benefits

Launch benefits should be intentionally modest and primarily social/convenience-based.

Recommended baseline:

### Shared Hearth

A dedicated private partner conversation/shortcut, still subject to normal block/safety rules.

### Partner Profile Link

Profiles may show the spouse/Vowbond partner when both privacy settings permit it.

### Rendezvous

A partner may travel to the other partner's **currently occupied safe settlement** when:

- both players are in eligible world state;
- the destination settlement is already legitimately unlocked by the traveler;
- neither is in PvP, battle, Expedition, restricted story state, or a special event state where travel would bypass gameplay;
- the action does not transport event objectives or otherwise bypass world rules.

This is a genuine minor convenience without giving combat stats, loot, XP, profession XP, or endgame acceleration.

### Ceremony / Anniversary Identity

- profile treatment;
- optional ceremony cosmetics;
- anniversary Chronicle entries;
- cosmetic/earned titles at approved milestones.

## 32. What Marriage Does Not Do at Launch

Do not grant by default:

- combat stats;
- damage/healing bonuses;
- PvP bonuses;
- direct Character XP bonus;
- Discipline Mastery bonus;
- profession XP bonus;
- extra loot;
- shared bank ownership;
- shared currency ownership;
- automatic inventory access;
- tax-free economic transfers that can be exploited by alts;
- access to locked regions/content through the spouse.

A social system should not become a mandatory min-max system.

## 33. Dissolution and Safety

Either partner may end the Vowbond.

Safety rules:

- block/harassment protections override partner convenience immediately;
- no player should be forced to remain socially reachable by a former partner;
- shared/private UI links disappear when the bond ends;
- an optional short remarriage cooldown may be used to reduce abuse/spam, but it should not trap players in a relationship state;
- dissolution never transfers or deletes ordinary personal inventory/currency;
- historical Chronicle records, if retained, must respect privacy/moderation rules.

---

# PART VI — TITLES, BADGES & SOCIAL PRESTIGE

## 34. Separate Display Titles from Authority Badges

AUREVANE should use two visual layers:

```text
OFFICIAL BADGE
+
DISPLAY TITLE
```

### Official Badge

System-controlled proof of Owner/staff authority where publicly displayed.

Players cannot type these manually.

### Display Title

One selected title from the player's title collection:

- personal custom title;
- earned event title;
- achievement title;
- profession title where eligible;
- other approved prestige title.

This separation prevents a custom title from masquerading as staff authority.

## 35. Personal Custom Title

Each character receives one opportunity to define a **Personal Title** without charge.

The title should feel important because the text becomes locked after final confirmation.

Flow:

```text
Enter title
→ validation
→ exact profile/chat/battle preview
→ clear warning that the text becomes locked
→ final confirmation
→ Personal Title text is permanently set
```

After confirmation, changing the Personal Title text requires the approved paid **Title Reforge** account service unless an Owner/Support moderation correction is required.

The player may freely **show, hide, or switch away from** the Personal Title to another earned title. The lock applies to changing the custom text, not to forcing it onto every surface forever.

## 36. Personal Title Safety

Custom titles must use server-side validation.

At minimum:

- sensible character limit;
- Unicode normalization;
- profanity/harassment filtering;
- no HTML/markup/script injection;
- reserved official words/variants protected where needed;
- no impersonation of Owner/Admin/Moderator/Staff/System/Official roles;
- no custom icon upload through the title field;
- no arbitrary CSS/color values.

The exact moderation policy belongs with public rules and moderation systems.

If a title is forcibly removed for a legitimate moderation/support reason, the support workflow should be able to grant a controlled replacement without forcing the player to pay merely because staff changed it.

## 37. Title Reforge Monetization

Title Reforge is an appropriate non-power USD account service under `docs/MONETIZATION.md`.

Requirements:

- USD price is data-driven/Owner-configurable;
- purchase changes only the Personal Title text entitlement;
- it grants no gameplay power;
- it cannot create an official badge;
- payment/fulfillment uses the normal verified Premium Commerce flow;
- failed payment cannot change the title;
- successful title change is audited and the previous title remains explainable for moderation/support history.

Do not sell stronger title colors that could imitate staff authority.

## 38. Earned Titles

Players may earn additional titles from:

- special Owner-created world events;
- staff-run events when the staff role has explicit title/reward publication permission;
- difficult PvE/PvP achievements;
- seasonal accomplishments;
- Archive/lore discovery;
- profession achievements;
- community/server firsts;
- anniversaries/Vowbond milestones;
- other approved prestige systems.

Earned titles are collectible and may be selected/changed without paying USD.

The paid service changes only the one personal custom title string.

## 39. Owner and Staff Badges

### Owner

The protected Owner identity receives the official **WORLDWRIGHT** badge.

Initial visual direction:

- solar-gold core;
- deep-violet edge/accent;
- distinct keystone/crown-like AUREVANE iconography;
- text/icon pairing so authority is not communicated by color alone.

The Owner's intended in-game character name is **Zei**.

Owner authority is **not** attached to the text `Zei`; it is attached to the protected authenticated Owner account identity.

### Staff

Staff badges are derived from active delegated roles/permissions.

Suggested visual family:

- aether-blue core;
- silver edge/accent;
- role-specific icon/label where useful;
- clear official styling distinct from personal/event titles.

Examples:

- STAFF;
- EVENT STAFF;
- MODERATOR;
- STORY STAFF;
- OPERATIONS.

A staff badge is automatically removed/recomputed when the underlying grant is revoked.

Staff may have operational stealth/hidden-badge behavior where moderation/security requires it and the Owner permits it.

## 40. Personal / Event Color Families

Personal and event titles should be attractive but visually subordinate to official authority badges.

Approved palette families may include tasteful treatments such as:

- Moonsteel;
- Ember;
- Verdant;
- Amethyst;
- Frost;
- Rosegold;
- event-specific authored themes.

Reserve the strongest Owner/official staff combinations so user-customized titles cannot visually spoof authority.

Every title treatment must retain readable contrast and must not rely on color alone.

## 41. Where Titles Appear

Depending on density, the active Display Title and Official Badge may appear on:

- character profile;
- Adventurers Online rows;
- chat/message headers;
- party/guild/social rosters;
- battle intro/inspection;
- PvP presentation;
- Chronicle/Hall of Selves;
- Trade House crafter profile/provenance where useful.

Do not repeat large ornamental title strings on every combat tile. Dense tactical screens should use compact treatment and preserve readability.

---

# PART VII — MASTER PANEL ACCESS & ROLE SECURITY

## 42. Access Decision: Same Game, Protected `/master`

For the current architecture, the best default is to keep the Master Panel at the existing protected **`/master`** route in the AUREVANE application rather than building a separate off-site admin website.

Reasons:

- one authentication system;
- fewer duplicated session/security paths;
- no unnecessary CORS/cross-domain complexity;
- easier reuse of server-authoritative domain commands;
- easier incremental development alongside the systems being operated;
- a separate website is not automatically more secure if it uses the same underlying credentials incorrectly.

The UI may expose a **Master Panel** entry inside the Profile/Account menu for identities with `master.access`.

For Zei, this makes the panel easy to reach from the normal account/profile experience.

However, the menu link is convenience only.

**Security must never depend on hiding the link or route.**

Typing `/master` manually as an ordinary player must still produce an authoritative denial.

A separate admin subdomain/deployment may be introduced later if operational isolation becomes valuable, while keeping the same permission/domain-command model.

## 43. Owner Identity Must Not Be the Character Name

Never authorize Owner access with logic such as:

```text
if character.name === "Zei"
```

Names can be changed, spoofed, normalized differently, or duplicated in unsafe implementations.

Owner authority must be anchored to a stable authenticated **account/user principal ID** and protected Owner assignment.

Conceptually:

```text
AUTH USER / ACCOUNT UUID
        ↓
protected Owner principal assignment
        ↓
Owner permission set
        ↓
optional in-game character Zei
        ↓
WORLDWRIGHT public badge
```

Changing the character display name must not grant/revoke Owner authority.

## 44. Role and Permission Model

Retain `docs/MASTER_PANEL.md`'s role-template + granular-permission design.

The Owner can:

- create custom roles;
- assign/revoke roles;
- grant/revoke explicitly allowed special permissions;
- scope permissions by environment/domain where useful;
- choose whether a delegated role receives a public staff badge;
- review effective permissions before saving;
- immediately revoke access.

Role examples remain:

- Administrator / Operations Lead;
- Live Event Manager;
- Narrative / Story Editor;
- Balance Designer;
- Content Editor;
- Moderator / Support;
- Analyst / Observer.

## 45. No Privilege Escalation

A delegated staff member must not be able to manufacture authority they do not possess.

Default rules:

- only the Owner can grant Owner authority;
- normal staff management cannot create a second Owner;
- `staff.roles.manage` is Owner-only initially unless the Owner deliberately delegates a bounded version later;
- a delegated role manager can never grant permissions outside their own grantable scope;
- high-risk permissions require explicit Owner action;
- public badge text is generated from approved role metadata, not user-entered HTML/free text.

## 46. Immediate Revocation

Staff power must be revocable promptly.

Privileged actions should validate current effective permissions at the server boundary rather than trusting a client-cached `isAdmin=true` flag.

Use an access/grant version or equivalent revocation mechanism so removing a role invalidates or blocks stale privileged sessions quickly.

## 47. Privileged Session Security

For production Master Panel access, plan for:

- MFA for Owner and privileged staff when supported;
- shorter/high-assurance privileged session handling where appropriate;
- step-up re-authentication for high-risk actions;
- CSRF/session protections appropriate to the stack;
- rate limits on destructive/high-volume commands;
- no service-role or database secret in browser code;
- no raw production credentials shown in the panel;
- environment separation;
- immutable/searchable audit trail;
- reason/confirmation for sensitive operations;
- break-glass Owner flow for exceptional recovery actions.

## 48. Official Badge Is Not Authorization

The badge shown in chat/profile is a presentation derived from authority.

It is never used as the source of authority.

Removing a public staff badge must not necessarily remove backstage permission if the role is intentionally stealthy, and adding a cosmetic badge record must never grant permission.

The authorization source remains the server-side role/permission system.

---

# PART VIII — MASTER PANEL OPERATIONS FOR THESE SYSTEMS

## 49. Profession & Economy Controls

Authorized Owner/economy staff should eventually be able to configure:

- profession enabled/disabled state;
- profession XP curves;
- level thresholds;
- XP relevance scaling;
- recipe profession/level requirements;
- resource-site definitions;
- gather profession/level visibility requirements;
- gather yields and spawn/state rules;
- crafting recipes and deterministic material variants;
- enchantment eligibility and effects;
- Trade House listing/commission rules;
- taxes/fees;
- binding/trading policies;
- emergency disable for one recipe/material/resource site/enchantment;
- economy telemetry;
- item/commission provenance inspection;
- rollback/version history.

## 50. Title Controls

Owner/authorized staff should eventually be able to:

- create earned title definitions;
- set title text/icon/palette from approved assets;
- define event/achievement eligibility;
- grant/revoke earned titles through audited commands;
- configure Personal Title length/reserved-word/moderation policy;
- configure Title Reforge product link/price through Premium Commerce;
- inspect title history for support/moderation;
- suspend a title globally if a rendering/moderation issue exists.

Granting event titles should use a dedicated permission such as:

```text
identity.titles.view
identity.titles.edit
identity.titles.grant
identity.titles.revoke
identity.titles.publish
```

Ordinary Event Staff should receive only the subset the Owner chooses.

## 51. Vowbond Controls

Owner/support staff may need:

- lookup;
- state inspection;
- safety dissolution/correction;
- ceremony/event configuration;
- anniversary/title configuration;
- audit history;
- emergency feature disable.

Support tools must not let ordinary staff silently force two players into a Vowbond.

## 52. Wayfarer's Practice Controls

Retain existing offline-training controls and add presentation/configuration for:

- planned practice-window presets;
- late-band direct-XP decay/conversion;
- training focus preview;
- progression contribution alarms in the Pacing Simulator.

---

# PART IX — ANALYTICS & PACE PROTECTION

## 53. Profession Analytics

Track at minimum:

- profession selection distribution;
- craft/gather pair distribution;
- time from selection to Levels 2/3/4/5;
- profession switching/abandonment rate;
- material supply by source/region/profession;
- recipe craft volume;
- commission completion/failure rate;
- crafted item equip rate;
- enchantment usage;
- Trade House volume/prices/fees;
- concentration of wealth/production;
- suspicious gathering/crafting/listing behavior;
- percentage of high-end builds using crafted gear versus other sources.

Healthy production tuning should keep Level 5 near the intended month-scale target for ordinary engaged use without requiring a hard monthly timer.

## 54. Endgame Protection

The new systems must not shorten the main progression unexpectedly.

Validate that:

- offline direct XP remains modest;
- profession XP never substitutes for Character XP/Horizon/endgame requirements;
- crafted gear has level/Horizon eligibility and cannot equip a fresh character into endgame power;
- Rank 5 gathering cannot reveal or harvest inaccessible late-game regions;
- rare crafting inputs remain tied to legitimate world/Expedition/event access;
- marriage grants no vertical progression at launch;
- titles grant no gameplay power;
- staff/Owner grants are auditable and excluded from normal progression/economy analytics when appropriate.

## 55. Closed-Alpha / Test Acceleration

The production profession target is ~28–35 days and the first-cycle endgame target is ~180 days.

Testing environments may use accelerated configuration to validate the full loop quickly.

Do not bake test acceleration into production defaults or create client-side shortcuts.

---

# PART X — DEFINITION OF SUCCESS

These systems succeed when:

- a player finishing for the night naturally thinks about what to train while away;
- forgetting to set training never creates a punishment spiral;
- offline progress feels useful but clearly secondary to playing;
- the world map has materials and profession discoveries that make regions feel economically alive;
- a player can become known as a great crafter/gatherer over roughly a month of meaningful activity;
- no one character can supply every important high-tier recipe alone;
- crafted items are desirable without making town/quest/dungeon gear irrelevant;
- Enchanters have a safe, trustworthy commission flow;
- the Materials inventory and Crafting panel are easy to understand;
- the Trade House creates player interdependence without duplication/scam-prone handoffs;
- Vowbond creates social identity and convenience without becoming a mandatory stat bonus;
- Personal Titles feel consequential, earned titles feel collectible, and official badges cannot be spoofed;
- Zei can reach the Master Panel easily from the game while Owner authority remains tied to a protected account ID rather than the name `Zei`;
- the Owner can grant and revoke narrowly scoped staff powers without creating privilege escalation;
- every privileged action is server-authorized and auditable;
- none of the additions undermine the approximately six-month first-cycle progression target.