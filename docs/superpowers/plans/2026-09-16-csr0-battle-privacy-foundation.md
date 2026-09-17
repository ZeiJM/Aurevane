# CSR-0 Battle Privacy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the server-private viewer-entitlement and append-only battle privacy journal foundation required by Covert/Sensory/Revealed without changing current battle visibility or publishing any CSR gameplay content.

**Architecture:** Keep full authoritative battle state and privacy provenance server-side. Thread an explicit viewer-entitlement object through the existing battle snapshot projection boundary, but apply no new redaction in CSR-0. Persist one versioned privacy-journal entry per committed intent in `app_private`, atomically with the existing snapshot/event transaction, and keep all existing browser-facing event/session RPC shapes unchanged.

**Tech Stack:** TypeScript 6, Vitest 4, Next.js server code, Supabase/PostgreSQL PL/pgSQL, Bash database regression scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-design.md` and `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-privacy-amendment.md`

## Global Constraints

- Do not implement or publish Covert, Sensory, or Revealed gameplay content in CSR-0.
- Full battle state remains server-authoritative; browsers receive only server projections.
- Historical privacy decisions must be persisted at resolution time rather than inferred from later state.
- Existing battles must remain readable and must not retroactively gain CSR mechanics.
- Spectators are unprivileged/opponent-like by default when CSR filtering is introduced later; CSR-0 only establishes the reusable entitlement contract.
- Existing player and spectator log RPC result shapes must not expose privacy-journal data.
- All schema changes are additive and use migrations; browser roles receive no direct access to `app_private` privacy provenance.
- `main` is untouched; this ticket targets `agent/combat-effect-taxonomy-rework` only.

---

## File Structure

- Create `apps/web/src/server/battle/battle-viewer-entitlement.ts`: pure server-side viewer relationship derivation; no CSR status logic.
- Create `apps/web/src/server/battle/battle-viewer-entitlement.test.ts`: self/ally/opponent/spectator/fail-closed tests.
- Modify `apps/web/src/server/battle/battle-session-service.ts`: require viewer entitlement at the existing snapshot projection boundary and attach a public baseline privacy decision to current committed intents.
- Modify `apps/web/src/server/battle/battle-session-service.test.ts`: prove commit metadata is produced from authoritative command-start actor/team state and remains absent from returned browser projections.
- Modify `packages/db/src/battle-session.ts`: define the private journal write contract on `CommitBattleIntentInput` without adding it to public `BattleEventRecord` or `BattleSessionRecord`.
- Modify `apps/web/src/server/battle/supabase-battle-session-repository.ts`: call the new commit RPC with the private journal payload; keep `get_battle_session_v2` and `get_battle_events_v3` result parsing unchanged.
- Create `supabase/migrations/20260916140000_battle_privacy_journal_foundation.sql`: add the private append-only journal table and `commit_battle_intent_v3`, preserving v2 replay/terminal semantics while atomically inserting provenance for successful active commits.
- Create `.github/scripts/verify-battle-privacy-journal.sh`: database regression for atomic journal writes, idempotent replay, rollback on invalid journal, legacy normalization, private privileges, and non-leaking public read RPCs.
- Modify `.github/workflows/battle-session-db.yml`: run the new database regression when relevant files change.

---

### Task 1: Establish the viewer-entitlement projection boundary

**Files:**
- Create: `apps/web/src/server/battle/battle-viewer-entitlement.test.ts`
- Create: `apps/web/src/server/battle/battle-viewer-entitlement.ts`
- Modify: `apps/web/src/server/battle/battle-session-service.ts`
- Modify: `apps/web/src/server/battle/battle-session-service.test.ts`

**Interfaces:**
- Consumes: authoritative `BattleCombatant.teamId` plus persisted `controlledCombatantIds`.
- Produces: `BattleViewerEntitlement`, `deriveParticipantBattleViewerEntitlement(...)`, `createSpectatorBattleViewerEntitlement()`, and `battleViewerRelationship(...)` returning `'self' | 'ally' | 'opponent' | 'spectator'`.

- [ ] **Step 1: Write failing entitlement tests**

```ts
const combatants = [
  { id: 'character:a', teamId: 'team:a' },
  { id: 'character:b', teamId: 'team:a' },
  { id: 'character:c', teamId: 'team:b' },
] as const

