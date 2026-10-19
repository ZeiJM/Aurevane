# Blindside facing correction — independent combined review

Reviewed BASE `16838f0cb1fb23ea791f3e5734b1f90c9fd64532` to HEAD `d0ce2a020138f902283482eee908d7dc860e8368` in `/workspace/scratch/081f137b6a6d/aurevane-blindside-20261019`.

## Strengths

- The runtime change is narrow: it extracts the existing caster qualification predicate and applies it separately to each enemy Blindside recipient. A flanked area target cannot authorize a front-facing target.
- The gate runs before application or pending scheduling and skips requalification on pending activation. Copy uses its existing separate path; absent-policy captures retain their previous behavior. Ordinary damage, costs and publications are untouched.
- Regression witnesses cover front/side/rear forecast and settlement, front reapplication, mixed area recipients, a missed area flank, and real published Flanking Cut through attached Move. The recorded BASE reversion gives five expected failures.
- Product/test blob hashes match `verification.json`. The supplied complete quality receipt reports 10,243 Vitest tests, seven Node checks, formatting/lint, eight package typechecks and two builds. I did not repeat those passing suites.

## Issues

### Critical

None found.

### Important — damage eligibility is omitted from the qualifying-hit predicate

**Location:** `packages/game-core/src/combat/actions-legacy.ts:3847-3861`, used for enemy application at line 3950.

The helper resolves the authored damage recipients, but never checks `action.effectEligibleRecipientIds[hitOrdinal]`. Actual damage settlement does honor that mask. Consequently an eligible enemy Blindside tag can apply even when per-effect requirements exclude the enemy from the action's only damage effect: there is no qualifying hit.

This is a supported production input, not an arbitrary malformed state. `combat-modifier-composition.ts:117-167` derives eligibility independently for each authored effect's requirements, and the public `actions.ts` execution path retains those masks into legacy settlement. An external focused probe through public `executeCombatAction` with `[undefined, []]` eligibility for Blindside and damage respectively produced zero `damage_applied` events and one `status_applied` event on a rear-facing enemy. The direct legacy probe reproduces the same result.

**Impact:** A cast can grant/refresh Blindside and its subsequent damage benefit without landing any eligible damage on that enemy. This violates the successful qualifying side/rear-hit rule that the new predicate is intended to enforce.

**Prior-state distinction:** The original caster predicate already omitted this check, and enemy Blindside previously had no facing qualification at all. This is a retained qualification gap exposed by reuse, not a claim that this diff newly introduced excluded-hit behavior. It is nevertheless inside the newly authoritative enemy qualification boundary.

**Fix:** Reject a candidate damage hit when its eligibility list is defined and does not contain that target. Add a focused public-execution regression for excluded-only damage, retaining a witness where another genuinely eligible hit qualifies. Preserve absent-policy and pending/copy behavior.

### Minor — attached Move witness does not distinguish the starting and reached facing relation

**Location:** `packages/game-core/src/combat/modular-correction-interactions.test.ts:241-255`.

The actor moves from `(0,1)` to `(1,1)` while the enemy remains at `(2,1)`. Both positions lie in the same facing sector for every matrix row. This correctly checks that a real attached Move occurs, but would also pass if qualification incorrectly read the pre-Move actor position.

**Impact/fix:** The reached-position requirement lacks a discriminating regression witness. Add a legal path whose start and reached position classify differently, and assert the reached result (ideally in forecast and commit). Source inspection shows the current helper reads `nextState` placements; this is a test-strength issue, not a demonstrated movement bug.

## Considered and rejected suspicion

An artificial direct call supplying only `missedEffectOrdinalsByTarget` can also apply Blindside without damage. Do not count that as a production packet-miss finding: `rollSkillPacketOutcomes` mirrors real packet accuracy misses into `resistedEffectOrdinalsByTarget` (`combat-skill-packets.ts:103-116`), which this helper already checks. A public repeated-damage-packet probe did not reproduce a grant with all damage missed. No change to packet-miss semantics is requested.

## Validation performed during review

- Read the supplied diff once; followed only named concerns into effect settlement, modifier eligibility and packet miss mapping.
- Checked clean working tree and exact HEAD; independently matched all three product/test hashes to the verification manifest.
- Ran only the new external mask probes at `/workspace/scratch/081f137b6a6d/blindside-evidence/packet-probe.test.ts` with external config. Final result: four probes, two eligibility failures demonstrating the Important issue, one artificial missed-only-map failure rejected as production evidence, and one passing public packet-miss exploration. Receipt: `packet-probe.log`.
- No checkout, product file, index, HEAD or branch mutation; no subagents and no passing-suite reruns.

## Declined to judge

- Hosted/browser/human gameplay and deployed release identity: not exercised in this read-only source review; the supplied report explicitly leaves exact-source CI and release verification pending.
- Wider Master Panel/Staff behavior and release acceptance: outside this isolated Blindside change; no conclusions drawn about that work.

## Assessment

**Spec compliance:** The reported head-on application/refresh bug is corrected, side/rear and per-recipient behavior are preserved, and the implementation stays isolated. The qualifying-hit contract remains incomplete for damage excluded by per-effect requirements.

**Code quality verdict / ready to merge:** **With fixes.** Repair the damage eligibility omission before release. The architecture and scope are sound; the Minor is a useful regression improvement, not evidence of another runtime defect. Blindside should be verified and released before wider Master Panel work resumes, as directed; this review makes no live-release claim.

## Scoped rereview — Important finding addressed

Reviewed only the runtime/test delta against `d0ce2a020138f902283482eee908d7dc860e8368` and the provided `review-fix-red-valid.log` / `review-fix-green.log`; no broader review or test rerun.

The candidate now rejects a qualifying damage hit when that damage ordinal has a defined eligibility list excluding the target (`actions-legacy.ts:3858-3859`). Undefined eligibility remains unrestricted, and the search can still find another eligible damage effect. This closes the demonstrated qualification gap without modifying packet misses, pending/copy gates or absent-policy behavior.

The new public-execution regression uses `[undefined, []]` and asserts no damage, no status application and no enemy status. The valid RED receipt fails on the erroneous status application; the supplied focused GREEN receipt passes all 52 tests across the two relevant files.

**Scoped verdict:** The Important finding is addressed. **Ready to merge from this review: Yes**, subject to the executor's required final quality/release checks. The original Minor about a discriminating reached-position test remains deferred and is not a runtime blocker. No new issue found in this scoped delta; no deployment or hosted acceptance claim is made.
