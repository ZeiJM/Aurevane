# Combat K4 Damage History & Provenance Foundation

> **For agentic workers:** use TDD and verification-before-completion for every task.

**Goal:** Build one authoritative, bounded damage-history ledger that Vengeance, Reflect, Absorb HP/MP, analytics and later reaction mechanics can reuse without inferring semantics from action/status names.

**Architecture:** Use the existing typed `DamageProvenance` and `CombatEffectState.damageHistory` contracts. First add pure immutable ledger helpers that accept actual committed HP loss plus explicit provenance. Then wire authoritative direct/periodic damage producers to those helpers in a separate task. The ledger stores only already-qualified hostile HP loss, aggregated per victim and battle round, and keeps the current + previous two rounds.

**Spec:** `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md` §§4 and 12; `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md` §§5–7.

## Constraints

- Count actual HP loss only; callers pass post-mitigation/post-overkill-clamp damage.
- Qualifying kinds: `direct-hostile`, `periodic-hostile`.
- Exclude `reactive`, `self-cost`, `system`, self-damage and same-team damage.
- Do not infer provenance from action/status IDs or presentation tags.
- Aggregate multiple qualifying packets for one victim within one round.
- Keep a three-round sliding window: current round + two previous rounds.
- Historical snapshots with no effect state remain valid.
- No Vengeance damage formula, Reflect, Absorb or content rebalance in this ticket.
- No deployment.

### Task 1 — Pure ledger RED/GREEN

**Files:**
- Create `packages/game-core/src/combat/combat-damage-history.ts`
- Create `packages/game-core/src/combat/combat-damage-history.test.ts`
- Modify `packages/game-core/package.json`

- [ ] RED: hostile direct and periodic damage record actual HP loss.
- [ ] RED: multiple packets in the same round aggregate deterministically.
- [ ] RED: self-cost/reactive/system/self/same-team damage do not record.
- [ ] RED: recording in a later round prunes entries older than the three-round window.
- [ ] RED: recent-damage query ignores stale historical entries even before another record occurs.
- [ ] RED: original encounter/effect state remains immutable.
- [ ] GREEN: implement minimal pure helpers and package export.
- [ ] Verify focused tests + game-core typecheck.

### Task 2 — Authoritative resolver provenance wiring

**Files:**
- Modify `packages/game-core/src/combat/actions-legacy.ts`
- Modify/add focused provenance tests as needed.

- [ ] RED: ordinary hostile direct damage records `direct-hostile` actual damage.
- [ ] RED: Poison/Bleed/Burn/status periodic hostile damage records `periodic-hostile` actual damage.
- [ ] RED: Burn backlash records nothing (`self-cost`).
- [ ] RED: same-team/self damage records nothing even if a future action can author it.
- [ ] GREEN: route committed damage through one provenance-aware ledger seam without changing damage amounts or event order.
- [ ] Keep future `reactive`/`system` provenance explicit and non-recording by default.

### Task 3 — Verification/integration

- [ ] Run focused damage-history tests.
- [ ] Run full `pnpm check`.
- [ ] Verify diff hygiene.
- [ ] Reconcile onto the live shared combat branch after Pierce lands.
- [ ] Run exact integration gates before shared merge.
- [ ] Do not deploy.
