# Equipped Veiled Conduit counterplay — October 17

This tests-only Task15 continuation closes the explicit Sensory/area-counter gap from the legal two-build replay report. It does not change runtime, roster, prices, stats, status rules, AI, shared fixtures, UI or hosted content. The original unfinished combat integration still precedes combat release; broader Master/world work follows that release.

## Actual acceptance

Twenty-four cases cover both Veiled Conduit Primary orders (Aetherist and Shadehand), Levels1/100 and PvE/PvP. Each uses actual local proposed publication, earned four-Skill save/load, current and pinned authority, captured source versions, character-derived startup, legal native commands and validated JSON restoration. Earned/mastered facts are seeded fixture records rather than proof of progression acquisition. Successful commands check input immutability; rejected repeated Scout’s Mark also preserves input. End Turn has restoration/validation but its direct immutability witness remains deferred.

Mana Shield spends35AP/6MP, establishes20Barrier and Guarded; Veiled Conduit spends35AP, sacrifices Guarded, restores4MP and grants finite Covert. Combined setup leaves30AP/net2MP spent. Covert is targetable concealment/privacy, not immunity.

| Counter | Actual evidence |
| --- | --- |
| Equipped Farstrider Scout’s Mark, seed1 | Real30AP/2MP payment, successful Sensory removes Covert and applies Revealed. Repeat use rejects. Revealed persists into the actual next owner turn; legal Smoke Vial spends70AP rather than35 and cannot reapply Covert. Invisible still applies independently. Actual owner End Turn expires Revealed and restores the35AP quote; this is not immediate legal recast acceptance. |
| Equipped Cinderweaver Ember Line, seed1 | Actual west-facing directional area command spends50AP/6MP. Positive Barrier absorption and HP damage reconcile exactly with action-specific native events and before/after resources. Battle stays active; ordinary area damage does not itself remove Covert. |
| Equipped Farstrider Scout’s Mark, seed27 | Native action/source/target accuracy event records an actual miss (roll9930), full30AP/2MP payment, retained Covert, no Revealed, no Sensory purge. |

The flat adjacent5×3 fixture is a stated opportunity, not broad geometry/AI strategy acceptance. Seed1/27 are deterministic witnesses, not statistical hit-rate or balance evidence. Sensory resistance and broader Invisible mechanics are outside this slice.

## Verification and correction history

Base152b57b835334cae733b3289ced7b93e8a2417f5; reviewed3317630cd6521ed522985f53e77b66b0b2129979. Failed assertions are retained:001132045160 assumed old owner-start expiry and reused an unrelated miss seed; current native events establish owner-END expiry and real setup consumes RNG before the counter. Seed12345 connects here. Diagnostic001242753300 identified real seed27/roll9930 miss. Receipt001328882384 incorrectly expected expiryBoundary on the status instance; that field belongs to the status-applied event, while the active instance uses remainingOwnerTurnEnds1. These were corrected test assumptions, not gameplay defects.

Initial16 pass001025363822; expanded24 pass001350522925. Independent HP/Barrier reconciliation then passes36/2 with the covering ranged suite001534502312 and58/4 across actual duel/payoff/defense/counter cycles001548681324. The first command included a nonexistent singular duel filename; Vitest ran the two real matching files and the36/2 receipt is labelled accordingly, not extra coverage. The later58/4 uses actual filenames. Exact-source native trace contains24 unique scenario records; its summary checks action-specific hit/miss events and captured counter sources.

Final tested source8e7f20258b65bdc305eacbfd5fb2b8dbc74f893e adds only the nine-line I1 native-miss assertion. Final covering58/4 passes002031413392Z-7f59cbc4. The final-source trace contains24 unique records with action-specific native accuracy and captured-source checks; SHA2565aa6751c375ca63d5e22f9092d62c51d99b49b161eba3373f20d82557015f5ed. Actual output is byte-identical to the reviewed-source trace, as expected for assertion-only changes. New cases total24, expected normal gate8997Vitest+7Node.

Reviewed-source full gate001624181554Z-3ead9b1a exits0 with all8997Vitest+7Node counts and completed package build logs; root stdout ends at Creating an optimized production build. Preserve raw log and hashed package archive with partial-evidence root-tail status. Do not treat that as a complete root-tail receipt or rerun superseded source.

Final-source full gate002053967809Z-8281eec7 passes **8,997 Vitest plus7 Node checks**, formatting/lint/types and both builds. Its saved root stdout includes all7 package counts, Node7/0fail, explicit `$ turbo run build` and the successful two-build tail. No final-source replay was needed. Turbo/Next telemetry is explicitly disabled. Existing Vite loader and DOM advisory output remains unsuppressed; no dependency changes. Final normal-suite web count4615 plus other packages4382 totals8997. Complete hashed package logs and raw receipts travel with recovery evidence.

Preservation is structural and hashed: only the new test differs from base before the report. Runtime, roster, shared helper and all prior fixtures are byte-identical; proposed manifest SHA256b86cfec056bbac582810e7da80f9bc687f02518892eb5d11275fc7b5ced19f05 and six protected AI/native source hashes match. No separate141 preview/284 Manual-quote/294 reader snapshot or289-mirror diagnostic rerun was added for this test-only change; the required full gate retains its ordinary suite, including its roster matrix. No new preservation-result or full balance claim is inferred from unchanged source.

