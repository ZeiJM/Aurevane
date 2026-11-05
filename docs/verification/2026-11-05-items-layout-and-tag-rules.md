# November 5 post-release Item layout and tag rules

Status: implemented and independently reviewed; required verification remains blocked. Not deployed.

The earlier Items release remains live on `dpl_D79wgdgrFWWjf3kom6sfypujPk6F`.
This work starts from main `e4dd343b9c441fa65d50027b3b5df2f541a51e45` on an isolated
`agent/equipment-fit-20261105` branch. Nick subsequently authorized hourly checks and this scoped
controlled production release once required verification passes (November 5). No new deployment
or hosted publication has been performed yet.

## Owner direction and implementation

- Fit all eight equipment positions in the ordinary desktop panel without an internal equipment scroll.
  Preserve the existing shared cockpit/inventory/equipment artwork size. Use compact horizontal
  desktop cards, bounded portrait painting and consistent gutters. Keep mobile cards readable.
- Tighten inventory name rows without changing artwork, quantities, equipped badges or actions.
- Item facts: Tier, Quality Points, Maximum stack; then Class, Position, Type. Uses per battle is
  the seventh/last field where applicable. Consumable Position reads `Consumable Slot`.
- Give popup summaries and reports a consistent measure, align report values beside labels,
  and retain wrapping. Remove the duplicate armor/glove stat-change footer.
- Weapons: Manual Basic Attack plus optional Manual imbued technique, no held passives.
  Armor/gloves: passive modifiers only, no active actions/bindings. Enforce current publication
  rules server-side and restrict the shared editor; retain historical grammar unchanged.
- Remove Emberbrand/Tower Shield held passives and Wardstone Bracer’s Warding Prayer. Keep
  Kindle/Tower Guard selectable for their weapons. Preserve QP/cost/duration/stock/requirements.
  Emberbrand attack scaling changes from 1300 to 1400 basis points to retain the existing
  tested weapon damage-per-AP band after removing the passive; base Fire damage stays 6.
- All current Item action timing follows the global tag policy. Remove source-wide hardcoded
  Instant wrappers. Inventory reads the current policy once per refreshed state and Master
  preview consumes the same timing context; battle reports continue using captured policy.
- Stat reports use names such as Evasion [+1%], Initiative [+3], Movement [+2]. Evasion 100
  stored basis points means +1 percentage point; values/formulas do not change. Omit repeated
  Requirements maintenance wording. The Requirements row and enforcement remain intact.
- Profile green/red contribution hover/click lists only equipment names and signed contributions.
  Ordinary stat help stays accessible by clicking/keyboard on the stat itself.

## Current hosted evidence (read-only)

The actual live timing policy is version 11 with `tagAuthority: global`. Explicit Instant tags:
Summon, Sensory, Displace, MP Drain, Blindside, Conductive, Remove Status, Barrier Change,
Create Terrain. Return to Turn Start is Controlled. Damage Up (`inspired`) has no override,
so ordinary global rules use next-round activation. No timing setting was changed by this work.

A read-only audit of all 47 Item records found a maximum version floor of 5. The exact 20
source candidates use version 6. The candidates, pre-change bodies and timing policy are in
[the successor audit](2026-11-05-items-polish-successors.json).

The previous three-successor audit/receipt remains historical and unchanged. Source version 6
must never replace retained bodies at versions 1/2/4/5. Existing admitted battles retain their
captured definitions/policy, including old weapon passives and old armor Support selections.

For a later authorized release, refresh record revisions/version floors, Owner drafts and current
bodies before source registration. Only Emberbrand currently has a publication that needs the new
role body: normal fresh-CAS Commit after source6 registration projects publication7, subject to
fresh state. Timing-only publications already obey global timing; do not broadly republish them.
Wardstone and Tower Shield currently use immutable-source fallback. A removed current equipment
Support can be repaired through the ordinary chooser/unequip fallback; no batch rewrite of
characters, drafts, inventory, historical versions or battles is part of this change.

## Verification selection

