# AUREVANE — Comprehensive Manual & Knowledge System

**Status:** Authoritative documentation and player-help specification subordinate only to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-08-15.

AUREVANE must eventually ship with a **comprehensive, attractive, easy-to-read manual** covering the game from beginner fundamentals through advanced systems, while also providing separate protected Owner/Staff operational documentation for the Master Panel.

The manual is not an afterthought, a giant wall of text, or a wiki that becomes obsolete six months after launch.

It is a maintained product system.

---

## 1. Goals

The knowledge system should make a new player feel:

> “I understand what to do next, and I can learn deeper mechanics when I am ready.”

An advanced player should feel:

> “I can quickly verify exact rules without digging through community speculation.”

The Owner or staff member should feel:

> “I can safely operate this system because the game explains what each control does and what can go wrong.”

---

## 2. Three Documentation Layers

AUREVANE should maintain three linked but distinct layers.

### A. Player Manual / Adventurer's Guide

Public, spoiler-safe game documentation.

Covers:

- controls and navigation;
- character creation;
- attributes and stats;
- progression;
- Disciplines;
- Mastery;
- Current + Legacy Discipline;
- Arts, Traits, Reactions, Movement Arts;
- Confluences;
- Soulmarks;
- equipment;
- tactical combat;
- terrain, height, facing, statuses;
- quests;
- world travel;
- events and World Pulse;
- lore Archive;
- parties and co-op;
- Expeditions;
- PvP;
- guilds;
- economy;
- nations;
- Rekindling;
- Veteran Edge;
- seasons;
- accessibility/settings;
- account/security basics;
- FAQ and troubleshooting.

### B. In-Game Contextual Help

Short help embedded directly where the player needs it.

Examples:

- hover/focus tooltips;
- “?” help buttons;
- first-use explanations;
- stat definitions;
- combat preview explanations;
- error messages that explain how to fix a problem;
- links from complex screens to the exact relevant manual article.

### C. Owner & Staff Operations Manual

Protected documentation for `/master`.

Covers:

- roles and permissions;
- Event operations;
- Story publication;
- balance changes;
- content versioning;
- rollback;
- player support actions;
- Owner Overrides;
- Break-Glass actions;
- economy operations;
- progression/pacing controls;
- Rekindling and Veteran Edge controls;
- lore publication/spoiler controls;
- moderation;
- incident response;
- audit logs;
- safe deployment/environment practices.

Public players must never receive secret staff instructions or unreleased lore through documentation endpoints.

---

## 3. Presentation Standard

The manual must look like part of AUREVANE, not a developer README pasted into the game.

Use:

- the approved typography and design system;
- high-quality section illustrations where useful;
- readable spacing;
- strong headings;
- short paragraphs;
- callout cards;
- icons;
- annotated screenshots;
- diagrams;
- mini examples;
- comparison cards;
- concise tables where they genuinely help;
- expandable advanced details;
- breadcrumb navigation;
- clearly labeled related articles.

Avoid:

- giant uninterrupted text walls;
- overdecorated fantasy fonts for body copy;
- tiny low-contrast text;
- forcing users to read the entire manual in sequence;
- ten levels of nested navigation;
- documentation that assumes prior RPG jargon knowledge.

---

## 4. Progressive Disclosure

Every major topic should have at least three information depths.

### Quick answer

1–3 sentences answering the immediate question.

Example:

> **What is a Legacy Discipline?**
> A Discipline you have fully mastered and equipped as your secondary combat tradition. It lets you borrow selected Arts and contributes to your Confluence.

### Practical guide

Explains how to use the system and common decisions.

### Deep mechanics

Exact rules, edge cases, formulas where appropriate, PvP notes, interactions, and examples.

This prevents new players from drowning while still serving theorycrafters.

---

## 5. Manual Information Architecture

Recommended player-facing top level:

```text
START HERE
CHARACTER
BUILDCRAFT
COMBAT
WORLD
QUESTS & EVENTS
LORE & ARCHIVE
CO-OP
EXPEDITIONS
PVP
GUILDS & SOCIAL
ECONOMY
NATIONS
ENDGAME & REKINDLING
SETTINGS & ACCESSIBILITY
FAQ / TROUBLESHOOTING
GLOSSARY
```

Each section can expose curated “Most useful now” content based on the player's progression without hiding the full manual.

---

## 6. Start Here

The onboarding manual should answer, very quickly:

