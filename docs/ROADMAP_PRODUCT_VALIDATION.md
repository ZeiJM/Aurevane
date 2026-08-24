# AUREVANE — Product Validation Gates

**Status:** Binding extension of `docs/ROADMAP.md` for product validation, scope expansion and evidence-based sequencing.

**Reconciled:** 2026-08-23

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. This document defines the evidence gates that determine when AUREVANE is allowed to scale an expensive layer.

The roadmap answers **what comes next**. This document answers:

> **What must we prove before we are allowed to make the next layer bigger?**

---

# 1. Non-negotiable validation rules

1. **Evidence before expansion.** Do not use more content to hide a weak core loop.
2. **Representative quality before large cohorts.** Test a small polished slice before scaling breadth.
3. **Instrument before arguing.** Important product questions need telemetry/structured notes.
4. **Real humans before claims about fun.** Simulation proves correctness/balance, not desire or identity.
5. **No artificial calendar waiting in QA.** Long-horizon systems require accelerated/staged test paths.
6. **One active implementation boundary remains the default.** Validation does not authorize uncontrolled parallel expansion.
7. **A failed gate redirects work to the weak layer.** It does not authorize jumping ahead.
8. **Metrics are decision aids.** Qualitative evidence, technical failures and cohort context matter.
9. **Owner testing and formal validation are distinct.** Owner feedback can drive contained corrections without being mislabeled as a cohort PASS.
10. **Early-delivered compatible systems receive credit.** Their later mature phase audits and extends them rather than rebuilding them.

---

# 2. Validation instrumentation baseline

Use a small privacy-respecting telemetry boundary. Do not build a giant analytics platform merely to satisfy this document.

Representative events may include, when relevant systems exist:

```text
account_entry_started
account_entry_completed
character_creation_started
character_creation_completed
first_game_session_started
first_combat_started
first_combat_completed
combat_abandoned
build_preview_started
build_preview_completed
secondary_unlocked
resonance_first_used
essence_first_used
build_changed
session_ended
return_session_started
party_search_started
party_formed
expedition_started
expedition_completed
frontier_entered
frontier_anchor_discovered
frontier_extracted
anomaly_witnessed
anomaly_acquired
pvp_queue_entered
pvp_match_found
pvp_queue_abandoned
premium_store_viewed
checkout_started
checkout_completed
checkout_failed
```

Use stable content/system identifiers where useful and avoid unnecessary personal information.

---

# 3. Phase 1 product gate — character entry

Phase 1 is complete enough to feed combat when:

- account/authenticated-shell flow is reliable;
- character creation is understandable without facilitator help;
- creation remains a few-minute experience;
- Foundation Discipline and six-attribute wording are understandable;
- narrow-screen/laptop-height behavior does not create major friction;
- XP/progression provenance is authoritative;
- Passive Training is evaluated as a support system, not assumed successful because players click it.

**Gate:** a tester can reach and return to a persistent understandable character without setup being a reason to quit.

---

# 4. PV-1 — Tactical Combat Proof Gate

**Roadmap position:** Phase 2 exit.

**Purpose:** prove the baseline tactical game is understandable and enjoyable before build/content complexity multiplies.

### Representative slice

Must demonstrate:

- movement;
- shared Action Economy/AP;
- positioning/terrain;
- basic targeting/forecast;
- at least one meaningful status/setup-payoff interaction;
- enemy decisions;
- readable turn economy;
- satisfying audiovisual feedback;
- one or more maps with real tactical choices.

The current battle platform may also expose PvP/spectation during Owner testing, but PvP breadth is **not required** to prove PV-1.

### Evidence

When stable enough, use internal QA followed by roughly 20–50 representative trusted/external testers where practical.

Capture:

- first-battle completion;
- abandon/soft-lock/technical failure;
- time to first confident action;
- battle duration;
- obvious misclick/targeting confusion;
- outcome understanding;
- voluntary replay/another scenario choice;
- ability to identify a tactical decision;
- comments on pace, clarity, responsiveness, audiovisual impact and desire to replay.