First reproduced the desktop bug: at 1536×614 the original equipment panel overflowed by 281px.
The new native guard checks every slot is already inside the panel without scrolling, actual
image size remains equal to inventory/cockpit, and text/art stay inside cards. Popup tests retain
focus, direct mutation, sorting, stale/lost-response recovery, QP, distinct consumables and stock.

Focused and adjacent checks cover:

- all 47 source bodies with exactly 20 audited successors and 27 unaffected defaults;
- current publication role rejection plus retained historical parses;
- actual Kindle commit/pending/round activation under Normal, Delayed and Instant global policy;
- inventory/preview timing reports and actual disposable-DB Item reads/writes;
- ordinary weapon/consumable mechanics under an explicitly chosen global Instant test policy
  (isolates mechanical assertions from the separate real timing tests);
- readable stat amounts/units, metadata order, armor footer omission and Profile source-only hover;
- full native Items/Arsenal fixture with production CSS across nine existing shell sizes,
  actual static artwork, modal actions, keyboard/touch and retained Support chooser recovery.

## Recorded verification and remaining gates

PR: https://github.com/ZeiJM/Aurevane/pull/1019 (draft). Application source
`16316a9bbb8daf0a0bc422e029625233682fa490`, tree `5ffaf9be9e1375b07f60f9b6eafd12560b6984f7`,
contains the final layout/role/timing changes. The following test reconciliation leaves that
application code unchanged and expands current/retained Salve timing coverage.

Passing local evidence:

- Repository formatting, lint and all eight package typechecks. Latest adjusted reader/fixture
  files also pass scoped lint. The optimized production build passes (Web and Worker, 2 tasks).
- Focused Item authority/reader/editor/service/disposable-DB checks: 51 cases; subsequent
  authoring/stat checks: 22 cases (overlapping coverage); shared Manual regressions: 23 cases.
  These are separate runs, not a claimed unique total.
- The Core broad run completed 7,150 cases: 7,147 passed and 3 timed out. All three failing
  files then pass isolated with one worker, 44 cases at unchanged original limits:
  `level-100-duel-balance`, `recruit-ai-manual-modifiers`, `starter-items-combat`.
- All nine shell sizes pass no-scroll equipment geometry, shared image scale, header,
  inventory reachability and hand popup checks: 1728×885, 1536×614, 1440×900, 1366×768,
  1280×720, 1024×768, 1024×576, 390×844 and 412×915.
- Separate unchanged interaction blocks pass at 1366, 390 and 412 widths: direct actions,
  owned pickers, distinct consumables, QP/repair, automatic refresh, weapon technique selection,
  late-read recovery, fallback, dialogs and deletion focus. All three presentation artworks decode.
- Master editor checks pass at 1440, 1366, 390 and 412 widths. Passive initialization and
  explicit retained-armor binding repair pass separately. Profile source-only hover/click
  and keyboard stat help pass.
- Independent role/timing/history review has no remaining findings. Its retained armor binding
  repair finding was fixed explicitly. Final review confirms genuine published Salve v3 comes
  unchanged from the prior tracked audit; current/retained × Controlled/Delayed retains all
  capture/reload assertions. Focused reconciliation: 5 passed, 47 intentionally unselected by
  the targeted filter. Normal configured coverage is unchanged.

No monolithic `pnpm check` or complete native-runner success is claimed. A native full attempt
hit a late 30-second development navigation timeout after eight shell sizes; the fixture now
loads the unrelated Profile component lazily, and final nine-size/interaction blocks pass
separately. Original navigation/assertion timeouts are unchanged. Evidence remains under
`/tmp/items-polish-shell-final`, `/tmp/items-polish-interactions-final` and named local logs.
Normal CI still runs the complete configured runner.

Local broad blockers, deliberately not marked green:

- Full database-package execution reported two 20-second timing-migration timeouts and was
  interrupted after stalling. Its six-case file isolated at the original limits passes five;
  `appends Delayed Rewind without mutating prior overrides...` still times out at 20 seconds.
  No migration/history repair or timeout increase was made. There is no new passing evidence
  for the previously documented historical modular publication/rollback case.
