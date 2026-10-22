# Consolidated Staff and Players release candidate

Updated 2026-10-21. This is a candidate/source reconciliation receipt, not a live release claim. Root owns independent review, final-head native workflows, hosted rollout and deployment.

## Source decision

Canonical source is accepted PR945 Staff plus accepted Players `59b6372826`, reconciled with current main `4793b77c607b98bc8a8ccf783da56d69f429f0fe`. Clean integration BASE: `dd6b461c15d739335ef785cfb21ccb82b17edf64`, tree `8fee51d9557f3731decf1f521364da4bf2a18a2a`. Unfinished Content A/B is excluded from this first release. The actor inventory is original Staff33 + Players4 =37; Content41 belongs to the later branch. The existing publication API is correct for this candidate and is intentionally exercised by the new factory tests. Preserve all current live combat/reader/World changes.

Competing Staff PR957 local `e618b2f336f52fafccf4ff833850abb1b5e8130b` / remote `0095c03ded86e4936c12501127351ad94538a9b6`, tree `4bb0fb03fecd7e31baff99d70978bd8f8d394907`, is a separate reconstruction. Its eight unpublished acceptance files remain preserved, each verified against its archive SHA256/size. None is copied wholesale into this candidate.

| Boundary            | Preserved canonical contract                                                                                            | Competing reconstruction disposition                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delegated authority | Private RLS `master_panel_character_access`, per-character revision, live ownership/deletion/expiry/revoke checks       | Do not replace with altered historical role/capability tables and account-wide revisions.                                                                                                 |
| Actor               | `createSelectedCharacterRpc`, fresh verified identity/selection, explicit protected inventory including Players         | Do not introduce a second helper or blanket ordinary-reader guard.                                                                                                                        |
| Owner               | Protected account-root/bootstrap exception, including null selected character                                           | Do not require selected character for root or revoke deliberate Owner-only legacy compatibility.                                                                                          |
| SQL                 | `20261019003429_selected_character_staff_access.sql` and `20261020181057_master_players_recovery.sql`                   | Never stack `20261020231118_selected_character_staff_authority.sql`: duplicate audit column, colliding `(uuid,uuid)` functions, opposite positional actor semantics and competing grants. |
| Staff API           | Existing JSON identity/directory, target user+character, per-character expectedVersion, enabled=false revoke            | No alternate RPC/row-shape/CAS import.                                                                                                                                                    |
| Players             | Accepted gameplay-field allowlist, no identity/role powers, exact source/build version and noContest recovery contracts | PR957 has no Players producer and must not replace its shell, fixture or actor dependencies.                                                                                              |
| Ordinary readers    | Current/catalogue/pinned Combat and current Event service paths remain actorless                                        | Retain original signatures; protected draft/history/publication operations still derive selected actor.                                                                                   |

Accepted Staff/Players review and native receipts remain under `docs/verification/task-8/` and `docs/verification/task-9-reconstruction/`. Staff f6ba4876 passed all eight exact-head workflows, full Chromium358/focused73/Edge10 and five inspected layout captures. Final accepted Players remote43ff3cad passed quality11,957 Vitest +7Node, Database including actual Staff37/Players physical races/Event/catalogue chain, UI layout and full Chromium360/focused73/Edge10. These are historical source-specific receipts; they do not replace the combined candidate's final-head gate.

## Only new executable change

`apps/web/src/server/master/selected-staff-factory.test.ts` adapts the useful actual-factory coverage from the competing reconstruction. Production factories, stores, services and canonical selected-character wrapper stay real. Only the external Supabase RPC transport and verified request identity/selection dependencies are mocked. Unknown transport calls fail explicitly.

Eight tests protect:

- Fresh selected identity on successive Staff operations and substituted-user denial before transport.
- Ordinary Combat current reads with original actorless parameters.
- Real Combat catalogue validation composing with selected publication and pointer/history calls.
- Real Event current/workspace/scheduling composition with protected draft/history/schedule context.
- Substituted Combat and Event actors rejected before transport (two cases).
- Null selection forwarded to SQL and the returned Owner access consumed by the real capability service. This proves composition, not SQL Owner authorization.
- Ordinary Combat/Event current readers usable without an authenticated Master request context.

