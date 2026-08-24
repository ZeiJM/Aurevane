# AUREVANE — Roadmap Product Validation Gates

**Status:** Binding validation extension of `docs/ROADMAP.md`.

**Reconciled:** 2026-08-23

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/ROADMAP.md` defines phase sequence. Canonical domain specifications define mechanics. This document defines the evidence gates that determine when AUREVANE is allowed to multiply expensive product layers.

This version supersedes older validation wording that used Current/Legacy/Confluence, the retired four-attribute model, or the retired one-Action combat model.

---

# 1. Non-negotiable validation rules

1. **Evidence before expansion.** Do not use more content to hide a weak core loop.
2. **Representative quality before large cohorts.** Test a small coherent slice rather than a giant knowingly broken build.
3. **Instrument before arguing.** Important product questions need telemetry and structured notes.
4. **Real humans before scale.** Simulation can support correctness and balance; it cannot prove fun, identity, clarity, social desire or return intent.
5. **No artificial calendar waiting in QA.** Long-horizon systems need accelerated non-production test fixtures.
6. **One active implementation ticket remains the default.** Validation does not authorize uncontrolled parallel feature expansion.
7. **A failed gate redirects work to the weak layer.** It does not justify jumping forward.
8. **Metrics are decision aids, not vanity targets.** Review qualitative evidence, cohort quality, technical failures and confounders with the numbers.
9. **Owner testing is real evidence but not fabricated telemetry.** Record what actually happened; never invent tester counts, ratings or measurements.

---

# 2. Validation instrumentation baseline

Use a small privacy-respecting event taxonomy tied to real product questions.

Representative events, when their systems exist:

```text
account_entry_started
account_entry_completed
character_creation_started
character_creation_completed
first_game_session_started
first_combat_started
first_combat_completed
combat_abandoned
primary_changed
secondary_equipped
secondary_changed
skill_loadout_changed
resonance_first_used
essence_first_used
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

Use stable content/system IDs where useful and avoid unnecessary personal information.

The taxonomy expands only when a real decision needs it.

---

# 3. Phase 1 integration — Character entry foundation

Phase 1 is substantially complete. Its product responsibility remains modest: a player must be able to reach a persistent understandable character without setup itself becoming a reason to quit.

Current expectations include:

- reliable account/authenticated-shell flow;
- verified-email/account protections functioning as intended;
- character creation without facilitator dependence;
- six universal attributes — Might, Finesse, Vitality, Agility, Intellect, Resolve — communicated clearly;
- starting Discipline choice understandable;
- responsive narrow-screen/laptop-height behavior;
- authoritative progression telemetry/provenance;
- Passive Training evaluated as a support system, not assumed successful merely because players activate it.

Do not restore retired four-attribute or Wayfarer's Practice wording as current product truth.

---

# 4. PV-1 — Tactical Combat / Battle Platform Proof Gate

**Roadmap position:** Phase 2, before substantial Signature Buildcraft expansion.

**Current status:** OPEN while Owner testing/stabilization continues.

**Purpose:** prove that the tactical game is understandable and enjoyable before build/content combinatorics multiply.

## Minimum representative slice

The proof slice should demonstrate:

- current shared AP / Action Economy rather than the retired one-Action model;
- movement and meaningful AP tradeoffs;
- positioning/terrain/facing where relevant;
- Basic Attack / Guard / Recover baseline;
- legal targeting/forecast;
- at least one status or setup/payoff interaction;
- meaningful enemy decisions;
- clear turn ownership/timing;
- understandable outcomes and battle-log feedback;
- satisfying audiovisual response;
- one or more maps with real tactical decisions.

The already-built direct-PvP/spectator foundation may be tested for stability and usability, but ranked matchmaking, seasons, tournaments and mature Colosseum discovery are **not** required to pass PV-1.

## Required evidence

Use Owner/internal testing and, when the build is stable enough, representative external/trusted testers.

Capture where practical:

- first-battle completion;
- abandon/soft-lock/technical failure rate;
- time to first confident action;
- battle duration;
- obvious misclick/targeting confusion;
- whether AP costs and disabled states are understood;
- whether players understand why outcomes happened;
- whether players voluntarily choose another battle/scenario when offered;
- whether players can name tactical decisions they made;
- comments on pace, readability, responsiveness, audiovisual impact and desire to replay.

## Decision standard

PV-1 passes when evidence shows **repeatable voluntary replay desire** and players are discussing tactical choices more than fighting the interface.

