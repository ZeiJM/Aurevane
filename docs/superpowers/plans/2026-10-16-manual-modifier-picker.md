# Explicit Manual Modifier Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The Owner already selected inline execution; do not ask for an execution-method choice again.

**Goal:** Let a player deliberately attach owned Manual modifiers before an ordinary cast or Controlled prime, inspect exact command costs, and use the same selection through pointer, touch and custom keyboard controls.

**Architecture:** Extend the existing owner projections and prepared-command quote, then bind one transient action/group draft into the shared preview/prime/commit paths. A compact footer picker uses the existing information popover. The existing core/service remains the sole authority for compatibility, Requirements, payment, clocks and immutable prime capture.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zod, Vitest and the existing Playwright production-component/real-kernel harness; pnpm 11 / Node 24. No new dependency or endpoint.

**Spec:** `docs/superpowers/specs/2026-10-16-manual-modifier-picker-design.md`, accepted by the Owner's October 16 “ok go on” response, followed by “continue”. Source baseline `d7e993d8151d09e886b05bf87709412adbe1b41b`; implementation prerequisite `6616c213821b03254f2ef4f7f238521260aa1024`.

## Global Constraints

- Preserve four Skill slots, exclusive Essence/Resonance artwork, artwork dimensions, board-first layout, no additional Release button, ready-only artwork light, custom controls, server authority and PvE/PvP parity on desktop/mobile.
- Attached Move keeps its overall Skill price. Standalone native Basic Move keeps its existing walking price.
- Reader prose stays concise; non-damage values and timing remain in their structured places, with matching orange effect names and bracketed values.
- No plain Tab cycling is introduced. Use deliberate arrow/Space/Enter interaction, existing focus ownership, repeat guards and reader dismissal.
- References remain identity-only `{ sourceInstanceId, behaviorId }`, in code-unit source/behavior order. Maximum fifteen explicit modifiers remains the existing safety bound.
- A primed root reads the captured set exclusively from current Controlled availability. Absence means captured empty; no local fallback.
- Direct intentional commits continue without requiring a preview receipt. Preview cannot pay, prime, consume RNG or start a clock.
- `commandCosts`, when present, contains exactly AP, MP, HP in that order, including zero; missing means unknown, not free.
- No new endpoint, queue, migration, hidden mechanic or dependency is selected. No stored-control rewrite on read.
- Task15/16, complete immutable roster application, AI/balance, event previews, browser acceptance and final plain-language/orange-effect audit remain open. This milestone alone does not authorize publication or deployment.

## Review Focus

1. A crafted same-version owner snapshot changes or removes selected source metadata: submission must block rather than silently become an unmodified cast (Task 4).
2. A returning player's customized M/Shift+M and function keys coexist with historical slot/Items migration; normalization must preserve every pre-existing command (Task 3).
3. A new battle version arrives between a toggle, artwork press and response: old closures and forecasts must be unusable immediately; captured empty primes stay empty (Tasks 4–5).
4. Hidden Automatic participation shares a clock with a visible source: totals and effective duration remain exact without revealing hidden identity/provenance (Task 2).
5. A long, entirely incompatible modifier list at 200% zoom remains readable and escapable with native keys; its controls cannot trigger battle commands (Task 5).

## File responsibilities and boundaries

Paths below are repository-relative; retain existing large modules and extract only the selected small responsibilities.