- What is AUREVANE?
- What should I do after creating a character?
- What is a Discipline?
- What does Level mean versus Mastery?
- What is Current + Legacy?
- When do I get a Soulmark?
- How does combat work?
- Where do I find quests?
- How do I play with friends?
- What is the long-term goal?
- What is Rekindling?

A player should not need an external community wiki to understand basic progression.

---

## 7. Character & Buildcraft Documentation

The manual should explain:

- four attributes;
- derived stats;
- leveling;
- equipment requirements;
- Discipline progression;
- Mastery stages;
- Current Discipline;
- Legacy Discipline;
- Art slots;
- Trait slots;
- Reaction;
- Movement Art;
- Confluence Trait;
- Confluence Art where present;
- Soulmark mechanics;
- build presets/loadouts if implemented;
- how to experiment without permanently ruining a character.

Every stat should have a readable definition and, where useful, an exact advanced explanation.

---

## 8. Combat Manual

Combat documentation must include visual examples for:

- movement;
- Action + Move ordering;
- range;
- target shapes;
- line of sight;
- facing;
- front/side/rear effects;
- elevation;
- terrain;
- hazards;
- zones;
- summons;
- statuses;
- diminishing control effectiveness in PvP;
- turn order;
- resources;
- hit chance;
- critical effects;
- damage previews;
- reactions;
- displacement;
- common tactical mistakes.

A searchable **Status Glossary** should show:

- what each status does;
- duration rules;
- stacking rules;
- dispel/removal behavior;
- PvP-specific modifications when relevant.

---

## 9. Confluence & Soulmark Manual

Because these systems are signature AUREVANE mechanics, documentation quality must be exceptional.

The player should be able to understand:

- how Confluences are determined;
- whether pairing order matters;
- which Confluence is currently active;
- what is discovered versus undiscovered;
- how Confluence Traits modify gameplay;
- what Confluence Arts are;
- how Soulmarks work;
- branch choices;
- how Soulmarks can modify Discipline/Confluence interactions;
- what information remains intentionally undiscovered.

Do not spoil hidden Confluences or discovery content by listing unrevealed information in the public manual.

---

## 10. World, Events and World Pulse Manual

Explain:

- regions;
- nodes;
- travel;
- encounters;
- towns;
- world state;
- active events;
- event phases;
- community objectives;
- rotating encounters;
- first-witness prestige;
- aftermath;
- Chronicle;
- World Pulse.

The manual should explain that some things change over time because AUREVANE is a living shared world.

It should also explain that important competitive power is designed to recur or have alternate paths.

---

## 11. Lore & Archive Manual

Teach players how to engage with lore without spoiling the lore itself.

Explain:

- Primary Sources;
- Testimony;
- Institutional Records;
- Field Observations;
- Reconstructions;
- Unresolved Contradictions;
- Fragment Sets;
- provenance;
- community discoveries;
- Chronicle history.

The manual can explain **how to investigate** without revealing what the player has not discovered.

---

## 12. Co-op and Expedition Manual

Cover:

- party creation;
- invites;
- party finder;
- ready check;
- reconnect;
- pings;
- shared quests;
- party-size rules;
- Easy / Standard / Deep Expeditions;
- Threat;
- modifiers;
- suspension/reconnect;
- bosses;
- loot rules;
- personal loot;
- expected session length;
- what happens if someone disconnects.

Use visual diagrams for Expedition structure when useful.

---

## 13. PvP Manual

PvP documentation must be especially exact.

Cover:

- casual 1v1;
- ranked 1v1;
- casual 2v2;
- ranked 2v2;
- matchmaking;
- Arena Tempering;
- disconnect rules;
- seasons;
- rating/rank;
- tournament formats;
- queue-specific rules;
- Veteran Edge;
- normalization rules;
- prohibited exceptional Owner states in standard ranked;
- how balance changes are communicated.

Players should be able to see the exact competitive rules for the queue they are entering.

---

## 14. Rekindling Manual

Rekindling needs a dedicated, visually clear guide explaining:

- what Rekindling is;
- when it becomes available;
- what resets;
- what is preserved;
- Memory Carryover;
- Hall of Selves;
- Veteran Edge;
- how later cycles differ;
- what happens to cosmetics/social history;
- confirmation warnings before Rekindling.

Before a player confirms Rekindling, the UI should provide a personalized preview of exactly what their character will lose, preserve, and carry over.

---

## 15. Search

The manual should have excellent search.

Search should understand:

- article titles;
- system names;
- common abbreviations;
- status names;
- Discipline names;
- Art names;
- common natural-language questions where practical.

