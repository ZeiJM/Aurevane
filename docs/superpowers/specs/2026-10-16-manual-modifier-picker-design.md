# Explicit Manual modifier picker

Status: Owner accepted the written design and return to High with “ok go on” on October 16, followed by “continue”. The approved plan has a local implementation checkpoint; combined review and native interaction acceptance are tracked in `docs/verification/2026-10-16-manual-modifier-picker.md`. No release is claimed.

Source baseline: `6616c213821b03254f2ef4f7f238521260aa1024`. The preceding Ground, captured controls and Controlled bundle checkpoints remain intact. This design completes the player-selection handoff in the approved `2026-10-10-manual-modifier-command-design.md`; it does not replace its combat rules or the complete recovery plan.

## Intent and constraints

The player must deliberately choose modifiers for one particular action, understand its combined cost and restrictions, and execute the same selection through pointer, touch or keyboard. A Controlled action must capture that selection when freely primed; subsequent release cannot change it.

Owner requirements carried forward: preserve four Skill slots, exclusive Essence/Resonance artwork, artwork dimensions, board-first layout, no additional Release button, ready-only artwork light, custom controls, server authority and PvE/PvP parity on desktop/mobile. Attached Move keeps its overall Skill price. Automatic/Ongoing/modifier-only content stays truthful and cannot become a standalone paid cast. Reader prose stays concise; non-damage values and timing remain in their structured places, with matching orange effect names and bracketed values.

Assumption selected for review: one compact footer entry is acceptable within the existing footer actions. It adds no artwork or command-deck slot. Final physical layout remains an acceptance check.

## Approaches considered

| Approach                                                      | Benefit                                                                                                        | Cost / decision                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One footer Modifiers panel, with a configurable shortcut      | Works for modifier-only and mixed sources; permits preparation before prime; one shared interaction in PvE/PvP | Recommended. Requires an accessible small composite picker and one additive control binding.                                                                         |
| Put selection only inside each Skill information popup        | Reuses each existing info control                                                                              | Makes action/group context hard to see across sources and leaves mixed-source keyboard access awkward. Keep information readers, with guidance to the common picker. |
| Make every first artwork activation open setup before priming | Makes preparation unavoidable                                                                                  | Changes the direct control flow for builds that use no attachments and adds unnecessary interaction. Preserve existing direct activation instead.                    |

## Player flow

The existing footer gains **Modifiers**, the selected count and its actual configured key. Default is **M** when that chord is free. Show the entry when the controlled actor has an active owned Manual modifier; it remains usable for reading outside the actor's turn. The shortcut produces the same panel. With no owned choices it may give a concise empty-state notice, without making a command.

The panel uses the existing compact information-popover styling, single-reader ownership and outside-click/Escape dismissal. Its two sections are **Action** and **Modifiers**. It shows actual equipped public names and selected group information. It does not list arbitrary hidden/scenario actions or parse an opaque source-instance ID into a name.

1. Opening selects no new action. If an unambiguous currently prepared action is compatible, retain that context; otherwise focus the Action list and require an explicit choice. Multiple Manual groups remain separate choices.
2. Selecting an action/group updates local command planning only. It clears the previous action's targets, path, quote and attachments. It never primes, executes, spends, reserves a cooldown or chooses a target.
3. Checkboxes choose exact owned Manual modifier references for that action. Show each one's captured cost, cooldown and concise Requirements/effect information. Show incompatibility/blocked reasons. Never attach Automatic or Ongoing groups through these checkboxes.
4. Dismissing the panel retains this one local draft. Use the existing action artwork or its configured key to proceed. An ordinary action follows the existing target/direct-commit flow. An unprimed Controlled action freely primes the selected complete bundle through that same artwork/key. No additional Release control is introduced.
5. After prime, the panel displays the authoritative captured attachment set as locked. Release continues through existing artwork/target controls. The player can inspect the set or cancel the prime through the existing Cancel action; cannot edit a captured set in place.

With no attachments chosen, existing direct artwork/hotkey behavior is preserved, including immediate free priming. A player who wants attachments opens Modifiers first. Short help explains that priming locks the chosen set. Preparatory selection of an unprimed action cannot make target gestures bypass its required prime.

Current `Cancel Action` semantics remain: it clears an ordinary local draft; for the selected cancellable prime it sends the existing cancel command. Opening, choosing another action or closing the panel does not cancel an unrelated server prime. A spent Controlled action has no new prime/release command; its information remains readable.

## Keyboard, touch and layout

Use a roving-focus list of action/group buttons followed by a roving-focus checkbox list. Arrow Up/Down moves focus without selecting. Home/End moves to list ends. Space/Enter deliberately selects an action or toggles an attachment. Selecting an action moves focus to its first modifier row. Left/Right moves between the two lists without selecting a different action; with no action chosen, the panel announces that a choice is needed. The root list stays reachable when an action has no compatible modifiers.