| Area           | Files                                                                                                                                                                          | Responsibility                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Compatibility  | New `packages/game-core/src/combat/combat-modifier-compatibility.ts`; existing references, composition, Controlled, native adapter and package exports                         | Pure shared facts/comparison; preserve current legality                               |
| Owner metadata | `apps/web/src/server/battle/battle-live-viewer-projection.ts`; `apps/web/src/components/battle/battle-preview-selection.ts`; `apps/web/src/lib/battle/battle-basic-actions.ts` | Safe pinned modifier reports/root facts and typed consumers                           |
| Prepared quote | `packages/game-core/src/combat/pv1f-action-economy.ts`; new `apps/web/src/server/battle/battle-command-quote.ts`; existing preview service                                     | Preserve prepared quote once; emit exact allowlisted totals/visible clocks            |
| Controls       | `packages/validation/src/player/combat-controls.ts`; `apps/web/src/components/settings/combat-controls-settings.tsx`; shared battle controller                                 | Collision-preserving additive binding and validated-load gating                       |
| Draft/intent   | New `apps/web/src/components/battle/battle-modifier-draft.ts`; existing selection, range previews/hook and controller                                                          | Context/pinned identity lifecycle and identical references in every intent            |
| Picker         | New `apps/web/src/components/battle/battle-modifier-picker.tsx` and `.module.css`; existing popover/controller                                                                 | Small two-list reader, focus and preparation callbacks; shared desktop/mobile PvE/PvP |
| Acceptance     | Adjacent tests; `apps/web/scripts/battle-canonical-targeting-browser-regression.mjs`; `apps/web/e2e/fixtures/battle-ally-inspection-harness.jsx`; new verification report      | Real flow, privacy, geometry, keyboard/touch evidence and one combined review         |

Use `.superpowers/sdd/2026-10-10-unified-engine-recovery/run.py -- <command>` for execution receipts. Before implementation refresh `origin/main`, inspect overlap and confirm the existing isolated branch and deployment lock. The latest inspected main is `29506e293e81abef1b0b8a46099618ab3ae3f0ae`. Do not reset or discard any checkpoint.

### Task 1: Shared compatibility facts and safe owner metadata

**Files:** Create the compatibility module and its `.test.ts`; modify `packages/game-core/package.json`, `combat-manual-modifier-references.ts`, `combat-modifier-composition.ts`, `combat-controlled.ts`, `pv1f-action-economy.ts`, `battle-live-viewer-projection.ts`, `battle-preview-selection.ts`, `battle-basic-actions.ts` at the paths above. Extend existing `combat-controlled-modifiers.test.ts`, `battle-live-viewer-projection.test.ts` and `battle-ability-controls.test.ts`.

**Interfaces:**

- Export `CombatModifierCompatibilityFacts = { readonly payloadsSupported: boolean; readonly requiresExplicitUnit: boolean }`.
- Export `CombatModifierRootFacts` with readonly `classification: AbilityBehavior['classification']`, `targetKind: CombatTargetSpec['kind'] | undefined`, `persistentGround: boolean`, `hasPrimaryRecipient: boolean`.
- Export `combatModifierCompatibilityFacts(behavior: AbilityBehavior): CombatModifierCompatibilityFacts`, `combatCanonicalModifierRootFacts(behavior: AbilityBehavior): CombatModifierRootFacts`, `combatNativeModifierRootFacts(target: CombatTargetSpec, classification: AbilityClassification): CombatModifierRootFacts`, and `combatModifierFactsCompatible(modifier: CombatModifierCompatibilityFacts, root: CombatModifierRootFacts): boolean` from the new module. Retain `combatModifierRootCompatible` as the existing thin behavior-to-facts adapter, with one comparison implementation.
- Owner modifier rows add exact captured `abilityId`, `contentVersion`, shared sanitized `report: BattleAbilityBehaviorReport`, and `compatibility: CombatModifierCompatibilityFacts`. Manual-action/Basic presentation rows add optional `modifierRoot: CombatModifierRootFacts`; optionality supports historical public snapshots.

