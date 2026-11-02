# November 2 targeting, displacement and Requirements continuation

Status: source implemented, independently reviewed and fully verified locally. Exact-head remote CI pending. Not live. No hosted database/content/player/history mutation, migration or deployment.

## Recovery and scope

Restored all 33 exact handover files with manifest SHA-256 verification on isolated branch `agent/target-range-glow-handover`, based on freshly cloned main `1e4217223714e961ca9ed2148504d575681469da`. Existing production is PR #1005, not this source. Git deployment lock remains `"**": false`.

The combined diff implements legal-aim/All click/tile tint/Move feedback, pinned current displacement origins with historical compatibility, first-Ground-card control containment, automatic target selector simplification, and the latest Requirements category/event/report request. Existing runtime fields and event IDs are reused; no stored schema additions for Requirements. Saved combined predicates are visible and literal until the author explicitly changes categories or removes a retained predicate.

## Verification map

- Engine/displacement/history/reload and cooldown ownership: focused game-core regressions, full final game-core suite and types.
- Shared authoring/preview/controller readers: focused native-control tests, all combat-content editor tests, simple requirement/history readers, battle selected Skills/captured cooldowns and server admission guards.
- Real production component browser fixtures: full targeting script including desktop/mobile Ground containment and Requirements preview; full canonical targeting/Move suite for PvE/PvP; Support desktop/mobile/PvE/PvP/spectator suite with actual canonical owner-turn cooldown progression and serialized reload.
- Broad final gate: `pnpm check` (format, lint, types, tests, production build). Existing remote workflows and database authority/native suites remain required on the exact published head; local fixtures do not replace them.
- Excluded from development loop: hosted data mutation, production tests/deployment, unrelated World timing repeat acceptance (#933), and repeated full suites after small edits. No release or human acceptance claim.

## Evidence so far

- Restored baseline: 42 editor/containment tests pass.
- Requirements RED: 16 failures with 37 original tests passing, before implementation.
- Requirements GREEN: 53 tests pass, including all meaningful events, explicit category transitions, legacy/default/combined definitions, canonical report and actual captured Resonance turn-start execution.
- Core focused: 100 tests / 5 files pass (displacement, All, stat admission, cooldown scope, large counters).
- Web adjacent: 1,256 tests / 74 files pass after updating the deliberately superseded event-outside-Requirements expectation. Existing tag linking, historical predicate preservation and effect-local conditions remain asserted.
- Native targeting: final 78 cases pass, including Ground containment, roundtrip and valid Requirements preview on desktop/mobile. Added validity assertion caught missing metadata in the new Requirements fixture only; corrected to canonical friendly-fire/elevation fields. Production editor validation was unchanged.
- Native canonical controller: final 30 cases pass after the review fix, including 16 targeting/All/Move glow cases and actual Self/All recoil with a legal free destination. Move-only runner: 38 cases pass on the corrected engine.
- Native Support: 18 desktop/mobile PvE/PvP/spectator cases pass. Playable cases assert real canonical cooldown counters from activation through readiness for Pilfer (1), Fleetstep (2) and Invocation (4), publishing serialized states after actual owner-turn progression. Original artwork/portrait/AP/MP/command assertions are retained before natural summon expiry.
- Full `pnpm check`: exit 0. Formatting, strict lint, all eight package typechecks, 16,045 Vitest tests / 886 files, seven Node tests and production build pass. Package counts: game-core 6,875; web 8,540; db 499; validation 107; audio 19; realtime 3; worker 2. Its first attempt caught an inherited unused `_policy` binding in the handover test; fixed without changing behavior. No earlier handover greens are treated as final.
- Native total: 164 cases pass (78 targeting, 30 canonical controller, 38 Move, 18 Support), no recorded page errors. Final fixture-only metadata correction additionally passed scoped formatting/lint. Local runtime: Node 24.22.1, available pnpm 11.25.0; source packageManager remains pnpm 11.17.0 and remote configured CI uses that pinned version.

## Review

Independent read-only review of the complete combined diff found one Important issue: a queued Self/All displacement used a radial vector after the caster walked away from the saved source. This could falsely report collision at the old cast tile. The checked-in queued Ground/Self/All matrix now covers both stationary and walked casters with changed facing and serialized reload. It failed before the fix; the 73-test All/displacement suite passes afterward. The reviewer's independent outside-checkout repro also passes. The minimal guard preserves frozen facing for Self/All while explicit Ground keeps its radial point and overlap fallback; policy-absent captures stay literal. No remaining confirmed findings or deferred minors.

Review boundaries: hosted execution, physical-device/human acceptance, full final quality and remote CI are established only by their own evidence. They are not inferred from source review.

## Remote gate selection

Source path filters select these 13 pull-request workflows (all must pass on the exact published head; this is selection, not execution evidence):

- Modular ability readers browser (`.github/workflows/ability-readers-browser.yml`)
- Browser smoke (`.github/workflows/browser-smoke.yml`)
- Shared Build Snapshots (`.github/workflows/build-snapshots.yml`)
- CI (`.github/workflows/ci.yml`)
- Controlled combat browser (`.github/workflows/combat-controlled-browser.yml`)
- Combat and mobile layout regressions (`.github/workflows/combat-mobile-regressions.yml`)
- Desktop experience (`.github/workflows/desktop-experience.yml`)
- Desktop page fit (`.github/workflows/desktop-page-fit.yml`)
- Essence Build (`.github/workflows/essence-build.yml`)
- Living Atlas browser (`.github/workflows/living-atlas-browser.yml`)
- UI layout review (`.github/workflows/profile-layout-review.yml`)
- Representative Buildcraft (`.github/workflows/representative-buildcraft.yml`)
- Skill Engine (`.github/workflows/skill-engine.yml`)

Browser Smoke and central CI select broad/full coverage because this batch spans shared combat, server admissions and shared readers. Other workflows without matching changed paths are not silently represented as executed. No reruns or repeated within-run CI polling. Fresh-main finalization read still matches the handover base `1e4217223714e961ca9ed2148504d575681469da`; no reconciliation was needed.

## PR #1006 reader-browser CI follow-up

On head `5fa42c6fa24eefd2b1e4b0877e4af329bb1cf05b`, the one connected-GitHub preflight found eleven workflows successful, Modular ability readers failed and Browser smoke still running. Failed run `41524771474`, job `125549560166`, reached the simple-Requirements browser step after the preceding reader/native steps passed. Its line444 assertion searched for the removed `requirements-met` event selector; the approved editor now correctly starts that saved definition in Prerequisite tags mode. The exact failure reproduced locally before any edit.

Correction changes only `apps/web/scripts/browser-simple-requirements-regression.mjs` and task records. Navigate the real Requirements category control, assert both redundant event choices are absent, save/reload a pure event and verify its canonical Requirements line in Nexus/Battle/Resonance readers. Seed a genuine historical event-plus-predicate definition, prove opening and unrelated effect edits preserve it, and keep the existing usage-limit, linked-tag, Conditional Cleanse, JSON reload, geometry, targeting and invalid-draft guards. Explicit event changes still test compatible target-rule/predicate rebinding while Requirement target stays hidden. No production or workflow code changes and no test skips, retries or loosened timeout/viewport thresholds.

Fresh local evidence: full simple-Requirements native suite34/34 pass at1366×768 and390×844 with no browser errors; fixture production compilation275modules passes with its existing no-process-environment check; scoped Prettier, strict ESLint and `git diff --check` pass. The prior full `pnpm check`/164 native-case evidence remains application-source evidence; it is not relabelled as a new execution. A tests-only correction does not rerun unrelated database/gameplay suites locally under change-scoped verification; all applicable remote workflows must still pass on the new exact head. No CI job rerun or repeated within-run polling; the source update starts ordinary PR checks. No deployment/merge or hosted data change.
