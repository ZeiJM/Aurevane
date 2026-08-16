# AUREVANE — Public News & Manual Product System

**Status:** Authoritative public-information specification subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, `docs/WORLD.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/MEDIA_PIPELINE.md`, and `docs/ROADMAP_PUBLIC_INFORMATION.md`.

**Direction approved:** 2026-08-16.

AUREVANE requires two permanent public-facing information surfaces that remain available **before account creation, before sign-in, and after sign-in**:

- **News** — the official record of what changed, what is happening, and what the AUREVANE team needs players to know.
- **Manual** — the attractive, spoiler-safe canonical guide to what AUREVANE is and how its released systems work.

The core rule is:

> **A prospective player must be able to understand the game and inspect its current official communications without creating an account.**

These are game product surfaces, not developer documentation pasted onto the website.

---

## 1. Permanent Public Routes

The intended canonical routes are:

```text
/news
/manual
```

They are public by default and must not require:

- an authenticated account;
- a character;
- account-service readiness;
- a valid gameplay session;
- progression state merely to read basic rules.

A signed-in player may use the same canonical routes. Do not maintain a second incompatible in-game copy of News or the Manual.

Authenticated presentation may add useful context such as **Return to Game**, progression-aware recommendations, or unread-state indicators, but the underlying public article remains the same published content when its audience is public.

### Public navigation

The pre-login/public shell should always provide clear access to at least:

```text
NEWS
MANUAL
PLAY / SIGN IN
```

Once authenticated, the equivalent public shell may use:

```text
NEWS
MANUAL
RETURN TO GAME
```

News and Manual must remain reachable from sensible global navigation/footer locations after login as well.

Do not force an authenticated user away from `/news` or `/manual` simply because a valid game session exists.

---

## 2. Clear Separation of Responsibilities

AUREVANE has several information systems. They must reinforce each other without becoming duplicates.

### News answers

> What changed? What is happening? What did the team announce?

Examples:

- patch notes;
- balance changes;
- live-event announcements;
- maintenance notices;
- new feature/content releases;
- season/tournament information;
- important bug-fix notices;
- development/community updates when appropriate.

### Manual answers

> How does the game work right now? What am I getting into?

Examples:

- what AUREVANE is;
- character creation;
- progression;
- combat;
- Disciplines and buildcraft;
- Current + Legacy;
- Confluences;
- Soulmarks;
- equipment;
- world travel;
- co-op;
- Expeditions;
- PvP;
- economy;
- accessibility;
- account/security basics;
- troubleshooting.

### World Pulse answers

> What is happening in the live world that matters to my character right now?

World Pulse is contextual gameplay state, not the public editorial archive.

### Archive answers

> What has my character legitimately discovered about the world and its history?

The Archive is discovery/lore gameplay, not a rules wiki.

### Relationship rule

News may link to Manual articles and public event pages.

The Manual may link to the News post that explains a recent rule change.

World Pulse may link to a public News announcement for background/context.

The Archive must not be replaced by public Manual exposition.

---

# PART I — NEWS

## 3. News Product Goal

News should make AUREVANE feel actively operated and trustworthy.

A player should be able to answer:

- What changed recently?
- Is something happening now?
- Was this Art/Discipline/item adjusted?
- Is there maintenance?
- When did this season/event begin?
- What did the developers actually say?
- Where can I read the current rule after a change?

News should be useful to prospective players too. A healthy archive of real updates communicates that the world is alive without turning the landing page into promotional clutter.

---

## 4. News Information Architecture

The `/news` landing page should eventually support:

- one featured/pinned announcement when genuinely important;
- a chronological latest-news feed;
- clear article type/category;
- publish date;
- meaningful summary/deck;
- optional cover/key image;
- filters where content volume justifies them;
- search where content volume justifies it;
- direct stable article URLs;
- archive browsing;
- visible active-event state where linked to an authoritative public event;
- responsive phone/laptop/desktop presentation.

Do not show a giant promotional carousel simply because News contains images.

The newest important information should be quickly scannable.

---

## 5. News Types

Initial editorial categories may include:

```text
PATCH NOTES
BALANCE
EVENT
MAINTENANCE
CONTENT UPDATE
DEVELOPMENT UPDATE
COMMUNITY
COMPETITIVE / SEASON
```

