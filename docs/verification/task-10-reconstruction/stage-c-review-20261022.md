# Task 10 Stage C combined source review — 2026-10-22

**Spec compliance: Issues found.** Three Important findings prevent acceptance of the Stage C source gate. **Task code quality: Needs fixes.** There are no Critical findings. One additional functional Minor finding and one inherited tooling warning are recorded below.

Review scope: the four-commit package `/workspace/scratch/e5db2ba73c1a/master-c-review-a94204d-a580fd7.diff`, BASE `a94204dce37bc585d2bc57a3712f4255c7f98e37`, HEAD `a580fd7263ac253570440d488fcf08b98267ba6c`. The Stage C brief and implementer report were read, and the combined task-reviewer process was applied. Accepted A/B and fix4 work was not reopened. Stage D shell/Tag Library work and Tasks 11–13 remain staged. Cumulative Task 10 fix rounds remain 4/5 used.

The checkout was read-only. No tracked file, index, HEAD, branch, or hosted state was changed. No helpers or additional reviewers were used. All source hunks were inspected in the supplied package, with the bounded interface checks listed below. No reported test suite was rerun.

## Important findings

### I1 — New Tag publication constraints also reject previously accepted retained drafts

**Location:** `packages/game-core/src/content/authored-content.ts:300`; retained entry point `:163–167`, original retained text envelope `:197–201`; new restrictions in `packages/game-core/src/combat/combat-tag-registry.ts:690` and `:703`. Actual category retained adapter: `apps/web/src/server/combat/combat-content-categories.ts:176`.

The unconditional `captureCombatTagPresentation(...)` call executes for both authoring and retained reads. Previously accepted Tag records allow a stable record ID independent of `tagId` and descriptions up to 4000 characters. The new presentation snapshot requires `id === tag.${tagId}` and a description of at most 240 characters. For example, an otherwise valid retained `tag.damage` draft with a 241-character description is now rejected; historical UUID-keyed Tag drafts are also rejected even with short descriptions.

This is a read compatibility regression, not merely stricter readiness for new publication. It defeats the retained parser's explicit purpose of allowing old records to be read and corrected, and violates the requirement to preserve stored envelopes. It also prevents the normal correction workflow from obtaining the old record through its category adapter.

**Requested repair:** preserve the previously accepted retained Tag identity/text envelope. Apply the new canonical snapshot restrictions at the appropriate authoring/publication boundary, with an explicit compatible path for older drafts. Add controls for retained long text/noncanonical record IDs and new-publication rejection.

**Corroboration:** after this source finding was established, root supplied exact-C native quality job `120129353276`: `src/content/authored-content.test.ts > round-trips finite tag drafts independently and returns a specific runtime blocker` fails with `TypeError: Invalid canonical Tag presentation`; game-core reports 5507 passed / 1 failed. This observation was supplied by root, not independently rerun here.

### I2 — The actual record-creation producer cannot create any canonical Tag

**Location:** new canonical identity requirement `packages/game-core/src/combat/combat-tag-registry.ts:690`, invoked by `packages/game-core/src/content/authored-content.ts:300`; existing production producer `apps/web/src/server/master/combat-content-record-command.ts:105–114`.

The real `create` command always assigns `${contentKind}.${requestUUID}` and overwrites the submitted `id` before calling the category's authoring validator. Thus a Tag create becomes `tag.<UUID>`, while C's validator requires `tag.damage`, `tag.healing`, etc. No valid operation UUID can satisfy that rule. The command fails before `store.writeRecord`; supplying a canonical ID in the request cannot help because it is overwritten.

C removes Tag's publication blocker and supplies current/exact consumers, but the actual application producer cannot bootstrap a Tag record. The SQL test uses `tag.damage` directly (`packages/db/src/combat-content-media.test.ts:216`), bypassing this production command and therefore does not cover the failure. Stage D owning the finished Tag UI does not resolve this C producer-contract incompatibility.

**Requested repair:** provide the canonical Tag creation/bootstrap contract through the actual record command/API, preserving authorization, stable identity, concurrency, and retry semantics. Make unsupported duplicate behavior explicit if canonical identity allows only one record per implemented Tag. Cover creation and subsequent publication/current/exact reads through the real command boundary, rather than only direct SQL calls.

### I3 — Percentage-based Barrier values are exposed as power

**Location:** `packages/game-core/src/combat/battle-narration.ts:355–356`.

