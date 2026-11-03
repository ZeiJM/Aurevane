# Task 4 — Arsenal inventory and equipment

Status: **DONE**, ready for independent review. Source commit `38d8e14` (`feat(items): build Arsenal inventory and equipment workspace`); based on reviewed Task0–3 plus adopted 47-item artwork. No push, PR, merge, deployment, hosted write, source installation, full repository suite or application build.

## Delivered behavior

The existing guarded `/game/loadout/items` route now renders `CharacterItems` instead of the placeholder. Gear, Battle Items, Materials, General, Event and Companion each retain 40 addressable saved positions. Real thumbnails, quantity overlays through 99, search by name/tag, class/slot/equippable/unavailable filters, and six server sort commands are available. Filtering retains saved slot positions; Save order persists the category through the reviewed intent service. Equipment has exactly Head, Body, Pants, Boots, Main Hand and Off Hand, slot QP contributions and used/100 meter.

All writes use `/api/character/items` POST with the returned character/revision/catalogue token, then reconcile the returned view. No direct table writes or client-authoritative eligibility. Failed/uncertain writes require Reload Items before another mutation; active/pending battle views explain the lock and disable writes. Initial read/repository-initialization failure offers the same GET reload path without bypassing the roaming guard.

The shared `ItemDetails` reader owns art, flavor, tier/QP/equipment/use limits and canonical effect/Requirement reports. The native accessible modal reuses `CharacterDeletionDialog` focus containment, Escape/outside dismissal, focus restoration and busy behavior. Current-slot comparison opens the same shared Item reader; candidate QP and each explicitly removed position are visible. Optional swap candidates display their names/slots/QP, the exact shortage updates, and confirmation submits all named replacements. No unrelated automatic removal.

Two-handed weapons charge one main assignment and visibly block Off Hand. Main-hand weapons provide the attack; the off weapon supplies it only when main has no weapon, otherwise its passives remain. A single Battle Item stack held twice previews and charges two hand assignments and requires two owned copies; the server decides final eligibility. Uses are described as per-battle refills with owned quantities unchanged.

Unavailable owned stacks remain visible as Unavailable Item. Equipment issues show the exact service issue, label QP incomplete/repair required rather than representing the partial sum as admissible, and retain position-specific Unequip repair. The unavailable detail explains the supported current-catalogue absence states without inventing a precise archive reason the DTO does not contain.

The existing single Arsenal Techniques Support selector retains exactly the five `CURRENT_SUPPORT_ACTION_IDS` and adds enabled equipped named support bindings, distinguished by hand/position and safe Item identity. Saved equipment Support is reflected in the Nexus summary and checked choice. Its Details control uses `ItemDetails`. Choosing the retained Basic choice clears equipment Support through the existing atomic Basic writer even when that Basic ID was already the retained build value. Equipment Support submits its discriminated intent with a fresh Item read, then closes/refreshes Techniques because this advances build revision too. Late opening reads cannot restore a pre-save selection. Source removal emits the returned explicit fallback notice; the next selector shows the sole Basic choice. No retired Guard lookup added and no keyboard binding/cockpit code changed.

## Interfaces for Tasks 5 and 6

- `components/character/character-items.tsx`: `<CharacterItems initialView={CharacterItemsView|null}/>`; null intentionally renders retry. Production view still comes from `loadCharacterItems` and the existing repository, so Task6 trusted-grant integration belongs in that shared service/acquisition path rather than a UI catalogue or grant call.
- `components/character/item-equipment-preview.ts`: `positionNames`, `OwnedItem`, `itemPositions(item)`, `equipmentProposal(view, stack, position, extraPositions)` and `itemThumbnail(src)`. Proposal is explanatory only, never authority/admission. The real local starter preview path maps to its finished thumbnail sibling; other registered/finalized image URLs remain unchanged.
- `components/character/item-support-options.ts`: `itemSupportOptions(view)` returns public Item presentation plus discriminated equipment selection and position label; neither its key/label/selection nor new public reports contain owned stack IDs. Owner stack IDs remain in Item intent payloads as required by the existing API.
- `CharacterArsenalShell` accepts optional `itemsView`; Nexus loads it alongside its existing reads. `CharacterSkillBuildPanel` accepts optional `initialItemsView`, refreshes available choices when opened, and reconciles equipment-vs-Basic selection with the existing build writer. Item read failure is visible in the summary/selector.
- Task5 still owns actual transaction-integrated admission, captured role authorization/potential/privacy and battle cockpit. Task6 still owns genuine 47 source definitions/registry and idempotent default grants. The native fixture's definitions and artwork registrations exist only in `e2e/fixtures/arsenal-items-harness.jsx`; no production starter catalogue or fake future actions were added.

## Verification and self-review

