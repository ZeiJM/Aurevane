# Loadout headers, management watermarks and combined release

Owner requested Battle Hall-style Nexus/Items headers, preserving green selection and the existing workspace footprint; one faint watermark each for Technique and Discipline management; and one combined Production release after all work is complete.

## Candidate

Branch `agent/loadout-header-watermarks-20261003` includes the complete preceding PR #812 at `37b669f3309a773a7ba8f2deeae78d91e17ecd20`. Base Main refreshed as `cfe4dbf96cc9bec17111ddcfafe4deff9b0a4106` before implementation and release preparation.

- Shared Loadout header uses Battle Hall typography, gold icon and compact title treatment. Former blank space becomes title space; selected tab styles remain unchanged.
- Management dialogs use existing training-courtyard and archive art at 8% opacity, behind their reading panels. Decorations cannot receive pointer input and do not affect geometry.
- The one-time portrait gallery is a native modal, preserving the compact Titles page. Escape restores focus; confirmation locks the choice while custom profile URLs remain available.
- Browser expectations follow the approved Requirements/Effects labels and first-move movement Chronicle entries. Personal-title confirmation selects its own named checkbox.
- Only Main deployment is enabled for the authorized release; branch deployments remain disabled. Restore the full lock after verifying the Production deployment.

## Local verification

- Final `pnpm check` passed: formatting, lint, TypeScript, 3,430 Vitest tests, seven Node checks and Production builds.
- Real components mounted with Production style imports at eight viewport sizes: 1280×720, 1366×768, 1536×614, 1440×900, 1920×1080, 1024×768, 390×844 and 320×568. All sixteen Nexus/Items comparisons passed: no added document height or horizontal overflow, no downward content displacement, visible title without tab overlap, and unchanged green `rgb(52, 89, 81)`.
- Technique and Discipline dialogs inspected at 1366×768, 1536×614 and 390×844: correct watermark, preserved controls and readable foregrounds. Native portrait gallery checks passed for hidden initial state, 64 options, Escape/focus return and post-success lock. No browser runtime errors.
- Portrait SSR regression demonstrated red before the modal change and green afterward. Three portrait SSR tests and six targeted character-component tests pass.
- Existing standalone Discipline regression fixture fails because it expects POST then PUT while the current commit flow makes PUT directly. This is a fixture/API expectation mismatch, not a watermark behavior change. No claim that this standalone fixture passes.
- Authenticated end-to-end portrait persistence and desktop page fit are covered by GitHub browser workflows against disposable local Supabase accounts, including the new portrait modal test.

## Release preconditions

Require passing exact-head GitHub workflows, refresh Main, apply only `20261003120343_character_default_portrait_choice.sql`, verify service-only RPC grants, merge the combined batch, then verify the precise Production revision and alias. Do not consume an existing user's portrait choice for live smoke. Record hosted migration and deployment receipts in the release closeout.
