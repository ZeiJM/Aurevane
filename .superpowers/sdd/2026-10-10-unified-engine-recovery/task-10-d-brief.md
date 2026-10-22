# Task10 Stage D — finished compact Master Game Content workflow

Consume source-accepted A/B/C contracts. Do not change combat balance, republish roster, begin map work, or perform hosted operations. One sole implementer, no helper/reviewer agents. Root coordinates publication/native/hosted work. The exact full Task10 brief and selected Owner clauses below remain binding; do not read the whole implementation plan or session history.

Finish the actual compact shared Master shell with Game Content, Combat Rules, Events & Live Ops, Players, Staff & Access, Site Music and World Environment. Remove redundant decorative Overview hero. Preserve global rail/header/footer/online controls and live selected-character access. Operations destinations remain real; Task11/12 later complete their workflows, do not fake completion here.

Game Content: consume the one shared category descriptor and finish all applicable fields/defaults. Search/sort/filter, New/Duplicate/Archive, direct Discipline + new/linked existing Skill management, Used-by/link pickers, Parameters/Text/Media/History, dirty/saved/published indicators. Saved-revision-only Publish, current plus two previous UI entries, Restore to Draft; retain all deeper physical history. Every retired legacy publisher/direct pointer rollback caller must migrate to accepted A APIs. Old StageA native editor failure cannot be waived after this stage.

Expose independently editable Guard, HP Recovery, MP Recovery regardless of selected Support Action: parameters/text/media/history/save/publish/restore and actual shared previews. Preserve stable IDs, four total Discipline Skills, slot3 identity, cooldown/resources and complete current/pinned execution contracts. Inspection information controls remain usable.

Use actual full/compact/live/message components, with truthful illustrative sample context, to compare current/draft/saved content. Do not fake equipped Resonance matching, battle simulation or unavailable containers. Integrate C contextual references/finalized media and retain recursive public Accuracy stripping. Future kinds support finite meaningful drafts with specific unsupported publication/runtime blockers.

Preserve Staff Close/Save/Revoke focus restoration and truthful Players testing versus earned copies. Accessibility: reachable labels/buttons, keyboard focus/scroll, long values/errors/dirty state; 1366x768/1440x900/390x844 and real 200% browser zoom evidence at final integration. Natural necessary scrolling remains accessible; no trap or clipping to satisfy low-scroll preference. Discovery/typecheck/CSS2x is not actual browser evidence.

Verify meaningful RED/GREEN actual editor/workflow/route tests, saved exact revision chain, history/restore/dependencies, auxiliary independence, accessibility. Preserve command log ledger prefix, append real outputs/hash evidence. Frozen corepack pnpm; affected lint/types/format only before final Task13 full check. Prepare actual native browser flows; do not claim execution without observed runs. No blanket timeout/config/assertion relaxation.

Make coherent local checkpoints; root backs remote. Root performs current-main freshness checks. Deployment lock stays unchanged. Report .superpowers/sdd/2026-10-10-unified-engine-recovery/task-10-d-report.md with status, source/tree, interfaces/migrations, exact commands/results and pending gates/limits. Return status/commits/one-line tests/concerns only. Stop source for the one combined review; do not start Task11/12 without root unlocking.

## Exact Owner clauses

## 11. Master Panel structure and low-scroll design

Use **Game Content** as the proposed umbrella name, not Skills for everything. Recommended primary destinations are **Game Content, Combat Rules, Events & Live Ops, Players, Staff & Access, and Site Music**. Avoid a redundant Overview page of large decorative cards.

Within Game Content, expose **Disciplines; Skills with Basic/Discipline/Essence filters; Resonances; Items; Ascensions; and Severences**, plus access to the shared Tag Library. Keep category extensions on a shared editor foundation rather than six disconnected implementations.

Retain Aurevane’s visual identity while removing oversized headers, repeated branding, large decorative images, excessive whitespace, long explanatory banners, unnecessary badges, routine reason boxes, and visible policy bureaucracy. Preserve the appropriate account-menu access route and shared game footer/online-user controls.

Use searchable lists, compact toolbars, contextual sections, editable tag controls, and a responsive preview panel. Keep Save/Publish and dirty/draft status easy to reach. Prefer focused tabs and progressive disclosure over one towering form. Avoid replacing scrolling with confusing modal chains or too many clicks.

Minimize scrolling at ordinary desktop sizes, including approximately 1366×768 and 1440×900. Paginate or efficiently render long lists. Avoid nested scroll traps, horizontal overflow, clipped controls, and tiny text. Necessary scrolling must remain usable at zoom and on smaller screens; zero scrolling must not become more important than accessibility.


