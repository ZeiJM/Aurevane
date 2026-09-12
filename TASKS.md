# AUREVANE — Active Task Ledger

**Final-testing release — 2026-09-12:** PR #461 is merged and live with battle button/picker tags from committed Skill versions, full current/historical execution contracts, four effect-badge repairs and safe Profile recovery diagnostics. All ten applicable CI workflows passed; live Fortress casting, reload, saved effect expiry and return to the unchanged Profile were verified. See `docs/PHASE_4_FINAL_TEST_READINESS.md` for exact evidence, the isolated recovered turn-clock 503 with unestablished cause, and the remaining A03/A04/A07/A10 human gates.

## Prior Phase 4 release — PR #459

Owner authorized full Phase 4 implementation and release. PR #459 is merged, deployed and activated with typed gameplay tags, Frozen/Steam terrain, shared targeting, the AI Sparring Arena picker fix and the Profile Discipline Atlas/Mastery extension. All fifteen exact-head CI workflows and authenticated live interaction checks passed. See `docs/PHASE_4_TICKETS.md` for actual evidence and the recovered Profile interruption. The deployment lock is restored by this documentation/configuration commit. Human tactical/media acceptance remains open.

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. `docs/PHASE_3_TICKETS.md` defines the Phase-3 implementation contract. `docs/ROADMAP_PRODUCT_VALIDATION.md` defines PV-2 evidence requirements.

**Reconciled:** 2026-09-12

**Phase-4 completeness audit:** See `docs/PHASE_4_COMPLETENESS_AUDIT.md` for current coverage and historical checkpoints. PR #455 released Chronist as the seventeenth Discipline, preserved Tidecaller, integrated Ironfist media, and placed the 36-identity Atlas inside Discipline Management. Its Representative Buildcraft gate included a real earned-Mastery UI claim. Those results validate the prior release only.

**2026-09-12 completed continuation:** PR #459 releases typed gameplay tags, Frozen/Steam terrain, twenty appended Skill versions, shared ground targeting, readable combat feedback, Arena picker styling and Atlas filtering/accessibility. Staged database activation followed compatible application READY. Repository, final review, database-concurrency, browser, exact-head CI and live checks passed; independent human tactical/media acceptance remains open.

---

## Current status

**Stage:** Phase 4 — First Playable Buildcraft Roster — **PLAYABLE IMPLEMENTATION LIVE; HUMAN ACCEPTANCE OPEN**. Phase 3 is closed by Owner decision; see `docs/PHASE_3_CLOSEOUT.md`.

**Phase 2:** CLOSED on 2026-09-02 by explicit Owner decision after the final production regression test. PV-1 is reconciled as completed by that Owner phase-exit decision; do not invent additional human evidence.

**Phase 3 implementation:** P3.1 through P3.8 are merged to `main` and deployed on the existing no-cost Supabase/Vercel stack.

**Phase 4:** **ACTIVATED** by explicit Owner request for full implementation and final production deployment. See `docs/PHASE_4_TICKETS.md`.

**Phase-3 closeout:** PR #445 passed its release checks and was released as `9da6c4684f99b0617cdccab019a38f90f56795b0`; the recorded Owner closeout decision is preserved. Production READY is not independent human/product evidence.

**Presentation follow-up:** PR #446 merged while this audit was in progress and was released at `0df098e8`; preserve its desktop/mobile changes and assess its exact release interaction evidence.

**Current implementation:** the full approved Phase-4 engineering scope through PR #459 is live for testing, preserving the earlier roster, media, self-target cockpit and earned Mastery.

**Live baseline:** 17 Disciplines, 136 regular Skills, 17 Essences, 136 unordered Resonance pairs and the 36-identity Atlas. Production deployment `dpl_CVuyfURtMUXM7LpZfWsEkyhv4Y9z` serves application commit `c5a9f633d5769a4cea15ed840473389e1a462aac`. See `docs/PHASE_4_FINAL_TEST_READINESS.md` for current CI, live checks, runtime follow-up and deployment-lock evidence. Earlier milestone notes below are historical.

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

## Audit implementation — 2026-09-12

Owner instruction: “Take what ever authorizations you need and implement.” This authorizes the implementation and its GitHub, database and production release steps. It does not fabricate human playtest results or final media acceptance.

- Chronist is added alongside Tidecaller: 17 Disciplines, 136 regular Skills, 17 Essences and 136 unordered pairs. During development testing, the separate testing entitlement makes every published Discipline immediately available without creating Mastery. With testing closed, Chronist requires Rekindling I plus Aetherist Adept; its eight Skills then follow normal 4/2/2 acquisition.
- Chronist schedules bounded Initiative changes for the next round (+20 Haste, -20 Delay, +40 Borrowed Hour, combined ±40). Each round remains a frozen order, each living unit receives one turn, and the next boundary restores base Initiative unless another effect was prepared. Lethal outgoing periodic damage excludes the defeated unit before the next turn is selected. No extra AP, extra turns or battle resets.
- Rewind Step returns only to the current turn's recorded starting tile. Root, blocked/occupied destinations and an unchanged position make it illegal. It never refunds resources, movement, health or prior commands. Origins and round schedules survive authoritative snapshot reloads.
- Normal player and AI Skill preview/commit now resolve the Resonance frozen in the committed build. The old isolated helper was tested but had not been wired into normal runtime. Setup persists through movement/end turn, the next authored Skill consumes or expires it, and the payoff is shown in previews without mutating state. Duplicate application through the older wrapper is prevented.
- Advanced AI now compares authored Skill scores on the same difficulty scale as basic actions, and values reachable Resonance setup/payoff. Tests exercise every advanced committed library, legal costs, unchanged input state and a reloaded mixed payoff.
- The complete recovered Ironfist media commit is retained. Chronist adds one generated painting at three runtime sizes plus three action and three Essence cues; exact originals, prompts, synthesis settings, hashes and testing-release manifests are retained. Human listening/visual acceptance remains open.
- Representative Buildcraft triggers cover advanced combat content, Mastery routes/service, migrations, media routing and verification scripts. Its focused suites now include temporal mechanics, the advanced effect matrix and actual AI choices. Database coverage adds Chronist's prerequisite, four/six/eight acquisition and all sixteen pairs. Browser coverage adds Chronist presentation and retains Ironfist silent-preview/committed-audio checks.

Validation and deployment results are recorded below when completed. Historical counts and release records earlier in this document refer to their original sixteen-Discipline snapshots.

Release checkpoint: local `pnpm check` passed (1,095 tests including the six report tests). Automatic review blocked publishing to public `ZeiJM/Aurevane`; explicit destination approval is required. See `docs/PHASE_4_TICKETS.md` for remaining CI, earned-Mastery UI and coordinated migration/deployment steps. No live-release completion is claimed.
