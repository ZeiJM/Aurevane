# Controlled AI positional and request-bound checkpoint

This follows durable AI checkpoint `cf7fb39959ce57156d1c56366e802c032db68161` (local `7dabaac892c194d44a6bf2c195a9a35d25115e68`). It does not complete Task4, native acceptance or the partial release.

## Successful progress at the request bound

An actual service regression admits nine distinct cheap once-per-battle Controlled actions, a surviving high-HP opponent and deterministic hit outcomes. The original service commits 16 legal steps and then throws `PERSISTENCE_UNAVAILABLE` solely because the request budget is exhausted. That is the observed product RED, not a failed combat command.

The service now returns its existing owner-projected view after a full committed page. The 16-step bound, per-step version/CAS and ordinary final-facing/turn-end path remain. No automatic forced end or additional AP budget is introduced. The existing battle controller updates to the returned version and schedules another request while the opponent still owns the turn. The regression explicitly resumes with the new version, completes all nine releases exactly once, and returns control normally. A second variant completes through final facing on the sixteenth step and returns success. Its initial cost1 fixture allowed three Basic attacks instead of the intended one; correcting the fixture to cost7 is excluded from product RED evidence.

## Useful Rewind preparation and release

The planner can prepare a legal Controlled Rewind before an already useful closing move from a tile more than one Manhattan step from a visible living enemy. It uses the same actual simulated prime and legal release evaluation as other Controlled actions, without locking a route or consuming resources. It does not immediately pay to return to the same tile. The once-per-battle admission bound prevents repeated free preparation.

Positional utility reads actual legal projected `combatant_rewound` events. Below 62% HP, increasing distance from the nearest visible living enemy earns retreat utility with greater urgency at lower HP. Otherwise decreasing distance earns approach utility. Distance influence is capped at four tiles; unchanged/unhelpful returns add no positional value. Invisible enemies are excluded from this new positional heuristic. This is a bounded tactical heuristic using Manhattan distance, not an exhaustive path/threat search or a claim that the existing baseline AI has complete visibility modeling.

Two regressions initially fail because AI walks without preparing and attacks while ignoring the useful saved escape tile. They now pass through the real prime, native walking and paid return. Additional checks retain healthy anchors and exclude an Invisible enemy as a preparation beacon. Returning preserves spent Movement and consumes the prime. The first retreat score was lower than the baseline Basic attack score126; inspection exposed that ranking and the final bounded health-urgency score corrects it.

Focused core checks pass79 tests across four files, including the four new positional cases. The actual build-aware service file passes all three cases, including both request-bound variants. The adjacent service suite passes37 cases; its initial combined run contains only the described seven-action fixture failure, which is subsequently corrected. Final direct `pnpm check` exits0: fresh core3,119/161 and web2,586/305 plus seven Node checks; cached DB98/15, validation102/9, audio17/3, realtime3/1 and worker2/1. Format, lint, all eight package types and both builds pass (web rebuilt). Main is freshly confirmed unchanged at `29506e293e81abef1b0b8a46099618ab3ae3f0ae`. Native continuation and visual acceptance remain pending.

## Remaining release gates

Owner-safe readiness and blocked states, ready-only light within existing Skill artwork, native keyboard/pointer/touch and reconnect matrices, race-safe catalog policy/content compatibility, one-time Rewind content migration preserving later Owner edits, needed editors/readers, miss-dependent secondary effects, creative balanced every-tag roster and final whole-branch review/integration/deployment. No hosted mutation or live change is made here.
