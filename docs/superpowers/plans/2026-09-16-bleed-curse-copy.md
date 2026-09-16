# Typed Bleed Curse Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the staged Curse status-copy command so explicitly eligible current Bleed stacks copy from caster to target with their current damage/timer state, stable donor ordering, the existing maximum-three-stack replacement rule, and K3 lineage.

**Architecture:** Follow the already integrated Poison and Burn typed-copy pattern rather than creating a second resolver. Bleed authoring/persistent rows gain an optional fail-closed `curseCopyable` policy. `planCombatStatusCopies` enumerates eligible donor Bleed stacks in stable `applicationOrder`; `applyCombatStatusCopies` inserts them sequentially through the same replacement semantics as `applyCurrentBleedState`; K3 assigns copy ordinals after ordinary statuses, Poison and Burn and tags only final surviving copied stacks. A same-command copied stack that is later replaced never receives persisted provenance, so later copies must not invent `inheritedFromInstanceId` for that transient row.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, existing AUREVANE combat kernel/K3 provenance, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md` section 14.2 (`Bleed: copy current independent Bleed stacks in stable order, respecting the target's maximum 3-stack replacement rule`).

## Global Constraints

- Build on verified shared combat merge `296e385ea878d2ca4d26de652084a9e41f8791d4`; do not modify `main`.
- Curse copies negative active effects from the user onto the target; the user keeps originals.
- Bleed copies current independent stacks in stable donor application order.
- Preserve each copied donor stack's current `damagePerTick` and `remainingTicks`; copying itself causes no tick/damage.
- Every receiver insertion must obey the existing maximum-three-stack replacement rule: replace fewest remaining ticks, tie by oldest application order.
- Newly copied Bleed source attribution is the Curse user/action.
- `curseCopyable = false` is excluded; omitted historical typed rows remain valid and non-copyable.
- Amplify does not copy typed Bleed in this slice.
- K3 copy ordinals remain one deterministic sequence: ordinary status copies, optional Poison, optional Burn, then every eligible Bleed donor stack in donor application order.
- Count every eligible Bleed copy attempt in the ordinal sequence even when a later copy replaces an earlier same-command copy; final surviving rows may therefore have non-contiguous Bleed ordinals.
- `copiedFromInstanceId` refers to the immediate donor stack when donor provenance exists.
- `inheritedFromInstanceId` refers only to a replaced receiver stack whose provenance actually existed before that insertion; do not synthesize lineage for a same-command transient copied stack that never had persisted provenance.
- Preserve exact `effectState` object identity when no typed Poison/Burn/Bleed copy occurs.
- No publication, AI, repeat-use, broader composition, UI, migration, dependency, workflow, deployment or `main` changes.

---

### Task 1: Permanent Bleed copy contract and valid RED

**Files:**
- Create: `packages/game-core/src/combat/combat-bleed-copy.test.ts`
- Read: `packages/game-core/src/combat/combat-bleed-rework.test.ts`
- Read: `packages/game-core/src/combat/combat-persistent-provenance-bleed-replacement.test.ts`
- Read: `packages/game-core/src/combat/combat-poison-copy.test.ts`
- Read: `packages/game-core/src/combat/combat-burn-copy.test.ts`

**Interfaces:**
- Consumes: `executeCombatAction`, `evaluateCombatAction`, `validateCombatActionDefinition`, `validateCombatEncounterState`, `currentBleedStacks`, K3 context/provenance constructors.
- Produces: one permanent behavioral contract that fails only because typed Bleed copying is absent.

- [ ] **Step 1: Add copy-policy boundary cases.**

Create helpers that author `{ type: 'bleed', recipient: 'primary-unit', damagePerTick, ticks, curseCopyable? }` through `unknown as CombatEffectDefinition` so RED can compile before production type extension. Assert `true`/`false` authoring is accepted once implemented; malformed values `[0, 1, 'true', null, {}, []]` are rejected at both validation boundaries; omitted historical state is encounter-valid and non-copyable; malformed persisted values yield an `effectState.bleed` issue.

- [ ] **Step 2: Add current-state transfer cases.**

