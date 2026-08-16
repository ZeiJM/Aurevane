# AUREVANE — Public News & Manual Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for permanent anonymous News and Manual surfaces, public information quality, and their progressive Master Panel operations.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/PUBLIC_NEWS_AND_MANUAL.md` defines the public product model. `docs/PLAYER_MANUAL.md` defines comprehensive documentation quality. `docs/MASTER_PANEL.md` defines privileged publication operations. This document defines **when** the public surfaces and their authoring capabilities enter implementation.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **News and Manual are permanent public infrastructure. Their read surfaces arrive early; their operational authoring capabilities grow only when the project has the staff/content volume that justifies them.**

---

## 1. Cross-Cutting Rule — Always Publicly Reachable

Once implemented, `/news` and `/manual` remain available:

- before account creation;
- before sign-in;
- when account services are unavailable;
- after sign-in;
- from mobile, laptop, and desktop layouts.

Do not later move them behind authentication merely because the in-game shell becomes richer.

Important basic rules should remain publicly readable; use progression gating for spoilers/discoveries, not to force registration.

---

## 2. Phase 1 Extension — P1.7 Public News + Adventurer’s Guide Foundation

**Roadmap position:** immediately after P1.6 and before Phase 2 Tactical Combat Core.

P1.7 is a narrow public-product foundation. It does **not** pull the full Master Panel, live-world event engine, or mature CMS into Phase 1.

### Purpose

Give prospective players and early testers a polished public place to:

- see official updates;
- understand the current game;
- learn released mechanics;
- navigate into account entry without being forced to register first.

### Required public routes

```text
/news
/manual
```

### Required public-shell behavior

- persistent pre-login links to **News** and **Manual**;
- clear **Play / Sign In** path;
- signed-in users may still deliberately visit News/Manual instead of being force-redirected to `/game`;
- public routes do not depend on player profile/character loading;
- account-service readiness failures do not intentionally hide public News/Manual;
- appropriate footer/global navigation paths remain available after login.

### P1.7 News foundation

Implement the smallest intentional public News experience:

- News landing/feed;
- stable article detail URLs;
- category/type label;
- publish/update date;
- summary;
- safe structured article body;
- optional approved/requested cover/inline media;
- related Manual links where useful;
- responsive and accessible presentation;
- no fake historical archive.

Initial editorial content may remain source-controlled or use another deliberately simple validated source while the project has no real staff publishing need.

Do **not** build a production CMS merely to avoid one future migration.

The public read contract and content identity should nevertheless be clean enough that Phase 5 can swap in a versioned publication repository without redesigning the page.

### P1.7 Manual foundation

Implement the first public **Manual / Adventurer’s Guide** experience using the existing documentation specification:

- Manual landing/index;
- Start Here;
- public article routes;
- stable deep links;
- released-system categories;
- article summaries;
- Quick Answer / practical/deeper guidance composition where useful;
- approved/requested imagery/diagrams through the media system;
- search or a deliberately small browse/index experience appropriate to initial article volume;
- current-rule/version/last-updated treatment where useful;
- spoiler-safe visibility.

Initial content should cover the systems actually present by the end of Phase 1:

- What is AUREVANE?;
- Account & Security;
- Character Creation;
- Attributes & Derived Stats;
- Level / Character XP;
- Wayfarer’s Practice;
- FAQ / Troubleshooting;
- glossary for currently exposed terms.

The Start Here overview may explain future core identity such as tactical combat and Current + Legacy + Confluence at a high level so visitors know the intended game, but it must clearly distinguish **current/released** capabilities from planned future functionality.

### P1.7 media direction

The Manual should not ship as plain text on the current dark shell.

Use the existing design system and media pipeline to establish a modest public editorial identity with:

- stronger imagery;
- readable article composition;
- lighter/midtone adventure-oriented surfaces where the design tokens support them cleanly;
- captions/alt text;
- responsive figure treatment;
- no random placeholder production media.

Create traceable media requests for missing representative Manual/News artwork or diagrams rather than improvising low-quality assets.

### P1.7 technical boundaries

Do not introduce:

- live event scheduling;
- staff News CMS;
- full Manual editor;
- arbitrary rich HTML;
- public write endpoints;
- unreleased-content search indexes;
- duplicate rule databases;
- a new authentication system;
- a second media storage system.

### P1.7 acceptance gate

Phase 1 public-information work is complete when:

- an anonymous visitor can load `/news` and `/manual` directly;
- both are reachable from the public account-entry shell;
- a signed-in player can intentionally read them without forced `/game` redirection;
- current Phase 1 rules are understandable without facilitator help;
- the Manual looks like an intentional game guide rather than a README;
- public content remains spoiler-safe;
- phone/laptop/desktop layouts are usable and overflow-free;
- keyboard and screen-reader basics work;
- no public route exposes drafts, staff metadata, secrets, or private player state;
- account unavailability does not unnecessarily prevent reading public content.

---

## 3. External Testing Gate Before PV-1

Before recruiting meaningful external Phase 2 combat cohorts, AUREVANE should have a usable public Manual and News surface.

Why:

- testers need a canonical place to learn current controls/rules;
- patch/balance corrections need a trusted communication channel;
- onboarding feedback is less confounded by missing documentation;
- a prospective tester can understand the game's premise before creating an account.

This does not mean the Phase 2 combat Manual must exist before combat itself is implemented. It means the public information infrastructure exists and can expand alongside the combat ticket.

---

## 4. Phase 2 — Tactical Combat Documentation + Combat News

As the combat vertical slice becomes real:

### Manual expands with

- battlefield overview;
- Movement Budget + Action;
- movement/pathing;
- targeting/forecast;
- terrain/elevation/facing actually present in the slice;
- turn order;
- HP/MP/resources;
- statuses implemented in the slice;
- Guard/Wait/End Turn where released;
- screenshots/annotated diagrams from representative production-quality combat scenes;
- common tactical mistakes;
- relevant accessibility/controls.

### News expands with

- combat-slice release notes;
- important rule changes;
- balance/test adjustments that materially affect testers;
- known-issue notices when warranted.

PV-1 tester instructions should link to exact Manual sections rather than requiring separate undocumented explanation.

---

## 5. Phase 3 — Buildcraft Documentation Becomes a Signature Surface

The Manual should become exceptionally strong around AUREVANE’s signature systems:

- Discipline;
- Mastery;
- Current versus Legacy;
- Arts;
- Traits;
- Reactions;
- Movement Arts;
- Soulmarks;
- Confluences;
- loadouts;
- equipment/build interaction.

Use diagrams and side-by-side examples rather than trying to teach the entire system through prose.

The Confluence Preview Trial should deep-link to an appropriate spoiler-safe guide.

News should support Discipline/buildcraft balance posts that link to current canonical Manual rules.

PV-2 feedback may explicitly measure whether testers were able to understand the signature system using the normal UI + Manual rather than facilitator coaching.

---

## 6. Phase 4 — Roster Scale / Publication Discipline

As the playable roster expands:

- released Disciplines gain public Manual/guide identities where appropriate;
- hidden/unreleased Disciplines remain excluded from public search/navigation;
- current Arts/status/rule data may increasingly render from structured authoritative definitions;
- News patch notes become the official historical record of roster/balance changes;
- media/screenshots used in guides are checked for staleness when major UI/content changes land.

Do not create hand-maintained duplicated numeric tables if authoritative content data can safely drive the display.

---

## 7. Phase 5 — First Real Public Communications Operations

Phase 5 already introduces the first useful protected Master Panel shell, world events, story operations, and the Living World.

At this point News/Manual operations should become real staff tools rather than source-controlled-only editorial content.

### Public Communications MVP

Add a protected Master Panel area capable of:

- News drafts;
- News preview;
- News scheduling;
- News publication;
- News correction/archive;
- Manual article create/edit;
- Manual public/progression visibility;
- Manual preview;
- Manual publication;
- approved Asset Studio media attachment;
- public byline selection;
- basic revision history;
- audit records;
- anonymous desktop/mobile preview.

### Event integration

A published News event post should be able to reference the authoritative event object so public status/timing remains coherent.

World Pulse may link to News for editorial context.

News does not replace World Pulse.

### Story/spoiler integration

Manual/News publication must respect story reveal and spoiler metadata.

Ordinary Event Staff must not be able to reveal late Aurevane canon through News merely because they can run an event.

### Phase 5 gate

Authorized staff can publish an event announcement and update a related public Manual article through controlled operations without editing application source code.

---

## 8. Phase 6 — Co-op

Manual adds:

- parties;
- invites;
- party finder;
- shared quest behavior;
- co-op combat flow;
- disconnect/rejoin rules;
- pings and coordination.

News supports major co-op feature/operation changes without becoming a second party-status system.

---

## 9. Phase 7 — Expeditions

Manual adds visual guides for:

- Easy / Standard / Deep Expeditions;
- run structure;
- Threat/modifiers;
- suspension/reconnect;
- loot expectations;
- bosses without leaking hidden mechanics;
- party/session expectations.

