# Damage Up scope verification

Status: implemented on `agent/damage-up-types-20261104`, stacked on Seal head `8305ef5645163ef2ef06eb800fcb3cca5b1d475c`; not live. Owner approved the multi-selection design and one coordinated Seal/Damage Up production release after combined verification.

## Delivered behavior

All Damage remains the default when optional damageTypes is absent. A distinct nonempty selection of Pierce, Fire, Water, Ice and Storm shares one percentage; overlapping identities match once. Timed Damage Up, manual/automatic command modifiers and ongoing modifiers use one packet matcher. Canonical Pierce is recognized by its real barrier-shatter identity as well as retained piercing hits, without changing either path’s mitigation/critical rules. Legacy scalar elementFilter remains readable. Other statuses and conflicting/invalid scope metadata are rejected.

Selected scope travels through ordinary status application/copy/stacking/strength capture and JSON reload. The existing direct-damage rounding boundary owns settlement; captured Burn/Poison/Bleed ticks are not re-amplified. Shared timed/canonical editors use the same multi-selection control; compact/full reports, active per-application descriptions and Chronicle retain scope. The active reader explicitly clears inherited scope for an older unrestricted application.

## Focused evidence

Initial real-battle scope tests were RED (missing scope capture/packet filtering), then GREEN. The canonical Pierce test exposed its distinct shattersBarrier marker and passed after the packet identity correction; defense rules were not changed. A native compact-reader check exposed percentage-only extraction dropping scope and passed after retaining the selected types. A stacked-reader regression was observed RED then GREEN, protecting an old unrestricted application beside a newer restricted one.

50 core scope/element-filter tests pass: all 32 scope choices, actual damage_applied outcomes, overlap, original-state preservation, JSON reload, canonical manual/automatic/ongoing modifiers, canonical Pierce, malformed metadata, stacked different percentages/scopes, actual Copy Buffs, normal Dispel/expiry, real next-round resolution and a captured Burn tick. Adjacent core capture/composition/copy coverage was also exercised. 59 focused web tests pass, including five new authoring/active-reader cases, retained Fire scalar controls and existing shared reader regressions. All eight package typechecks passed at the initial checkpoint; final broad verification remains required below.

The native fixture uses actual production editors/readers and the actual combat executor. For both timed and modifier forms it selects all 32 scopes, saves/reloads local fixture storage, resolves Fire/Water/Ice/Storm/untyped/Pierce hits and asserts exact 12-or-10 outcomes from a 20% buff. This is a local real-component/kernel test, not a hosted Commit Now or authenticated live encounter. All 192 editor/scope/reload/battle cases pass across desktop/laptop/phone, with empty selections rejected and no runtime errors.

## Remaining release gates

Final pnpm check, one independent whole-branch review and configured exact-head remote CI remain required. Git automatic deployments are disabled. The Owner authorized a coordinated release with Seal, including only its additive registration migration; no hosted change has yet occurred for either tag. No broad content republication, historical capture rewrite, inventory mutation or human acceptance claim. Prior Items release remains live.

## Independent review corrections

One independent whole-branch review found three Important issues. All were reproduced with real adapters/execution and corrected in one pass: private Ground areas now capture, validate and replay cast-time command Damage Up bonuses (historical absent fields stay absent); scoped active numeric facts report each application’s actual scope rather than multiplying unrelated scopes into one total; filtered viewer projections clear optional scope/category tuning before restoring the surviving public application, preventing concealed scope inheritance. Ground placement, JSON reload, later pulses and forged persisted scope are covered. The existing unscoped strength aggregate remains unchanged. The native script now also resolves and asserts the exact kernel outcome after each reload, alongside the pre-save check. No review finding was deferred.

Post-correction focused results: 161 core scope/Ground/contact/runtime tests and 65 web strength/projection/authoring tests pass. The full combat suite passes 7,121 tests. Final broad application/database tests, refreshed lint/types/build and exact-head CI remain open at this checkpoint. One parallel local lint attempt exited 137 under the 8 GiB worker memory limit; it is not recorded as a lint pass. The pnpm check wrapper stalled before its first subcommand, so the same configured format/lint/types/test/build stages are being run explicitly, with telemetry disabled and heavy retries sequenced.

The final native rerun passes all 192 cases with exact battle outcomes asserted both before save and after reload (384 kernel resolutions), zero runtime errors and unchanged overflow assertions. Refreshed all-eight-package typecheck passes. Current main was freshly read as `121297dc4a0d564fac7348e6c9f999dff7efc53e`, and Seal remains at the exact dependency head `8305ef5645163ef2ef06eb800fcb3cca5b1d475c`; no concurrent source was overwritten.