The test fails if the production factory stops installing the selected wrapper, if the wrapper gates ordinary reads, if selected identity becomes cached, if substituted users reach transport, or if a blanket selection requirement breaks Owner bootstrap. No test mocks the helper/store/service it is intended to exercise.

The initial canonical run was already green:8/8. This is characterization/regression coverage of preserved working behavior, not a claimed canonical RED→GREEN product repair. PR957's historical factory RED explains the risk but is not relabeled as a new run. No production, migration, package, workflow or existing acceptance-test changes were necessary.

## Focused verification

Cwd: isolated `aurevane-release` worktree at BASE above; pnpm via `corepack pnpm` (11.17.0). All completed commands below exited0.

| Command                                                                                                                                                                                                                                               | Result                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `corepack pnpm --filter @aurevane/web exec vitest run src/server/master/selected-staff-factory.test.ts`                                                                                                                                               | 8 tests /1file pass against unchanged canonical product. |
| `corepack pnpm --filter @aurevane/web exec vitest run src/server/master/selected-staff-factory.test.ts src/server/master/selected-character-rpc.test.ts src/server/master/supabase-staff-access-store.test.ts src/server/master/staff-access.test.ts` | 26 tests /4files pass after formatting.                  |
| `corepack pnpm --filter @aurevane/web typecheck`                                                                                                                                                                                                      | Next route type generation and tsc pass.                 |
| `corepack pnpm --filter @aurevane/web exec eslint src/server/master/selected-staff-factory.test.ts --max-warnings=0`                                                                                                                                  | Pass, no lint warnings.                                  |

Vite still prints the inherited ESM-in-CommonJS native-config warning. It is not suppressed or called pristine. No broad suite or native browser rerun was performed for this test-only port; root owns one frozen final-head gate. Root separately reports combined baseline61web/10files and58actual-predecessor PGliteDB/2files passing before the port.

Self-review confirmed real factory imports, only external boundary mocks, exact ordinary/protected transport parameters, independent null-selection Owner composition and no product-source diff. Formatting/whitespace and final source receipt accompany the commit. Deployment-lock blob remains `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f` (`**: false`).

## Preserved continuation obligations

These are retained from both chats, not discarded in choosing canonical Staff:

- Final common-shell work: restore keyboard focus after Close/Save/Revoke; show readable selected special-permission labels in directory summaries; retain already-fixed post-commit initial editor focus.
- Later browser integration: two linked characters/no automatic choice, cross-tab real selection route, expiry while open, No Expiry, computed full-shell text/focus contrast and overflow, meaningful confirmation focus. Reuse accepted scenarios/workflow; do not create duplicate long stacks. Existing five-layout/CSS zoom evidence is not physical browser zoom/touch/human acceptance.
- Task11: adapt SQL-backed Site Music CAS write with root authorization and direct-table DML revocation; Owner-protected World history RPC. Preserve Owner bootstrap, ordinary readers and existing payloads. These are distinct hardenings; this comparison demonstrated no first-release user-reachable bypass through the existing protected routes.
- Preserve the optional second-character creation helper enhancement without removing Players' `{userId}` return; never copy the competing helper wholesale.
- Retain original Vite/NO_COLOR/stream-close diagnostics, Staff Minors, Players timing-risk finding N4 and all accepted historical failed/repair logs. Do not claim human, physical-device, hosted or load acceptance from local tests.
- Content and later Master tasks remain open; do not publish unfinished complete-record authority while its old editor consumers remain unmigrated. The separate PR933 timing investigation remains open and outside this Staff port; PR931 is already live and remains untouched.

No old worktree or any of the eight preserved pending files was modified. No push, merge, hosted migration, grant, publication or deployment was performed by this implementer.