Seed three eligible donor stacks with distinct application order/state, e.g. `(5 damage, 1 remaining)`, `(4, 2)`, `(2, 4)`. Assert an empty receiver gets three stacks in donor order, with exact donor `damagePerTick`/`remainingTicks`, new receiver application orders, Curse source/action, `curseCopyable: true`, donor unchanged, and no immediate HP change.

- [ ] **Step 3: Pin receiver cap/replacement semantics.**

Cover receiver starting with one, two and three stacks. For a full receiver, prove each copied donor is inserted sequentially and each insertion independently selects the current fewest-remaining stack, tie by oldest application. Add a case where an early same-command copied short stack is itself replaced by a later donor stack; final state must still have exactly three stacks and donor-copy processing order must remain stable.

- [ ] **Step 4: Pin runtime continuation and legality.**

Assert copied stacks tick independently on later owner end-turns, Cleanse removes all copied Bleed, Amplify never copies Bleed, omitted/false policy is ineligible, automatic-hit copy consumes no RNG, forecast is RNG-pure/non-mutating, and a hostile accuracy miss spends normal resources/RNG but leaves donor/receiver Bleed unchanged.

- [ ] **Step 5: Pin K3 lineage and ordinal semantics.**

Assert: (a) a copied stack links to its immediate donor; (b) replacement of a pre-existing receiver stack with provenance records that `inheritedFromInstanceId`; (c) copy-of-copy links to immediate copied donor; (d) no-context execution invents no provenance; (e) when ordinary status + Poison + Burn + multiple Bleed copies coexist, first Bleed ordinal is `ordinaryCount + poisonCount + burnCount` and subsequent Bleed attempts increment in donor order; (f) if a same-command copied Bleed is later replaced, the surviving later stack does not invent `inheritedFromInstanceId` for the transient copy; (g) JSON round-trip preserves final Bleed provenance/state.

- [ ] **Step 6: Prove valid RED.**

Run:
```bash
pnpm exec prettier --check packages/game-core/src/combat/combat-bleed-copy.test.ts
pnpm exec eslint packages/game-core/src/combat/combat-bleed-copy.test.ts
pnpm --filter @aurevane/game-core typecheck
pnpm --filter @aurevane/game-core exec vitest run --exclude '**/combat-bleed-copy.test.ts'
pnpm --filter @aurevane/game-core exec vitest run --reporter=json --outputFile=/tmp/bleed-copy-red.json
```
Expected: all prior game-core tests pass; failures are confined to `combat-bleed-copy.test.ts` and demonstrate missing Bleed copy policy/transfer behavior.

- [ ] **Step 7: Commit test-only RED source.**

Commit only `combat-bleed-copy.test.ts` to `agent/combat-k4-bleed-copy-296e385` after the diagnostic workflow proves RED. Keep workflow/scripts/this plan on `review/bleed-copy-296e385` only.

---

### Task 2: Bleed copy policy and persistent-state validation

**Files:**
- Modify: `packages/game-core/src/combat/actions-legacy.ts`
- Modify: `packages/game-core/src/combat/combat-authoring-validation.ts`
- Modify: `packages/game-core/src/combat/combat-dots.ts`
- Modify: `packages/game-core/src/combat/combat-effect-state.ts`

**Interfaces:**
- Produces: `CombatBleedStack.curseCopyable?: boolean`; authored Bleed optional `curseCopyable`; `validateCurrentBleedEffect` validates policy as well as damage/ticks; `applyCurrentBleedState(..., damagePerTick, ticks, curseCopyable?)` persists policy.

- [ ] **Step 1: Extend authored/persistent types.**

Add optional `curseCopyable?: boolean` to Bleed effect definition and `CombatBleedStack`, mirroring current Poison/Burn compatibility comments. Existing callers remain source-compatible because the new apply parameter is optional.

- [ ] **Step 2: Extend Bleed validation.**

Make `validateCurrentBleedEffect` accept `{ damagePerTick, ticks, curseCopyable?: unknown }` and throw `TypeError('Bleed curseCopyable must be boolean when supplied.')` for supplied non-booleans. Call it from both authoring validation boundaries.

