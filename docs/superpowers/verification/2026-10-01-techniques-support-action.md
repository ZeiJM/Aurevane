# Techniques, Support Action and continued UI verification

## Scope and release boundary

Owner-authorized continuation of PR #790: eight-card Primary/Secondary Discipline rows, independent Support Action saved to battle slot 3, the approved Profile stat/tendencies presentation, single-panel Training, persistent Nexus/Items navigation, Haven shortcut removal, standardized headers and Character Select fit, three PvP map sizes with the VS centerpiece, and Guided Fundamentals at 9×7. The specification and implementation plan are the same-date documents in `../specs/` and `../plans/`.

New battles pin Support Action and map geometry. Historic snapshot fingerprints and recorded battle maps remain compatible. Training cancellation retains the existing proportional reward settlement through the existing idempotent claim endpoint. Build Tendencies visualizes relative Core Stats; it changes no combat formula.

Only the two new additive migrations are part of this release: `20261001184328_character_support_action.sql` and `20261001190915_pvp_three_map_sizes.sql`. Unrelated pending world/story migrations and combat-content publication are outside this work item. Production migration, deployment and authenticated acceptance are not implied by fixture evidence.

## Component and domain evidence

- Support persistence focused tests cover ownership, strict allowed IDs, versions, receipts, named loadouts, legacy fingerprints and pinned snapshots. An independent backend review found no blockers. Database execution remains an exact-candidate CI gate.
- Actual Techniques component fixtures passed twelve pure/mixed layout cases at 1440×900, 1366×768, 1536×614, 1024×576, 821×768 and 390×844. Save checks passed successive versions 1→2→3, busy exclusion, independent Discipline capacity and rollback.
- Actual battle fixtures passed twelve PvE/PvP Support Action cases and two pending-preview/dialog cases. These cover names/art/AP, custom keybinds, deliberate second press, held-key exclusion, HP/MP full, shared recovery cooldown, reading dialogs and late unmount.
- Profile layout fixtures passed eleven desktop/mobile widths from 1920 to 320 pixels. Five popup cases verified viewport fit, category explanations, Escape and outside dismissal. All thirteen Combat Stats appear once under their corresponding Core Stats.
- Nexus/Items fixtures passed eighteen navigation/layout cases, including desktop Nexus without page overflow. Training fixtures passed twenty-four panel states and four lifecycle cases. Independent review identified a stale-tab stop that returned `stopped:false` but left settlement active; the actual-component regression first timed out, then passed with Plan visible and zero extra claims after the fix. A real second-tab regression is included in authenticated CI.
- Shared headers and Character Select passed fifty-six actual-component cases: four shells, seven viewports, and 16px/20px root fonts. Requested desktop viewports and 768×576 fit without page scrolling.
- PvP focused domain/service tests check all three canonical geometries and preserve old 9×7/13×9 snapshot replay. Lobby fixtures cover desktop/mobile and 1v1/2v2/3v3 modes with reduced-motion support.
- Guided arena regression tests first failed because the server accepted a different proposed arena. The setup now displays its existing 9×7 Duel Yard record, and authoritative session tests require 63 tiles and reject client arena overrides. Legacy drill geometry and stored snapshots remain unchanged.
- Independent integration review identified that Recovery in slot 3 removed access to the required Guard lesson. An exercise-only Practice Guard control uses the same battle input/preview/commit owner, keeps slot 3 unchanged and preserves full-resource recovery legality. Focused render regressions first failed before the control was added; authenticated desktop/mobile regressions check the recorded Guard criterion with full MP.

Fixture checks use production components with synthetic transport/data. They are not authenticated Production gameplay or database evidence. Durable authenticated tests are included in the disposable browser workflow for Support Action, Techniques, loadout navigation, Training, profile, roster headers and PvP map sizes.

## Final gates and release

The final local format, uncached lint, package lint, uncached typecheck, uncached full suite (3,142 Vitest tests and seven Node checks), and fresh Production builds passed. The four new/extended browser suites parse to 36 project cases. The final Guided practice fixture passed eight desktop/short/mobile cases with one Guard commit, AP 70, full MP unchanged, selected Support Action retained and stable board height. A held-Enter regression first reproduced a native repeat committing once; the local repeat guard then preserved zero commits while held and one commit after a deliberate second press. The authenticated test includes this input sequence.

Independent integrated review found two material edge cases (stale-tab Training settlement and inaccessible Guided Guard practice with Recovery); both were reproduced, corrected and reviewed again. No remaining material finding was identified in the reviewed persistence, snapshot, input, navigation, Profile, Training, header or map-size paths. SQL/authenticated candidate CI remains required.

PR #790 passed CI, Representative Buildcraft, UI layout review and Browser smoke on exact head `5b794a8cd4025b561d09ac961367c36e80936cb4`, then merged at `ae9cc3f5aeddfa72651339855a17f1c53f443b85`. Branch deployment remains locked. This continuation builds on that application tree.

Exact-candidate SQL/browser workflows, final main freshness, merge identifiers, Production preflight/migrations, deployment identity, bounded live smoke and restored deployment lock will be recorded here as they finish. This candidate has not yet been released.