The taxonomy may evolve, but categories should remain meaningful rather than multiplying into dozens of nearly identical labels.

### Patch Notes

Patch notes should favor structured readability:

```text
OVERVIEW
ADDED
CHANGED
BALANCE
FIXED
WORLD / EVENTS
KNOWN ISSUES (when useful)
```

Not every release needs every section.

### Balance posts

A balance post should explain enough context to understand the change without exposing exploitable internal implementation detail.

Where practical it should link directly to updated canonical Manual entries.

### Event posts

An event announcement may include:

- event name;
- public summary;
- start/end window;
- affected region/system;
- participation requirements;
- highlights/rewards that are intentionally public;
- approved art;
- relevant Manual article;
- live status derived from the authoritative event when public.

Do not maintain a second contradictory event clock inside News when the event system already owns the real timing.

### Maintenance notices

Maintenance communication should be concise and operational:

- expected start;
- expected duration/window when known;
- systems affected;
- status updates;
- completion/resolution note.

Do not expose security-sensitive incident details merely to appear transparent.

---

## 6. News Article Model

A public News article should support concepts equivalent to:

```text
id
slug
title
summary
category
body_blocks
cover_asset_id
inline_media_refs
public_author_label
publish_at
last_updated_at
effective_at (optional)
related_release/build/content_version (optional)
related_event_id (optional)
related_manual_articles
related_content_ids
status
revision_note (optional)
seo/share metadata when appropriate
```

Do not expose staff email addresses, private account identifiers, internal role IDs, unreleased content IDs, secret environment names, or privileged notes through the public model.

---

## 7. News Lifecycle and Historical Trust

Recommended lifecycle:

```text
DRAFT
  ↓
PREVIEW / REVIEW
  ↓
SCHEDULED (optional)
  ↓
PUBLISHED
  ↓
CORRECTED / SUPERSEDED (when necessary)
  ↓
ARCHIVED
```

Published News is part of the game's official history.

### Correction rule

Do not silently rewrite consequential published history merely because wording was wrong later.

For meaningful corrections:

- update the article through a new revision;
- expose a concise correction/update note where appropriate;
- preserve internal version/audit history;
- keep old external links working where practical.

Small typo/accessibility fixes do not need theatrical correction banners.

### Deletion rule

Normal published News should be archived or superseded rather than deleted.

Hard deletion is reserved for exceptional legal, privacy, security, or accidental-publication situations and must be privileged/audited.

---

## 8. Authorship

AUREVANE should distinguish internal authorization from public byline identity.

Public bylines may use approved identities such as:

- AUREVANE Team;
- Balance Team;
- Live Operations;
- a named developer/community representative when deliberately public.

The public byline must never reveal a private staff identity merely because that person clicked Publish.

The audit log separately records the actual authenticated publisher.

---

## 9. News and Live Events

News is editorial communication; the event system is authoritative gameplay state.

Therefore:

```text
NEWS POST
   ↓ references
PUBLIC EVENT RECORD / LIVE EVENT STATE
   ↓
WORLD PULSE / MAP / GAMEPLAY
```

When a News article refers to an ongoing event, its displayed status should derive from the public event state where practical:

```text
UPCOMING
LIVE
RESOLVING
ENDED
```

Do not claim an event is live because a paragraph says so when the authoritative event is already over.

After the event, the article remains useful historical context.

---

## 10. News and Balance Publication

A balance/configuration publication should be able to declare a **public communication impact**.

Examples:

```text
NO PUBLIC NOTE REQUIRED
PATCH NOTE REQUIRED
BALANCE POST REQUIRED
MANUAL UPDATE REQUIRED
PATCH NOTE + MANUAL UPDATE REQUIRED
```

The Master Panel should eventually warn when a player-facing balance package is about to publish while a required News/Manual update remains unpublished or stale.

This is not permission to block emergency fixes when immediate safety requires publication. Emergency changes may publish first with a required follow-up communication task.

---

# PART II — MANUAL

## 11. Manual Product Goal

The Manual is the public **Adventurer's Guide** to AUREVANE.

It must answer the pre-account question:

> **What kind of game is this, and what will I actually be doing?**

A visitor should be able to understand AUREVANE's main gameplay identity before deciding whether to create an account.

