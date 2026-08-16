# AUREVANE — Visual Experience Evolution Roadmap

**Status:** Binding extension of `docs/ROADMAP.md` for visual-direction maturation.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/ART_BIBLE.md` defines visual quality and identity. `docs/VISUAL_EXPERIENCE_EVOLUTION.md` refines the intended finished value/color/world-integration direction. This document defines **when** that visual evolution should enter implementation without turning every early engineering ticket into a full art-production pass.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **Do not freeze the current dark development shell into the final game, but do not derail foundational implementation with a premature cosmetic rewrite either.**

AUREVANE should evolve from a functional development shell into a luminous, illustrated, world-aware adventure interface as real regions, locations, characters, battle scenes, items, and production assets become available.

---

## 1. Cross-Cutting Rule — Architecture Must Not Assume Darkness

Starting immediately, new reusable player-facing components should avoid assumptions such as:

- text is always white;
- page background is always near-black;
- every panel uses the same dark navy surface;
- borders only work on dark backgrounds;
- icons are only legible against black;
- focus rings only work on dark surfaces;
- media always sits behind a dark scrim;
- semantic colors were tuned for one background value.

This does **not** require current screens to be redesigned immediately.

It requires the design system to remain capable of supporting approved light, midtone, and dark contexts later.

Every major reusable UI primitive should be able to evolve through centralized tokens rather than requiring a page-by-page rewrite.

---

## 2. Phase 1 — Preserve Scope, Prepare the Design System

Phase 1 remains Character Foundation.

Do not stop character/progression implementation to perform a final-world visual redesign before the world exists.

However, Phase 1 should preserve future visual flexibility through:

- centralized semantic surface/text/border/focus tokens;
- media slots that can accept real portrait/environment art later;
- responsive layouts that do not depend on giant empty dark margins;
- components that remain legible on more than one approved value family;
- loading/error/empty states capable of receiving contextual imagery later;
- no new hard-coded universal dark palette assumptions;
- traceable art requests for player-facing milestones where representative quality matters;
- explicit acknowledgement in design review that the current shell is developmental, not the final visual ceiling.

### Phase 1 visual gate

Phase 1 is not required to look like the mature living world.

It **is** required to avoid architectural choices that make the mature living world expensive or impossible to introduce later.

---

## 3. Phase 2 — Combat Proves Bright and Dark Battlefield Readability

Phase 2 introduces the first true gameplay canvas: tactical combat.

The combat vertical slice should demonstrate that the battle interface works against a **real environment scene**, not only a dark test backdrop.

At least one representative battle scene used for PV-1 should exercise a light or midtone environment where practical so targeting/overlays are not accidentally tuned only for darkness.

Visual integration should include:

- environment art/material context;
- battle-scene lighting;
- terrain readable against environment color;
- Command Deck/rails that harmonize with the scene without disappearing;
- semantic target/path/hazard overlays readable on bright and dark tiles;
- portraits/icons with appropriate light/dark variants or framing;
- VFX that remain readable without globally dimming the entire board;
- responsive image/scene performance.

### Phase 2 anti-pattern

Do not make every battle permanently dark simply because it makes glowing spell effects easier to see.

Tactical clarity must survive daylight.

---

## 4. Phase 3 — Character-Build Visual Identity

When Disciplines, Legacy, Soulmarks, Confluences, Reactions, Movement Arts, and saved builds become real, begin moving character-facing screens away from generic system panels.

Add progressively:

- Discipline visual kits;
- Current versus Legacy source identity;
- Soulmark sigils/material language;
- Confluence visual interaction language;
- improved character/profile portrait integration;
- Armory/build composition that feels like equipment/build preparation rather than settings;
- item/equipment art integration;
- stronger build-change feedback;
- light/midtone/dark component validation across character surfaces.

### Phase 3 visual gate

A player should be able to look at two meaningfully different builds and see—not only read—that they express different combat identities.

---

## 5. Phase 4 — First Playable Discipline Set / Representative Production Quality

As the roster expands, visual production must become systematic.

Each representative Discipline requires enough approved art/audio identity to validate the final direction:

- icon family;
- portrait/character representation where appropriate;
- VFX language;
- motion language;
- color/material accents;
- Confluence compatibility;
- item/equipment presentation;
- readable light/dark variants where required.

Do not wait for all 16 alpha-target Disciplines before validating whether the character/build presentation feels premium.

Use a small representative subset at near-production quality first, then scale the pipeline.

---

## 6. Phase 5 — Major Visual Evolution Milestone: The Living World Arrives

**Phase 5 is the first major intentional transition away from the dark development-shell feel.**

This is the correct time because real locations, towns, NPCs, maps, quests, weather, events, and world states finally exist.

Phase 5 should introduce the first coherent **Luminous Adventure Shell** across real world-facing gameplay.

### Required direction

- world map with authored geographic/cartographic identity;
- region/location establishing art;
- settlement visual identity;
- region-aware color/material context;
- important NPC portrait presentation;
- illustrated/contextual quest presentation;
- weather and environment state;
- ambient art/audio layers;
- World Pulse integrated with world identity rather than a generic notification dashboard;
- daytime/bright-location presentation where fiction supports it;
- event-state visual changes;
- location-linked battle scene continuity;
- meaningful travel/arrival transitions without artificial delay;
- map/landmark imagery that creates curiosity and orientation.

### Phase 5 composition rule

When a player arrives in a settlement or region, the screen should first communicate **place**, then systems.

A town should not visually read as the same dark shell with `Town Name` changed at the top.

### Phase 5 validation

Use representative testers to ask:

- Can they tell where they are without relying entirely on text labels?
- Does the world feel inhabited?
- Does the UI feel integrated with the location?
- Does the game still feel information-rich without feeling like a dashboard?
- Do bright/midtone surfaces remain readable on laptop and phone?
- Are artwork and ambient motion helping rather than distracting?

If Phase 5 still feels primarily like a dark web application, address that before multiplying regions.

---

## 7. Phase 6 — Co-op / Shared Adventure Presence

When parties arrive, strengthen the feeling that players are adventuring **together inside a place**.

Add where appropriate:

- party portraits/identity;
- shared location context;
- party-ready/travel presentation;
- co-op battle rail integrated with the current battle scene;
- restrained social presence in world spaces;
- party transition/reconnect treatment that preserves location identity.

Avoid turning co-op into another floating panel stack over a black background.

---

## 8. Phase 7 — Expeditions / Adventure Escalation

Expeditions are a major opportunity for visual variety and atmosphere.

Develop:

- Expedition entrance/route identity;
- modular environment kits with real regional/material differences;
- escalating environmental mood;
- map/reveal presentation;
- camp/rest/preparation surfaces where design requires them;
- boss arenas with distinctive lighting/composition;
- weather/hazard variants;
- Deep Expedition visual escalation;
- Unmoored/possibility distortion reserved for appropriate late contexts;
- reward presentation that reflects the journey.

Darkness is allowed—and often valuable—in dangerous Expedition content, but contrast with brighter overworld experiences should make that darkness more effective.

---

## 9. Phase 8 — PvP / Competitive Clarity Without Sterility

PvP presentation should prioritize fairness and instant readability, but need not become a sterile esport dashboard.

Use:

- recognizable arena/region identity;
- clean initiative/timer information;
- stable semantic colors;
- readable player portraits/build identity;
- restrained competitive banners/rank presentation;
- season/event art where appropriate;
- battle scenes capable of both bright and dark contexts while preserving equal information.

Do not allow cosmetic environmental richness to obscure competitive state or create information inequality.

---

## 10. Phase 9 — Full Discipline Roster Scaling

As the roster expands toward 36 Disciplines, enforce visual-system reuse.

Every new Discipline must fit the established:

- icon standards;
- silhouette standards;
- portrait/character rules;
- VFX budget;
- motion families;
- temporary-resource presentation;
- light/dark readability;
- Confluence composition language.

Do not solve roster scale by making every Discipline a different UI theme.

The shell remains coherent; the content provides identity.

---

## 11. Phase 10 — Social World

Guilds, friends, profiles, messages, and prestige should add visual human presence.

Develop:

- character/profile cards with real portrait identity;
- guild crest/banner systems;
- guild hall/location presentation where applicable;
- Chronicle/social-history visual treatment;
- achievements/titles/prestige presentation;
- Hall of Selves foundations where appropriate;
- social surfaces that feel connected to people and history rather than tables of usernames.

Dense member-management tables remain appropriate where needed, but they should not define the entire social experience.

---

## 12. Phase 11 — Economy / Vendors / Crafting

The economy should feel like part of the world.

Add where appropriate:

- vendor portraits/identity;
- shop/location art;
- item imagery as a primary information carrier;
- material/crafting visual language;
- marketplace presentation that remains fast and searchable but not indistinguishable from generic ecommerce;
- acquisition/source context;
- rarity presentation proportional to importance;
- regional/cultural merchant identity.

Do not sacrifice efficient comparison/filtering for decorative storefront art.

---

## 13. Phase 12 — Nations / Cultural Scale

Nation systems should expand visual world identity through:

- banners/standards;
- architecture/cultural motifs;
- map-state overlays;
- political/territorial changes;
- campaign presentation;
- nation NPCs;
- reputation identity;
- occupation/conflict state where appropriate.

Different nations should not be represented only by changing one accent color.

---

## 14. Phase 13 — Master Panel Support for Visual Content

The Master Panel should gradually gain safe controls for the visual systems that actually exist.

Eventually support:

- location/region theme metadata;
- environment art references;
- approved surface/accent families;
- weather/time variants;
- banner/cultural motif references;
- event-state visual variants;
- media preview;
- light/dark contrast preview;
- responsive crop preview;
- asset dependency/impact preview;
- staged publication/rollback;
- accessibility warnings where practical.

Do not allow ordinary content staff to enter arbitrary CSS/colors/scripts.

Visual configuration must remain bounded by approved design-system tokens.

---

## 15. Phase 14 — Full Art & Audio Production Polish / Final Visual Cohesion

Phase 14 remains the dedicated production-polish pass, but it is **not the first time AUREVANE becomes visually alive**.

By Phase 14, the living-world visual direction should already be proven.

Phase 14 completes and harmonizes it across the product:

- final region art coverage;
- final important NPC/character coverage;
- final Discipline/Soulmark/Confluence identity;
- polished item/icon families;
- mature world map/cartography;
- final settlement/location treatments;
- cohesive illustrated loading/transitions where actually needed;
- ambient animation refinement;
- weather/time-of-day art maturity;
- world-state variants;
- polished Armory/Profile/Archive/Guild/Economy presentation;
- final battle-scene/environment kits;
- cohesive light/midtone/dark surface system;
- elimination of placeholder dark-shell styling from mature player-facing gameplay;
- final responsive art crops/derivatives;
- full audio/visual atmosphere integration.

### Phase 14 explicit gate

AUREVANE must no longer be reasonably described as "mostly dark panels with fantasy art around them."

The finished presentation should unmistakably feel like a **living adventure game**.

---

## 16. Phase 15 — Performance, Accessibility & Visual Hardening

Hardening must test the richer presentation under real constraints.

Include:

- bright and dark theme contrast audits;
- keyboard focus across themed surfaces;
- color-blind/state-independence checks;
- reduced-motion verification;
- ambient-animation pause/background behavior;
- responsive image correctness;
- asset loading/failure fallbacks;
- memory usage during region/scene transitions;
- low-end laptop/mobile performance;
- battle readability against extreme environment values;
- text-over-image readability;
- no layout shift from late image loading;
- no accidental full-resolution asset downloads on phones;
- visual regression coverage across representative regions/themes;
- browser zoom/text scaling where applicable.

---

## 17. Closed Alpha Visual Target

Closed Alpha does not require every final production asset, but it must contain enough finished visual experience that testers are evaluating **AUREVANE's intended game**, not imagining what a dark prototype might become.

Representative alpha coverage should include:

- multiple visibly distinct regions;
- at least one bright/daylight world experience;
- at least one darker/dangerous world experience;
- integrated NPC/character art;
- item/equipment imagery;
- real world map identity;
- battle scenes tied to locations;
- one polished settlement/hub experience;
- one polished Armory/Profile experience;
- coherent event/world-state presentation;
- responsive phone/laptop versions that retain game identity;
- enough ambient life that the world does not feel static.

The purpose is not screenshot beauty alone. Testers need sufficient fidelity to judge emotional pull, world identity, readability, and desire to return.

---

## 18. Visual Validation Gate

Before expanding visual content volume aggressively, representative screens should answer **yes** to the following:

- Does this look like a game rather than a dashboard?
- Does it feel adventurous and alive?
- Is the current place visually obvious?
- Is the screen still efficient to use?
- Are lighter values present where appropriate without becoming bland or washed out?
- Are darker values reserved for useful contrast/context rather than used by default everywhere?
- Are people/items/maps/environment art integrated rather than pasted behind cards?
- Can the same component system survive bright outdoor and dark dungeon contexts?
- Do phone/laptop layouts retain visual identity?
- Is performance acceptable?
- Is AUREVANE visually distinguishable from generic browser-fantasy interfaces?

A failure here should cause targeted art/UI iteration, not a return to universal dark rectangles because they are easier.

---

## 19. Ticket Rule for Future Player-Facing Features

Once Phase 5 visual-world integration begins, meaningful player-facing tickets should explicitly state:

- **visual context:** where/what world context the feature belongs to;
- **surface family:** light/midtone/dark contextual intent;
- **media:** required environment/character/item/icon assets or approved fallbacks;
- **regional/cultural identity:** if relevant;
- **ambient motion/audio:** if relevant;
- **responsive behavior:** how art and content recompose on phone/laptop;
- **accessibility:** contrast, focus, reduced motion, color-independent state;
- **performance:** image/animation budget where relevant;
- **fallback:** what the player sees if optional media fails to load.

Do not require these fields for pure backend/domain tickets.

---

## 20. Definition of Roadmap Success

This roadmap extension succeeds when visual maturity grows alongside actual game context:

```text
Phase 1
functional character shell
        ↓
Phase 2
real tactical battlefield
        ↓
Phase 3–4
character/build identity becomes visual
        ↓
Phase 5
LUMINOUS LIVING WORLD MILESTONE
        ↓
Phase 6–12
co-op / Expeditions / PvP / social / economy / nations gain world identity
        ↓
Phase 13
visual content becomes safely operable
        ↓
Phase 14
full production cohesion
        ↓
Phase 15
performance + accessibility hardening
```

The finished AUREVANE should feel like a player is **adventuring through a changing illustrated world**, not navigating an increasingly sophisticated version of the early dark development shell.
