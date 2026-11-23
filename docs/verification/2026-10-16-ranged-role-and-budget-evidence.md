# Actual ranged-role cycles and natural budget evidence

Status:21 new local outcome cases and14 bounded diagnostic matches pass; frozen repository gate and one combined review accepted. Tested source `8657f3c46473f0c5455947d270ce8d69763e2cb6`, tree `c9d8b9a513b1d0bc0a2fee27d47b6e8a56b01db9`. Base `1461fa3de939e5fb4770d5ab507b8c9561256a05`. Task15/16 and release remain open. No hosted write, publication, activation, migration, merge or deployment.

## Mechanical result

The local legal-duel fixture now accepts explicit board dimensions and two initial positions. Its previous flat5×3 adjacent defaults remain unchanged; the explicit-default and implicit-default results are fully equal in an actual current/pinned build case. Production geometry, client input, AI strategy, resource formulas, prices, builtins and all proposed definitions are unchanged.

Twenty-one tests use real local publication, earned four-Skill save/load for both independent participants, current version resolution, pinned captures, current derived statistics/policies, actual startup and shared commands. They run at Levels1/100 in PvE/PvP, with real Accuracy/critical/resistance/RNG. No HP, status, resources or movement are installed to manufacture setup.

| Actual cycle | Evidence |
| --- | --- |
|Aimed Shot and range counter|Actual AI selects and commits an owned ranged attack when a range3 opportunity exists. Exact45AP Aimed Shot connects. After actual cooldown, opposing native walking spends40AP to close two tiles inside minimum range; the same shot quote rejects with unchanged state. One native20AP retreat restores range and a45AP shot leaves35AP. Standalone walking retains its own price.|
|Longshot's held prime|An actual legal four-Skill pure kit substitutes earned Longshot for Aimed Shot. Priming changes no combatant resource/status and emits no paid/damage event. Opposing paid40AP closing makes release invalid. JSON restore and invalid quote retain the captured prime. Paid20AP retreat restores minimum range3; release pays60AP/3MP, connects, consumes the prime, and a second prime rejects once-per-battle.|
|Hunter's Mark / Pursuit / opposing Cleanse|The approved Wildwarden kit pays30AP for a real Mark, then50AP Pursuit causes two actual positive packets. In a parallel real counter branch, an independently committed Tidecaller kit pays50AP/6MP for Cleansing Rain; Mark is actually removed. Pursuit remains legal and paid, but only its ordinary packet occurs. No invented full-action denial.|
|Fieldcraft's included Move|A real opposing Pursuit first wounds the Farstrider. Fieldcraft40AP moves two entered tiles and recovers4%maximumHP subject to the actual missing-HP cap; it leaves60AP, not20AP, and spends actual remaining Movement. Its four-owner-turn cooldown is observed. Real Snare is initially paid but misses; only after its actual cooldown is it retried until Root genuinely applies. Root then rejects the whole Fieldcraft before payment/healing/movement; state stays unchanged. Actual manual turn completion expires Root and restores legality.|
|Keen Focus's paid attachment|An earned four-Skill Farstrider kit explicitly attaches the captured modifier to Aimed Shot. Same-state positive actual damage exceeds the unmodified branch; combined55AP/3MP is paid and Keen Focus's own three-turn cooldown starts. A separately legal Fieldcraft recovery root cannot take this Attack-only modifier; prepare and commit reject without mutation.|
|Default compatibility|One actual Level100 build compares complete default versus explicit5×3 adjacent creation state, authority, participants and startup events, preserving the previous fixture contract.|

These are selected mechanical choices and concrete counters, not acceptance for all136 Skills/17Essences/136pairs, all target counts, terrain/elevation/ally roles, optimal kiting or every modifier/Controlled composition. Longshot, Fieldcraft and Keen Focus are three Skills outside the earlier289 approved-kit replay's94 equipped-Skill union. That earlier complete matrix remains valid at its tested source; it is not relabelled as a new289-case run here.

## Test-first and scoped receipts

- Ranged4 RED `105844385466`: the previous fixture ignored custom board input, retained adjacency and produced native Basic choices. Optional fixture dimensions/positions fix that test setup, without an AI or game-rule change. Actual4 GREEN `110029874919`.
- Longshot extends to8 GREEN `110217556406`. Actual Hunter/Pursuit/Cleanse plus default compatibility extend to13 GREEN `110403289406`.
- Extended21 run `110634824581`:17pass/4Fieldcraft fixture failures. At Level100 only18HP were missing, so20-point nominal recovery caps at18. Diagnostic `110741060489` shows Snare's real94.38% chance/96.95% roll miss; no Root was installed. Correct missing-HP expectation and wait for real cooldown/retry, retaining actual miss/costs. All21 GREEN `110835935267`.
- Scoped web types `110654502742` and scoped ESLint `110851383341` pass. Covering `111257447820`:68tests/4files, including the21 new cases, previous22 directed duel/payoff cases and25 routine mirrors.
- Final scoped types/lint `111559450860`/`111559450855` pass. Frozen root `112015038115`,11:20:15–11:23:54UTC, exit0:8,181Vitest (4,115core/3,820web/246other)+7Node; format,lint,eight type checks and both builds pass. Combined review accepted below; exact recovery bundle/evidence checkpoint follows as a documentation-only descendant. No source change after frozen gate.

