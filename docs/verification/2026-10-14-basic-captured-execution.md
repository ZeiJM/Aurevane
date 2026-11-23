# Captured Basic and Support execution checkpoint — October 14

This is a continuation checkpoint for Task3A, not a completed feature or live release.

## Delivered execution contracts

- Full typed records for Move, Basic Attack, Guard, HP Recovery and MP Recovery include text, enabled state, media references, tags, version, execution binding and canonical Ability groups. Strict parsing rejects unknown or contradictory fields; exact-version resolution never substitutes a current definition.
- Encounter capture pins both Basics and only the chosen Support Action. All three Support options remain independently editable records; this does not add battle slots or equip all auxiliaries at once.
- Captured records remain frozen and complete. Actual action execution consumes captured AP, effects and cooldowns. Recovery preserves native nearest rounding instead of changing the generic percentage kernel. New records may explicitly use floor rounding.
- Basic Attack retains native command identity, positive AP and the higher current offensive stat, with Physical ties. Authored base damage and scaling coefficient remain editable. Fixed family templates incompatible with this adaptive binding are rejected rather than silently overridden.
- A zero-AP offensive flat Basic Move is bounded once per acting turn across all its Manual groups. A committed miss consumes the attempt; invalid intent does not. Positive-AP offensive Move may repeat when otherwise legal.
- Flat Move uses the overall canonical Skill cost and accepts an independent movement path plus original follow-up selection. Attached walking never adds AP/MP/HP charges.
- Pure native Basic Move reads its captured AP rate and entered-tile cap for both preview and actual entered-tile payment, preserving terrain/status surcharges, native interruption and uncaptured historical defaults. Flat-cost Move must use the canonical action route; the standalone walking route rejects that unsupported binding explicitly.
- Disabled captured actions return illegal availability quotes instead of breaking the reader. Commit refuses them without payment. Historical non-Move roots reject a supplied movement path instead of silently ignoring it.

## Regression evidence

Meaningful newly reproduced failures: edited native Move still quoted20 instead of40 AP; disabled native Move remained legal; disabled Support threw during availability; fixed-family Basic Attack authoring was silently overwritten; historical non-Move intent silently discarded a supplied path. Each failed before its corresponding correction, then the combined six-file core run passed77 tests. Earlier source tests establish immutable captures, edited HP/MP/Guard/Basic Attack execution, nearest rounding, cross-group free-offense limits and flat Move path forwarding. Fixture-only errors are not counted as product failures.

Current-main reconciliation includes4c0ba69c (World click/Places/surrender). The sole TASKS.md merge conflict preserved both entries. No World implementation was rewritten.

## Explicit remaining work

Basic and Support definitions currently support Manual action groups; Automatic/Ongoing support is not implied. The native per-terrain binding supports pure Self walking only; additions such as follow-up effects, extra resources, cooldowns and Requirements require explicit conversion to flat overall Skill costs. Nearest Recovery currently supports actor percentages; other recipients require floor rounding. Captured Basic metadata is private, not a public authority payload.

Current/exact repository publication and new-battle admission, full shared presentation adapters, all Master editors, transport/service forwarding, AI/controller/native acceptance, Controlled execution and the creative all-tag rebalance remain outstanding. Broader miss-dependent healing and other previously approved work remain in scope. Source files alone do not establish that those features are available in production.

The shared effect summary styles now give labels the existing orange/gold bracket-value color, including the contextual paper palette. Native visual acceptance and remaining-reader audit are pending; see the owner color addendum. No new live change is claimed.

## Whole-source verification

- `pnpm --filter @aurevane/game-core exec vitest run --maxWorkers=2`:158 files /3,041 tests pass.
- `pnpm --filter @aurevane/web exec vitest run --maxWorkers=2`:295 files /2,480 tests pass.
- `pnpm --filter @aurevane/db test`:15 files /94 tests pass.
- `pnpm --filter @aurevane/validation test`:9 files /84 tests pass.
- Web Node report/audio checks:7/7 pass.
- Repository `pnpm typecheck`:8 packages pass; `pnpm lint`, `pnpm format:check` and `pnpm build` pass. A final affected-source lint check follows the last type-only correction. Diff whitespace check passes.
- Total5,699 Vitest assertions plus7 Node checks. This is local quality evidence; browser/gameplay and exact-head hosted gates remain separate. Existing Vite CommonJS/native-loader notice remains; it did not fail the run.

Current main was refreshed before editing and before finalization; it remains4c0ba69c and is included in the branch. Git automatic deployments remain disabled. No database migration, hosted mutation or production deployment occurs at this checkpoint.