This means important released systems are not hidden behind login merely to force registration.

The existing comprehensive documentation rules in `docs/PLAYER_MANUAL.md` remain authoritative. This document adds the anonymous-access and public-product requirements.

---

## 12. Public Manual Landing Experience

`/manual` should feel like entering a beautifully produced game guide, not opening developer documentation.

The landing experience should lead with **Start Here** and provide attractive visual paths into major topics.

A mature structure may include:

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

Before systems are released, do not fill the Manual with detailed fake documentation for functionality players cannot use.

Where useful for prospective players, an unreleased/planned area may be described at a high level only if clearly labeled and consistent with current public release messaging.

Do not make unreleased features appear playable merely to make the Manual look larger.

---

## 13. “What Am I Getting Into?” Layer

The public Start Here experience should make AUREVANE understandable in minutes.

It should eventually explain visually and concisely:

- persistent character identity;
- the main activity loop;
- tactical battlefield combat;
- the Movement Budget + Action concept;
- Disciplines;
- Current + Legacy;
- Confluences;
- Soulmarks;
- build experimentation;
- world exploration and quests;
- co-op/Expeditions;
- PvP;
- long-lived progression;
- living world/events;
- what the game does **not** require, such as permanent death or mandatory daily energy.

This is not a marketing feature grid. It is a useful orientation guide with enough specificity that the player knows the game's shape.

---

## 14. Manual Article Presentation

A good Manual article may combine:

```text
ARTICLE HERO / TOPIC ART
TITLE + SUMMARY
QUICK ANSWER
PRACTICAL GUIDE
VISUAL EXAMPLE / DIAGRAM
DEEP MECHANICS
COMMON QUESTIONS / MISTAKES
RELATED SYSTEMS
RELATED NEWS / RECENT CHANGES
LAST UPDATED / RULE VERSION
```

Do not force every article into the exact same block arrangement when another composition communicates better.

### Visual learning

Use approved, purposeful visual media such as:

- annotated screenshots;
- tactical-board examples;
- diagrams;
- Art/Discipline icons;
- character/build illustrations;
- region/map excerpts;
- equipment examples;
- flow diagrams;
- short lightweight motion examples where they materially help and reduced-motion alternatives exist.

Manual visuals use stable Asset IDs and the Media Pipeline.

Random web imagery, placeholder AI output, low-quality autogenerated diagrams, and screenshots that are obviously stale are not acceptable production documentation.

---

## 15. Manual Visual Direction

The Manual is one of AUREVANE's first-impression surfaces and should participate in the approved **Luminous Adventure** direction.

It should feel:

- inviting;
- illustrated;
- readable;
- adventurous;
- warm enough to distinguish itself from a dark admin dashboard;
- consistent with the game rather than styled like a separate corporate support site.

Use hierarchy, whitespace, imagery, maps, icons, natural materials, and restrained ornamental framing deliberately.

Do not cover every article in faux parchment texture or decorative fantasy clutter.

The text must remain extremely readable.

---

## 16. Public Versus Discovery-Gated Knowledge

Anonymous access does **not** mean spoiling the game.

The public Manual should explain systems while protecting discoveries.

Examples:

- explain what Confluences are without listing hidden undiscovered pairings;
- explain how the Archive works without revealing unrecovered lore;
- explain Soulmark mechanics without exposing secret branches/revelations;
- explain Expedition structure without revealing secret rooms/boss mechanics;
- explain the Aurevane premise only to the currently public story tier.

The visibility model from `docs/PLAYER_MANUAL.md` remains valid:

```text
public
progression_gated
staff
owner
```

### Default rule

Basic rules and released system orientation should generally be **public**.

Use progression gating primarily for spoiler/discovery protection, not as an arbitrary requirement to create an account before learning how the game works.

---

## 17. Manual Search and Deep Linking

The public Manual should support stable, shareable article/deep-section URLs.

Search should eventually understand:

- article titles;
- game terminology;
- common abbreviations;
- common natural-language questions;
- released Discipline/Art/status names where public;
- typo-tolerant common searches where practical.

Important UI help should deep-link to the exact relevant section, not merely the Manual home page.

News patch notes should also deep-link to current rules.

---

## 18. Structured Authoritative Data

