# Phase 4 Combat Kernel v2 — P4.K0 Runtime & TypeScript Risk Audit

**Status:** completed repository-truth audit; implementation work follows on isolated branches.  
**Audit base:** `agent/combat-effect-taxonomy-rework` at `94ac22f08cfeb1ed33bd5c0d1fad54441ebef4ce`.  
**Roadmap authority:** `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md`.  
**Scope:** authoritative combat/runtime TypeScript boundaries only. This audit does not claim gameplay changes are implemented.

---

## 1. Executive ruling

The current combat branch is a sound base for Combat Kernel v2. It already uses strict TypeScript, discriminated action/effect unions, deterministic state transitions, runtime validators, immutable-style transitions and substantial focused combat tests.

The correct next move is **incremental hardening, not a rewrite**.

The highest-value work is to make identity/provenance/exhaustiveness explicit, then add offensive scaling and the versioned resolution pipeline on top of the existing tested mechanics. Current displacement, recovery, Poison/Bleed and gameplay-tag work must be preserved and reconciled rather than replaced.

---

## 2. Freshness/concurrency finding

During this audit the shared combat branch advanced after the C4 roadmap amendment was committed. The new commits added current Poison/Bleed work and related movement/state tests. The audit therefore refreshed to the later shared head instead of relying on the earlier handoff snapshot.

At the audit checkpoint:

- the shared combat branch contained the roadmap amendment and six later combat commits;
- `main` had also advanced independently with the approved scenery-led layout release and deployment-lock commits;
- the combat branch was therefore ahead of and behind `main` simultaneously;
- new Kernel work must use its own `agent/*` branch and reconcile current `main` before final merge.

No force-push/reset is authorized.

---

## 3. What is already strong

### Strict compiler baseline

Both `packages/game-core` and `apps/web` compile with `strict: true` and `noEmit: true`. The web app also uses `isolatedModules`.

### Typed combat grammar

Current combat already has discriminated unions for:

- target shapes;
- use requirements;
- effect definitions;
- target selections;
- resolution events;
- action issue codes;
- displacement failure reasons.

This is the right foundation for Kernel v2.

### Runtime validation

The action/content/encounter paths validate definitions/state before authoritative evaluation/execution. New authoring validation has also begun moving semantic constraints into reusable game-core code.

### Deterministic preview/commit reuse

Preview and commit share the same effect-resolution path for the current combat grammar. Preserve this invariant while adding Kernel v2 stages.

### Current effect-state compatibility

The branch has an explicit normalized `CombatEffectState` compatibility layer for historical snapshots, including recovery and current DoT collections. This is preferable to breaking old battles during the overhaul.

### Test investment

The branch now contains focused suites for displacement, recovery, Poison, Bleed, movement interactions, effect-state compatibility, gameplay tags and authoring validation. Future Kernel changes should extend these suites rather than bypass them.

---

## 4. Priority risks

### K0-R1 — Raw string identity across authoritative combat

**Risk:** high.

Battle/combatant/action/status/entity/content identifiers are mostly interchangeable `string` values at compile time. The engine therefore cannot prevent classes of mistakes such as passing a status ID where a combatant ID is expected.

**Direction:** introduce branded/opaque kernel ID types at safe boundaries, with runtime constructors for untrusted/persisted strings. Migrate incrementally; do not mass-cast the repository.

---

### K0-R2 — Incomplete effect/status provenance

**Risk:** high for future reactions, Copy/Mirror, summons, replay, analytics and kill/quest credit.

Current status instances retain status ID/version, stacks, remaining duration and source combatant. They do not yet carry the richer source-action/content/ruleset/trigger-chain provenance required by Kernel v2.

**Direction:** define provenance types first, then add fields compatibly behind encounter/schema versioning. Historical snapshots must remain readable.

---

### K0-R3 — Legacy optional encounter slices

**Risk:** high during Kernel expansion.

`CombatEncounterState` currently permits optional `statBridge`, `effectState`, `terrainOverlays` and `turnOrigin` slices. This is useful for historical compatibility, but it pushes repeated undefined-handling and non-null assumptions into authoritative runtime code.

**Direction:** keep the persisted compatibility boundary, but normalize to a stronger internal runtime shape before resolution. Do not simply make historical fields required and break old snapshots.

---

### K0-R4 — Authoritative non-null assertion in rewind path

**Risk:** medium/high.

The current rewind implementation uses `turnOrigin!` after earlier legality checks. The path is logically guarded today, but the compiler cannot prove the invariant and future refactors could separate validation from mutation.

**Direction:** replace authoritative non-null assumptions with an invariant helper/result that narrows the type at the mutation boundary.

---

### K0-R5 — Effect handling is discriminated but not explicitly exhaustive everywhere

**Risk:** medium and grows with every new effect family.

