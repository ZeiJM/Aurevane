# Task10 Stage C — contextual references and finalized immutable content media

Requirements derive from the approved Task10 and Owner brief below. This is substantive implementation after the accepted A/B handoffs, before StageD operator shell/workflow completion. No new balance, roster publication, map implementation, or hosted action. One sole implementer; no helper/reviewer agents. Root owns source publication, native gating and hosted operations. Read the existing Task10 brief for global constraints and StageB producer contract/report for concrete interfaces only; do not reread the whole plan/history.

Required Stage C result:
- Extend actual game-core/combat/battle-narration.ts authority with typed contextual Insert Reference choices for User, Selected Target, Affected Targets, Ability, triggering actor, configured public values and actual outcomes only where available. Handle singular/plural and malformed/context-invalid references. Use local guidance/examples; no special syntax memorization. Text remains presentation and never controls mechanics or claims arbitrary-English verification.
- Tag presentation metadata stays attached to the existing canonical mechanics/Tag registry; no competing execution registry or interpolation authority. Integrate supported public/compact/activation/result fields and actual current/exact-pinned readers. No private Accuracy reference or derived disclosure.
- Actual PC image/audio upload, server finalization and checksum/type/size/ownership/crop authority, immutable finalized references, replacement/removal, relevant existing assets, real crop/sound preview, understandable formats/limits/failures. Registered hook choices remain truthful. URL/label/ticket/preview alone is not finalization. Unsupported container audio or invented media behavior remains specifically unavailable.
- Retain assets needed by current, all deeper physical historical versions and active captures; test real finalized references through save/publication/exact reader rather than disconnected upload route only. Preserve old asset hooks and stored envelopes. Exact finalization security/ACL is required at actual boundaries; no browser/service-role shortcut.
- Recursive public projection must strip private hit-authoring fields from any new nested presentation/media/Tag/current/pinned envelope while preserving public combat stats. Reuse shared public-combat-presentation boundary.
- StageD owns final full shell/category/Parameters/Text/Media/History integration; deliver coherent applicable editor controls and actual contracts now, not a mock or disconnected service. Every independent auxiliary Skill must remain supported by the new media/reference authority.

Concrete anchors to inspect: components/master/combat-content/skill-media-editor.tsx, battle-flavor-template-help.tsx; media/skill-media-hooks.ts; server/master/combat-content-authoring-validation.ts; game-core/combat/battle-narration.ts and public-combat-presentation.ts. Preserve existing narration and real registered hooks rather than reimplementing unrelated mechanics.

Verification: RED/GREEN focused tests of actual reference parsing/rendering/context failures and real upload/finalize/crop/audio/history/ACL transport. Frozen dependency pin via corepack pnpm. Use meaningful covering checks, affected lint/types/format; do not run whole pnpm check before Task13. No timeout relaxation or assertion suppression. Native physical/browser checks are separate from discovery/typecheck. Root will run hosted/native after source gate; implementer may prepare actual native checks but cannot claim execution without observed results.

Preserve docs/verification/task-10-reconstruction/verification.jsonl byte prefix and append real commands/exits/SHA256 of immutable raw logs. Earlier truncation incidents are retained; avoid rewriting old logs. Make early coherent local commits for durability; root backs them remotely. Read current main through root freshness check before committing/reconciling, not an uncontrolled merge. Git deployment lock remains unchanged.

Report at .superpowers/sdd/2026-10-10-unified-engine-recovery/task-10-c-report.md: DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED; commit/tree, complete actual interfaces/migration inventory, implementation/test evidence commands+outputs and exact pending native/browser/hosted limits. Return only status, commit(s), one-line covering tests and concerns. No C completion claim from fixtures alone. Stop product at StageC handoff for one combined review; no StageD/Task11/12 work before root unlocks it.

## Exact Owner clauses

## 3. Modular tags and typed parameters

Create or consolidate one supported tag registry. Each tag should define its stable identity, editable display name, purpose, typed parameters and units, permitted recipients, applicable timing/duration/stacking rules, compatibility constraints, execution handler, and concise/full descriptions. Only expose settings relevant to that tag.

Damage power, percentages, flat resource amounts, tile distances, target counts, stacks, turns, and rounds must remain different value types. Never reuse the 1–20 damage scale for every numeric field. References between content records must use stable identifiers, not matching names or parsing text.

Provide reusable requirement predicates and event requirements rather than a new hardcoded tag for every possible threshold. For example, an HP comparison can configure subject, comparator, value, and percent-versus-flat units. A status check selects an existing status definition.

Provide a **Tag Library** with search, sorting, explanations, valid settings, compatibility guidance, and “Used by” relationships. Editors may configure implemented tags and approved presentation metadata. A genuinely new mechanic needs an implemented, tested handler before it becomes usable. Do not imply that typing a new tag name or description creates working behavior.

Identify missing tags necessary for the requested architecture and propose/implement them through the same supported system. Do not build arbitrary scripting, raw JSON authoring, or a general-purpose visual programming environment as the normal interface.


