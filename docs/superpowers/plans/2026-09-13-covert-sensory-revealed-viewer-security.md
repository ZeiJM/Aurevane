# Covert, Sensory, and Revealed Viewer-Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Covert as server-side viewer-specific information redaction, Sensory as its non-leaking counter, and Revealed as a visible buff-purge/Skill-AP penalty state without exposing hidden information through alternate endpoints.

**Architecture:** Build on the combat-effect metadata and Skill-cost pipeline from `2026-09-13-combat-runtime-effects-discipline-rebalance.md`. Persist full authoritative events/state, attach stable command execution provenance at commit time, and perform redaction in server projection/log services before serialization. Covert is never a client-only concealment feature.

**Tech Stack:** TypeScript 6, Vitest 4, Next.js 16/React 19, pnpm workspaces, Supabase battle-event/session repositories.

**Spec:** `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-design.md`, `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-privacy-amendment.md`

## Global Constraints

- Requires the runtime plan through shared effect polarity/copyability metadata and the resolved Skill AP-cost helper.
- Authoritative persistence always retains complete hidden action/buff information; hidden values are removed before browser serialization.
- Covert is positive, non-stacking, refreshes duration, current bound 1–4 owner-turn-start boundaries, `amplifyCopyable = false`.
- Covert hides positive buff identities/details and covered action identities/details from opposing viewers only; owner/allies retain full entitlement.
- Covert does not hide HP, MP, board position, facing where otherwise public, negative effects, turn ownership, or battle completion.
- Covered Covert commands: Basic Attack, regular Discipline Skills, copied Skills, Essence Skills, Guard, HP Recover, MP Recover. Movement/facing/turn/system events remain observable.
- Hidden historical actions remain hidden after Covert ends or target is Revealed.
- Sensory legality/preview never leaks whether the target is Covert.
- Successful Sensory against a Covert target purges that target's ordinary positive active buffs, removes Covert, then applies Revealed.
- Revealed is visible negative, non-stacking, current bound 1–4, Cleanse-removable, `curseCopyable = false`, blocks Covert and doubles qualifying Skill AP after intrinsic Copy half-cost.
- Revealed doubles regular Discipline Skill, copied Skill, and Essence Skill AP only; not movement, Basic, Guard, Recover, facing, or MP.
- Production deployment is not part of this plan.

---

### Task 1: Stable Command Execution Provenance

**Files:** Modify `packages/game-core/src/combat/actions.ts`, `packages/game-core/src/combat/combat-effect-state.ts`, `apps/web/src/server/battle/battle-session-service.ts`, `apps/web/src/server/battle/battle-final-turn-service.ts`; modify tests in `actions.test.ts` and `battle-session-service.test.ts`.

**Interfaces:** Produce one `commandExecutionId` for every event caused by a committed action and persisted command-start Covert visibility provenance.

- [ ] Write failing grouping test: Skill action-use, damage, status, resource and displacement child events share one execution ID; unrelated turn/round events do not.
- [ ] Write failing Covert-sampling test: command starts Covert then changes/removes Covert; persisted command still records it began Covert.
- [ ] Run:
```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/actions.test.ts
pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-session-service.test.ts
```
- [ ] Implement:
```ts
export interface CombatCommandExecutionContext {
  id: string
  actorCombatantId: string
  actorWasCovertAtStart: boolean
}
```
Create ID at authoritative commit and pass through effect resolution without consuming battle RNG.
- [ ] Re-run and commit:
```bash
git add packages/game-core/src/combat apps/web/src/server/battle
git commit -m "feat: group battle events by command execution"
```

### Task 2: Viewer Entitlement and Server-Side Battle Snapshot Projection

**Files:** Create `apps/web/src/server/battle/battle-viewer-projection.ts` and `.test.ts`; modify `battle-session-service.ts`, `pvp-battle-quality-service.ts`, `pvp-battle-profile-service.ts` and tests.

**Interfaces:** Produce `BattleViewerEntitlement` and `projectBattleStateForViewer(state, entitlement)`.