The current resolver uses a chain of `if` branches and then relies on the remaining union member being `apply-status`; projection logic similarly uses an implicit final branch. This currently type-checks, but it does not make the intended exhaustiveness contract obvious or reusable.

**Direction:** add a shared `assertNever`/exhaustiveness utility and use explicit exhaustive branches as effect families expand. A new union member should produce compile failures in every authoritative resolver/validator/presenter that must understand it.

---

### K0-R6 — Offensive stat bridge is not yet a complete damage input model

**Risk:** high for P4.K2 balance work.

Current damage can optionally read target Armor/Ward through `statBridge`, but ordinary authored damage does not yet have a universal typed offensive-scaling input. The bridge therefore cannot implement the approved `AuthoredBasePower + explicit OffensiveScaling` model without deliberate expansion.

**Direction:** P4.K2 must add explicit scaling profiles and required attacker/target stat projections. Do not hide offensive scaling inside existing `amount` fields or generic presentation tags.

---

### K0-R7 — Action source vocabulary is narrower than the approved future model

**Risk:** medium.

Current source types cover basic attack/action, Discipline Skill, scenario and test. Kernel v2 must eventually distinguish equipment, Essence, Soulmark, Mantle, status-granted, tactical-object/entity and temporary encounter actions while keeping one legality path.

**Direction:** define a canonical future action-source union in Kernel types, then migrate current action definitions compatibly. Do not fork separate executors for each content source.

---

### K0-R8 — Current DoT state spans status state and dedicated effect state

**Risk:** medium.

The branch intentionally has legacy status-based periodic effects plus current Poison/Bleed effect-state models. That split is acceptable during migration but becomes dangerous if every new mechanic invents another parallel lifecycle.

**Direction:** preserve current tested behavior, then P4.K3/P4.K4 should define which recurring mechanics are statuses, which are effect instances, and how both use shared provenance/trigger stages. No destructive consolidation during the active DoT ticket.

---

### K0-R9 — Ruleset/content bundle provenance is not yet first-class in encounter state

**Risk:** high for replay and competitive adjudication.

Action/status definitions have versions, but the encounter does not yet expose the complete ruleset/content-bundle provenance required to reproduce a mature battle exactly.

**Direction:** define the types in K1, introduce pinned fields in K3/K9 with backward-compatible normalization, and never rewrite completed battle history to current content.

---

### K0-R10 — Master Panel authorization has not yet been hardened to the new Owner-only ruling

**Risk:** high when P4.M implementation begins.

Older Master Panel plans anticipated delegated content staff. The Owner has since ruled that `/master` and its privileged APIs are Owner-only until explicitly changed.

**Direction:** P4.M must resolve the server-only bootstrap email to the immutable auth UUID and authorize every Master route/action/API against that UUID. Do not hard-code the Owner email in this public repository and do not use browser role/UI hiding as authorization.

---

## 5. Compiler-policy ruling

Do **not** flip broad additional compiler flags repository-wide during this combat overhaul merely for appearance.

`strict: true` is already active. Flags such as `noUncheckedIndexedAccess` may be valuable later, but a global switch could create unrelated churn across the monorepo and obscure Kernel work.

Instead:

1. harden authoritative combat types first;
2. remove unsafe escapes in touched authoritative paths;
3. add focused lint/type rules where they provide direct value;
4. consider stronger repo-wide flags in a separate measured engineering ticket.

---

## 6. Approved immediate implementation order

```text
P4.K0-A  This audit / branch reconciliation                  COMPLETE
P4.K1-A  Branded kernel IDs + version/provenance primitives NEXT
P4.K1-B  Explicit exhaustiveness helper/contracts
P4.K1-C  Internal normalized encounter type boundary
P4.K1-D  Canonical action-source vocabulary
P4.K2    Stat-Scaled Potency v2 with compatibility fixtures
P4.K3    Versioned resolution stages + trigger-chain safety
```

P4.K1 work must be additive first. It should not rebalance Skills or alter Poison/Bleed/recovery/displacement behavior.

---

## 7. Verification contract for K1

Because the current execution environment cannot clone GitHub directly, no local test result may be claimed from this audit session.

For implementation commits:

- use test-first changes;
- use GitHub Actions `CI` on the isolated `agent/*` branch as the executable verification boundary;
- inspect exact-head workflow status/logs;
- run focused package tests through CI where workflow support exists;
- reconcile latest shared combat branch and latest `main` before merge;
- run the required full quality gate on the final reconciled candidate;
- do not deploy to Vercel unless the Owner separately authorizes deployment.

---

## 8. Exit condition

P4.K0 is complete when this audit is committed and the next implementation work proceeds from fresh repository truth on an isolated branch.

It does **not** mean Combat Kernel v2 is implemented. It establishes the safe order in which to implement it.