Examples:

```text
"how do I get legacy"
"what does wet do"
"rear attack bonus"
"why can't I enter ranked"
"what resets when I rekindle"
```

Results should prioritize current, relevant, spoiler-safe information.

---

## 16. Contextual Deep Links

Complex UI should link to exact manual sections.

Examples:

- clicking the `Accuracy` stat help icon opens Accuracy;
- a failed Expedition requirement links to Expedition Qualification;
- a disabled Ranked button links to the exact queue eligibility rule;
- Rekindling confirmation links to reset/preserve rules;
- an event card links to event participation rules;
- a Master Panel warning links staff to the matching operations procedure.

The manual should feel integrated into the product.

---

## 17. Glossary

Maintain a canonical glossary for player-facing terminology.

Examples:

- Art;
- Trait;
- Reaction;
- Movement Art;
- Discipline;
- Mastery;
- Legacy Discipline;
- Confluence;
- Soulmark;
- Horizon;
- Rekindling;
- Veteran Edge;
- Threat;
- Archive;
- Chronicle;
- World Pulse.

Use the same wording throughout UI, manual, tutorial, and error messages.

Do not casually reintroduce abandoned terminology such as Job Points.

---

## 18. Attractive Visual Learning

Use visuals when they make mechanics faster to understand.

Potential manual assets:

- annotated tactical board screenshots;
- facing diagrams;
- elevation diagrams;
- status icons;
- build-slot diagrams;
- Current + Legacy + Confluence flow diagram;
- Soulmark branch diagram;
- Expedition flow diagram;
- Rekindling reset/preserve diagram;
- world-event lifecycle diagram;
- Master Panel publishing workflow diagrams.

Visuals must follow the Art Bible and UI quality standards.

Do not use random low-quality temporary diagrams in production documentation.

---

## 19. Mobile and Accessibility

The manual must be usable on desktop and mobile.

Requirements:

- responsive layout;
- keyboard navigation;
- semantic headings;
- screen-reader compatible controls;
- sufficient contrast;
- no information conveyed only by color;
- zoom-friendly text;
- reduced-motion compliance for animated diagrams;
- captions/alt text for meaningful images;
- large enough tap targets.

The manual is part of accessibility, not separate from it.

---

## 20. Spoiler Safety

Documentation content should support internal metadata such as:

```text
manual_visibility = public | progression_gated | staff | owner
story_reveal_tier
spoiler_tier
minimum_story_state
minimum_system_unlock
```

The public manual should not expose:

- Aurevane's antagonist reveal;
- unreleased Disciplines;
- hidden Confluences;
- secret bosses;
- unrevealed regions;
- hidden Great Vane information;
- unpublished event/story content.

A staff/owner manual can include privileged information only behind proper authorization.

---

## 21. Version Awareness

Rules change over the lifetime of a live game.

Manual content should therefore support:

- last-updated timestamp;
- content/version association where useful;
- change notes;
- retired article handling;
- links from patch notes to updated rule pages;
- queue/season-specific PvP rules;
- current versus historical information.

A player should not read a two-year-old rule and assume it still applies.

---

## 22. Source-of-Truth Strategy

Where practical, avoid duplicating exact game data manually.

Examples:

- status definitions can come from typed content metadata;
- Discipline unlock requirements can render from authoritative content data;
- PvP queue rules can render from current configuration;
- Rekindling reset rules can render from versioned progression config;
- event times can render from authoritative event state.

Narrative explanations and strategic guidance remain authored content.

The manual should blend **structured authoritative data + curated human-readable explanation**.

---

## 23. Manual Content Model

A manual article may include:

```text
id
title
summary
category
audience
body_sections
keywords
related_articles
system_links
content_version
minimum_progression_state
spoiler_tier
media_refs
last_reviewed_at
owner/staff notes where protected
```

Manual content should be versioned and publishable through safe content workflows once the Master Panel documentation editor exists.

---

## 24. Owner/Staff Operations Manual

The protected operations manual should include task-oriented procedures such as:

- Run a world event;
- Emergency-stop an event;
- Publish a story chapter;
- Roll back a bad balance package;
- Correct a player's currency;
- Force-grant an unearned item;
- Grant a special permission;
- Create a QA-only exceptional character state;
- Restore a stuck Expedition;
- Disable a broken Veteran Edge;
- Change Horizon requirements;
- Use the Pacing Simulator;
- Review audit history;
- Perform a Break-Glass Owner action.

