# AUREVANE — Roadmap Product Validation Gates

**Status:** Binding validation extension of `docs/ROADMAP.md`.

**Reconciled:** 2026-08-23

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/ROADMAP.md` defines phase sequence. Canonical domain specifications define mechanics. This document defines the evidence gates used before multiplying expensive product layers.

---

# 1. Non-negotiable validation rules

1. **Evidence before expansion.** Do not add content to hide a weak core loop.
2. **Representative quality before large cohorts.** Test a small coherent slice before scale.
3. **Instrument before arguing.** Important product questions need telemetry and structured notes.
4. **Real humans before scale.** Simulation supports correctness/balance but cannot prove fun, clarity, identity or return desire.
5. **No artificial calendar waiting in QA.** Long-horizon systems need accelerated non-production fixtures.
6. **One active implementation ticket remains the default.** Validation does not authorize uncontrolled parallel expansion.
7. **A failed gate redirects work to the weak layer.** It does not justify jumping forward.
8. **Metrics are decision aids, not vanity targets.** Review qualitative evidence, technical failures, sample quality and confounders.
9. **Never fabricate player evidence.** Owner/internal feedback may be recorded honestly without inventing cohort size, metrics or ratings.

---

# 2. Validation telemetry baseline

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
rekindling_started
rekindling_completed
frontier_crossing_started
frontier_crossing_completed
anchor_discovered
frontier_extraction_completed
frontier_extraction_failed
```

Use stable IDs where useful and avoid unnecessary personal information.

Owner-created Anomaly states use privileged audit/provenance telemetry rather than normal player-acquisition events.

---

# 3. Phase 1 — Character entry foundation

Phase 1 is substantially complete.

Its product gate remains:

> A player can reach a persistent understandable character without setup becoming a reason to quit.

Validate:

- reliable account/authenticated-shell flow;
- verified-auth protections;
- character creation without facilitator dependence;
- six attributes communicated clearly;
- starting Discipline understandable;
- narrow-screen/laptop-height usability;
- authoritative progression provenance;
- Passive Training as support rather than assumed retention success.

---

# 4. PV-1 — Tactical Combat / Battle Platform Proof

**Roadmap position:** Phase 2, before substantial Signature Buildcraft expansion.

**Current status:** OPEN while Owner testing/stabilization continues.

Purpose:

> Prove the tactical game is understandable and enjoyable before build/content combinatorics multiply.

Representative proof should demonstrate:

- current shared AP Action Economy;
- meaningful movement/AP tradeoffs;
- positioning/terrain/facing where relevant;
- Basic Attack / Guard / Recover;
- legal targeting/forecast;
- status/setup-payoff interaction;
- meaningful enemy decisions;
- clear turn ownership/timing;
- understandable outcomes/battle logs;
- satisfying audiovisual feedback;
- maps with real tactical choices.

Already-built direct PvP/spectation may be tested for stability/usability, but ranked matchmaking, seasons, tournaments and Colosseum discovery are not required for PV-1.

Capture where practical:

- battle completion;
- abandonment/soft-lock/technical failure;
- time to confident action;
- battle duration;
- misclick/targeting confusion;
- AP understanding;
- outcome understanding;
- voluntary replay choice;
- tactical-decision recall;
- qualitative feedback on pace/readability/responsiveness/audiovisual impact/replay desire.

### Pass condition

Players discuss tactical decisions more than they fight the interface, and evidence supports repeatable voluntary replay desire.

### Failure response

Fix the smallest repeated problem in input, AP/turn readability, targeting, encounter/terrain design, enemy behavior, timing/feedback, battle logs or responsive presentation.

Do not add more classes/regions/metagame breadth to hide a failed combat proof.

---

# 5. Phase-2 exit / Owner transition

If the Owner explicitly says Phase 2 is complete and instructs the project to start/code Phase 3, follow `docs/PHASE_3_TICKETS.md`.

When closing the gate:

- record the real Owner decision/evidence available;
- reference structured human evidence when it exists;
- never invent metrics;
- reconcile open validation issues and `TASKS.md` factually;
- begin at P3.1.

---

# 6. PV-2 — Signature Buildcraft Identity

