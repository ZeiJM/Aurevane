# October9 summon readers and Blindside verification

Status: locally verified; not yet merged or deployed.

BaseMain: `8b7646ff7b3143c915fb13e8c3f943b6c8521634`. Isolated branch `agent/summon-compact-chronicle-20261009`. Existing Owner automatic release authorization covers these continuation requests. The Vercel Git deployment lock is unchanged. No database/SMTP work is needed.

Scope/design: `../superpowers/plans/2026-10-09-summon-readers-blindside-spec.md` and its companion plan. Three original defects were reproduced before implementation: duplicated inline summon parameters; missing departure receipts/identity for summons without ability casts; Blindside listed before Damage. Expanded Owner activation request reproduced front and missed casts incorrectly granting the buff.

Focused verification: 32core Blindside tests and181web reader/log/effect tests pass. The actual mounted inspection browser script passes all10cases: ally inspection in PvE/PvP at1366×768/390×844 plus summon inspection in PvE/PvP/spectator at both sizes. It verifies collapsed names+! rows, all ten full-reader fields, pinned45AP, hover/tap, layering, nested Escape, single-reader ownership, overflow and zero command authority/console errors. Desktop/mobile screenshots were visually reviewed. Full `NODE_OPTIONS=--max-old-space-size=2048 pnpm check` passes: formatting, lint, all eight package type checks,4,533Vitest tests plus seven Node checks, and the production build. Final source/tree/CI/deployment evidence will be recorded after completion. No human acceptance is claimed.

## Owner tests once live

- [ ] Inspect Verdant Stalker on desktop/mobile: each ability shows only its name and !. Hover/tap ! for the full ten characteristics, description and effect explanations; Escape closes the child reader first.
- [ ] Let a summon expire and defeat another: Chronicle and Copy Full Log explicitly name its departure; previous movement and incoming attacks still name Verdant Stalker.
- [ ] Inspect Perfect Opening, Backstab, Exploit Opening, Execution Cut and Flanking Cut: Damage is listed before Blindside, including effect explanations.
- [ ] Start a new battle. Use a Blindside Skill from the front: normal damage, no new BLS status and no Blindside activation in the log.
- [ ] Use it from side/rear: captured bonus damage and one-turn BLS status/log; buff ends at the holder's turn end. Misses and a Skill-authored100% modifier do not grant/refresh it.
- [ ] Repeat in playable PvP and inspect as a spectator; preserved historical battles retain their saved rules.


## Fresh review

A fresh reviewer found one material defect: earned Blindside pending applications were discarded during settlement because the reconstructed pending action contains only the status effect. Next-round and delayed regressions failed after JSON restore; restricting qualification to the granting cast fixes both, and all32core tests pass. No other material findings were identified.

Additional coverage deferred: mismatch/failing-resolver negative summon cases; an explicit same-version attack/departure grouping assertion; and actual randomized area/Ground packet hit scenarios beyond the deterministic canonical miss gates. The reviewer traced the existing fail-closed source checks, standalone grouping and packet gates and found no corresponding defect.

Validation environment: the first full check with a768MB Node heap exhausted memory in web types; the complete rerun uses2048MB. Standard Chrome required an unavailable Unix socket; the same actual browser script succeeded with official Chrome Headless Shell155.0.8059.39. These are runner limitations; no test was disabled and no browser behavior was substituted.
