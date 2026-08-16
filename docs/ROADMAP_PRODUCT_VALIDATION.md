# AUREVANE — Roadmap Product Validation Gates

**Status:** Binding extension of `docs/ROADMAP.md` for product validation, commercial risk control, scope expansion, and external playtesting.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. This document does not replace the feature roadmap; it defines the evidence gates that determine when the project is allowed to expand from one expensive product layer to the next. `docs/PRODUCT_STRATEGY_AND_COMMERCIAL_VALIDATION.md` defines the reasoning and commercial strategy behind these gates.

**Direction approved:** 2026-08-16.

The roadmap still answers **what comes next**. This extension adds another question:

> **What must we prove before we are allowed to make the next layer bigger?**

AUREVANE may continue implementing its planned phases, but major roster/content/queue/live-ops expansion must respect the gates below.

---

## 1. Non-Negotiable Validation Rules

1. **Evidence before expansion.** Do not use more content to hide a weak core loop.
2. **Representative quality before large cohorts.** Testers should see a small polished slice, not a giant knowingly broken build.
3. **Instrument before arguing.** Important product questions require telemetry and structured playtest notes.
4. **Real humans before scale.** Simulation is useful for correctness/balance but cannot prove fun, clarity, identity, social desire, or willingness to return.
5. **No artificial calendar waiting in QA.** Non-production environments must support accelerated pacing/test-state setup for long-horizon systems.
6. **One active implementation ticket remains the default.** Validation work is ticketed like any other work; it does not authorize uncontrolled parallel feature development.
7. **A failed gate redirects work backward to the weak layer.** It does not authorize jumping ahead because the later feature sounds exciting.
8. **Metrics are decision aids, not vanity targets.** Qualitative evidence, technical failures, sample quality, cohort composition, and confounders must be reviewed alongside numbers.

---

## 2. Validation Instrumentation Baseline

Before meaningful external playtesting, AUREVANE needs a small, privacy-respecting product telemetry boundary.

Do **not** add a huge analytics platform merely to satisfy this document. Reuse existing structured logging/telemetry architecture where practical and introduce only the persistence/aggregation needed to answer current questions.

Initial events should be able to represent, when their systems exist:

```text
account_entry_started
account_entry_completed
character_creation_started
character_creation_completed
first_game_session_started
first_combat_started
first_combat_completed
combat_abandoned
confluence_preview_started
confluence_preview_completed
legacy_unlocked
confluence_first_used
build_changed
session_ended
return_session_started
party_search_started
party_formed
expedition_started
expedition_completed
pvp_queue_entered
pvp_match_found
pvp_queue_abandoned
premium_store_viewed
checkout_started
checkout_completed
checkout_failed
```

Event payloads should use stable system/content identifiers where useful and avoid unnecessary personal information.

The event taxonomy grows only when a real product question needs it.

---

## 3. Phase 1 Integration — Character Entry / Funnel Foundation

Phase 1 remains Character Foundation. It does not become a marketing phase.

However, the following product evidence must be possible before Phase 1 is considered ready to feed a public combat slice:

- account → authenticated shell flow is technically reliable;
- character creation can be completed without facilitator help;
- character creation remains a few-minute experience rather than a pre-game study session;
- Foundation Discipline and four-attribute wording are understandable;
- narrow-screen and laptop-height experiences do not create major abandonment friction;
- character creation start/completion/failure telemetry exists by the time P1.3 is mature enough for representative external use;
- XP/progression telemetry in P1.5 records authoritative source/provenance and milestone speed;
- Wayfarer's Practice in P1.6 is not evaluated as a retention success merely because people click Claim — later cohorts must show whether it improves healthy return behavior.

### Phase 1 product gate

Proceed to Phase 2 because the character foundation is technically ready, **not** because retention has been proven. Phase 1's gate is intentionally modest:

> A tester can get from account entry to a persistent understandable character without the setup itself becoming a reason to quit.

If account/creation friction dominates tester feedback, fix it before recruiting larger combat cohorts.

---

## 4. PV-1 — Tactical Combat Proof Gate

**Roadmap position:** Phase 2, before large Discipline/content expansion.

**Purpose:** prove that the baseline tactical game is enjoyable when stripped of the future feature mountain.

### Minimum representative slice

Use the smallest polished content set that can demonstrate:

- movement;
- one Action;
- positioning/terrain;
- basic targeting/forecast;
- at least one status/setup-payoff interaction;
- meaningful enemy decisions;
- clear turn economy;
- satisfying audiovisual feedback;
- one or more battle maps with real tactical decisions.

Do not wait for 16 Disciplines, guilds, full world content, economy, or PvP.

### Required evidence

Use internal QA followed by roughly 20–50 representative external/trusted testers when the build is stable enough.

Capture:

- first-battle completion;
- abandon/soft-lock/technical failure rate;
- time to first confident action;
- battle duration distribution;
- frequency of obvious misclick/targeting confusion;
- whether players understand why outcomes happened;
- whether players voluntarily choose another battle/scenario when offered;
- whether players can identify at least one tactical decision they made;
- qualitative comments on pace, clarity, responsiveness, audiovisual impact, and desire to replay.

### Decision standard

There is no single magic percentage that proves fun. The gate passes when the evidence shows **repeatable voluntary replay desire** and testers are discussing tactical choices rather than mainly fighting the interface.

A provisional warning condition is present if fewer than roughly half of representative testers voluntarily choose another available fight/build attempt after completing the first one, excluding testers blocked by time or technical failure. Treat that as a signal to investigate, not an automatic statistical verdict.

### If the gate fails

Iterate:

- input feel;
- action/targeting clarity;
- battle pacing;
- encounter design;
- terrain consequences;
- enemy behavior;
- turn feedback;
- animation/audio timing;
- information density.

Do **not** respond by adding more classes, regions, or metagame systems.

---

## 5. PV-2 — AUREVANE Identity / Buildcraft Gate

**Roadmap position:** Phase 3, before Phase 4 scales the playable roster aggressively.

**Purpose:** prove that Current + Legacy + Confluence + Soulmark is not merely complex on paper but produces memorable experimentation.

### Minimum representative slice

A preferred early proof set is approximately:

- 4 representative Disciplines with meaningfully different tactical roles;
- the canonical Confluences required by those pairs;
- 2 representative Soulmarks;
- a small equipment set that changes decisions rather than only stats;
- saved/test build switching sufficient for repeated experiments;
- a **Confluence Preview Trial** accessible during early onboarding without granting permanent Mastery/Legacy progression.

Exact counts may change if a smaller set can prove the thesis honestly.

### Confluence scope rule

For production planning, the base Confluence uses the canonical unordered Discipline pair unless a reviewed design requires a directional override.

This keeps every released pairing meaningful while preventing Current→Legacy and Legacy→Current from automatically doubling authoring/test burden.

### Required evidence

Capture:

- whether testers can explain Current versus Legacy in their own words;
- whether the temporary Confluence Preview communicates the future fantasy;
- whether players understand that permanent Legacy access must still be earned;
- number of pairings/build changes voluntarily attempted;
- Confluence/Soulmark/equipment changes per tester;
- whether build changes produce observable strategy changes;
- whether testers ask "what happens if I combine X with Y?" without being coached into that question;
- which combinations feel mandatory, pointless, unreadable, or redundant;
- time required to configure a build;
- whether players can recover from a bad experiment without feeling trapped.

### Gate pass condition

The gate passes when multiple testers independently demonstrate **curiosity-driven build experimentation** and the mechanic is remembered as distinctive to AUREVANE.

If most testers pick one obviously dominant package and stop experimenting, the gate has not passed even if combat win rates look balanced.

### If the gate fails

Improve:

- Confluence distinctiveness;
- preview/compare UX;
- early build recommendations;
- terminology;
- loadout friction;
- weak/redundant pair designs;
- Soulmark/equipment interaction;
- onboarding timing.

Do not solve it by writing a larger manual.

---

## 6. Phase 4 Integration — Discipline Roster Expansion Gate

Phase 4 should not jump directly from proof-of-concept to 16 Disciplines merely because 16 is the mature alpha target.

Use staged roster bands:

```text
4 representative Disciplines
  ↓ identity proof
6–8 Disciplines
  ↓ balance/content-production proof
12 Disciplines
  ↓ broader meta proof
16 Disciplines
  ↓ mature Closed Alpha target
```

Before each band expands, review:

- new canonical Confluence count created by the added Disciplines;
- authoring/test/media burden;
- ability/effect reuse versus bespoke code growth;
- matchup coverage;
- role/archetype coverage;
- equipment interaction burden;
- AI coverage burden;
- content defects per Discipline;
- whether the previous roster still contains meaningful underused options.

Adding a Discipline is approved because it creates enough new play to justify every pair and test it creates.

---

## 7. PV-3 — First-Session / Return-Loop Gate

**Roadmap position:** Phase 5 once a small world/progression loop exists; before large world/content production.

**Purpose:** test whether AUREVANE gives players reasons to return after the novelty of the first tactical/build session.

### Representative slice

Use a deliberately small but coherent loop:

- one strong region/settlement path;
- short quest/activity chain;
- several enemy/encounter variants;
- targeted item goals;
- visible Discipline/Mastery/build goals;
- one meaningful world-change/event sample when ready;
- World Pulse only if it can show real current value rather than empty placeholders.

### Required evidence

Track cohorts rather than anecdotes:

- character-creation completion;
- first-combat completion;
- first-session length distribution;
- session-end reason when inferable or directly collected;
- return sessions by day/cohort;
- build changes between sessions;
- goals selected/completed;
- progression bottlenecks;
- technical failure rate;
- voluntary feedback on "what would make you come back?"

Use D1/D7/D30 cohort retention when sample size and test duration make them meaningful, but do not compare blindly against mobile-game benchmarks. AUREVANE must establish its own baseline and improve it across comparable cohorts.

### Red-flag rule

If return behavior is weak, first investigate:

- whether the hook arrived quickly enough;
- whether combat/build experimentation stayed fresh;
- whether the next goal was clear;
- whether sessions ended from friction/technical problems;
- whether progression felt artificially slowed;
- whether the world offered a meaningful reason to return.

Do not immediately intensify FOMO or calendar gates.

---

## 8. 180-Day Progression Integration

The approximately 180-day production target now means:

> **minimum default age for completing the first full character era / First Horizon / Rekindling eligibility**, combined with required gameplay milestones.

It does **not** mean every endgame-grade activity must remain unavailable until day 180.

### Roadmap implications

- Phase 5+ may expose advanced/challenging content earlier when gameplay progression qualifies the player.
- Expeditions and PvP can become serious before First Horizon.
- Endgame systems must be testable on accelerated/staged characters.
- Pacing forecasts/simulation should be introduced progressively once XP/Horizon/Mastery complexity warrants it; the first useful simulator does not need to wait for the complete Phase 13 Master Panel.
- QA requires supported non-production time advancement or direct authorized state fixtures rather than manual database hacks.

### Long-horizon validation

Before live Rekindling:

- simulate expected pacing;
- run accelerated QA cycles;
- observe real partial-length cohorts;
- validate each progression band for meaningful goals;
- confirm no calendar gate exists mainly to stretch content;
- confirm serious players have worthwhile activity even while the final cycle-completion clock is not yet satisfied.

---

## 9. PV-4 — Co-op / Expedition Proof Gate

**Roadmap position:** Phases 6–7.

**Purpose:** prove that playing with other humans improves the game and does not create a population-dependent progression trap.

Track:

- party-search starts;
- successful formations;
- time to party;
- invite acceptance;
- abandoned searches;
- disconnect/rejoin;
- expedition completion;
- repeat grouping/rematch;
- party member retention across runs;
- solo players blocked from goals;
- communication/coordination friction;
- whether roles/builds create actual teamwork.

### Gate rule

Deep three-player content may be a major prestige/progression pillar only when party formation is healthy enough for the intended audience.

If concurrency is insufficient:

- use scheduled community windows;
- improve party finder;
- preserve alternative solo progression where appropriate;
- scale low-stakes content flexibly;
- consider tightly scoped companions later only if evidence demonstrates a need.

Do not make mandatory progress depend on an empty queue.

---

## 10. PV-5 — PvP Population Safety Gate

**Roadmap position:** Phase 8 and onward.

AUREVANE may implement multiple PvP rule sets without keeping every queue permanently open.

### Queue telemetry

Track by queue, region and time band:

- concurrent queued players;
- median/p95 queue time;
- abandonment;
- match completion;
- disconnect rate;
- skill-rating spread;
- repeated-opponent rate;
- rematch rate;
- premade versus solo participation where relevant;
- match quality feedback.

### Permanent-queue rule