`abilityPresentationValues` treats every `barrier-change` amount as `power`, without checking `basis`. The existing canonical payload supports `basis: 'maximum-hp-percent'`, validated as a percentage from 1 to 100 (`packages/game-core/src/combat/combat-tag-registry.ts:553–554`). A Barrier configured for 75% maximum HP produces `{ '0.power': 75 }`, and no percentage reference. Insert Reference consequently offers and validates the wrong value type for a real supported mechanic.

This conflicts with the explicit requirement that percentages and the relative power scale remain different value types. The rendered wording can present a percentage as damage-scale power; the defect is in typed value extraction, independent of arbitrary English supplied by an author.

**Requested repair:** discriminate Barrier values by their actual basis and expose percentage versus power under the corresponding reference type. Add controls for both supported Barrier bases and ensure the inappropriate reference is unavailable for each.

**Focused evidence:** the probe described below evaluated the actual new authority and returned `percentBarrierValues: { "0.power": 75 }` for a percentage-based Barrier payload.

## Minor findings

### M1 — HP percentage recovery lacks its available actual-healing result reference

**Location:** `packages/game-core/src/combat/battle-narration.ts:392` (result outcome selection).

Result choices recognize `healing`, but do not recognize `percentage-recovery` with `resource: 'hp'`. The real Basic recovery adapter converts that supported HP recovery into healing (`packages/game-core/src/combat/combat-basic-actions.ts:622–629`), and the new Chronicle result renderer consumes recorded `healing_applied` receipts. Nevertheless a valid HP recovery definition gets `outcomes: []`; a result template using `{outcome.healing}` is rejected as `presentation.result`.

**Requested repair:** expose actual healing for supported HP recovery result contexts, while continuing to exclude it for MP recovery and activation fields. Cover the HP/MP distinction and a real recorded healing receipt. This is a missing new presentation capability; it does not change recovery mechanics.

### M2 — Existing Vite configuration warning remains in covering evidence (nonblocking, inherited)

**Location:** `apps/web/vitest.config.ts:1`, as reported by `docs/verification/task-10-reconstruction/c-final-web-covering.log.gz`.

The log warns that ESM syntax in a CommonJS-loaded configuration is unsupported by the proposed future native config loader. This configuration is not changed by the C diff. The warning did not fail the reported 273-test run and is not a new C source defect; retain it for normal tooling maintenance. No warning suppression is recommended as a repair.

## Strengths established by source inspection

- `apps/web/src/server/master/combat-content-media-handler.ts:32` authorizes before consuming the upload body, and `:79` compares the returned finalized descriptor with the independently normalized descriptor. The normalizer decodes actual image/audio bytes, derives hashes and dimensions/duration, and rejects malformed formats rather than trusting a label or URL.
- `packages/db/src/combat-content-media.test.ts:133` exercises actual finalization, saved records, publication, and exact reads beyond the three-version display window. The media migration retains physical version references and immutable bytes, with selected-actor RPC assertions, private table RLS/ACLs, and immutable-reference guards.
- `apps/web/src/server/combat/combat-content-resolver.ts:819–825` separates current Tag binding from standalone exact reads and frozen admission binding. The admission test exercises current Tag changes through the actual capture producer while asserting that old serialized captures remain unchanged.
- `apps/web/src/server/battle/battle-session-service.ts:501` keeps the fully composed battle envelope behind the shared recursive public projection. The added projection controls cover nested accuracy fields while retaining public numeric stats and limiting captured Tag wording to the controlled owner.
- Existing media hook choices remain available; finalized audio is carried by committed events and immutable captured sources. No unrelated damage formula, resource economy, roster balance, or deployment-lock change appears in the supplied C diff.

## Evidence reviewed

All **82 appended verification rows** were parsed and their committed gzip file SHA256 values checked; all 82 matched. Compressed log contents were inspected for actual outcomes rather than inferring success from names. Earlier failed tests, missing-module/fixture attempts, and type/lint failures remain visible; later covering evidence does not erase them.

Observed successful logs include:

| Committed raw log | Observed result |
| --- | --- |
| `c-references-green.log.gz` | 30 tests / 3 files passed |
| `c-reference-controls-green.log.gz` | 3 tests / 1 file passed |
| `c-media-authoring-green.log.gz` | 105 tests / 2 files passed |
| `c-media-sql-covering.log.gz` | 43 tests / 2 files passed |
| `c-media-readers-green.log.gz` | 42 tests / 6 files passed |
| `c-media-core-covering.log.gz` | 140 tests / 7 files passed |
| `c-text-tag-core-covering.log.gz` | 209 tests / 10 files passed |
| `c-tag-admission-fixture-fixed.log.gz` | 17 tests / 2 files passed |
| `c-final-tag-sql.log.gz` | 10 tests / 1 file passed |
| `c-final-captured-audio-fixed.log.gz` | 11 tests / 1 file passed |
| `c-final-web-covering.log.gz` | 273 tests / 13 files passed |
| `c-final-types-fixed.log.gz` | game-core, db, and web typechecks completed |
| `c-final-lint-fixed-{web,game-core,db}.log.gz` | exit 0 in the recorded scoped commands |
| `c-final-format.log.gz` | all matched files use Prettier style |
| `c-browser-discovery.log.gz` | one test discovered; no browser execution claimed |

Exact argv, working directories, timestamps, exits, and hashes remain in the appended `docs/verification/task-10-reconstruction/verification.jsonl` entries. The underlying tests are useful but miss the real Tag creation command and retained Tag regression identified above.

## Bounded checks outside the diff

1. **Retained parser compatibility risk:** inspected the retained/authoring entry points and their unchanged text limits in `authored-content.ts`, plus the existing narration validation caller context. This confirmed I1. The unrelated hypothesis that the new legacy result-template sanitation necessarily changed `battleFlavorTemplateIssues` was not promoted to a finding.
2. **Typed result/value producer risk:** inspected the existing Barrier validator and the Basic HP/MP recovery conversion. This confirmed the supported percentage Barrier basis and the actual HP healing conversion; it did not investigate unrelated combat formulas.
3. **Canonical Tag producer-contract risk:** inspected the actual record command's create/validate sequence after root relayed the same interface concern from Stage D discovery. This confirmed I2 without relying on a speculative UI flow.

One focused, read-only authority probe addressed the remaining value/context doubt. It loaded the actual `battle-narration.ts`, stripped TypeScript using Node's built-in `stripTypeScriptTypes`, and evaluated the exported value/context functions. Only the unrelated pronoun preset import was stubbed; no identity rendering or complete battle execution was claimed. The inputs were a `barrier-change` payload with `basis: 'maximum-hp-percent', amount: 75`, and an HP `percentage-recovery` payload with `percentageBasisPoints: 2500` and result text `{ability} restores {outcome.healing} HP.`. Output was:

```json
{
  "percentBarrierValues": { "0.power": 75 },
  "hpRecoveryContext": {
    "field": "result",
    "triggeringActor": false,
    "values": { "0.percentage": 25 },
    "affectedTargets": true,
    "outcomes": []
  },
  "hpRecoveryTextIssues": ["presentation.result"]
}
```

The first launch attempted to use a root `node_modules/typescript` package and exited 1 because it was absent; the corrected built-in Node probe exited 0. Neither launch wrote files or reran a suite. Node emitted its standard experimental type-stripping warning, which is a limitation of this isolated diagnostic, not a project regression.

## Cannot verify / root acceptance items

- This is a source gate, not completed native/browser/hosted acceptance. Actual browser crop/audio playback and the full native media/Tag lifecycle remain separate gates. Discovery is not execution.
- Root supplied exact-C Database foundation job `120129353597` as successful, including the full migration chain, extended ACL, Players/Event checks, and physical locks. This reviewer did not independently execute or inspect that native job's full output.
- Root supplied modular-readers workflow `39866338564`, job `120129354088`: current/pinned readers, real Basic Restore, and Primed 6 pass, but the standalone simple-Requirements harness times out at `browser-simple-requirements-regression.mjs:90` while awaiting initial `window.simpleRequirements` bootstrap, with zero cases completed. The same workflow reportedly passed B. The retained artifact lacks a captured page error establishing a C cause; root's local browser diagnostic was blocked by runtime socket/ptrace permissions. **This remains an unresolved native regression for root diagnosis and is not waived.** No invented source cause or unrelated fix is proposed here.
- Hosted compatibility and deeper historical deployment state were not exercised. Native lifecycle harness staging to Task 13 and the final Stage D editor/shell remain explicit cross-task obligations; this review does not declare them complete.

**Final disposition:** fix I1–I3, address or explicitly disposition M1, and obtain a scoped same-seat re-review. Keep the independent unresolved native bootstrap gate open. Stage C source approval and subsequent acceptance are not granted by this report.
