# October 26 Master refinements — World and Combat Rules

Local implementation on `agent/master-panel-refinements-20261026`; no hosted mutation, commit, push or deployment. Task 5 of `docs/superpowers/plans/2026-10-26-master-panel-refinements.md`.

## Behavior and rulings

- Automatic weather rolls have their own `weatherRollMinutes`, a whole number from 1 to 10080 real minutes. Historical settings retain 360 minutes. The cadence is separate from day length and forced-weather expiry. Legacy callers that omit the cadence preserve the stored value. The shared deterministic resolver uses epoch-aligned cadence blocks; a roll may keep the same condition.
- The World editor shows local expiry and rounded-up minutes remaining, places day/weather controls side by side on desktop, and moves detailed guidance into the shared information dialog. Existing override expiry survives clock/cadence-only saves. The desktop controls and save feedback fit at 1366×768.
- **Ruling:** Newly saved elevation settings explicitly capture `model: 'independent-highest'`. For each candidate raised tile, roll levels 1, 2 and 3 independently; the highest successful level wins, and no success leaves it flat. This satisfies independent chances without normalization or a synthetic total. Its cost is that entered percentages describe independent trials, not final height proportions: with 50% each, final levels 0/1/2/3 occur at 12.5%/12.5%/25%/50%. The editor explains the highest-success and flat fallback rules.
- Policies without the model keep historical weighted selection, total validation, defaults and exact RNG consumption. Existing stored battle tiles and captured policies are not rewritten. New publication uses a separate v3 RPC; older low-level publishers retain their compatible weighted behavior.
- **Owner rollout correction:** The migration immediately appends and selects an `independent-highest` policy copying the then-current legacy percentages. It retains every prior row, uses the existing elevation publisher transaction advisory lock, and attributes the append honestly to this migration (`published_by = NULL`, explicit migration reason). The lock is acquired before policy-table DDL to avoid inversion with a publisher that already holds the same lock. The activation block checks the latest policy under lock and does nothing if it is already independent. New battles therefore match the current editor immediately after rollout without a manual Save. This supersedes the initial opt-in-only activation ruling.
- Rule-definition readers use actual names inside accessible native modal dialogs. They scroll internally, focus their close control, contain keyboard focus, close with Escape/backdrop/Close and restore focus to the opener. Raw content identifiers are not displayed. The native primitive is also used by the root agent's shared `MasterHelp` wrapper.
- The Rules table scrolls internally while reserving desktop space for elevation controls, save buttons and success feedback. At narrow/short viewports, controls retain normal readable sizes and accessible scrolling.

## RED → GREEN evidence

- Core independent-policy/non-100/0%-100%/highest-success tests: initial 3 failures; implementation green. Existing weighted distribution, map connectivity, protected spawns and deterministic generation regressions remain.
- Weather resolver/parser/admin cadence tests: initial 3 failures; implementation green.
- World/elevation/definition-dialog render tests: initial 4 failures; implementation green.
- Independent elevation RPC dispatch: initial 1 failure, then green.
- Physical PGlite migration test: failed because the cadence was absent, then passed after migration. The rollout follow-up separately failed when a custom current legacy policy remained selected; it passed after adding the serialized append. It proves 12.34%/87.66%/0% are copied exactly, both prior rows (including publisher/reason/timestamp) are unchanged, the appended publisher is NULL with an explicit migration reason, and replaying the activation block appends nothing over an already independent current row. Covers default/persist/reopen, strict bounds, preserved override expiry, Owner denial, stale writes, independent 0%-300% totals, historical policy rows, private tables, service-only RPC access and immutable World audit.
- Rendered desktop Rules-fit guard: initial `clientHeight=596, scrollHeight=696`, then green after bounding the timing list; both initial state and save feedback fit.

## Executed checks

- `pnpm --filter @aurevane/game-core exec vitest run src/combat/battlefield-elevation-policy.test.ts src/combat/standard-battlefield.test.ts src/combat/battle-state.test.ts` — **40 passed / 3 files**.
- Focused/adjacent web run of World resolver/stores, elevation/timing stores, all three editors, operational interactions, both API routes, battle-session creation/reload, PvP lobby creation and World encounter capture — **122 passed / 15 files**. After adding explicit-model variants to actual battle and World capture tests, those two files passed **48 tests**. The other files were unchanged.
- `pnpm --filter @aurevane/db exec vitest run src/independent-elevation-weather-cadence-migration.test.ts src/master-operational-rules-migration.test.ts src/world-environment-controls-migration.test.ts` — **3 passed / 3 physical SQL files**.
- `pnpm --filter @aurevane/game-core typecheck` — passed.
- Changed web files and browser script linted from `apps/web`, and changed package files from repository root — passed. Root-level web lint is intentionally ignored by the existing config; the effective web-directory checks were used.
- Formatting and `git diff --check` passed. Web-wide TypeScript initially encountered other agents' in-flight MasterHelp/Staff-default changes; no Task-5 diagnostic was reported. The integration agent owns the final full type/build gate.