const viewer = deriveParticipantBattleViewerEntitlement(combatants, ['character:a'])
expect(battleViewerRelationship(viewer, combatants[0])).toBe('self')
expect(battleViewerRelationship(viewer, combatants[1])).toBe('ally')
expect(battleViewerRelationship(viewer, combatants[2])).toBe('opponent')
expect(
  battleViewerRelationship(createSpectatorBattleViewerEntitlement(), combatants[0]),
).toBe('spectator')
expect(() =>
  deriveParticipantBattleViewerEntitlement(combatants, ['character:missing']),
).toThrow(/controlled combatant/i)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-viewer-entitlement.test.ts`

Expected: FAIL because `battle-viewer-entitlement.ts` does not exist.

- [ ] **Step 3: Implement the pure entitlement helper**

```ts
export interface BattleViewerEntitlement {
  kind: 'participant' | 'spectator'
  controlledCombatantIds: ReadonlySet<string>
  friendlyTeamIds: ReadonlySet<string>
}

export function deriveParticipantBattleViewerEntitlement(
  combatants: readonly Pick<BattleCombatant, 'id' | 'teamId'>[],
  controlledCombatantIds: readonly string[],
): BattleViewerEntitlement

export function createSpectatorBattleViewerEntitlement(): BattleViewerEntitlement

export function battleViewerRelationship(
  viewer: BattleViewerEntitlement,
  combatant: Pick<BattleCombatant, 'id' | 'teamId'>,
): 'self' | 'ally' | 'opponent' | 'spectator'
```

The participant constructor must reject an empty controlled list, unknown combatant IDs, duplicate controlled IDs, or controlled combatants spanning multiple teams. The spectator constructor has no friendly teams.

- [ ] **Step 4: Thread entitlement through the existing session projection**

Change the internal projection signature from:

```ts
projectBattleSnapshot(state)
```

to:

```ts
projectBattleSnapshot(state, viewer)
```

All current create/get/submit/replay paths derive a participant entitlement from authoritative combatants and persisted controlled IDs before projection. CSR-0 does not remove statuses or otherwise alter projected gameplay data; it only establishes the mandatory viewer-aware boundary while preserving RNG stripping.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @aurevane/web exec vitest run \
  src/server/battle/battle-viewer-entitlement.test.ts \
  src/server/battle/battle-session-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/battle/battle-viewer-entitlement.ts \
  apps/web/src/server/battle/battle-viewer-entitlement.test.ts \
  apps/web/src/server/battle/battle-session-service.ts \
  apps/web/src/server/battle/battle-session-service.test.ts
git commit -m "feat(combat): add viewer entitlement boundary"
```

---

### Task 2: Define private command privacy provenance and prove it at the service seam

**Files:**
- Modify: `packages/db/src/battle-session.ts`
- Modify: `apps/web/src/server/battle/battle-session-service.ts`
- Modify: `apps/web/src/server/battle/battle-session-service.test.ts`

**Interfaces:**
- Consumes: command-start `currentTurn.combatantId`, authoritative combatant `teamId`, submitted intent kind, and resolved event count.
- Produces: `BattlePrivacyJournalEntry` on `CommitBattleIntentInput.privacyJournal`.

- [ ] **Step 1: Write the failing service assertion**

For a legal movement intent, assert the repository receives:

```ts
expect(commit.privacyJournal).toEqual({
  schemaVersion: 1,
  actorCombatantId: `character:${CHARACTER_ID}`,
  actorTeamId: 'team:player',
  commandKind: 'move',
  commandVisibility: { kind: 'public' },
  eventVisibilityOverrides: [],
  eventCount: commit.events.length,
})
```

Also assert `JSON.stringify(result)` contains none of `privacyJournal`, `commandVisibility`, or `eventVisibilityOverrides`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-session-service.test.ts`

Expected: FAIL because `CommitBattleIntentInput` does not yet carry privacy provenance.

- [ ] **Step 3: Add the private DB-domain types**

```ts
export const BATTLE_PRIVACY_JOURNAL_SCHEMA_VERSION = 1 as const