## 10. Public descriptions, linked terms, and battle popups

Redesign the full skill popup and its bottom descriptors alongside the engine, not after it. Use concise, polished English explaining what happens, to whom, how strongly, for how long, and under what meaningful conditions. Avoid implementation notes, generic filler, repeated rows in prose, and janky generated language.

Provide three related presentations from the same definitions: **full mechanic explanation**, **compact tag explanation**, and **specific ability/live-instance wording**. For example, explain generically that damage uses a relative 1–20 power scale rather than exact HP damage; a particular technique can simply state its actual damage family and power.

Keep full descriptions, compact battle descriptions, and use/result messages distinct. Do not use a static skill explanation as a message falsely claiming that an attack hit. Condition-dependent effects must remain conditional in wording.

Permit compact repeated-value formats such as Burn [20/15/10%] only when they correctly represent its actual progression. Make the percentage basis, tick order, lifetime, and important special behavior discoverable. Do not shorten descriptions by removing meaningful mechanics.

When another supported tag is referenced, style it consistently and let hover, keyboard focus, or touch open its shared compact explanation. Use actual tag references, not naive text replacement. Referencing Steam must not imply every Fire attack unconditionally creates it. Avoid endless nested tooltips and keep touch dismissal usable.

Upgrade public technique cards, cockpit skill information, character-rail skill popups, active-effect popups, and battle messages. A live status popup should show actual supported stacks, current combined magnitude, remaining duration, and relevant readiness—not only a dictionary entry or an ambiguous “2 turns.”

Show category/activation clearly for passive Resonances or future triggered abilities, without forcing them into a castable-skill layout full of N/A rows. Preview illustrative manual, modifier, automatic, ongoing, mixed-recipient, and Controlled examples before accepting the design.


## 13. Text, media, and hidden accuracy editing

Provide **Parameters, Text, Media, and History** sections or an equivalently compact design. The parameter editor must mirror the public presentation rather than exposing unrelated internal terminology.

Text editing must cover public descriptions, compact battle text, and relevant activation/result messages. Provide **Insert Reference** controls for supported subjects and values, such as User, Selected Target, Affected Targets, Ability, triggering actor, configured power, duration, and actual outcomes when available. Include local writing guidance and examples. Handle singular/plural forms and reject broken references. Do not require remembering special syntax.

Bind mechanical values and linked terms to actual definitions wherever possible. Allow appropriate manual wording without letting prose override mechanics. Validation can flag inconsistencies but must not pretend to prove arbitrary freeform English matches gameplay. Sanitize presentation input and distinguish trusted templates from unrestricted content.

Allow image/audio upload from the editor’s computer, replacement/removal, and relevant existing-asset selection. Preview the real crop and sound. State supported formats/limits clearly. Retain media needed by current content, previous snapshots, or active records.

Add internal **Accuracy: Standard / Fixed**. Standard uses ordinary accuracy/evasion rules. Fixed uses an editor-defined 0–100% chance that ordinary accuracy/evasion modifiers cannot alter; Fixed 100% always succeeds at the applicable hit check. It does not bypass costs, requirements, legal targeting, immunity, or damage mitigation.

Do not add a second evasion check that defeats Fixed 100%. Recommended ordinary behavior is one check per affected recipient shared by hit-dependent effects, with explicit multi-hit rules where needed. Separate attack accuracy from an effect’s independent application chance.

Only show Accuracy where a hit check is relevant. **Keep it out of public cards, public previews, descriptions, and public API data—not merely hidden by CSS.**


## 14. Real previews, publishing, versions, and attribution

Render previews with the actual public/battle components: full popup, compact skill information, linked tag explanations, applicable live-effect display, and sample use/result messages. Include media and Controlled indicators where relevant. Support appropriate sample contexts and a Draft/Published comparison without pretending sample text is a full battle simulation.

Editing saves a draft, not an immediate live change. Publish validates the complete record and updates parameters, references, text, hidden settings, and media together. Prevent stale edits from silently overwriting another editor’s published work. Show specific validation failures beside the relevant controls.

Retain **current plus two previous published versions** as the recommended interpretation of the requested two restore points. Draft saves do not consume history. Show who authored the present version and when, and preserve attribution for the previous snapshots. Record the publisher separately where different.

Restore a prior snapshot into a draft, preview it, and publish it as a new current version. Preserve the original snapshot’s author and identify the restoring actor/source. Restore the full configuration, including hidden accuracy and media references. Validate against supported tag definitions; restoring content is not rolling back the entire engine.

Publication must not split an in-flight action or primed snapshot across incompatible definitions. Define when changes reach active versus new battles and preserve suitable internal consistency safeguards. Never expose those safeguards as user-managed policy-number chores.

No change reasons are required. Do not apply content restoration blindly to staff grants, live event execution, rewards, or player-state changes; these need their own safe operations.

