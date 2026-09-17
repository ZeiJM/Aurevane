# CSR-0 Battle Privacy Foundation Implementation Plan

> **For agentic workers:** Use the repository execution standard plus Superpowers TDD and verification skills. This plan is deliberately limited to CSR-0; do not implement CSR gameplay content here.

**Goal:** Establish the server-private viewer-entitlement and historical privacy-provenance foundations required by Covert/Sensory/Revealed without changing current battle visibility, gameplay, or publication state.

**Authoritative specs:**
- `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-design.md`
- `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-privacy-amendment.md`

## Architecture

CSR-0 creates two reusable authority seams and intentionally stops there.

First, a pure server-side viewer-entitlement helper derives `self | ally | opponent | spectator` relationships from authoritative combatant teams plus the participant's persisted controlled combatants. Spectators remain unprivileged. The existing participant session projection now requires this entitlement before producing the same browser payload, including committed AI/PvP surrender results; CSR-0 still performs no relationship-specific redaction and exposes no new browser fields. CSR-2 will apply viewer-relative redaction consistently across player, reconnect, PvP, and spectator live projections.

Second, every fresh battle commit goes through `commit_battle_intent_v3`, which preserves the hardened v2 commit semantics and atomically appends one server-private journal row beside the new snapshot/event batch. Actor identity and team are stamped from the immutable command-start snapshot inside PostgreSQL rather than trusted from the caller. Current commands pass no explicit privacy decision, so v3 records a public baseline. Later CSR resolution can pass explicit command/event visibility decisions without changing the public event/session RPC shapes.

A missing journal row means pre-CSR legacy/public history. Exact idempotent replay and terminal read-only replay never append a new row. Browser roles receive no direct access to the private journal.

## Constraints

- No Covert, Sensory, or Revealed status/effect definitions in CSR-0.
- No current battle visibility change.
- No client-only privacy logic.
- No new browser-facing privacy fields or raw journal reads.
- No retroactive inference/backfill of legacy history.
- No changes to `main`, deployment, or publication gates.
- Existing `get_battle_session_v2`, `get_battle_events_v3`, and `list_pvp_battle_events_v2` public result shapes remain unchanged.

## Files

- `apps/web/src/server/battle/battle-viewer-entitlement.ts` — pure entitlement authority.
- `apps/web/src/server/battle/battle-viewer-entitlement.test.ts` — relationship and fail-closed tests.
- `apps/web/src/server/battle/battle-session-service.ts` — makes participant projection require validated viewer entitlement while preserving the current payload.
- `apps/web/src/server/battle/ai-battle-surrender-service.ts` — passes persisted viewer control through committed-session projection for AI surrender/replay results.
- `apps/web/src/server/battle/pvp-battle-quality-service.ts` — passes persisted viewer control through the shared committed-session projection after surrender.
- `apps/web/src/server/battle/supabase-battle-session-repository.ts` — route current commits through v3 with a null/public-baseline privacy decision.
- `supabase/migrations/20260916140000_battle_privacy_journal_foundation.sql` — private journal table, visibility validator, and v3 commit wrapper.
- `.github/scripts/verify-battle-privacy-journal.sh` — database authority, atomicity, replay, legacy, and non-leak regression.
- `.github/workflows/battle-session-db.yml` — runs the new regression for relevant changes.

## Task 1 — Viewer entitlement authority

- [x] Write a failing test before implementation.
- [x] Observe RED because `battle-viewer-entitlement.ts` does not exist.
- [x] Add `BattleViewerEntitlement` and relationship helpers.
- [x] Derive participant friendliness only from authoritative `BattleCombatant.teamId` values.
- [x] Fail closed for empty, missing, duplicate, or cross-team controlled combatants.
- [x] Keep spectators explicitly unprivileged.
- [x] Require validated viewer entitlement at the existing participant session projection boundary without changing the projected payload.
- [x] Preserve AI/PvP surrender compatibility by passing persisted controlled combatant IDs through the same committed-session projection.
- [x] Leave relationship-specific redaction and spectator/PvP-specific privacy projection behavior for CSR-2.

Expected interface:

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

## Task 2 — Private append-only privacy journal