- [ ] **Step 1: Write focused failing tests.** `canonical_area_and_ground_primary_rejected` asserts Line/Circle/All and Ground-only Single reject primary-unit modifiers, while actor/affected-unit supported payloads remain allowed. `canonical_default_shape_and_native_selected_center_preserved` distinguishes canonical default geometry from historical unit-centered native area roots. `unsupported_payload_stays_rejected` keeps Move/Summon/persistent Ground unsupported. `owner_choices_pin_version_and_sanitize_report` asserts exact captured version/report/facts for mixed and modifier-only sources; ally/opponent/spectator views omit choices and recursively omit private definitions/accuracy/runtime. `selected_resonance_group_classification` asserts an attack and recovery group retain their own meanings despite the same artwork/menu location.

  Key assertions on the authored fixtures:

  ```ts
  expect(combatModifierFactsCompatible(primaryUnitFacts, canonicalLineFacts)).toBe(false)
  expect(combatModifierFactsCompatible(actorFacts, canonicalLineFacts)).toBe(true)
  expect(combatModifierFactsCompatible(primaryUnitFacts, legacyUnitCenteredAreaFacts)).toBe(true)
  expect(spectator.snapshot.manualModifierAvailability).toEqual([])
  ```

- [ ] **Step 2: Run RED.** `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-modifier-compatibility.test.ts src/combat/combat-controlled-modifiers.test.ts` and `pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-live-viewer-projection.test.ts src/components/battle/battle-ability-controls.test.ts`. Expected: the new facts/projection assertions fail for missing behavior, not invalid fixtures.
- [ ] **Step 3: Implement the interfaces.** Extract current supported-payload/primary-unit checks, applying canonical default geometry through the existing canonical target adapter. Reuse the facts in paid composition and Controlled admission/restore. Native classification remains the trusted adapter's existing attack/recovery/utility mapping; native selected-center geometry stays intact. Owner projection builds reports from captured records and existing effect/timing context, never from opaque ID parsing or another catalogue version. Export the new pure module through the package's existing subpath convention.
- [ ] **Step 4: Run GREEN.** Repeat the focused commands and affected package typechecks. Expected: all new assertions pass and existing admission/restore legality remains unchanged.
- [ ] **Step 5: Commit** only this metadata/compatibility slice: `feat: expose safe modifier compatibility metadata`. Keep the whole milestone unaccepted until Task 6.

### Task 2: Exact prepared-command resource and visible-clock quotes

**Files:** Modify `pv1f-action-economy.ts` and `apps/web/src/server/battle/battle-preview-service.ts`; create `apps/web/src/server/battle/battle-command-quote.ts` and `.test.ts`; extend `battle-preview-service.test.ts`, `packages/game-core/src/combat/combat-ability-command.test.ts`, `packages/game-core/src/combat/pv1f-action-economy.test.ts` and `battle-live-viewer-projection.test.ts` for the public boundary.

**Interfaces:**

- Add optional private `quote: Pick<PreparedCombatAbilityCommand, 'costs' | 'participants'>` to `evaluatePv1fAction` and `evaluatePv1fMatureSkill` return types. Populate it from the already returned preparation result on every composed canonical/native/Mature branch; carry the same data through the service's direct canonical/Essence branch.
- Export public `BattleCommandQuote` from the new server module: readonly `commandCosts: readonly { resource: 'ap' | 'mp' | 'hp'; amount: number }[]` and `commandCooldowns: readonly { actionId: string; contentVersion: number; behaviorId?: string; role: 'root' | 'manual-modifier' | 'automatic-modifier'; ownerTurns: number; ticksRemaining: number }[]`.
- Export `projectBattleCommandQuote(state: StatDrivenCombatEncounterState, actorId: string, input: { quote: Pick<PreparedCombatAbilityCommand, 'costs' | 'participants'> } | { native: { action: CombatActionDefinition; apCost: number } }): BattleCommandQuote`. Add these fields optionally to `BattleActionPreview` for old-response compatibility. Private participants never become public DTO fields.