A provisional warning signal exists when fewer than roughly half of eligible representative testers voluntarily choose another available fight/build attempt after the first, excluding time/technical blockers. This is an investigation signal, not an automatic statistical verdict.

## If PV-1 fails

Iterate the smallest repeated problem in:

- input/action clarity;
- AP/turn readability;
- targeting;
- battle scale/information density;
- encounter/terrain design;
- enemy behavior;
- timing/feedback;
- mobile/desktop presentation;
- battle-log/outcome explanation;
- audiovisual timing.

Do **not** respond by adding Disciplines, regions or metagame breadth.

---

# 5. Phase-2 exit / Owner transition rule

Phase 2 remains open while the Owner is actively testing the current battle platform.

If the Owner explicitly states that Phase 2 is complete and instructs the project to start/code Phase 3, treat that as the phase-transition decision and follow `docs/PHASE_3_TICKETS.md`.

Do not ask the Owner to repeat a clear transition instruction merely because an old issue still says PV-1 is open.

When closing the gate:

- record the actual Owner decision and evidence available;
- reference structured human evidence when it exists;
- never invent cohort size, telemetry or ratings that were not collected;
- reconcile open validation issues and `TASKS.md` factually;
- begin Phase 3 at P3.1 rather than skipping directly to roster/content volume.

---

# 6. PV-2 — Signature Buildcraft Identity Gate

**Roadmap position:** Phase 3, before Phase 4 aggressively expands the playable roster.

**Purpose:** prove that **Primary + optional Secondary + Skills + Resonance/Essence + equipment interaction** creates memorable curiosity-driven experimentation.

Soulmarks/Mantles are not required for the Phase-3 proof; they belong to the later supernatural/world layer.

## Minimum representative slice

Prefer approximately:

- 4 representative Disciplines with meaningfully different Primary identities;
- legal Secondary mixing among the representative set;
- representative Skill libraries/cooldowns sufficient to test the grammar;
- pure build: up to 8 Primary Discipline Skills + Essence;
- mixed build: 6 total Discipline Skills + Resonance;
- representative Resonance coverage;
- representative pure Essence coverage;
- a small equipment set that changes decisions rather than only numbers;
- supported test-build switching/fixtures for repeated experiments without bypassing production legality;
- AI and existing direct-PvP compatibility using the same build snapshots.

Exact content count may be smaller if it proves the thesis honestly.

## Resonance scope rule

Default production authoring uses one canonical unordered Primary/Secondary pair Resonance unless a reviewed directional exception materially improves design.

This preserves meaningful pair identity without automatically doubling content burden for A→B and B→A.

## Required evidence

Capture whether testers:

- can explain Primary versus Secondary;
- understand Primary base-stat identity and that Secondary contributes no second base profile;
- understand pure 8 + Essence versus mixed 6 + Resonance;
- understand Skill source labels and cooldowns;
- voluntarily try multiple builds/pairings;
- make Resonance/Essence/equipment changes without coaching;
- observe meaningful strategy changes after build changes;
- ask questions like “what happens if I pair X with Y?” independently;
- identify combinations that feel mandatory, pointless, unreadable or redundant;
- can configure a build in a reasonable time;
- can recover from a poor experiment without feeling permanently trapped;
- find the current attunement commitment understandable rather than accidentally punitive.

## Gate pass condition

PV-2 passes when multiple testers independently demonstrate **curiosity-driven build experimentation** and remember the build system as distinctive to AUREVANE.

If most testers select one obviously dominant package and stop exploring, the gate has not passed even if win rates are balanced.

## If PV-2 fails

Improve:

- Primary/Secondary clarity;
- Resonance distinctiveness;
- Essence appeal;
- pure/mixed balance;
- Skill identity/cooldown readability;
- preview/compare UX;
- loadout friction;
- weak/redundant pair design;
- equipment interaction;
- onboarding timing.

Do not solve buildcraft confusion by writing a larger manual.

---

# 7. Phase 4 roster expansion gate

Do not jump directly from proof to 16 Disciplines.

Use staged bands:

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

- new Resonance pair count;
- Essence coverage;
- authoring/test/media burden;
- reusable effect/Skill grammar versus bespoke-code growth;
- PvE/PvP matchup coverage;
- role/archetype coverage;
- equipment interaction burden;
- AI coverage burden;
- content defects per Discipline;
- whether existing options remain meaningfully explored.

A new Discipline is approved because it creates enough new play to justify its interaction network.

---

