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

Retired player-facing terms such as Current Discipline, Legacy Discipline, Art as the generic ability term, Confluence, separate Trait/Reaction/Movement Art/Ultimate slots, Tactical Hall, the old four-attribute model, and the old Movement Budget + one Action combat model may remain only in clearly historical material.

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

### Player Manual / Adventurer's Guide

Public, spoiler-safe documentation covering released systems first and clearly distinguishing current gameplay from future roadmap direction.

Long-term topics include controls/navigation; character creation; six attributes; Character XP/levels; Disciplines/Mastery; Primary/Secondary buildcraft; Skills; Resonance/Essence; supernatural identity; equipment; Passive Training; tactical combat; Battle Hall; quests/world/events; Archive/lore; co-op; Expeditions; PvP; guild/social systems; economy; nations; Rekindling; settings/accessibility; FAQ and glossary.

### In-Game Contextual Help

Short help where needed through tooltips, help buttons, first-use explanations, stat definitions, combat forecasts, validation errors and deep links to exact Manual sections.

### Owner & Staff Operations Manual

Protected documentation for `/master`, covering roles/permissions, live events, story publication, balance/content changes, versioning/rollback, support, Owner Overrides, Break-Glass, progression/pacing, Battle Hall/AI operations, economy, Rekindling/Veteran Edge, lore/spoiler publication, moderation, incident response and audit history.

---

## 3. Presentation Standard

The Manual must look like AUREVANE rather than a pasted README.

Use approved typography/design system, readable spacing, clear hierarchy, concise paragraphs, callout cards/icons, annotated screenshots, diagrams/examples, progressive disclosure, breadcrumbs/related articles and responsive/mobile presentation.

Avoid giant walls of text, low contrast, fantasy fonts for body copy, over-nested navigation and unexplained RPG jargon.

---

## 4. Progressive Disclosure

Major topics should offer:

### Quick answer

1–3 sentences answering the immediate question.

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

---

## 6. Character & Buildcraft Documentation

Explain the six universal attributes:

- Might;
- Finesse;
- Vitality;
- Agility;
- Intellect;
- Resolve.

Explain derived stats, leveling, equipment requirements, Discipline progression and Mastery stages.

Buildcraft documentation must use the approved mature contract.

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

Persistent live Primary and Secondary changes are meaningful commitments and should display their current server-authoritative attunement cooldown rules when released/configured.

Do not document separate universal Trait, Reaction, Movement Art or Ultimate loadout slots because they are not part of the approved mature build system.

---

## 7. Combat Manual

`docs/COMBAT.md` controls the current combat rules.

The Manual must explain the current shared **Action Economy**, displayed to players in **AP**, rather than the retired Movement Budget + one Action model.

Current implemented PV-1F baseline:

```text
Turn start                     100 AP
Inspect                          0 AP
Move, normal traversal point    25 AP
Move, terrain cost 2            50 AP
Basic Attack                    30 AP
Guard                           30 AP
Recover                         50 AP
Final Facing                     0 AP and ends turn
```

These current numerical values should be sourced/verified against the server-authoritative implementation before publication after future balance changes.

Multiple legal commands may occur in one turn while AP remains.

Combat documentation should eventually cover movement/traversal cost, Action Economy, targeting/range/line of sight, facing/front/side/rear, elevation/terrain/hazards/zones, statuses/effects, summons/battle objects, resources/cooldowns, forecasts, triggered/passive effects, displacement, objectives, PvP-specific rules and common tactical mistakes.

---

## 8. Resonance, Essence & Supernatural Documentation

### Resonance

Explain that it requires an eligible Primary + Secondary pairing, Secondary normally must be mastered, Resonance is passive mixed-build identity, pair direction can still matter through Primary base profile/Skill emphasis, and undiscovered content remains spoiler-safe.

### Essence

Explain that it requires Primary only/no Secondary, grants one special Essence Skill outside the normal eight Discipline Skill capacity, uses normal authoritative targeting/effects/AP/cooldowns and is the pure-path alternative to Resonance—not an Ultimate slot.

### Supernatural fork

At the player's legitimate reveal tier, explain Soulmarked characters use Soulmarks while The Severance creates the Soul-Severed permanent alternative path with Mantles. Ordinary rules make the two paths mutually exclusive. Story details remain spoiler-gated.

---

## 9. Passive Training Manual

Explain current behavior precisely:

- Passive Training starts only after explicit plan choice;
- Short / Medium / Extended are server-timed;
- longer plans trade hourly efficiency for convenience;
- simply being offline/idle creates no new reward;
- stopping an unfinished plan grants no partial reward;
- completed Training Reports are server-owned/idempotent;
- active training blocks starting a new Battle Hall/live fight under current rules;
- ordinary non-combat account/reference/social surfaces may remain usable;
- current reward foundation is Character XP;
- future Mastery/Rested extensions are not described as released until they exist;
- Passive Training cannot complete story, boss/Expedition clears, PvP rank, Resonance/Essence accomplishments, supernatural milestones, rare-item acquisition or endgame rites.

---

## 10. Battle Hall Manual

The current player-facing practice destination is **Battle Hall**.

Explain that no fight needs to be preselected on entry, AI Sparring is the first explicit full duel, focused practice drills may coexist, practice uses authoritative combat legality, future Tactical Records unlock legitimate opponents/scenarios, AI intelligence and raw unit power are separate concepts, represented content is not persistent ownership, practice is not a zero-risk progression/economy farm, boss/secret records remain spoiler-gated and Battle Review/repeatable seeds grow later.