## Rulings and costs

1. Use directed Sensory/area scenarios rather than repeat unchanged four-round mirrors: the earlier report explicitly names this missing counterplay. Cost if wrong: other distinct cycles and balance still need acceptance.
2. Tests can pass correct existing behavior without an artificial RED scaffold or gameplay patch. Cost if wrong: this is evidence expansion, not a fixed gameplay bug.
3. Use actual native owner-END clocks and seed27 after observing the real setup/RNG, preserving failed assumptions and diagnostics. Cost if wrong: finite deterministic witnesses do not prove every timing or seed branch.
4. Use source-diff and protected hash guards instead of rerunning unchanged141/284/294/289 diagnostics. Cost if wrong: this step adds no broader preservation or balance acceptance.
5. The review repair adds a direct miss-event assertion to correct native behavior; no contrived runtime RED/fix is claimed. Cost if wrong: this assertion-only repair does not demonstrate a production bug regression.

## One combined review

The read-only gpt-6-astra High reviewer reports0Critical/1Important/1newMinor. Parent accepts ImportantI1: a paid ineffective command needs direct action/source/target hit:false evidence to exclude skipped/no-op accuracy/effect processing. Existing frozen trace already has that native event. One assertion-only repair wave; no runtime change and no rereview. New MinorM1: direct End Turn input-immutability assertion is absent; no mutation was observed. It remains deferred with the16 inherited findings,17 total.

### Individual review scope rulings

| Behavior set aside | Parent ruling and reason | Cost if wrong |
| --- | --- | --- |
| Final root gate | Parent requires final-source receipt and explicit complete root build tail. | Review alone does not establish passing checks. |
| Focused execution receipts | Retain raw receipts and observed outputs; reviewer inspected source only. | No independent second execution witness. |
| All-roster cycles | Accept only named directed cases. | Other authored cycles can remain unproven. |
| Natural12round/full-match balance | Keep completed-match distributions and pacing open. | Degenerate or slow matches may remain. |
| AI tactical selection | Commands deliberately expose counterplay; no planner claim. | AI may not select this opportunity. |
| Other seeds/statistical hit rates | Record actual native seed1/27 witnesses only. | Unusual outcomes and rates remain untested. |
| Revealed resistance | Purge and resistible Revealed are distinct; resistance branch remains open. | Resistant outcomes lack this integration witness. |
| Scout’s Mark ownership/accuracy bonus | Preserve unchanged adjacent mechanics; outside this counter contract. | Their interactions are not newly accepted. |
| Broader Invisible/direct-target/damage break | Accept only independent application alongside Revealed. | Other Invisible interactions remain unproven. |
| Legal Smoke recast after expiry | Quote returns35, but cooldown/off-turn still block recast. | Quote recovery could be mistaken for immediate usability. |
| Other geometry/range/elevation/allies/multitarget | State flat adjacent directional opportunity. | Other legal areas/opportunities may behave differently. |
| Individual setup prices | Combined real payment checked; existing payoff cases cover detailed prices. | Compensating individual price changes need other coverage. |
| Repeated source-version assertions | Unchanged real helper resolves current/pinned authority and capture. | No new per-case independent version oracle. |
| Matrix cardinality | Present data yields8scenarios/24cases; trace guard independently checks24unique records. | Future roster filtering changes require coverage maintenance. |
| Earned acquisition/progression | Seed learned/mastered facts without granting new eligibility. | Real acquisition/prerequisites remain unaccepted. |
| Hosted persistence/CAS/restarts/load | Local publication/JSON restoration only. | Hosted integrity/concurrency/load issues may remain. |
| Native browser/input/editorial/human/release | No native interaction or experiential evidence claimed. | Accessibility/usability/enjoyment and live behavior remain open. |
|16 inherited Minors | Preserve approved deferral rather than expand this slice. | Known low-severity gaps remain. |
| Merge/publication/deployment | No release operations; source-backup only. | A local passing checkpoint is not live acceptance. |

### Deferred Minors

Inherited16: Rewind witness origin; Supporting Shot version pin; Ongoing pair dynamic identity pin; repeated bounded AI discovery; admission double-prefix provenance; ranged direct negative-commit witness; independent Defense positive-HP reconciliation; exact Arsenal history labels/values; singular clock grammar; Burn tick wording; Master inline-reference sizing; cross-status actual-input immutability witness; legacy duplicate component keys; unknown-reference matching-text witness; Automatic local RNG display; Automatic owner-only outcome-copy bound. New17th: direct End Turn input-immutability witness in this helper. No runtime mutation defect observed.

## Remaining acceptance and checkpoint

Other distinct equipped cycles and comprehensive roster AI/PvP/counterplay; natural full-match balance; complete battle/editor integration; native keyboard/touch/AT/mobile/zoom and Atlas motion; current Owner content/history/CAS/hosted-publication reconciliation; combined release review, authorized publication/deployment and human gameplay remain open. Task15/16 are not complete. High remains sufficient.

Only this report follows final tested source. Recovery bundle/evidence must be verified on the existing non-deploying backup branch. No hosted write, content publication/activation, applied migration, main merge or deployment.
