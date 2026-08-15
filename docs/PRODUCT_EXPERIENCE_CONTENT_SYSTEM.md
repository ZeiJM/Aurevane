# AUREVANE — Product Experience, Circular Content & World Presentation System

**Status:** Authoritative product-experience and content-system specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/WORLD.md`, `docs/MASTER_PANEL.md`, `docs/PLAYER_MANUAL.md`, `docs/ART_BIBLE.md`, `docs/MEDIA_PIPELINE.md`, and `docs/COMBAT_AI_TRAINING.md`.

**Direction approved:** 2026-08-15.

AUREVANE must feel like a deliberately authored game world, not a collection of generated pages, generic fantasy cards, disconnected admin forms, or interchangeable AI-created content.

The project should learn from the strengths of long-running browser RPGs — persistent identity, dense but useful information, worlds that can be navigated from a browser, systems that feed into one another, and owner-operated content — while rebuilding those ideas with modern interaction design, stronger art direction, cleaner information hierarchy, deeper tactical systems, responsive presentation, and AUREVANE's own original world identity.

The central rule is:

> **Every important player-facing page, content object, world location, battle space, and Master Panel editor must have a clear purpose, a clear source of truth, intentional visual identity, and meaningful connections to the rest of the game.**

AUREVANE is not allowed to become “AI slop.” AI may accelerate implementation and media production, but it does not lower the standard for authored thought, originality, consistency, usability, or review.

---

## 1. Product Experience North Star

AUREVANE should feel like a **modern persistent fantasy game that happens to run in a browser**.

A player should be able to open the game and immediately feel:

- their character belongs to a real place;
- the world has geography, culture, weather, activity, history, and changing conditions;
- the screen is attractive without hiding important information;
- every major button leads to a system with substance;
- combat, world exploration, buildcraft, lore, economy, social systems, and progression reference the same underlying game state;
- content has distinctive names, mechanics, visuals, acquisition stories, and purposes;
- the game can grow for years without becoming a pile of disconnected special cases.

AUREVANE should **not** feel like:

- a SaaS dashboard with fantasy wallpaper;
- a mobile-game lobby filled with twenty promotional tiles;
- a generated wiki wrapped around combat;
- a sequence of identical cards with different names;
- a static map where every village is the same layout with a palette swap;
- an admin panel whose records do not cleanly drive the actual game;
- a game where balance values are copied manually into five different systems;
- a page generated because “a page probably belongs here” without a player purpose.

---

## 2. The Circular-System Principle

AUREVANE's major systems must form a **controlled content loop** rather than separate islands.

Conceptually:

```text
MASTER PANEL / AUTHORING
        ↓
VERSIONED CONTENT DEFINITIONS
        ↓
AUTHORITATIVE GAME SERVICES
        ↓
PLAYER GAMEPLAY / WORLD / COMBAT
        ↓
DISCOVERY / UNLOCK / OWNERSHIP / HISTORY
        ↓
PLAYER CODEX + MANUAL + UI PRESENTATION
        ↓
ANALYTICS / BATTLE REVIEW / ECONOMY / SUPPORT
        ↓
MASTER PANEL REVIEW / TUNING / NEW CONTENT
```

The same content identity should flow through all of these layers.

Example: an enemy called `emberglass_stalker` should not exist as unrelated handwritten copies in the encounter table, manual, Tactical Hall, AI system, loot system, and Master Panel.

It should have one stable registered identity whose related definitions can include:

- player-facing name and description;
- creature family;
- region/encounter availability;
- level/stat templates;
- combat loadout;
- AI profile;
- behavior tags;
- terrain preferences/interactions;
- loot/reward references;
- Tactical Record rules;
- lore/Archive references;
- art/audio references;
- manual/Codex visibility metadata;
- analytics tags;
- version/publish state;
- spoiler classification.

Different systems may own different pieces of that object, but they must join through stable IDs and explicit relationships rather than copied values.

---

## 3. One Source of Truth, Many Views

The player game, Master Panel, Codex/manual, AI, analytics, and support tools are **views over authoritative content and state**.

They are not separate databases of truth.

Examples:

### Discipline

The authoritative Discipline definition can feed:

- character creation/unlock logic;
- build editor;
- combat legality;
- AI usage rules;
- Mastery progression;
- Confluence validation;
- Tactical Hall opponent builds;
- player Codex/manual exact values;
- Master Panel editor;
- balance analytics;
- art/audio requests;
- patch-note impact;
- search.

### Item

The authoritative item definition can feed:

- inventory;
- equipment rules;
- drop tables;
- stores;
- crafting;
- marketplace eligibility;
- premium-commerce safety classification where applicable;
- Codex/manual;
- Master Panel editor;
- art registry;
- economy analytics;
- support/Owner grants;
- retirement/replacement logic.

### Region / Location

A location definition can feed:

- world map;
- local navigation;
- encounters;
- quests;
- NPCs;
- stores;
- music/ambience;
- weather;
- art themes;
- event eligibility;
- Tactical Records;
- lore sources;
- World Pulse;
- Master Panel world editor;
- analytics.

A content value should not be manually copied into another layer merely because that layer needs to display it.

---

## 4. Content Graph and Dependencies

AUREVANE should eventually maintain a lightweight **Content Graph** that knows important relationships between published objects.

Example:

```text
FROSTMERE PASS
  ├── uses environment kit: frostmere_high_pass_v3
  ├── uses ambience: frostmere_wind_low
  ├── contains encounter pool: frost_pass_day
  ├── contains encounter pool: frost_pass_storm
  ├── contains NPC: surveyor_elyra
  ├── unlocks Archive source: closed_star_waystone_03
  ├── may host event: white_road_anomaly
  └── links to expedition entrance: glass_crypt

