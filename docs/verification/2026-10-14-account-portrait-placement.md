# Account portrait placement — October 14

Status: implemented checkpoint; native viewport acceptance and release pending.
This is the Owner-approved portrait relocation from the remaining overhaul.
No deployment or account/gameplay mutation is included.

The shared authenticated header forwards the existing resolved character
portrait into Account instead of rendering it beside the trigger. Opening Account
places the portrait at the far right of the Welcome back row, with the existing
40px desktop/32px mobile footprint and a small inset. Long greeting text can
truncate without pushing the portrait outside the dropdown. The current image,
fallback, crop and character identity are reused; no new asset or parallel
profile-image authority is introduced. Rail identity remains its own existing
surface. The placement applies to ordinary and battlefield shared shells.

Existing shell/menu checks were updated before implementation and reproduced
the missing portrait forwarding in two cases; all six pass after correction.
Affected types, lint, formatting and the complete web suite2443/293 pass.
The existing native shell viewport scenario now checks desktop/mobile Account
placement, the actual saved custom image, row alignment/right inset, no overlap
or off-screen dropdown, Escape close and attached screenshots. These new native
assertions have not yet been observed; local Chromium installation remains
unavailable. Do not infer native visual acceptance from static React markup.

The independent targeting checkpoint1b3152144e025ebd38139b1c84a6d0544e3f8f7b
is preserved as this branch's base, without altering its running CI. Its latest
native fourteen-case matrix and full CI pass; broader Browser smoke is running.
All other overhaul tasks and final creative balance remain separate outstanding
work. This document does not claim full-overhaul completion or live UI changes.


Native Desktop experience38547840184/job115798201746 failed three creation
cases solely because their old closed-header portrait locator still expected
the superseded placement. The creation and secondary-build scenarios now open
Account, inspect its actual portrait and continue/close the menu appropriately.
Decoded-image, account persistence and character-build assertions remain. The
native rerun is pending; this is test-locator migration, not a product correction.
