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
- Exact-head `618cade` passed thirteen workflows, including Desktop page fit, Desktop experience and Representative Buildcraft. Browser smoke caught an 8.4375px cross-route tab-position change caused by the flexible tab rail beside unequal title widths. The compact rail now keeps its 26rem basis, with an equal title reservation and explicit font sizing on short phones. All sixteen local viewport cases additionally verify identical tab position and size across both routes.
- UI layout review passed the portrait persistence flow on desktop; laptop and phone fixture creation reused the same globally unique character name and were rejected before reaching the portrait page. The test now gives each account a unique letter-only name within the 24-character limit. Full exact-head workflows must pass again for these corrections.
- Independent read-only review of the combined application, SQL, immutable narration and security boundaries found no Critical or Important defects. The later compact-rail correction is covered by the existing authenticated route-parity regression and the extended local matrix.

## Release preconditions

Require passing exact-head GitHub workflows, refresh Main, apply only `20261003120343_character_default_portrait_choice.sql`, verify service-only RPC grants, merge the combined batch, then verify the precise Production revision and alias. Do not consume an existing user's portrait choice for live smoke. Record hosted migration and deployment receipts in the release closeout.

## Hosted release and closeout

- Final candidate `9b68524ae3a1d6c0cd34b18125bd3fdf7b3ddfa6` passed all fifteen exact-head workflows. Browser smoke passed 65 focused cases, 305 full-suite cases and ten Edge cases. UI layout review passed 110 cases plus its directory scenario, including portrait persistence and lock at desktop, laptop and phone sizes.
- Final local `pnpm check` passed again after the compact-rail and fixture corrections: 3,430 Vitest tests, seven Node checks, formatting, lint, types and Production builds. The independent reviewer found no blocking issue in the final delta.
- Main remained `cfe4dbf96cc9bec17111ddcfafe4deff9b0a4106` through final release preflight. PR #813 merged as `f4643e5dbaf6b07a34cae53d02f202314a23a0d8`; its tree `e17e0b9c2b2e7ca496964a560bc750a9f9b98d42` exactly matches the tested candidate. Included ancestor PR #812 is also marked merged.
- Only the reviewed portrait migration applied, hosted as `20261003142740_character_default_portrait_choice`. The nullable timestamp column, both security-definer RPCs, empty search path and service-only execution were verified. Anonymous and authenticated roles cannot execute either RPC. No existing user's portrait choice was consumed for live verification; no unrelated migration or combat-content activation occurred.
- Production deployment `dpl_ACERFdca39wvytj8y6EGHxLj7ngC` reached READY at `2026-10-03T14:29:52.466Z`, with exact source `f4643e5dbaf6b07a34cae53d02f202314a23a0d8` and alias `https://aurevane.vercel.app`.
- Live entry, Manual search, Rules and News responses returned 200. Nexus, Items and Titles correctly returned the sign-in entry to unauthenticated requests. No application-error page was observed. Authenticated Production gameplay and Owner aesthetic acceptance are not claimed; authenticated interactions passed in CI.
- The deployment-scoped warning/error/fatal count query from READY through live smoke returned no entries. No separate Vercel build-log inspection is claimed.
- This configuration/docs-only closeout restores the full deployment lock. Application source remains byte-identical to the verified Production release, with one Production deployment for the batch.
