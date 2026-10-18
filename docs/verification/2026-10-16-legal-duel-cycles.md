# Legal two-build roster replays and actual equipped choices

Status: bounded local validation, one combined review and both final frozen-source gates passed. Task15/16 and release acceptance remain open. Base `5ed4fe9bc2fb6bbb331344ac92edb22dd05ec445`. No hosted write, publication, activation, migration, merge or deployment.

## Result and evidence boundary

Both opponents now enter the replay through actual local publication, learned-loadout save/load, current version resolution, pinned authority restoration, canonical capture and the existing battle-start activation path. Each has four equipped Skills and its exclusive exact-version Essence or Resonance. Identities differ and use the real character-derived profile factory correctly. Current V5 derived stats, current combat policies, actual Accuracy/Defense/resistance/RNG, payment, cooldowns, Manual modifiers, Controlled planning, ordinary movement and turn completion remain authoritative. The fixture uses the approved seventeen Library entry kits and all136 authored pair kits in both Primary orders,289 kits in total. Earned/mastered records are fixture facts; actual progression awards and advanced prerequisites remain separate acceptance.

The original306-build/1,224-opening admission suite is retained. Its encounter function and all312 assertions are byte-identical to the prerequisite checkpoint; only its publication/earned-build setup moved to a shared test helper, with unchanged default identities and a parameter for the new independent participants. The previously deferred double-prefix provenance Minor in that original encounter remains untouched. No production combat, roster definition, price, formula, UI, hosted content or active builtin is changed by this milestone.

The replay drives the actual build-aware Recruit planner and shared executor for both combatants. It restores/validates JSON state after every committed command and checks real resource bounds and immutable input. A finite diagnostic horizon leaves an unfinished encounter active. A separate natural Level1 Vanguard mirror reaches a genuine terminal result within its bounded32-round allowance; the actual defeat/completion event is required and later turn input rejects without mutation. Neither horizon forces victory, a twelve-round finish or balance acceptance.

| Scope | Actual checks |
| --- | --- |
|Legal Vanguard mirrors|Both Levels1/100 and PvE/PvP contexts, both real builds, current captures/provenance, actual actions/damage and real turns|
|Mercy at the Breach|Actual2+2 kit in both Primary orders, Levels1/100, PvE/PvP. Real opposing Basic attacks earn the60%HP window. Compare an ordinary Forceful Strike with the paid50AP/5MP Resonance and actual connected5%maxHP recovery. Opposing equipped Vital Sever applies Healing Down and reduces that real recovery by25%. Actual cooldown rejects repeat use.|
|Mercy miss|Both Primary orders at Level1, seed12345: actual80% hit chance and roll8930 miss, full50AP/5MP payment/cooldown, no hostile damage or secondary recovery. Connected comparisons use stated Level1seed1; Level100seed12345. No stats, statuses or RNG state patched.|
|Veiled Conduit|Actual2+2 kit in both Primary orders, Levels1/100, PvE/PvP. Actual Mana Shield35AP/6MP establishes Guarded. Resonance35AP sacrifices it, returns4MP and applies finite Covert. Combined70AP/net2MP payment; repeated use rejects, ordinary turn completion expires concealment and missing Guarded still rejects after cooldown. External Sensory/area counterplay is not established by this case.|
|Broad mirrors|All17 pure kits plus272 pair/Primary combinations play four natural Level100 PvP rounds or reach a genuine terminal state. This is bounded integration coverage, not all authored setup/payoff/counter cases or match balance.|

## Verification receipts

- New scaffold RED `102736129041`: missing duel helper, not a production gameplay defect. First helper types `102919024395` catch wrong lifecycle field, erased build-bridge type and unknown event typing; corrected through the real read adapter and safe event narrowing.
- Original312 admission assertions pass within `102913208003`; that combined run fails two new fixture assertions expecting a raw source ID. Corrected the new expectation to canonical `character:<id>`; did not alter the old double-prefixed fixture.
- Vanguard actual mirrors GREEN `103022151382`:3 tests. Terminal-versus-horizon GREEN `103952583503`:1 additional test; native manual End Turn is not represented as an idle timeout.
- Mercy initial `103255158817` catches an incorrect fixture call to `readPv1fActionEconomy`; use its real state/id/current API. `103311216813` shows actual Level1 Vital Sever missing, rather than installing Healing Down. Retrying only after real cooldown yields8 conditional checks at `103415234065`.
- Strengthened positive-hit assertions RED `103553467117`: the same seed also misses Mercy at Level1. Those conditional zeros alone were insufficient to prove sustain. Connected comparisons with stated seed1 pass8 at `103639942921`; retain the observed seed12345 miss as two explicit negative cases. Combined13 at `103722491118` include the3 initial mirror checks and10 Mercy cases.
- Veiled equipped choice GREEN `104050454439`:18 payoff cases. Creation then follows the exact real startup activation API, retaining its events; covering GREEN `104249384253`:22 tests across payoff and duel contracts.
- Initial complete289-mirror baseline GREEN `103100291324`:10:31:00–10:41:54UTC,653.84seconds. This pre-finalization run directly reconciled captures before turn preparation. Final source additionally invokes the real battle-start activation API. Its frozen complete-matrix run is required below; the first289 is not substituted for that final-source gate.
- Final web types `104351135145` and scoped ESLint `104350446724` pass; final targeted22 `104457638411` passes. Both frozen gates and review are recorded below. Durable source/evidence backup follows documentation finalization.