Rows with a blocked/incompatible reason remain focusable and readable using `aria-disabled`; their handlers enforce whether selection is allowed. A currently selected ordinary modifier can be removed even if it has become blocked. Captured primed rows cannot be toggled. Repeated toggle events are ignored. Enter/Space never bubbles into a battle command.

Outside the actor's active turn, after completion or while execution is pending, this panel is read-only: lists and reasons remain accessible, but no draft edit, prime, preview or command is dispatched. For an ordinary action, a newly selected row must pass the known owner-relative availability checks; a previously selected blocked row remains visible/removable. Unresolved target-specific conditions are checked by the existing server quote/commit. Unprimed Controlled setup follows the separate free structural-admission rule below.

On open, focus the current selected modifier, the first modifier for a valid action, or the first action choice. Escape closes this panel first and returns focus to its trigger/battle root; it does not also cancel the draft. Outside dismissal consumes the gesture as existing cockpit readers do. No plain Tab cycling is introduced. Text fields, other open readers/dialogs, hidden/unfocused documents and browser modifier shortcuts retain their existing ownership/guards.

Pointer and touch use the same state transitions. Keep the footer entry compact and reuse existing long-reader scrolling/page treatment at narrow widths and 200% zoom. Do not shrink artwork, add a Skill slot or cover board controls with a permanent new pane.

Add `modifiers` to the typed account controls and settings copy. The handler reads the actual validated binding; no separate hardcoded M listener. For a missing binding, preserve every valid existing chord and allocate the first free candidate: M, Shift+M, F1–F24, then Shift+F1–Shift+F24. Run existing historical slot/Items normalization before this new allocation; do not change its established migrations. An explicitly supplied valid modifier binding remains exact. Unknown fields, malformed maps and duplicate chords remain invalid at the parser/save boundary. Preserve existing read-failure handling; a valid customized map must never fall back to defaults merely because this key was introduced.

Reading old settings performs deterministic normalization, without rewriting stored account preferences. The existing explicit Save operation persists the complete validated map. The current save RPC accepts server-validated JSON objects, so this design requires no hosted SQL change or account backfill. The new shortcut/key caption must wait for a validated current controls map; a delayed/failed load cannot claim a guessed chord over an existing custom command. The visible entry remains available. Binding refresh alone performs no selection or command.

## One local draft and one server prime

The local draft is transient React planning state for one root/group, not a modifier queue or saved build setting. Bind it to battle session/version, acting owner, root action/group and captured root version when present. Pin chosen modifier source/ability/version/behavior identities from the owner DTO. References sent to preview/commit remain the existing identity-only `{ sourceInstanceId, behaviorId }` pairs, sorted by code-unit source/behavior order.

| Event                                                                            | Local draft / quote                                                                                             | Server prime                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Change focus, target or legal Move destination                                   | Keep chosen set; invalidate/recompute affected quote                                                            | Unchanged                                      |
| Toggle attachment                                                                | Keep current root; clear target/path/old quote and rebuild with the new set                                     | Forbidden for an existing prime                |
| Close the picker                                                                 | Retain the same draft                                                                                           | Unchanged                                      |
| Change root/group or Cancel ordinary planning                                    | Clear old attachments and quotes                                                                                | Other primes unchanged                         |
| New battle version, actor/turn loss, terminal state, reload or stale replacement | Clear unprimed attachments and all old quote readiness                                                          | Re-read current authoritative captured set     |
| Source metadata changes/missing within the same apparent version                 | Mark the selection stale and block that submission until refreshed/reselected; do not turn it into a plain cast | Authoritative reconciliation owns cancellation |
| Successful ordinary commit                                                       | Consume this draft; no attachments carried into a later action                                                  | Existing rules                                 |
| Rejected legal-version release                                                   | Keep the attempted set and show why it is blocked                                                               | Retained by the existing authority             |

Derive a mismatched draft/quote as unusable immediately during render/intent construction; do not rely on a later effect to clear stale state. Old event closures remain subject to existing version, turn, focus, pending and execution locks. A same-context unavailable selected modifier is shown and rejected, not silently dropped.

Distinguish clearing targets/path/quotes from abandoning a command. Arming the same prepared root must retain its bound modifier draft; changing root/group or cancelling must abandon it. Do not add an unconditional attachment clear to every existing `clearPlanning` call. Selection callbacks pass the next complete context/set explicitly into the draft/intent transition, rather than issuing a command using a React state update that has not rendered yet.

For a primed root, resolve references exclusively from its current owner-only Controlled availability. An absent captured list means the captured empty set. Never fall back to a later local selection, including after the free prime increments battle version. Primed metadata survives reconnect through the existing private record and safe projection.

