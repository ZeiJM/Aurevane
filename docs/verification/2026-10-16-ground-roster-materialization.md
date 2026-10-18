# Exact persistent Ground roster materialization

Status: local covering checks, one fresh combined review and final frozen-source gate passed. Base `7e7b1def59c81398d6698c8452da02e4e2f4cb3b`. Task15/16 remain open. No hosted publication, activation, migration, merge or deployment.

## Result

The three selected Ground groups are now written into the actual proposed Skill definitions, rather than reconstructed by a test-only adapter:

| Exact proposed version | Cost | Area | Entry packets |
| --- | --- | --- | --- |
|Wildwarden Venom Shot@8|55AP|4rounds, Arcane pulse, next round|entry-0 damage7; entry-1 captured15% Poison|
|Cinderweaver Flame Burst@10|55AP/3MP|3rounds, Embers, next round|entry-0 Fire damage8; entry-1 captured20% decaying Burn; actor Cleanse remains outside entry|
|Frostweaver Chilling Mist@8|50AP|2rounds, Frost, next round|entry-1 Slow; entry-2 Chilled; terrain entry-0 remains a cast-only operation with its own expiry|

Only these three records gain `after.ability`; their preexisting native envelope, price, target geometry2, payload order, cooldown, version, eligibility and media remain exactly unchanged. The selected stable-ID plan is retained as provenance, with local materialization status and native-browser acceptance still flagged. All other291 records are byte-value identical under parsed JSON comparison. Coverage changes only its Ground implementation status. Manifest SHA256 is `b86cfec056bbac582810e7da80f9bc687f02518892eb5d11275fc7b5ced19f05`; prior `bdceab…` is retained in Git.

The shared parser/compiler/handler already existed. Removed the roster fixture's fallback converter and changed the earlier three Ground compilation cases to consume actual proposed captures. The legal-build admission suite now requires canonical definitions for every equipped Skill, so it cannot silently fall back to the former native Ground exception. These changes do not activate the proposals or rewrite builtin/historical content.

Two real integration gaps appeared. The AI selected current Flame Burst with unflagged Enemy intent, which correctly suppresses persistence. It now sends the existing explicit Ground intent when planning an authored persistent Ground group. The player capture adapter also discarded Fire's Ground capability, and the canonical reader hid its Enemy alternative. A small shared geometry2 Fire/policy predicate now supplies the AI, owner-safe capability projection and reader. The shared player controller consumes the projected capability rather than a stale native envelope. Geometry3 keeps its explicitly authored categories; legacy/native execution and formulas are unchanged. Player Enemy intent remains available and pays the full price without creating an area. The AI uses a deterministic Ground choice for this authored persistent group; optimal Enemy-versus-Ground strategy is not claimed.

## Actual evidence

18 new core cases use actual proposed captures. They assert exact full group/version/entry IDs, native compiled payload equivalence, one combined payment, JSON restore, source removal without losing the captured area, actual entry damage or status stacks, no repeated same-turn entry, exact finite expiry, Airborne immunity, no-payment rejection, genuine surrender cleanup and terminal AI rejection. The ordinary entry packets are the unchanged authored flat7/8 values; under this current fixture's140% damage boundary they cause actual9/11HP loss, not an invented extra25% Power contribution. Mist entry actually increases Slow/Chilled stacks. Real AI chooses and commits all three exact groups when hostile units are in the area and ordinary walking is exhausted. This is a bounded tactical opportunity, not every class cycle or a balance claim.

The exact proposed Flame Burst also preserves player Enemy intent without persistence. Its cast-only Chilled cleanup is exercised with an explicit captured Instant remove-status policy; changing the global timing policy is not part of materialization. Reapplying Chilled to the caster immediately before an actual enemy entry proves entry does not repeat that cleanup. Actual proposed Mist followed by actual proposed Flame Burst converts frozen tiles to Steam while retaining the captured ice area's original expiry and each overlay's remaining lifetime.

Three actual local Master publication cases append the exact new versions and preserve the previous pinned definition. Real PvE/PvP previews report the full price and safe finite area without RNG/private caster packets. Actual Master editor and current/public SkillDetails/SkillParameters render the canonical Ground contract. Three editor callback cases change duration and reverse selected entry order while preserving all cast-only payloads and the original definition. Three owner-projection→shared-controller cases exercise actual proposed Flame Burst under absent/1/2 elemental policies, stale native presentation, Enemy and Ground intent, spectator exclusion and private-key filtering. Current readers retain Enemy/Ground and qualify persistence as Ground casts.