- Broad Web execution was interrupted after reported slow/failing cases in authoring,
  restore, World map, battle preview, summon, AI and payoff/ranged suites. Two genuine Item
  timing assertions and one ItemReportTabs wording assertion were obsolete after the approved
  source/wording changes; those now pass with stronger retained-history coverage. Other broad
  failures remain unresolved. Full Web/DB evidence and green required CI remain gates.

Exact-head CI was checked once per source head, without continuous polling. On
`16316a9bbb8daf0a0bc422e029625233682fa490`, readers, Skill Engine, Controlled, Desktop Page Fit,
Desktop Experience, Representative Buildcraft and Combat/Mobile workflows pass. Quality,
Browser Smoke and UI Layout were still running; Supabase Preview was skipped.
CI Database Foundation fails before tests start because Docker cannot bind host port 54322
(`address already in use`):
https://github.com/ZeiJM/Aurevane/actions/runs/42080812114/job/127433884260
GitHub rejected a scoped retry with `The workflow run containing this job is already running`.
Retry after the workflow finishes; do not cancel useful verification or bypass the gate.
No workflow, required result or timeout was weakened.

The PR remains draft. Do not merge or deploy from this partial verification checkpoint.
No hosted grant, consumption, migration, source registration, publication or deployment is tested
by issuing real writes. Existing Vercel Git deployment locks remain unchanged.

## Unresolved observations from the interrupted broad Web run

These are the observed case names, not a completed suite summary or a diagnosis.
The three reconciled fast Item/wording expectations are recorded above and excluded here.

| File | Observed case |
| --- | --- |
| `src/server/master/combat-content-authoring-service.test.ts` | saves, previews and publishes 'resonance' 'mystic' through the real shared service |
| `src/server/battle/battle-essence-authority.test.ts` | practice termination ends an armed Reversal with its normal receipt and preserves paid resources |
| `src/server/battle/battle-essence-authority.test.ts` | completes all Guided Fundamentals criteria through admitted passive-pilfer actions after reload |
| `src/server/battle/battle-essence-authority.test.ts` | completes all Guided Fundamentals criteria through admitted equipment-support actions after reload |
| `src/components/master/combat-content/basic-restore-interaction.test.tsx` | retains a newer relationship selection made after a new power Commit starts |
| `src/components/master/combat-content/basic-restore-interaction.test.tsx` | authors basic.invocation current settings without an original-restore control or restore intent |
| `src/components/master/combat-content/basic-restore-interaction.test.tsx` | retains the created Skill identity and inline edits after commit failure, then retries without recreating or losing its Source Discipline |
| `src/components/world/map-renderer.test.ts` | retains cached water underpass material in verdant-expanse with paused motion |
| `src/components/world/map-renderer.test.ts` | reuses warmed procedural terrain when camera visibility changes raster density |
| `src/components/world/map-renderer.test.ts` | keeps your own portrait when other travellers share your tile |
| `src/components/battle/battle-captured-preview-feedback.test.tsx` | pvp keeps All recovery recipient detection separate from a self Single aiming glow |
| `src/components/battle/battle-captured-preview-feedback.test.tsx` | pvp lights only the current native primed Controlled Attack after its legal forecast |
| `src/components/battle/battle-captured-preview-feedback.test.tsx` | pvp keeps the blocked response explanation and suppresses readiness |
| `src/server/battle/roster-legal-summon-services.test.ts` | '1:pve' persists one earned summon across replay, reload and five real AI turns |
| `src/server/battle/roster-legal-summon-services.test.ts` | '1:pvp' persists one earned summon across replay, reload and five real AI turns |
| `src/server/battle/roster-legal-summon-services.test.ts` | '100:pve' persists one earned summon across replay, reload and five real AI turns |
| `src/server/battle/roster-legal-summon-services.test.ts` | '100:pvp' persists one earned summon across replay, reload and five real AI turns |
| `src/server/battle/battle-recruit-ai-build.test.ts` | returns a bounded committed page for 9 cheap Controlled actions without ending the turn early |
| `src/server/battle/roster-legal-payoff-cycles.test.ts` | 'aetherist:100:pvp' exchanges an earned protection after paying for its real setup |
| `src/server/battle/battle-recruit-ai-service.test.ts` | routes actual 'duel-yard' AI spawns into combat (+0 allies/5 enemies, map seed 1) |
| `src/server/battle/battle-recruit-ai-service.test.ts` | routes actual 'terraced-yard' AI spawns into combat (+0 allies/5 enemies, map seed 1) |
| `src/server/battle/battle-recruit-ai-service.test.ts` | routes actual 'terraced-yard' AI spawns into combat (2 allies/3 enemies, map seed 1) |
| `src/server/battle/battle-recruit-ai-service.test.ts` | routes actual 'terraced-yard' AI spawns into combat (+0 allies/5 enemies, map seed 47399736) |
| `src/server/battle/roster-legal-ranged-ai.test.ts` | '1:pve' preserves a feasible repeated Basic turn instead of a lower-value single-target walk and shot |
| `src/server/battle/roster-legal-ranged-ai.test.ts` | '1:pve' repositions for an affordable three-target Volley that improves paid value |
| `src/server/battle/roster-legal-ranged-ai.test.ts` | '1:pvp' repositions for an affordable three-target Volley that improves paid value |
| `src/server/battle/roster-legal-ranged-ai.test.ts` | '100:pve' repositions for an affordable three-target Volley that improves paid value |
| `src/server/battle/roster-legal-ranged-ai.test.ts` | '100:pvp' repositions for an affordable three-target Volley that improves paid value |

