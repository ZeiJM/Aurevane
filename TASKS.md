# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. Current `docs/PHASE_*_TICKETS.md` files define exact active/next execution.

**Reconciled:** 2026-09-02

---

## Current status

**Stage:** Phase 2 — Tactical Combat & Battle Platform — **Owner testing / final stabilization / pre-Phase-3 closeout**

**Phase-2 implementation:** mature and substantially beyond the original minimum.

Official Phase-2 credit includes:

- tactical combat and current 100-AP Action Economy;
- movement/path/terrain/elevation/facing;
- targeting/requirements/effects/status foundations;
- authoritative persistence/reconnect/idempotency;
- responsive battle UI/Inspect/forecasts/logs;
- Recruit AI and Battle Hall / AI Sparring;
- direct PvP lobbies/shared battles/multiple formats;
- PvP communication/timing/reconnect foundations;
- keyed read-only spectation;
- spectator presence/chat/logs/Inspect;
- multi-combatant desktop/mobile battle presentation;
- shared PvE/PvP battlefield-presentation foundations;
- stable battle-cockpit operational skill slots, selector behavior and slot-owned hotkey foundations;
- HP/MP Recovery swapping in the Heal cockpit slot as an early reusable skill-selection proof;
- Phase-2 Supabase performance baseline and additive FK-index hardening completed 2026-08-26 without changing gameplay/authority semantics.

The cockpit/skill-selection work above is **early compatible Phase-3 credit**, not completion of the Phase-3 Skill schema, persistent 8-pure/6-mixed loadout authority, cooldown engine, Resonance, Essence or build snapshots.

**ACTIVE VALIDATION GATE:** issue #105 — PV-1 Tactical Combat Human/Internal Validation — open until explicitly reconciled/closed.

**OWNER TESTING:** active. The Owner has one additional separate test pending before the final Phase-2 decision.

Do not infer Phase-2 PASS from automation, merges or deployment.

**ACTIVE IMPLEMENTATION TICKET:** none at this reconciliation point.

**ACTIVE CONTAINED CORRECTION:** PR #363 — repeated Finish Turn hotkey stabilization — remains separate from this closeout audit and should be reconciled through the Owner's current test flow.

New implementation should be either:

1. one contained Phase-2 correction justified by current testing;
2. one evidence-backed behavior-preserving Phase-2 performance hardening item allowed by `docs/ROADMAP_PERFORMANCE_SCALING.md`; or
3. **P3.1** after the Owner explicitly closes Phase 2.

**NEXT MAJOR FEATURE PHASE:** Phase 3 — Signature Buildcraft Foundation.

---

## Pre-Phase-3 closeout audit — 2026-09-02

A conservative repository/roadmap audit was performed before the Owner's final Phase-2 test.

### Repository hygiene accepted

The following historical scaffolding is safe to retire because it is not runtime code and its one-time purpose is complete:

- split `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part*` payload files;
- `.github/workflows/bootstrap-master-plan.yml`, which only reconstructed the already-present authoritative master plan;
- `.github/workflows/format-auth-shell-once.yml`, a branch-specific one-shot formatter;
- `.github/final-format-auth-shell.trigger`, which explicitly said to remove it before merge.

These removals do not alter gameplay, combat authority, database behavior, Vercel runtime behavior or player-facing presentation.

### Runtime cleanup boundary

Older review work identified several apparently unused battle components. They are **not** being deleted merely because an older branch called them dead. Current `main` has moved substantially since that review, including hotkey and shared-presentation work. Any runtime-component deletion must be supported by current import/reference evidence and normal CI/browser validation first.

This is intentional conservatism: repository cleanliness does not justify risking the current known-good battle behavior.

### Roadmap reconciliation

Phase 3 should reuse the early battle-cockpit work already delivered during Phase 2:

- four operational cockpit categories (`movement`, `attack`, `defense`, `heal`);
- stable slot-owned keybind identities;
- selector-versus-execute interaction separation;
- media/artwork hooks;
- shared PvE/PvP cockpit behavior;
- HP/MP Recovery as a real same-slot swap proof.

However, those four visible cockpit categories are **not** the Phase-3 persistent Skill-capacity model. Canonical Phase 3 remains:

```text
Pure:  up to 8 Primary Discipline Skills + 1 Essence Skill outside the cap
Mixed: 6 total Discipline Skills across Primary + Secondary + Resonance passive
```

The complete committed build snapshot is the source of truth. Cockpit selectors expose legal actions from that snapshot; they do not reduce the build to four total Skills. AI likewise must enumerate legal actions from the authoritative snapshot rather than only the four cards currently visible.

See `docs/ROADMAP_COCKPIT_SKILL_SLOTS.md` for the reconciled cockpit contract.

---

## Allowed while Phase 2 remains open

Contained fixes may address real findings in:

- battle readability/scale;
- multi-combatant rails/Inspect;
- PvP handoff/responsiveness;
- AI/PvP desktop/mobile parity;
- spectator clarity;
- battle logs;
- communication/timing regressions;
- active battle/spectation safety;
- profile/training/session interactions affecting the tested flow;
- genuine authority/security defects;
- measured request/database performance findings that can be corrected without changing gameplay behavior or authority boundaries.

Do not convert testing into unrelated Phase-3/4 scope.

Performance/scaling checkpoints are automatic at the boundaries defined in `docs/ROADMAP.md`; detailed behavior-preserving rules live in `docs/ROADMAP_PERFORMANCE_SCALING.md`.

---

## Phase-2 performance checkpoint — 2026-08-26

Current evidence:

- Supabase resource health is good with substantial headroom;
- ordinary gameplay reads are fast;
- request/polling shape is a larger future scaling concern than raw PostgreSQL execution;
- `commit_battle_intent_v2` already contains idempotency, expected-version and row-lock protections and must not be weakened for performance;
- active game-session leasing and character presence are separate responsibilities;
- historical rollback volume and combat-write tail latency remain diagnosis/measurement items, not justification for speculative rewrites.

Completed now:

- added `app_private.pvp_lobby_members(user_id)` FK-supporting index;
- added `app_private.product_validation_events(character_id)` FK-supporting index;
- reran Supabase performance advisor and confirmed both unindexed-FK findings cleared;
- preserved all gameplay, timer, session, combat, reward, progression and security semantics.

Deferred until code tracing/measurement justifies a contained change:

- request single-flight/deduplication;
- hidden-tab/adaptive polling;
- version-aware battle reads;
- selective battle/clock/event read consolidation;
- Realtime chat/presence or battle invalidation hints;
- broader load/concurrency testing.

Do not implement these merely because they are listed. Measure first and apply the smallest safe step.

---

## Phase-2 exit sequence

```text
OWNER FINAL TEST / CURRENT STABILIZATION
  ↓
Reconcile PR #363 or any other justified contained correction
  ↓
Automatic Phase-2 performance/scaling evidence review
  ↓
EXPLICIT OWNER DECISION
  ├── NOT READY → smallest repeated defect → retest
  └── PHASE 2 DONE
        ↓
      reconcile #105 + TASKS factually
        ↓
      activate docs/PHASE_3_TICKETS.md
        ↓
      start P3.1
```

Never fabricate human evidence or metrics.

---

## Owner Phase-3 activation rule

If the Owner clearly says wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Proceed to Phase 3.”
- “Code Phase 3.”

then treat it as explicit authorization to transition the feature roadmap into Phase 3.

Before runtime implementation:

- inspect current repository truth;
- reconcile the phase boundary;
- run/reconcile the automatic performance checkpoint required by `docs/ROADMAP.md`;
- preserve/reuse the current battle platform and early cockpit foundations;
- activate **P3.1 — Discipline Build Authority + Primary Base Profiles**.

This does **not** authorize Vercel deployment.

---

## Phase 3 execution sequence

```text
P3.1 Discipline build authority + Primary profiles
  ↓
P3.2 Secondary + independent attunement cooldowns
  ↓
P3.3 Mature Skill schema + cooldown engine
  ↓
P3.4 Profile Skill configuration + pure/mixed capacity
  ↓
P3.5 Resonance framework + mixed proof
  ↓
P3.6 Essence framework + pure proof
  ↓
P3.7 Shared AI / PvP / saved-loadout build snapshots
  ↓
P3.8 Representative buildcraft slice + PV-2 readiness
```