FROST HOUND
  ├── creature family: frost_beast
  ├── AI profile: pack_hunter_v4
  ├── movement profile: quadruped_ground
  ├── prefers terrain tags: snow, rough
  ├── ability set: frost_hound_standard_v2
  ├── loot table: frost_beast_common
  ├── Tactical Record: frost_hound_record
  └── art kit: creature_frost_hound_v2
```

This graph gives the Master Panel useful answers before publication:

- What depends on this object?
- Where is it currently used?
- What player-facing pages will change?
- Will retiring it break a quest, encounter, item source, manual article, or Tactical Record?
- Which screenshots/manual entries may now be stale?
- Which live battles or Expeditions should remain pinned to an older version?

Do not build a giant abstract graph framework before it is needed. Introduce relationship indexing progressively as real content types arrive.

---

## 5. Content Lifecycle

Meaningful game content follows a controlled lifecycle.

Recommended states:

```text
DRAFT
  ↓
VALIDATED
  ↓
PREVIEW / STAGING
  ↓
PUBLISHED
  ↓
UPDATED THROUGH NEW VERSION
  ↓
RETIRED / ARCHIVED
```

Important rules:

- published content is versioned;
- history is retained;
- rollback restores a known valid version rather than deleting history;
- live encounters may pin the content version they started with when necessary;
- retirement does not silently destroy player-owned historical state;
- hidden/internal/test content is explicitly classified;
- spoiler-sensitive content never appears to unauthorized player clients merely because it exists.

---

## 6. Authoring Brief Before Content

Before a substantial content object is implemented, its authoring brief should answer:

1. **Why does this exist?**
2. **What player decision or feeling does it create?**
3. **Where does the player first encounter it?**
4. **How is it learned/unlocked/obtained?**
5. **How does it interact with existing systems?**
6. **What makes it mechanically distinct?**
7. **What makes it visually/audio distinct?**
8. **What information is initially hidden?**
9. **What Master Panel controls are required?**
10. **What manual/Codex/contextual-help content is required?**
11. **What analytics prove whether it is working?**
12. **What happens if it is disabled or retired?**

This applies especially to:

- Disciplines;
- Arts;
- Confluences;
- Soulmarks;
- enemies;
- bosses;
- items;
- equipment sets;
- quests;
- regions;
- settlements;
- important locations;
- Expeditions;
- terrain types;
- events;
- stores/vendors;
- crafting recipes;
- AI profiles;
- premium products.

A generated name plus generic description plus generic image is not complete content.

---

## 7. “No AI Slop” Production Standard

AI assistance is acceptable. Unreviewed generic output is not.

### Content must be rejected when it has signs such as:

- filler prose that says nothing specific;
- five objects with the same mechanic and different names;
- generic fantasy names without cultural or systemic grounding;
- descriptions that contradict mechanics;
- mechanically pointless locations;
- random stat blocks without role identity;
- obvious image-generation artifacts;
- generic hazy fantasy art with no navigational or cultural purpose;
- repeated architecture with only palette swaps;
- repetitive NPC dialogue voices;
- arbitrary lore added only to make text longer;
- UI cards duplicated until a page looks “full”;
- decorative effects that make information harder to read;
- systems added because another game has them rather than because AUREVANE needs them.

### Content approval requires intentionality

At minimum, a reviewer should be able to explain:

- what makes it AUREVANE;
- why the player should care;
- how it differs from nearby content;
- what game system it connects to;
- whether its visual/audio treatment supports that role;
- whether the experience remains clear and smooth.

“Generated successfully” is never an approval criterion.

---

## 8. Page Experience Contract

Every meaningful player-facing page needs a **Page Experience Contract**.

Before implementation, define:

```text
PLAYER INTENT
What question/task brings the player here?

PRIMARY ACTION
What is the most important thing they can do?

SECONDARY ACTIONS
What supporting actions belong here?

AUTHORITATIVE DATA
Which service/content/state owns what is shown?

VISUAL FOCUS
What art, map, character, object, or information should attract attention first?

WORLD IDENTITY
How does the screen feel like its location/system rather than a generic panel?

PROGRESSION AWARENESS
What is visible, hidden, locked, or recommended for this character?

FEEDBACK
How do hover, selection, loading, success, error, and disabled states communicate?

MEDIA
What art/audio/ambience/VFX is required?

HELP
What tooltip/manual/Codex link is available?

RESPONSIVE BEHAVIOR
How does this work on a narrow screen?

ACCESSIBILITY
Keyboard, screen reader, contrast, motion, audio alternatives.
```

A page is not done because its route renders and its database query works.

---

## 9. Game Shell Philosophy

AUREVANE may preserve the useful density of classic browser RPGs without inheriting their dated fixed-frame layout.

The modern shell should use:

### Persistent character context

A compact, elegant character HUD can make identity and important resources easy to inspect without monopolizing the viewport.

Useful persistent information may include:

- portrait/name/level;
- current Discipline;
- important HP/MP/state when contextually relevant;
- location;
- party/social state;
- concise notifications;
- quick access to character/build/inventory.

Do not show every character statistic at all times.

### Contextual navigation

Navigation should expose the systems relevant to the current context without turning the interface into a wall of permanent menu buttons.

Prefer:

- a stable global navigation layer;
- a compact character/action layer;
- contextual location/system actions;
- searchable/deep-linked secondary screens.

### Primary experience canvas

The largest visual area belongs to what the player is actually doing:

- world map;
- settlement;
- character/build;
- battle;
- Expedition;
- dialogue/story;
- marketplace;
- Tactical Hall;
- Master Panel when authorized.

Decorative chrome must never squeeze the actual game into a tiny rectangle.

---

## 10. Landing and Sign-Up Experience

The public entry experience should make AUREVANE desirable before the player understands its systems.

It should include, as appropriate:

- striking approved key art or a region/season visual;
- the AUREVANE identity/logo;
- concise game promise;
- immediate Create Character / Sign In path;
- a small number of compelling feature moments rather than an endless marketing page;
- tasteful motion/atmosphere;
- a memorable title theme or ambience when browser/user audio permission allows;
- obvious volume/mute control once audio is active;
- responsive mobile presentation;
- quick loading with heavy media progressively enhanced rather than blocking signup.

The landing page should not promise features that are not actually available in the current release.

Seasonal/live-world art can evolve over time while preserving the stable AUREVANE identity.

---

## 11. World Navigation Hierarchy

AUREVANE's world should feel large without requiring a continuously rendered 3D MMO.

Use a layered navigation hierarchy:

```text
WORLD ATLAS
   ↓
