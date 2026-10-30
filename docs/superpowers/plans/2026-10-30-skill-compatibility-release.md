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
- [x] Implement canonical compatibility derivation and recoverable active projection (native gates pending).
      First pin pure Move from enemy template, mixed follow-ups, selected-target
      Requirements, add/remove/reorder, save/reload and commit preservation regressions.
- [x] Apply disabled controls/options and concise help across shared editors (native gates pending).
- [x] Ground destination / method-only presentation across current and pinned readers (native gates pending).
- [x] Implement selectable single-unit utility/healing highlights; native verification pending.
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

## Highlight patch checkpoint

Single-unit non-damaging highlights now require a candidate returned by the same
selector used for target gestures, in addition to the existing reach/LoS footprint.
Basic/Support actions also use that selector. Ground, area, damaging potential
footprints and separate legal Move path selection remain unchanged. Healing single
unit tint follows the selected recipient rather than assuming every heal is allied.

Six component assertions fail on original source, then all 30 captured-feedback
cases pass after the fix. Six adjacent suites pass 192 tests, including preview
selection/range, corpse occupancy and Chronicle display/copy. Focused web lint,
formatting, script syntax and web typecheck pass. No full final build claimed.
New native Move+utility and Move+healing cases exercise real production controls in
PvE/PvP at desktop/mobile sizes, rejecting empty target clicks while retaining route,
then committing one unit-target command with original path/cost assertions. Existing
damage scenarios retain their damage receipt checks. Native execution is pending:
this host has no installed Playwright Chromium executable, so no mounted browser
success is claimed. Browser Smoke already executes this script with AV_CANONICAL_MOVE=1.

Bounded CI read for 098972a97e1c10048650bf6161aceade2a265a98: seven workflows passed,
Browser smoke41064306468 pending, central CI41064306513 failed only at database
startup. Job124091723697 again could not bind host port54322 before any database
test. This is a recurring runner conflict, not a product test failure; no rerun was
requested. Quality gates passed. Final candidate still requires all native/database
gates; do not bypass or assume that the old-head failure has been resolved.

Remaining source: compatibility projection/disabled choices and Ground/method-only
reader presentation. No merge, deployment, migration or catalogue publication.

## Reader and destination checkpoint

Move payloads display Ground as destination without changing actor/self recipient
or path mechanics. The destination selector is locked to Ground and explains the
caster/follow-up distinction. Pure Move with no selected-target Requirement shows
Single without duplicated reach; mixed actions and selected-target Requirements
retain their range. Native walking retains Path and its actual Move stat bound.

Target Method rows contain only the method/range. Typed aim, friendly fire, ground
duration and selection limits move into report help, with accessible existing info
popovers across Master, Nexus, Character HQ, battle and summon readers. The Manual
keeps these constraints in explanation prose. Historical reports retain their own
stored delivery text in help; shortening each separate group preserves all group
labels. Missing captures do not acquire current metadata. Existing Ground rule
supplements remain in place. No authored definition or historical capture is rewritten.

Nine focused assertions fail before the main reader patch; Manual preservation and
historical multi-group presentation each have another failing-first regression.
Final adjacent run: 193/193 tests across 12 suites pass. Full web lint passed before
the small multi-group correction, with focused lint repeated on its final files;
script syntax/format/diff checks pass. Production build after clearing only the known
invalid generated Turbopack cache passed before the final multi-group refinement;
final exact-source production build also passes after moving only the invalid generated cache aside. Extended native palette
checks assert Ground brackets, locked Destination and unchanged actor payload.
Native runtime evidence remains required from CI, not claimed from this host.

Bounded CI read on previous head4927b166: eight workflows including central CI
succeeded; Browser smoke41072942318 still in progress. The recurring database port
conflict did not occur on that head; no blind retry or CI changes were made. These
results do not validate subsequent source. Main remains c6b91fabb76b9401d7fad8f0bba8ef776af485b1.

At this reader checkpoint, compatibility projection and disabled choices (items1/6)
remained. The compatibility checkpoint below supersedes that source status. Do not
merge, deploy, migrate or publish content until the final gates pass.

React review: reused the existing accessible popover; no new state, subscriptions, data reads or gameplay mutations. Shared report help is an optional serializable string, and legacy multi-group labels remain separate through display projection. Self-reviewed inline per the sole-worker instruction.

## Compatibility source checkpoint

The current-only active projection now separates raw recoverable authoring values
from validation, working previews and Commit Now. Move with only actor/global
packets and no selected-target Requirement has self-bound Single zero reach, no
attack accuracy or persistent attack area. Mixed external follow-ups and selected
Requirements retain their own aim. Requirements themselves, effects, costs,
cooldowns and authored identities are preserved. A separate Target unit control
supports unit-based Requirements on a fresh self-bound Move without confusing that
unit with the Ground destination. Historical/captured readers never use this helper.

