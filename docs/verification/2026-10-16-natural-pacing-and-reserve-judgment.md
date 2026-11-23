# Level100 natural pacing and reserve opportunity judgment

Status: local evidence checkpoint, not balance acceptance. Owner confirmed Extra High on2026-10-16 at07:34Trinidad. Base `e7820890256733b51edc00e98895efebe0d3d6fc`. Production mechanics, AI, prices, formulas and all294 proposed/retained definitions remain unchanged. Task15/16 and release remain open.

## Judgment

The roughly twelve-round benchmark is not accepted. The17 approved pure four-Skill kits have14 completed natural Level100 mirrors (10–24 rounds, median15 **among completed matches**) and3 still-active40-round horizons: Bastion, Wildwarden and Dawnshield. Unfinished cases are not assigned victories, dropped from acceptance, or treated as40-round completions.

Do not globally increase mana prices, lift low-mana gates or uniformly weaken defensive classes from these observations. There are different concrete causes: absent reserve eligibility, unavailable mandatory-Move geometry, low class-command use after melee closure, and sustained recovery offsetting real incoming damage. Counter-role outcomes vary substantially. Next corrections require separately tested per-record/role budgets and actual AI opportunity handling; no uniform price/threshold/formula change is justified here.

## Real Aether in Poise cycle —16 routine tests

Both Primary orders, Levels1/100 and PvE/PvP use actual earned2+2 four-Skill save/load, current resolution/pinned capture/startup and shared commands. From a two-tile separation, the exact release moves one tile and deals actual positive HP damage; pays50AP/8MP; spends one remaining Movement; leaves50AP. Attached movement is included in the authored cost. Input stays unchanged.

The counter branch starts independently from that same legal state: owner manually ends, opponent pays20AP to close to adjacency, then manually ends. All four one-tile owner paths reject the mandatory Move-and-melee release in preparation and direct commit, preserving the entire state. Ordinary Arc Bolt remains legal and pays45AP/3MP. This is specific geometry counterplay, not a claim the whole loadout is disabled. These are manual turn ends, not idle timeouts.

The first4 mechanical probes passed on the existing engine (`114000937619`); no runtime change or fabricated RED was needed. Extended16 pass `114113485301`. Scoped types found the generic commit-result type at two typed AP reads (`114555465433`); using the existing stat-bridge reattachment helper resolves it, with typesGREEN `114837435384`. Final scoped16 replay `114919659922` and lint `114919661328` pass; frozen root/review are recorded below.

## Twenty actual reserve/opportunity traces

Six pair kits (three pairs, both Primary orders) replay seed1PvP, add seed17PvP and seed1PvE; two asymmetric cases add actual pure Aetherist pressure and actual pure Runeblade drain. All20 genuinely complete within40 rounds. Six baseline command sequences, final resources and rounds exactly equal the prior unobserved sample. The observational wrapper calls original AI with unchanged input and returns its exact decision; quote inspection is immutable. No alternative planner/engine or fabricated starting resources are introduced.

| Exact pair group | Observed decision points | Requirement true | At least one legal quote | Chosen |
| --- | ---: | ---: | ---: | ---: |
|resonance.aetherist-bastion.linked-sequence:linked-sequence|1015|0|0|0|
|resonance.aetherist-edgedancer.linked-sequence:gather|594|0|0|0|
|resonance.aetherist-edgedancer.linked-sequence:release|594|594|0|0|
|resonance.chronist-runeblade.linked-sequence:linked-sequence|730|0|0|0|

The three low-mana groups are ineligible at every recorded decision point in these20 traces; this is now an actual intermediate MP witness, not an inference from final MP. Aether in Poise's spending group's MP Requirement is always true, but none of the enumerated current one-tile movement/target quotes is legal. The separate positive two-tile cycle above proves its execution path works. This does not establish optimal kiting, all possible opportunity histories or the causal contribution of every quoted issue.

Trace limitation: an observer read the nonexistent AP `remaining` field, so JSON includes per-decision HP/MP but omits AP. All four selected Requirements are validated owner-MP predicates, and each authoritative quote receives the original complete state/AP. No per-decision AP claim is made. The first failed receipt probe used a nonexistent top-level statuses collection; its exact failed source and receipt `114651222050` are retained. The successful receipt observer also omits its optional status snapshot field (nonexistent combatant.statuses); actual AP/HP/MP snapshots and full shared events remain valid. Full status-history/stack-cause claims are not made.

## Actual pure-kit natural pacing

Flat7×3, initial range3, Level100, seed1PvP, current profiles and approved pure kits. Sixteen new natural runs plus the unchanged-source prior Aetherist13-round result cover17 kits. Each played to genuine completion or the end of round40, with no forced defeat, edited resource/status, or horizon winner.