export type BattlePrivacyVisibility =
  | { readonly kind: 'public' }
  | { readonly kind: 'team-only'; readonly teamId: string }

export interface BattlePrivacyEventVisibilityOverride {
  readonly eventIndex: number
  readonly visibility: BattlePrivacyVisibility
}

export interface BattlePrivacyJournalEntry {
  readonly schemaVersion: typeof BATTLE_PRIVACY_JOURNAL_SCHEMA_VERSION
  readonly actorCombatantId: string
  readonly actorTeamId: string
  readonly commandKind: 'move' | 'action' | 'face'
  readonly commandVisibility: BattlePrivacyVisibility
  readonly eventVisibilityOverrides: readonly BattlePrivacyEventVisibilityOverride[]
  readonly eventCount: number
}
```

Add `privacyJournal: BattlePrivacyJournalEntry` to `CommitBattleIntentInput`. Do not add privacy fields to `BattleSessionRecord`, `BattleEventRecord`, or browser view types.

- [ ] **Step 4: Build the baseline public decision from command-start authority**

Before resolving the intent, capture the current-turn actor and team from the authoritative snapshot. Build the journal entry with `commandVisibility: { kind: 'public' }`, no overrides, and the exact committed event count. This is deliberately a behavior-preserving baseline: CSR-1/CSR-3 will later produce restricted decisions at resolution time.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-session-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/battle-session.ts \
  apps/web/src/server/battle/battle-session-service.ts \
  apps/web/src/server/battle/battle-session-service.test.ts
git commit -m "feat(combat): record command privacy provenance"
```

---

### Task 3: Persist the append-only journal atomically and keep it private

**Files:**
- Create: `.github/scripts/verify-battle-privacy-journal.sh`
- Modify: `.github/workflows/battle-session-db.yml`
- Create: `supabase/migrations/20260916140000_battle_privacy_journal_foundation.sql`
- Modify: `apps/web/src/server/battle/supabase-battle-session-repository.ts`

**Interfaces:**
- Consumes: `CommitBattleIntentInput.privacyJournal`.
- Produces: `public.commit_battle_intent_v3(..., p_privacy_journal jsonb)` with unchanged return shape; private rows in `app_private.battle_privacy_journal` keyed by `(battle_session_id, battle_version)`.

- [ ] **Step 1: Add the failing database regression and workflow hook**

The shell regression must create a battle, call `commit_battle_intent_v3`, and assert:

```sql
select count(*) = 1
from app_private.battle_privacy_journal
where battle_session_id = :'session_id'::uuid
  and battle_version = 2;
```

It must also verify all of the following:

```text
- the row payload equals the submitted schemaVersion/actor/team/kind/public visibility/eventCount
- exact idempotent replay does not append a second journal row
- a journal whose eventCount differs from jsonb_array_length(p_events) is rejected and creates no snapshot/event/journal writes
- existing pre-migration event history has no journal row and remains readable through get_battle_events_v3
- get_battle_events_v3 and list_pvp_battle_events_v2 keep their four-column public result shapes
- anon/authenticated have no SELECT privilege on app_private.battle_privacy_journal
- authenticated cannot execute commit_battle_intent_v3; service_role can
```

Add the new script path to the `pull_request` and `push` path filters and add a `Verify battle privacy journal authority` step to the existing Battle Session DB job.

- [ ] **Step 2: Push the test-only commit and verify RED in Battle Session DB**

Expected: the branch workflow fails because `app_private.battle_privacy_journal` and `public.commit_battle_intent_v3` do not exist.

- [ ] **Step 3: Add the private journal table**

```sql
create table app_private.battle_privacy_journal (
  battle_session_id uuid not null,
  battle_version bigint not null check (battle_version > 1),
  journal jsonb not null check (jsonb_typeof(journal) = 'object'),
  created_at timestamptz not null,
  primary key (battle_session_id, battle_version),
  foreign key (battle_session_id, battle_version)
    references app_private.battle_snapshots(battle_session_id, battle_version)
    on delete cascade
);

revoke all on table app_private.battle_privacy_journal
  from public, anon, authenticated;
```

No public browser read RPC is added in CSR-0.