### Pass standard

PV-1 passes when evidence shows **repeatable voluntary replay desire** and testers discuss tactical decisions more than fighting the interface.

A warning exists if fewer than roughly half of eligible representative testers voluntarily choose another available fight/build attempt, excluding time/technical blockers. This is a diagnostic signal, not an automatic statistical verdict.

### If PV-1 fails

Iterate the smallest recurring weakness in:

- input/action clarity;
- targeting;
- pacing;
- encounter design;
- terrain consequences;
- AI;
- turn feedback;
- audiovisual timing;
- information density.

Do not respond by adding more Disciplines, regions or metagame systems.

---

# 5. Phase-2 transition rule

Phase 2 remains open while Owner testing continues.

If the Owner clearly states wording equivalent to **“Phase 2 is done; code Phase 3”**, treat that as explicit phase-transition authorization and follow `docs/PHASE_3_TICKETS.md`.

Do not ask the Owner to repeat a clear transition merely because an older issue still shows PV-1 open.

Record the factual decision/evidence available, reconcile open validation records and begin Phase 3 at **P3.1**. Never invent missing tester counts/metrics.

---

# 6. PV-2 — Signature Buildcraft Identity Gate

**Roadmap position:** Phase 3, before Phase 4 scales the roster.

**Purpose:** prove that **Primary + optional Secondary + Skills + Resonance/Essence** creates memorable curiosity-driven experimentation.

### Representative slice

Prefer approximately:

- 4 representative Disciplines with meaningfully different roles;
- mature-enough Skill sets to demonstrate build choice;
- representative Resonances for mixed pairings;
- representative Essence Skills for pure builds;
- a small equipment set that changes decisions rather than only stats;
- saved/test build switching sufficient for repeated experiments;
- AI and existing direct-PvP support consuming the same authoritative build snapshots.

Soulmarks/Mantles are **not required** for Phase-3 PV-2.

### Evidence

Capture whether testers:

- can explain Primary versus Secondary;
- understand Primary base-stat consequences;
- understand **pure 8 Skills + Essence** versus **mixed 6 Skills + Resonance**;
- understand Skill cooldowns/source labels;
- voluntarily attempt multiple pairings/build changes;
- observe strategy changes from build changes;
- ask curiosity-driven questions such as “what happens if I pair X with Y?”;
- identify mandatory/pointless/unreadable/redundant combinations;
- can configure a build without excessive study;
- can recover from a bad experiment without feeling trapped.

### Pass standard

Multiple testers independently demonstrate **curiosity-driven build experimentation** and remember the build system as distinctive to AUREVANE.

If most testers pick one obvious package and stop experimenting, the gate has not passed even if win rates are balanced.

### If PV-2 fails

Improve:

- Resonance/Essence distinctiveness;
- pure-vs-mixed tradeoffs;
- preview/compare UX;
- early recommendations;
- terminology;
- loadout friction;
- weak/redundant pair designs;
- cooldown/source readability.

Do not solve it by writing a larger manual.

---

# 7. Phase 4 roster expansion gate

Roster growth is staged:

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

Before expanding each band, review:

- Resonance/Essence coverage;
- authoring/test/media burden;
- effect reuse versus bespoke-code growth;
- matchup coverage;
- role/archetype coverage;
- equipment interactions;
- AI burden;
- content defects;
- interaction-linting health;
- whether the existing roster still contains meaningful underused options.

A Discipline is approved because it creates enough new play to justify every interaction it creates.

---

# 8. PV-3 — First-session / Return-loop Gate

**Roadmap position:** Phase 5, once a small coherent world/progression loop exists and before large world-content scale.

### Representative slice

- one strong region/settlement path;
- short quest/activity chain;
- several encounter variants;
- targeted item goals;
- visible Mastery/build goals;
- one meaningful world-change/event sample;
- World Pulse only when it can show real value;
- supernatural fork proof where ready;
- a **small outer Unwritten Reach proof** if stable enough, not a giant frontier.