**Roadmap position:** Phase 3 before Phase 4 roster expansion.

Purpose:

> Prove Primary + optional Secondary + Skills + Resonance/Essence + equipment interaction creates curiosity-driven experimentation.

Preferred representative slice:

- ~4 representative Disciplines;
- meaningful Primary identities;
- legal Secondary mixing;
- representative Skill libraries/cooldowns;
- pure: up to 8 Discipline Skills + Essence;
- mixed: 6 total Discipline Skills + Resonance;
- representative Resonance/Essence coverage;
- decision-changing equipment where current foundations permit;
- supported test-build switching;
- shared AI/direct-PvP build snapshots.

Capture whether testers:

- explain Primary versus Secondary;
- understand Primary base-profile consequence;
- understand pure 8 + Essence versus mixed 6 + Resonance;
- understand Skill sources/cooldowns;
- voluntarily try multiple pairings/builds;
- observe strategy changes;
- ask curiosity-driven combination questions;
- identify mandatory/pointless/redundant combinations;
- configure a build without excessive study;
- recover from a poor experiment without feeling trapped.

### Pass condition

Multiple testers independently demonstrate curiosity-driven build experimentation and remember the build system as distinctive to AUREVANE.

---

# 7. Phase 4 — Roster expansion gate

Use staged expansion:

```text
4 representative Disciplines
→ 6–8
→ 12
→ 16 mature Closed Alpha target
```

Before expanding review:

- Resonance pair count;
- Essence coverage;
- authoring/test/media burden;
- reusable effect grammar vs bespoke code growth;
- matchup/archetype coverage;
- equipment interaction burden;
- AI coverage;
- content defects;
- whether existing options are still meaningfully explored.

---

# 8. PV-3 — First-session / Return-loop

**Roadmap position:** Phase 5 after a small coherent world/progression/supernatural loop exists.

Representative slice should contain:

- one strong region/settlement path;
- short quest/activity chain;
- several encounter variants;
- visible build/progression goals;
- targeted item goals;
- meaningful world change/event sample.

Track:

- character-creation/first-combat completion;
- first-session length;
- return sessions by cohort;
- build changes between sessions;
- goals selected/completed;
- progression bottlenecks;
- technical failures;
- voluntary return-intent feedback.

If return behavior is weak, investigate hook timing, combat/build freshness, goal clarity, progression friction, technical problems and world motivation before intensifying FOMO.

---

# 9. Frontier validation

Authority: `docs/REKINDLING_FRONTIER.md`.

The frontier has its own product questions but **does not contain an Anomaly acquisition gate**.

## FV-1 — Outer Reach proof

**Roadmap position:** Phase 5.

Test whether:

- the crossing feels meaningful;
- Anchor + Driftspace creates a memorable mental model;
- changing routes feel mysterious rather than arbitrary;
- players understand that persistent discoveries survive map changes;
- Field Observations/lore create curiosity;
- players want to know what lies deeper.

If it feels like a random-map dungeon, redesign before scaling.

## FV-2 — Deep frontier / Frontier Acumen proof

**Roadmap position:** Phase 7+.

Test whether:

- experienced explorers make better decisions because they understand the Reach;
- frontier advantages feel like knowledge/access rather than mandatory raw power;
- solo and party play both have meaningful roles;
- extraction/failure stakes are exciting but not miserable;
- famous discoveries/Chronicle attribution create social stories.

Stop frontier expansion if Drift feels arbitrary or the Reach becomes a mandatory universal-power farm.

---

# 10. Rekindling validation

The approximate 180-day production target remains a planning default for first full character-era/Rekindling eligibility plus gameplay milestones.

Before mature Rekindling:

- simulate pacing;
- use accelerated QA;
- observe real partial cohorts;
- validate each progression band;
- ensure serious content exists throughout the journey;
- ensure Passive Training remains supportive;
- ensure later cycles are meaningfully different.

## RV-1 — Rekindling Replayability Gate

Test whether:

- Echo Routes create alternate progression choices;
- history-aware NPC/mentor interactions matter;
- mastered tutorials can be abbreviated without trivializing the journey;
- Memory Carryover changes strategy;
- Hall of Selves makes prior cycles feel accumulated;
- frontier history creates new questions;
- players want another cycle for reasons beyond raw power.

