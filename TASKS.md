# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. `docs/PHASE_3_TICKETS.md` defines the Phase-3 implementation contract. `docs/ROADMAP_PRODUCT_VALIDATION.md` defines PV-2 evidence requirements.

**Reconciled:** 2026-09-04

---

## Current status

**Stage:** Phase 3 — Signature Buildcraft Foundation — **IMPLEMENTATION COMPLETE; OWNER PV-2 HUMAN VALIDATION READY / NOT YET PASSED**.

**Phase 2:** CLOSED on 2026-09-02 by explicit Owner decision after the final production regression test. PV-1 is reconciled as completed by that Owner phase-exit decision; do not invent additional human evidence.

**Phase 3 implementation:** P3.1 through P3.8 are merged to `main` and deployed on the existing no-cost Supabase/Vercel stack.

**Phase 4:** **NOT ACTIVATED.** Roster expansion remains blocked on the Owner PV-2 product decision.

**Active implementation ticket:** none. The next action is human product validation, not more Phase-3 coding.

---

## Phase-3 production baseline

Runtime/test-access closeout:

- P3.1–P3.8 implementation merged through `main` commit `76446155d69ae283c8be1ba3f5525a0bf381b8cb`;
- Owner-only production PV-2 access merged at `abb7ae3cc50b4bc67efa8c9abc04251abdc02be7`;
- Vercel production deployment for `abb7ae3cc50b4bc67efa8c9abc04251abdc02be7` reached `READY`;
- production alias verified at `https://aurevane.vercel.app`;
- live Supabase Phase-3 migrations are applied through the private PV-2 tester allowlist migration;
- all 10 pre-existing characters were backfilled with authoritative active-build rows during Phase-3 migration preparation;
- the private PV-2 allowlist contains exactly one enabled Owner tester account;
- browser roles cannot read/write the allowlist table or execute its privileged lookup RPC directly;
- the PV-2 preparation route re-checks server authorization and selected-character ownership before granting representative test facts.

No paid Supabase branch or paid Vercel resource was created.

---

## Phase-3 delivered buildcraft platform

Phase 3 now provides:

- authoritative versioned Primary Discipline build state and base profiles;
- separately owned player-assigned attributes preserved across Primary changes;
- optional mastered Secondary Discipline;
- independent server-owned Primary/Secondary attunement cooldowns;
- mature versioned Discipline Skill definitions;
- generic server-authoritative owner-turn cooldown engine;
- persistent learned/equipped Discipline Skill authority;
- pure capacity: up to 8 Discipline Skills + Essence outside the cap;
- mixed capacity: 6 total Discipline Skills + Resonance;
- Profile as the persistent build headquarters;
- first representative Resonance framework and mixed build;
- first representative Essence framework and pure build;
- immutable committed build snapshots shared by Recruit AI and direct PvP;
- battle snapshot persistence across reconnect/Profile changes;
- saved-loadout authority with atomic activation, legality checks, idempotency and attunement protection;
- representative Vanguard/Lifebinder content sufficient for the PV-2 slice;
- owner-only production preparation path for the representative PV-2 character facts.

The existing Phase-2 tactical battle/PvP/spectator platform remains the execution foundation; Phase 3 did not fork a parallel combat rule path.

---

## Automated closeout evidence

The final Owner-access candidate passed the focused Phase-3 preservation gates:

- Representative Buildcraft — **PASS**;
- Discipline Build DB — **PASS**;
- Foundation Security DB — **PASS**;
- Battle Session DB — **PASS**;
- Wayfarer's Practice DB — **PASS**;
- Profile Skill Build — **PASS**;
- Resonance Build — **PASS**;
- Essence Build — **PASS**.

The final representative browser proof exercises production-equivalent Profile flow for:

- PV-2 test preparation;
- pure Vanguard `8 / 8` Skill configuration with active Essence;
- committed pure loadout persistence;
- Vanguard + Lifebinder Secondary preview/commit;
- mixed `6 / 6` configuration;
- active `Mercy's Edge` Resonance;
- Essence removal while Secondary is active;
- committed mixed loadout persistence.

Repository-wide aggregate CI still reports inherited Phase-2 formatting debt outside the Phase-3 changes. Browser Smoke has historically contained the inherited desktop Recruit-handoff sub-pixel geometry assertion (1.125 px observed versus 1 px tolerance); this is not a Phase-3 build-legality failure and must not be silently suppressed or confused with PV-2 evidence.

Automated correctness is **not** a PV-2 PASS.

---

## Owner PV-2 handoff

Use `docs/PV2_OWNER_TEST_RUNBOOK.md` and the live site:

`https://aurevane.vercel.app`

The Owner test should answer the product questions defined in `docs/ROADMAP_PRODUCT_VALIDATION.md`, especially whether the representative build system creates understandable, curiosity-driven experimentation around:

- Primary versus Secondary;
- Primary base-profile consequences;
- pure 8 + Essence versus mixed 6 + Resonance;
- Skill sources/AP/cooldowns;
- meaningful tactical changes between builds;
- build-configuration friction and recovery from poor experiments;
- mandatory, pointless, redundant or unreadable combinations.

Do not fabricate tester counts, ratings, direct-PvP human evidence or a PASS decision. Record only what the Owner actually tests/reports.

---

## Phase-3 / Phase-4 boundary

Phase 3 has reached its implementation gate from `docs/PHASE_3_TICKETS.md`: the representative slice is deployed and ready for the PV-2 product decision.

The next state transition is one of:

```text
PV-2 PASS
  → explicitly close Phase 3 and activate Phase 4

PV-2 ITERATE
  → reopen only the smallest weak Phase-3 layer identified by evidence

PV-2 INCONCLUSIVE
  → gather the missing human evidence without expanding the roster
```

Do not start broad roster production, large Resonance matrices, Soulmark/Mantle runtime, frontier systems or other later-phase expansion before the Owner PV-2 decision.

---

## Permanent execution rules

1. Inspect current `main`, roadmap, canonical specs and validation state before implementation.
2. One canonical implementation ticket is active at a time unless the Owner authorizes a wider verified batch.
3. Automated tests prove implementation safety, not fun/product validation.
4. Phase activation and deployment authorization are separate decisions.
5. All authoritative build, combat, progression, reward, inventory, PvP and persistence state remains server-owned.
6. Never silently redesign/remove mechanics or weaken authority/security to simplify implementation.
7. Keep temporary validation/support access bounded, auditable and fail-closed.
8. Keep this ledger current and concise.