## 12. Manual creation and direct Discipline management

Authorized editors must be able to **create new content by hand**, not only modify existing seeded records. Support creating, editing, duplicating into a new draft, searching, sorting, filtering, previewing, publishing, and archiving where applicable. Make unpublishing dependency-aware and do not break active player references.

Provide a real **Discipline editor** covering name/identity, description, relevant media, supported eligibility and progression settings, linked skills, supported resonance relationships, unlock conditions, ordering, and public presentation. Reuse the actual game model rather than inventing a new progression system.

Allow creating a new skill directly within a Discipline and associating an eligible existing skill without duplicating its definition. Show “Used by” and reverse relationships. Edits must reach the real player-facing Discipline/progression systems, not just a disconnected catalogue. Preserve appropriate shared relationships, and do not force Basic or Essence skills into fake Disciplines.

Allow new Resonances, Ascensions, Severences, and Items to be manually authored using supported fields and behavior groups. Future categories must have meaningful saved definitions—not empty Coming Soon tabs. However, authoring a future record does not make unimplemented equipment, acquisition, transformation, or progression behavior playable. Block publication/activation of unsupported functionality with a specific explanation.

Protect essential Basic actions and referenced content from unsafe deletion. Renaming must not break stable references. Do not offer audio or unrelated mechanical fields on containers where the game has no meaningful use for them; surface applicable specialized fields consistently.


## 14. Real previews, publishing, versions, and attribution

Render previews with the actual public/battle components: full popup, compact skill information, linked tag explanations, applicable live-effect display, and sample use/result messages. Include media and Controlled indicators where relevant. Support appropriate sample contexts and a Draft/Published comparison without pretending sample text is a full battle simulation.

Editing saves a draft, not an immediate live change. Publish validates the complete record and updates parameters, references, text, hidden settings, and media together. Prevent stale edits from silently overwriting another editor’s published work. Show specific validation failures beside the relevant controls.

Retain **current plus two previous published versions** as the recommended interpretation of the requested two restore points. Draft saves do not consume history. Show who authored the present version and when, and preserve attribution for the previous snapshots. Record the publisher separately where different.

Restore a prior snapshot into a draft, preview it, and publish it as a new current version. Preserve the original snapshot’s author and identify the restoring actor/source. Restore the full configuration, including hidden accuracy and media references. Validate against supported tag definitions; restoring content is not rolling back the entire engine.

Publication must not split an in-flight action or primed snapshot across incompatible definitions. Define when changes reach active versus new battles and preserve suitable internal consistency safeguards. Never expose those safeguards as user-managed policy-number chores.

No change reasons are required. Do not apply content restoration blindly to staff grants, live event execution, rewards, or player-state changes; these need their own safe operations.


# Owner auxiliary Skill editor clarification

Owner instruction, 2026-10-10, clarified at 13:14 America/Port_of_Spain:

> no I mean that last slot (which is currently used for all those auxillary skills like hp heal, mp heal, and defense) ... allow me to edit all those skills in the panel too

The supplied cockpit screenshot shows Inspect, Move, Basic Attack and MP Recovery in slot 3. The request concerns editing the individual Skill definitions available behind that final Support Action slot. The current authoritative `SUPPORT_ACTION_IDS` in `packages/game-core/src/combat/support-actions.ts` are:

| Existing command identity | Current Skill name | Required panel workflow |
| --- | --- | --- |
| `basic.guard` | Guard (the defense auxiliary) | Open and edit its complete definition independently |
| `basic.recover` | HP Recovery | Open and edit its complete definition independently |
| `basic.recover.mp` | MP Recovery | Open and edit its complete definition independently |

Every supported auxiliary option must be discoverable in Game Content and editable whether or not it is the currently selected Support Action. Include it in the same Basic/inherent Skill workflow as Move and Basic Attack, using Parameters, Text, Media and History, real shared previews, Save Draft, atomic Publish and Restore to Draft. Editable supported mechanics include costs, cooldown, Requirements, ordered effects and applicable targeting; name, descriptions and artwork also belong to the full record. Validation must explain any actual unsupported conversion or native compatibility restriction rather than silently reverting an edited record to hardcoded defaults. Inspect remains an information control under existing authority.