A new permanent queue is enabled only when expected concurrency can support acceptable matchmaking without hollowing out existing queues.

If not:

- rotate the mode;
- use scheduled ranked windows;
- run tournaments/events at announced times;
- preserve direct challenges;
- consolidate casual/ranked population where design allows.

Never disguise bots as humans in ranked play.

---

## 11. Phase 9–12 Integration — Scale Only What Has Demand

Full-roster, social, economy, and nation work remains on the roadmap, but each phase must answer a product question before maximal expansion.

### Phase 9 — Full Discipline Roster

Do not assume "36" is a launch requirement. Reach 36 over time if:

- new roster additions continue creating genuine build diversity;
- canonical Confluence authoring remains sustainable;
- balance tooling keeps pace;
- content quality does not collapse;
- players still meaningfully explore the existing roster.

### Phase 10 — Social World

Expand guild/social systems when actual players are forming repeat relationships. Build tools around observed social behavior rather than imagined organizational complexity.

### Phase 11 — Economy

Do not activate a large player marketplace until item acquisition, sinks/sources, anti-duplication, moderation/support, and population are sufficient to make it healthy.

Economic telemetry must measure inflation, concentration, liquidity, source/sink balance, exploit signals, and meaningful trade activity.

### Phase 12 — Nations

Nation warfare is population-expensive. Implement full national conflict only when guild/community participation proves the game can sustain large-group identity without dividing a tiny audience into empty factions.

If population is not ready, nations may exist narratively/reputationally before large-scale warfare becomes a permanent live mode.

---

## 12. PV-6 — Monetization Readiness Gate

**Roadmap position:** commerce foundation around Phase 11, with architecture awareness earlier and public payments only after product evidence.

Real-money commerce should not be used to finance a game players have not yet shown they value.

### Before public paid checkout

Require:

- stable account/entitlement system;
- server-authoritative grant/ledger flow;
- payment sandbox verification;
- refund/dispute/reconciliation operations;
- a retained cohort large enough to interpret basic player behavior;
- evidence that cosmetic/identity goods are desirable;
- no known major first-session or combat-quality crisis;
- explicit non-P2W review of every grant.

### Initial launch

Start with a small catalog that teaches us:

- whether players want identity/supporter products;
- which presentation categories appeal;
- whether PayPal access creates meaningful checkout friction;
- whether buyers understand account/character scope;
- whether refunds/support remain manageable.

Track:

- store view → checkout start;
- checkout completion/failure/abandonment;
- payer conversion;
- average order value;
- repeat purchase;
- product-level ownership;
- refunds/disputes;
- revenue by cohort/source where appropriate;
- retention behavior of payers versus non-payers without manipulating matchmaking or rewards.

### Expansion rule

Weak monetization results do not authorize pay-to-win.

Diagnose product love, offer quality, price, audience, provider access, and trust before adding complexity.

---

## 13. PV-7 — Unit Economics / Scale Gate

**Roadmap position:** before broad public acquisition and again during Phase 15 hardening.

Measure enough operational cost to estimate whether growth improves or worsens the business.

At minimum, understand:

- database/realtime/function cost trend;
- bandwidth/media cost trend;
- logging/analytics cost trend;
- support/moderation workload;
- payment cost/refund leakage once commerce exists;
- variable cost per active player;
- expensive feature paths such as battles, realtime world presence, Expeditions, media-heavy pages, and large inventory/economy queries.

### Gate rule

Do not spend aggressively on user acquisition while every additional active player has unknown or obviously unhealthy variable economics.

Before acquisition scale, establish:

- cost alarms;
- capacity/load observations;
- graceful kill/degrade switches for non-essential expensive features;
- enough contribution-margin visibility to know whether growth can become profitable.

---

## 14. PV-8 — Sustainable Live-Ops Gate

**Roadmap position:** Phase 13–15 before promising a major live-service cadence.

Run the intended live-ops workflow in staging/invite alpha for multiple cycles.

Prove that staff/owner can:

- draft;
- validate;
- preview;
- schedule;
- publish;
- monitor;
- disable;
- rollback;
- analyze;
- support players;

without routine production SQL or emergency code deployment.

The cadence passes when it can be sustained repeatedly without forcing constant manual intervention or noticeable quality decline.

If it cannot, reduce cadence before launch rather than assuming future staff will rescue an unsustainable design.

---