- [x] Add a database regression first and observe the expected RED because the journal table/RPC do not exist.
- [x] Add `app_private.battle_privacy_journal` keyed by `(battle_session_id, battle_version)` with a foreign key to the committed snapshot.
- [x] Revoke direct browser-role table access.
- [x] Add a private visibility validator supporting only `public` and non-empty `team-only` visibility objects.
- [x] Add service-role-only `public.commit_battle_intent_v3(...)` with the existing v2 arguments plus nullable `p_privacy_journal jsonb`.
- [x] Delegate authorization, optimistic locking, exact replay, terminal replay, snapshot validation, event persistence, and idempotency ordering to the hardened v2 commit path.
- [x] On fresh commits, derive `actorCombatantId` from command-start `currentTurn.combatantId` and derive `actorTeamId` from the same immutable prior snapshot.
- [x] Treat null privacy input as the behavior-preserving public baseline.
- [x] Validate explicit command/event visibility decisions and unique in-range event indices.
- [x] Insert the journal row with the same battle version and commit timestamp as the snapshot/event batch.
- [x] Let any journal validation error abort the entire PostgreSQL transaction so the inner v2 mutation also rolls back.
- [x] Preserve legacy history by not backfilling missing rows.
- [x] Preserve exact replay semantics by not appending a duplicate journal row.

Normalized stored payload:

```json
{
  "schemaVersion": 1,
  "actorCombatantId": "<DB-stamped command-start actor>",
  "actorTeamId": "<DB-stamped command-start team>",
  "commandVisibility": { "kind": "public" },
  "eventVisibilityOverrides": [],
  "eventCount": 1
}
```

Later CSR tickets may replace the public visibility decision with resolver-time team-only/event overrides; actor/team provenance remains DB-stamped.

## Task 3 — Route current commits through the foundation

- [x] Change `createSupabaseBattleSessionRepository().commitBattleIntent(...)` to call `commit_battle_intent_v3`.
- [x] Pass `p_privacy_journal: null` for existing gameplay so no CSR semantics are invented early.
- [x] Keep the TypeScript repository interface and browser result types unchanged.
- [x] Keep all event-read RPCs unchanged and privacy-journal blind.

Current repository call:

```ts
await supabase.rpc('commit_battle_intent_v3', {
  // existing authoritative commit arguments
  p_events: input.events,
  p_privacy_journal: null,
})
```

## Task 4 — Database regression coverage

The Battle Session DB regression must prove:

- [x] journal table and v3 function exist;
- [x] `anon` and `authenticated` cannot select the private table;
- [x] only `service_role` can execute v3;
- [x] a dedicated modern battle fixture commits through v3;
- [x] null privacy input stores one DB-stamped public baseline row;
- [x] exact replay returns the authoritative result without a duplicate row;
- [x] malformed event-level visibility is rejected;
- [x] rejected privacy metadata leaves battle version, snapshots, events, and journal counts unchanged;
- [x] version-1/pre-CSR history has no journal row;
- [x] `get_battle_events_v3` exposes no journal fields;
- [x] participant and PvP event RPCs retain their four-column result shapes;
- [ ] final exact-head Battle Session DB run is green.

## Task 5 — Verification and integration

- [x] Viewer helper RED observed before implementation.
- [x] Database journal RED observed before migration.
- [x] Migration/basic journal authority passed a full Battle Session DB run.
- [x] Quality gates passed after the entitlement helper and v3 repository switch.
- [ ] Strong atomicity/non-leak Battle Session DB regression passes on the candidate head.
- [ ] Full exact-head PR Quality and Database foundation checks pass.
- [ ] Self-review confirms no CSR gameplay content or publication changes.
- [ ] Inspect PR reviews, comments, and review threads.
- [ ] Refresh shared branch immediately before merge; reconcile/retest if it advanced.
- [ ] Merge only into `agent/combat-effect-taxonomy-rework` using the exact tested head SHA.
- [ ] Verify merge parents/tree and post-merge shared Quality + Database checks.
- [ ] Confirm `main` remains unchanged.

## Deferred by design

- **CSR-1:** typed Covert/Revealed statuses, Sensory effect, successful reveal/no-op/miss semantics, purge and Revealed AP transform.
- **CSR-2:** apply relationship-specific redaction consistently across live player/reconnect/PvP/spectator projections, including spectator-specific entitlement handling and positive-status redaction.
- **CSR-3:** consume persisted privacy decisions for hidden-command collapsing, positive lifecycle suppression, Sensory Reveal boundary, and no retroactive disclosure.
- **CSR-4:** battle presentation, inspect/log/spectator/reconnect browser acceptance and final readiness.

Temporary-Skill Copy, Master Panel authoring, Amplify/Curse publication, and unresolved clone repeat-use behavior remain separate work and are not changed by CSR-0.