The Manual should not become a second hand-maintained copy of exact game configuration.

Where safe and practical, article components may render authoritative structured data such as:

- current stat definitions;
- released status definitions;
- queue rules;
- event timing;
- progression requirements;
- current item/Art values;
- current reset/preserve rules.

Narrative explanation, examples, strategy orientation, and prose remain authored content.

The result is:

```text
AUTHORITATIVE STRUCTURED RULE DATA
+
CURATED HUMAN-READABLE EXPLANATION
+
APPROVED VISUAL TEACHING MEDIA
```

---

# PART III — SHARED PUBLICATION ARCHITECTURE

## 19. Safe Rich Content

News and Manual authoring must not become arbitrary executable content.

Prefer a controlled rich-content grammar such as validated blocks for:

- paragraphs;
- headings;
- lists;
- callouts;
- tables;
- images/figures;
- galleries;
- video/motion references if approved later;
- structured change lists;
- data-backed rule cards;
- links;
- code-like notation only where genuinely useful.

Do not allow ordinary staff to paste arbitrary JavaScript, SQL, iframe embeds, or unsanitized HTML into public publication fields.

External links require safe handling.

---

## 20. Published-Only Public Boundary

The anonymous/public read model may expose only content explicitly approved for public publication.

It must not leak:

- drafts;
- scheduled-but-secret posts before their release time;
- staff notes;
- internal comments;
- hidden revisions;
- unpublished assets;
- late-story metadata;
- private analytics;
- staff account identities;
- secret content IDs through search/autocomplete;
- privileged preview tokens.

Preview access uses a separate protected authorization path.

---

## 21. Availability and Account Independence

News and Manual are public information infrastructure.

They should remain usable even when account entry is unavailable or intentionally disabled.

Implementation should therefore avoid coupling public reads to:

- Supabase Auth session success;
- player-profile provisioning;
- character loading;
- gameplay account-readiness flags.

Published content may still use the same infrastructure/database where appropriate, but the request path must be independently public and fail gracefully.

As the system matures, sensible caching of published content should reduce unnecessary database work and improve resilience/performance.

---

## 22. Search Engine / Shareability Direction

Production public News and Manual content should be friendly to direct links and discovery.

Where appropriate:

- stable canonical URLs;
- useful page titles/descriptions;
- social/share preview metadata;
- production sitemap inclusion;
- semantic article markup;
- archived content that remains linkable;
- staging/preview environments protected from accidental indexing.

Do not reveal spoiler content merely for SEO completeness.

---

## 23. Analytics and Privacy

Anonymous News/Manual usage may be measured in a privacy-respecting way to improve information quality.

Useful aggregate signals include:

- article views;
- common searches;
- searches with no useful result;
- broken-link frequency;
- most-used contextual deep links;
- Manual articles viewed after a News change;
- device/layout problems.

Do not require tracking identity simply because someone reads public documentation.

---

# PART IV — MASTER PANEL OPERATIONS

## 24. Public Communications Operations

The Master Panel should eventually include a dedicated **Public Communications** capability rather than hiding News editing inside an unrelated event form.

A useful information architecture is:

```text
PUBLIC COMMUNICATIONS
  ├── News
  ├── Manual
  ├── Publication Calendar
  └── Public Preview / Recent Changes
```

News, Manual, and Live Event systems remain distinct content domains but share publication/version/audit conventions.

---

## 25. News Editor

Authorized staff should eventually be able to:

- create a News draft;
- choose category;
- write structured rich content;
- attach approved Asset Studio media;
- link Manual articles;
- link released content/config versions;
- link a public event;
- choose an approved public byline;
- preview desktop/mobile rendering;
- preview the anonymous view;
- schedule publication;
- publish immediately when authorized;
- create transparent corrections;
- archive/supersede;
- inspect revision history;
- inspect analytics;
- see content dependencies/related changes;
- roll back a bad revision safely.

---

## 26. Manual Editor

The existing Manual Editor requirements remain, with additional emphasis on anonymous presentation.

Authorized staff should be able to:

- create/edit articles;
- build visual article layouts from safe content blocks;
- attach Asset Studio media;
- create diagrams/screenshots through approved media workflow;
- set public/progression/staff/owner visibility;
- set spoiler/reveal metadata;
- preview anonymous desktop/mobile rendering;
- schedule/publish;
- inspect linked game definitions;
- review stale screenshots/data relationships;
- roll back;
- see News posts that reference the article.

