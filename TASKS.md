# AUREVANE — Active Task Ledger

This file reports the **current implementation/validation boundary**.

`docs/GAME_MASTER_PLAN.md` defines the product. `docs/ROADMAP.md` defines phase sequence. Canonical domain documents define system rules. `docs/PHASE_3_TICKETS.md` defines the active implementation sequence.

**Reconciled:** 2026-09-04

---

## Current status

**Stage:** Phase 3 — Signature Buildcraft Foundation — **P3.7 implementation/validation closed; P3.8 activated as the next implementation ticket**.

**Phase 2:** CLOSED on 2026-09-02 by explicit Owner decision after the final production regression test. The Owner reported the live build “works perfectly.” No tester counts, ratings, or other human-validation metrics are inferred beyond that explicit statement.

**Production closeout baseline:**

- `main` commit `1355fbd710c480ca1d075254a5559568708bde3c`;
- Vercel production deployment for that exact commit reached `READY`;
- production alias verified at `aurevane.vercel.app`;
- focused final battle-input release validation passed 4/4 in Chromium and 4/4 in real Microsoft Edge;
- the final regression covered Recovery slot swapping, Guard deliberate double-press, Inspect dismissal after narrow-window resize, OS-repeat protection, and repeated PvP Space → Space Finish Turn handoffs while preserving facing.

**PV-1 / issue #105:** reconciled as completed by Owner phase-exit decision. Do not invent additional human evidence.

**ACTIVE IMPLEMENTATION TICKET:** **P3.8 — Representative Buildcraft Slice + PV-2 Readiness**.

P3.1 through P3.7 are implemented in the current stacked Phase-3 sequence. The final P3.7 runtime candidate is `2455eb7733358b2af3800083a37a749cde6c2916` on `agent/p3-7-shared-build-snapshots`.

P3.7 closeout evidence includes:

- shared immutable committed build snapshots across Recruit AI and direct PvP;
- Primary/Secondary, ordered Discipline Skills, resolved Resonance/Essence and content/build version identity carried by the battle authority snapshot;
- persisted battle snapshots remain frozen across Profile changes and reconnect;
- Recruit AI preserves the frozen build authority through shared combat-state transitions;
- saved-loadout server/API foundation captures only the current authoritative legal build and activates only a stored server-owned slot;
- saved-loadout activation remains atomic, optimistic-versioned, idempotent and subject to mastery, Skill legality and independent Primary/Secondary attunement cooldowns;
- focused Shared Build Snapshots validation passed formatting, lint, game-core/web typechecks, 9/9 focused game-core tests, 19/19 focused web tests and the full production workspace build;
- fresh cumulative Discipline Build DB validation passed migration rebuild plus P3.1, P3.2, P3.4, P3.5, P3.6 and P3.7 authority verifiers;
- current-head database-foundation validation remains green;
- repository-wide aggregate quality remains blocked only by the inherited set of 20 pre-existing Phase-2 battle/UI Prettier files. P3.7-owned formatting debt is cleared; do not churn those unrelated files as part of P3.7 closeout.

No deployment has been performed or authorized for Phase 3.

---

## Phase-2 delivered platform to preserve

Phase 2 substantially exceeded the original minimum and supplies reusable foundations for later phases:

- deterministic server-authoritative tactical combat;
- current 100-AP Action Economy;
- movement/path/terrain/elevation/facing;
- targeting/requirements/effects/status foundations;
- authoritative persistence/reconnect/idempotency/concurrency behavior;
- Battle Hall / Recruit AI;
- direct PvP lobbies and shared battles;
- multiple PvP combatant formats;
- battle communication/timing/reconnect foundations;
- keyed read-only spectation with spectator presence/chat/logs/Inspect;
- responsive desktop/mobile battle presentation;
- shared PvE/PvP battlefield presentation;
- battle logs, forecasts, Inspect and cockpit controls;
- stable category-owned hotkeys;
- HP/MP Recovery same-slot swapping as an early reusable action-selection proof.

