# Combat release acceptance and testing handoff

PRE-RELEASE DRAFT. This combat release is not live. Source 64f82df59f3fc111e9b253960f0f0c56c5b6113a; tree 74c737fd597f2c162bce1052e99f82fb9ca5b256; reconciled main b2d275269433f69ab1824e1f4ce110f730f9aa1a. The broad browser workflow remains pending. Replace this status only after recording actual release receipts.

## Continuation checkpoint

PR [#934](https://github.com/ZeiJM/Aurevane/pull/934) is still draft. All17 other exact-head workflows pass. Browser run [39099555327](https://github.com/ZeiJM/Aurevane/actions/runs/39099555327) first job117592835414 failed only the unchanged World presence animation delta; the exact-head retry job117607870313 is running. Do not merge/deploy/publish until the required run is green and complete Edge checks are observed. The first attempt's archived log records73 focused passes and350 complete-suite passes; no combat failure remains in that attempt.

The execution environment disconnected: shell probes are unresponsive and the cloud browser explicitly returned environment_offline. Connected GitHub/Supabase/Vercel APIs remain available. Remote source64f82df5 is ahead of the inaccessible local C69 checkout by exactly the reviewed Support mode fix and signed Guard expectation. Do not mistake that stale local checkout for the release source, or claim new signed-in hosted gameplay/browser zoom/workbook edits.

The unbound [release controls](release-assets/2026-10-18-combat-release-control.json) preserve all six exact SQL migrations, ten expected function bodies/ACLs, publication and pointer rollback envelopes, rollback-only stale/permission probe, exact snapshot comparison and history-row CAS. Reconstruct the compact payload using the recorded expression and immutable manifest blob, then require the exact known751,693-byte/SHA256 publication template. These are preparation artifacts, not execution receipts. Fresh Owner/token values must never be committed to this public artifact.

## Delivered scope

Canonical Targeting, movement included in an attached Skill's authored price, all five editable Basics with restore-to-draft history, Controlled readiness, explicit modifier selection, shared authoring/player/Manual readers and the complete staged combat roster release together.

The manifest is 294 records: 136 Discipline Skills, 17 Essences, 136 pair Resonances and five retained Basics. It prepares 289 complete immutable publications. Manifest SHA256: 35bbb1f96c9ce4dc2a5e33c34bfb7ec809de865f3149746173717d2aadb1a23d. IDs, earned availability, selections and old battle captures remain intact. New encounters re-resolve current definitions for their existing selected IDs; no character/build reset or backfill is required.

Broader Master/Staff/Players/Events/Music/World/Environment and Creative Library complexity labels follow this combat release. This is not phase or whole-overhaul closure.

## Balance acceptance

One whole-branch review and its Important defensive-pacing repair are complete. All 21 explicitly deferred Minors remain, including the hardcoded Guard success notice. See the unchanged review and individual rulings in [the decision record](2026-10-18-combat-readiness-decision-record.md).

Bastion's Hold Fast and Last Bastion have separate once-per-battle reserves. Field Remedy and Dawn's Oath heal only when the actual recipient had a removable affliction at activation; the predicate is captured before Cleanse. Without one, the normal paid Cleanse/Guard cast remains legal and grants zero healing. Dawnshield's recommended kit uses its existing Judgment payoff; Purge itself is unchanged.

All 58 actual native-AI full matches finish naturally. The standard 17-class, 135-point offense40/Vitality40 matrix has a 12-round median and 9–24 range. Nine defensive mirrors across three seeds finish within24. The older class-focus25 matrix has median13 and range9–33, with all22 prior control outcomes preserved. Other legal allocations can take longer: the original Bastion Resolve40 still reaches33, and a Bastion/Lifebinder neighbor reaches25. This is not an all-pair, hosted multiplayer or human balance claim.

The kernel, roster and recommended-kit sources used in that pacing evidence are unchanged by subsequent browser acceptance corrections. Full details: [defensive pacing](2026-10-18-defensive-pacing-repair.md).

## Verification

| Boundary | Evidence | Limit |
| --- | --- | --- |
| Exact-head quality | 64f82df59f3fc111e9b253960f0f0c56c5b6113a: 9,195 Vitest plus seven Node checks, formatting, lint, eight package typechecks, both builds, worker boot and clean tracked source pass. | This does not replace gameplay acceptance. |
| Physical catalogue concurrency | Four real PostgreSQL two-session schedules pass on the exact head: content/timing, timing/content, history/content and rollback followed by valid-token reuse; actual lock waits and complete persisted-state assertions. | Isolated CI database, not production contention/load. |
| Controlled | 32 native desktop/phone PvE/PvP cases; zero reported browser errors. | Production components/kernel with fixture transport. |
| Modular readers | 24 native reader contexts. | Does not certify every human reader or actual device. |
| Five Basic restores | 20 desktop/phone journeys through actual local handler/service/repository/validation/preview/publication; cancel, old publication/history, new immutable version and old captures are checked. | Fixture actors and in-memory persistence do not prove hosted identity. |
| Controls layout | 12 actual desktop states, zero overflow, complete text, buttons at least44px; authenticated layout workflows pass. | Reduced viewport or page/content scaling does not certify physical browser200%zoom. |
| Full authenticated browser | Exact-head first attempt: early Owner/movement4, password-reset6, guided-battle3 and focused73 pass (21 intentional skips). Complete624:350 pass,273 intentional skips,1 failure in unchanged World presence interpolation (1.129tile delta; strict<0.75). Unchanged-source retry pending. | Edge was not reached. Do not declare the release gate green yet. |
| Atomic cohort rehearsal | Whole prospective catalogue validates against observed policy7; actual local SQL commits289 exact versions, rolls all back on a late injected failure, rejects stale retries and clears current pointers without deleting immutable versions. | Actual local SQL; separate from the physical concurrency and hosted probes. |

Earlier native failures exposed outdated empty-modifier request expectations, an M binding now assigned to Modifiers, a held preview intercept that released independent forecasts, focused-reader ownership assumptions, and old unsigned Guard text. Exact equality, resource/commit assertions and strict overflow checks were retained when correcting those tests.

The full browser suite also exposed a real Support shortcut regression: canonical Recovery arms in recover mode while the repeated shared support key tested guard mode. The shared PvE/PvP controller now derives the shortcut mode from the same authored classification used by arming and highlights the selected Support action in that mode. Existing HP/MP authority-rejection/commit, PvP commit and held-reader tests are the observed regressions. No battle price, cooldown, server authority or deferred Minor was changed.

Two earlier quality attempts timed out in existing extreme-count arithmetic cases; focused unchanged-source runs passed in2.33s and1s. The final head runs all9,195 tests successfully with unchanged timeouts. A prior runner was cancelled without a retrievable final archive. The successful final quality log is retained separately.

## Coordinated release and receipts

RECEIPTS_PENDING.

1. Require every exact-head required workflow green, then refresh main, hosted Owner/content/policy state and the intended project/deployment.
2. Merge only the verified head with an expected-head check while automatic Git deployment is locked. Verify the merge contains exactly the tested files before any hosted change.
3. Apply only the six reviewed combat migrations in chronological order. Reconcile an API-generated migration timestamp only for that newly applied row, using exact name/version/metadata fingerprint CAS; preserve statements and all other metadata. Verify the ten reviewed function bodies, security-definer paths, execute grants and private-table RLS. Other chats' migrations remain untouched.
4. Deploy the exact verified merged commit to the existing production project. Verify source, Ready state and canonical alias before publishing any cohort.
5. Bind the checksum-verified SQL to the freshly confirmed actual Owner and catalogue token. It locks the catalogue before draft persistence, asserts the unchanged empty Owner state and exact policy7, calls service-only v3 for all289 definitions, checks every returned version/definition and final counts, and commits all or none. It changes neither timing policy nor earned selections/captures.
6. Read back the full coherent snapshot and compare every stored definition/version with the manifest. Require exact counts and policy. Check actual hosted stale-CAS rejection and authenticated execution denial inside an unconditionally rolled-back transaction. Inspect the dynamic public Manual, available application paths and the exact deployment's runtime window.
7. If rollback is required, use the expected released token and exact definitions through normal service-only pointer RPCs in one transaction. Clear only the cohort's current pointers; preserve all289 immutable history rows. Keep compatible new code for already-admitted new captures.

The publication template's recovered bytes match the rehearsed file exactly:751,693 bytes; SHA256 c2b9e49fb50818b11dc383ea9cecde2a28c259c31e9b67ced73df466b79395e8. Recovery used the immutable verified Git blob and a read-only hash query. No production content or schema write was performed during recovery. The ten expected SQL function bodies/ACLs and guarded rollback/probe procedures are also prepared.

## Player and Owner smoke checklist

- Read Type, Cost, Cooldown, Requirements, Effects, Range, Target, Target Method, Target Elevation and Line of Sight across current Skill/Essence/Resonance/Basic readers. Compare selected recipients, conditions and historical versions.
- In PvE/PvP, use unit/plural/direction/shape/Ground targeting with mouse, keyboard and touch. Check invalid/range/line-of-sight/elevation and stale-version rejection; rejected commands spend nothing.
- Use an attached Move, then its action from the actually reached tile. Pay the authored Skill cost once; remaining Movement, Jump, Root, terrain and occupancy still apply. Standalone native Move retains traversal pricing.
- For Move/Attack/Guard/HP Recovery/MP Recovery, restore history to draft, cancel once, confirm, validate/diff/preview and publish a new immutable version. Restore alone changes no publication; stale publication must fail atomically. Old captures keep prior mechanics.
- Prime a Controlled action for free once per character/ability/battle, wait for real readiness, release legally and pay once. Invalid release keeps the prime; cancellation does not renew it.
- Select an explicit Manual modifier bundle. Check root/modifier requirements and total price, rejection of stale/incompatible selections, single charge per committed activation and historical capture. Omission gives no modifier payoff or cost.
- Verify HP/MP Support Actions after a custom binding: first press arms; the deliberate second self-action press reaches authority once. Full resources reject without payment; a reading panel owns its keys and cannot commit behind the reader.
- Play the revised defensive kits and compare meaningful pressure, recovery conditions and finite reserves. These native matrices do not replace broader human balance acceptance.

## Exact mechanical witnesses

These factual tables are copied from the reviewed executable reports. They record native authoritative outcomes and their specific counterexamples, not every possible pairing.

### Effects

| Effect ID | Exact proposed playable record | Version | Observable result and counter/bound |
| --- | --- | --- | --- |
| move | vanguard.sweeping-strike |6| Move one tile before actual hit; total50AP, no MP or walking surcharge; excessive otherwise legal route rejects with only the authored maximum-tile issue; both original and reached positions are within attack range. |
| damage | vanguard.forceful-strike |6| Enemy loses28HP;45AP price;100Barrier absorbs it, leaving72; cooldown blocks replay. |
| pierce | vanguard.guard-break |5| Without explicit equipment Armor, current Defense is not bypassed: Defense20 yields18damage versus22at0; cooldown blocks replay. |
| healing | resonance.cinderweaver-lifebinder.linked-sequence |5| Wounded ally gains20HP, caps at1000, hostile selection rejects. |
| percentage-recovery | lifebinder.mending-light |6| Ten percent of1000maxHP restores100; caps at1000; hostile selection rejects. |
| resource-change | aetherist.arcane-field |7| Real Circle activation drains4MP from both enemies, preserves allyMP and pays owner6MP; targetMP caps at0. |
| apply-status | vanguard.brace |5| Owner receives Guard, enemy does not; finite clock removes it, cooldown blocks replay. |
| remove-status | runeblade.unbinding-rune |5| Explicit Dispel removes enemyCovert while leaving unrelatedSuppress; cooldown blocks replay. |
| return-to-turn-start | chronist.rewind-step |6| Free prime captures real tile; after paid walking, release returns to prime tile for40AP/4MP and restores no Movement; repeat rejects. |
| create-terrain | frostweaver.chilling-mist |8| Approved selected canonical Ground bridge creates a two-round source and actual FrozenGround after activation; area and terrain expire without input. |
| displace | vanguard.shield-bash |5| Enemy moves one tile when free; occupied destination stops displacement while the paid hit still lands. |
| poison | resonance.farstrider-wildwarden.linked-sequence |6| Marked ranged target receives captured three-tick Poison, loses HP at turn boundary, then loses the finite instance; missingMark rejects. |
| burn | cinderweaver.cinder-bolt |8| Captured three-tick Burn damages at real turn boundary then expires; cooldown blocks replay. |
| bleed | ravager.gash |6| Captured three-tick Bleed damages at real turn boundary then expires; cooldown blocks replay. |
| barrier-change | vanguard.brace |5| Owner gains12Barrier; enemy gains0; cooldown blocks replay. |
| copy-statuses | shadehand.quick-hands |6| Owner gains donorGuard and donor retains it; empty donor rejects, costs unchanged on preview, cooldown blocks replay. |
| sensory | farstrider.scouts-mark |5| Removes Covert and eligible Guard, applies Revealed and sourceMark with no damage; Revealed expires. |
| summon | wildwarden.renewing-herbs |7| Captured36HP/12MP companion has two abilities; occupied spawn rejects; after exactly five summon turns, the companion and summon state disappear. |
| damage-bonus | farstrider.keen-focus with farstrider.aimed-shot |5/5| Explicit attachment changes26damage to29 after native flooring, costs an extra10AP/3MP; omission gives no bonus or modifier price, modifier cooldown blocks a distinct available compatible root with sufficient AP/MP; plain root remains legal. |

Source: [executable effects](2026-10-16-executable-roster-effects.md).

### Statuses

| Runtime status | Exact proposed primary witness/version | Observable result and counter |
| --- | --- | --- |
| guarded | vanguard.brace@5 | Less incoming actualHP loss; both fixtures retain the same12Barrier. |
| exposed | aetherist.arcane-field@7 | Greater actualHP loss on the same available follow-up. |
| covert | shadehand.smoke-vial@6 | Actual source visibility becomes team-only, remains private after Invisible breaks; removing Covert clears projection. |
| revealed | farstrider.scouts-mark@5 | Genuine Sensory purges Covert; active Revealed doubles qualifying Skill AP, with commit/affordability/Basic counters above. |
| wet | tidecaller.water-lance@8 | Actual initiative order changes and the next actor follows it; committed base initiative/current actor stay intact. |
| frozen | frostweaver.ice-lance@8 | Current Chilled prevents changed final facing, allows the existing facing, normal movement and a legal attack. |
| conductive | stormsinger.arc-spark@8 | Actual Static Drain hits harder, consumes the charge and reapplies exactly one authored charge. |
| inspired | vanguard.rally@6 | Greater outgoing actualHP loss versus removing only Inspired. |
| blindside | shadehand.backstab@6 | Side attack grants the status and improves actual follow-up damage; front attack grants none. |
| suppress | aetherist.chain-spark@7 | Suppressed enemy deals less actualHP damage than the same enemy without it. |
| hexed | lifebinder.vital-sever@6 | Current Healing Down reduces real Mending Light recovery100→75 and next-round Channel MP recovery2→1. |
| invisible | shadehand.smoke-vial@6 | Hostile direct target rejects; removing only Invisible makes it legal; own actual attack breaks Invisible. |
| airborne | ironfist.breakfall@6 | Jump0→3 enables and commits the otherwise blocked elevated step; committed base Jump is unchanged. |
| haste | chronist.haste@5 | Quote saves10AP, real walking pays the quote and oneMovement. |
| burn | cinderweaver.cinder-bolt@8 | Captured21damage/20% profile/5pp decay gives a real first tick4HP. |
| bleed | ravager.gash@6 | Captured21damage/15% profile gives a real first tick3HP. |
| poison | resonance.farstrider-wildwarden.linked-sequence@6 | Actual Scout's Mark enables the ranged source; captured19damage/15% profile gives a real first tick2HP. |
| slow | farstrider.pinning-shot@5 | Enemy walking quote costs10AP more, actual walking pays it and oneMovement. |
| root | chronist.time-lock@5 | Movement rejects while the paired ordinary walk is legal; facing and a real damaging Skill remain legal. |
| reckless | ravager.frenzy@5 | Greater outgoing and incoming actualHP damage. |
| fortified | bastion.fortress@5 | Lower outgoing and incoming actualHP damage. |
| challenged | bastion.challenge@5 | Current Taunt reduces damage against another ally, preserves damage against its source. |
| mark | farstrider.scouts-mark@5 | Owner's actual hit forecast gains15pp; another ally's hit forecast gains none. |
| warded | cinderweaver.ash-ward@5 | Actual Burn enables Ash Ward; attacks from a genuinely burning enemy hurt less; removing only that enemyBurn removes the Ward benefit. |

Source: [statuses and Requirements](2026-10-16-executable-status-requirements.md).

### Requirements

| Kind | Exact proposed primary witness/version | Eligible and counter outcome |
| --- | --- | --- |
| all | vanguard.second-wind@6 | Actual incoming hit crosses the threshold and spends4MP for80HP/Guard/one usage;3MP rejects the reaction, no-input lowHP grants nothing. |
| any | shadehand.exploit-opening@6 | Genuine Mark or Exposed setup enables actual hit and50AP payment; neither setup rejects. |
| resource-state | lifebinder.mend@6 | Ally350/1000HP heals120 and pays35AP/6MP, leaving65AP/14MP;351rejects only the Requirement, defeated ally is not revived. |
| resource-threshold-crossing | vanguard.second-wind@6 | Actual hit329→301 does not trigger;328→300 does, as does327→299; starting290 does not cross anew. |
| status-presence | shadehand.exploit-opening@6 | Mark on another target does not qualify; Mark on the selected target does, with actual damage/payment. |
| prime-presence | resonance.aetherist-chronist.linked-sequence@5 | Actual free Rewind prime enables a damage change975→973enemyHP; no prime, cancelled prime or insufficientMP does not. |
| event | vanguard.second-wind@6 | Genuine incoming damage triggers; actual Gather HP payment crossing the same threshold does not emit the eligible damage event or trigger recovery. |
| action | farstrider.keen-focus@5 | Actual Farstrider Aimed Shot attachment changesHP/cost; attaching to an otherwise legal Aetherist Arc Bolt rejects the modifier Requirement without changing input. |

Source: [statuses and Requirements](2026-10-16-executable-status-requirements.md).

### Activation combinations

| Combination | Primary final witness | Actual outcome and counter/bound |
| --- | --- | --- |
| manual/action | vanguard.forceful-strike@6 | Actual hit removes28HP and spends45AP/0MP; one no-input round deals nothing; attempted replay rejects only its cooldown. |
| automatic/action | ironfist.counter-palm@5 | A real own physical Skill grants12Barrier and spends3MP without additionalAP; a second distinct physical command in that owner turn gives no additional Barrier/payment. Mystic action, insufficientMP and no-input round give none. An actual opponent physical Skill still damages the owner28HP without granting the owner's Barrier or spending itsMP. Direct explicit-group manual invocation rejects without an engine event. |
| manual/modifier | farstrider.keen-focus@5 | Actual Aimed Shot alone leaves974enemyHP,55AP/20MP; explicit attachment leaves971enemyHP,45AP/17MP. There is no independent modifier cast. On the next actual owner turn an available distinct Pinning Shot is legal alone; attachment rejects only the modifier cooldown. Omission charges no modifierMP. |
| ongoing/modifier | resonance.aetherist-ravager.linked-sequence@6 | At350/1000HP and20MP, actual Arc Bolt leaves973enemyHP,55AP/17MP;351HP,9MP or source removal gives ordinary975enemyHP. No separate cast exists; a no-input round spends noMP and deals no damage. |

Source: [executable activations](2026-10-16-executable-roster-activations.md).

Lowered Guard is the no-input timeout consequence, not an ordinary authored Skill status. Displaced is a retained historical marker, not a current authorship reward; current Shield Bash pushes without creating it or refunding resources/turns. Pierce has no invented equipment-Armor or Defense bypass. These boundaries and all individually declined review scopes remain open where the decision record says so.

## Remaining work and limits

After verified release, broader Master/operations/world work and the21 deferred Minors remain. Human gameplay/multiplayer/load acceptance and actual physical200% browser zoom are not certified by the fixture or viewport evidence. The current cloud browser was logged out; hosted sign-in/Owner interaction remains unverified unless a later receipt explicitly records it.

The already delivered roster workbook is a pre-release mechanical snapshot of the same manifest. Its file identity and retained tables/formatting are preserved. Do not describe its release-status cells as refreshed unless the file is actually updated and verified.
