# Complete roster — publication boundary checkpoint

Status: local implementation and regression evidence; single combined review addressed; final post-fix repository gate passed. No hosted write, roster activation, merge or deployment. ParentTasks15–16 and the coordinated combat release remain open.

## What changed

The accepted294-record roster was exercised through the actual Master authoring service. This exposed25 failures hidden by design-only validation:15 canonical-root Essences were revalidated against their stale nested native envelope,5 positive Dispel sets containing Covert were labelled Cleanse, and5 explicitly narrow status removals were treated as full Cleanse.

Master Essence validation now selects canonical-root mechanics with the same precedence as execution, without invoking runtime usability checks during authoring. Disabled root and canonical nested Skill flags return structured validation results and remain publishable; historical native disabled nested Skills retain their prior structured rejection rather than throwing. Covert is included in positive Dispel classification only with explicit specified mode; omitted mode retains the exact historical classification used by settlement. The existing remove-status payload gains optional `removalMode: 'specified'`. Explicit mode removes only its named statuses, preserving unrelated Suppress. Absent mode retains historical Cleanse/Dispel and legacy Chilled behavior; malformed modes reject at canonical and both native validation boundaries. Standard partial Cleanse without this explicit mode is still rejected. No new executor, effect type, endpoint, database migration, dependency, cost or damage formula was introduced.

The Master effect editor exposes Cleanse/Dispel versus Only listed statuses. Shared readers label the latter Remove Status, show the actual listed statuses, and avoid promising unrelated Suppress removal. Actual browser interaction and display acceptance remain blocked by the inherited browser availability problem.

## Exact design implementation amendment

The approved design remains recorded at sourcea8df18ef with manifestSHA256`584f45d835bbf7b811a354c33e6618cd2cecb46abdbf5110946070b851f3fdbc`. The unpublished implementation manifest is nowSHA256`bdceab2a7547845d15f20654c1dc758a97d6c104d2dad76c906364e4504cdd9f`.

These ten packets gain explicit specified mode. The first five express already-reviewed narrow consumption/removal; the second five make newly authored positive Dispel explicit while leaving old mode-absent Covert captures unchanged. Their proposed versions, costs, targets, Requirements, status lists, timing and other effects are unchanged; their applicable mechanical uniqueness signatures and matching pair audit entries are refreshed rather than excluding the new mechanic from the audit.

| Record | Packet | Proposed version |
| --- | --- | --- |
| resonance.farstrider-runeblade.linked-sequence | erase-mark |5|
| resonance.cinderweaver-wildwarden.linked-sequence | spend-poison |5|
| resonance.dawnshield-stormsinger.linked-sequence | remove-status |6|
| resonance.bastion-tidecaller.linked-sequence | remove-status |6|
| resonance.runeblade-tidecaller.linked-sequence | remove-status |6|
| runeblade.unbinding-rune | remove-status |5|
| resonance.shadehand-vanguard.broken-line | remove-status |5|
| resonance.runeblade-vanguard.linked-sequence | remove-status |5|
| resonance.runeblade-shadehand.linked-sequence | remove-status |5|
| resonance.cinderweaver-edgedancer.linked-sequence | remove-status |5|

An independent structural comparison against933e496c removes the ten new mode fields and restores the nine affected Resonance signatures and proves the entire original manifest equal. All other284 rows, all before identities/digests and the five retained Basics remain exact. This implements already-reviewed narrow consumption/removal intent; it does not rebalance or redesign the roster. The Excel preview's listed mechanics/parameters remain accurate; no material tuning has occurred.

## Verification

Commands use `.superpowers/sdd/2026-10-10-unified-engine-recovery/run.py`; receipts and full logs remain in that plan's evidence directory.

| Evidence | Result | Receipt UTC |
| --- | --- | --- |
| Actual Master validation across294 records | RED25failed/269passed |051617209118|
| Explicit-mode core behavior/validation/capture | RED8failed, including actual unwanted Suppress removal; empty-array table fixture later wrapped as an explicit value |052053876271|
| Master editor/shared reader | RED2failed/62passed |052055621509|
| All294 actual validations plus289 local version publications/current+exact pinned reads/stale retries and5 retained Basics; covering authoring/editor/reader tests |740tests/4files pass |052300547602; explicit final verbose052628929336|
| Core mode/registry/parser/complete manifest/outcomes/Suppress/gameplay labels |907tests/7files pass |052427658179|
| Core canonical prepare/commit after JSON restore and existing real AI utility projection |10mode tests pass |052615048648|
| Core types |Pass after restoring the actual stat bridge in a test fixture; no production type weakening |052608286045|
| Web types |Pass |052504382409|
| Affected core and web lint |Pass |052504382378,052508142978|

The first web run052202104051 exited0 with no useful stdout and is not relied upon for test counts. Explicit verbose runs provide named outcomes. After the five payload amendments, the prior functional signatures failed as expected; exactly those five were recalculated, and all136 uniqueness screens pass with no collision. No existing signature test was weakened.

