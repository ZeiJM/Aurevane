# AUREVANE — Comprehensive Manual & Knowledge System

**Status:** Authoritative documentation/player-help specification subordinate to `docs/GAME_MASTER_PLAN.md` and the owner-approved domain specifications it indexes.

**Initial direction approved:** 2026-08-15.  
**Terminology/current-state synchronization:** 2026-08-19.

AUREVANE must eventually ship with a comprehensive, attractive, easy-to-read Manual covering beginner fundamentals through advanced systems, plus separate protected Owner/Staff operational documentation.

The Manual is a maintained product system, not a static wiki dump.

Current player-facing terminology is:

- Primary Discipline;
- optional mastered Secondary Discipline;
- Skill as the ability umbrella;
- Resonance for mixed Primary + Secondary builds;
- Essence / Discipline Essence for pure Primary-only builds;
- Soulmark for the Soulmarked supernatural path;
- The Severance / Soul-Severed / Mantle for the mutually exclusive alternative supernatural path;
- Battle Hall for the current practice-combat destination;
- Passive Training for explicit server-timed background progression.

Retired player-facing terms such as Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots, Tactical Hall, and the old four-attribute model may remain only in clearly historical material.

---

## 1. Goals

A new player should feel:

> “I understand what to do next, and I can learn deeper mechanics when I am ready.”

An advanced player should feel:

> “I can verify exact current rules without depending on community guesswork.”

Owner/staff should feel:

> “I can safely operate this system because the game explains what each control does and what can go wrong.”

---

## 2. Three Documentation Layers

### A. Player Manual / Adventurer's Guide

Public, spoiler-safe documentation covering released systems first and clearly distinguishing current gameplay from future roadmap direction.

Long-term topics include:

- controls/navigation;
- character creation;
- six attributes and derived stats;
- Character XP / levels;
- Disciplines and Mastery;
- Primary / optional Secondary Disciplines;
- Discipline Skills;
- Resonance and pure-Discipline Essence;
- Soulmarked versus Soul-Severed/Mantle supernatural identity;
- equipment and Equipment Skills;
- Passive Training;
- tactical combat / Action Economy;
- terrain, elevation, facing, statuses and effects;
- Battle Hall / AI Sparring;
- quests/world/events/World Pulse;
- Archive/lore;
- parties/co-op;
- Expeditions;
- PvP;
- guild/social systems;
- economy/nations;
- Rekindling / Veteran Edge;
- seasons;
- accessibility/settings;
- account/security basics;
- FAQ/troubleshooting.

### B. In-Game Contextual Help

Short help where needed:

- tooltips;
- help buttons;
- first-use explanations;
- stat definitions;
- combat forecasts;
- validation errors that explain fixes;
- deep links to exact Manual sections.

### C. Owner & Staff Operations Manual

Protected documentation for `/master`, covering roles/permissions, live events, story publication, balance/content changes, versioning/rollback, player support, Owner Overrides, Break-Glass, progression/pacing, Battle Hall/AI operations, economy, Rekindling/Veteran Edge, lore/spoiler publication, moderation, incident response and audit history.

Public endpoints must never expose secret staff instructions or unreleased story information.

---

## 3. Presentation Standard

The Manual must look like AUREVANE rather than a pasted README.

Use:

- approved typography/design system;
- readable spacing;
- strong hierarchy;
- concise paragraphs;
- callout cards/icons;
- annotated screenshots;
- diagrams/examples;
- tables only where genuinely clearer;
- progressive disclosure;
- breadcrumbs/related articles;
- responsive/mobile presentation.

Avoid giant walls of text, low contrast, fantasy fonts for body copy, over-nested navigation, and unexplained RPG jargon.

---

## 4. Progressive Disclosure

Major topics should offer:

### Quick answer

1–3 sentences answering the immediate question.

Example:

> **What is a Secondary Discipline?**  
> An optional Discipline your character has legitimately mastered and mixes into the current build. It contributes access to its learned Skill library under mixed-build limits and enables Resonance with your Primary, but it does not grant a second base Discipline stat profile.

### Practical guide

How to use the system and what decisions matter.

### Deep mechanics

Exact current rules, edge cases, formulas where appropriate, mode-specific notes and examples.

---

## 5. Manual Information Architecture

Recommended top level:

```text
START HERE
CHARACTER
BUILDCRAFT
COMBAT
BATTLE HALL
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

Progression-aware “Useful now” content may be curated without hiding the full spoiler-safe Manual.

---

## 6. Start Here

Quickly answer:

- What is AUREVANE?
- What can I play right now?
- What should I do after character creation?
- What is a Discipline?
- What is Level versus Mastery?
- What are Primary and Secondary Disciplines?
- What are Resonance and Essence?
- When do supernatural systems matter?
- How does combat work?
- What is Battle Hall?
- What is Passive Training?
- What is the long-term progression direction?

A player should not need an external wiki to understand basics.

---

## 7. Character & Buildcraft Documentation

Explain the six universal attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Explain derived stats, leveling, equipment requirements, Discipline progression and Mastery stages.

Buildcraft documentation must use the approved mature contract:

### Pure build

```text
Primary only
up to 8 learned Primary Discipline Skills
+ 1 Essence Skill
+ no Resonance
```

### Mixed build

```text
Primary + mastered Secondary
6 total Discipline Skills across both active libraries
+ Resonance passive
+ no pure-path Essence while Secondary is equipped
```

The exact Primary/Secondary split inside the mixed six is tunable and must not be documented as a permanent 4/2 split unless a later current rules version explicitly locks it.

Primary supplies the active base Discipline stat profile. Secondary supplies no second base profile.

Persistent live Primary and Secondary changes are meaningful commitments and must display their current independent server-authoritative attunement cooldown rules when that system is released/configured.

Do not document separate universal Trait, Reaction, Movement Art or Ultimate loadout slots because they are not part of the approved mature build system.

---

## 8. Combat Manual

`docs/COMBAT.md` controls the current combat rules.

The Manual must explain the current shared **Action Economy (AE)** model rather than the retired Movement Budget + one Action model.

Current PV-1F validation baseline:

```text
Turn start                     100 AE
Inspect                          0 AE
Move, normal traversal unit     10 AE
Move, terrain cost 2            20 AE
Basic Attack                    30 AE
Guard                           30 AE
Recover                         50 AE
Final Facing                     0 AE and ends turn
```

Multiple legal commands may occur in one turn while AE remains.

Combat documentation should eventually cover:

- movement/traversal cost;
- Action Economy;
- targeting/range/line of sight;
- facing/front/side/rear;
- elevation/terrain/hazards/zones;
- statuses/effects;
- summons/battle objects;
- resources/cooldowns;
- forecasts;
- triggered/passive effects;
- displacement;
- objectives;
- PvP-specific control/fairness notes;
- common tactical mistakes.

Status Glossary should render authoritative current definitions where practical.

---

## 9. Resonance, Essence & Supernatural Documentation

Documentation quality for these signature systems must be exceptional.

### Resonance

Explain:

- requires an eligible Primary + Secondary pairing;
- Secondary normally must be mastered;
- Resonance is passive mixed-build identity;
- pair direction can still matter through Primary base profile/Skill emphasis even where one core unordered Resonance is shared;
- discovered/undiscovered content remains spoiler-safe;
- current active Resonance and trigger/cap are readable.

### Essence

Explain:

- requires Primary only / no Secondary;
- grants one special Essence Skill outside the normal eight Discipline Skill capacity;
- uses normal authoritative targeting/effects/AE/cooldowns;
- is the pure-path alternative to Resonance, not an Ultimate slot.

### Supernatural fork

Explain only at the player's legitimate reveal tier:

- Soulmarked characters use Soulmarks;
- The Severance creates the Soul-Severed permanent alternative path;
- eligible Soul-Severed characters pursue Mantles instead of Soulmarks;
- ordinary rules make the two paths mutually exclusive;
- exact story details remain spoiler-gated.

---

## 10. Passive Training Manual

Explain current behavior precisely:

- Passive Training starts only after the player explicitly chooses a plan;
- Short / Medium / Extended are server-timed;
- longer plans trade hourly efficiency for convenience;
- simply being offline/idle creates no new reward;
- stopping an unfinished plan grants no partial reward;
- completed Training Reports are server-owned/idempotent;
- active training blocks starting a new Battle Hall/live fight under current rules;
- ordinary non-combat account/reference/social surfaces may remain usable;
- current reward foundation is Character XP;
- future Mastery/Rested extensions should not be described as released until they exist;
- Passive Training cannot complete story, boss/Expedition clears, PvP rank, Resonance/Essence accomplishments, supernatural milestones, rare-item acquisition or endgame rites.

---

## 11. Battle Hall Manual

The current player-facing practice destination is **Battle Hall**.

Explain:

- no fight needs to be preselected on entry;
- AI Sparring is the first explicit full duel;
- focused practice drills may coexist;
- practice uses authoritative combat legality;
- future Tactical Records unlock additional legitimate opponents/scenarios;
- AI Intelligence and raw Level/Attributes/Equipment are separate concepts;
- practice does not grant represented content as ownership;
- practice is not a zero-risk progression/economy farm;
- boss/secret records remain spoiler-gated;
- Battle Review/repeatable seeds grow later.

“Tactical Hall” may appear only in historical documentation.

---

## 12. World, Events & World Pulse

Explain regions, nodes/travel, towns, encounters, world state, events, phases, community objectives, rotating content, first-witness prestige, aftermath, Chronicle and World Pulse.

Make clear that AUREVANE is a living shared world and that important competitive power should recur or have alternate acquisition paths.

---

## 13. Lore & Archive

Teach how to investigate without spoiling conclusions.

Explain:

- Primary Sources;
- Testimony;
- Institutional Records;
- Field Observations;
- Reconstructions;
- Unresolved Contradictions;
- Fragment Sets;
- provenance;
- Chronicle history.

Manual can teach investigation mechanics without revealing undiscovered canon.

---

## 14. Co-op & Expeditions

Cover party creation/invites/finder/ready checks/reconnect/pings/shared quests and party-size rules.

Expedition docs cover Easy / Standard / Deep Expeditions, Threat, modifiers, progressive reveal, suspension/reconnect, bosses, personal loot, expected session shape and disconnect behavior.

Use diagrams where useful.

---

## 15. PvP Manual

PvP documentation must be exact and version-aware.

Cover released formats such as casual/ranked 1v1 and 2v2 when available, matchmaking, Arena Tempering, disconnects, seasons, ranks/ratings, tournaments, queue-specific rules, build/item legality, Resonance/Essence/supernatural legality, Veteran Edge rules and current normalization.

Players should be able to see the exact competitive rules for the queue they enter.

---

## 16. Rekindling Manual

Explain:

- eligibility;
- what resets/preserves;
- Memory Carryover;
- Hall of Selves;
- Veteran Edge;
- later-cycle differences;
- persistent supernatural-path choice;
- personalized confirmation preview before irreversible commitment.

---

## 17. Search

Search should understand current system names, aliases, statuses, Discipline/Skill names and natural-language questions.

Examples:

```text
"how do I equip a secondary discipline"
"what is resonance"
"what does essence do"
"what does wet do"
"rear attack bonus"
"why can't I start battle while training"
"what resets when I rekindle"
```

Current terms rank above retired/historical terminology.

---

## 18. Contextual Deep Links

Examples:

- stat help opens the stat article;
- failed build validation links to the exact Secondary/Skill/attunement rule;
- disabled Ranked links to queue eligibility;
- Passive Training lock links to training rules;
- Battle Hall help links to practice rules;
- Rekindling confirmation links to reset/preserve;
- Master Panel warning links to protected operations procedure.

---

## 19. Canonical Glossary

Maintain one current glossary including:

- Discipline;
- Mastery;
- Primary Discipline;
- Secondary Discipline;
- Skill;
- Discipline Skill;
- Equipment Skill;
- Resonance;
- Essence / Discipline Essence;
- Soulmark;
- The Severance;
- Soul-Severed;
- Mantle;
- Action Economy;
- Battle Hall;
- AI Sparring;
- Passive Training;
- Training Report;
- Horizon;
- Rekindling;
- Veteran Edge;
- Threat;
- Archive;
- Chronicle;
- World Pulse.

Retired terms can map to current terms only in a clearly labeled historical/migration reference.

---

## 20. Visual Learning

Useful assets can include:

- annotated battle screenshots;
- AE/forecast diagrams;
- facing/elevation diagrams;
- status icons;
- pure-vs-mixed build diagram;
- Resonance/Essence comparison;
- supernatural-path spoiler-safe diagram;
- Expedition flow;
- Rekindling reset/preserve;
- world-event lifecycle;
- Master Panel publishing workflow.

Production visuals follow the Art Bible/design system.

---

## 21. Mobile & Accessibility

Requirements:

- responsive layout;
- keyboard navigation;
- semantic headings;
- screen-reader-compatible controls;
- sufficient contrast;
- no color-only meaning;
- zoom-friendly text;
- reduced-motion compliance;
- captions/alt text;
- adequate tap targets.

The Manual itself is part of accessibility.

---

## 22. Spoiler Safety

Manual content should support metadata such as:

```text
manual_visibility = public | progression_gated | staff | owner
story_reveal_tier
spoiler_tier
minimum_story_state
minimum_system_unlock
```

Public Manual must not expose unreleased Disciplines, hidden Resonances/Essence, secret bosses/regions, unrevealed supernatural/story truths, unpublished events or protected staff data.

---

## 23. Version Awareness & Source of Truth

Manual content supports last-updated timestamps, current/historical state, rules/content versions, change notes, retired articles, patch-note links and queue/season-specific rules.

Where practical, exact live data renders from authoritative structured definitions rather than duplicated prose:

- status rules;
- Skill definitions/costs/cooldowns;
- Discipline requirements;
- Primary/Secondary cooldown configuration;
- Resonance/Essence definitions;
- PvP queue rules;
- Passive Training plans;
- Rekindling configuration;
- event times.

Curated explanation remains authored, but it must not become a second mechanical truth source.

---

## 24. Manual Content Model

A Manual article can include:

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
protected owner/staff notes
```