- [ ] **Step 1: Write failing outcome tests.** `quote_equals_atomic_payment` builds root AP2/MP3/HP1 plus explicit AP1/MP2/HP2 and admitted Automatic AP1/MP1/HP1: expect `[{resource:'ap',amount:4},{resource:'mp',amount:6},{resource:'hp',amount:4}]`, and compare commit deltas. `shared_clock_uses_maximum` gives visible durations2/4 on one clock and expects effective4 without duplicate payment/clock starts. `hidden_automatic_clock_privacy` adds a hidden contributor with duration5 and expects exact totals/effective5 on the visible shared row, with no hidden identity/key/source/report/suppression inventory. `all_adapter_branches_preserve_quote_once` covers canonical Skill/Basic, native, Mature and Essence; spy only at the preparation seam to assert no second preparation. `native_uncomposed_uses_trusted_cost` expects actual AP/MP plus HP0, never prepaid action zeros. `preview_has_no_settlement` compares state/RNG/clocks/usage before and after. Retain real HP-leaves-one, miss/all-gated payment and paid-interruption outcome cases.

  ```ts
  expect(quote.commandCosts).toEqual([
    { resource: 'ap', amount: 4 },
    { resource: 'mp', amount: 6 },
    { resource: 'hp', amount: 4 },
  ])
  expect(quote.commandCooldowns).toEqual([
    expect.objectContaining({ ownerTurns: 4, ticksRemaining: 0 }),
  ])
  expect(stateAfterPreview).toEqual(stateBeforePreview)
  ```

- [ ] **Step 2: Run RED.** `pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-command-quote.test.ts src/server/battle/battle-preview-service.test.ts` and `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-ability-command.test.ts src/combat/pv1f-action-economy.test.ts`. Expected: missing quote fields/incorrect totals fail while fixture legality is valid.
- [ ] **Step 3: Implement the quote handoff and projection.** Copy exact prepared totals into AP/MP/HP entries including zeros; enforce safe integer output. Group clocks privately before emission, using the real maximum duration and authoritative remaining ticks. Allowlist only current owner-visible public equipped participants under existing visibility rules; do not expose raw source or clock identifiers. The historical uncomposed branch uses its actual trusted AP adapter, authored MP and HP0. Do not re-materialize/prepare or change settlement.
- [ ] **Step 4: Run GREEN.** Repeat focused core/service tests and affected typechecks. Expected: exact quote/commit comparison, privacy, no-settlement and legacy response assertions pass.
- [ ] **Step 5: Commit:** `feat: project exact composed battle command quotes`.

### Task 3: Additive controls with preserved custom chords

**Files:** Modify `packages/validation/src/player/combat-controls.ts` and `.test.ts`, `apps/web/src/components/settings/combat-controls-settings.tsx` and `.test.tsx`; create `apps/web/src/server/player-profile/player-controls-service.test.ts` against the existing service's repository boundary. Do not add a database migration.

**Interfaces:** Add `'modifiers'` to `CombatKeybindAction` and `{ code: 'KeyM', shift: false }` to defaults. `parseCombatKeybindMap(input: unknown): CombatKeybindMap | null` remains the normalization/validation entry. Settings copy is **Modifiers**, describing deliberate preparation before use/priming. Existing GET/Save shapes remain unchanged.

- [ ] **Step 1: Write failing tests.** `old_custom_m_preserved` keeps an old M command and allocates Shift+M; `old_m_shift_m_and_fkeys_preserved` fills the 22 old action entries with M, Shift+M and F1–F20 and expects F21. `historical_slot_items_then_modifier_normalization` asserts all old normalization results stay exact before allocating the new key. `explicit_modifier_binding_retained` keeps a supplied Shift+F24 binding. `duplicate_unknown_and_malformed_rejected` preserves parser/Save rejection. `read_does_not_write_and_save_roundtrips` proves load performs no persistence and explicit Save retains the normalized map; mock the existing admin-client boundary for Save, without invoking hosted RPCs. `settings_modifier_capture` verifies the row can record/rebind/reset/save using existing capture rules.

  ```ts
  expect(normalizedWithCustomM?.modifiers).toEqual({ code: 'KeyM', shift: true })
  expect(normalizedCrowdedOldMap?.modifiers).toEqual({ code: 'F21', shift: false })
  expect(explicitMap?.modifiers).toEqual({ code: 'F24', shift: true })
  expect(saveRpc).not.toHaveBeenCalled() // after read only
  ```