## Reproduction and cost

Routine `pnpm check` retains all17 classes plus both Primary orders of the four selected pair contracts:25 mirror cases, alongside all22 targeted cycle cases and the original312 admission tests. The complete289 mirror matrix took nearly11minutes by itself, compared with the previous whole repository check's roughly4minutes. Run it explicitly before roster/combat acceptance:

```sh
AUREVANE_FULL_ROSTER_CYCLES=1 pnpm --filter @aurevane/web exec vitest run src/server/battle/roster-legal-duel-matrix.test.ts
```

Optionally set `AUREVANE_ROSTER_DUEL_EVIDENCE` to an existing local output directory's JSONL file path. Each case appends its actual seed, horizon, final resources, immutable source versions and actual commands/selected modifiers/AI utility/candidate counts. Start with an empty file; receipt and source identity are recorded separately. These are fictional fixture identities, private local evidence, not a player-facing diagnostic or hosted mutation. Turbo's default strict environment does not forward these flags, so use the direct filtered Vitest command rather than assume the root check selects the complete matrix. Routine and complete gates are reported separately.

## Parent decisions and remaining acceptance

Ruling: extract shared actual publication/save/load setup, preserve the old assertions/defaults, and supply independent real participant identities for new duels — it avoids copying or importing another test module — cost if wrong: lost admission coverage or accidental authority changes; the original full suite remains required.

Ruling: keep current Accuracy/resistance and explicit deterministic seeds. Preserve the observed paid miss separately instead of counting zero conditional recovery as a positive payoff — cost if wrong: overstating sustain/counter evidence; connected and missed outcomes are independently asserted.

Ruling: initialize the fixture through the same battle-start activation API as actual PvE/PvP creation, then restore JSON without reactivation — cost if wrong: missing startup/condition truth or duplicating an automatic activation; final current-source gates include the complete matrix.

Ruling: separate the explicit expensive289 replay from25 routine mirror checks while preserving every class and the four selected pair contracts in both Primary orders — cost if wrong: unsampled pair-only failures could pass routine CI; the complete explicit gate remains required before roster/combat acceptance.

Ruling: four natural rounds and two actual equipped decisions are bounded mechanical/integration evidence, not acceptance for all136 pair strategies, all153 class entries, natural Level1/100 PvE/PvP balance, arbitrary mirror lengths or experiential uniqueness — cost if wrong: premature release with untested cycles/dominance/pacing. Continue distinct-cycle and full-match analysis without changing prices/formulas to manufacture a result.

Native browser/key/pointer/touch/mobile/zoom, broad orange/prose/derivedTags/editor/reader acceptance, Living Atlas/motion, current Owner edits, hosted timing/CAS/persistence, operational load/restarts and human acceptance remain open. All five earlier deferred Minors remain. Deployment lock remains unchanged.

## Final frozen-source result

Source `b586c2d4d363d2864185b92557c920018013ff5a`, tree `2baa20f39dcf2d093eb1a5c6f048eaf633aa6356`. No source changes after the freeze; finalization changes documentation only.

Full root `pnpm --reporter=append-only check` receipt `104539928232`, 2026-10-16T10:45:39.928232+00:00 to 2026-10-16T10:49:23.193031+00:00, exit0:8,160Vitest (4,115core,3,799web,246other),7Node tests, formatting/lint/eight-package types/both build tasks. This includes the routine25 mirrors, all22 targeted cycles and the preserved312 admission cases.

Explicit complete289 mirror receipt `104539928945`, 2026-10-16T10:45:39.928945+00:00 to 2026-10-16T10:56:33.607046+00:00, exit0. It uses the final real startup factory and writes289 unique actual kit records. Independent evidence audit verifies all17 pure kits,272 pair/Primary combinations, both participants' exact four Skills/exclusive extensions/current versions/captured ownership, Level100maxHP500, actual command references/selected modifiers and finite horizon/resource bounds. JSONL SHA256 `b123c64b612b93d1e28aecb908b8b649805201620686a0215d5a9848ad217870`.

The traces contain 8227 real planner commands; final lifecycle counts are `{'active': 289}`. The289 kits equip94 of136 Skills, leaving42 Skills outside this particular matrix. Of128 manual-action pair definitions, 37 are observed as committed roots and91 are not chosen in this context. Selected modifiers, primes, Automatic/Ongoing contributions and every advertised effect must be assessed at their own evidence boundaries; these root counts are not a completeness score.