### Evidence

Track:

- creation/combat completion;
- first-session length;
- return sessions/cohorts;
- build changes between sessions;
- selected/completed goals;
- progression bottlenecks;
- technical failures;
- why players would or would not return.

Use D1/D7/D30 retention when sample size/duration make it meaningful, without blindly importing mobile benchmarks.

### Red flags

If return behavior is weak, investigate hook timing, build freshness, goal clarity, technical friction, artificial slowing and world relevance before intensifying FOMO.

---

# 9. Frontier validation ladder

The frontier is governed by `docs/REKINDLING_FRONTIER_ANOMALIES.md`.

It scales in stages rather than launching as an enormous generated continent.

## FV-1 — Frontier Mystery Proof

**Roadmap position:** Phase 5.

Test one small outer-Reach vertical slice.

Questions:

- Does crossing beyond the last reliable map feel meaningful?
- Does Cartographic Drift feel mysterious rather than random?
- Do authored Anchors give players persistent things to remember?
- Can players form a mental model despite changing routes?
- Does the Reach generate lore questions naturally?
- Do players want to know what lies deeper?

Do not scale if feedback reduces to “random rooms reset every day.”

## FV-2 — Deep Frontier / Acumen Proof

**Roadmap position:** Phase 7.

Test deeper routes, named phenomena, Frontier Acumen and Veyr interaction.

Questions:

- Does an experienced explorer make better decisions because they understand the Reach?
- Do frontier advantages feel like knowledge/access rather than mandatory raw power?
- Do solo and party routes both have meaningful roles?
- Are extraction/failure stakes exciting without becoming miserable?

## FV-3 — Anomaly Proof

**Roadmap position:** Phase 7+.

Test only a very small number of Anomalies first.

Pass only if:

- seeing/acquiring one creates a story worth retelling;
- rarity comes from circumstances/choices/discovery rather than repetitive grind;
- ordinary builds remain viable;
- Anomalies are unusual enough to matter without becoming mandatory;
- provenance is understandable and technically trustworthy;
- competitive legality can be controlled.

If the loop becomes “farm the frontier until the mandatory rare thing drops,” stop and redesign.

---

# 10. 180-day progression / Rekindling validation

The approximately 180-day production target means a minimum planning default for the first full character era/Rekindling eligibility combined with gameplay milestones.

It does **not** mean all serious content waits until day 180.

Before mature Rekindling:

- simulate pacing;
- run accelerated QA;
- observe partial real cohorts;
- validate each progression band;
- confirm serious content exists throughout the journey;
- confirm Passive Training is supportive rather than dominant;
- confirm later cycles are meaningfully different.

## RV-1 — Rekindling Replayability Gate

Before treating Rekindling as a healthy recurring loop, test whether:

- Echo Routes create meaningful alternate progression choices;
- history-aware NPC/mentor interactions feel rewarding;
- already-mastered tutorials can be abbreviated without trivializing the journey;
- Memory Carryover changes strategy without erasing challenge;
- Hall of Selves makes prior cycles feel accumulated;
- frontier history creates new questions in later cycles;
- players voluntarily want another cycle for reasons beyond raw power.

A second cycle that feels like an identical checklist with an XP bonus **fails** this gate.

---

# 11. PV-4 — Co-op / Expedition Proof

**Roadmap position:** Phases 6–7.

Track:

- party-search starts/formations;
- time to party;
- invite acceptance;
- abandoned searches;
- disconnect/rejoin;
- Expedition completion;
- repeat grouping/rematch;
- communication/coordination friction;
- whether roles/builds create actual teamwork;
- solo players blocked from goals.

Deep three-player content becomes a major pillar only when party formation is healthy enough for the intended audience.

If concurrency is insufficient, use scheduled windows, improve party finder, preserve alternatives where appropriate and avoid making mandatory progress depend on an empty queue.

---

# 12. PV-5 — PvP Population Safety

**Roadmap position:** Phase 8+.

