# Skill compatibility and movement preview release plan

**Goal:** Complete the Owner-authorized shared editor, Move destination presentation,
Target Method and battle feedback batch before one verified Production release.

**Architecture:** Keep authored persistent drafts recoverable; derive active editor,
validation, preview and commit projections from canonical engine constraints per
behavior group. Separate actor-recipient movement from Ground destination selection
and follow-up aim. Historical captured definitions remain unchanged.

**Tech stack:** TypeScript, React, game-core, Vitest, native Playwright CI.

**Spec:** Owner instructions retained in the Aurevane editor release task and PR #996.
Execute inline; no competing workers. Existing dirty original checkout is protected.

## Constraints and verification

- Pure Move retains costs, cooldown, Requirements and legal movement distance/Jump;
  disable attack-only range, shape, elevation, accuracy and friendly fire.
- Mixed effects and selected-target Requirements retain the aim they actually need.
- Move stays internal recipient=actor, target=self; display destination Ground.
- Move is Manual/Action, Instant, once, first, and incompatible with Summon.
- Summon is single Empty Tile and last. Copy/Reveal and selected-target conditions
  require single-unit selection. Explain conflicts; never silently remove intent.
- Accuracy needs hostile non-actor hit-dependent packets; friendly fire needs hostile
  area packets. Disable incompatible targets, timings and reorder choices with help.
- Target Method shows method names and applicable range; remove appended aim labels,
  explain real delivery constraints in help, omit duplicated pure-Move distance.
- Preserve Ground/Line/Circle/All and damaging empty-tile footprints. Single-unit
  utility/healing highlights must follow selectable candidates, not mere reach.
- Preserve server authority, Root/Jump/terrain/occupancy/range/LoS, privacy, captures,
  Owner saves, progression, history and all nine reader retirement routing rules.
- No catalogue publication or migration. Keep Git deployment lock and explicit promotion.
- Development: failing-first focused tests, adjacent editor/reader/preview suites,
  real rendered controls and mounted tile interactions. Final: pnpm check and every
  configured exact-head workflow/job, native desktop/mobile PvE/PvP, fresh main
  reconciliation and tested-tree verification. Local tests cannot prove browser,
  signed-in Owner, physical listening, multiplayer or sustained-load acceptance.

## Execution ledger

- [x] Existing PR #996: self-only zero-range suffix and alphabetical tag choices.
- [x] Remove generic missing-result copy from displayed and copied Chronicle.
  Four focused tests fail before the change; 94/94 pass after. Real hits/misses,
  movement and failures, flavor, actor privacy and ordering remain asserted.
  Delete the unused text helper and both consumer branches; retain recorded model.
- [ ] Implement canonical compatibility derivation and recoverable active projection.
  First pin pure Move from enemy template, mixed follow-ups, selected-target
  Requirements, add/remove/reorder, save/reload and commit preservation regressions.
- [ ] Apply disabled controls/options and concise help across shared editors.
- [ ] Ground destination / method-only presentation across current and pinned readers.
- [ ] Fix selectable single-unit utility/healing highlights with mounted regression.
  Trace confirmed: battle-experience.tsx inFootprint feeds data-buff-path without
  skillTarget; actual target selector rejects empty unit targets. Movement destination
  stage must remain separate from post-move target stage.
- [ ] Full final gates, release, production verification, receipt and watcher shutdown.

## Checkpoint

Fresh main c6b91fabb76b9401d7fad8f0bba8ef776af485b1. One bounded CI read on
2a67d21693274565b5cf6b7bc0a6d50a6ef42e19: six workflows successful, Browser smoke
41051848917 in progress. CI41051849002 succeeded on its justified retry; no further
rerun requested. This is old-head evidence only after the next publication.
The complete batch is not implemented and must not merge or deploy yet.