## Rendered browser evidence

`apps/web/scripts/panel-world-rules-browser-regression.mjs` mounts the actual production World/Rules/elevation editors, shared Master shell, CSS and dialogs. HTTP/session/shell-frame boundaries are explicit local fixtures; SQL authority and actual encounter generation are exercised separately above.

Chromium `153.0.8010.0` passed desktop 1366×768, touch viewport 390×844 and effective viewport 683×384. Each checks:

- 15-minute cadence, independent 37-minute override, readable local expiry/time remaining, reopen and preserved expiry;
- 300% independent elevation submission with the captured explicit model;
- 120 named definitions, internal reader scrolling, no raw IDs, initial focus, modal focus containment, Escape/backdrop/Close and restored focus;
- accessible saving and no horizontal overflow.

Desktop World bounds were top 131.8/bottom 616.3 in a 768px viewport. The definitions body measured client height 511 versus scroll height 3772 (287 client height in the short effective viewport). The final desktop rerun also checks that the entire Rules workspace fits before and after save feedback.

Commands:

```sh
AV_PANEL_WORLD_RULES_NATIVE_ZOOM=0 node apps/web/scripts/panel-world-rules-browser-regression.mjs
AV_PANEL_WORLD_RULES_DESKTOP_ONLY=1 AV_PANEL_WORLD_RULES_EVIDENCE_DIR=/tmp/panel-world-rules-final-desktop node apps/web/scripts/panel-world-rules-browser-regression.mjs
```

Final desktop screenshots/results: `/tmp/panel-world-rules-final-desktop/`; mobile/effective-viewport screenshots/results: `/tmp/panel-world-rules-evidence/`. The script reproduces these local fixtures.

**Unexecuted acceptance:** genuine 200% browser zoom, authenticated local/hosted end-to-end and physical-device acceptance. A single bounded attempt to use Chrome's genuine `tabs.setZoom(2)` failed because this local Chromium build never started the extension worker (30-second timeout). An exploratory CSS-body-zoom attempt clipped native top-layer dialog geometry; CSS zoom was not used as native acceptance evidence. The final fallback is explicitly a reduced effective viewport. The script retains native extension zoom readback assertions by default, and the existing authenticated native CI workflow preserves its genuine-zoom checks. No new hosted migration has been applied. The rollout follow-up changed only the migration, its physical test and this receipt; the focused physical migration test passed after the change, and prior rendered checks remain applicable.

## Files owned by this task

- World: `apps/web/src/world/environment{,.test}.ts`, `apps/web/src/server/world/world-environment-store{,.test}.ts`, `apps/web/src/server/master/world-environment-admin-store{,.test}.ts`, `apps/web/src/components/master/world-environment/world-environment-editor{.tsx,.test.tsx,.module.css}`.
- Elevation/rules: `apps/web/src/server/master/battlefield-elevation-policy-store{,.test}.ts`, `apps/web/src/components/master/combat-content/battlefield-elevation-editor{.tsx,.test.tsx,.module.css}`, `apps/web/src/components/master/combat-content/combat-effect-timing-editor{.tsx,.test.tsx,.module.css}`, `apps/web/src/components/master/operational-dialog{.tsx,.module.css}`, `apps/web/src/components/master/operational-editors-interaction.test.tsx`.
- Engine: `packages/game-core/src/combat/standard-battlefield{,.test}.ts`, `packages/game-core/src/combat/battlefield-elevation-policy.test.ts`.
- Persistence: `supabase/migrations/20261026062526_independent_elevation_and_weather_cadence.sql` (generated with `pnpm exec supabase migration new`), `packages/db/src/independent-elevation-weather-cadence-migration.test.ts`.
- Adjacent captured-gameplay checks: `apps/web/src/server/battle/battle-session-service.test.ts`, `apps/web/src/server/world/world-battle-combat-policy.test.ts` (only parameterizing existing elevation tests for legacy/current models).
- Browser: `apps/web/scripts/panel-world-rules-browser-regression.mjs`, `apps/web/e2e/master-world-environment-cadence.pw.ts`, elevation assertions in `apps/web/e2e/master-combat-content-authoring.pw.ts`, and Rules-dialog assertions in `apps/web/e2e/master-zoom-workflows.ts`. Other agents own unrelated edits in shared e2e files.
- This receipt.