Phase 3 must build on these assets rather than recreate battle UI, PvP, spectation, hotkey ownership or basic combat execution.

---

## Phase-boundary performance / security checkpoint — 2026-09-02

The required phase-boundary checkpoint was rerun before activating Phase 3.

Current observed platform state:

- Supabase project status: `ACTIVE_HEALTHY`;
- latest exact Phase-2 production Vercel deployment: `READY`;
- Supabase performance advisor reports only informational unused-index candidates; **do not delete indexes merely because they are currently unused**;
- Supabase security advisor reports informational RLS-enabled/no-policy notices plus leaked-password protection disabled. These are recorded follow-up/security-hardening items, not evidence of a Phase-2 runtime regression. Preserve fail-closed/server-only access patterns and review the advisories deliberately rather than adding speculative policy changes.

Performance/scaling remains cross-cutting. Measure before optimizing; never weaken server authority, security, idempotency, battle versioning, rewards, progression or timer semantics for performance.

---

## Phase-2 repository closeout

Closeout hygiene removes only historical scaffolding with no runtime authority:

- split `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part*` reconstruction payloads;
- the completed master-plan bootstrap workflow;
- the obsolete branch-specific authenticated-shell one-shot formatter;
- its historical `Remove before merge` trigger.

The canonical `docs/GAME_MASTER_PLAN.md` remains authoritative.

Stale Phase-2 implementation PRs are to be closed as superseded by the tested production baseline. Closing a stale PR does not erase its Git history and it may be inspected later if a regression requires archaeology.

Do **not** delete runtime battle components merely because an older branch once considered them unused. Any future runtime cleanup requires fresh current-main import/reference evidence plus normal validation.

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

### Active P3.8 contract

P3.8 is the representative integration/readiness slice, not a new foundational subsystem and not a roster-scale content pass.

Use the smallest coherent representative set that honestly proves:

- materially different Primary identities;
- Secondary mixing;
- legal pure 8 Discipline Skills + Essence versus mixed 6 total Discipline Skills + Resonance;
- multiple real Skills and server-authoritative cooldowns;
- representative equipment interactions where current item foundations support them without inventing unsupported systems;
- shared AI and direct-PvP legality from the same committed build snapshot;
- clear Profile configuration/comparison across the representative builds;
- PV-2 readiness and factual evidence hooks for later human product validation.

Do not pull later Soul State/Soulmark/Severance/Mantle runtime into Phase 3. Do not confuse automated implementation validation with PV-2 human product evidence. Do not scale the roster before the representative buildcraft thesis is proven.

---

## Cockpit / Skill-capacity integration rule

The existing four battle cockpit operational categories are an action-selection/presentation layer, **not** the persistent Phase-3 Skill-capacity model.

Canonical capacity remains:

```text
Pure:  up to 8 Primary Discipline Skills + 1 Essence Skill outside the cap
Mixed: 6 total Discipline Skills across Primary + Secondary + Resonance passive
```

The complete committed legal build snapshot remains authoritative. The cockpit derives legal actions from that snapshot plus canonical basic actions. AI must enumerate all legal actions from the same authoritative snapshot rather than being limited to the four human-visible cockpit cards.

See `docs/ROADMAP_COCKPIT_SKILL_SLOTS.md`.

---

## Permanent execution rules

1. Inspect current `main`, open implementation/validation work, roadmap and canonical domain docs before implementation.
2. One canonical implementation ticket is active at a time unless the Owner authorizes a wider verified batch.
3. Preserve compatible early-delivered foundations and give them roadmap credit.
4. Automated tests prove implementation safety, not fun/product validation.
5. Run the roadmap performance/scaling checkpoint at defined boundaries; optimize only measured bottlenecks.
6. Phase activation and deployment authorization are separate decisions.
7. All authoritative build, combat, progression, reward, inventory, PvP and persistence state remains server-owned.
8. Never silently redesign or remove mechanics; reconcile conflicts against the Master Plan and applicable canonical specification.
9. Keep temporary one-shot workflows/triggers out of `main` after their purpose is complete.
10. Keep this ledger current and concise.
