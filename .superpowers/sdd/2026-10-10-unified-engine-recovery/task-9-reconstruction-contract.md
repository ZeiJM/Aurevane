# Task9 reconstruction decisions and prior findings

This is guidance from the unavailable October19 implementation, not recovered code or passing evidence. Read actual current code and the exact Task9 brief first. Reproduce real behavior with new tests. Base is the recovery checkpoint combining Staff f6 and main d817; retain source receipts in the report.

## Authority and neutral inspection

- Owner-only through actual `staff.manage` / `assert_game_owner_v1`. Moderator's `master.access` and future compensation scope do not grant Players edits. No new role/capability invented.
- Trusted selected-character actor is server-derived; no body actor authority. All protected new RPCs receive `p_actor_character_id`, are service-only and extend the original33 actor/predecessor/denial inventory explicitly. The former design used `search_master_players_v1`, `read_master_player_v1`, `edit_master_player_v1`, `recover_master_player_battle_v1`; use the real needed contract coherently.
- Bound name search to20 matching character results, with disambiguation. Read existing verified linkage/profile, actual allocation/build/earned/saved facts, location/activity/training and battle/status/recent actions. Do not call roster cleanup, World initialization/presence/ticking or training materialization in a neutral read.
- No identity/auth/ownership/role editing. Do not expose secrets. Persistent wallet/inventory/equipment/ranking/out-of-battle HP/MP/AP may not exist: verify and label calculated, battle-only or future instead of inventing tables/editors.
- Actual battle AP is a validated whole nonnegative `combatant.temporaryResources` entry keyed `pv1f.action-economy`, field `current`; there is no ordinary `unit.ap`. Preserve real HP/MP and project absent/malformed AP safely.

## Gameplay correction and admission coherence

- Reuse authoritative XP/level/Core/Primary/Secondary/earned Skill/support commands and exact current/pinned content resolution. Six positive Core bases total31,2–3focus attributes,focus60/non-focus40 caps, actual personal pool5+level−1 and actual level1–100 XP curve. Preserve earned facts/history; no balance/formula change or refund.
- Actual state fingerprint/CAS, explicit confirmation, idempotency and bounded account/character/build locks. Live/pending battle/deletion blocks unsupported edits. Append-only automatic audit retains changed gameplay facts, not email/World/training/raw battle payloads.
- Prior real regressions: source correction did not advance buildVersion; old prepared ordinary PvE/PvP profile admitted after correction. A private SHA256 must freeze the exact level/XP/cycle/six Core facts used in actual preparation. Capture must be server-derived and recursively stripped from all public DTOs.
- Account locks alone do not detect pre-edit preparation. Participant-insertion admission checks must cover every actual PvE/PvP/configured PvP/World producer. After EVERY `player.edit` require BOTH coherent source hash AND prepared/current buildVersion, under the actual account/character/build admission locks. Malformed/missing/string/fraction/negative captures reject corrected-character new admission. Fresh preparation succeeds, rejection rolls back orphan heads/participants, admission-first blocks correction, historical reads/replays remain supported.
- Prior specific mixed-capture RED: Primary correction interleaved old CharacterRecord source with new committed build. Another RED: PvE parallel active-build view7 / committed snapshot8 reached create. Validate preparation coherence before create rather than trusting mismatched parallel reads. Do not invent a second stat formula or merely guard World buildVersion.
- Missing Task10 authored Core/shared earned eligibility is not an accepted producer. Use actual current coherent rules now; later Task10 must reconcile through this same authority.

## No-contest lifecycle

- Verify selected-only removal safety. The former actual engine required whole-encounter void; require exact named complete human participant set and head version, never silently eject/reward an opponent.
- Atomically persist immutable per-battle no-contest tombstone, terminal abandoned head, new immutable snapshot/event and audit BEFORE cleanup. Terminal snapshot must validate actual current/historical captures. Clear actual deferred/action queues, summons, Ground, statuses, primes, maintenance, staging, clocks, participation locks and spectator links. Preserve real HP/MP/AP, pinned definitions/capture history, World location/progress, training and prior successful receipts/unrelated XP. Do not inject absent policy fields into historical snapshots.
- Guard every retained service-callable commit v1/v2-inner/v2/v3/direct head mutation and exact old replay; resync to terminal authority. Actual trial/reward claim must lock the same session and reject no-contest, including late retries. Normal completion that won must remain untouched. Cleanup failure rolls back the complete transaction; repeat recovery is idempotent.
- Audit/tombstone must not block actual account/character deletion via bad FKs, and cannot retain raw battle payload after deletion. A hash-only durable marker prevents reopening a deleted battle ID while allowing real deletion. Test real deletion finalizers and recreation.
- No surrender/ordinary defeat penalty/refund/normal-abandonment analytics or rewards. Only authoritative no-contest receives dedicated NoContest/NoRewards attribution. Preserve legitimate prior receipts and unrelated progress.

## UI/client/native proof

- New Owner-only `/master/players` and nav, bounded search, readable protected/calculated/future facts, validated correction groups with review/confirmation, full participant no-contest confirmation. Preserve global rail/header/footer. Actual desktop/laptop/mobile/narrow/CSS2x proof plus keyboard; distinguish CSS layout from physical browser zoom.
- Existing participant polling was PvP-only. If still true, extend active PvE through existing version/inflight/commit guards with bounded2s polling, no new AI writer. Eject abandoned heads through existing canonical World/hall origin return without changing World progress. Preserve ordinary abandonment wording unless authoritative NoContest.
- Spectator ended/revoked400/403 links should eject; network/5xx/409 stay retryable. Test transient503 non-ejection. Preserve PvE/PvP/spectator shared presentation/art.
- Native two-session script must cover both completion/recovery orders, racing actual trial claim, account/guest admission lock retries, edit-first stale preparation/full rollback, fresh admission and live-edit rejection. Use disposable Docker-local DB only; do not count static syntax/PGlite as physical concurrency execution.
- Native E2E: actual local Owner correction→fresh PvE; then two actual PvP participants+spectator observe recovery; unchanged XP/no trial benefit; protected API denials; exact confirmations and screenshots. Execute early and COPY screenshots immediately before later Playwright commands clean test-results. Use unique repeat-index basenames, compact artifact/failure-context paths.

## Verification and storage

Use pinned `corepack pnpm`11.17.0/Node24, frozen dependencies. Log exact cwd/command/start/end/exit/output immediately, retain RED/failures, finish focused covering checks before one frozen full gate. Do not call missing tool/browser/native execution passed. Docker/psql/browser availability must be freshly checked.

Old full gate had seven unexpected DB worker-fork exits, not assertion failures or provenOOM; a serial DB and2worker Web completion passed on old source. This history permits diagnosing resource failures accurately, not preemptively claiming this source passes. Avoid concurrent PGlite-heavy work. Root handles backups/native source publication and one independent combined reviewer after complete report/commit. No helpers, hosted mutation, remote-main merge or deployment.