During an unprimed Controlled setup, structural compatibility determines checkbox admission. Current resource, cooldown, usage or Requirements blocks are displayed as release restrictions; they do not become payment/settlement checks on the free prime. Ordinary actions retain their current release restrictions. Source ownership/activity, mode, duplicate/budget and impossible-recipient checks always apply. Maximum fifteen explicit modifiers remains the existing safety bound.

Show selected modifier blocks in their actual stable source/behavior composition order, preserving authored packet order within each block. Label this as modifier order and retain each packet's actual timing/recipient rules; do not promise that every root packet settles before independent actor packets. Clicking checkboxes in another order does not reorder execution. Optional Automatic contributions retain the existing composition order and privacy policy; this panel never invents a private contributor's identity.

## Safe metadata and shared compatibility

Extend the existing owner-only `manualModifierAvailability` rows with `abilityId`, `contentVersion`, a sanitized shared behavior report, and compact compatibility facts. These fields come from the exact captured source/behavior. Resolve visible names through the matching pinned public equipped record; when a name is unavailable, use an honest generic label and the existing group label, never another catalogue version. Other owners and spectators receive no choices/references.

The additive fields are `abilityId`, `contentVersion`, `report` and `compatibility: { payloadsSupported, requiresExplicitUnit }`. Captured Manual-action/Basic rows use `modifierRoot: { classification, targetKind, persistentGround, hasPrimaryRecipient }`. Each is derived from its actual selected behavior/native contract. Missing/invalid new modifier identity/version metadata disables selection and requests refreshed information; it cannot fall back to parsing an opaque ID. The corresponding native helper supplies those root facts only for a recognized historical action already offered by the controller.

Extract shared pure facts from the current compatibility helper: supported modifier payloads and whether any packet needs an explicit selected unit; root classification, native/canonical targeting semantics, persistent Ground and explicit-unit feasibility. Paid composition, prime admission/restore and UI hints consume the same facts/comparison. This does not create another Requirements evaluator or alter support.

Canonical roots use their selected captured group, with canonical default geometry applied. Existing Manual-action and Basic presentation rows receive safe root compatibility facts. Synthetic active Resonance envelopes use those rows. Historical native Skills/Basics use the same pure native-fact helper as the trusted native command adapter, from their pinned public native fields; preserve selected-center legacy area semantics. Unknown canonical references fail closed. The picker root list is limited to actual equipped public actions and enabled Basics already offered by the controller.

Primary-unit modifiers cannot be prepared for canonical Line/Circle/All activation or Ground-only Single selection. Supported actor/affected-unit modifiers remain available for compatible area roots. Persistent Ground and other currently unsupported combinations remain explicitly unavailable. Static compatibility is a hint; actual selected Requirements, geometry, costs, clocks, limits, source/build/version and ownership remain authoritative at the existing service/core boundary.

Use the chosen group's typed classification for picker filtering and targeting meaning, including active Resonance recovery/attack groups. Ability-menu placement can stay stable; it must not overwrite the chosen group's actual semantics. This supplies the data correction needed for the existing Resonance highlighting finding without adding client execution rules.

## Exact forecasts and resource information

Add optional `manualModifiers` to `BattlePreviewSkill` and the shared intent-binding path. Every initial, self, unit, plural, tile, directional and Move-follow-up intent uses the same references. Include direct Line/Circle/All range factories, next/previous-target directional candidates and every descriptor/memo key in `useBattleRangePreviews`. Prime creation receives the selected references explicitly. Cancellation carries none.

A changed set invalidates pending/in-flight/ready selected forecasts and range results immediately. Retain existing abort/sequence/version matching. Informational forecasts never authorize a commit or select a target. Direct intentional commits continue without requiring a preview receipt. No command layer may silently replace a supplied set with empty references after a stale/blocked error.

Extend the public action forecast additively with `commandCosts` (AP/MP/HP entries) and `commandCooldowns` (safe visible participant identity/role, effective owner-turn duration and current remaining ticks). These are owner-only current-intent quote data, not client authority. No action definition, private participant object, raw accuracy, requirement snapshot, source-instance provenance or suppression inventory is projected.

When present, `commandCosts` has exactly three nonnegative safe-integer entries in AP, MP, HP order, including zeros. Absence on an older response means no complete quote, not free expenditure. Each `commandCooldowns` row contains public `actionId`, `contentVersion`, optional `behaviorId`, `role` (`root`, `manual-modifier` or `automatic-modifier`), `ownerTurns` and `ticksRemaining`. The producer groups shared clocks before emitting visible rows; no raw clock key or source-instance ID is needed by this reader.