| Pure kit | Recorded result |
| --- | --- |
|vanguard:approved-entry-kit|completed round21|
|lifebinder:approved-entry-kit|completed round18|
|farstrider:approved-entry-kit|completed round13|
|shadehand:approved-entry-kit|completed round15|
|ironfist:approved-entry-kit|completed round24|
|chronist:approved-entry-kit|completed round13|
|bastion:approved-entry-kit|active after40 rounds|
|ravager:approved-entry-kit|completed round15|
|edgedancer:approved-entry-kit|completed round20|
|wildwarden:approved-entry-kit|active after40 rounds|
|runeblade:approved-entry-kit|completed round16|
|dawnshield:approved-entry-kit|active after40 rounds|
|cinderweaver:approved-entry-kit|completed round10|
|frostweaver:approved-entry-kit|completed round14|
|stormsinger:approved-entry-kit|completed round16|
|tidecaller:approved-entry-kit|completed round12|
|aetherist:approved-entry-kit|completed round13|

These are not17 matchup distributions, optimal human play, all eight Skills or all153 class/Essence cycles. The observed Wildwarden mirror commits Pursuit once, then mostly Basic pressure and Field Remedy after closure; its Mark/Snare/setup role is not represented by those choices. This makes a blanket heal nerf particularly underdetermined.

## Asymmetric pressure and selected counter kits

All are real Level100, seed1PvP, the same flat board/range. Ordinary approved Vanguard/Cinderweaver kits are pressure comparisons; the Vanguard starter kit does **not** contain Guard Break. Dedicated counter kits are independently learned legal four-Skill alternatives: Vanguard swaps Cleave for Guard Break; Lifebinder uses Mend/Barrier/Vital Sever/Fortifying Light. No extra slots or silent skills. Cast counts establish committed roots, not that every cast hit, removed Guarded or applied Healing Down. Guard Break does not bypass ordinary Physical Defense; its armor-ignore field concerns separate equipment Armor.

| Subject | Ordinary Vanguard | Cinderweaver | Learned Guard Break kit | Learned Healing Down kit |
| --- | --- | --- | --- | --- |
|bastion|active after40|completed35|active after40|active after40|
|wildwarden|completed23|completed13|completed23|completed14|
|dawnshield|completed21|completed17|completed21|completed30|

Bastion remains a pacing blocker across its mirror and these selected physical/anti-recovery comparisons. Wildwarden and Dawnshield can finish substantially sooner against other roles. A counter existing, being equipped or being cast does not by itself establish adequate counter pressure or broader balance.

## Exact sustain receipts

Three replayed40-round mirrors wrap original shared action/movement/turn transitions, returning exact results. Every command and final HP/MP matches its unobserved pure run. Every transition's HP delta reconciles with actual damage/healing event HP-before/after fields; final total HP reconciles with initial1000HP plus healing minus damage. Barrier absorption is separate, never counted again as HP damage. These are totals across **both** combatants.

| Mirror | Actual HP damage | Actual HP restored | Barrier absorbed | Final total HP |
| --- | ---: | ---: | ---: | ---: |
|bastion:approved-entry-kit|1173|750|225|577|
|wildwarden:approved-entry-kit|1610|897|0|287|
|dawnshield:approved-entry-kit|1537|1471|40|934|

Hold Fast accounts for750 restoredHP; Field Remedy897. Sacred Guard restores557 and Dawn's Oath914. This identifies concrete sustain contributions, not the counterfactual duration if a row were weakened: action selection, lost offensive AP, range and later cooldowns would change. Increasing a recovery AP cost may remove attacks as well as healing, so faster matches cannot be assumed from a higher price.

## Evidence and limits

One-off successful runs:20 opportunity traces (`113723874404`,223.66seconds);16 new pure pacing cases (`113857106926`,182.82seconds);6 ordinary pressure comparisons (`114305079287`,81.91seconds);6 selected counter comparisons (`114402956892`,96.98seconds);3 receipt replays (`114713388534`,68.11seconds). These51 diagnostic executions include6 prior-baseline and3 receipt replays:42 factual completions and9 still-active horizons, not51 unique scenarios or51 routine tests. The16 permanent release/counter tests are separate.

Exact drivers, original failed diagnostic, raw five JSONL sets, aggregate analysis, baseline raw sample, source/data hashes, analysis/reconciliation scripts and receipts are retained in recovery evidence; temporary discovery copies are removed before repository checks. Reproduction: at the frozen source, copy one retained driver beside the legal-duel test helper, give its stated AUREVANE_*_EVIDENCE variable a fresh output path, run that single Vitest file directly through the web workspace, and remove the temporary discovery copy afterward. Raw results and driver hashes remain immutable. Preserve previous archive prerequisites and both active workspaces.

Single-seed flat mirrors and two seed/context variants do not establish all-target/terrain/elevation/ally roles, difficulty grades, acquisition, optimal strategy, full lifecycle/security/hosted behavior, native browser/editor/readers/prose/derived tags/Atlas, current Owner-edit reconciliation or human acceptance. No hosted write, publication, activation, merge or deployment occurred.

## Next correction scope

Prioritize actual ranged/setup opportunity handling and the separate sustain budgets of Hold Fast, Field Remedy, Sacred Guard and Dawn's Oath. Compare each exact candidate in the original and named counter contexts at Levels1/100 and PvE/PvP before accepting a change. Preserve defensive/support identity, four earned Skill slots, existing stats/Defense/AP formulas and historical immutable versions. No fatigue rule, forced finish, universal cooldown/price multiplier or new hidden mechanic is selected.