REGION
   ↓
SECTOR / ROUTE / DISTRICT
   ↓
SETTLEMENT / LANDMARK / WILDERNESS LOCATION
   ↓
LOCAL ACTIVITY / ENCOUNTER / INTERIOR / EXPEDITION
   ↓
TACTICAL BATTLE OR OTHER SYSTEM
```

The exact presentation may evolve, but the hierarchy should remain intuitive.

A player should always know:

- where they are;
- where they came from;
- where they can go;
- what is happening nearby;
- what is dangerous;
- what is locked and why;
- what is worth investigating.

---

## 12. World Atlas

The top-level world can use a stylized, interactive **Atlas** rather than a static list of regions.

Possible AUREVANE-native presentation:

- a slowly rotatable illustrated world sphere/planisphere;
- a 2.5D relief atlas;
- a layered celestial/cartographic device used by travelers in-world;
- region plates arranged around a central world projection.

The final direction should be prototyped for clarity and performance rather than chosen merely because another game uses a globe.

The Atlas should support:

- drag/keyboard/touch navigation;
- region hover/focus summaries;
- current-location indication;
- routes and travel availability;
- region danger/progression band;
- active world-event signals;
- party/friend context when appropriate;
- weather/world-state treatment;
- tasteful parallax/rotation/depth;
- fast transition into the selected region.

The Atlas should feel alive but remain easy to read.

---

## 13. Region Maps

Entering a region reveals a more detailed strategic view.

A region map may show:

- settlements;
- roads;
- passes;
- rivers/coasts;
- ruins;
- Expedition entrances;
- dangerous areas;
- faction/nation borders later;
- discovered secrets;
- active event areas;
- roaming elite/world-threat markers where appropriate;
- party/friend presence at a useful level of abstraction.

The map should not expose every hidden location immediately.

Discovery state matters.

World art and cartography must preserve recognizable landmarks so players develop mental geography rather than navigating only through UI labels.

---

## 14. Settlements and Local Maps

Settlements should feel like **places**, not lists of links.

A major village/city/town can use an illustrated navigable local scene or map where the player moves between meaningful districts, buildings, NPCs, and services.

Possible implementation styles include:

- richly illustrated 2D/2.5D district maps;
- navigable isometric scenes;
- layered painted environments with interactive hotspots;
- compact local tactical-style maps where appropriate.

The choice should depend on the location and gameplay purpose.

A settlement may expose:

- training/Tactical Hall;
- stores;
- crafting;
- inns/rest services if used;
- quest NPCs;
- guild/social spaces;
- archive/library;
- transport exits;
- event-specific changes;
- story-specific NPC/state changes;
- hidden or progression-gated locations.

The scene should communicate culture and function before the player reads labels.

---

## 15. No Carbon-Copy Settlements

Do not build every settlement from the same layout with a different background image.

Reuse technical systems, not identity.

Shared implementation can provide:

- hotspot components;
- navigation graph;
- camera/zoom behavior;
- tooltip patterns;
- map-marker rendering;
- parallax layers;
- weather overlays;
- NPC token patterns;
- transition logic.

But each important settlement requires its own authored:

- spatial composition;
- architectural logic;
- landmarks;
- material palette;
- vegetation/climate treatment;
- lighting identity;
- ambient sound;
- local prop language;
- cultural signage/iconography;
- meaningful services/activities;
- event-state variations.

AUREVANE should reuse **systems and kits**, not copy-paste places.

---

## 16. Controlled “Random Beauty”

Variation should make the world feel natural without making it visually incoherent.

Use deterministic or seeded **art-directed variation** for secondary detail such as:

- foliage clusters;
- stones/debris;
- puddles/snow drifts;
- banners;
- market clutter;
- smoke/fireflies/dust;
- weather intensity;
- ambient creatures;
- light pools;
- small decals;
- noncritical prop placement.

Variation must come from approved region/location kits with placement constraints.

Never randomize:

- essential paths;
- critical landmarks;
- interactable readability;
- quest-object positions in a way that breaks guidance;
- culturally important architecture;
- tactical information that must be deterministic.

The target is **natural irregularity inside authored composition**.

---

## 17. Environmental Storytelling

Locations should contain evidence of their history and use.

Examples:

- worn paths where people actually travel;
- different architecture across wealth/cultural districts;
- repaired damage after a siege;
- memorials after a world event;
- Closed Star iconography in locations where it makes historical sense;
- construction that reflects local climate;
- abandoned tools near former industry;
- vegetation reclaiming old ruins;
- subtle evidence that later gains meaning through the Archive.

Do not fill scenes with random “fantasy clutter” merely to increase detail.

Every prominent prop should either support:

- navigation;
- culture;
- history;
- mood;
- gameplay;
- story;
- scale.

---

## 18. World State Must Be Visible

When the living world changes, the presentation should change too.

A town under siege should not be identical except for a red badge reading `SIEGE ACTIVE`.

Where scope permits, live state can alter:

- sky/weather;
- ambience/music;
- NPC presence;
- banners;
- damaged/blocked routes;
- patrols;
- lighting;
- encounter markers;
- dialogue;
- local map overlays;
- environmental VFX;
- available services/quests;
- aftermath art/props.

Use composable variants rather than requiring a completely new illustration for every state.

---

## 19. Travel Should Be Smooth

World traversal should avoid unnecessary page friction.

Target behavior:

- clear hover/focus feedback before travel;
- short contextual transition rather than full visual reset where practical;
- optimistic presentation only when it cannot falsify authoritative state;
- preserved location breadcrumb/history;
- fast back navigation where appropriate;
- loading states that feel like part of the world;
- audio transitions coordinated through the Audio Director;
- state changes delivered without requiring full-page refreshes when the framework can update cleanly.

Do not add complexity merely to imitate a desktop game client. Browser-native strengths such as fast deep linking, responsive layout, and incremental rendering should be used deliberately.

---

## 20. Terrain Is a Gameplay System, Not Decoration

Combat terrain must have clear tactical identity.

The Master Plan already establishes terrain, elevation, hazards, and interactable spaces. This document makes the content requirement explicit: **terrain should change decisions**.

A terrain definition can describe concepts such as:

- movement cost by movement profile;
- whether Sprint/Charge/teleport/flying movement treats it differently;
- traction/slip rules;
- line-of-sight interaction;
- cover/concealment;
- elevation relationship;
- damage/status interaction;
- zone persistence;
- destructibility;
- transformation rules;
- AI valuation tags;
- VFX/SFX/footstep references;
- weather interaction;
- map-generation placement constraints.

---

## 21. Terrain Examples

Exact values belong to balance configuration, but examples of meaningful identity include:

### Road

- low/normal movement cost;
- reliable footing;
- fast route through otherwise rough terrain;
- tactically exposed in some maps.

### Mud

- increased movement cost for ordinary ground movement;
- may reduce effectiveness of some charge/dash patterns;
- heavy or specialized movement profiles may react differently.

### Shallow Water

- modest movement penalty for some units;
- can apply/expose `Wet` interactions where the rules say so;
- may interact with Conductive effects;
- should not automatically become a simplistic elemental weakness wheel.

### Deep Water

- strongly restricts ordinary ground movement;
- may require a bridge, special movement, swimming-capable unit, teleport, or authored rule;
- can create meaningful map lanes.

### Ice

- can alter stopping/traction or increase displacement risk in selected maps;
- Frost-capable effects may create or exploit it;
- Fire may transform/remove it according to explicit effect rules.

### Rubble

- slows movement;
- may provide partial obstruction/cover;
- may be created by destroyed structures.

### Tall Vegetation / Dense Brush

- can affect sight/concealment when the map calls for it;
- may be burned, cut, displaced, or ignored by particular movement profiles if explicitly supported.

### Lava / Burning Ground

- visible severe hazard;
- damage or status on entry/end-turn according to rule;
- must be clearly previewed before commitment.

### Magical Zones

- system-defined behavior;
- strong visual language;
- never ambiguous about which tiles are affected.

---

## 22. Terrain Interaction Rules

Terrain effects must be:

- server-authoritative;
- previewable before normal player commitment where rules permit;
- deterministic under the battle seed/version;
- shared by player and AI legality systems;
- testable as reusable rule primitives;
- visually distinguishable;
- documented in contextual help/manual;
- configurable/versioned where practical.

Do not write separate terrain logic into individual ability components.

Arts should call the shared effect/terrain engine.

---

## 23. Terrain Transformations

AUREVANE can use controlled terrain transformation for tactical depth.

Examples:

```text
Frozen Ground + Fire effect → Melt / Wet state
Oil-like Alchemical Zone + Fire → Burning Zone
Stone Rise → new obstacle/elevation geometry
Destroyed Wall → Rubble
Floodline → Shallow Water lane
Mist Veil → temporary sight-modifying zone
False Terrain → perception/illusion rule defined by Veilweaver
```

Transformations need:

- explicit precedence rules;
- bounded duration/lifetime;
- deterministic resolution;
- clear visual transition;
- AI awareness;
- Battle Review/event logging;
- performance-safe implementation.

Do not create an uncontrolled combinatorial chemistry simulation.

---

## 24. Terrain and AI

Combat AI must use the same authoritative terrain data as players.

Higher intelligence grades may reason better about:

- path cost;
- chokepoints;
- hazard exposure;
- cover;
- elevation;
- movement-art shortcuts;
- displacement into dangerous tiles;
- terrain creation/destruction;
- team positioning around zones.

AI must not gain secret terrain information that its knowledge policy would not legitimately provide.

Tactical Hall scenarios should eventually include dedicated terrain drills.

---

## 25. Combat Screen Experience

The tactical battlefield is one of the game's highest-value visual surfaces.

It should prioritize the board rather than surrounding it with permanent UI clutter.

Recommended hierarchy:

### Primary

- tactical board;
- selected actor;
- target/path/AoE preview;
- hazards/objectives;
- current turn/decision state.

### Immediate secondary

- turn order;
- selected-unit HP/MP/status;
- compact action bar;
- current Art details;
- predicted outcome;
- end/confirm/cancel controls.

### Contextual

- inspect panel;
- terrain details;
- status definitions;
- combat log;
- party communication;
- Battle Review information after battle;
- advanced tooltips.

Do not permanently dedicate large sidebars to information the player needs only occasionally.

---

## 26. Combat Forecast Quality

Before a committed action, show enough information to make tactical planning feel fair.

Depending on the action:

- valid/invalid target state;
- movement path and cost;
- remaining movement;
- range/line of sight;
- hit chance;
- damage/healing range;
- statuses likely/applied;
- displacement endpoint;
- affected terrain/zones;
- facing outcome;
- reaction risk when the rules allow it to be known;
- objective consequence.

The interface should explain *why* an action is invalid instead of merely disabling it.

---

## 27. Combat Art and Readability

Battle maps should look beautiful while remaining strategically legible.

Use:

- authored environment kits;
- strong foreground/board separation;
- clear traversable tile geometry;
- visible height edges;
- landmarks that establish map identity;
- restrained ambient animation;
- readable combatants at all zoom levels;
- impact VFX that resolve quickly enough to restore board clarity;
- contextual camera/pan/zoom without disorienting the player.

Do not fill battle maps with decorative objects that make valid tiles ambiguous.

---

## 28. Content Pages and Codex Pages

Pages for Disciplines, Arts, Soulmarks, Confluences, enemies, items, statuses, regions, bosses, and other systems should feel like **game content**, not raw database tables.

A content page may combine:

- strong approved visual;
- concise fantasy identity;
- exact mechanical data from authoritative definitions;
- acquisition/discovery information appropriate to the player;
- interactions/synergies;
- progression state;
- related content;
- Tactical Hall link where unlocked;
- world source/location links where appropriate;
- patch/change history when useful;
- manual deep link for deeper explanation.

The visual and narrative explanation is curated; exact numbers and unlock rules should come from authoritative structured data where practical.

---

## 29. Discovery-Aware Catalogs

AUREVANE should not automatically expose every future content object in a public “database.”

Catalog entries can have states such as:

```text
HIDDEN
RUMORED
DISCOVERED
KNOWN
MASTERED / OWNED / STUDIED where applicable
```

Exact states vary by content type.

Examples:

- an unreleased boss does not appear at all;
- a rumored monster may show silhouette and region clue but not mechanics;
- a newly encountered enemy may expose basic public information;
- a studied Tactical Record may reveal deeper behavior information;
- an undiscovered Confluence remains hidden according to its discovery rules;
- an item seen but not acquired can have partial Codex information if desired.

This creates discovery without forcing players to use an external wiki.

---

## 30. Master Panel as the Authoring Backbone

The Master Panel is the operational authoring surface for these systems.

As underlying game systems arrive, the panel should gain controlled editors for:

- Disciplines;
- Arts;
- Traits;
- Reactions;
- Movement Arts;
- Confluences;
- Soulmarks;
- statuses;
- terrain;
- movement profiles;
- enemies;
- AI profiles;
- bosses;
- encounters;
- regions;
- routes/nodes;
- settlements/local maps;
- NPCs/dialogue;
- quests;
- Expeditions/rooms/modifiers;
- items/equipment sets;
- loot/reward tables;
- stores/vendors;
- crafting;
- events;
- Tactical Records;
- manual/Codex presentation metadata;
- media/audio references;
- premium products where commerce-safe.

Do not create editors for systems that do not yet exist.

---

## 31. Unified Editor Pattern

Different editors should share a consistent workflow even when their fields differ.

Recommended pattern:

```text
IDENTITY
  ↓