“Tactical Hall” may appear only in historical documentation.

---

## 11. World, Events, Lore, Co-op & Expeditions

World documentation explains regions, nodes/travel, towns, encounters, world state, events, phases, community objectives, rotations, aftermath, Chronicle and World Pulse.

Lore/Archive documentation teaches Primary Sources, Testimony, Institutional Records, Field Observations, Reconstructions, Unresolved Contradictions, Fragment Sets and provenance without spoiling conclusions.

Co-op documentation covers party creation/invites/finder/ready checks/reconnect/pings/shared quests and party-size rules.

Expedition documentation covers Easy / Standard / Deep Expeditions, Threat, modifiers, progressive reveal, suspension/reconnect, bosses, personal loot and disconnect behavior.

---

## 12. PvP & Rekindling Manual

PvP documentation must be exact and version-aware, covering released formats, matchmaking, Arena Tempering, disconnects, seasons, ranks/ratings, tournaments, queue-specific rules, build/item legality, Resonance/Essence/supernatural legality and Veteran Edge rules.

Rekindling documentation explains eligibility, reset/preserve behavior, Memory Carryover, Hall of Selves, Veteran Edge, later-cycle differences, persistent supernatural-path choice and personalized confirmation before irreversible commitment.

---

## 13. Search & Contextual Help

Search should understand current system names, aliases, statuses, Discipline/Skill names and natural-language questions such as:

```text
how do I equip a secondary discipline
what is resonance
what does essence do
rear attack bonus
why can't I start battle while training
what resets when I rekindle
```

Current terms rank above retired/historical terminology.

Contextual help should deep-link failed build validation, Passive Training locks, Battle Hall help, PvP eligibility, Rekindling confirmation, stat definitions and Master Panel warnings to the exact applicable article.

---

## 14. Canonical Glossary

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
- Action Economy / AP;
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

Retired terms can map to current terms only in clearly labeled historical/migration references.

---

## 15. Visual Learning, Mobile & Accessibility

Useful assets include annotated battle screenshots, AP/forecast diagrams, facing/elevation diagrams, status icons, pure-vs-mixed build diagrams, Resonance/Essence comparison, spoiler-safe supernatural diagrams, Expedition flow and Rekindling reset/preserve guides.

Requirements include responsive layout, keyboard navigation, semantic headings, screen-reader-compatible controls, sufficient contrast, no color-only meaning, zoom-friendly text, reduced-motion compliance, captions/alt text and adequate tap targets.

---

## 16. Spoiler Safety

Manual content may support visibility metadata such as:

```text
manual_visibility = public | progression_gated | staff | owner
story_reveal_tier
spoiler_tier
minimum_story_state
minimum_system_unlock
```

Public Manual must not expose unreleased Disciplines, hidden Resonances/Essence, secret bosses/regions, unrevealed supernatural/story truths, unpublished events or protected staff data.

---

## 17. Version Awareness & Source of Truth

Manual content supports last-updated timestamps, current/historical state, rules/content versions, change notes, retired articles, patch-note links and queue/season-specific rules.

Where practical, exact live data renders from authoritative structured definitions rather than duplicated prose, including status rules, Skill costs/cooldowns, Discipline requirements, Primary/Secondary cooldown configuration, Resonance/Essence definitions, PvP rules, Passive Training plans, Rekindling configuration and event times.

Curated explanation remains authored, but it must not become a second mechanical truth source.

---

## 18. Owner/Staff Operations Manual & Editor

Protected procedures cover world-event operations, story publication/rollback, balance packages, player-state corrections, Owner/support grants, exceptional state, stuck-Expedition repair, disabling broken Skills/Resonances/Essences/supernatural/AI content, progression configuration, simulation tools, audit history and Break-Glass.

Authorized staff eventually can create/edit articles, preview desktop/mobile, attach approved media, set keywords/links, set spoiler/progression visibility, schedule publication, review diffs, rollback and detect articles affected by a changed system.

---

## 19. Documentation Drift Detection

When a ticket changes a documented player-facing mechanic, it must state which documentation changes are required.

Examples:

- attribute change flags Character/Stat docs;
- AP/cost change flags Combat and Battle Hall docs;
- Primary/Secondary/Resonance/Essence change flags Buildcraft/Glossary;
- Passive Training change flags Training/FAQ;
- PvP queue change flags queue rules;
- Expedition requirement change flags Expedition docs;
- Master Panel workflow change flags staff operations docs.

Whenever numerical current-state rules are copied into Manual prose, verify them against the authoritative implementation/configuration rather than an older design draft.

---

## 20. Ticket Requirement

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

## 21. Current Implementation Note

The current public Manual implementation is maintained through player-facing content such as `apps/web/src/content/current-manual.ts` and related public information sources.

Current Manual copy must prioritize what is actually playable now—character/account systems, six attributes, Passive Training, Battle Hall/AI Sparring and current combat rules—while explicitly labeling future Primary/Secondary/Resonance/Essence/world/co-op/PvP systems as roadmap direction until released.

---

## 22. Definition of Success

The Manual succeeds when new players can learn AUREVANE without an external wiki, advanced players can verify exact current rules, terminology is consistent across UI/manual/tutorial/errors, six attributes and current AP combat are documented correctly, pure/mixed build rules are understandable, Resonance and Essence are distinct/spoiler-safe, Passive Training/Battle Hall behavior matches the real product, unreleased systems are not presented as already playable, documentation updates with live rules, staff can operate systems safely, spoilers/privileged information remain protected, and historical rules remain identifiable as historical rather than silently overriding the current game.