# 8. PV-3 — First-session / Return-loop Gate

**Roadmap position:** Phase 5 once a small world/progression/supernatural loop exists; before broad world-content production.

Use a small coherent slice containing a strong region/settlement path, short quest/activity chain, several encounter variants, visible build/progression goals, targeted item goals and a real world-change/event sample when ready.

Track cohorts rather than anecdotes:

- character-creation and first-combat completion;
- first-session length;
- return sessions by cohort;
- build changes between sessions;
- goals selected/completed;
- progression bottlenecks;
- technical failure;
- voluntary “what would make you come back?” feedback.

Use D1/D7/D30 only when sample size and duration make them meaningful. Establish AUREVANE's own comparable baseline rather than blindly importing unrelated mobile benchmarks.

If return behavior is weak, first investigate hook timing, tactical/build freshness, goal clarity, progression friction, technical failures and whether the world actually gives a reason to return. Do not immediately intensify FOMO.

---

# 9. Long-horizon progression validation

The approximately 180-day production target is the default minimum age for completing the first full character era / First Horizon / Rekindling eligibility **plus required gameplay milestones**.

It does not mean every advanced activity remains inaccessible until day 180.

Roadmap implications:

- advanced PvE/PvP may become meaningful earlier when gameplay progression qualifies the player;
- endgame systems require accelerated/staged QA characters;
- pacing forecasting/simulation should appear progressively once progression complexity warrants it;
- QA uses supported time advancement/state fixtures rather than ad-hoc production database edits.

Before live Rekindling:

- simulate expected pacing;
- run accelerated QA cycles;
- observe real partial-length cohorts;
- validate each progression band for meaningful goals;
- confirm calendar gates are not filler;
- confirm serious players have meaningful activity before final cycle eligibility.

---

# 10. PV-4 — Co-op / Expedition Proof Gate

**Roadmap position:** Phases 6–7.

**Purpose:** prove that playing with other humans improves the game and does not create a population-dependent progression trap.

Track:

- party-search starts;
- successful formations;
- time to party;
- invite acceptance;
- abandoned searches;
- disconnect/rejoin;
- Expedition completion;
- repeat grouping/rematch;
- party retention across runs;
- solo players blocked from goals;
- communication/coordination friction;
- whether builds create actual teamwork.

Deep three-player content may become a major prestige/progression pillar only when party formation is healthy enough for the intended audience.

If concurrency is insufficient, use scheduled community windows, improve party finder, preserve appropriate alternative progression, and scale low-stakes content flexibly. Do not make mandatory progress depend on an empty queue.

---

# 11. PV-5 — Competitive PvP Population Safety Gate

**Roadmap position:** Phase 8 and onward.

Direct PvP already exists as Phase-2 battle-platform foundation. PV-5 governs whether **mature permanent competitive queues** are healthy enough to open and remain open.

Track by queue/region/time band:

- concurrent queued players;
- median/p95 queue time;
- abandonment;
- match completion;
- disconnect rate;
- rating spread;
- repeated-opponent rate;
- rematch rate;
- premade versus solo participation where relevant;
- match-quality feedback.

A new permanent queue opens only when expected concurrency can support acceptable matchmaking without hollowing existing queues.

If not:

- rotate the mode;
- use scheduled ranked windows;
- run tournaments/events at announced times;
- preserve direct challenges;
- consolidate populations where design allows.

Never disguise bots as humans in ranked play.

---

# 12. Phase 9–12 integration — Scale only what has demand

## Phase 9 — Roster / supernatural catalog expansion

Scale toward 36 Disciplines and broader Soulmark/Mantle catalogs only if:

- additions continue creating genuine build diversity;
- Resonance/Essence authoring remains sustainable;
- balance/interaction tooling keeps pace;
- content quality does not collapse;
- players still explore the existing roster.

## Phase 10 — Social world

Expand guild/social systems around observed repeat relationships rather than imagined organizational complexity.

## Phase 11 — Economy

Do not activate a large marketplace until acquisition, sinks/sources, anti-duplication, moderation/support and population are sufficient.

Measure inflation, concentration, liquidity, source/sink balance, exploit signals and meaningful trade.

## Phase 12 — Nations

Nation warfare is population-expensive. Full national conflict becomes permanent only when community participation can support it without splitting a tiny audience into empty factions.

---

# 13. PV-6 — Monetization Readiness Gate

**Roadmap position:** commerce foundation around Phase 11, with architecture awareness earlier and public payments only after product evidence.

Before public paid checkout require:

- stable account/entitlement authority;
- server-authoritative grant/ledger flow;
- payment sandbox verification;
- refund/dispute/reconciliation operations;
- retained-player evidence sufficient to interpret behavior;
- evidence cosmetic/identity goods are desirable;
- no known major first-session/combat-quality crisis;
- explicit non-P2W review of every grant.

Start with a small catalog. Track store-view→checkout, completion/failure, payer conversion, order value, repeat purchase, product ownership, refunds/disputes and support burden.

Weak monetization never authorizes pay-to-win.

---

# 14. PV-7 — Unit Economics / Scale Gate

**Roadmap position:** before broad acquisition and again during Phase 15 hardening.

Understand at minimum:

- database/realtime/function cost trends;
- bandwidth/media cost;
- logging/analytics cost;
- support/moderation workload;
- payment/refund leakage once commerce exists;
- variable cost per active player;
- expensive feature paths such as battles, world presence, Expeditions, media-heavy pages and economy queries.

Before acquisition scale establish cost alarms, capacity/load observations, kill/degrade switches for non-essential expensive features and enough margin visibility to know whether growth can become healthy.

---

# 15. PV-8 — Sustainable Live-Ops Gate

**Roadmap position:** Phase 13–15 before promising a major live-service cadence.

Run the intended workflow repeatedly in staging/invite alpha.

Prove Owner/staff can:

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

If the cadence is not sustainable, reduce cadence before launch rather than assuming future staffing will rescue it.

---

# 16. Mature Closed Alpha entry gate

The Closed Alpha target in `docs/ROADMAP.md` remains a mature content/quality objective.

Enter that target only after evidence shows:

- account/character entry is reliable;
- tactical combat produces replay desire;
- Primary/Secondary/Skills/Resonance/Essence produces voluntary experimentation;
- a small world/progression loop produces meaningful return behavior;
- co-op can form parties reliably enough for its intended use;
- PvP testing is consolidated around actual population;
- content production remains sustainable as the roster grows;
- performance/server correctness are stable enough that feedback is not dominated by broken builds.

Closed Alpha is not where AUREVANE first asks whether the game is fun.

---

# 17. Distribution validation gate

Browser-first remains the implementation baseline.

After PV-2/PV-3 demonstrate a compelling product, evaluate distribution from actual acquisition, invite conversion, device/browser compatibility, player trust/friction, demand for a desktop client, creator/community feedback and payment accessibility.

A desktop package is approved only if it materially improves distribution/retention/trust while remaining a client of the same authoritative backend.

Do not fork gameplay logic by platform.

---

# 18. Playtest report standard

Every significant cohort should produce a short retained report:

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

Do not cherry-pick praise. Negative evidence is valuable when discovered before the next expensive layer is built.

---

# 19. Ticket integration rule

Any ticket materially affecting a validation question must state which product evidence it enables/protects.

Examples:

- character-entry tickets → funnel/abandonment observability;
- combat tickets → PV-1 tactical proof;
- Primary/Secondary/Skill/Resonance/Essence tickets → PV-2 buildcraft proof;
- world/progression/supernatural tickets → PV-3 return loop;
- party/Expedition tickets → PV-4 teamwork/population;
- competitive PvP tickets → PV-5 queue health;
- economy/commerce tickets → PV-6/PV-7;
- live-ops tickets → PV-8.

This does not mean every ticket invents a metric. It keeps implementation tied to the reason the feature exists.

---

# 20. Stop / iterate rules

Stop roster expansion when existing builds are not explored, balance/testing debt grows faster than value, Resonance/Essence completeness falls, or defects dominate releases.

Stop world-content expansion when players churn before reaching it, the return loop is weak, or content is filling calendar gates rather than creating decisions.

Stop opening queues when current queues have unhealthy waits/repeated opponents or concurrency cannot support them.

Stop monetization expansion when trust/retention or refund/support burden becomes unhealthy or offers drift toward disguised power.

Stop acquisition scale when the core cohort is not retaining, infrastructure economics are unhealthy/unknown or onboarding cannot absorb traffic.

Stop live-ops cadence expansion when Owner/staff workload becomes unsustainable or rollback/provenance discipline is being skipped.

Stopping expansion means fixing the bottleneck, not abandoning the final vision.

---

# 21. Success condition

The desired development history is:

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

The goal is not the fastest route to checking every feature box. It is the fastest responsible route to discovering whether AUREVANE can become a loved, sustainable game without sacrificing the ambitious final design.