## 15. Mature Closed Alpha Entry Gate

The existing Closed Alpha target in `docs/ROADMAP.md` remains a valuable **mature alpha** objective.

AUREVANE should enter that large content target only after earlier proof gates show:

- the account/character funnel is not a major source of failure;
- tactical combat produces replay desire;
- Current + Legacy + Confluence + Soulmark produces voluntary experimentation;
- a small world/progression loop produces meaningful return behavior;
- early co-op can form parties reliably enough for its intended test;
- PvP testing is consolidated around the population actually available;
- content production quality remains sustainable as the roster grows;
- performance and server correctness remain stable enough that product feedback is not dominated by broken builds.

Closed Alpha is not where we first ask whether the game is fun.

---

## 16. Distribution Validation Gate

Browser-first remains the implementation baseline.

After PV-2/PV-3 demonstrate a compelling product, evaluate distribution using evidence:

- direct browser acquisition sources;
- invite conversion;
- device/browser compatibility;
- player trust/friction around browser play;
- demand for a desktop launcher/client;
- community/creator feedback;
- payment accessibility;
- likely benefits of Steam or another storefront.

A desktop package is approved only if it materially improves distribution/retention/trust and can remain a client of the same authoritative backend.

Do not fork gameplay logic by platform.

---

## 17. Playtest Report Standard

Every significant validation cohort should produce a short committed or retained report containing:

```text
BUILD / COMMIT
DATE WINDOW
COHORT SIZE
COHORT SOURCE / PLAYER TYPE
QUESTIONS BEING TESTED
KNOWN BUILD LIMITATIONS
KEY QUANTITATIVE SIGNALS
TOP QUALITATIVE THEMES
TECHNICAL FAILURES / CONFOUNDERS
WHAT WE LEARNED
DECISION: PASS / ITERATE / INCONCLUSIVE
NEXT ACTIONS
```

Do not cherry-pick praise.

Negative evidence is valuable because it is cheaper to discover before the next five phases are built.

---

## 18. Ticket Integration Rule

Starting immediately, any ticket that materially affects one of these validation questions must state which product evidence it enables or protects.

Examples:

- character creation tickets state funnel/abandonment observability;
- combat tickets state the PV-1 tactical question they help prove;
- Discipline/Confluence tickets state the PV-2 buildcraft question;
- world/progression tickets state the PV-3 return-loop question;
- party/Expedition tickets state the PV-4 population/teamwork question;
- PvP tickets state the PV-5 queue-health question;
- economy/commerce tickets state the PV-6/PV-7 economic question;
- live-ops tickets state the PV-8 sustainability question.

This does not mean every ticket invents a new metric. It means implementation remains connected to why the feature exists.

---

## 19. Stop / Iterate Rules

### Stop roster expansion when

- existing builds are not being explored;
- balance/testing debt is growing faster than value;
- Confluence completeness/quality is falling;
- content defects dominate new releases.

### Stop world-content expansion when

- players are churning before reaching it;
- the first-session/return loop is weak;
- content is being added to fill calendar gates rather than create decisions.

### Stop opening new queues when

- current queues have unhealthy wait times/repeated opponents;
- concurrency cannot support them.

### Stop monetization expansion when

- trust/retention problems appear;
- refund/support burden is unhealthy;
- offers are drifting toward disguised power.

### Stop acquisition scale when

- the core cohort is not retaining;
- infrastructure economics are unknown/unhealthy;
- onboarding cannot absorb the traffic cleanly.

### Stop live-ops cadence expansion when

- owner/staff workload becomes unsustainable;
- quality/provenance/rollback discipline is being skipped to hit dates.

Stopping expansion means fixing the bottleneck. It does not mean abandoning the final vision by default.

---

## 20. Roadmap Success Condition

This validation extension succeeds when AUREVANE's development history shows a sequence like:

```text
WE BUILT A SMALL THING
        ↓
PLAYERS PROVED / DISPROVED THE THESIS
        ↓
WE FIXED WHAT WAS WEAK
        ↓
THE THESIS BECAME STRONG ENOUGH
        ↓
WE EXPANDED THE NEXT LAYER
```

The desired result is not the fastest path to checking every feature box.

It is the fastest responsible path to discovering whether AUREVANE can become a loved, sustainable, profitable game without sacrificing the ambitious final design that makes it worth building.