- [ ] **Step 3: Persist policy on direct application.**

Extend `applyCurrentBleedState` with optional `curseCopyable`; include the property only when defined. Direct reapplication remains independent-stack behavior: an unflagged new stack does not alter older stacks' flags; the new stack simply omits the flag.

- [ ] **Step 4: Fail closed on saved state.**

Extend `validateCurrentBleedState` so any persisted non-boolean `curseCopyable` makes `effectState.bleed` invalid while omitted historical rows remain valid.

- [ ] **Step 5: Run focused boundary tests.**

Run the permanent Bleed-copy contract plus `combat-bleed-rework.test.ts`, `combat-dot-rework.test.ts`, authoring validation and provenance-state tests. Expected: policy/validation cases green; transfer cases may remain red until Task 3.

---

### Task 3: Sequential Curse transfer through the existing Bleed cap rule

**Files:**
- Modify: `packages/game-core/src/combat/combat-status-copy.ts`
- Reuse: `packages/game-core/src/combat/combat-dots.ts`

**Interfaces:**
- Produces: `CombatCopyPlan.bleed`, an ordered list of eligible donor stack copy attempts with enough simulated receiver information to forecast/apply/reconstruct final survivors and K3 lineage.

- [ ] **Step 1: Enumerate eligible donors in stable order.**

Use `currentBleedStacks(state, donorId).filter(stack => stack.curseCopyable === true)` only for Curse. Do not infer Bleed from ordinary status rows and do not include it for Amplify.

- [ ] **Step 2: Simulate sequential receiver insertion in the plan.**

Starting from the receiver's current Bleed rows and the encounter's current global maximum `applicationOrder`, process each donor in donor application order. For each attempt: identify the current replacement candidate using the exact runtime comparator `(remainingTicks, applicationOrder)` when receiver count is already three; assign the next global application order; remove the candidate if required; append a simulated copied row preserving donor damage/current remaining ticks and rebinding source/action conceptually. Record the donor, replaced row (if any), assigned application order, attempt index and whether the copied row survives the complete simulation.

- [ ] **Step 3: Make legality include Bleed.**

A pure Curse is legal when any ordinary status, Poison, Burn or eligible Bleed stack exists. No eligible effects remains illegal with the existing message.

- [ ] **Step 4: Apply copies sequentially with the existing helper.**

In `applyCombatStatusCopies`, after ordinary status/Poison/Burn work, loop eligible Bleed donors in stable order and call `applyCurrentBleedState(nextState, actorId, receiverId, actionId, donor.damagePerTick, donor.remainingTicks, true)`. This deliberately reuses the canonical cap/replacement rule rather than duplicating mutation logic.

- [ ] **Step 5: Produce deterministic preview projections.**

Add one `copy-statuses` projection per Bleed copy attempt in donor order. Use `before` to summarize the receiver stack replaced by that insertion or `none`, and `after` to summarize the copied `damagePerTick`/`remainingTicks`. Forecast must remain state/RNG-pure.

- [ ] **Step 6: Run transfer/runtime tests.**

Run `combat-bleed-copy.test.ts`, `combat-bleed-rework.test.ts`, Poison/Burn copy contracts, status-copy tests and dot tests. Expected: state transfer/cap/runtime cases green; K3 lineage cases may remain red until Task 4.

---

### Task 4: K3 provenance for final surviving Bleed copies

**Files:**
- Modify: `packages/game-core/src/combat/combat-status-copy.ts`
- Test: `packages/game-core/src/combat/combat-bleed-copy.test.ts`
- Regress: `packages/game-core/src/combat/combat-persistent-provenance-bleed-replacement.test.ts`

**Interfaces:**
- Consumes: planned Bleed attempt order/application orders and existing `createCombatEffectInstanceProvenance`.
- Produces: K3 provenance only on final surviving copied Bleed rows.

- [ ] **Step 1: Reserve ordinals for every eligible Bleed attempt.**

