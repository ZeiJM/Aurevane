# AUREVANE — Homesteads, Safe Nation Territory & World Navigation

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/WORLD.md`, `docs/ROADMAP.md`, `docs/LIVING_ECONOMY_SOCIAL_IDENTITY.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, and the Nation systems introduced later in the roadmap.

**Direction approved:** 2026-08-17.

This document defines four connected systems:

1. a nation-linked personal **Homestead** / home base;
2. safe sovereign nation territory around capitals;
3. map-layer visibility controls so the strategic map remains readable;
4. a compass/coordinate guidance system that supports normal questing without destroying exploration and hidden-location design.

The systems should reinforce identity, professions, social play, exploration, and the living world without becoming mandatory stat progression or turning AUREVANE into a survival/base-building game.

---

# PART I — THE HOMESTEAD FANTASY

## 1. Player Goal

A Homestead is the player's permanent personal place in the world: somewhere that visibly belongs to their character and nation.

It should provide:

- a strong sense of ownership;
- decoration and personal expression;
- expanded non-combat storage;
- trophy/display space;
- convenient access to approved crafting and organization tools;
- social visiting;
- a natural place for Wayfarer's Practice presentation;
- long-term cosmetic goals;
- visible ties to the player's nation.

It should **not** become:

- an alternate combat progression tree;
- a passive resource farm;
- a mandatory stat buff source;
- a private marketplace that bypasses the Trade House;
- a place where other players can raid or steal inventory;
- a survival-game building simulator that clogs the strategic map.

Player-facing working name: **Homestead**.

The world/lore may use nation-specific terminology later, but the system should remain understandable as the player's home base.

---

# PART II — WHERE HOMESTEADS EXIST

## 2. Nation-Linked Eligibility

A character becomes eligible for a Homestead through their current nation once the Nation system and the required character/world milestone are reached.

The exact unlock should be data-driven. Good candidates include:

- formal nation allegiance;
- a modest nation reputation threshold;
- a nation introductory quest;
- an appropriate character/Horizon milestone.

The Homestead should feel earned, but it should not take months to obtain. It is a retention/identity system players should encounter while they still have a long future with their character.

## 3. One Active Homestead

A character has **one active Homestead**.

The Homestead belongs to the character's current nation and is anchored within that nation's approved residential territory.

Do not allow players to maintain fully functional bases in all nations simultaneously. That would weaken allegiance, create storage/economic exploits, and make nation switching strategically mandatory.

## 4. The Capital Homestead Belt

Each nation capital has an authored **Homestead Belt** or residential outskirts zone inside sovereign nation territory.

Conceptually:

```text
CAPITAL CORE
  ↓
CIVIC / MARKET / SERVICE DISTRICTS
  ↓
HOMESTEAD BELT / OUTSKIRTS
  ↓
SAFE NATION TERRITORY
  ↓
FRONTIER / WILDERNESS / CONTESTED WORLD
```

The Homestead Belt defines the maximum valid region in which player homes may be anchored.

The exact radius/shape is authored per nation rather than assumed to be a perfect circle. Terrain, roads, rivers, cliffs, walls, lore, and capital layout may produce different residential bands.

## 5. Do Not Use Literal One-House-Per-World-Tile Placement

AUREVANE should not allow thousands of players to permanently occupy unique map tiles around a capital.

That creates:

- map clutter;
- land scarcity;
- griefing/speculation;
- unfair early-player advantage;
- ugly settlement sprawl;
- expensive world-state complexity.

Instead, use **authored Homestead Districts and parcel anchors**.

A player selects a valid district/parcel style or anchor point within the nation's Homestead Belt. The world map remembers the Homestead's nation/district/anchor identity, while the actual build/decor space is a private or permissioned Homestead instance.

Many players may logically live in the same district without physically colliding on the strategic map.

## 6. Personal World Anchor

The player's strategic map can display a single `My Homestead` marker at their selected authored anchor/district.

Friends/partners/party members only see another player's Homestead marker when permissions and social context justify it.

The map never displays every player's home simultaneously.

The anchor can affect:

- travel destination;
- visual backdrop/theme;
- nearby capital/outskirts ambience;
- district flavor text;
- nation identity;
- optional neighborhood labels later.

It should not affect hidden combat bonuses or real-estate power.

---

# PART III — SAFE NATION TERRITORY

## 7. Sovereign Territory Is Safe From Normal Monster Spawns

Normal hostile monster spawns **do not occur inside sovereign nation territory**.

This includes:

- capital districts;
- Homestead Belt;
- nation roads/settlements declared inside the safe sovereign area;
- player Homestead instances.

