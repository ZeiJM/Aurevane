# Skill requirement scope and Field Remedy recovery

Status: local candidate, not published. The October 29 Owner clarification makes the Requirements row describe the whole Skill. Field Remedy's HP Recovery has no additional prerequisite; recovery still respects maximum HP.

## Cause and bounded change

Field Remedy v7 has `behavior.requirements: null`. Its second canonical effect, HP Recovery, has an Any-of-nine status predicate. `combat-modifier-composition.ts` captures effect eligibility from the command's input state before execution. Cleanse then removes the affliction, and the captured eligibility decides whether recovery executes. This is an intentional historical rule, not a post-Cleanse reevaluation defect.

The new one-record candidate appends v8, removes only that effect-local predicate, and updates its flavor sentence. Canonical Cleanse remains first, followed by one 9% maximum-HP recovery application. Self target, 45 AP / 4 MP cost, three owner-turn cooldown, magnitude, timing, and all other definition fields remain unchanged. Wounded users recover with no removable status; a full-HP user still cleanses and pays normally, without exceeding maximum HP. Existing v7 captures retain the prior gate.

The frozen October 10 proposal and `roster-defensive-reserves.test.ts` intentionally exercise historical definitions. They are unchanged. Published catalogue entries override builtin definitions, so a builtin edit would not update current hosted Field Remedy.

## Complete frozen publication-source audit

The audit overlays the October 18 catalogue, October 19 identity/modularity/simple-requirement versions, and October 22 trigger/quality/readiness publications. Their exact source-file hashes are stored in the new candidate. This reconstructs 294 definitions: 15 effect-local gates across 12 Skills and three Essences; zero Resonances. This is repository release evidence, not a fresh read of the live catalogue. Owner edits since publication require a fresh live audit before release.

| Definition          | Conditional effect | Existing effect-local predicate                  | Decision                  |
| ------------------- | ------------------ | ------------------------------------------------ | ------------------------- |
| Field Remedy        | HP Recovery        | Self has one of the nine removable afflictions   | Remove in v8              |
| Execution Cut       | Extra damage       | Target has Vulnerable (`exposed`)                | Preserve effect condition |
| Stalwart Strike     | Extra damage       | Self has Fortified                               | Preserve effect condition |
| Desperate Execution | Extra damage       | Self has Reckless                                | Preserve effect condition |
| Open Wound          | Bleed              | Target has Bleed                                 | Preserve effect condition |
| Pursuit Shot        | Extra damage       | Target has Marked                                | Preserve effect condition |
| Close Quarry        | Resource change    | Target has Marked                                | Preserve effect condition |
| Scorch              | Extra damage       | Target has Burn                                  | Preserve effect condition |
| Shatter             | Extra damage       | Target has Chilled (`frozen`)                    | Preserve effect condition |
| Brittle Ice         | Apply status       | Target has Chilled (`frozen`)                    | Preserve effect condition |
| Conductive Bolt     | Extra damage       | Target has Conductive                            | Preserve effect condition |
| Crushing Wave       | Displacement       | Target has Drenched (`wet`)                      | Preserve effect condition |
| Aether Nova         | Extra damage       | Self MP is more than 75%                         | Preserve effect condition |
| Deadeye Barrage     | Extra damage       | Target has Marked                                | Preserve effect condition |
| Dawn's Oath         | HP Recovery        | Target has one of the nine removable afflictions | Preserve effect condition |

Execution Cut additionally requires Target HP below 35% for the whole Skill; Desperate Execution additionally requires Self HP below 35%. The other listed definitions have no overall requirement in this frozen catalogue. Moving a conditional bonus to the whole Skill would block previously legal base casts. Removing it would grant previously conditional effects on every cast. Neither semantic change is included here. The reader can present these conditions with their Effects while reserving Requirements for overall Skill eligibility. Historical and existing effect-local fields must remain executable and preserved during unrelated edits.

The shared `AbilityEffectEditor` currently exposes effect target and payload controls, with no visible effect requirement editor. Its `rebindSimpleEffectRequirement` helper still protects executable subject binding when existing gated effects are retargeted; removing that compatibility path is outside this change.

## Publication contract

The deterministic offline producer is `scripts/prepare-field-remedy-recovery.py`. The reviewable full before/after payload, hashes, source manifest hashes, and complete audit are in `release-assets/2026-10-29-field-remedy-recovery-candidate.json`. Re-running preparation does not modify source manifests or contact a service.

Before publishing, root must refresh the complete live catalogue, target history maximum, drafts and policy. Match Field Remedy's complete current JSON to candidate `before` and its hash, current version 7, and highest historical version 7. Any Owner edit, version collision or new draft requires review; do not overwrite or recycle a version. Audit any live gates absent from this frozen inventory.

Use the existing catalogue transaction/CAS lock `app_private.lock_combat_content_catalogue_v1(freshToken)` and protected `app_private.publish_combat_content_with_floor_v1(actor,'wildwarden.field-remedy','skill',after,7,7)`. Preserve all prior immutable history, every other publication, timing policy and draft state. Compare the returned full JSON to candidate `after`, version 8, and verify exactly one appended history row. Compare full private and public catalogue readback. An already-current exact v8 payload is a successful no-op on a fresh retry; any differing v8 must fail. Do not reuse a stale catalogue token or apply an automatic retry after an ambiguous response without readback.

A rollback restores the prior current pointer using the established reviewed rollback path; it retains v8 history and any saved v8 captures. No engine compatibility rollback or historical JSON mutation is appropriate.

## Verification

- 16 new real-command regressions cover exact append-only payload scope, absent/positive/non-removable afflictions, all nine removable statuses, capped/full HP, costs, cooldown, JSON restoration and historical v7 recovery behavior.
- 26 existing historical defensive reserve regressions remain unchanged and pass.
- Three offline preparation tests verify reproducibility, exact field-level scope, rejection of a changed baseline gate, and complete audit counts.
- No production write, migration, full-suite run or browser test was performed by this workstream. Root owns the combined reader checks, release checks, fresh live inventory and publication.