- [ ] **Step 4: Add `commit_battle_intent_v3` as a wrapper-compatible authoritative commit**

`commit_battle_intent_v3` accepts the existing v2 arguments plus `p_privacy_journal jsonb`. It validates before mutation that the journal is an object, `schemaVersion = 1`, `eventCount = jsonb_array_length(p_events)`, actor/team IDs are non-empty strings, command kind is one of `move|action|face`, command visibility is `public` or a valid `team-only` object, and override indices are unique/in-range with valid visibility objects.

For exact replay and terminal read-only replay, return the existing authoritative result without inserting a journal row. For a successful active mutation, preserve v2 optimistic-lock/idempotency ordering and insert the snapshot, events, and privacy journal in the same PL/pgSQL transaction. The journal row uses the same `v_next_version` and `v_committed_at` as the snapshot/event batch.

Grant execute only to `service_role` and revoke it from public/anon/authenticated.

- [ ] **Step 5: Switch the web repository to v3**

```ts
const { data, error } = await client.rpc('commit_battle_intent_v3', {
  // existing args unchanged
  p_privacy_journal: input.privacyJournal,
})
```

Do not change `get_battle_session_v2`, `get_battle_events_v3`, `list_pvp_battle_events_v2`, or their validation schemas in CSR-0.

- [ ] **Step 6: Push and verify GREEN database + focused application tests**

Expected branch evidence:

```text
Battle Session DB: PASS
Quality/CI TypeScript + Vitest checks: PASS
```

Focused local-equivalent commands documented for CI parity:

```bash
pnpm --filter @aurevane/web exec vitest run \
  src/server/battle/battle-viewer-entitlement.test.ts \
  src/server/battle/battle-session-service.test.ts
pnpm --filter @aurevane/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add .github/scripts/verify-battle-privacy-journal.sh \
  .github/workflows/battle-session-db.yml \
  supabase/migrations/20260916140000_battle_privacy_journal_foundation.sql \
  apps/web/src/server/battle/supabase-battle-session-repository.ts
git commit -m "feat(combat): persist private battle privacy journal"
```

---

### Task 4: Freshness, regression, and PR integration

**Files:**
- No new production files unless verification exposes a real defect.

**Interfaces:**
- Consumes: completed CSR-0 branch.
- Produces: exact-head green PR merged only into `agent/combat-effect-taxonomy-rework`.

- [ ] **Step 1: Run/review full branch checks**

Required evidence: repository Quality/CI plus Battle Session DB all green on the exact candidate head.

- [ ] **Step 2: Self-review against both CSR specs**

Confirm CSR-0 does not add any `covert`, `sensory`, or `revealed` status/effect definitions; no current browser output is intentionally changed; privacy journal data is not present in player/spectator event RPCs; and current commands journal only public baseline decisions.

- [ ] **Step 3: Open PR to the shared combat branch**

Base: `agent/combat-effect-taxonomy-rework`

Head: `agent/combat-csr0-privacy-foundation-20260916`

- [ ] **Step 4: Inspect reviews, comments, review threads, and exact-head workflow jobs**

Resolve any substantive issue and rerun affected checks before merge.

- [ ] **Step 5: Refresh the shared branch immediately before merge**

If shared advanced, rebase/reconcile and rerun exact-head checks. Otherwise merge with the PR's exact tested head SHA.

- [ ] **Step 6: Verify merge parents/tree and post-merge shared checks**

Confirm parent 1 is the pre-merge shared head, parent 2 is the exact tested feature head, and the merge tree matches the accepted candidate. Confirm post-merge Quality and Database foundation checks pass. `main` must remain unchanged.

---

## Self-Review

- Spec coverage: CSR-0 covers viewer-relative authority, command/event privacy provenance persistence, private storage, atomic commit, and backward-compatible legacy history. Actual Covert redaction, Sensory Reveal boundaries, hidden-command collapsing, and Revealed AP mechanics remain intentionally deferred to CSR-1/2/3 per the approved split.
- Placeholder scan: no TBD/TODO/placeholders remain.
- Type consistency: the plan uses `BattlePrivacyJournalEntry` consistently from DB domain type through service commit input, Supabase repository, RPC JSON parameter, and private table payload.