Publication tests use the real in-memory repository, real Master service and real current/pinned resolver. They verify289 new versions while older definitions remain retrievable, repeated stale publication is rejected, and the5 retained Basics create no cosmetic versions. This is not a hosted SQL/CAS test, a complete catalogue-policy reconciliation, current Owner-edits approval or content activation. No Supabase operation occurs in these tests.

Core outcomes use real native and captured canonical execution, immutable quotes, JSON restore, actual status removal receipts and existing AI utility. They establish the bounded removal behavior, not full class/pair/AI balance or the12-round Level100 target.

## Remaining gates

Complete immutable roster application/publication preparation still needs fresh current-catalogue/Owner-edit reconciliation and actual whole-catalogue timing compatibility. Every implemented gameplay tag needs executable playable evidence; full legal four-Skill class/pair cycles and actual low/high-level PvE/PvP/AI/Level100 balance remain required. Finish event/conditional Master previews and actual reader/card/forecast/effect-popup prose/orange-effect audits.

Picker/native integration remains unaccepted because Chromium is unavailable and cloud browser cannot reach the local harness. Native editor mode capture/Save, keyboard/touch/200%browser zoom, source/version/reconnect races and physical layout remain open. The inherited Atlas peer-motion failure0.830568 versus<0.75 remains a release blocker. No bound is relaxed.

## Combined review and one fix pass

The single fresh combined review covered933e496c..41439a0f and found0Critical/2Important/0Minor. Both Important findings were reproduced before their scoped fixes:

- I1: the execution-only Essence selector threw for disabled drafts. Authoring now selects root mechanics without that usability assertion. Four native/canonical disabled-flag cases and six negative canonical-root cases cover malformed root, partial Cleanse, identity, media, version and forbidden derived-tag injection. Native nested disabled Skills retain the old structured rejection; no generic Skill publication rule was relaxed.
- I2: adding Covert to the mode-absent classification changed historical implicit Suppress removal. The historical Dispel set is now frozen; explicit specified positive lists use the complete positive set and display Dispel. Five new positive-list packets gain the existing explicit mode, making ten metadata amendments in total. Actual immediate and delayed canonical commands preserve old/new behavior after JSON capture/restore, without rewriting the source definition.

RED053415:3core failures, including actual missing Suppress removal on both immediate and delayed historical commands. GREEN053456689959:860tests/5files. RED053416:6web failures from uncaught disabled validation. GREEN053537681854:751tests/4files including all publication cases. Intermediate fixture corrections (unsupported duration10 changed to legal4; existing native disabled validation expectation and actual INVALID_REQUEST code; unknown event types narrowed structurally) are retained in logs, not hidden by relaxed production rules.

The initial full check at41439a0f passed7,681Vitest+7Node, formatting, lint, all8package types and2build tasks (052808150882), but predates these fixes and is not final post-fix evidence. Web types053539pass; the core type gate initially caught an unknown event type in the new test and was corrected by structural narrowing. Final full check, fresh-main confirmation and recovery receipt follow below.

Review-declined items each remain open: earlier picker/whole-branch changes (outside this diff; cost is unobserved prior interaction bugs); canonical derivedTags/editorial consistency (legacy projection audit still needed; cost is misleading consumers); hosted SQL/CAS/current catalogue/Owner edits (local store cannot prove them; cost is stale/incorrect publication); browser/accessibility/layout (no native evidence; cost is unusable controls); complete tag/roster/AI/Level100 balance (bounded outcomes insufficient; cost is incomplete or dominant playstyles); inherited Atlas motion (unrelated unchanged blocker; cost is failed animation acceptance); merge/deploy/activation/full release (not established or authorized by this checkpoint; cost is premature release). No declined item is silently accepted. Archive commits never replace implementation ancestry.

## Final verification checkpoint

Final frozen product source `efb6fd33e73bd8efecd3dfab64bd32da771ce6ec` passes `pnpm --reporter=append-only check`:7,694Vitest tests (4,019core/3,429web/246other) plus7Node checks, formatting, lint, all8package type gates and2build tasks. Exact receipt20261016T053707343541Z,05:37:07–05:39:28UTC,exit0. Subsequent report changes are documentation-only; no application/package/script source changed after this test. Both Important findings are fixed; no second reviewer or redundant full suite was run.

Fresh `origin/main` remains `29506e293e81abef1b0b8a46099618ab3ae3f0ae`, verified as an ancestor; the automatic Git-deployment lock remains false for all branches. Recovery source/evidence is preserved separately on the authorized backup-only archive branch, with exact hashes, prerequisite933e496c and local bundle verification recorded in its checkpoint metadata. This does not merge or activate the roster.

Next parent work is executable registry-to-final-roster outcomes, including the selected Ground bridge and actual finite/counter/no-input cases, followed by current-catalogue/timing reconciliation and real class/pair/AI-Level100 balance. Task15 and native picker acceptance remain open.