## Subsequent exact-head CI diagnosis and reviewed test reconciliation

On `4bae94e962aaa322a608fac8a507a741baa664ee`, the complete central quality execution
passed all 7,150 Core tests and all 633 DB tests at unchanged configured limits. This provides
new passing CI evidence for the previously recorded local broad timeouts; it does not relabel
the interrupted local runs as successful. Database Foundation also passes, so the prior-head
Docker-port startup collision is no longer a current blocker.

The Web suite completed: 8,892 passed and four failed in two files. Both red check names
(`Execute Quality gates` and its final `Quality gates` result) represent this same execution,
not two independent root causes. Source log:
https://github.com/ZeiJM/Aurevane/actions/runs/42087416943/job/127456356506

All four failures were reproduced locally before adjustment:

- Three `starter-weapon-support-injection` cases still expected current Wardstone Bracer to
  offer Warding Prayer, contrary to the approved passive-only armor rule. The matrix now
  covers all three weapons with current source6 armor and genuine retained source1 armor
  from the tracked before-definition audit. It proves only the selected Support is injected,
  current armor cannot inject the removed action, retained armor still can, attacks remain
  available, private stack IDs are excluded from selections, and Basic Support excludes
  equipment Support. No historical parser or application source changes.
- `passive-stat-authoring` still expected the player report to explain `100 = 1%`. It now
  asserts exact `Evasion [+1%] [Self]` and `Evasion +1%.` reporting without internal units
  or Requirements prose. The authoring editor's unit explanation remains asserted.

The adjusted two-file run passes all eight cases at original limits; a four-file adjacent run
passes 20 cases. Scoped Web ESLint, Web TypeScript and formatting pass. Independent review
reports no findings and independently repeats the eight cases successfully. Fresh main remains
`e4dd343b9c441fa65d50027b3b5df2f541a51e45`; Git deployment remains disabled. New exact-head
configured results remain required. At the one status observation for the preceding head, all
other completed application checks pass and responsive Browser Smoke is still running;
Supabase Preview is intentionally skipped. No gate, timeout or assertion was weakened.

The hourly release watch is enabled and must stop after verified canonical production release.
No original-release migrations/publications/deployment may be replayed. This refinement adds
no migration; its guarded source-registration/publication scope remains the exact audited
20 successors and only the required ordinary Emberbrand publication after fresh checks.
