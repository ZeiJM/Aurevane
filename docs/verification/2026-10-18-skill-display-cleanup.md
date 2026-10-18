# Skill display cleanup

Owner request: separate the Technique Preview explanation bullets from the Line of Sight row, omit a single-turn duration only for Instant effects, and use compact modular requirements across shared Skill readers. Release these corrections before resuming the broader Master Panel work.

Base: `ebfa6933fe76b67aee204a7969e58effd360e45f`. Isolated branch: `agent/skill-display-staff-20261018`. Preserve the live modular catalogue, timing policy, immutable captures and independent World PR #937. No migration or content publication is needed.

The preview explanation list gains a 0.6rem top margin. Shared compact effects omit `1 Turn` when their resolved timing is Instant; canonical wrappers apply the same rule after elemental/Blindside clock formatting. Longer durations and non-Instant durations retain their actual clock. This changes labels only, not execution or expiry. Requirements use names and subject brackets, including `Attack [Physical] & Guard [Self]`; absence, target, HP limits and All/Any grouping remain. Fallback Skill and summon readers reuse the same compact prerequisite formatter.

Regression evidence: the first three new tests failed on the original code for visible Instant duration and lower-case slash action wording. Three added elemental cases failed on `1 affected turns`, and the fallback case failed on sentence-style prerequisites. The covering character-reader suite passes after repair. Existing assertions that required the superseded single-turn labels were updated; captured mechanics and input-immutability assertions remain.

One independent combined review identified the elemental clock and fallback requirement gaps. Both have focused regression repairs. Re-review reports zero Critical, Important or Minor findings. Complete quality/CI and production receipts remain required before claiming this correction live.

Local native browser verification could not launch: Chromium was absent and both standard and headless Playwright downloads returned invalid archives. The existing modular readers browser workflow remains the native acceptance gate; local unit rendering is not a hosted interaction claim.
