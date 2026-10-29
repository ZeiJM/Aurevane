# Skill requirement scope and capped recovery audit

Status: reviewed local two-record candidate, not published. The October 29 Owner clarification makes the Requirements row describe the whole Skill and authorizes correcting Field Remedy and genuinely similar recovery eligibility in this batch. Field Remedy and Dawn’s Oath both recover HP without an affliction after publication; ordinary resource maxima still cap recovery. Meaningful whole-Skill thresholds, passive setup/trigger requirements and conditional combat bonuses remain authoritative.

## Fresh live inventory and bounded decisions

A read-only Supabase query against `luazfeupwfgnilohfsya` at **2026-10-29 08:22:12.286018 UTC** inspected every current published definition, not only frozen repository proposals: **298 publications = 141 Skills (including Basics), 18 Essences, 136 Resonances and 3 Disciplines**. All **295 Skill/Essence/Resonance definitions** were scanned. The private store had **1,271 immutable versions, 363 records and one unrelated New Essence draft**, `essence.4bee1f71-3123-4e0f-8eec-3cc48c1a832a`, draft version 1. Preserve that draft exactly. The draft is not an additional published ability.

The complete inventory, all 15 effect-local gates, every recovery/resource payload and both exact target definitions are captured in `release-assets/2026-10-29-recovery-live-audit.json`. Across the catalogue, 107 recovery/resource effects occur in 101 definitions. Excluding negative resource drains leaves **89 positive recovery effects in 85 definitions**: 36 Skill, seven Essence and 46 Resonance effects. Of those, 22 have neither an overall nor effect-local predicate, 64 have meaningful behavior-level eligibility, and three have effect-local gates. The three are Field Remedy HP Recovery, Dawn’s Oath HP Recovery and Close Quarry’s marked-target MP bonus. Only the first two match the requested unconditional capped recovery correction.

| Definition          | Conditional effect          | Existing effect-local predicate                     | Decision                               |
| ------------------- | --------------------------- | --------------------------------------------------- | -------------------------------------- |
| Field Remedy v7     | HP Recovery, 9% maximum HP  | Self has any of nine affliction tags                | Remove in v8                           |
| Dawn’s Oath v7      | HP Recovery, 14% maximum HP | Selected friendly has the same nine affliction tags | Remove in v8                           |
| Execution Cut       | Extra damage                | Target has Vulnerable (`exposed`)                   | Retain conditional bonus               |
| Stalwart Strike     | Extra damage                | Self has Fortified                                  | Retain conditional bonus               |
| Desperate Execution | Extra damage                | Self has Reckless                                   | Retain conditional bonus               |
| Open Wound          | Bleed                       | Target has Bleed                                    | Retain conditional bonus               |
| Pursuit Shot        | Extra damage                | Target has Marked                                   | Retain conditional bonus               |
| Close Quarry        | +3 MP                       | Target has Marked                                   | Retain reward for marked-target attack |
| Scorch              | Extra damage                | Target has Burn                                     | Retain conditional bonus               |
| Shatter             | Extra damage                | Target has Chilled (`frozen`)                       | Retain conditional bonus               |
| Brittle Ice         | Vulnerable                  | Target has Chilled (`frozen`)                       | Retain conditional bonus               |
| Conductive Bolt     | Extra damage                | Target has Conductive                               | Retain conditional bonus               |
| Crushing Wave       | Push                        | Target has Drenched (`wet`)                         | Retain conditional bonus               |
| Aether Nova         | Extra damage                | Self MP more than 75%                               | Retain conditional bonus               |
| Deadeye Barrage     | Extra damage                | Target has Marked                                   | Retain conditional bonus               |

The live inventory contains **12 Skill gates, three Essence gates and zero Resonance effect-local gates**. The batch removes one Skill gate and one Essence gate, retaining the other 13. Dawn’s Oath is an Essence but uses the same castable Skill grammar and the same unnecessary affliction-only recovery gate. Its Cleanse, target, Guard application, recovery amount, timing, cost and cooldown remain unchanged. Its legacy embedded `skill.contentVersion` must advance with the top-level immutable version: the actual database producer rejects an Essence whose embedded Skill version disagrees with its publication version. Legacy payload amounts are otherwise preserved; canonical ability payloads remain combat authority.

Keep meaningful whole-Skill recovery requirements: Channel (Self MP <50%), HP/MP Recovery (corresponding resource <100%), Hold Fast (Self HP <60%), Stolen Moment (Target Slow), Banked Embers (Self MP <30%), Last Light (Target HP <25%), Last Bastion (Self HP <40%), Runic Overdrive (Self MP >30%), Focus Breath (Self HP <70%), Last Stand (Self HP <25%), Mend (Target HP <35%), Rune Guard (Self MP <50%), Storm Breath and Still Water (Self MP <40%), and Second Wind (Self HP <30%). These define tactical eligibility for the whole Skill. The 136 Resonances retain their actual automatic activation, setup/trigger requirements, limits and resource thresholds; an automatic recovery is not a freely castable recovery Skill.

Execution Cut also requires Target HP <35% overall; Desperate Execution requires Self HP <35%. Moving their extra-damage predicates into Requirements would wrongly block base casts. Removing the predicates would grant the bonuses on every cast. Neither change is authorized. Effect conditions belong with the corresponding Effects; the Requirements row reports overall eligibility.

