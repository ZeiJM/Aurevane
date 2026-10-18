# Skill display cleanup

Owner request: separate the Technique Preview explanation bullets from the Line of Sight row, omit a single-turn duration only for Instant effects, and use compact modular requirements across shared Skill readers. Release these corrections before resuming the broader Master Panel work.

Base: `ebfa6933fe76b67aee204a7969e58effd360e45f`. Isolated branch: `agent/skill-display-staff-20261018`. Preserve the live modular catalogue, timing policy, immutable captures and independent World PR #937. No migration or content publication is needed.

The preview explanation list gains a 0.6rem top margin. Shared compact effects omit `1 Turn` when their resolved timing is Instant; canonical wrappers apply the same rule after elemental/Blindside clock formatting. Longer durations and non-Instant durations retain their actual clock. This changes labels only, not execution or expiry. Requirements use names and subject brackets, including `Attack [Physical] & Guard [Self]`; absence, target, HP limits and All/Any grouping remain. Fallback Skill and summon readers reuse the same compact prerequisite formatter.

Regression evidence: the first three new tests failed on the original code for visible Instant duration and lower-case slash action wording. Three added elemental cases failed on `1 affected turns`, and the fallback case failed on sentence-style prerequisites. The covering character-reader suite passes after repair. Existing assertions that required the superseded single-turn labels were updated; captured mechanics and input-immutability assertions remain.

One independent combined review identified the elemental clock and fallback requirement gaps. Both have focused regression repairs. Re-review reports zero Critical, Important or Minor findings. Complete quality/CI and production receipts remain required before claiming this correction live.

Local native browser verification could not launch: Chromium was absent and both standard and headless Playwright downloads returned invalid archives. The existing modular readers browser workflow remains the native acceptance gate; local unit rendering is not a hosted interaction claim.


## Additional Owner request: battle footer

The Owner added removal of the Modifiers button to this same first release. The shared playable battle no longer mounts the picker or routes its shortcut; obsolete picker-only preparation/quote wiring is removed. Canonical modifier execution, captured sources and existing saved keybinds remain supported by their current authorities. Both PvE and PvP render no button even with owned modifier records. Terrain and Cancel remain shared; the existing PvE Surrender button retains its own mode boundary. Native controller cases are updated to verify the removed interface across desktop/mobile and ordinary/Controlled/recovery/long modifier fixtures, rather than exercise a removed button. Engine and standalone panel/model tests remain. Independent incremental review found no Critical/Important issues; its obsolete bindings-loaded state observation is repaired.

## Modular conditions and explanation notes

Prime requirements derive the named ability and typed subject, such as Rewind Step [Primed] [Self]. Resource state, crossing and event predicates retain their typed operators in compact brackets rather than prose. Existing all/any and negative semantics remain. Supplemental effect details, including minimum movement cost, armor ignored and repeat-on-entry facts, follow the report with the effect explanation instead of masquerading as effect tags. Manual text and captured Basic reports share this placement. Focused rendered regressions verify retained facts, placement and immutable definitions; the character, battle and content suites passed 1,544 tests before the final combined gate.

## Controlled preparation cooldown

A bounded read-only trace of the reported encounter showed a free prime, a separate paid release, then a second prime during its running cooldown. Global timing policy now rejects that second prime until cooldown expiry. Cancellation, free first preparation, release payment, cooldown-free reuse and historical timing policies remain intact. Core admission, live projection and Skill/Essence/Resonance artwork tests cover the correction. Independent review of the exact core commit found no Critical, Important or Minor findings. No hosted state was changed during diagnosis.