Phase 3 feeds PV-2 before Phase-4 roster expansion.

---

## Approved future long-horizon direction — not active implementation

### Rekindling replay differentiation

Authority: `docs/REKINDLING_FRONTIER.md`.

Approved direction:

- Rekindling should not repeat the identical progression journey;
- use Memory Carryover, Echo Routes, history-aware NPC/mentor interactions, alternate progression/build goals, abbreviated mastered tutorials and Hall of Selves;
- later cycles remain meaningful long journeys rather than becoming a trivial XP multiplier loop.

### The Unwritten Reach

Authority: `docs/REKINDLING_FRONTIER.md`.

Approved direction:

- common phrase: Edge of the World;
- working system/lore name: Unwritten Reach;
- persistent Anchors + mutable Driftspace;
- deterministic Cartographic Drift;
- Frontier Acumen based on demonstrated knowledge;
- legendary explorer identity through rare deeds/Chronicle attribution;
- working far-inhabitant concept: Veyr;
- long-term continuity threat: Inward Drift.

This is future Phase-5+ scope and must not leak into active Phase 2/3 work.

### Anomalies — corrected definition

Authority: `docs/ANOMALIES.md`.

Anomaly means **Owner-granted exceptional character state**, not frontier rarity/acquisition.

Initial approved forms:

```text
Soulmark + Mantle
Two Soulmarks
Two Mantles
```

Rules:

- ordinary gameplay cannot earn/find/craft/trade/buy/roll these states;
- the Unwritten Reach does not grant them;
- only the protected Owner may create/revoke them by default;
- creation uses audited server-authoritative Master Panel / Owner Override workflow;
- standard ranked PvP excludes gameplay-affecting Anomalies by default;
- analytics/support must identify exceptional state;
- full Anomaly Console belongs to mature Master Panel work, with safe representation anticipated earlier when Soulmark/Mantle systems are built.

---

## Current documentation truth

- `docs/ROADMAP.md` — current canonical phase plan, including automatic performance/scaling checkpoints.
- `docs/ROADMAP_PERFORMANCE_SCALING.md` — Owner-approved behavior-preserving performance/scaling companion and checkpoint procedure.
- `docs/ROADMAP_COCKPIT_SKILL_SLOTS.md` — early cockpit foundation and its Phase-3 integration boundary.
- `AGENTS.md` — permanent current coding/execution guidance.
- `docs/COMBAT.md` — current combat authority.
- `docs/PHASE_2_TICKETS.md` — historical Phase-2 record.
- `docs/PHASE_3_TICKETS.md` — exact next phase implementation sequence.
- `docs/ROADMAP_BUILD_SYSTEM_REWORK.md` — build-system sequencing companion.
- `docs/ROADMAP_PRODUCT_VALIDATION.md` — product validation gates.
- `docs/REKINDLING_FRONTIER.md` — Rekindling + Unwritten Reach authority.
- `docs/ANOMALIES.md` — Owner-only exceptional Anomaly authority.
- `docs/OWNER_OVERRIDE.md` / `docs/MASTER_PANEL.md` — privileged operational authority.

The old combined `docs/REKINDLING_FRONTIER_ANOMALIES.md` has been retired/removed so Anomalies cannot be mistaken for frontier rewards.

Passive Training early-stop reward semantics still require explicit canonical reconciliation if runtime behavior and the current domain specification disagree. Do not silently choose.

---

## Permanent execution rules

1. Inspect current `main`, open implementation/validation PRs/issues, roadmap and canonical domain docs before work.
2. One canonical implementation/correction boundary is active at a time unless the Owner authorizes a wider verified batch.
3. Owner testing may remain active while no implementation ticket is active.
4. Never use future feature breadth to hide a failed validation gate.
5. Early-delivered compatible work receives roadmap credit and is reused later.
6. Automated tests prove implementation safety, not fun/product validation.
7. Reconcile repository truth at every phase boundary.
8. Run the roadmap's automatic performance/scaling checkpoint at defined phase/scale boundaries; optimize only measured bottlenecks without changing game behavior or authority semantics.
9. Phase activation and deployment authorization are separate decisions.
10. Keep this ledger current and concise.