GAMEPLAY / BEHAVIOR
  ↓
ACQUISITION / AVAILABILITY
  ↓
RELATIONSHIPS / DEPENDENCIES
  ↓
PLAYER PRESENTATION
  ↓
ART / AUDIO
  ↓
SPOILER / VISIBILITY
  ↓
ANALYTICS / TELEMETRY TAGS
  ↓
VALIDATE
  ↓
PREVIEW / TEST
  ↓
DIFF
  ↓
PUBLISH / SCHEDULE
```

This gives staff a coherent mental model instead of a dozen unrelated admin applications.

---

## 32. Acquisition Rules Are First-Class Data

Content editors should define **how something enters player reality**.

Possible acquisition/unlock sources include:

- character creation;
- level/progression milestone;
- Discipline Mastery;
- mentor quest;
- story state;
- boss/Expedition clear;
- region discovery;
- Tactical Record progression;
- drop table;
- vendor;
- crafting;
- event;
- guild/nation progression later;
- support/Owner override;
- premium commerce only when classified as commerce-safe.

The player-facing UI should be able to explain legitimate known acquisition paths without hardcoding separate text.

Hidden paths can remain spoiler-gated.

---

## 33. Impact Preview Before Publish

Before publishing a meaningful change, the Master Panel should eventually show an **Impact Preview**.

Examples:

Changing an Art can show:

- Disciplines using it;
- AI profiles that reference it;
- Confluences affected;
- current builds using it;
- manual/Codex entries affected;
- benchmark simulations to rerun;
- active content versions that will remain pinned.

Retiring an enemy can show:

- encounter pools containing it;
- quests requiring it;
- Tactical Records linked to it;
- loot sources that would disappear;
- Archive entries linked to it;
- events that reference it.

A dangerous dependency should be blocked or require an explicit modeled migration, not silently broken.

---

## 34. Content Preview and Test Character

Authorized staff need to see content **as a player would see it** before publication.

Preview tools can eventually support:

- choose environment: staging/preview;
- choose test character;
- set legitimate preview progression state;
- use Owner-only exceptional QA state where appropriate;
- open a specific page/location;
- preview locked/unlocked/rumored/hidden variants;
- launch a test battle;
- run an AI simulation;
- inspect responsive desktop/mobile presentation;
- preview audio/ambience transitions;
- validate missing media;
- validate missing manual/contextual help.

This is safer than publishing and then checking production.

---

## 35. Content Completeness Validation

A content object can declare required relationships before publication.

Examples:

A playable Discipline may require:

- name/description;
- valid progression/unlock rule;
- Innate;
- required Arts;
- Ultimate;
- AI usage metadata;
- icon;
- presentation art request/approved asset according to phase;
- audio/VFX requests where needed;
- manual/Codex metadata;
- Confluence completeness status;
- tests.

A major enemy may require:

- stat template;
- ability set;
- AI profile;
- creature family;
- encounter source;
- reward references;
- visual asset;
- audio hooks;
- Tactical Record policy;
- manual/Codex visibility;
- benchmark scenario.

A major settlement may require:

- map/navigation graph;
- art/environment kit;
- music/ambience;
- exits/routes;
- NPC/service placements;
- responsive presentation;
- empty/error/loading behavior;
- event/world-state integration;
- manual/navigation help where needed.

The validator prevents “half-content” from accidentally becoming live.

---

## 36. Manual and Game Database Relationship

The Player Manual remains explanatory and curated.

The player Codex/database is discovery-oriented and content-specific.

They should cooperate:

### Manual

Explains:

- how systems work;
- strategy concepts;
- rules;
- tutorials;
- examples;
- troubleshooting.

### Codex / Known Content

Shows:

- the player's known Disciplines;
- known Arts;
- known Soulmarks;
- discovered Confluences;
- encountered enemies;
- statuses;
- known terrain;
- regions/locations;
- items;
- Archive sources;
- Tactical Records;
- bosses after appropriate discovery.

Both should render exact current values from authoritative content when practical.

Neither should contain manually duplicated balance numbers unless there is a compelling reason.

---

## 37. Content Search

AUREVANE should eventually have useful player-facing search across known content.

Examples:

- “bleed” can find known Arts, statuses, equipment, Confluences, enemies, and manual explanations;
- “Frostmere” can find the region, discovered locations, quests, known enemies, Archive sources, and travel entry;
- “rear attack” can find combat help, relevant Arts, and Battle Review concepts.

Search respects:

- spoiler visibility;
- player discovery;
- content publication state;
- staff/owner permissions.

Do not send the full hidden content catalog to the browser and merely hide results in the UI.

---

## 38. Audio as Spatial/System Identity

Music and ambience should reinforce where the player is and what they are doing.

Examples:

- title/landing;
- world Atlas;
- each major region;
- settlement;
- wilderness danger;
- Tactical Hall;
- battle;
- boss;
- Expedition depth;
- World Event;
- victory/defeat.

Location changes should transition through the central Audio Director.

Important settlements, factions, bosses, and narrative arcs can reuse leitmotifs across contexts.

The world should still be fully usable muted.

---

## 39. Media Density Rule

“Nice art everywhere” does not mean downloading a bespoke painting for every button.

Spend custom visual effort where players perceive identity:

- landing/title;
- region/settlement hero views;
- important NPCs;
- Disciplines;
- Soulmarks;
- bosses;
- major enemies;
- legendary items;
- story/event moments;
- Expedition themes;
- Tactical Hall identity;
- major manual diagrams.

Use reusable high-quality systems for:

- frames;
- panels;
- map markers;
- minor icons;
- terrain tile families;
- particles;
- status treatment;
- common cards;
- loaders;
- transitions.

The Art Bible and Media Pipeline remain authoritative for approval and provenance.

---

## 40. Responsive Design Is Not “Shrink Desktop”

Desktop can support more persistent context and richer simultaneous information.

Mobile/narrow screens should:

- preserve the primary activity;
- move secondary information into drawers/sheets/tabs;
- keep action targets large enough;
- avoid tiny tactical controls;
- support touch pan/zoom for maps/battles;
- preserve keyboard/controller-like navigation concepts on desktop where applicable;
- avoid hover-only essential information.

Each major gameplay screen needs an intentional responsive composition.

---

## 41. Interaction Quality Standard

Common interactions should feel consistent across the game.

Every interactive element needs appropriate states:

- idle;
- hover where supported;
- focus;
- pressed;
- selected;
- loading;
- disabled with explanation where useful;
- success;
- error.

Important actions should give immediate feedback.

Avoid:

- click with no visible response;
- unexplained disabled controls;
- full-page reload for ordinary local navigation when unnecessary;
- loading spinners with no context for long operations;
- tiny invisible hit areas;
- inconsistent back behavior;
- hidden irreversible actions.

---

## 42. Smoothness and Performance

Beautiful presentation cannot justify a sluggish game.

Page budgets should consider:

- initial JS/hydration;
- image size;
- audio preload;
- map layers;
- animation count;
- realtime subscriptions;
- query count;
- mobile memory;
- transition latency.

Use progressive enhancement:

- core interaction works quickly;
- secondary art loads afterward where appropriate;
- heavy visual layers are lazy or conditional;
- low-power/reduced-motion settings remain usable;
- the browser does not download every region/settlement asset at login.

---

## 43. Empty, Locked, Loading and Failure States Are Designed States

Every important page should answer what happens when:

- the player has no records yet;
- the system is locked;
- the server is loading;
- content failed to load;
- a referenced feature is disabled;
- an event ended;
- a record was retired;
- the player has insufficient permission;
- media is temporarily unavailable.

These states should use AUREVANE tone and clear recovery instructions rather than raw error text.

Do not invent fake data to make an empty page look populated.

---

## 44. Ownership, Discovery and Access Are Separate

The architecture should distinguish:

- **exists in game content**;
- **published**;
- **visible to this player**;
- **discovered/known by this character/account**;
- **unlocked/eligible**;
- **owned**;
- **equipped/active**;
- **available in this mode**.

These are not interchangeable.

Example:

A player may know an item exists but not own it.

A player may own an item but be unable to equip it.

A player may have encountered a boss but not unlocked its full Tactical Record.

A Confluence may exist internally but remain undiscovered.

Keeping these states separate prevents future content and spoiler bugs.

---

## 45. No Fake Complexity

Depth comes from interacting meaningful systems, not from adding more fields to every page.

Prefer:

- fewer strong choices;
- systems that interact;
- clear presentation;
- deeper optional inspection;
- progressive disclosure;
- contextual information.

Avoid:

- fifteen permanent currencies;
- dozens of tabs for trivial settings;
- separate pages that could be one coherent workflow;
- huge stat sheets before the player needs them;
- administrative concepts exposed directly to players;
- nested menus created only because the database is normalized that way.

Database shape does not dictate player information architecture.

---

## 46. Originality Guardrail

Reference games can be studied for abstract lessons such as:

- persistent character context;
- navigable world hierarchy;
- dense browser-game information;
- integrated manuals/databases;
- owner-driven content systems;
- tactical combat presentation.

AUREVANE must not copy another game's:

- exact page layout;
- frame proportions;
- menu placement;
- map artwork;
- world shape;
- iconography;
- characters;
- terminology;
- combat UI arrangement;
- code;
- written descriptions;
- music;
- proprietary content data.

The standard is **learn the design lesson, then solve the problem in AUREVANE's own way**.

---

## 47. Implementation Architecture

The circular system should emerge from clean boundaries.

Conceptually:

```text
VERSIONED CONTENT REGISTRY
  ├── disciplines / arts / confluences / soulmarks
  ├── enemies / AI / bosses
  ├── terrain / encounters
  ├── world / locations / NPCs / quests
  ├── items / rewards / stores / crafting
  ├── events / seasons
  └── presentation metadata / media references