Manual content is versioned/publishable through safe workflows once the documentation editor exists.

---

## 25. Owner/Staff Operations Manual

Protected task procedures should cover operations such as:

- run/emergency-stop world event;
- publish/rollback story content;
- publish/rollback balance package;
- correct player state through domain commands;
- Owner/support grants;
- special permission/exceptional-state controls;
- restore stuck Expedition;
- disable broken Skill/Resonance/Essence/Soulmark/Mantle/AI profile;
- change Horizon/Passive Training configuration;
- use Pacing Simulator/Combat AI Lab;
- review audit history;
- Break-Glass Owner action.

Each procedure documents purpose, required permission, prerequisites, exact steps, result, risks, recovery and audit behavior.

---

## 26. Master Panel Manual Editor

Authorized staff eventually can:

- create/edit articles;
- preview desktop/mobile;
- attach approved media;
- set keywords/links;
- set spoiler/progression visibility;
- mark staff/owner-only;
- schedule publication;
- review diffs;
- rollback;
- detect articles affected by a changed system;
- assign review work.

---

## 27. Documentation Drift Detection

When a ticket changes a documented player-facing mechanic, it must state which documentation changes are required.

Examples:

- attribute change flags Character/Stat docs;
- AE/cost change flags Combat and Battle Hall docs;
- Primary/Secondary/Resonance/Essence change flags Buildcraft/Glossary;
- Passive Training change flags Training/FAQ;
- PvP queue change flags queue rules;
- Expedition requirement change flags Expedition docs;
- Master Panel workflow change flags staff operations docs.