The board is explicitly flat5×3 with adjacent single opponents and one stated seed. All17 initial pure mirrors remain active after4rounds. Farstrider uses only Unarmed Basic there; Wildwarden uses Basic/Field Remedy. Current baseline movement enumeration requires strictly reducing enemy approach distance. These observations do not establish a class weakness, a required retreat strategy or a balance defect: starting inside minimum range can be valid counterplay and Basic may be rational. The next mechanical comparison must provide a real ranged opportunity, actual paid enemy closing and paid retreat before any strategic or numerical change is proposed.

One fresh combined read-only review of the exact7-file range found0Critical,0Important,0newMinor. Parent agrees with grades; no C/I fix pass or rereview. The reviewer independently confirmed preserved assertions, real authority/profiles/startup/executor and the directed positive/miss/counter/finite-clock evidence.

## Individual parent rulings on reviewer exclusions

Final: Ruling: Final root check — Accept the frozen-source actual receipt104539928232, exit0,8160Vitest+7Node plusformat/lint/types/builds; reviewer does not duplicate the parent run — Cost if wrong: unrelated integration regression if the source/receipt attribution is wrong.

Final: Ruling: Final289mirror gate — Require the final-source explicit gate and its complete289-row evidence audit before checkpoint finalization; the earlier653.84-second capture-only baseline cannot substitute — Cost if wrong: a regression introduced by real startup activation or final trace changes could remain.

Final: Ruling: All153class and136pair cycles — Keep individual setup/payoff/counter acceptance open; two directed choices plus bounded mirrors do not establish all cycles, and these approved kits equip94of136Skills — Cost if wrong: missing or ineffective authored cycles could be overlooked.

Final: Ruling: Ranged/kiting/ally/formation/elevation roles — Name the flat5x3 adjacent single-foe limitation explicitly and retain role-friendly scenarios as open; observed FarstriderBasic-only and WildwardenBasic/FieldRemedy choices are not class weakness or balance conclusions — Cost if wrong: unjustified AI or price changes from an unsuitable opportunity.

Final: Ruling: Full-match balance and12round pacing — Keep completed-encounter distributions, more seeds/contexts, sustain and long-cycle dominance open; no forced completion or formula/price changes — Cost if wrong: unbalanced or slow/degenerate gameplay could ship.

Final: Ruling: Complete AI strategic quality — Accept actual planner/executor integration but retain comprehensive tactics/Modifier/Controlled utilization as open; baseline movement only reduces approach distance, so deliberate ranged spacing needs an explicit strategy judgment — Cost if wrong: legal but inferior choices could conceal intended class roles.

Final: Ruling: Complete counter/interruption/history matrix — Accept only the named cooldown/miss/HealingDown/concealment and genuine terminal contracts here; existing earlier mechanics suites remain evidence at their actual narrower boundaries — Cost if wrong: Barrier/lethal/source-removal/queued/idle-timeout or other legal-kit combinations could fail.

Final: Ruling: Progression and advanced prerequisites — Treat learned/mastered records as seeded fixture facts, retain actual acquisition/award/prerequisite acceptance separately, and preserve eligibility without new grants — Cost if wrong: unearned or inaccessible content could be mistaken for a normal progression route.

Final: Ruling: Native browser and editorial consumers — Keep actual browser/input and broad prose/orange/editor/reader acceptance open; no UI change is part of this test milestone and known browser unavailability does not justify repeating failed install/tunnel loops — Cost if wrong: inaccessible or misleading real input/readers could remain.

Final: Ruling: Hosted authority/persistence/CAS/operations — Keep SQL transactions/concurrent receipts/restart/load acceptance open; local in-memory services and JSON restore establish narrower contracts — Cost if wrong: hosted-only integrity or lifecycle failures could remain.

Final: Ruling: Current Owner edits and release compatibility — Perform the final main refresh and preserve current hosted Owner edits; no publication/reconciliation/backfill/merge/deploy is authorized by this evidence — Cost if wrong: stale publication could overwrite edits or bypass release reconciliation.

Final: Ruling: Human gameplay acceptance — Keep experiential uniqueness/enjoyment and human acceptance open; never infer it from deterministic replays — Cost if wrong: mechanically legal but unsatisfying play could be declared accepted.

## Prior deferred Minors

Final: minor (deferred): Rewind prime witness starts at its origin; separate Controlled anchor evidence exists.

Final: minor (deferred): Supporting Shot fixture does not pin its version.

Final: minor (deferred): Literal Ongoing pair fixture does not pin its dynamic pair ID.

Final: minor (deferred): AI repeats bounded route/target discovery across candidate modifier bundles; no demonstrated per-command timeout.

Final: minor (deferred): Original admission fixture passes a prefixed actor ID to the character factory, yielding double-prefixed provenance; numeric stats unchanged.


Task15/16 remain open. The recorded actual tests and unresolved role/cycle/whole-match/browser/hosted/human gates are carried forward; no release activation is implied.