Raw inactive values stay in the existing pending/recovery map, including after
successful commit and revision rebasing. Dirty comparison uses active semantic JSON
values, retaining array order and ignoring object key order/undefined omission, so
an inactive backup is not falsely labelled an uncommitted gameplay edit. No private
backup fields are written into the catalogue, database history or active definition.

Shared controls disable inactive range/elevation/shape/LoS/Ground fields, accuracy,
non-hostile friendly fire, duplicate Move, Move/Summon conflicts, incompatible
Copy/Reveal choices and invalid Move/Summon reorder steps. New Move inserts first;
other new packets insert before an existing final Summon. Activation/mode choices
respect Move/Summon's Manual Action constraint. Existing invalid orders can move
toward a legal order; unsupported retained mechanics still fail strict validation.
No effect or Requirement is silently dropped. Help is contextual to the group.
Order checks reuse the authoritative validator and avoid validating ordinary swaps.

Regressions cover pure Move from an enemy template, mixed restoration after draft
JSON round-trip, actor-only follow-ups, selected-target Requirements, all three
content containers, exact active commit preparation, raw recovery, effect order,
visible disabled controls, real Requirement aim callbacks, object key reordering and
JSON undefined omission. Seven assertions fail with the projection removed; restore
passes focused checks. Final repair loop passes 53 adjacent tests before full gate.
Native palette tests now cover remove-follow-ups -> pure Move -> add-Damage
restoration, retain direct engine invalid-order rejection, and precisely select the
Destination combobox rather than its help dialog. Native execution remains pending.

One bounded hosted inspection on14926b077: ten of thirteen workflows succeeded;
central quality failed on four old reader expectations (delivery moved to help and
Move now Ground); Modular readers and Browser smoke failed because getByLabel
Destination matched both select and dialog. Those assertions/selectors are repaired
without removing the underlying delivery, recipient, ordering or privacy guards.
Database execution did not fail. No unchanged-source retries were requested.

The first full local gate found contextual help mentioning Manual Action in an
Automatic-only editor (fixed by contextual help), plus a test loaded during the
Requirement-target refinement. Object-order/undefined draft comparisons also have
failing-first regression guards. The final settled-source `pnpm check` passes,
including formatting, all workspace lint/type checks/tests, and the production web
build: web 525 files / 7,466 tests, game-core 207 / 5,841, database 46 / 461,
worker 1 / 2 and realtime 1 / 3. No tests failed. Unchanged package checks may use
Turbo cache; web checks and build executed on this source. Script syntax and diff
checks also pass.

All requested source scope is implemented. Hosted native/full exact-head checks
and production release remain outstanding. No native browser success is claimed
from this host. Keep PR draft and do not deploy until every required final check
passes. Main was freshly rechecked as c6b91fabb76b9401d7fad8f0bba8ef776af485b1
before publication; no concurrent main changes required reconciliation.

## Hosted reader assertion follow-through

One bounded CI inspection on head49d9c3ef5030bc18143f98a99cdb607531df72c1
(tree7e805a4baf3bf943945650e9263d63aa649f21c1): twelve of thirteen workflows
succeeded, including central CI, Controlled combat and Modular ability readers.
Browser smoke41094604468 failed at job124197102457, parameter-palette script line
2312: the Fire reader still expected Enemy / Ground in ordinary report text.
The captured Move destination/combined-follow-up browser step passed before this
failure. Later Browser smoke steps were skipped, so the full browser gate remains
unverified. No retries requested; database CI passed.

The repair changes only that native assertion: verify the standalone method label,
absence of inline aim, the preserved delivery title and the real opened Target Method
help dialog. Separate Ground supplements remain intact and are not mistaken for the
method label. Existing Fire Cleanse, Ground duration and effect explanation checks
remain. This is a test-expectation repair for the deliberate reader design, with no
app/gameplay source changes. CI supplies the failing-first runtime evidence. Local
adjacent reader/timing/effect-target suites pass 56/56 across three suites; script
syntax, formatting and diff checks pass. Native runtime revalidation still requires
hosted CI (Chromium absent locally). The previous full local gate and production
build validate the unchanged app source; repeating a full build for this native-only
assertion repair is excluded. Every required exact-new-head hosted gate is mandatory.
Fresh main remains c6b91fabb76b9401d7fad8f0bba8ef776af485b1. Keep draft; no merge
or deployment until all checks pass.