Where practical, automated checks should detect references to changed structured content or retired terminology.

---

## 28. Ticket Requirement

Every implementation ticket introducing or materially changing a player-facing system must include:

```text
Manual impact: none | update existing | new article
Current terminology impact
Contextual-help impact
Glossary impact
Screenshot/diagram impact
Spoiler/progression visibility impact
Structured source-of-truth fields affected
```

A feature is not finished when its UI changes but its current Manual still teaches the previous game.

---

## 29. Current Implementation Note

The current public Manual implementation is maintained through current player-facing content such as `apps/web/src/content/current-manual.ts` and related public information sources.

Current Manual copy must prioritize what is actually playable now—character/account systems, six attributes, Passive Training, Battle Hall/AI Sparring and current combat rules—while explicitly labeling future Primary/Secondary/Resonance/Essence/world/co-op/PvP systems as roadmap direction until released.

---

## 30. Definition of Success

The Manual succeeds when:

- new players can learn AUREVANE without an external wiki;
- advanced players can verify exact current rules;
- current terminology is consistent across UI/manual/tutorial/errors;
- six attributes and current AE combat are documented correctly;
- pure/mixed build rules are understandable;
- Resonance and Essence are distinct and spoiler-safe;
- Passive Training/Battle Hall behavior matches the real product;
- unreleased systems are not presented as already playable;
- documentation updates with live rules;
- staff can operate complex systems safely through protected procedures;
- spoilers and privileged information remain protected;
- accessibility/mobile requirements are respected;
- historical rules remain identifiable as historical rather than silently overriding the current game.