Each procedure should show:

- purpose;
- required permission;
- prerequisites;
- exact steps;
- expected result;
- risks;
- rollback/recovery;
- audit behavior;
- related controls.

---

## 25. Master Panel Manual Editor

The final Master Panel should include documentation operations.

Authorized staff should be able to:

- create/edit manual articles;
- preview desktop/mobile rendering;
- attach approved images/diagrams;
- set keywords;
- create cross-links;
- set spoiler/progression visibility;
- mark content staff-only/owner-only;
- schedule publication;
- review diffs;
- roll back a bad manual edit;
- see outdated articles affected by a changed system;
- assign article-review tasks.

The Owner can publish or override all documentation states.

---

## 26. Documentation Drift Detection

A live game changes constantly, so the project needs anti-drift rules.

When a ticket changes a documented player-facing mechanic, it must identify whether manual updates are required.

Examples:

- changing a status rule flags the Status Glossary;
- changing Rekindling reset behavior flags the Rekindling guide;
- changing a PvP queue rule flags that queue's article;
- changing an Expedition requirement flags Expedition documentation;
- changing a Master Panel workflow flags staff operations documentation.

Where practical, automated checks can detect references to changed structured content.

---

## 27. Ticket Requirement

Every implementation ticket that introduces or materially changes a player-facing system must include:

```text
DOCUMENTATION IMPACT
- manual article(s) required/updated
- contextual help required/updated
- glossary impact
- screenshots/diagrams required
- spoiler considerations
- staff/owner operations documentation impact
```

A feature is not considered polished merely because the code works.

For major systems, documentation is part of the acceptance criteria.

---

## 28. Manual Quality Review

Before major releases, review the manual for:

- correctness;
- readability;
- visual quality;
- mobile usability;
- broken links;
- stale screenshots;
- outdated terminology;
- missing new systems;
- spoiler leaks;
- accessibility;
- search quality;
- staff procedure accuracy.

---

## 29. Patch Notes Integration

When balance or rule changes are published, patch notes should link to the updated canonical manual entries.

Example:

```text
Veteran Edge: Settled Nerves adjusted.
Read current Veteran Edge rules → [manual deep link]
```

This makes the manual the stable place for current rules while patch notes explain what changed.

---

## 30. Community and Manual Relationship

Community guides, theorycrafting, videos, and wikis are welcome, but they should not be required to understand the official rules.

AUREVANE's manual should be the canonical source for:

- what a mechanic officially does;
- current requirements;
- current queue rules;
- current reset behavior;
- official terminology.

Community content can focus on strategy, discovery, and interpretation.

---

## 31. Implementation Timing

### Phase 0

- establish manual specification;
- establish documentation impact as a permanent ticket requirement;
- avoid architecture that makes contextual help impossible.

### Phase 1

- create first player guide shell;
- document account, character creation, stats, progression, and Discipline basics;
- implement basic contextual help pattern.

### Phase 2

- build Combat manual section with diagrams and Status Glossary.

### Phases 3–4

- document Current + Legacy, Confluences, Soulmarks, build slots, and Mastery deeply.

### Phase 5

- add World, Events, World Pulse, Archive, lore-discovery, quest, and navigation sections;
- establish search and spoiler-aware article visibility.

### Phases 6–8

- add co-op, Expedition, PvP, season, tournament, and Veteran Edge documentation.

### Phases 10–12

- add social, guild, economy, marketplace, crafting, nation, and campaign sections.

### Phase 13

- complete Owner/Staff Operations Manual;
- add Master Panel documentation editor;
- add documentation drift/review workflows;
- document Owner Override and Break-Glass operations comprehensively.

### Phase 14

- dedicated visual polish pass for manual illustrations, diagrams, screenshots, transitions, and responsive presentation.

### Phase 15

- final correctness/accessibility/security/spoiler review.

---

## 32. Definition of Success

The manual system succeeds when:

- a new player can learn the game without an external wiki;
- advanced players can verify exact rules quickly;
- the manual is visually attractive and easy to scan;
- complex systems use diagrams/examples instead of walls of text;
- search finds answers in natural player language;
- contextual help links directly from gameplay UI;
- spoiler-sensitive content remains hidden until appropriate;
- Owner/Staff procedures are protected and operationally useful;
- every major game system has current documentation;
- documentation changes alongside code rather than months later;
- the Owner can manage manual content from the Master Panel;
- the manual feels like a polished feature of AUREVANE itself.
