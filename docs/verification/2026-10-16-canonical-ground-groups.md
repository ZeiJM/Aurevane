# Canonical persistent Ground groups — Task15 implementation milestone

This implements the selected `canonical-group-ground-v1` bridge from the reviewed roster design. It is a bounded Task15 checkpoint, not whole-roster balance acceptance or the combined combat release. No roster content is activated and no hosted data, migration, merge or deployment is changed.

## Behavior

- An Ability action group may own one finite persistent Ground area, with a registered visual preset, captured activation timing, one to four rounds and distinct group-local entry effect IDs.
- Parser validation rejects missing/duplicate/unresolvable entry IDs, non-Ground/mixed targeting, actor-only or unsupported entry packets and Controlled persistence. Repeating Pierce remains unavailable because native entry does not run its equipment-Armor resolver; ordinary cast Pierce is unchanged.
- Canonical materialization resolves IDs after specialized Move/Summon packet filtering. Reordering the group retains the intended entry packets and their origins. The existing native Ground handler owns area creation, immutable caster/content capture, source visibility, activation/expiry, traversal and per-cast/recipient/turn claims.
- Areas retain aligned entry origins, cast-time recipient eligibility and explicit packet timing through JSON restore and source removal. Null represents an omitted optional override in JSON. Malformed arrays/values fail restore validation. Entry uses the existing immediate native pulse after area activation; it does not schedule another delayed cast or repeat command costs/caster effects.
- Conditional percentage Poison/Burn settlement and status-resistance forecasting now honor each packet's captured recipient eligibility. Ineligible effects do not apply or create resistance rolls/receipts. Absent historical masks preserve native behavior.
- Canonical group authoring reuses native Ground enablement, duration, timing and preset controls. Invalid intermediate effect/target/mode edits retain a visible disable/repair route. Shared ten-field readers put Ground lifetime/entry delivery in Target. Safe viewer projection still excludes payloads, eligibility masks and frozen caster data.

## Evidence

Meaningful RED→GREEN cases and their complete logs are retained in this plan's verification ledger. The tests exercise parser rejection, stable-ID routing after Move removal, exact ordered origins/timing, empty-tile placement, one payment, entry/re-entry, finite expiry, JSON restoration/source removal, malformed captures and safe projection. All three exact reviewed provisional Ground plans compile and execute; the real build-aware AI chooses and commits a captured persistent Ground action. PvE/PvP deterministic Master previews create the area without consuming RNG or exposing private area state.

One fresh combined review of all milestone files and relevant callers found two Important issues: conditional entry eligibility was missed in specialized DoT/resistance consumers, and intermediate edits could hide invalid Ground metadata. Both received failing regression cases before fixes. The author fixed them in one combined pass; the reviewer did not re-review the amended source or duplicate broad suites.

First complete `pnpm check`: exit0, 6,987 Vitest tests plus seven Node checks, formatting/lint/types/build, receipt `20261016T023713050132Z` (before review fixes). Final post-fix `pnpm check`: exit0, **6,992 Vitest tests plus seven Node checks**, formatting/lint/types/build, receipt `20261016T024614924223Z` (02:46:14–02:48:58Z). Final code source was unchanged throughout that run. The native configuration advisory remains visible.

The existing Vite native-config-loader advisory remains visible. Physical protected Master editor/publication browser flows, complete low/high-level PvE/PvP balance, all-roster AI acceptance and combined Targeting/Move/Basics/Controlled/reader acceptance remain release gates. Static renders and kernel tests do not establish those gates.

## Decisions and remaining display item

The implementation uses the approved native Ground clocks/claims rather than a second area executor; an expectation mismatch would require an explicit subsequent design decision. Pierce entry is deliberately narrower than cast authoring until its specialized resolver can be preserved. High implementation proceeded with one inline implementer and one fresh combined review.

Minor deferred to the existing Task15 shared-display audit: the Target delivery note should identify the selected repeated subset when a general authored group has additional cast-only unit effects. All three selected roster plans repeat every applicable nonactor unit effect, so their current delivery note is accurate. This wording refinement remains before the coordinated combat release.

Next: prepare/apply complete immutable roster versions without modifying the accepted design checkpoint, finish explicit modifiers, active/Controlled Resonance controls and truthful noncast Skill states, complete conditional/event previews and the coordinated concise/plain-language/orange-effect display audit. Preserve all broader Master/world scope and the High/Extra High checkpoint-and-pause agreement.
