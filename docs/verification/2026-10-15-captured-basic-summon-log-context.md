# Captured Basic and exact Summon log context — October 15

## Behavior and source authority

The persisted history-privacy reader already validates the private encounter snapshot. It now retains cloned, validated immutable Ability captures for server-side enrichment. Basic Attack, Guard, HP Recovery and MP Recovery use the visible event's actor/action identity and the unique matching complete `source.basic` record. The native unarmed action ID maps to its captured Basic identity. The log and clipboard retain that record's name, explanation, version and valid authored battle text. No current Basic catalogue lookup is made. Missing, wrong-owner, disabled or ambiguous captures do not invent metadata. Captures also work without a build-authority envelope.

Summon context still requires a viewer-visible spawn receipt, exact parent Skill ID/version and exact profile ID. A parent with a canonical Ability uses that Ability's unique matching Summon payload profile; it cannot borrow the native envelope's stale profile. Historical native parents retain their existing profile path. Spawn ordering, departed summon identity, pinned text and target narrator behavior remain intact. This reader correction does not enable canonical Summon execution.

Enrichment runs after viewer projection. Only whitelisted public names/text/version fields enter the log DTO; raw sources, behavior groups, private accuracy and build fingerprints remain private. Hidden commands cannot disclose the captured names. Ordinary movement receipts remain generic: they do not identify whether movement came from standalone Move or an attached Move, so this change does not infer an authored Skill from them.

## Verification

- First regression run: six expected failures (four Basic action contexts missing; participant/spectator capture metadata discarded), with48 existing cases passing.
- Independent canonical Summon regression: one expected failure showing stale Verdant Mend/Stalker names and stale native battle text instead of the exact canonical profile.
- Final covering run:110 tests across the actual log/context/privacy service, persisted repository authority and clipboard suites pass. Cases include every auxiliary action, native Attack alias, no build envelope, different owner, ambiguous versions, hidden commands, malformed persisted Basic metadata, native and canonical Summons, absent canonical spawn, departed Summons and serialized private-field omission.
- Full repository quality gate: `pnpm check` exits0, with6,149 Vitest tests plus seven Node checks, formatting, lint, all eight typechecks and both builds passing. The Python-waited run records an explicit exit receipt in `captured-log-check-exit.json` alongside `captured-log-full-check.log`. No product edits follow that gate before saving. New-head CI remains pending at save.

Prior durable head `7f9eda2ac17adcd9cd87d2e6089f6c5bd3942238` passes CI and the Skill Engine workflow. Native readers pass run38797111966/job116636298606; Controlled passes32 cases in run38797111978/job116636298824. Job logs are inspected. No new screenshot/layout acceptance is claimed for this server-reader-only slice.

## Open combat dependencies

At this checkpoint the handler audit found `materializeCombatAbilityAction` deliberately rejected action groups containing `summon` or `damage-bonus` with `canonical-specialized-tag-routing-required`. The subsequent implementation and acceptance of canonical Manual Summon routing is recorded in `2026-10-15-canonical-summon-command.md`; the original finding is preserved here as checkpoint history. Damage Bonus has a separate implemented modifier-composition path; Summon needed dedicated canonical execution routing before the new roster could rely on canonical spawn groups; that follow-up now supplies its supported single/final packet contract and execution tests. Native Summon execution remains separate. The registry entry alone is not execution evidence. Pierce explicitly targets future equipment Armor; current Physical/Mystic Defense must not be relabeled to fabricate bypass coverage.

The remaining twelve-surface audit, versioned Tag prose, any selected new execution extensions, creative full-roster rebalance, final whole-branch review and coordinated live release remain open. No costs, outcomes, stored events, layout, artwork, schema, hosted data or deployment change in this slice.