- [ ] **Step 2: Run RED.** `pnpm --filter @aurevane/validation exec vitest run src/player/combat-controls.test.ts` and `pnpm --filter @aurevane/web exec vitest run src/components/settings/combat-controls-settings.test.tsx src/server/player-profile/player-controls-service.test.ts`. Expected: missing action/allocation/copy assertions fail.
- [ ] **Step 3: Implement normalization after historical slots/Items.** Reserve every valid existing chord; for an absent modifier binding try M, Shift+M, F1–F24, Shift+F1–Shift+F24 in that order. Preserve strict parsing and existing malformed-settings read-failure behavior. Add settings copy through the existing typed map; no read rewrite or hardcoded independent listener.
- [ ] **Step 4: Run GREEN.** Repeat parser/settings/Save tests and relevant types. Expected: old maps retain their prior command meanings, custom new bindings survive round trips, no SQL change.
- [ ] **Step 5: Commit:** `feat: preserve custom controls when adding modifier shortcut`.

### Task 4: One transient draft and identical intent references

**Files:** Create `apps/web/src/components/battle/battle-modifier-draft.ts` and `.test.ts`; modify `battle-preview-selection.ts`, `battle-range-previews.ts`, `use-battle-range-previews.ts` and their existing tests. Controller callbacks integrate in Task 5.

**Interfaces:**

- `BattleModifierContext`: readonly `battleSessionId: string`, `battleVersion: number`, `actorId: string`, `actionId: string`, optional `behaviorId: string`, `rootContentVersion: number | null` and `rootFingerprint: string` (the selected immutable target/classification/cost contract).
- `BattleModifierPinnedSelection`: readonly `sourceInstanceId`, `abilityId`, `behaviorId` strings, `contentVersion: number`, `fingerprint: string`. Fingerprint only immutable captured report/cost/clock-definition/compatibility metadata, excluding current eligibility/reasons/ticks.
- `BattleModifierDraft = { readonly context: BattleModifierContext; readonly selected: readonly BattleModifierPinnedSelection[] }`.
- Export `prepareBattleModifierDraft(context: BattleModifierContext): BattleModifierDraft`; `toggleBattleModifierDraft(draft: BattleModifierDraft, choice: BattleModifierPinnedSelection): BattleModifierDraft`; and `resolveBattleModifierDraft(draft: BattleModifierDraft | null, context: BattleModifierContext, choices: readonly BattleModifierPinnedSelection[], controlled: BattleControlledActionAvailability | undefined): { manualModifiers: readonly ManualCombatModifierSelection[]; stale: boolean; locked: boolean }`. Toggle only manipulates exact pins/order; admission/read-only rules stay in the caller. Resolve compares immutable identities/fingerprints synchronously, and primed resolution ignores the draft entirely.
- `BattlePreviewSkill.manualModifiers?: readonly ManualCombatModifierSelection[]`. Extend `selectBattleControlledPrimeIntent(captures, actionId, behaviorId?, manualModifiers?)` with the same exact references; cancel carries none. Add optional `classification` and `modifierRoot` on the descriptor, sourced from the selected group/recognized native facts.