A broader AI lookahead redesign needs its own explicit architecture/knowledge/latency contract; do not introduce future-RNG access or a parallel forecast engine. Current evidence supports a narrower next investigation, not silently selecting that architecture. Low-mana roles need valid genuine resource opportunities and actual consumption budgets separately; raising thresholds to make an action appear used would change its meaning.

Frozen source `f8abb170fa8b48fd0e7119af0af91624860cc0a5`, tree `120d4e056a43668f5686b9543c3005fe1971cca9`. Full root `115238205744`,11:52:38–11:56:16UTC, exit0:8,197Vitest (4,115core/3,836web/246other)+7Node; format/lint/eight types/both builds pass. Combined review accepted below. Exact Git recovery bundle and full diagnostic evidence are preserved as a documentation-only descendant; local blob hashes, remote four-entry tree and remote head are verified before claiming backup success. No runtime source changes after the frozen gate.

## Combined review and individual parent rulings
Fresh-context gpt-6-astra High review of `e7820890..f8abb170`:0Critical/0Important/0newMinor. Raw counts, all opportunity/pure/counter aggregates, six baseline replays, three receipt replays, every-transition HP reconciliation and all12 driver/data hashes independently agree. No fix pass or rereview. Prior six deferred Minors remain unchanged.
Final: Ruling: All153class/Essence cycles and136pairs — retain Task15 individual cycle acceptance; selected kits/opportunities are narrower — Cost if wrong: unexercised cycles could remain broken.

Final: Ruling: Broad balance/difficulty/matchup distributions — keep acceptance open; limited flat-board seed/context sampling only — Cost if wrong: unsampled imbalance could ship.

Final: Ruling: Optimal strategy/ranged retreat/kiting/setupAI — retain separate investigation; availability and observed use are not optimality — Cost if wrong: legal but poor tactics could obscure intended roles.

Final: Ruling: Counterfactual recovery prices or reserve thresholds — require exact candidate trials before changing definitions; no uniform repricing from these observations — Cost if wrong: a supposed fix could weaken support or slow combat.

Final: Ruling: Full status history/individual quote-issue causality — retain explicit observer omissions and aggregate-issue limits; only actual HP/MP/AP where recorded, original-state quotes and events are used — Cost if wrong: incorrect causal diagnosis could drive harmful changes.

Final: Ruling: All terrain/elevation/obstacles/allies/target counts — retain role/geometry integration coverage; these are flat duels — Cost if wrong: intended roles could fail elsewhere.

Final: Ruling: Earning/mastery/advanced prerequisites — treat earned facts as fixture inputs while actual save/load/admission is tested; progression remains separate — Cost if wrong: unearned or inaccessible kits could be misrepresented.

Final: Ruling: Complete Controlled lifecycle and modifier composition — retain cancellation/defeat/source-removal/attachment gates; this branch is the named ordinary Aether-in-Poise release — Cost if wrong: lost primes or incorrect attachment costs could remain.

Final: Ruling: No-input/free-prime/repeated-event safety — retain final integration; manual turn ends are not timeouts or recursive-event witnesses — Cost if wrong: unbounded effects, extra turns or duplicate payment.

Final: Ruling: Interrupted Move/all unreached-origin attacks — retain broader interruption checks; one actual reached tile and four rejected paths are bounded evidence — Cost if wrong: an attack could originate from an unreached tile elsewhere.

Final: Ruling: Stale-browser/alternate-character/direct-RPC expiry/revocation/CAS — retain Tasks8/16 authority gates; no corresponding production changes — Cost if wrong: stale or unauthorized access could survive.

Final: Ruling: Malformed nested/captured/pending/summon and recursive privacy — retain hostile-input/parser/serialization gates; valid capture usage is narrower — Cost if wrong: corruption, historical substitution or private accuracy leakage.

Final: Ruling: Concurrent publication/build/claim/recovery/settlement — retain physical concurrency/SQL/coherent-commit/no-contest gates; local fixtures do not establish them — Cost if wrong: duplicate or inconsistent durable outcomes.

Final: Ruling: Owner edits/history/release reconciliation — require final current-state/hosted reconciliation; append-only historical definitions remain unchanged here — Cost if wrong: Owner edits or historical definitions could be overwritten.

Final: Ruling: Complete prose/derivedTags/editors/readers/Atlas — retain full presentation audit and known Atlas gap; no consumer changes here — Cost if wrong: misleading or inaccessible mechanics presentation.

Final: Ruling: Long names/history/mobile/native keys/touch/200percent zoom — retain finished native-browser checks; no new physical browser evidence — Cost if wrong: overflow or inaccessible primary controls.

Final: Ruling: Hosted behavior/human gameplay/release acceptance — keep open; local deterministic evidence does not authorize release — Cost if wrong: premature release or unsatisfying play.

Final: Ruling: Final full gate/durable recovery — require frozen8197+7 actual completion and exact archive blob/head verification; prior gates are not substitutes — Cost if wrong: incomplete checks or unrecoverable evidence could be mistaken for closure.