## Natural resource and pacing sample

A separate exact one-off diagnostic driver calls the same actual legal-duel creator and planner/executor at a flat7×3 range3 start. It plays up to32 natural rounds, without forcing completion, changing stats/prices, installing mana or awarding a horizon victory. Seven actual kits, including both Primary orders of three pair kits, run at Levels1/100 with stated seed1 in PvP. Actual14-case receipt `111256224945`,11:12:56–11:14:29UTC, exit0,92.87seconds. All14 genuinely complete. The driver is retained verbatim with raw JSONL, source hashes and analysis in checkpoint evidence, then removed from routine test discovery; these are14 separate diagnostic cases, not14 additional routine CI tests.

| Kit / Primary | Level1 final round | Level100 final round | Level100 final MP, sideA ; sideB |
| --- | --- | --- | --- |
|aetherist entry kit|6|13|325/400 ; 326/400|
|aetherist-bastion / aetherist|6|12|394/400 ; 400/400|
|aetherist-bastion / bastion|9|29|107/131 ; 119/131|
|aetherist-edgedancer / aetherist|5|11|388/400 ; 388/400|
|aetherist-edgedancer / edgedancer|5|17|103/121 ; 103/121|
|chronist-runeblade / chronist|7|13|391/400 ; 391/400|
|chronist-runeblade / runeblade|7|16|170/179 ; 170/179|

Level1 matches finish in5–9 rounds, median6. Level100 matches finish in11–29 rounds, median13. Every final MP pool retains at least70.24% at Level1 and81.25% at Level100. None of the three sampled pair definitions appears as a committed pair root in these matches; each includes a low-mana decision. These are observed final resources and chosen roots. They do not prove every intermediate Requirement was false, isolate the cause of nonselection, establish an optimal strategy, or justify repricing from one seed/board/role. Aetherist/Edgedancer has multiple behavior choices; absence of its pair root is not attributed solely to its low-mana group.

The sample gives concrete questions for the Owner-requested ExtraHigh strategy/balance review: how the intended approximately12-round legal Level100 benchmark should treat the29-round protected mirror; whether reserve-based choices occur at appropriate opportunities with current legal MP pools; and whether other role/ally/terrain contexts or planning changes are needed before touching costs. Current rules/formulas and accepted definitions stay unchanged. Wider seeds, PvE, asymmetric opponents, actual allies and all individual cycles remain required for full acceptance.

## Parent scope decisions

Ruling: add only optional local fixture board/start positions and preserve all previous defaults — it provides an actual ranged opportunity instead of inferring weakness from an adjacent start — cost if wrong: changed old replay geometry; complete default-state equality, existing22 cases,25 routine mirrors and final root gate guard compatibility.

Ruling: do not repeat the approximately11-minute complete289 matrix for this fixture-only configuration extension — production behavior and adjacent defaults are unchanged, and its original tested source/evidence remain identified — cost if wrong: an unsampled fixture interaction could remain; final root retains all17 classes/four selected pairs and the original312 admission cases, with the new direct compatibility guard.

Ruling: retain real hit/resistance/missing-HP caps and wait through real cooldowns for counter setup — do not patch Root or invent recovery above maximum — cost if wrong: misleading outcome evidence or disguised engine regression; actual receipts distinguish the miss from successful Root and HP remains unchanged during the wait.

Ruling: keep attached Move inside Fieldcraft's40AP while native retreat/closing retains20AP per normal terrain point — this is the existing Owner contract, not a pricing redesign — cost if wrong: extra or missing movement charges; exact combined payments and remaining Movement are asserted.

Ruling: allow only genuine learned four-Skill alternatives for Longshot/Fieldcraft/Keen Focus, through actual save/load and pinned capture — no testing grant, extra slot or silent helper — cost if wrong: unreachable or unearned loadouts could appear legal; real acquisition/advanced prerequisites remain separate from seeded fixture facts.

Ruling: keep the14-case exploratory driver and raw evidence outside routine CI after execution, retaining exact source/hash/reproduction instructions in the recovery evidence — it measures the current implementation rather than introducing a second game engine — cost if wrong: lost reproducibility; archive the exact driver, data, analysis and receipts with the final source.

Ruling: save and verify this concrete checkpoint, then pause for the Owner's actual ExtraHigh setting before strategy/balance judgment — the next decision concerns resource thresholds, natural pacing and role/planner behavior, which the Owner reserved for ExtraHigh; no price, formula or tactical doctrine is chosen onHigh — cost if wrong: an unnecessary pause, versus unapproved design changes or invalidating more exact-cost assumptions without the requested judgment setting.

Ruling: Task15/16, current Owner-edit/timing/hostedCAS reconciliation, natural full-roster balance, all distinct individual cycles, browser/key/touch/mobile/zoom, complete prose/orange/derivedTags/readers/editor/Atlas and human acceptance remain open — no source checkpoint is release authorization — cost if wrong: premature publication/release with known acceptance gaps. Prior five deferred Minors remain unchanged.