- [ ] **Step 1: Write failing tests.** `same_root_arm_preserves_set` keeps refs across target/path clearing; `changed_root_group_actor_or_version_clears` resolves old context as unusable before effects run. `same_version_metadata_mismatch_blocks` marks stale and disallows submission instead of returning a usable empty set. `same_context_blocked_selection_retained` distinguishes immutable pins from changing eligibility. `primed_absent_means_empty` and `reconnected_prime_ignores_local` assert captured empty/nonempty authority. `all_intent_factories_keep_exact_refs` table-tests initial/self/unit/plural/tile/Line/Circle/All/Move factories, preserving existing geometry. `range_memo_changes_on_set` asserts request identity changes with attachments and old results become unavailable. `prime_gets_set_cancel_gets_none` covers the free command boundary.

  ```ts
  expect(resolvedChangedMetadata.stale).toBe(true)
  expect(resolvedPrimedAbsent).toEqual({ manualModifiers: [], stale: false, locked: true })
  expect(previewIntent.manualModifiers).toEqual(commitIntent.manualModifiers)
  expect(primeIntent.manualModifiers).toEqual(commitIntent.manualModifiers)
  ```

- [ ] **Step 2: Run RED.** `pnpm --filter @aurevane/web exec vitest run src/components/battle/battle-modifier-draft.test.ts src/components/battle/battle-preview-selection.test.ts src/components/battle/battle-range-previews.test.ts src/components/battle/battle-preview-request.test.ts`. Exercise hook request-key changes through the existing component harness or an adjacent hook test, rather than source-string assertions. Expected: refs/lifecycle assertions fail for currently missing binding.
- [ ] **Step 3: Implement pure draft resolution and binding.** Normalize code-unit order without mutating inputs. Invalid pins make the command unavailable/stale; absence on a prime remains the authoritative empty set. Bind refs through the existing `movedBattleSkillIntent` path and direct range Line/Circle/All factories; include them in hook destructuring/dependencies/request descriptor. Never copy refs into a cancel or allow a stale draft to become a plain cast.
- [ ] **Step 4: Run GREEN.** Repeat focused tests and web types. Expected: all factory payloads match and old response keys cannot become current after a set change.
- [ ] **Step 5: Commit:** `feat: bind transient modifier drafts to battle intents`.

### Task 5: Shared picker, preparation and actual keyboard/touch flows

**Files:** Create the picker component/CSS and `battle-modifier-picker.test.tsx`; modify `battle-info-popover.tsx`, `battle-experience.tsx` and only necessary shared footer styles. Extend `battle-ability-controls.test.ts` and the existing browser harness/script. Avoid unrelated controller refactoring.

**Interfaces:** Export `BattleModifierPicker` with typed props `actions: readonly BattleModifierActionChoice[]`, `modifiers: readonly BattleModifierChoice[]`, `selectedActionKey: string | null`, `selectedReferences: readonly ManualCombatModifierSelection[]`, `locked: boolean`, `readOnly: boolean`, `binding: CombatKeybind | null`, `quote: BattleCommandQuote | null`, `quotePending: boolean`, `onPrepareAction(choice: BattleModifierActionChoice): void`, `onToggleModifier(choice: BattleModifierChoice): void`, and `triggerRef: RefObject<HTMLButtonElement | null>`. Choice types live beside the draft/model:

- `BattleModifierActionChoice`: readonly `key: string`, `label: string`, `context: BattleModifierContext`, `descriptor: BattlePreviewSkill`.
- `BattleModifierChoice`: readonly `reference: ManualCombatModifierSelection`, `pin: BattleModifierPinnedSelection | null`, `label: string`, `report: BattleAbilityBehaviorReport | null`, `costs: AbilityBehavior['costs'] | null`, `cooldown: (NonNullable<AbilityBehavior['cooldown']> & { readonly ticksRemaining: number }) | null`, `compatibility: CombatModifierCompatibilityFacts | null`, `ownerEligible: boolean`, `blockedReasons: readonly string[]`.

Use exact owner DTO data, with generic name fallback only. Merge selected pins missing from current choices into visible unavailable rows; do not silently drop them. A missing-metadata row cannot be newly selected; an ordinary selected row can be removed using its saved pin. A primed row is always locked. Null cost/report means unavailable information, never free expenditure.

Extend `BattleInfoPopover` additively with optional `initialFocus?: () => HTMLElement | null` and `triggerRef?: RefObject<HTMLButtonElement | null>`. Existing readers keep their current behavior. The new callback selects initial child focus on open; normal close/Escape returns focus through the existing primitive. The validated custom-key handler opens via the same trigger ref; no second global listener.