The purpose is to make a nation feel like actual controlled civilization rather than a city surrounded by wolves spawning ten feet from everyone's front door.

## 8. Combat Exceptions Must Be Explicitly Authored

The no-monster rule applies to normal ambient world spawning.

If later story/live operations require a siege, invasion, training exercise, duel, or crisis near a nation capital, combat must occur through an **explicit authored event/location/instance rule**.

Even then:

- ordinary roaming mobs do not randomly appear on Homestead plots;
- other players cannot attack/raid a Homestead;
- base decoration/storage cannot be destroyed or looted;
- event combat should occur at designated gates, defense nodes, arenas, or event instances rather than turning personal homes into griefable combat spaces.

This preserves the safety fantasy while still allowing dramatic nation events.

## 9. Frontier Begins Outside the Safe Territory

Wilderness monster encounters, gathering danger, roaming elites, world crises, and other hostile ambient activity begin outside authored sovereign-safe boundaries or in explicitly dangerous content nodes.

The map should make the safe-to-frontier transition readable.

---

# PART IV — HOMESTEAD STRUCTURE

## 10. Instanced Persistent Property

Each Homestead has authoritative persistent state such as:

- owner character ID;
- nation ID;
- district/parcel anchor ID;
- Homestead tier/layout ID;
- unlocked rooms/areas;
- placed decoration instances;
- decoration transforms/slots;
- storage state;
- display/trophy state;
- access permissions;
- selected ambience/music/theme where supported;
- version/update timestamps.

The client renders the home. The server owns what the player actually owns, what can be placed, storage contents, permissions, and persistent layout state.

## 11. Base Layout Philosophy

Use authored modular layouts rather than arbitrary voxel construction.

Possible spaces:

- Main Hall;
- Bedroom / Rest Chamber;
- Vault / Storage Room;
- Workshop;
- Trophy Gallery;
- Courtyard / Garden;
- Study / Archive Room;
- social sitting area;
- nation-themed exterior frontage.

Players decorate freely within designed placement surfaces/grids/anchors, but do not reshape the nation landscape itself.

This gives strong customization without creating impossible collision/pathfinding/moderation problems.

## 12. Homestead Expansion

The Homestead may expand through a small number of tiers.

Example direction:

```text
Tier I   — starter dwelling + basic Vault
Tier II  — expanded main space + more storage/decor budget
Tier III — Workshop / display expansion
Tier IV  — larger estate layout / courtyard / gallery
Tier V   — prestigious end-state visual expansion
```

Exact tier count and unlocks remain data-driven.

Expansion should primarily grant:

- more decoration capacity;
- more rooms/display surfaces;
- more storage;
- cosmetic architecture choices;
- convenience surfaces.

It should not grant direct combat stats.

## 13. Expanded Inventory: The Homestead Vault

The Homestead provides substantial **non-combat storage** through a Vault.

The Vault is separate from the player's normal carried inventory/loadout state.

Good Vault uses:

- crafting materials;
- spare equipment;
- cosmetics/decorations;
- collectible/trophy items;
- profession supplies;
- event souvenirs;
- non-active consumable stock where normal item rules allow it.

The Vault must not:

- expand combat consumable limits;
- allow an item to be simultaneously listed/equipped/traded/stored;
- bypass binding/unique rules;
- duplicate stacks through transfers;
- become shared spouse/guild storage by default.

Deposits/withdrawals are authoritative atomic inventory moves.

## 14. Storage Convenience Without Inventory Misery

The Homestead should make long-lived collecting easier.

Useful features:

- category tabs;
- search;
- filter/sort;
- material auto-stack;
- favorites/locked items;
- `Used In` recipe links;
- loadout-used indicator;
- Trade House eligibility indicator;
- bulk deposit for safe categories;
- smart `Deposit Materials` action;
- storage capacity preview.

Do not force the player to walk across five rooms to find which chest contains Iron Ore. The fantasy can be physical; the UX should remain centralized and searchable.

---

# PART V — DECORATION & IDENTITY

## 15. Decoration Sources

Decorations may come from:

- normal vendors;
- nation reputation;
- professions/crafting;
- achievements;
- Expeditions/bosses;
- events;
- PvP seasons;
- Vowbond/social milestones;
- Chronicle/server-first recognition;
- premium cosmetic purchases where appropriate;
- special Owner-created events.

Decoration rewards are ideal prestige rewards because they are expressive and non-power.

## 16. Decoration Categories

Examples:

- furniture;
- rugs;
- banners;
- lighting;
- wall art;
- statues;
- plants;
- bookshelves;
- weapon/armor display stands;
- trophies;
- profession displays;
- nation heraldry;
- event memorabilia;
- ambient particle accents where readable;
- music/ambience selections;
- exterior architectural themes.

