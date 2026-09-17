# Character roster HQ continuation checkpoint

## Scope and branch

Continuation branch: `agent/character-roster-hq-continuation`, based on the cumulative UI commit `85f229c07f6102a85fbd15f3e2bc41a90143cb0c` on `agent/adventurers-concept-ui`. This preserves the Training, Hall and Adventurers stack. Main was separately checked at `3d8a4d25cb897d0f9ce4871c6972e5d7107d68b0`; its newer work has not been merged, reset or replaced here.

This checkpoint changes the actual Character Select composition, not the game mechanics. The supplied `aurevane_character_roster_at_dusk.png` is the design target. The heading now precedes three dark portrait-led cards; account management follows them. Mobile uses square identity artwork beside the name, with full-width action rows and compact locked cards. Short windows scroll naturally instead of clipping the Play action. The roster CSS module owns the geometry; its conflicting global rules were removed from `sitewide-layout-v2.css` and `a3-battle-polish.css`. Other battle rules remain intact.

The three slot indices, eligibility, selection, custom/fallback portraits, cooldowns, deletion scheduling/cancellation, pending countdowns and account password verification are retained. The new footer's Switch account form uses the existing POST `/auth/signout` route. No server, schema, combat, catalog, pronoun or compatibility-contract changes are part of this roster checkpoint.

## Reproduction and evidence

The added authenticated regression uses disposable local Supabase accounts. It checks heading/card hierarchy, exactly three slots, real Play routes, square loaded portraits, readable text, reachable actions, horizontal overflow, dark locked cards and footer management placement. Its eight viewport sizes are 1728x887, 1440x900, 1366x768, 1024x576, 980x768, 768x576, 390x844 and 320x740. It also exercises the real footer sign-out and verifies that `/game` requires authentication afterward.

At test-first commit `70581bcb154baa090412a9a21845bcff2ab6be56`, UI run `35043037578` reproduced the old side-panel heading and misplaced account actions. The Play action at 1024x576 remained partially clipped even after scrolling. The run had three new roster failures, 42 passes and six existing skips; the separate large-directory regression passed.

Implementation commit `b8e99fd457f2be250f602dfd5d6bf6b3b9bbac91` passed the roster cases in all eight sizes. Its real screenshots and metrics are in UI run `35043860018`, artifact `10426218690`, SHA-256 `5234a8758f3f90a10adf4b237006b64adc1250abb652aff529d2f393be741fc8`. The artifact's commit file was checked. These are authenticated test-environment renders, not Production screenshots.

That full run was NOT green: three creation/persistence cases hit an ambiguous substring selector matching both Account and Switch account. The shared sign-out helper now selects the exact Account menu. The standalone account-entry case uses that helper too. No interaction assertions were removed. The expanded UI workflow includes account-entry, creation, deletion, roster, Profile, Training, Hall/lobby, spectator-footer, Adventurers, Battle usability and the large-directory regression. Obtain final exact-head results from the branch/PR checks; results on an earlier SHA do not certify a later commit.

## Separate Creation follow-up

The full Character Creation workspace refinement is not implemented by this roster checkpoint. The Identity / Discipline / Confirm flow and hidden pronoun compatibility remain unchanged.

A source-byte audit also discovered that 17 existing generated portrait derivatives fail Chromium decoding: portrait 22 and portraits 25-40. The count of 40 catalog entries does not establish that all 40 images load. Local recovery from the supplied creation reference has been prepared separately, preserving every portrait ID; the matching larger first-portrait preview is also available. These asset repairs are not included in this roster commit and must receive their own registered-image, keyboard-selection, back-navigation and authenticated submission verification before integration.

## Integration and acceptance boundary

No merge, force push, Production database mutation or deployment was performed. `apps/web/vercel.json` retains `deploymentEnabled: {"**": false}`. The temporary branch-only source/formatter export workflow has been removed.

This is a structural roster checkpoint, not acceptance of the entire 29-screen suite. All-populated and Prestige-unlocked roster compositions, custom portrait error recovery, destructive-dialog keyboard containment, final portrait quality and the Creation workspace still require targeted acceptance. Preserve the existing completed screen regressions and reconcile the UI stack with fresh main before any authorized integration or release. Independent human review and Owner visual acceptance are not claimed.