- [ ] **Step 1: Write failing interaction tests.** `prepare_never_dispatches` asserts root/group selection and checkbox changes send zero preview/command/prime until existing use controls proceed. `controlled_selection_before_artwork_prime` captures the full set once with zero payment; post-version/reload rows lock and release sends the same set. `empty_direct_prime_unchanged` retains one-click no-attachment behavior. `ordinary_blocked_row_removable` and `free_prime_ignores_release_only_restrictions` distinguish admission from future release costs/Requirements. `offturn_terminal_pending_readonly` permits reading/dismissal but zero edits/preview/commands. `draft_transition_uses_next_set` catches stale React closures on rapid selection/use. `selected_group_drives_resonance_mode` verifies recovery/attack highlighting and command target meaning.

  ```ts
  expect(commandCalls).toHaveLength(0) // after preparation/toggle only
  expect(previewCalls).toHaveLength(0)
  expect(primeCall.intent.manualModifiers).toEqual(releaseCall.intent.manualModifiers)
  expect(document.activeElement).toBe(firstModifierRow) // after explicit action selection
  ```

- [ ] **Step 2: Add native input/browser failures.** Through mounted production `BattleExperience`/real core, use actual keyboard Arrow/Home/End/Left/Right/Space/Enter/Escape and pointer/touch. Assert focus moves without incidental selection, repeats do nothing, Enter/Space never executes a battle command from the picker, Escape dismisses only the reader and retains the draft, outside click is consumed, and existing text/dialog/browser-shortcut/visibility guards retain ownership. Delay `/api/account/controls`: the trigger works but no new shortcut/caption is claimed until a validated map arrives; then the actual customized chord opens the panel. Test long incompatible lists and list reachability with no compatible rows. Include direct next/previous directional factories in the captured-intent assertions.
- [ ] **Step 3: Run RED.** `pnpm --filter @aurevane/web exec vitest run src/components/battle/battle-modifier-picker.test.tsx src/components/battle/battle-ability-controls.test.ts src/components/battle/battle-keyboard-scope.test.ts`; run the targeted browser command below when a valid executable is available. Expected: actual missing interaction/payload assertions fail; unavailable Chromium is an evidence blocker, not RED product evidence.
- [ ] **Step 4: Implement the shared UI and controller wiring.** Classify as **both desktop and mobile**, shared PvE/PvP. Add one compact footer entry when owned choices exist; selected count and validated key caption. Build explicit action/group choices from actual equipped actions/enabled Basics, including active Resonance, using selected-group classification. Preparation sets local action/group/mode directly without calling prime-producing `armAction`; keep the one bound draft separate from target/path clearing. Root/group change/cancel abandons the draft; arming the same root retains it. Pass the next context/set explicitly; synchronously gate stale descriptors and pending/old closures. Prime and every direct/target/movement/directional commit/preview use the same resolved set. No automatic retry as an empty cast. After authoritative prime, read its locked set, never the draft. Current rejection retains same-context choices and clears old quotes. Display complete current AP/MP/HP/visible clocks only for a matching quote; otherwise own captured costs plus unquoted/pending state. Label the prime Free and its future release separately. Reuse reports and actual packet timing; label stable modifier order without claiming a false global packet order.
- [ ] **Step 5: Run GREEN and inspect.** Repeat focused tests. Run `AV_TARGETING_EVIDENCE_DIR=<absolute-evidence-directory> pnpm --filter @aurevane/web exec node scripts/battle-canonical-targeting-browser-regression.mjs`; the existing optional `AV_CHROMIUM_EXECUTABLE` selects a verified local browser binary. Extend its fixture modes, without replacing production controls/core with mock execution. Cover 1366×768,1440×900,390×844 and200% browser zoom in PvE/PvP, keyboard plus touch, errors/empty/long lists, ready-only glow and unchanged art/slot bounds. Inspect screenshots and console results; preserve differences between local harness, hosted authentication and human acceptance. If browser cannot run, save the concrete failure and keep this acceptance open.
- [ ] **Step 6: Commit:** `feat: add shared battle modifier picker`. No milestone-complete claim before Task 6.