Compute Bleed base ordinal as `copies.length + (poison ? 1 : 0) + (burn ? 1 : 0)`. Each donor attempt gets `base + attemptIndex`, even if its row is later replaced. This follows K3's stable zero-based index among copies emitted by the authored effect.

- [ ] **Step 2: Attach provenance to surviving rows by planned application order.**

For each final surviving copied Bleed row, create provenance with action context, receiver target, effect ordinal 0, reserved copy ordinal, current command round/turn, and donor provenance as `copiedFromInstanceId` when present.

- [ ] **Step 3: Preserve only real inherited lineage.**

If the replacement recorded for that insertion was a pre-existing receiver row or otherwise already carried actual provenance at insertion time, pass its `instanceId` as `inheritedFromInstanceId`. If the replaced row is an earlier same-command transient copy with no persisted provenance yet, omit inherited lineage; never manufacture its would-be ID.

- [ ] **Step 4: Keep non-Bleed typed identity stable.**

If no Bleed provenance needs attaching, leave existing Poison/Burn arrays unchanged by reference where the existing function already does so; do not normalize or rebuild unrelated typed state merely because Bleed planning exists.

- [ ] **Step 5: Run K3 regressions.**

Run Bleed copy contract, `combat-copy-provenance.test.ts`, `combat-persistent-provenance-bleed-replacement.test.ts`, provenance-state/threading tests, and Poison/Burn copy contracts. Expected: all green.

---

### Task 5: Documentation, full GREEN, retention and integration gates

**Files:**
- Modify: `docs/COMBAT.md`
- Test/verify all changed production and test files.

**Interfaces:**
- Produces: one exact verified feature candidate containing only the permanent Bleed test, implementation and concise staged docs.

- [ ] **Step 1: Document staged Bleed copy semantics.**

Append a concise section stating explicit optional policy, donor stable order, current damage/timer preservation, sequential existing three-stack replacement rule, no immediate damage, Curse-only source rebinding, K3 ordering/lineage, and excluded Bleed-adjacent gates.

- [ ] **Step 2: Run focused GREEN.**

Run core typecheck and the Bleed copy/rework/provenance/status-copy/Poison/Burn focused suite. All must pass.

- [ ] **Step 3: Run full repository GREEN.**

Run:
```bash
pnpm check
```
Expected: formatting, lint, all workspace typechecks, every test suite and production build green.

- [ ] **Step 4: Retain only verified source.**

Before committing, assert shared remains `296e385ea878d2ca4d26de652084a9e41f8791d4`, `main` remains unchanged, and the feature branch still points at the final RED source. Commit only the planned permanent paths; diagnostic plan/scripts/workflows stay on `review/bleed-copy-296e385`.

- [ ] **Step 5: Exact-head PR gates and review.**

Open a draft PR to `agent/combat-effect-taxonomy-rework`, inspect the full diff, submit exact-head agent self-review, require CI + Skill Engine + Representative Buildcraft + Browser Smoke success, refresh refs/reviews/threads, then mark ready.

- [ ] **Step 6: Expected-head locked merge and post-merge verification.**

Merge normally with `expected_head_sha` locked to the tested candidate. Verify actual merge first/second parents and exact tested tree. Require exact merge-head push CI Quality + Database success before declaring Bleed integrated. Do not deploy or modify `main`.

## Self-Review

- Spec coverage: current independent Bleed stacks, stable order and maximum-three replacement are each directly covered. Source rebinding and exclusions follow section 14.2/14.3 and already integrated Poison/Burn policy.
- Compatibility coverage: omitted historical policy, malformed persisted policy, direct Bleed runtime, Cleanse, miss/RNG, state identity and JSON persistence are explicit.
- K3 consistency: ordinals follow ordinary → Poison → Burn → Bleed attempts; immediate donor lineage is preserved; same-command transient replacement does not invent inherited lineage.
- Placeholder scan: no deferred implementation steps or unspecified test classes remain.
- Type consistency: authored/persisted property is uniformly `curseCopyable?: boolean`; runtime uses existing `CombatBleedStack` fields `damagePerTick`, `remainingTicks`, `applicationOrder`.
