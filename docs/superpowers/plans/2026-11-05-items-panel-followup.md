# Items panel followup implementation plan

> **For agentic workers:** Execute the explicit Owner-requested scope; independent search and field-presentation tasks may run in parallel. Preserve server authority and obtain one final whole-branch review.

**Goal:** Improve Item authoring, optional weapon Imbued Techniques and the automatically saved inventory/equipment page, including type search and explicit character grants.

**Architecture:** Extend the actual SQL list predicate before sorting/pagination; retain name/identity matches. Add a server-authorized targeted grant using existing inventory locks, revision/catalogue checks, idempotency and immutable support audit. Resolve characters on the server, never trust a client-supplied owner identity. Keep arbitrary-recipient grants protected by Game Owner authority and retain existing self-test permissions. UI uses compact responsive controls, a selected recipient label and one help source per field. Existing stored sortOrder values survive editing; no rewrite of historical definitions.

**Tech stack:** Existing SQL migrations, TypeScript/React, Vitest/PGlite and native browser fixtures.

## Requested scope / approach

- Extend the existing Search content field rather than introduce another filter row; use actual Item class/category/equipment labels and normal name/ID matches.
- Add explicit character lookup/selection beside bounded quantity and Grant Item controls, with recipient name visible and unambiguous. Reject missing/deleted/ambiguous targets and stale or repeated commands safely.
- Hide Display order for Items only; new values remain internal defaults and existing values are preserved.
- Fix field containment in the Item editor at desktop/laptop/phone widths. Keep the existing information popup and remove duplicated inline field guidance.
- Let armor choose its equipment position, showing only relevant controls; display the stable hand-armor identity as Gloves everywhere in current UI. Preserve historical definitions and meaningful existing bindings.
- Add an optional weapon-only Imbued Technique tab using the shared Skill editor and existing equipment Support binding. The equipped technique is a selectable Skill Manager Support; unequipping restores the normal Support choice. Disabling explicitly removes only the detached technique on Commit, with re-enabling in the same open editor restoring it before Commit.
- Compact frozen editor title/actions/tabs, contain long fields and maximize the scrolling working area while retaining Commit controls.
- Remove the mannequin Template caption; Basic Attack slot shows the equipped weapon name or Unarmed.
- Apply inventory sorting immediately through the authoritative writer. Remove Save order, Reload Items and persistent top mutation banners; refresh automatically after writes and once after failures, never replay an equip/unequip grant silently. Keep actual failures visible beside the affected controls.
- Player-facing classes are Gear, Consumables, Materials, General, Event and Companion; Weapon/Armor/Gloves are Gear types. Position names actual positions (Main Hand, Off Hand, etc.) or N/A. Preserve stored category/class/slot keys.
- In Item details, show one Uses per battle field beside Maximum stack and below Class, using the effective finite use limit and retaining unrelated activation limits. Standardize popup Close/Unequip controls.
- Show category-relevant filters/sorts only, reset incompatible filters on tab changes and remove Unavailable as a filter without hiding owned archived/disabled Items.
- Simplify inspect popups: only Equip/Unequip and proven green/red stat contribution changes, disabled Cannot be equipped for non-equipment; remove comparison/dropdown/QP/optional-removal clutter. Keep required legal replacements and server rejection protections. Non-equippable/equipped popups use compact full-width information without an empty action column.
- Empty equipment slots open a wrapped horizontal picker of applicable owned Items with small artwork/names, using the same authoritative equip path. Make Equipped badges clearly visible.
- Add optional minimum level, any listed currently equipped discipline and all configured minimum base-Core-stat equip requirements. Enforce in the authoritative equip writer and battle admission; Items without requirements remain unrestricted, ability requirements stay independent, and missed requirements never rewrite inventory or historical battles.
- Disallow the same consumable Item identity in both positions, including separate owned stacks; preserve manual repair of existing invalid loadouts and literal historical captures.
- Consume one owned unit on each accepted committed consumable use, atomically with battle settlement and exactly once across retries. Retain equip while stock supports it; exhausted slots clear and require manual re-equip from another stack. Never auto substitute/replenish. Per-action battle use caps reset each new battle, stock does not. New policy must preserve historical/active captures and private stock.
- Battle Item button artwork/parameter popup follow the last selected consumable, preview round information controls match the cockpit, preview rows show uses/stock without position text, and battle information uses the compact shared Skill report without thumbnail/duplicate uses prose.
- Audit all 47 source/effective current Items against Skill engine semantics. Prepare only reviewed successor corrections for three demonstrated mismatches (Kindle Fire scope, Vulnerability Oil duration wording, Ward Sigil per-battle wording), without hosted publication.
- Shared effect summaries remain readable and fully visible without horizontal scrolling; preserve short one-line phrases, allow longer phrases to wrap naturally rather than clip, retain parameter colors/help in all readers.
- Item inspect popups offer a separate Imbued Technique tab only when the weapon has a valid Support report; keep ordinary attack/passive information in Item Details. Remove redundant Item passive maintenance prose.
- Match inventory and equipment artwork dimensions to the shared battle cockpit artwork scale. Center equipment artwork between item name/QP above and slot name below; retain empty/blocked slots, all eight positions and the QP budget.
- Do not automatically deploy, apply hosted migrations, issue real inventory grants, overwrite Owner drafts or alter battle/history rules. The preceding Seal/Damage Up release is complete and does not authorize this new release.