### Task 6: Combined milestone verification and recovery checkpoint

**Files:** All changed tests plus new `docs/verification/2026-10-16-manual-modifier-picker.md`; existing recovery ledger/evidence and per-task handoff. This is a verification/review checkpoint, not a new implementation subsystem.

**Interfaces:** Consume Tasks1–5. Produce exact tested source/receipt, one combined independent implementation review, scoped fixes and durable remaining-gates record. Preserve the original complete recovery plan and accepted roster design; do not expand this picker milestone into a fresh roster redesign.

- [ ] **Step 1: Review spec coverage against the actual diff.** Check every Global Constraint and Review Focus against the owning tests and rendered evidence. Add focused failing regressions only for concrete uncovered behavior, including stale retries/no-input/terminal/source removal and recursive old/new snapshot privacy. Confirm direct casts still work without a forecast receipt and no extra Move charge appears.
- [ ] **Step 2: Run affected format/lint/types and focused tests, then `pnpm check` once on frozen final source.** Expected: all enabled checks pass; capture exact counts/receipt, distinguish pre-existing warnings/failures and do not suppress them. A code correction requires affected retests and a new final full gate; otherwise avoid duplicate broad runs.
- [ ] **Step 3: Obtain one fresh combined independent review** of the complete implementation baseline-to-head, using the existing inline method's review gate. Supply spec, this plan, test receipts, deferred Ground subset wording/unavailable Resonance caption, browser/hosted limits and scope. Fix supported findings with focused RED→GREEN evidence; do not launch per-task or duplicate broad review loops. Any required higher-effort change follows a saved checkpoint and genuine effort pause under the Owner agreement.
- [ ] **Step 4: Refresh main and finalize.** Inspect overlaps, reconcile if needed, verify the exact resulting source, inspect unrelated churn and retain `apps/web/vercel.json` Git deployment lock. Commit the report and save a verifiable source bundle plus necessary evidence to the already-authorized backup-only archive branch, using expected-SHA nonforce updates. Verify remote ref and bundle hashes. Archive commits never replace implementation ancestry.
- [ ] **Step 5: Report the bounded result and remaining release work.** Picker acceptance depends on actual interaction evidence; inherited Atlas failure is still a release blocker. Continue complete immutable roster application, executable all-tag cases, real AI/Level100 balance, event/reader audit and coordinated release preparation under the parent plan. Reconcile current hosted content/Owner edits and follow the existing exact-head release gate before any eventual authorized deployment. This plan itself performs no hosted write, publication or release.

## Plan self-review and handoff

The six tasks cover the spec's interaction, controls, draft lifecycle, prime authority, shared compatibility/metadata, every intent factory, exact quote/privacy, layout and acceptance sections. The five Review Focus conditions have named owning regressions. Task interfaces use the same quote, facts, pins and descriptor fields throughout; execution stays on the existing service/core path. Historical/unknown data fails closed only for new selection, preserving truthful readers and existing direct native controls. No whole-game refactor, persistent preference queue, duplicate Requirements evaluator or second executor is introduced.

Execution method remains inline. Written plan and inline execution were approved by the Owner. Tasks1–5 are committed locally; Task6 combined review/evidence and native interaction acceptance are tracked in `docs/verification/2026-10-16-manual-modifier-picker.md`. Native acceptance remains open. The Owner's October16 continuation approved the already-written design and return to High. Working live estimate communicated as **24–48 active hours for the combat-first release**, low confidence pending picker integration and browser blockers; it is a planning estimate, not a promised launch or a claim that broader Master/world work is included.