## Root cause and exact candidate scope

Both current v7 recovery gates evaluate eligibility from the command’s input state in `combat-modifier-composition.ts`. Cleanse then resolves before the captured recovery eligibility. This is an intentional historical mechanic, not a post-Cleanse reevaluation bug. The append-only v8 definitions remove only the canonical HP Recovery effect predicate and its conditional flavor wording. Field Remedy retains Self targeting, 45 AP / 4 MP, three owner-turn cooldown and 9% HP recovery. Dawn’s Oath retains Self/Ally selection, range 3, 65 AP / 10 MP, four owner-turn cooldown, 14% HP recovery and Guard. Wounded eligible recipients recover without a status; full HP still permits normal Cleanse/Guard and costs, while recovery never exceeds maximum HP. Existing v7 captures retain gated recovery.

The frozen October 18/19/22 publication reconstruction remains 294 definitions. Both target before definitions exactly equal their fresh live v7 definitions. The deterministic producer `scripts/prepare-field-remedy-recovery.py` preserves the frozen manifest hashes, appends two records, binds the fresh audit artifact hash and records 292 frozen / 296 live unrelated current definitions. The candidate is `release-assets/2026-10-29-field-remedy-recovery-candidate.json`. The October 10 historical proposal and `roster-defensive-reserves.test.ts` stay unchanged. Published catalogue definitions override builtins, so changing a builtin alone would not correct hosted content.

## Operational publication contract

A second read-only preflight at **08:25:36.053597 UTC** found both targets active, current/max-history version 7, revision 1, draft sequence 0, floor 7, `restore_pending=false`, no target draft, and unchanged timing policy 8. This is an audit receipt, not a reusable release CAS token. Before actual publication refresh the catalogue, both exact target definitions/history maxima/records, all drafts and policy. Any new comparable gate requires review; do not overwrite an Owner change or draft.

The offline binder accepts `--live-definition` as a JSON **array of both current rows**, each carrying `content_key`, `content_version` and complete `definition`; it also requires `--catalogue-token` and `--output`. It refuses a missing target, edited before/after definition, malformed token or drifted candidate. It never connects to a service or executes SQL.

The reviewed SQL template now contains both guarded DO blocks within **one begin/commit transaction**. It acquires the supplied external `app_private.lock_combat_content_catalogue_v1(freshToken)` once; the lock remains held across both records. Each record uses a content lock and the current character-aware `public.write_combat_content_record_v1(actor,actorCharacter,key,saveCommand)` then `public.publish_saved_combat_content_v1(actor,actorCharacter,key,draftVersion,7,postSaveToken,7)`. The save uses the exact record revision; the internal post-save token is read while retaining the initial transaction lock. No external stale token is silently refreshed. Retired publish-with-floor and historical pointer-rollback APIs are not used.

Each block independently verifies exact v7 current JSON and highest historical version 7, target lifecycle/restore state and absence of a target draft. It preserves complete prior history and attribution, every unrelated publication/record/draft, all existing Owner drafts, timing policy and policy history. The permitted record transition is revision +2, draft sequence +1, floor 8, expected actor/timestamp, cleared restore metadata, one new immutable version and attribution. Private and public full-definition readback must both equal the exact reviewed v8. A second-record failure rolls back the preceding first-record append too. A fresh-token retry of either already-current exact v8 is a no-op; any divergent v8 or higher physical history fails.

A failed transaction retains all prior immutable data. After a successful publication, supported rollback means restore-to-draft and publishing a new immutable version through the current record API. Never rewrite historical rows or current pointers directly. Start a fresh battle to use the corrected captures; ongoing battles retain their recorded definitions.

## Verification

Tests were written and observed failing before the two-record expansion. The frozen target audit, binder and actual all-migrations SQL execution exposed the missing second append and the embedded Essence version requirement before publication. Focused verification covers:

- Real canonical commands for no-affliction and unrelated-status recovery, all nine historical affliction predicates, maximum/full HP caps, Self and Ally recipients, normal costs/cooldowns, serialization and preserved historical v7 behavior.
- Exact two-record payload scope, frozen-source reproducibility, fresh target equality, complete gate counts, missing-target/drift/token rejection and exact retry handling.
- Real current saved-record APIs after all repository migrations, two appends with prior history intact, unrelated draft preservation, stale CAS, version/pointer/Owner/draft conflicts, second-record atomic rollback and injected unrelated-draft mutations during either append.

Verified local commands:

- `python scripts/prepare-field-remedy-recovery.test.py`: 4 passed.
- `python scripts/prepare-field-remedy-publication.test.py`: 7 passed.
- `pnpm --filter @aurevane/game-core test src/combat/field-remedy-recovery-candidate.test.ts src/combat/roster-defensive-reserves.test.ts`: 59 passed (33 current candidate, 26 unchanged historical).
- `pnpm --filter @aurevane/db test src/field-remedy-publication.test.ts`: 11 passed with every real migration applied by the shared harness.
- Both package typechecks, focused ESLint/Prettier, Python compilation and `git diff --check`: passed.

No production write or hosted migration was performed by this workstream. Combined full-suite, browser, CI, final-source and release verification belong to the enclosing batch; this document does not claim those completed.
