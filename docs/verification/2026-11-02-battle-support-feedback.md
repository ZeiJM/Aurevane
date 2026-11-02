# Battle feedback and universal support actions — November 2, 2026

Status: implemented and independently reviewed; the assembled local quality gate passes. Not live. PR #1003 collects the batch; its initial `fbb56f8` head covers only the earlier subset.

## Resulting behavior

- Endure, armed Reversal and Reversal Strain block all manually initiated damaging attacks, including Basic Attack, Discipline and Essence. Endure reports an empty release explicitly and uses compact application/help text. Reversal preparation conceals its Physical/Mystic family.
- Shared targeting highlights follow legal current aim ranges and affected footprints. Utility-only tags, Copy effects and mixed actions use their actual target scopes; stale or illegal retained aim anchors cannot extend highlights.
- Tag execution lines are shorter, including Blind without the redundant zero-Accuracy floor. Covert confirms an application to its caster without exposing concealed information to opponents.
- Ground targeting creates persistent fields by default in current authoring. Its controls live in Effects and disappear without a Ground tag. Instant placement appears as an active field; explicitly delayed and historical timing remains literal. Twenty animation presets and six occupant scopes share desktop/mobile, PvE/PvP/spectator rendering.
- Resonances expose automatic target choices for the three purposes. Saving and committing preserves actual authored identity, artwork and name in captured battle controls and Chronicle. Commit feedback reflects the existing durable commit result.
- Current encounter cooldown groups are scoped to their ability identity, preventing unrelated Skills from sharing a raw `main` clock. Intended same-ability and Recovery grouping stays intact.
- Current explicit All effects expose friendly fire and include the caster when selected. All Push moves the caster forward along facing; Pull moves backward. Other recipients use the frozen caster origin. Historical unmarked All remains literal.
- Current Reflect returns actual eligible Barrier absorption plus HP loss, without double counting, overkill inflation or recursion. Historical encounters remain HP-only. Reversal retains its established Barrier interception rules.
- Current Support choices are HP Recovery, MP Recovery, Pilfer, Fleetstep and Invocation. Guard is retired as a Skill; defensive statuses and immutable history remain. Pilfer adds inert Loot, Fleetstep supplies extra movement, and Invocation summons Vesper, a silver-blue mythical moon drake. Wildwarden receives Briar Snare in place of its current Summon.
- Guided Fundamentals uses captured HP Recovery and starts with missing HP. Actual recovery completes the support lesson; historical encounters retain their original Guard criterion.

## Verification boundaries

Focused tests exercise canonical command admission, actual commits, captured history, replay/reload, source restrictions, native Summon AI/lifetime, current editor Save→Commit→database readback and old immutable cohorts. Independent reviews caught and resolved candidate-specific automatic-trigger evidence, stale targeting anchors, invalid friendly-fire normalization and the retired Guard tutorial path.

Native Chromium checks passed for the new Support actions across playable PvE/PvP and spectators at desktop/mobile widths (18 cases), including actual decoded action art and Vesper board portraits. Current Basic authoring/service mutation and revert passed at four widths. Ground and automatic-target authoring native checks, the twenty-preset/reduced-motion palette and the earlier full command feedback matrix also passed during development.

The SQL migration is source-only. PGlite exercises the real migration chain and audited Guard retirement, exact historical receipt replay, five current Support selections, seven current Basics, archived Guard reads, new Basic metadata and the inert Loot tag. Native Docker-backed concurrency and signed-in full-stack acceptance remain CI responsibilities; Docker is not available locally.

Final `pnpm check` passes: formatting, lint, all package types, **15,984 Vitest tests**, seven Node tests and the optimized production build. Package counts: game-core 6,860; web 8,495; database 498; audio/realtime/worker/validation 131. The complete final-source command-feedback Chromium run exits successfully with zero page errors, and all 76 production-component targeting cases pass. The earlier Support18, four-width Basic authoring, Ground preset/reduced-motion and automatic-selector browser receipts remain applicable.

The immutable historical pacing benchmark explicitly retains Guard v1: natural victories occur in rounds 21, 14 and 19 under the unchanged 24-round ceiling. An explicit HP Recovery control records its different pace without forcing a result; this is not a claim of current balance acceptance. No historical proposal bytes or publication-version expectations were changed to make tests pass.

The PR handoff records the final tree and one current-head GitHub Actions check. Required hosted CI, signed-in acceptance and Owner hands-on balance acceptance remain separate. Focused development counts overlap and are not summed.

## Release boundary

No application deployment, hosted migration, content publication or merge has been performed for this batch. The compatible application and reviewed migration must release together. Installed catalogue overrides, especially the former Wildwarden Summon, must be reconciled through the ordinary versioned publication process before live rollout. Existing encounter clocks, policy flags and captured definitions remain pinned.