SERVER DOMAIN SERVICES
  ├── progression
  ├── combat
  ├── world
  ├── rewards/economy
  ├── content discovery
  ├── Tactical Records
  └── support/operations

PLAYER SURFACES
  ├── game shell
  ├── world Atlas / local maps
  ├── character/build
  ├── battle
  ├── Codex/manual
  ├── Tactical Hall
  └── social/economy/etc.

MASTER PANEL
  ├── edit
  ├── validate
  ├── preview
  ├── impact analysis
  ├── publish
  ├── rollback
  └── analytics
```

Do not create one enormous universal `content` table or one giant JSON document.

Use typed domain-specific schemas with stable cross-references and shared publishing/version concepts.

---

## 48. Phase 0 — Experience Foundation

Phase 0 establishes reusable product-quality primitives only.

Requirements include:

- design-system foundations;
- responsive shell primitives;
- media registry;
- Audio Director foundation;
- loading/error/empty-state patterns;
- accessible interaction states;
- Page Experience Contract as a planning requirement for future major screens;
- stable media/content identifiers where already needed.

**Do not retroactively expand a completed or active Phase 0 ticket merely because this document now exists.** Future tickets inherit the standard.

---

## 49. Phase 1 — Character and Content Identity Foundation

As character progression becomes real:

- establish reusable content identity/version conventions for character-facing systems;
- build character/profile pages around a clear Page Experience Contract;
- begin the player Codex/known-content shell where useful;
- ensure level/attribute/Discipline data can feed both gameplay and explanatory surfaces;
- establish acquisition/visibility concepts cleanly rather than hardcoding UI checks;
- create the first polished contextual-help/manual links;
- ensure character HUD information remains concise and extensible.

---

## 50. Phase 2 — Combat, Terrain and Battle Presentation

When tactical combat arrives:

- implement terrain as authoritative data/rules rather than visual flavor;
- add movement-cost and movement-profile interaction where designed;
- implement cover/elevation/hazard/zone previews;
- implement terrain transformation through shared effect primitives where scoped;
- make player and AI legality consume the same terrain rules;
- build the battle screen around board-first information hierarchy;
- provide excellent action/movement forecasts and invalid-action explanations;
- establish combat-map environment kits and map readability checks;
- add contextual terrain/status help;
- ensure battle versions pin relevant content/AI versions.

The combat screen must be playtested for clarity before ornamental polish is considered complete.

---

## 51. Phase 3 — Buildcraft Content Loop

When Disciplines/Confluences/Soulmarks arrive:

- formalize versioned content records and stable references;
- make exact values render from authoritative definitions;
- introduce content completeness validation;
- connect AI usage metadata;
- connect art/audio/media requirements;
- connect manual/Codex visibility metadata;
- connect acquisition/unlock rules;
- connect analytics tags;
- add Master Panel editor foundations only as required by the implemented systems;
- ensure hidden/undiscovered build content remains server-gated.

---

## 52. Phase 4 — Content Quality and Catalog Depth

With the first substantial Discipline/enemy set:

- apply the full authoring brief to each meaningful content package;
- expand discovery-aware Codex surfaces;
- run a deliberate duplicate/filler-content review;
- establish visual kits for Discipline and enemy families;
- create benchmark encounter/map packages;
- ensure AI behavior actually reflects the authored role;
- ensure acquisition paths are intentional;
- verify no content exists only to inflate a count.

The Closed Alpha Discipline/enemy counts are targets, not permission to lower content quality.

---

## 53. Phase 5 — World Atlas, Regions, Settlements and Circular Live Content

Phase 5 is where the world presentation becomes a major product pillar.

Implement progressively:

- World Atlas prototype and chosen production direction;
- region map hierarchy;
- routes/nodes/discovery;
- settlement/local-map framework;
- first authored settlement layouts;
- region environment kits;
- controlled art-directed variation;
- weather/world-state visual layers;
- location music/ambience;
- smooth travel/transitions;
- character/location context HUD;
- nearby-player representation appropriate to map scale;
- world-state/event overlays;
- quest/NPC/store/Tactical Hall links from actual locations;
- discovery-aware world Codex entries;
- world content relationships visible in Master Panel;
- event/story changes that visibly alter world presentation;
- first practical dependency/impact checks for region/node/quest/event content;
- preview-as-character/location workflows for world/story staff.

At least one starter-region vertical slice should demonstrate:

```text
Atlas → Region → Settlement → NPC/Service → Wilderness/Encounter → Tactical Battle → Return
```

with coherent art, audio, progression, help, and persistent state.

---

## 54. Phase 6–8 — Multiplayer and High-Value Activity Pages

As parties, Expeditions, and PvP arrive:

- preserve Page Experience Contracts for party finder, Expedition planning, active Expedition, queues, ranks, tournaments, and results;
- ensure each activity has distinct visual identity without inventing new UI conventions every time;
- connect content definitions to manual/Codex and Master Panel controls;
- extend terrain/environment kits into co-op and PvP maps;
- ensure active events can alter presentation through approved content references rather than custom code forks.

---

## 55. Phase 9–12 — Scale Without Content Slop

As the roster, social world, economy, and nations expand:

- use content completeness validators to prevent half-authored additions;
- expand dependency/impact previews;
- keep acquisition rules explicit;
- keep economy/vendor/drop/crafting relationships inspectable;
- maintain unique cultural/environment identity across nations/regions;
- prevent cloned settlement layouts and repetitive enemy kits;
- ensure new content strengthens existing loops rather than only adding another menu item;
- expose useful content analytics without turning design into metrics-only optimization.

---

## 56. Phase 13 — Complete Content Operations System

The complete Master Panel should consolidate the circular model with:

- comprehensive domain editors;
- dependency graph / usage lookup;
- impact preview;
- content completeness validation;
- preview-as-player/test-character;
- battle/AI simulation hooks;
- responsive page preview where relevant;
- media status/provenance;
- manual/Codex impact;
- discovery/spoiler visibility controls;
- acquisition/source inspection;
- publish/schedule/rollback;
- diff/history;
- analytics;
- missing-content/media/manual warnings;
- safe retirement/migration workflows.

The Owner should be able to answer:

> “If I change, add, disable, retire, or rebalance this thing, what else in the game will it affect?”

without manually searching the database or source repository.

---

## 57. Phase 14 — Presentation Production Pass

Phase 14 should not be the first time the game becomes attractive.

It is the dedicated final production pass for:

- final region/settlement art;
- map texture/detail refinement;
- unique landmarks;
- environment variation kits;
- combat-map polish;
- character/Discipline/Soulmark/boss art;
- UI animation/transitions;
- responsive polish;
- audio/ambience/leitmotif completion;
- manual/Codex illustration;
- landing/title presentation;
- seasonal/event presentation packages;
- consistency review across every major page.

Reject anything that reads as generic AI-generated filler even if it is technically complete.

---

## 58. Phase 15 — Experience Hardening

Before broad production readiness, review:

- page loading/performance;
- mobile layout;
- keyboard/accessibility;
- map input/zoom/pan;
- terrain rule correctness;
- AI terrain use;
- world travel state consistency;
- content dependency integrity;
- retired/disabled content behavior;
- spoiler/data leakage;
- content version pinning;
- Master Panel publication safety;
- broken media references;
- stale manual/Codex data;
- audio transitions;
- error/empty/locked states;
- visual duplication/content-slop review;
- cross-browser behavior.

---

## 59. Vertical-Slice Quality Gate

Before claiming a major feature family is production-quality, run an end-to-end vertical-slice review.

For example, a new enemy package is not complete until the relevant subset exists coherently:

```text
Authoring definition
→ encounter source
→ world presentation
→ combat loadout
→ AI behavior
→ terrain interaction
→ rewards
→ discovery/Codex
→ Tactical Record policy
→ art/audio
→ analytics
→ Master Panel operations
→ manual/contextual help
```

Not every system must exist in early phases, but the implemented layers must connect cleanly and leave explicit future hooks rather than duplicate placeholders.

---

## 60. Player-Experience Review Checklist

Every major screen/content vertical should be reviewed for:

- **Purpose:** Is the player's reason for being here obvious?
- **Hierarchy:** Is the most important thing visually dominant?
- **Depth:** Are there meaningful decisions/interactions?
- **Clarity:** Can the player understand state and consequences?
- **Identity:** Does it feel specific to AUREVANE/system/location?
- **Originality:** Is it clearly not copied from a reference game?
- **Content quality:** Is there filler or generic generated material?
- **Art:** Are visuals intentional, approved, and useful?
- **Audio:** Does sound/music enhance the context without being required?
- **Smoothness:** Are transitions and interactions responsive?
- **Complexity:** Is depth hidden progressively rather than dumped at once?
- **Mobile:** Is the narrow layout intentionally designed?
- **Accessibility:** Can the experience be used without hover, sound, color-only cues, or excessive motion?
- **Data integrity:** Are exact values sourced authoritatively?
- **Discovery:** Is hidden/locked content handled correctly?
- **Operations:** Can staff safely manage the system when its roadmap phase requires it?
- **Documentation:** Can a player understand the system without an external wiki?
- **Performance:** Is the beauty affordable on normal hardware/network conditions?

A feature that fails these checks is not “done” merely because tests pass.

---

## 61. Definition of Success

This direction succeeds when:

- AUREVANE's pages feel deliberately designed rather than generated;
- the game has a recognizable modern visual/interaction identity;
- the world feels geographic, inhabited, varied, and beautiful;
- major settlements are memorable instead of reskins;
- terrain materially changes tactical decisions and is clearly previewed;
- combat is visually rich while remaining easier to read than older browser-RPG battle interfaces;
- players can learn exact rules from the game itself;
- discovering content feels meaningful because unreached content is not all exposed at once;
- the Master Panel genuinely drives the same content used by gameplay;
- changing content exposes its dependencies and impact;
- art, audio, manual, AI, acquisition, analytics, and gameplay reference the same stable content identities;
- new content can be added without routine code edits but still passes real review and validation;
- AI assistance increases production speed without lowering originality or quality;
- the game remains deep without becoming needlessly complicated;
- a player can move from landing page → character → world → location → activity → combat → rewards → Codex/build improvement and feel that it is one coherent game rather than separate web pages.