# October 8 Ground/Airborne/readers verification

Status: local verification complete; exact-head remote checks and release pending. Owner authorized automatic publication, merge and live testing.

Scope: enemy-only Frozen Ground; Airborne absolute Ground evasion and Attack-only Target Elevation3; separate Push/Pull authoring/timing without new Displaced markers; vacated-tile targeting border cleanup; Ground explanation separation; actual tile summaries in preview/Chronicle/Copy Full Log; Chilled requirement naming; plain Resonance sequences and exact qualifying setup Skills.

Historical compatibility uses optional `frozenGroundPolicyVersion`, `airbornePolicyVersion`, `displacementPolicyVersion`, all version1 for new PvE/PvP/Master previews. Absent policies preserve historical mechanics. Steam, Slow, costs and Rewind are unchanged. Additive Push/Pull timing migration preserves the existing audited timing publication function’s protection and every saved version. Hosted read-only baseline now has six policy versions, with latest shared displace=Instant set independently during Owner live testing; retain all six.

Full `NODE_OPTIONS=--max-old-space-size=768 pnpm check` exits 0: formatting, lint, types, **4,437 Vitest tests plus seven Node checks**, and production build. All **72 production-component targeting cases** pass across desktop/mobile PvE/PvP/spectators, including moved-target/vacated-tile outlines and a 63-tile Ground preview with one compact terrain summary. Shared Skill palette/reader checks pass at 1366×768 and 390×844; Ground explanations were visually inspected in both layouts. Existing PostCSS/prefetch fixture warnings are unchanged.

Independent review identified one important defect: Airborne was prematurely cancelling delayed percentage Ground DoTs before activation. Two regressions failed first, then passed after eligibility moved to activation with a guaranteed-miss receipt. Focused mechanics and percentage-command coverage passes **109 tests**. No additional important review blockers were found. PGlite publication verifies independent Push/Pull timing, immutable history and service-only grants. Public current authoring retires Displaced; absent encounter policies preserve historical data and resolution.

The arrow-only PR **#851** passed all three exact-head workflows and merged at **d9fec991de40d7bf85553f6a7413d678c308fc91**. Its tree matches the local arrow baseline. This continuation retains that change and keeps automatic Git deployments locked. Candidate identity, its remote checks, hosted additive migration and production evidence follow below. Human acceptance remains unchecked.

Shared Ground reader evidence: [desktop](2026-10-08-ground-readers-assets/ground-reader-1366.png) and [mobile](2026-10-08-ground-readers-assets/ground-reader-390.png). These show production components in deterministic local fixtures, not human gameplay acceptance.

## Owner test checklist once live

- Start a fresh PvE battle and fresh PvP battle for new policies; refresh existing battles for reader changes.
- Cast Frozen Ground: caster/allies pay ordinary movement cost; enemies pay +10 AP per entered Frozen tile. Confirm preview AP agrees with committed AP; Slow still adds its own cost.
- Apply Airborne: Ground damage/debuff/heal Skills miss the holder; direct unit-target Skills retain normal accuracy. Check delayed activation and walking/being pushed into an active area. Existing unrelated DoTs continue.
- While Airborne, Attack Skills reach elevation3; Utility/Heal retain their limits. Expiry restores authored Attack elevation.
- Author Push and Pull separately in Master, edit their independent timing, preview/publish through the normal audited flow. Successful moves show direction without a Displaced icon; blockers and resource costs remain correct.
- Push/Pull a target and check the vacated tile has no red border; active area/Line reach remains visible.
- Check Ground area rules appear once outside authored effects. Ground previews and Chronicle show tile counts, timing and transitions rather than one line per tile; unit outcomes remain explicit. Copy Full Log matches displayed wording and includes collapsed rounds.
- Check Shatter reads Chilled and still requires that status; Frozen Ground alone does not satisfy it.
- Check Frozen Flare lists actual qualifying setup Skills, explains the next Attack trigger and displays no Control annotation.
- Check the arrow near the tile corner on desktop/mobile; portrait remains visible. Check PvP spectator reads the same terrain/status/log rules without command controls.
- Resume an older battle: its mechanics/recorded history retain the original policies. Rewind retains self targeting and its current cast-position behavior.
