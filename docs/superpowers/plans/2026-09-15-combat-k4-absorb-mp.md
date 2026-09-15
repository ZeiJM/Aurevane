# Combat K4 Absorb MP Implementation Plan

**Goal:** Add owner-approved Absorb MP as the MP counterpart to verified Absorb HP, using the same hostile direct-damage and anti-recursion boundary.

**Architecture:** Extend timed status metadata with `absorbMpBasisPoints`. After ordinary hostile direct HP damage is committed and the defender remains alive, restore MP from the same actual HP damage summary. Keep HP and MP Absorb independent but coexistent; periodic, reactive, self-cost/system, and non-hostile damage stay outside this direct-damage hook.

**Spec:** `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md` §§4–6, 15–16.

## Constraints

- Authored Absorb MP percentage: positive safe integer 1..10000 basis points; positive polarity; reactive class.
- Actual recovery = floor(actual qualifying HP damage × total active basis points / 10000), minimum 1 when qualifying damage > 0 and percentage > 0.
- Combined active Absorb MP recovery is capped at 100% of qualifying damage.
- MP recovery cannot exceed max MP and cannot trigger after lethal damage.
- Non-hostile direct damage and all periodic/current DoT paths remain excluded.
- Absorb HP and Absorb MP may both resolve from the same qualifying direct-damage summary without recursively triggering each other.
- Emit `resource_changed` with action id `status.absorb-mp.current.v1`; source/target are the damaged owner.
- No deployment.

### Task 1 — RED contract

Create `packages/game-core/src/combat/combat-absorb-mp.test.ts` covering direct recovery, minimum-1 rounding, max-MP cap, lethal exclusion, non-hostile exclusion, periodic exclusion, combined 100% cap, coexistence with Absorb HP, and authoring validation. Run the focused test and confirm failures are only missing MP behavior/metadata.

### Task 2 — GREEN implementation

Modify `combat-effect-state.ts`, `combat-authoring-validation.ts`, and `actions-legacy.ts` only. Add optional typed MP metadata, strict validation, and one non-recursive MP recovery step after the existing Absorb HP recovery. Preserve all existing HP behavior and damage event ordering.

### Task 3 — verification/integration

Run the focused Absorb MP contract, game-core typecheck, full `pnpm check`, diff hygiene, then the standard exact-head CI/Skill Engine/Representative Buildcraft/Browser Smoke gates. Reconcile newer shared/main work before merge if necessary. Never force-push and do not deploy.