These are real pure-kernel, stateful local-service and rendered-component/adapter checks. Native browser/key/touch/mobile/zoom acceptance and hosted concurrency/publication are separate, still-open gates.

## Test-first receipts and corrections

- Actual capture RED `100526295236`:3null captures. Actual publication RED `100557042902`:3undefined canonical definitions. Adding the exact selected groups removes both gaps. Actual publication/editor/readers GREEN `100613367764`:3cases/588filtered.
- Core `100606162552` passes2/3; the Cinder fixture used unflagged Enemy intent. Corrected its explicit Ground selection, preserving the real dual-intent rule. Manifest status RED `100652104921`:1/812; then recorded local materialization without marking activation/browser acceptance.
- Extra core `100842600185` exposes missing AI Ground intent. Four other fixture assumptions were corrected: enable the actual Airborne policy and use the unchanged flat Ground packet formula. Isolated real AI RED `101017338262`:1/15. AI Ground propagation GREEN `101050042631`:838tests/5files.
- `101218880167` catches an unsupported Instant-cleanse assumption under an empty timing policy; the specific cast-only cleanup case now explicitly captures remove-status=Instant, with no definition/global-policy change. Covering core GREEN `101252762708`:990tests/11files. Core types initially catch the broad encounter type passed to surrender; validate/restore its actual stat bridge instead of casting, GREEN `101427724704`. Web types `101227222358` pass; core scoped lint `101427716435` passes.
- Editor-test setup initially used the wrong working directory, then an extra parent in its manifest path. The original3-case run `101029438802` is baseline evidence only. Corrected path; actual app covering GREEN `101227226066`:620tests/4files.
- Actual player capability/reader RED `101640105730`:policy2 loses the capability and Cinder's current public Target omits Enemy. A privacy fixture also matched the plain word “caster”; corrected it to JSON keys. Shared capture/controller/reader GREEN `101714174640`:677tests/6files, including all3policy cases and the real publication readers.
- Exact scope audit GREEN `101355629968`:3selected records,291unchanged, all preexisting after fields unchanged, coverage status only. Final audit additionally checks classification/family and the complete new group key set.

## Parent scope decisions

Ruling: materialize the three already selected groups mechanically within approved Task15, without new design approval. Cost if wrong: different clocks, prices or cast-only/entry mechanics; exact version/structure audit and actual outcomes guard this.

Ruling: remove test-only reconstruction and make actual proposed captures mandatory. Cost if wrong: losing old mechanical evidence; existing outcome and tag suites remain required, and final full checks include them.

Ruling: preserve geometry2 Fire's existing Enemy/Ground behavior through one shared capability predicate, owner-only safe projection and shared controller, rather than change target geometry or add another executor/button. Cost if wrong: unusable persistence or capability/privacy drift; actual policy/controller/reader and AI regressions cover it. This is applicable equally to PvE/PvP desktop/mobile controller logic, with no visual geometry change; native browser acceptance remains distinct.

Ruling: retain authored flat packets and captured effect timing instead of adding unapproved scaling or forcing Instant globally. Cost if wrong: misleading numerical or timing evidence; tests state actual damage and the explicit timing policy.

Ruling: local materialization remains unpublished. Native browser, all distinct cycles, natural Level1/100 PvE/PvP balance, Owner-edit/timing/hostedCAS reconciliation, broad public/editor/orange/prose/derivedTags audit and Atlas acceptance remain open. Cost if wrong: premature release with known acceptance gaps. Prior five Minors remain deferred; no unrelated polish is included.

Final covering core `101744302321`:951tests/9files; covering web `101714174640`:677tests/6files. Actual Master preview suite also passed within620/4files at101227. Final core/web typechecks `101921105522`/`101921104714` pass; actual app scoped ESLint `101921100841` passes with zero warnings. Scope audit `101905497476` passes including the exact group key/classification/family checks. Final repository gate will include the full1224-combination legal-build suite with all four equipped Skills now required to be canonical.

## Final frozen-source gate and review