News supports Expedition releases, rotations, anomalies, and major rule/balance changes.

Event-linked Expedition timing still derives from authoritative event state.

---

## 10. Phase 8 — PvP / Competitive Publication Standard

PvP documentation is especially sensitive to drift.

Manual must expose current public competitive rules for released queues, including:

- queue type;
- matchmaking basics;
- timing/timeout behavior;
- Arena Tempering;
- disconnect rules;
- season structure;
- mode-specific overrides;
- Veteran Edge rules when later applicable.

Balance patches should link from News directly to the affected Manual rules.

Competitive rule changes should not rely only on Discord/social posts or ephemeral announcements.

---

## 11. Phases 9–12 — Content Scale

### Phase 9 — Full Discipline Roster

Scale public guides only with released content and preserve hidden-content boundaries.

### Phase 10 — Social World

Manual gains guild/social/moderation/help guidance.

News may support community announcements without becoming a user-generated social feed.

### Phase 11 — Economy

Manual documents:

- stores;
- trading;
- marketplace;
- crafting;
- binding;
- important inventory protections;
- current economy rules.

Economy changes that materially affect players should produce appropriate News communication.

### Phase 12 — Nations

Manual explains allegiance, campaigns, rankings, warfare and season rules without flattening nation lore into generic mechanics.

News becomes important for nation campaign/season communication while authoritative campaign state remains in the game systems.

---

## 12. Phase 13 — Complete Publication Operations

The complete Master Panel should mature Public Communications into a strong owner/staff operating system.

Add as justified:

- granular News/Manual permissions;
- publication calendar;
- scheduled coordinated releases;
- revision diff/history;
- correction/supersede workflow;
- dependency/impact preview;
- “this change requires News/Manual update” release flags;
- linked balance/content version records;
- content/search analytics;
- stale article detection;
- screenshot/media staleness review;
- broken-link detection;
- advanced search metadata;
- content localization architecture if/when localization becomes real;
- audit and rollback;
- emergency unpublish controls;
- public preview of the exact anonymous experience.

The Balance Lab / Content Studios should be able to flag communication/documentation impact before production publication.

---

## 13. Phase 14 — Public Editorial Art/Audio Polish

The Manual and News participate in the dedicated media polish pass.

Polish may include:

- article/category art;
- diagrams;
- annotated final screenshots;
- region/map illustrations;
- better buildcraft/combat teaching graphics;
- attractive release/event covers;
- refined editorial typography/layout;
- responsive media crops;
- accessibility review;
- Luminous Adventure visual consistency.

Do not add autoplay music simply because these are public pages.

If subtle ambience/media is ever used, it must follow normal audio consent/settings rules.

---

## 14. Phase 15 — Hardening

Hardening must test:

- anonymous access under auth/account-service failure;
- public read authorization boundaries;
- draft/scheduled/staff-content leak prevention;
- XSS/rich-content sanitization;
- unsafe links;
- spoiler/search leakage;
- article slug collisions;
- schedule/revision race conditions;
- cache invalidation after correction/unpublish;
- media-rights/provenance requirements;
- staff publication permission boundaries;
- audit integrity;
- high-traffic News events;
- Manual search performance;
- archived article link stability;
- mobile/keyboard/screen-reader accessibility;
- staging/preview indexing controls.

---

## 15. Release / Ticket Rule

Every ticket that materially changes player-facing behavior must explicitly consider:

```text
NEWS IMPACT
- none / patch note / balance post / event notice / maintenance notice

MANUAL IMPACT
- article create/update
- contextual-help update
- glossary update
- screenshot/diagram update
- spoiler/visibility impact
```

This complements the documentation-impact rule in `docs/PLAYER_MANUAL.md`.

A ticket does not need a News post for every internal refactor.

The purpose is to make meaningful player-facing change communication deliberate rather than forgotten.

---

## 16. Success Condition

This roadmap extension succeeds when AUREVANE develops like:

```text
PUBLIC NEWS + MANUAL FOUNDATION
        ↓
COMBAT / BUILDS ADD THEIR GUIDES
        ↓
REAL STAFF PUBLISHING ARRIVES WITH LIVE WORLD
        ↓
EVERY MAJOR SYSTEM FEEDS THE SAME PUBLIC KNOWLEDGE MODEL
        ↓
BALANCE / EVENTS / CONTENT UPDATES LINK TO CURRENT RULES
        ↓
MATURE PUBLICATION OPERATIONS + POLISH + HARDENING
```

The result should be a game where a visitor can learn before signing up, a player can verify rules without leaving AUREVANE, and staff can communicate changes without source-code edits once live operations mature.