Initial render test witnessed the absent workspace/module before implementation. The route recovery regression then failed specifically on synchronous repository initialization and passed after moving initialization into the handled promise. Focused checks caught missing new dependency mocks in the existing Nexus tests; updated them without weakening existing assertions. Native iteration caught incorrect fixture arithmetic/selectors, a wrong test-only Basic Attack ID, modal surface precedence and actual mobile panel clipping; corrected and reverified. Final native panel bounds are asserted, not inferred from page scroll width.

Final successful commands/results:

```sh
pnpm --filter @aurevane/web exec vitest run src/components/character/character-items.test.tsx src/components/character/item-support-options.test.ts src/components/character/character-support-actions.test.tsx src/components/character/character-arsenal-shell-layout.test.ts src/components/character/arsenal-published-artwork.test.tsx 'src/app/game/(roaming)/character/page.test.ts' 'src/app/game/(roaming)/loadout/items/page.test.tsx' src/server/character/character-items-service.test.ts src/server/character/character-items-roundtrip.test.ts
# 9 files, 45 tests pass; /tmp/task4-focused-final.log
pnpm --filter @aurevane/web lint
# passes; /tmp/task4-lint.log
pnpm --filter @aurevane/web typecheck
# final pass; /tmp/task4-types-final.log
node --test .github/scripts/verification-plan.test.mjs
# 49 pass; /tmp/task4-ci-selector-final.log
node --test .github/scripts/run-browser-verification.test.mjs
# 7 pass; /tmp/task4-ci-runner-final.log
AV_CHROMIUM_EXECUTABLE=/tmp/aurevane-browser/chrome-headless-shell-linux64/chrome-headless-shell pnpm --filter @aurevane/web exec node scripts/runtime-item-editor-browser-regression.mjs
# 1366x768, 390x844, 412x915 pass; /tmp/task4-editor-native.log
AV_CHROMIUM_EXECUTABLE=/tmp/aurevane-browser/chrome-headless-shell-linux64/chrome-headless-shell pnpm --filter @aurevane/web exec node scripts/arsenal-items-browser-regression.mjs
# 1366x768, 390x844, 412x915 pass; /tmp/task4-native-final.log
```

Full web lint passed before final small changes; scoped ESLint then passed for all changed TS/TSX/JS and final changed panel/fixture/runner (`/tmp/task4-eslint-final.log`, `/tmp/task4-eslint-last.log`). Changed-file Prettier checks and staged/unstaged `git diff --check` pass. The combined Node wildcard invocation stalled in the existing ZIP-proof subprocess, was interrupted (130), and is not claimed green; both individual suites above completed green afterward. No CI product logic was changed to evade that local subprocess issue.

Native uses actual production components, shared reports, Item service command validation, explicit request payload capture and a test-only persisted repository boundary; this is not a signed-in hosted browser session or replacement for SQL authority. The adjacent production-handler/migrated-repository roundtrip tests above exercise real persistence separately. Native verifies keyboard Enter/Tab/Escape, touch and outside dismissal/focus return, returned CAS/token, explicit head and two-hand multi-position swaps, QP shortage and checked optional removals, server-ordered slots after reload, quantity99 and two hand pools/QP, shared charged report, existing Support equipment selection and retained Basic reselection with a delayed opening read, source-removal fallback, unavailable equipment repair, stale response/reload and battle locking. No page errors or page-level overflow; real 256px thumbnails decode, real detail images are visible, and modal bounds fit the viewport.

Screenshots (all six visually inspected in this task):

- `/tmp/arsenal-items-browser-evidence/arsenal-items-1366.png`
- `/tmp/arsenal-items-browser-evidence/arsenal-items-390.png`
- `/tmp/arsenal-items-browser-evidence/arsenal-items-412.png`
- `/tmp/arsenal-items-browser-evidence/arsenal-item-detail-1366.png`
- `/tmp/arsenal-items-browser-evidence/arsenal-item-detail-390.png`
- `/tmp/arsenal-items-browser-evidence/arsenal-item-detail-412.png`

Editor proof remains `/tmp/runtime-item-editor-browser-evidence/item-editor-{1366,390,412}.png`. Only nonfatal Next image LCP advice appears in these standalone native harnesses.

`browser-smoke.yml` now executes both the Task3 Item editor native runner and new Arsenal native runner in the existing production-component branch and uploads both evidence directories. The selector regression checks Item UI/helper/native/fixture paths select that branch (existing conservative full fallback for unmapped sensitive paths); no final legacy gate can silently omit these runners on the feature changes.

No remaining Task4 implementation blocker identified. Independent review follows. Full signed-in integration, full feature-head CI, real simultaneous PostgreSQL admission races and deployment remain later integration gates; none is claimed complete here.