---

## 27. Permission Direction

The current broad announcement/documentation permissions should evolve toward granular server-enforced permissions conceptually similar to:

```text
publications.news.view
publications.news.edit
publications.news.schedule
publications.news.publish
publications.news.correct
publications.news.archive

documentation.manual.view
documentation.manual.edit
documentation.manual.schedule
documentation.manual.publish
```

High-risk emergency deletion/unpublication may require stronger Owner/operations authority.

Public access does not imply public mutation.

Every write remains authenticated, authorized, validated, versioned, and audited.

---

## 28. Cross-System Publication Checklist

When a player-facing system changes, the authoring workflow should eventually answer:

```text
DOES NEWS NEED AN UPDATE?
DOES THE MANUAL NEED AN UPDATE?
DOES CONTEXTUAL HELP NEED AN UPDATE?
DO SCREENSHOTS / DIAGRAMS NEED REFRESHING?
IS THERE A SPOILER IMPACT?
IS THERE AN EVENT / SEASON TIMING IMPACT?
ARE RELATED ASSETS STILL CURRENT?
```

This extends the documentation-drift rules already established in `docs/PLAYER_MANUAL.md`.

---

# PART V — QUALITY, SECURITY, AND ROADMAP RULES

## 29. Accessibility

Both public surfaces require:

- semantic headings/landmarks;
- keyboard navigation;
- visible focus;
- screen-reader compatible navigation/search;
- sufficient contrast;
- zoom-friendly type;
- alt text/captions for meaningful imagery;
- reduced-motion handling;
- touch-safe controls;
- no critical information conveyed only by image/color/audio.

The Manual should be among the most accessible parts of AUREVANE because it is itself a learning/accessibility tool.

---

## 30. Performance

Public information surfaces should be fast even when richly illustrated.

Use:

- responsive derivatives;
- lazy loading below the fold;
- reasonable image budgets;
- cached published content where appropriate;
- progressive enhancement for nonessential motion/media;
- bounded search queries;
- pagination or cursoring when News archives become large.

Do not make a player download a desktop hero master merely to read one rules paragraph on a phone.

---

## 31. Spoiler and Security Review

Every public publication path must be reviewed against:

- `docs/LORE_BIBLE.md` spoiler tiers;
- private/staff metadata exposure;
- unpublished content leakage;
- XSS/rich-content injection;
- unsafe links;
- asset rights/provenance;
- author identity privacy;
- cache invalidation after correction/unpublish;
- accidental staging/preview indexing.

A public Manual search endpoint is a particularly important spoiler boundary: it must not reveal hidden article titles or unreleased content merely because those rows exist internally.

---

## 32. Initial Content Quality

The first implementation does not need hundreds of articles or years of News history.

It does need to look intentional.

A good initial public Manual set includes at minimum the released/implemented equivalents of:

- Start Here / What is AUREVANE?;
- Account & Security;
- Character Creation;
- Attributes & Derived Stats;
- Level / Character XP;
- Wayfarer's Practice once P1.6 is live;
- current FAQ/troubleshooting;
- glossary for terms already exposed in the build.

A good initial News set may include:

- a welcome/development-state article;
- one structured release/update post establishing the format;
- current service/availability information only where genuinely useful.

Do not fabricate fake historical patch notes to make the archive look busy.

---

## 33. Definition of Success

This public information system succeeds when:

- a person who has never created an account can open News and the Manual;
- they can understand what the current AUREVANE build/game is and how its released systems work;
- the Manual is visually attractive enough to be part of the game's presentation quality;
- signed-in players still use the same canonical information surfaces;
- official changes have a durable trustworthy News history;
- balance/event posts link to current canonical rules;
- the Manual remains spoiler-safe;
- account/auth outages do not unnecessarily erase public information access;
- staff can eventually publish both systems through safe Master Panel workflows;
- public content cannot be mutated by ordinary players;
- images/diagrams/audio/media remain versioned and owner-replaceable through the Media/Asset system;
- documentation/news updates become a normal part of releasing player-facing changes rather than an afterthought.