Tested source `e9e0042d2107a3b9e4b19cb7751750b54d86808e`, tree `53bd4dd3b73750284652128cc9d1ce0e614e0986`. Actual full root `pnpm --reporter=append-only check` receipt `20261016T102003079147Z`,10:20:03–10:24:16UTC, exit0:8,113Vitest tests (4,115core;3,752web;246other),7Node tests, formatting, lint, eight-package types and both build tasks. No source fix after that frozen commit. Finalization is documentation only.

One fresh combined read-only review of `7e7b1def..e9e0042d` found0Critical,0Important,0newMinor; no fix pass needed. Parent agrees with the grades. Prior five deferred Minors remain: Rewind prime witness at its origin, supporting Shot version pinning, literal Ongoing dynamic-pair ID pinning, bounded repeated AI candidate route discovery, and prefixed legal-build fixture provenance. None changes this milestone's execution contract.

The reviewer independently verified the exact3/291manifest comparison, captured group entry payloads, Fire capability policy/geometry boundary, owner-safe projection/controller, persistent-only AI change, actual-capture fixtures and evidence limits.

### Individual parent rulings on reviewer exclusions

Ruling: Final repository gate — Accept the actual frozen-source full check, exit0, with8113Vitest and7Node tests, formatting/lint/types/builds; the reviewer need not duplicate it — Cost if wrong: unrelated integration regression if the receipt or source attribution is wrong.

Ruling: Native browser interaction — Keep keyboard/pointer/touch/mobile/zoom acceptance open; component and controller tests establish only their actual boundaries, and the known unavailable browser is not a basis for reinstall/tunnel loops — Cost if wrong: usable adapter behavior could still fail in real input flows.

Ruling: Living Atlas/layout acceptance — Keep visual/layout/accessibility acceptance open; static rendering cannot prove the real dimensions or motion bound — Cost if wrong: clipping, accessibility or layout defects could remain.

Ruling: Hosted publication/CAS — Keep hosted persistence and concurrency open; this checkpoint proves local service publication and version capture only — Cost if wrong: hosted CAS or persistence could differ.

Ruling: Owner-edit reconciliation — Do not publish/backfill or overwrite current Owner content; reconcile edited catalogue before any later publication — Cost if wrong: current edits could be overwritten or rejected.

Ruling: Hosted timing-policy reconciliation — Retain explicit captured Instant remove-status evidence and keep remote timing reconciliation open — Cost if wrong: actual cleanup timing could differ from the explicit fixture.

Ruling: Every distinct class/pair cycle — Continue Task15 distinct-cycle work; these three Ground outcomes and previous suites are not a claim for every roster cycle — Cost if wrong: other authored combinations could be ineffective or unusable.

Ruling: Natural Level1/100 PvE/PvP balance — Keep balance, dominance and pacing open; admission and bounded opportunities establish legality rather than budgets or match outcomes — Cost if wrong: imbalance or poor pacing could remain.

Ruling: AI strategic optimality — Accept deterministic existing Ground intent for authored persistent groups as the bounded correctness fix; do not claim optimal Enemy-versus-Ground tactics — Cost if wrong: legal but inferior choices against Airborne or other counters.

Ruling: All custom Fire compositions — Accept the shared geometry/policy capability predicate and actual unconditional proposed groups; arbitrary conditional/modifier/movement combinations remain part of broader authoring acceptance — Cost if wrong: additional capability-versus-execution edge cases could remain.

Ruling: Full reader/editor audit — Accept tested current Skill readers and Ground callbacks; retain broad prose/orange/derivedTags and all authoring combinations as open gates — Cost if wrong: misleading or inconsistent surfaces elsewhere.

Ruling: Every Ground lifecycle permutation — Accept covered entry/expiry/source-removal/JSON/terminal/Airborne/Steam outcomes; do not claim exhaustive overlap/policy/transition sequence coverage — Cost if wrong: uncommon interaction defects could remain.

Ruling: Hosted long-running/restart/load behavior — Keep operational persistence and load acceptance open; JSON restoration and local finite clocks establish narrower contracts — Cost if wrong: production-only lifecycle failures.

Ruling: Activation/release/human acceptance — Keep activation, migration, merge, deployment and human acceptance closed; no such action is part of this bounded checkpoint — Cost if wrong: premature release would bypass remaining gates.