- [ ] Failing owner/ally/opponent tests: opponent cannot receive Covert or positive buff identities; owner/ally can; negative effects remain visible.
- [ ] Serialize opponent projection and assert hidden IDs, magnitudes, durations, counts and source metadata do not appear in JSON.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-viewer-projection.test.ts src/server/battle/battle-session-service.test.ts src/server/battle/pvp-battle-quality-service.test.ts
```
- [ ] Implement viewer projection before serialization; spectator entitlement is explicit and never defaults to full secrets.
- [ ] Route PvE/PvP reconnect/session/profile/quality projections through shared policy.
- [ ] Re-run and commit `feat: add viewer-specific battle projection`.

### Task 3: Viewer-Aware Covert Battle-Log Redaction

**Files:** Modify `battle-log-service.ts`, `battle-log-handler.ts`; modify `battle-log-service.test.ts`, `battle-log-handler.test.ts`, `battle-log-recovery-presentation.test.ts`.

- [ ] Hidden-command test: one generic `Wayfarer performed an action.` replaces action-use + child damage/resource/status chain; no action identity/cost/hit/shape leaks.
- [ ] Owner/ally sees full chain.
- [ ] Positive buff applied/refresh/removed/expired lifecycle on Covert target is redacted to opponents; negative lifecycle remains visible.
- [ ] Hidden historical actions stay hidden after Covert expires/Revealed.
- [ ] Run focused Vitest.
- [ ] Group raw events by execution ID and choose full vs generic representation before detailed entry construction.
- [ ] Re-run and commit `feat: redact covert battle logs by viewer`.

### Task 4: Covert Status Semantics

**Files:** Modify `status-content.ts`, `actions.ts`, `gameplay-tags.ts` and tests.

- [ ] Failing tests: positive/non-stack/refresh; 1–4; Dispel-removable; exact `Covert X`; `amplifyCopyable=false`.
- [ ] Run focused game-core tests.
- [ ] Implement Covert without changing targetability/HP/MP/accuracy/damage.
- [ ] Re-run and commit `feat: add covert combat status`.

### Task 5: Sensory, Buff Purge, and Revealed

**Files:** Modify `actions.ts`, `status-content.ts`, `gameplay-tags.ts` and tests.

- [ ] Sensory remains legal whether target secretly Covert or not; non-Covert target consumes normal cost but Sensory block does nothing.
- [ ] Covert target: purge ordinary positive buffs (including Covert), preserve scheduled recovery/negative effects/copied Skills/build/resources/cooldowns, then apply Revealed.
- [ ] Revealed tests: visible negative; refresh/no stack; 1–4; Cleanse-removable; blocks Covert; `curseCopyable=false`; exact `Revealed X`.
- [ ] Run focused tests.
- [ ] Implement metadata-driven purge:
```ts
const removable = activeEffects.filter((instance) => {
  const definition = resolvePinnedStatus(instance)
  return definition.polarity === 'positive' && definition.removablePositiveBuff !== false
})
```
- [ ] Re-run and commit `feat: add sensory reveal and buff purge`.

### Task 6: Revealed Skill AP Multiplier

**Files:** Modify `pv1f-action-economy.ts`, `actions.ts`, `battle-action-resource-availability.ts` and tests/preview tests.

- [ ] Cost matrix: regular 35→70; copied 35→18 then Revealed→36; Essence 60→120; Basic/Guard/Recover/move/facing unchanged; MP unchanged.
- [ ] Run focused game-core/web tests.
- [ ] One shared `resolvedSkillApCost`: authored → Copy intrinsic half → Revealed ×2 → later ordered transforms; same helper preview/evaluation/commit/AI.
- [ ] Re-run and commit `feat: double skill ap while revealed`.

### Task 7: UI, Preview, Inspect, and Spectator Privacy Parity

**Files:** Modify `battle-combatant-effects.tsx`, `battle-effect-summary.ts`, `battle-log-feed.tsx`, desktop/mobile inspect, `pvp-spectator-experience.tsx`, `battle-action-preview.tsx` and tests; browser tests `shared-battle-presentation-parity.pw.ts`, `pvp-mobile-unified-battle.pw.ts`.

- [ ] Component tests: no hidden buff placeholders/count leaks for opponent; full for owner/ally; Revealed visible/doubled AP.
- [ ] Sensory preview identical conditional wording for Covert/non-Covert target before commit.
- [ ] Run focused Vitest.
- [ ] Render only server-entitled projection; no client secrecy logic.
- [ ] Run browser parity tests and commit `feat: present covert sensory and revealed safely`.

### Task 8: Cross-Endpoint Privacy Regression and Verification

**Files:** Modify `docs/COMBAT.md`; add/modify server privacy regression tests.

- [ ] One information-oracle test serializes session/log/inspect/spectator/reconnect responses and asserts sentinel hidden buff/action IDs occur nowhere for opponent.
- [ ] Run focused server privacy tests.
- [ ] Run:
```bash
pnpm --filter @aurevane/game-core test
pnpm --filter @aurevane/web test
pnpm check
```
- [ ] Document visibility, non-retroactive disclosure, Sensory conditional secrecy, buff purge, Revealed cost scope/order, Cleanse/Dispel/Amplify/Curse.
- [ ] Commit `test: lock covert viewer privacy`.