## Tasks

- [x] Search: real failing list RPC tests for class/category/slot labels, case/whitespace, draft/current/source authority and pagination; minimal guarded source migration; focused + adjacent DB tests.
- [x] Grants: failing target resolution/authority/idempotency/capacity/deletion/battle-state tests; source RPC + route adapter + compact target UI; ordinary self-grant compatibility.
- [x] Fields: failing rendered tests for hidden sortOrder/preserved values and single help; scoped containment CSS; native geometry/interaction at 1440/1366/390 widths.
- [x] Imbued Technique: parser-valid enable/edit/disable, preserved attack, weapon-only tab, ordinary equipped Support selection/resolution and restoration; native save/reload.
- [x] Equip requirements: strict optional schema, shared base-character evaluation, authorized SQL equip/admission enforcement, actual server contexts, editor/save/reload/public summaries and negative/concurrent regressions.
- [x] Consumable settlement: new-battle policy capture, exactly-once atomic inventory/battle updates, accepted/rejected/miss/retry/delayed/terminal cases, provisional Controlled prepare versus committed Reversal arming, distinct consumable identity constraints, zero-stock slot clearing without replacement, owner-only current stock and historical compatibility.
- [x] Item audit: 47-source/current read-only review, exact successor candidates and actual Fire-vs-other packet battle regression.
- [x] Shared readers: native effect geometry/label/readability/color/help across five readers and desktop/laptop/phone, plus optional inspect technique tab.
- [x] Inventory: immediate sort, bounded automatic refresh and stale/rejection feedback without action replay; category-specific filters; equal cockpit artwork sizing and centered equipment slots at desktop/phone widths.
- [x] Source integration (configured CI pending): inspect full diff, format/lint/types and relevant/full applicable tests, final independent review, fresh-main reconciliation; push reviewed non-deploying PR with exact verification and remaining configured CI gates.

## Verification map

Search must filter before the global cursor/limit without changing selected-actor authorization or non-Item searches. Grant tests cover server ownership, selected actor, revision/catalogue CAS, deduplication, quantity/capacity and frozen/deleted targets. Presentation tests cover old Item values surviving unrelated edits, full description containment, popup help and small screens. Use actual shared Ability editor and existing battle adapters for Imbued Technique; verify real Support resolution and no second boost or activation path. Native inventory fixtures must cover writes, rejection, tab switches, equipment/consumable inspection and geometry. This multi-system persistence/authoring batch requires the full local quality gate once stable, plus configured exact-head CI. No combat-engine rules are intended to change; focused inventory/authoring integration and configured CI remain mandatory. Widen if shared behavior changes. Hosted verification/publication and real grants are excluded because this is source implementation, not a release request.

## Integration checkpoint

Whole-branch review has no remaining Important/Critical finding after the startup/Tag binding and paid-Reversal stock regressions were repaired. Formatting, lint and eight-package types pass. The full DB run plus focused serial follow-up covers every case except one unchanged historical modular-release 120-second timeout, explicitly retained as an unresolved local gate in the verification receipt. Full Core and other package tests, production/worker builds and one-shot worker boot pass. Five full-Web timeouts pass in focused serial follow-up with three adjacent cases, retaining original limits. The unchanged historical DB timeout remains unresolved; the complete local gate is not claimed green. Remote exact-head CI must pass before readiness. No hosted operations occurred.