## 17. Trophy and Display System

The Homestead should visually remember accomplishments.

Displayable examples:

- boss trophies;
- rare crafted signature equipment;
- profession mastery plaques;
- event trophies;
- nation campaign awards;
- Rekindling prestige items;
- Vowbond mementos;
- Chronicle achievements;
- selected armor/weapon mannequins.

Displayed items must not disappear from ownership or become duplicate usable copies.

A display can either reference an owned item safely or use a separate cosmetic/trophy unlock depending on item type.

## 18. Content Safety

Players choose only approved in-game assets/text options.

Do not allow arbitrary HTML, CSS, scripts, or unrestricted image uploads into Homesteads.

If custom text surfaces are ever added, they use the same moderation/sanitization rules as profiles/titles.

---

# PART VI — FUNCTIONAL HOMESTEAD FEATURES

## 19. Convenience, Not Power

Homestead functions should save clicks/travel or create identity, not increase combat strength.

Good launch/expansion functions:

- Vault access;
- wardrobe/display management;
- Wayfarer's Practice setup/presentation;
- Crafting panel access once professions exist;
- profession recipe/material planning;
- Codex/Archive shelf shortcut;
- event/calendar board;
- build/loadout management;
- mail/message/social shortcuts if those systems exist;
- cosmetic ambience control.

## 20. Workshop

A later Homestead Workshop may provide access to the same authoritative crafting system available elsewhere.

Rules:

- it does not create extra recipes by itself;
- it does not improve craft success/power;
- it does not generate materials passively;
- it does not bypass profession requirements;
- it does not remove Trade House taxes or commission rules;
- profession-specific visual workstations may change appearance based on the player's chosen profession.

This is convenience and fantasy, not hidden economic power.

## 21. Wayfarer's Practice at Home

The Homestead is a natural presentation surface for `Set Practice`.

Examples:

- training corner;
- study desk;
- resting chamber;
- short animation/illustration matching Balanced/Discipline/Recovery focus later.

The Homestead changes presentation only. Owning a bigger house does not increase offline XP/Mastery rates or caps.

## 22. No Passive Resource Generators at Launch

Do not add:

- ore mines that automatically produce tradeable ore;
- herb gardens that print rare materials while offline;
- servants generating Crowns;
- automatic crafting queues producing market goods;
- storage interest;
- real-time timers that create mandatory house-management chores.

Those systems would turn housing into economy progression and invite alt-account farming.

A cosmetic garden is fine. If a later interactive garden system is ever proposed, it needs its own economy review.

---

# PART VII — SOCIAL VISITING

## 23. Access Modes

The owner may choose from simple access policies such as:

- Private;
- Vowbond Partner;
- Friends;
- Guild;
- Invite Only;
- Public Visit.

The exact set may expand as social systems mature.

## 24. Visitors Cannot Steal or Mutate Ownership

Visitors cannot:

- withdraw Vault items;
- move/delete decorations unless explicitly granted a future co-decorator permission;
- claim rewards;
- use bound owner-only economy actions;
- alter the owner's Wayfarer's Practice;
- change access settings;
- damage the Homestead.

## 25. Vowbond Integration

A Vowbond partner may receive a convenient visit/travel shortcut when allowed by both players' privacy settings and world-state rules.

Do not automatically merge inventories, Vaults, ownership, or Homestead authority through marriage.

A future optional shared-decorating mode can be considered separately with explicit permissions and audit/recovery safeguards.

---

# PART VIII — NATION SWITCHING & RELOCATION

## 26. Nation Allegiance Change

If a character legitimately changes nation, the Homestead must not delete their property.

Recommended flow:

```text
old Homestead becomes PACKED / RELOCATION PENDING
  ↓
placed layout is snapshotted
  ↓
all owned decor + Vault contents remain safely owned
  ↓
player completes new-nation housing eligibility
  ↓
choose new Homestead district/anchor
  ↓
restore compatible layout where possible
  ↓
manual placement required only where architecture differs
```

The old nation Homestead is no longer an active travel/storage outpost after allegiance changes.

## 27. Storage During Relocation

Vault contents remain recoverable during relocation so nation switching cannot trap or destroy items.

They may be exposed through a temporary `Packed Storage` interface until the new Homestead is established.

Do not let players exploit relocation to duplicate capacity or maintain functional storage in multiple nations.

## 28. Moving Within the Same Nation

A player may later relocate to another allowed district/parcel within the same nation for an in-game fee/cooldown if needed to prevent spam.

Moving is cosmetic/identity convenience and should not sell combat advantage.

