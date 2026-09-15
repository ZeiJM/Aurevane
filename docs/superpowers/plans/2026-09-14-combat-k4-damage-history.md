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

- [x] RED: hostile direct and periodic damage record actual HP loss.
- [x] RED: multiple packets in the same round aggregate deterministically.
- [x] RED: self-cost/reactive/system/self/same-team damage do not record.
- [x] RED: recording in a later round prunes entries older than the three-round window.
- [x] RED: recent-damage query ignores stale historical entries even before another record occurs.
- [x] RED: original encounter/effect state remains immutable.
- [x] GREEN: implement minimal pure helpers and package export.
- [x] Verify focused tests + game-core typecheck.

Task 1 evidence: the initial RED contract imported the missing ledger module. After the pure helper implementation, CI exposed only Prettier differences in the two new files. Self-cleaning verification workflow `34917444482` formatted only those files, passed the focused ledger suite, game-core typecheck, full `pnpm check`, and diff hygiene, then published a clean Task 1 commit.

### Task 2 — Authoritative resolver provenance wiring

**Files:**
- Modify `packages/game-core/src/combat/actions-legacy.ts`
- Add `packages/game-core/src/combat/combat-damage-history-runtime.test.ts`
- Modify `packages/game-core/src/combat/combat-damage-history.ts` for outgoing-round attribution.

- [x] RED: ordinary hostile direct damage records `direct-hostile` actual damage.
- [x] RED: Poison/Bleed/Burn/status periodic hostile damage records `periodic-hostile` actual damage.
- [x] RED: Burn backlash records nothing (`self-cost`).
- [x] RED: same-team/self damage records nothing even if a future action can author it.
- [x] GREEN: route committed damage through one provenance-aware ledger seam without changing damage amounts or event order.
- [x] Keep future `reactive`/`system` provenance explicit and non-recording by default.

Task 2 RED evidence: after a test-only narrowing correction, exact head `e0bfbb2a2c58fd8407776798f98bed82d45db71f` passed formatting, lint and typecheck, then failed only the three unwired runtime ledger assertions: overkill-clamped hostile direct damage, aggregated hostile periodic damage, and hostile command damage while excluding Burn backlash. The same-team friendly-fire exclusion already passed; the pure ledger suite and the other 1,230 game-core tests remained green.

Task 2 GREEN evidence: the first staging verifier failed mechanically before source publication because it targeted an older resolver layout. The live resolver was refreshed and the v2 self-cleaning workflow `34918811265` targeted the consolidated `resolveCurrentEndOfTurnDots` path. It passed both focused damage-history suites, game-core typecheck, full `pnpm check`, and diff hygiene, then removed both staging workflows and published clean source commit `a779f8c83d42b5669ab8d6a4d732810b4b56d2dd`.

The verified wiring records actual committed HP loss only. Direct hostile commands record after mitigation and overkill clamping. Legacy periodic statuses plus current Poison, Bleed and Burn use explicit `periodic-hostile` provenance and preserve the outgoing battle round even when `endTurn` advances the round before ticks resolve. Burn backlash is explicitly routed as `self-cost` and therefore does not enter the hostile ledger. Same-team/self requested hostile damage is downgraded to `system` before the shared ledger helper and remains excluded.

### Task 3 — Verification/integration

- [x] Run focused damage-history tests.
- [x] Run full `pnpm check`.
- [x] Verify diff hygiene.
- [ ] Reconcile onto the live shared combat branch after Pierce lands.
- [ ] Run exact integration gates before shared merge.
- [x] Do not deploy.