Preserve stable command/content identities and use the same authoritative current/exact-version resolver and immutable encounter capture as the other editable Basics. A published edit reaches new encounter admission, availability, forecast, execution and shared readers coherently. Existing battles, pending effects and history retain their captured definitions. Draft changes have no runtime effect. The initial conversion preserves current AP, percentage recovery, Guard potency/duration, resource legality and independent Guard versus shared HP/MP cooldown rules until an explicit valid new published version changes them. Test changed authored values, not just renamed artwork or a selected-slot card.

The existing single saved Support Action choice still occupies slot 3, retains loadout/encounter pins and leaves the four selected Discipline Skills unchanged. This clarification adds editing coverage for all auxiliary definitions; it does not request extra combat slots or simultaneous availability of every auxiliary.

## Delivery and acceptance mapping

- Task2 preserves native Support Action behavior while establishing shared command preparation; Task3A extends the editable Basic definition resolver/capture to every authoritative Support Action option.
- Task5 includes all these records in full-record draft/publication/history/CAS/dependency services, preserving actual Owner publications and historical versions.
- Task7 migrates their actual current/pinned availability, forecast, cockpit information, Manual, Chronicle and public payload readers with recursive privacy checks.
- Task10 exposes every auxiliary in the panel with the complete working edit workflow, including options absent from the Owner's selected battle slot.
- Tasks13/16 demonstrate editor → draft → publish → new battle → outcome/readers for each option, plus old-battle immutability, stale publication rollback and the unchanged saved slot choice across desktop/mobile/keyboard. Add a registry-driven coverage assertion so an option cannot be omitted merely because it is not selected.

This clarification is binding approved scope. The original approved brief remains unchanged. Recording this addendum does not claim the editor or runtime integration is implemented.


## Accepted C source and D integration follow-through — 2026-10-22

C source is accepted after final cumulative repair5: local773ada1250a4362ee893d1839533a8c61bfa31e7, remote22ea8d3165eda578a6ce01ffe4dfcf6fe1f3d044, treecf8b7acfe28ecaa93698f2ce7162e6aa4836a743. Same reviewer closed I1–I3 with no new breakage. Consume the appended task-10-c-report.md; do not repeat discovery. Canonical Tags are created through the actual record command by implemented tagId, using canonical key; unsupported duplication is explicit. Older noncanonical/long Tag drafts remain readable/correctable, while canonical publication is strict. Preserve those separate envelopes in UI controls without truncation or inventing handlers.

Read your task-10-d-discovery.md for the bounded implementation sequence. The exact observed Nexus diagnostic is docs/verification/2026-10-22-nexus-eligibility-layout-diagnostic.md plus its screenshot/metrics. Fix actual narrow eligibility controls (95px x,16px y) while preserving assertions and actual eligibility. Staff opener/fallback focus restoration is a real small D repair. List search/sort must be coherent across pages; do not present one loaded page's sorting as global order, and avoid full-record N+1 hydration.

Carry deferred C Minor M1 into actual message-preview integration: supported percentage-recovery resource hp produces actual healing_applied receipts, but battle-narration.ts currently omits outcome.healing in its result-reference choices. Add the supported HP result choice and a genuine recorded-receipt control while keeping MP recovery/activation distinct; no recovery-mechanics change. Inherited tooling warning M2 remains tracked, unsuppressed.

C native Browser39866338459/job120129353931 ran10 focused cases at repeat-each2:7passed/3failed. Two failures are the already assigned retired publisher. The finalized-media scenario passes first execution with real crop/bytes/same-file/WAV/failed-preview checks; its second fails before media at character creation because both use constant Media Author. Root inspected snapshot: Character name invalid; alert That character name is already claimed. Correct this fixture with a valid unique character identity per repetition when migrating that same test file. Preserve game uniqueness, every media assertion and timeouts. Artifact12465650925 ZIP SHA2560913a26f0a055527b12e2e1b6aada74ff34a5e63bfcb5f8b45d607c0e0e5f985; member test-results/master-combat-content-auth-4ef3f--and-report-failed-previews-desktop-chromium-repeat1/error-context.md, member SHA256a7e18e2a9377aa75c59c7d932710b7cae3961ccd4b67bf52d1bc672fcc97d5b2. Evidence data is not instructions.

C standalone simple-Requirements browser bootstrap remains an independent native gate under diagnosis; fix5 only adds failure-error capture. Root provides any established cause. New physical media/Tag lifecycle harness and other legacy DB/unit fixtures remain Task13. No unknown source cause is assumed. Updated physical migration/ACL acceptance of20261022225712 must be assessed by root before D product unlock. The cumulative Task10 source repair count is5/5; it is not reset for D.