---

# PART IX — MAP READABILITY: LAYER TOGGLES

## 29. The Strategic Map Must Not Become Icon Soup

As quests, events, professions, PvP, Homesteads, social players, travel, lore, and services accumulate, showing every eligible icon at once will make the map unreadable.

AUREVANE therefore needs a first-class **Map Layers** control.

## 30. Core Map Layers

Recommended initial layer categories:

- **Tracked Objectives**;
- **Quests**;
- **Events**;
- **Settlements & Services**;
- **Travel Routes**;
- **Gathering & Resource Sites**;
- **Expeditions / Combat Locations**;
- **PvP / Nation Activity**;
- **Social / Party / Homestead**;
- **Lore / Discoveries**;
- **Custom Pins** if later supported.

Only layers relevant to implemented systems should appear.

## 31. Layer Behavior

Players can toggle categories on/off without changing world state.

The system should support:

- persistent player preferences;
- `Show All` / `Hide Optional` / `Reset` actions;
- sensible default visibility;
- current tracked objective overriding clutter carefully;
- zoom-aware clustering where several markers occupy one area;
- count/badge indicators for collapsed clusters;
- search/filter when the map becomes large.

## 32. Suggested Presets

Optional one-click presets can make the system easier:

### Adventure

Tracked quests, Expeditions, major events, travel.

### Gathering

Resource Sites + travel + relevant services.

### Social

Party/friends/allowed Homesteads + settlements.

### Clean Map

Major geography, capital/settlements, tracked objective only.

Presets are convenience; players may still customize individual layers.

## 33. Visibility Is Not Discovery

Turning on a layer must never reveal content the player has not legitimately discovered or become eligible to see.

Examples:

- a Level 1 Prospector cannot toggle on Level 5 hidden deposits;
- an undiscovered secret shrine does not appear because `Lore` is enabled;
- unreached story locations remain hidden;
- Event Staff-only/admin markers never leak through player layer controls.

The layer system filters **known/eligible map data**. It does not bypass discovery rules.

---

# PART X — COMPASS & COORDINATE GUIDANCE

## 34. Why Coordinates Exist

A compass/coordinate system helps players:

- describe locations to friends;
- orient themselves on large maps;
- follow straightforward quests;
- search an approximate area from a clue;
- communicate about gathering and events;
- navigate without every objective becoming an exact glowing waypoint.

## 35. Regional Coordinate System

Use a readable regional grid rather than real-world latitude/longitude.

Recommended presentation:

```text
FROSTMERE
N 42  /  E 17
```

or another compact N/S + E/W local coordinate notation.

Each region has an authored origin and grid scale. Coordinates are stable for player communication.

The map cursor and current-location panel may show coordinates when the region is known.

## 36. Compass Readout

When navigating, the player can also receive:

- cardinal direction;
- approximate bearing;
- approximate distance/range where allowed.

Example:

```text
Objective: northeast
Approx. 1.4 km / 3 map segments
```

The exact distance unit should fit AUREVANE's strategic-map abstraction rather than pretending the world is a continuous GPS simulation if it is not.

## 37. Three Quest Guidance Modes

Every quest/objective explicitly declares one of three guidance modes.

### A. TRACKED / BASIC

Use for ordinary accessible objectives where navigation is not the challenge.

May show:

- exact node/marker;
- map route;
- compass direction;
- coordinate;
- distance.

Examples: return to a known NPC, visit a known town, reach a public dungeon entrance.

### B. SEARCH AREA / APPROXIMATE

Use when exploration should matter but the player should not be directionless.

May show:

- approximate region/subregion;
- shaded search area;
- compass bearing;
- rough coordinate range;
- journal hint.

The exact target marker appears only after discovery or entering a configured reveal radius.

### C. HIDDEN / CLUE-LED

Use for secrets, mysteries, treasure, lore, special profession discoveries, and quests where finding the place is intentionally part of the gameplay.

May show:

- written/riddle/environmental hints;
- landmarks;
- NPC testimony;
- partial compass clues;
- no automatic target marker;
- no exact coordinate until legitimately discovered, if ever.

This preserves exploration.

## 38. Not Everything Is Trackable

The Journal must clearly communicate when an objective is intentionally not trackable.

Do not show a broken/empty tracking button that makes the player think the UI failed.

Example copy direction:

> **Location Unknown** — The journal contains the clues currently available. Explore the described area or gather more information.

## 39. Player Pins Do Not Grant Knowledge

If custom pins are later supported, a player may place a personal pin anywhere they can see on the known map.

A custom pin:

- grants no quest discovery;
- grants no hidden resource visibility;
- does not satisfy location objectives;
- does not bypass access rules.