## Combined review and parent rulings
Fresh-context gpt-6-astra High review of `1461fa3d..8657f3c4`:0Critical/0Important/1newMinor. All4diagnostic hashes,14unique genuine completions and raw aggregate/root-use data agree. No fix pass or rereview.
Deferred Minor: Aimed Shot and Longshot range-negative tests directly exercise rejected preparation, not rejected commit; shared commit currently re-prepares and rejects. Future direct-commit/state/prime hardening remains deferred. Report wording is narrowed to the actual quote witness. Prior five Minors remain unchanged.
Final: Ruling: All distinct Skill/Essence/pair cycles — retain full Task15 individual setup/payoff/counter acceptance; five selected cycles are narrower — Cost if wrong: unexercised authored cycles may fail.

Final: Ruling: Repeat full289 matrix at this head — accept historical289 at its identified source plus unchanged defaults/full equality guard/25 routine mirrors/full root; no production change — Cost if wrong: an unsampled fixture interaction may remain.

Final: Ruling: Optimal ranged retreat/kiting/utility — reserve doctrine and utility changes for the Owner ExtraHigh judgment; a real ranged opportunity is proven — Cost if wrong: legal but inferior tactics could obscure intended roles.

Final: Ruling: Balance/repricing/reserve thresholds/twelve-round acceptance — keep acceptance open; fourteen single-seed mirrors cannot prescribe prices or pacing — Cost if wrong: slow or degenerate roles could ship if this limit is forgotten.

Final: Ruling: Intermediate MP/Requirement eligibility/nonselection causes — make no intermediate-threshold or causal claim from finalMP/command records — Cost if wrong: a mistaken causal explanation could drive wrong design.

Final: Ruling: Wider seeds/PvE naturals/asymmetric opponents/distributions — retain broader natural sampling as open; label sample seed1PvP mirrors — Cost if wrong: unobserved matchup or RNG imbalance.

Final: Ruling: Terrain/elevation/obstacles/allies/all target counts — retain role/geometry contexts as open; selected flat-board cases only — Cost if wrong: unreachable or weak support roles could be missed.

Final: Ruling: Complete Controlled cancellation/defeat/source-removal/interruption/duplicates — accept only named held-prime/release/once-per-battle case here; broader lifecycle gates remain — Cost if wrong: lost prime or duplicate effects in another lifecycle.

Final: Ruling: Every modifier and Controlled attachment composition — accept only actual KeenFocus payment and category rejection here — Cost if wrong: another attachment bundle could have a cost or capture defect.

Final: Ruling: No-input/repeated-event/interrupted-Move/reached-origin finished-engine safety — retain existing narrower evidence and final integration gate; manual turn ends are not idle timeout — Cost if wrong: unbounded/duplicated effects or unreachable-origin attacks.

Final: Ruling: Actual earning/mastery/advanced prerequisites — treat earned records as seeded facts while actual build admission is tested; progression remains separate — Cost if wrong: inaccessible or unearned loadouts could be misrepresented.

Final: Ruling: Hosted concurrency/rollback for publication/build/claim/recovery/settlement — retain physical SQL/concurrency acceptance; local services do not establish it — Cost if wrong: hosted-only integrity or lifecycle failure.

Final: Ruling: Stale-browser/alternate-character/direct-RPC expiry/revocation/CAS — retain Tasks8/16 authority acceptance; no relevant production code changed — Cost if wrong: stale privileged access could survive.

Final: Ruling: Malformed nested/captured/pending/summon and recursive private accuracy — retain hostile-input/serialization gates; valid capture/restore is narrower — Cost if wrong: bad input or private data leakage could remain.

Final: Ruling: Hosted Owner edits/timing/release reconciliation — require current-state reconciliation at final release; no hosted mutation authorized by checkpoint — Cost if wrong: overwritten edits or stale definitions.

Final: Ruling: Complete prose/orange/derived tags/readers/editors/Atlas — retain actual consumer audits and known Atlas issue; no UI acceptance inferred — Cost if wrong: misleading or incomplete presentation.

Final: Ruling: Native keyboard/touch/mobile/long names/history/200percent zoom — retain finished native-browser verification; do not repeat blocked install/tunnel loops without new basis — Cost if wrong: inaccessible controls or overflow could remain.

Final: Ruling: Human gameplay/release acceptance — keep experiential and release gates open; deterministic tests are not human acceptance — Cost if wrong: mechanically legal but unsatisfying or premature release.


## Recovery and next judgment

The exact local Git bundle, raw14match JSONL, exact diagnostic driver, four source/data hashes, aggregate analysis, full/scoped receipts, review, all parent rulings and concrete ExtraHigh handoff are retained for the authorized non-deploying GitHub recovery archive. The checkpoint requires previous accepted source1461fa3d; earlier archive prerequisites remain intact. Source and evidence hashes plus remote archive entries/head are verified before reporting backup success.

After verified persistence, work pauses for the Owner to switch to Extra High for strategy/balance judgment, as requested. No new price, formula, threshold or tactical doctrine is selected on High. Task15/16 and release remain open; this report is a bounded evidence checkpoint.