Direct PvP already exists as an early battle-platform foundation. PV-5 governs whether **mature permanent competitive queues** are healthy enough to open.

Track by queue/region/time band:

- queued concurrency;
- median/p95 queue time;
- abandonment;
- match completion;
- disconnects;
- rating spread;
- repeated opponents;
- rematches;
- premade/solo participation;
- match-quality feedback.

A permanent queue opens only when expected concurrency can support it without hollowing out existing queues.

Otherwise rotate modes, schedule ranked windows/tournaments or preserve direct challenges.

Never disguise bots as human ranked opponents.

Anomaly legality must be explicit per competitive mode.

---

# 13. Phase 9–12 scale rules

## Roster

Do not assume 36 Disciplines must exist at launch. Expand while new additions still create genuine build diversity and sustainable production cost.

## Social

Expand guild/social systems around observed repeat relationships.

## Economy

Do not activate a large marketplace until item sources/sinks, anti-duplication, support and population are sufficient.

## Nations

Large-group warfare is population-expensive. Nations may exist narratively/reputationally before permanent full warfare.

## Frontier

Scale Anchors, phenomena, Veyr content and Anomalies only if earlier frontier gates prove discovery remains compelling and authoring/QA cost is sustainable.

---

# 14. PV-6 — Monetization Readiness

Before public paid checkout require:

- stable entitlement/grant ledger;
- server-authoritative fulfillment;
- payment sandbox verification;
- refund/dispute/reconciliation operations;
- retained cohort evidence;
- cosmetic/identity demand;
- no major unresolved first-session/combat crisis;
- explicit non-P2W review.

Weak monetization never authorizes pay-to-win.

No cash-only combat Soulmark, Mantle, Veteran Edge or Anomaly power.

---

# 15. PV-7 — Unit Economics / Scale

Before broad user acquisition understand:

- database/realtime/function cost;
- bandwidth/media/logging cost;
- support/moderation workload;
- payment/refund cost;
- variable cost per active player;
- expensive battle/Expedition/frontier/social paths.

Establish cost alarms, capacity observations and graceful degradation/kill switches before acquisition scale.

---

# 16. PV-8 — Sustainable Live Operations

Before promising major live-service cadence, repeatedly prove in staging/invite alpha that staff/Owner can:

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

without routine production SQL or emergency code deployments.

This includes Reach drift/event/Anchor/Anomaly operations once those systems exist.

---

# 17. Mature Closed Alpha entry

Large mature Alpha content should come only after earlier gates show:

- account/character entry works;
- tactical combat produces replay desire;
- Primary/Secondary + Resonance/Essence produces voluntary experimentation;
- a small world/progression loop creates meaningful return behavior;
- co-op forms reliably enough;
- PvP is consolidated around actual population;
- content production remains sustainable;
- frontier proof is compelling if included;
- performance/correctness are strong enough that product feedback is not dominated by broken builds.

Closed Alpha is not where we first ask whether the game is fun.

---

# 18. Playtest report standard

Every significant cohort should record:

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

Do not cherry-pick praise. Negative evidence is valuable before expensive expansion.

---

# 19. Stop / iterate rules

Stop roster expansion when existing builds are not explored or interaction debt grows faster than value.

Stop world expansion when players churn before reaching it or content is filling calendar gates rather than creating decisions.

Stop frontier expansion when drift feels arbitrary, Anchors are forgettable or Anomaly acquisition becomes repetitive mandatory grind.

Stop opening queues when population cannot support them.

Stop monetization expansion when trust/retention/support health deteriorates.

Stop acquisition scale when retention or infrastructure economics are unhealthy/unknown.

Stop live-ops cadence expansion when quality/provenance/rollback discipline is being skipped.

Stopping expansion means fixing the bottleneck, not abandoning the long-term vision.

---

# 20. Roadmap success condition

AUREVANE should repeatedly follow this pattern:

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

The objective is the fastest responsible route toward a loved, sustainable and distinctive AUREVANE — not the fastest route to checking every feature box.