Players may share coordinate knowledge socially, but server-side eligibility still controls what can actually be interacted with.

---

# PART XI — HOW THESE SYSTEMS CONNECT

## 40. Homestead + Professions

The Homestead supports the profession fantasy through:

- Workshop presentation;
- profession decoration;
- storage for materials;
- crafted-item displays;
- recipe/material planning;
- Trade House shortcut where appropriate.

It does not grant profession XP by existing.

## 41. Homestead + Events

Events can reward:

- themed decorations;
- trophies;
- banners;
- ambience/music unlocks;
- Chronicle displays.

Events should not destroy/raid Homesteads.

Map event markers remain independently toggleable through `Events` layer.

## 42. Homestead + Nations

The Homestead is a major expression of nation allegiance:

- nation architecture/theme;
- nation district;
- nation reputation decor;
- campaign trophies;
- capital proximity/travel.

Nation choice should influence style and social identity without creating a uniquely strongest Homestead bonus.

## 43. Map Layers + Gathering

Gathering professions can add many markers. Therefore Resource Sites default to a dedicated toggle and can use level/rarity/subtype filters later.

When Gathering mode is enabled, unrelated optional layers can dim or collapse to preserve readability.

## 44. Coordinates + Hidden Content

Coordinates are navigation infrastructure, not a promise that every quest exposes the target's coordinate.

Authoring tools must choose guidance mode deliberately so Content/Event Staff cannot accidentally reveal a secret objective by attaching a default map marker.

---

# PART XII — MASTER PANEL / AUTHORING NEEDS

## 45. Homestead Controls

Owner-authorized tooling eventually needs:

- nation Homestead Belt definitions;
- district/anchor definitions;
- layout/tier definitions;
- decoration catalog;
- decoration placement constraints;
- storage capacity tiers;
- access/privacy defaults;
- relocation policy;
- emergency disable for broken decoration/layout assets;
- Homestead inspection/recovery for support;
- no generic arbitrary edit of player Vault ownership.

Content Staff may receive permission to manage approved Homestead visual content without receiving storage/economy mutation rights.

## 46. Map Authoring Controls

World/content/event authoring should declare:

- marker category/layer;
- visibility prerequisites;
- zoom/clustering behavior;
- whether it may be tracked;
- guidance mode;
- exact marker versus search radius;
- coordinate visibility;
- spoiler/discovery requirements;
- start/end/event conditions.

## 47. Validation

Publishing must warn/block when:

- a supposedly hidden objective accidentally exposes an exact marker;
- a map marker references inaccessible content incorrectly;
- a Homestead anchor falls outside authored nation safe territory;
- a hostile ambient spawn table overlaps sovereign-safe territory;
- a decoration asset is missing/retired;
- storage capacity config would strand existing items;
- event markers violate spoiler/canon visibility rules.

---

# PART XIII — SECURITY & EXPLOIT PREVENTION

## 48. Homestead Security

At minimum:

- server-authoritative ownership;
- server-authoritative placement eligibility;
- atomic Vault deposit/withdrawal;
- no duplicate item ownership between carried inventory/Vault/Trade House/equipment;
- rate limiting on rapid layout mutations where needed;
- visitor permissions enforced server-side;
- no visitor withdrawal by default;
- no client-authored arbitrary asset IDs;
- relocation cannot duplicate storage;
- nation switch cannot preserve two active Homesteads;
- staff recovery actions audited.

## 49. Map Security

Do not send hidden map objects to the browser merely to hide them with CSS.

Player-facing map APIs should return only information the authenticated character is permitted to know at the relevant detail level.

This is especially important for:

- hidden quests;
- unreleased events;
- rare profession nodes;
- late-story locations;
- Event Staff preview markers;
- secret lore content.

---

# PART XIV — DEFINITION OF SUCCESS

These systems succeed when:

- a player feels that their character has a real home in their chosen nation;
- Homesteads are visually expressive but do not grant mandatory combat power;
- expanded storage makes collecting/crafting easier without creating duplication exploits;
- players can decorate with trophies from the rest of the game;
- thousands of Homesteads do not clutter or consume unique strategic-map land;
- nation territory feels safe and civilized, with no normal monster spawns in sovereign territory;
- nation switching preserves property safely without giving multiple active bases;
- the strategic map remains readable even after quests/events/gathering/social systems mature;
- players can toggle map information by category;
- map toggles never reveal undiscovered content;
- ordinary quests are easy to navigate;
- exploration quests can use approximate search areas;
- genuine secrets can remain clue-led and untracked;
- coordinates help communication without turning every mystery into GPS navigation.