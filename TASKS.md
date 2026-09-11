# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. `docs/PHASE_3_TICKETS.md` defines the Phase-3 implementation contract. `docs/ROADMAP_PRODUCT_VALIDATION.md` defines PV-2 evidence requirements.

**Reconciled:** 2026-09-11

---

## Current status

**Stage:** Phase 4 — First Playable Buildcraft Roster — **PLAYABLE IMPLEMENTATION LIVE; HUMAN ACCEPTANCE OPEN**. Phase 3 is closed by Owner decision; see `docs/PHASE_3_CLOSEOUT.md`.

**Phase 2:** CLOSED on 2026-09-02 by explicit Owner decision after the final production regression test. PV-1 is reconciled as completed by that Owner phase-exit decision; do not invent additional human evidence.

**Phase 3 implementation:** P3.1 through P3.8 are merged to `main` and deployed on the existing no-cost Supabase/Vercel stack.

**Phase 4:** **ACTIVATED** by explicit Owner request for full implementation and final production deployment. See `docs/PHASE_4_TICKETS.md`.

**Phase-3 closeout:** PR #445 passed its release checks and was released as `9da6c4684f99b0617cdccab019a38f90f56795b0`; the recorded Owner closeout decision is preserved. Production READY is not independent human/product evidence.

**Presentation follow-up:** PR #446 merged while this audit was in progress and was released at `0df098e8`; preserve its desktop/mobile changes and assess its exact release interaction evidence.

**Current implementation:** PR #451 released the full sixteen-Discipline playable roster, short named effects, sparse conditional damage/tradeoffs and Mastery Trials. All 15 exact-head CI workflows and the production migration passed. The shared self-target cockpit correction is also released through PR #452 with all four applicable workflows passing and a successful live Fortress preview/commit check. Release evidence and remaining human/media acceptance are recorded in `docs/PHASE_4_TICKETS.md`.

**Live baseline:** Sixteen Disciplines, 128 regular Skills, 16 Essences and 120 Resonances, targeting/shape/effect tags, sparse conditional damage/tradeoffs and Mastery Trials are live. PR #454 adds ten painted advanced Discipline identities/Essence images and 72 synthesized audio variants at release `4ec4036c`, deployment `dpl_DWVodLdpQ7vN3jnPPptqjtLyGeEK`. All six release workflows and the live artwork/Fortress smoke check passed. This evidence commit restores the deployment lock. Independent human visual/listening and tactical balance acceptance remains open; earlier phase-boundary notes below are historical.

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
- pure capacity: up to 4 selected Discipline Techniques + Essence outside the cap;
- mixed capacity: up to 4 selected Techniques + Resonance; full splits 1+3, 2+2 or 3+1;
- Profile as the persistent build headquarters;
- first representative Resonance framework and mixed build;
- first representative Essence framework and pure build;
- immutable committed build snapshots shared by Recruit AI and direct PvP;
- battle snapshot persistence across reconnect/Profile changes;
- saved-loadout authority with atomic activation, legality checks, idempotency and attunement protection;
- eight-Skill libraries for Vanguard, Lifebinder, Aetherist, Farstrider and Shadehand, five Essences and ten unordered pair Resonances; Ironfist remains an incomplete sixth Foundation;
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

The historical initial P3.8 proof below predates the September four-Technique revision; preserve it only as historical evidence. Current tests must use four selected Techniques and consecutive-use falloff. That original proof exercised:

- PV-2 test preparation;
- pure Vanguard `8 / 8` Skill configuration with active Essence;
- committed pure loadout persistence;
- Vanguard + Lifebinder Secondary preview/commit;
- mixed `6 / 6` configuration;
- active `Mercy's Edge` Resonance;
- Essence removal while Secondary is active;
- committed mixed loadout persistence.

The historical aggregate formatting failures and Browser Smoke fitting issues above are no longer the current baseline: PR #444 passed all 11 triggered workflows before deployment. The final UI release must pass its own applicable checks. Preserve the regression guards; do not suppress failures to close the phase.

Automated correctness is **not** a PV-2 PASS.

---

## Owner PV-2 handoff

Use `docs/PV2_OWNER_TEST_RUNBOOK.md` and the live site:

`https://aurevane.vercel.app`

The Owner test should answer the product questions defined in `docs/ROADMAP_PRODUCT_VALIDATION.md`, especially whether the representative build system creates understandable, curiosity-driven experimentation around:

- Primary versus Secondary;
- Primary base-profile consequences;
- pure four selected Techniques + Essence versus mixed four selected Techniques + Resonance;
- Skill sources/AP/consecutive-use falloff;
- meaningful tactical changes between builds;
- build-configuration friction and recovery from poor experiments;
- mandatory, pointless, redundant or unreadable combinations.

Do not fabricate tester counts, ratings, direct-PvP human evidence or a PASS decision. Record only what the Owner actually tests/reports.

---

## Phase-3 / Phase-4 boundary

Phase 3 has reached its implementation gate from `docs/PHASE_3_TICKETS.md`. On 2026-09-11 the Owner approved closure after the final requested fixes and quality work, while explicitly reserving the command to start Phase 4.

The current transition is:

```text
Verified final UI/quality release
  → Phase 3 closed by Owner decision
  → wait for separate explicit Owner command to start Phase 4
```

Do not start broad roster production, large Resonance matrices, Soulmark/Mantle runtime, frontier systems or other later-phase expansion during this closeout. Owner closure is not independent cohort evidence or a Phase-4 start instruction.

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


## Phase 4 media continuation — historical candidate preparation

Branch `agent/phase4-media-candidates` prepares ten painted identity masters, 72 original synthesized cues, provenance, bounded central audio audition and an offline review gallery. `docs/PHASE_4_PLAYTEST_PACKET.md` provides actual-session scenarios and an empty results template. Automated media/runtime checks are recorded with the candidate pack. Browser walkthrough of the local review file was blocked by the browser URL policy and is not claimed. Human art/listening acceptance remains required by `docs/MEDIA_PIPELINE.md`; live assets and gameplay rules are unchanged.


## Phase 4 media integration continuation

PR #453 merged the candidate work at `f67cd8c3`; CI, Skill Engine and Browser Smoke passed. Branch `agent/phase4-media-integration` connects the Owner-authorized testing release of ten identity paintings and 72 synthesized cues. The shared committed-event path preserves authorization, gesture/mute settings and no-replay behavior. PR #454 merged at `f756d92d` with the exact tested tree unchanged. All six workflows passed on `d1dee5e9`; local `pnpm check` passed 1,016 Vitest tests, six Node report tests, lint/typecheck/formatting and production build. Release `4ec4036c` is READY at https://aurevane.vercel.app. Live artwork and Fortress preview/commit were verified, production error/fatal logs were empty, and the practice character returned to the Battle Hall. This commit restores the deployment lock and records detailed evidence in `docs/PHASE_4_TICKETS.md`. Independent human media/balance acceptance remains outstanding.