Retain the already prepared command's exact aggregate costs and participant-clock data at the trusted evaluation adapter boundary; project an allowlisted copy. Extend canonical and native/Mature/Essence evaluation returns with private quote data so the service does not prepare a second action or reconstruct totals from a prepaid zero-cost action. When no composed command exists, preserve the native quote from its trusted AP/MP cost adapter, with HP expenditure absent/zero under that historical contract. Shared cooldown keys retain their maximum effective duration; no second clock starts during preview.

Resource totals include all admitted contributions. Clock rows may identify only owner-visible root/owned Skill/Essence/Resonance contributors under the existing visibility policy. Hidden/scenario contributors never expose identity, key, report or provenance; visible shared clocks still use the actual resulting duration. Automatic/Ongoing groups cannot become explicit checkboxes. Sanitization applies recursively at API/RSC/live/preview boundaries.

Display the current complete AP/MP/HP quote and participating visible clocks inside the Modifiers reader's structured command information. Keep the existing recipient forecast strip and removed inline AP/Range chips unchanged. Before a target/current quote exists, show each selected record's own captured cost and an unquoted/pending state; do not label a client sum as the final command price. Unprimed Controlled setup labels the prime Free and distinguishes future release information. A blocked/error response clears the prior quote, retains same-context explicit choices and explains the restriction. A prior root/set/target quote must never supply readiness or a displayed current total.

## Implementation boundaries and acceptance

Use the existing shared `BattleExperience`, popover, captured-cost adapter, preview factories/request transport, owner projections, typed controls/settings and canonical/native preparation. Isolate the small draft/binding helper, compatibility facts and picker component; do not add unrelated refactors to the large controller. Existing server routes, CAS/idempotency, payment, hit/damage, Move, prime and release remain the sole command path. No new endpoint, queue, migration, hidden mechanic or dependency is selected.

The following observable cases are required; implementation must supply focused RED→GREEN regressions and actual browser evidence for the interaction:

- Ordinary Basic/native Skill/canonical Skill/Essence/Resonance roots; modifier-only and mixed sources; explicit multiple groups; actor/primary/affected recipients and unsupported combinations.
- Choosing a Controlled set before prime; free one-time capture; locked empty/nonempty sets after version change/reload; matching release; blocked release retains; source removal/cancel/spent/turn loss/terminal/no-input behavior.
- Exact AP/MP/HP and shared-clock quote versus commit, including optional Automatic contributions, HP leaving at least one, miss/all-gated payment and paid interruption. Preview consumes no RNG/resources/clocks.
- Every target/range/Move constructor carries the same normalized references. Set/root/group/actor/version/source changes invalidate quotes immediately; late responses, focus loss, repeats, duplicate/stale submissions and retries cannot change or duplicate a command.
- Native keyboard reaches both lists and toggles without Tab; custom M/Shift+M/F-key collisions, historical bindings, explicit settings save and delayed binding load; pointer/touch use identical intents. Open readers/text inputs retain key ownership.
- Actual shared desktop/mobile PvE/PvP plus 200% zoom: original slot/art bounds, compact footer, readable long lists, no accidental outside-click cast, ready-only light and accessible dismissal. Local production-component/real-kernel harness evidence is distinct from authenticated/hosted acceptance.
- Owner/ally/opponent/spectator recursive privacy and old public snapshots; no private definitions/accuracy or hidden identities. Unknown metadata cannot manufacture a new cast.

Run affected parser/core/service/controls/component tests, types/lint/format and `pnpm check`; obtain one independent combined review of the complete implementation milestone, then the existing combined release gates. Current inherited Atlas browser failure and unavailable local Chromium remain unresolved evidence limits. This design does not waive browser checks or claim a release.

Broader Task15/16 remains active: complete immutable roster application, all-roster AI/balance, event previews and final plain-language/orange-effect display audit. Ground repeated-subset wording and unavailable Manual Resonance caption remain in that audit; selected-group Resonance semantics are included above. Broader Master/world follows the agreed combat-first order.

## Review and effort handoff

This is the concrete design produced by the resumed Extra High pass and accepted by the Owner's October 16 “ok go on” response to the design-review/return-to-High request. Existing inline execution preference remains; do not ask again which execution method to use unless the Owner changes it. The written implementation plan is being prepared on High and follows the existing plan-review, TDD, combined-review and checkpoint workflow. Written-plan review remains pending before product implementation; the design/effort question is settled and must not be re-asked.

Spec self-review: no placeholders or undecided interfaces remain. Corrected the initial ambiguity between clearing target forecasts and abandoning attachments, explicit off-turn read-only behavior, ordinary versus free-prime blocked selection, inherited malformed-settings read handling, legacy area geometry, missing versus zero resource quotes and actual modifier block ordering. All selected changes serve this picker handoff; existing mechanical and release gates remain intact. This is the author's design self-review, not implementation or independent acceptance evidence.