An identical checklist with an XP bonus fails.

---

# 11. PV-4 — Co-op / Expedition proof

**Roadmap position:** Phases 6–7.

Track:

- party searches/formations;
- time to party;
- invite acceptance;
- abandoned searches;
- disconnect/rejoin;
- Expedition completion;
- repeat grouping/rematch;
- communication/coordination friction;
- actual teamwork created by builds;
- solo players blocked from goals.

Do not make mandatory progression depend on an empty queue.

---

# 12. PV-5 — Competitive PvP population safety

**Roadmap position:** Phase 8+.

Direct PvP already exists as an early foundation. This gate governs mature permanent queues.

Track:

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

A permanent queue opens only when population can support it.

Never disguise bots as human ranked opponents.

Gameplay-affecting Owner-created Anomalies are disallowed in standard ranked PvP by default per `docs/ANOMALIES.md`.

---

# 13. Phase 9–12 scale rules

- **Roster:** scale while new Disciplines create genuine diversity and sustainable interaction cost.
- **Social:** expand around observed repeat relationships.
- **Economy:** do not activate a large marketplace until sources/sinks, anti-duplication, support and population are healthy.
- **Nations:** full warfare waits for population capable of sustaining large-group identity.
- **Frontier:** scale Anchors/phenomena/Veyr content only when earlier frontier evidence supports it.

Anomalies are not normal catalog/acquisition content and do not have a player-demand scaling gate.

---

# 14. Owner Anomaly operational integrity

Authority: `docs/ANOMALIES.md`.

Anomalies are privileged exceptional states, so they require **operations/security verification**, not a player-acquisition product gate.

Before production use of the full Anomaly Console, prove:

- only the protected Owner can create/revoke by default;
- re-authentication/confirmation/reason/audit are enforced;
- Cross-Fork, Dual-Soulmark and Dual-Mantle states are representationally valid;
- grants/revocations are atomic;
- no ghost Skills/passives/Mantle state remain after correction;
- standard ranked PvP exclusion works;
- analytics can filter exceptional characters;
- normal players cannot manufacture the state through client/API/race behavior;
- content-version migrations can safely repair or reject incompatible combinations.

This belongs primarily to Phase 13/15 operational hardening.

---

# 15. Monetization / economics / live-ops gates

## PV-6 — Monetization readiness

Before public paid checkout require stable entitlement/ledger authority, sandbox verification, refund/reconciliation operations, retained-player evidence and explicit non-P2W review.

Weak monetization never authorizes pay-to-win.

Owner-created Anomaly state is not a normal purchasable combat product.

## PV-7 — Unit economics / scale

Before broad user acquisition understand database/realtime/function, bandwidth/media/logging, support/moderation, payment/refund and variable-player costs.

## PV-8 — Sustainable live operations

Before promising major cadence, repeatedly prove Owner/staff can draft, validate, preview, publish, monitor, disable, rollback and analyze without routine production SQL/emergency deployment.

---

# 16. Mature Closed Alpha entry

Large mature Alpha content should come only after evidence shows:

- account/character entry works;
- tactical combat produces replay desire;
- buildcraft produces voluntary experimentation;
- a small world/progression loop creates meaningful return behavior;
- co-op forms reliably enough;
- PvP matches actual population;
- content production remains sustainable;
- frontier proof is compelling if included;
- performance/correctness is strong enough that feedback is not dominated by broken builds.

Closed Alpha is not where we first ask whether the game is fun.

---

# 17. Playtest report standard

Significant cohorts should record:

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

---

# 18. Roadmap success condition

AUREVANE should repeatedly follow:

```text
BUILD A SMALL COHERENT THING
        ↓
PLAYERS / OPERATIONS PROVE OR DISPROVE THE THESIS
        ↓
FIX THE WEAK LAYER
        ↓
PASS THE GATE
        ↓
EXPAND THE NEXT LAYER
```

The goal is not the fastest path to checking boxes. It is the fastest responsible route toward a distinctive, sustainable game.