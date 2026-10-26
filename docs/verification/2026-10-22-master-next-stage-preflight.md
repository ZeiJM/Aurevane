# Master next-stage preflight — Content C/D and operations

Prepared by the coordinator during StageB completion. This is a continuation aid for the approved Task10–13 scope, not a new design, acceptance or permission gate. Root owns remote/migration/deployment; one implementer and one combined review seat remain the execution model.

## Content C: references and finalized immutable media

Binding sources: Owner brief sections3/10/12/13/14, Task10, task-10-reconstruction-contract and accepted StageA/B handoffs. Finish B review first.

Concrete source anchors observed on the reconciled branch:
- `components/master/combat-content/skill-media-editor.tsx` currently offers registered artwork/audio hooks and preview. It explicitly excludes raw paths/URLs and has no PC upload/finalization/crop workflow. Preserve existing hooks and their actual availability; extending this into real immutable media is substantive C work.
- `media/skill-media-hooks.ts` derives existing hook choices from current Skills/audio registry. Do not fake a produced audio cue for an unavailable reserved hook.
- `server/master/combat-content-authoring-validation.ts` validates only registered media hook keys for current Basics/Skills. New finalized assets must pass real server authority, ownership/type/size/content/crop/checksum validation and participate in complete saved-version validation.
- `components/master/combat-content/battle-flavor-template-help.tsx` already inserts existing narration tokens and previews explicit/neutral identities. `game-core/combat/battle-narration.ts` owns current token parsing/rendering. Extend the actual typed contextual authority and callers, with context-specific references, configured values and actual available results; do not add a competing interpolation engine.
- `game-core/combat/public-combat-presentation.ts` already strips private hit-authoring aliases recursively from the final public envelope. Preserve numeric public combat accuracy stats. Trace newly composed media/text/Tag/current/pinned envelopes through the same privacy boundary; source-only or CSS hiding is insufficient.

Required result: real PC upload/finalize/crop/audio/replace/remove/existing-asset selection, immutable exact references retained for current/deeper history/active captures, applicable formats/limits and actual failure handling. A label, URL, ticket or preview alone does not establish finalized media. Keep unsupported container audio/mechanics unavailable. Typed Insert Reference controls need understandable labels and singular/plural/context validation; prose cannot override mechanics or claim arbitrary-English verification. Public preview/current/exact readers must remain private-Accuracy-free.

## Content D: operator workflow and final shell

Consume accepted A/B/C APIs and shared category descriptor; finish applicable fields/defaults there. Replace redundant decorative Overview with compact Game Content, Combat Rules, Events & Live Ops, Players, Staff & Access, Site Music and the approved World Environment destination. Preserve outer game rail/footer/online controls and selected-character live access.

Complete searchable/sortable/filterable categories, New/Duplicate/Archive, supported direct Discipline/linked Skill management, Parameters/Text/Media/History, dirty/saved/published states, current plus two prior UI restore points without deleting deeper physical history, saved-revision-only Publish and Used-by/link pickers. Migrate every actual legacy editor caller retired by StageA. All independent Guard/HP Recovery/MP Recovery definitions remain editable, publishable and restorable irrespective of selected Support Action. Use the real full/compact/live/message components for comparison/sample previews and preserve illustrative-context limits.

Carry Staff Close/Save/Revoke focus restoration and truthful Players testing-versus-earned copy. Verify real save/publish/history/restore flows, exact incompatible blockers, reachable controls, keyboard/mobile/ordinary desktop/zoom. CSS2x is not physical browser zoom.

## Operations and final gate

Existing `.superpowers/.../remaining-master-contracts.md` remains the precise Task11/12 carry-forward for Rules/Music/World Environment and real Events lifecycle. Preserve already-working music silence/boundary/continuity/upload and event clock/XP authorities; fix demonstrated gaps and complete compact actual workflows.

Task13 maps all20 Owner sections plus Move/auxiliary/World Environment addenda. Add physical pointer metadata to actual catalogue checked-state snapshots. Prove editor→exact saved revision→publish→new authoritative encounter→public/participant/spectator readers, including every auxiliary option. Preserve old captures, current Owner edits, receipts, live combat and direct-RPC boundaries. Run one frozen final full quality/native gate and one whole-branch review. Do not repeat released roster design/publication or start map work. Apply reviewed required migrations, then publish the completed Master for live testing under the owner's October22 authorization.
