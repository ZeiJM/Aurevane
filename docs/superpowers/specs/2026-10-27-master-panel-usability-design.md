# Master Panel usability and ability authoring design

Status: design direction selected by Nick; implementation in progress on the usability branch. Local evidence and pending verification are recorded in docs/verification/2026-10-27-master-panel-usability.md. Nothing from this batch is deployed.

Date: October 27, 2026, America/Port_of_Spain.

Source baseline: main aa46bcd04af053299dea582a6edfa0c37578b297. This is a new batch after the October 27 live release, not evidence that these changes are implemented or deployed.

## Intent and decisions

Make Master Panel a compact, inviting working tool. Reduce the decisions, reading, scrolling and navigation needed to create content or operate the game. Remove duplicate editing paths and dead controls, while keeping real engine capabilities understandable and server-authoritative.

Nick delegated routine design choices and explicitly accepted one shared aim per cast. Effects may have different recipients, such as damaging the selected enemy and healing the caster. Do not add separate enemy/ally selection stages to the casting interaction.

Approaches considered:

1. Patch each existing editor separately. Smaller initial changes, but leaves inconsistent controls, missing tags and duplicate maintenance. Rejected because it fails the decluttering goal.
2. Consolidate existing ability authoring and presentation, then apply common workspace patterns across operations. Selected: reuse the current engine and services, change mechanics only where this request requires it, and verify in coherent stages.
3. Replace the combat engine or entire administration application. Rejected: broad unrelated churn, historical compatibility risk, and unnecessary cost.

Execution is native in this session unless Nick requests delegation. No repeated background checks, duplicate CI launches or new scheduled tasks. Nick subsequently authorized implementation and continued work. The planning documents alone do not authorize a hosted release; current publication and deployment restrictions remain separate.

## Evidence from current source

- SkillMechanics selects either AbilityDefinitionEditor or the older SkillTargetingEditor/SkillEconomyEditor/SkillEffectListEditor path. Resonances have a further retained mechanics path. The shared UI must cover both actual stored forms without rewriting them on open.
- AbilityBehavior already supports AP, MP and HP costs. The HP payment path leaves at least one HP. The older economy editor exposes AP/MP only.
- Native effect recipients already distinguish actor, primary selected unit, affected units and specialized tile recipients. They do not by themselves make independently selectable ally/enemy targets for every effect.
- COMBAT_TAG_REGISTRY registers executable payload families; statuses and variants such as Copy Buffs/Copy Debuffs share lower-level operations. A complete authoring picker must enumerate actual gameplay variants, not merely dump payload family IDs.
- Pierce has a canonical tag and a specialized resolver. Its native adapter marks Barrier shattering; equipment Armor handling is a separate boundary. Vengeance is a typed damage profile with conversion and bounds. Preserve their actual resolver contracts while making each a distinct authoring choice.
- Contextual public/compact/activation/result wording has live consumers in Skill details, parameter views, Chronicle and server battle projections. It is not all dead data.
- Forced weather duration already accepts custom minutes server-side. The UI disables its input when no new forced weather is selected; 60 is an initial value, not a server-fixed duration.
- Navigation and accessible-page order currently come from different arrays. One metadata/order source can eliminate this drift.
- Usage reporting currently supplies current adoption, equipped Skills, actual weekly use, current-week PvP/AI outcomes, pairs and matchups. It does not expose a multiweek trend series or reliable legacy battle history.

## Shared workspace and visual rules

- Keep Aurevane's parchment, forest-green and restrained metallic identity. Replace low-contrast yellow-on-parchment tags with theme-specific readable colors. Ordinary small text meets 4.5:1 contrast; control boundaries and focus cues meet 3:1 where applicable.
- Use aligned grid tracks, consistent input heights, concise labels, modest spacing and fewer nested fieldsets. A helper paragraph must not misalign the neighboring input.
- Preserve native keyboard operation, visible focus, labelled tabs and accessible error messages. Tag color supplements readable text.
- Remove the floating Current badge from the editor header. Place meaningful saving/unsaved/error feedback beside Commit Now; title and Actions retain a stable compact alignment.
- Keep one principal body scroller in an editor. Header/subtabs and a compact save footer remain reachable. Avoid nested modal stacks and competing long scroll areas.
- Desktop uses a compact directory/detail workspace; narrow screens use a directory-to-editor flow. Subtabs can scroll horizontally. Forms stack in the same reading order. Touch actions have comfortable targets, normally at least 44 CSS pixels.
- Draft changes survive subtab changes, opening a related record and returning. Validation identifies the field and subtab and can take the user there. Saving, success, conflict and failure are visibly distinct. A failed save must retain the draft.
- One Commit Now action publishes the intended coherent draft through existing atomic/CAS authority. No silent save, duplicate request or loss of a sibling editor's changes.
- No editable raw JSON, schema version, policy ID or technical provenance field belongs in the ordinary authoring flow. Necessary retained historical information stays readable through compatibility code rather than a second everyday form.

## Ability editor information architecture

All Discipline Skills, Essences and Resonances use this subtab sequence:

| Tab            | Content                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Details & Text | Name, enabled state, meaningful identity, description, flavor and battle wording; contextual requirements/activation where applicable |
| Media          | One current artwork preview, Upload custom image, Restore default; separate compact sound controls and playback                       |
| Range & Area   | Minimum/maximum target range, Single/Circle/Line and dimensions, Targetable Elevation, line of sight, applicable Ground delivery      |
| Action Economy | AP and optional MP/HP costs, cooldown, applicable activation controls                                                                 |
| Accuracy       | Always Hit or Accuracy Roll; no per-Skill accuracy modifier                                                                           |
| Effects        | Ordered compact effect rows, each with its target and tag-specific parameters                                                         |

Keep the order stable across ability types. Inapplicable tabs can show a short meaningful state or be omitted consistently; do not display irrelevant editable controls. Requirements and automatic triggers remain accessible and cannot be lost while splitting the current large form. Passive Resonances retain passive setup/trigger semantics, not an invented manual cast or resource charge. Essence inherits its parent Discipline; omit Source Discipline in that context. Preserve ownership metadata internally.

Description and Flavor Line each say exactly where they appear, based on traced consumers. Merge duplicate writing controls into a primary Description, Flavor Line and Battle Message workflow with one shared token insertion helper and preview. If an existing full/compact/result override contains distinct live text, expose it under optional Wording Overrides with its actual destination. Do not erase it on open or mislabel it unused. Result wording requires a recorded result and must not fabricate activation outcomes. Use plain-language token choices; put detailed pronoun/sample configuration behind optional preview settings.

## Targeting and effect execution

### Shared aim

One cast has one selection/aim context: a legal unit, tile, direction or no click for self/global actions. Existing geometry, occupancy, range, elevation and line-of-sight checks remain authoritative. Every effect resolves from that shared context; there is no separate selection prompt for each effect.

The editor's Target choices are Self, Ally, Enemy, Anyone, All, Ground, Empty Tile, in that order, restricted by the actual tag. Target Kind is renamed Target. All is not offered under Shape. Its existing arena-wide intent must not silently become a small radius: when an effect targets All, communicate its scope explicitly, and show range/LoS as inapplicable to that effect. Other effects in the same ability retain their applicable spatial rules.

Self resolves to the caster. Ally/Enemy/Anyone use the selected unit or eligible units in the shared footprint; explain this briefly for area shapes. All resolves arena-wide legal recipients. Ground/Empty Tile resolve the shared tile/footprint with the appropriate occupancy rules. A tag such as Move or Rewind can restrict targets to Self; Summon can require Empty Tile. Unsupported combinations remain visible with a concise reason in the picker rather than disappearing without explanation.

Start with existing native recipient roles. Where mixed per-effect team/scope filtering requires an extension, add the smallest versioned recipient policy at the canonical effect boundary and reuse it in legality, forecast, execution and AI. Do not invent a separate UI-only targeting truth or silently reinterpret old captures. Existing definitions without the extension retain their recorded targeting.

Remove Team Policy from the UI. Reuse the existing Friendly Fire control as On/Off, in the position previously occupied by Team Policy. It applies to applicable hostile area/all targeting; it must not suppress intended ally healing or explicit Self effects. The effective recipient filters and friendly-fire interaction must agree in selection highlights, forecasts, committed outcomes and information readers.

### Range & Area layout

After Target moves to Effects, arrange the remaining fields with stable tracks: minimum range beside maximum range; Shape beside Targetable Elevation; shape dimensions beside relevant area options; line of sight below. Friendly Fire can occupy the available top-level targeting-policy position where a shared area policy applies. Avoid duplicating it per effect unless effects genuinely need independent policies. All/self-only selections disable or omit only truly inapplicable spatial inputs. Line Length or Circle Radius appears without shifting unrelated inputs out of alignment.

### Tags and parameters

- Build one complete authoring-tag mapping from the existing executable registry, supported statuses and implemented variants. Every entry maps to a real handler, allowed targets, required parameters, timing and limitations. Retired, requirement-only or unimplemented concepts are identified honestly rather than offered as executable effects.
- Separate Copy Buffs/Copy Debuffs, Cleanse/Dispel/Conditional Cleanse, HP/MP recovery, Push/Pull and other genuine gameplay tags. Do not label internal families such as percentage-recovery as the main user-facing choice.
- Pierce is a distinct choice: Barrier removal precedes damage. Preserve existing equipment-Armor semantics where applicable; do not change Defense or add an unrequested bypass. Verify the actual specialized and native routes.
- Vengeance is a distinct choice using the established damage-history conversion, optional minimum and required maximum. Display conversion as a percentage, keep its bounded ordinary damage pipeline, and prevent conflicting offensive scaling.
- Remove Piercing, Vengeance conversion, Offensive-stat scaling and Facing modifiers checkboxes from generic Damage. Relevant mechanic parameters belong to the matching tag/profile or established global calculation, including Blindside's side/rear settings. Removing a checkbox must not leave an invisible active modifier.
- Remove per-Skill Accuracy Modifier authoring and neutralize it for newly published current definitions. Existing captured battles retain their recorded rules. Accuracy statuses and approved global accuracy rules remain separate live mechanics.
- Action Economy keeps AP explicit and supports optional resource rows for MP and HP. Allow both where valid; a single MP-or-HP selector must not discard a combined cost. Do not offer percentage/formula costs the engine cannot execute. Preserve atomic payment, insufficient-resource rejection and HP nonlethality.
- Each effect exposes appropriate target, power/percentage, duration, applications and other required parameters with readable units and validated bounds. Zero, Instant, None and N/A retain distinct meanings.
- Effects stay ordered at execution. Stable row identities preserve the correct settings through add, remove, expand and reorder. A collapsed row shows tag, target, magnitude and duration; an expanded row shows a compact grid. Reordering works with buttons/keyboard on mobile as well as any optional drag affordance.

## Shared tag wording and readers

Combat Rules gets Edit Description beside each gameplay tag, with Full description and Short battle description. Reuse existing tag presentation/content authority and extend it for real variants as necessary; do not create a competing registry of mechanics. Supported value placeholders are inserted through simple controls and rendered from the actual effect/captured outcome. Preview both contexts.

Full wording appears with tag explanations in Skill Manager/full ability details. Short wording serves hover/tap help in character status panels, battle logs and related battle displays. Description-only edits do not change mechanics. Current readers use current published wording; pinned battles use the compatible captured wording/mechanics rather than today's mutable text.

Remove per-effect Player-facing effect description authoring from the ability editor. Resolve current generated wording from the central tag description and actual parameters; preserve historical recorded descriptions needed by saved readers. Dispel's concise label is just Dispel plus target/timing, with removable statuses explained below rather than crammed into its name.

Remove the separate Target row from current full ability readers once every effect has an explicit target bracket. Give target brackets a readable orange distinct from timing/magnitude. Apply across Skill Manager, Essence/Resonance readers, Master previews, battle details and logs as applicable. Revise SKILL_INFORMATION_CONTRACT and its consumers together so the old ten-field rule does not restore the removed row. Basic-action and historical displays must remain complete and truthful.

Combat Rules Used by/current definitions entries are readable names and direct editor links. Open the correct content and relevant Effects tab without stacking dialogs. Preserve unsaved Combat Rules/content drafts and return context, enforce destination access, and support a stable deep link.

## Discipline workspace and lifecycle

- Tabs: Discipline Details, Artwork, Skills, Resonances, Usage & Balance. Name/description remain with Details. No History/rollback or redundant Text/Identity & Relations tab returns.
- Artwork is image-only. Match the corresponding in-game presentation size after measuring the actual consumer; do not resize merely because the screenshot feels large. Use one preview.
- Restore default means the artwork already assigned to that item at this batch's baseline, retained independently of subsequent uploads. Capture per-item references before changing current media. Never let a new custom image redefine its default. New content without baseline artwork has an explicit no-default state. Existing approved upload/finalization rules remain.
- Each Discipline has at most eight linked Skills. Its Skills tab shows a count such as 0/8 and a New Skill action, including for newly created Disciplines. Create-and-link is atomic and the server enforces the same maximum under concurrent requests. New Skill offers Start blank or Use existing Skill as template: the latter copies editable content into an independent draft with new identity and the selected parent Discipline, without changing or linking the original. Do not copy publication/version/audit identity or stale ownership. The limit excludes the separate Essence/Resonance relationship powers.
- Remove Duplicate and Archive options from current Actions menus. Templates are offered inside the New Skill workflow, not as a generic duplicate action. Keep the explicit Delete Discipline operation and internal lifecycle integrity; removing Archive from the UI does not authorize purging captured data.
- Skill rows show readable names and open the shared editor. Remove generic Find/Add-existing controls and mastery-field dumps superseded by the row workflow; keep necessary mastery settings with the Skill where relevant.
- Relationship rows show None (Essence) followed by other Discipline names, without repeating Relationship with. Edit opens the assigned power. Clear relationship removes only the association and its selected override if applicable, not a shared power record. An empty row's Edit can create/configure a valid power, so removing Change power never makes it unusable.
- Preserve the existing on/off relationship override: one selected relationship may supply the power across this Discipline's relationships. Show which relationship supplies it and the resulting effective power, including an unset state. Turning it off restores the independent assignments.
- Add Delete Discipline for saved content and Discard for an unsaved new draft. Show the authoritative impact first, including its owned Skills, Essence and pair powers. Remove deleted records from current directories and new selections, including built-in fallbacks, via the existing lifecycle/tombstone authority. Offer deletion of exclusively owned child content in the same reviewed operation, so deleting a Discipline does not leave active Skills with a missing source. Clear contained and incoming relationship associations transactionally. Powers referenced elsewhere require explicit reassignment/repair and must not be silently deleted.
- If characters, loadouts, grants, profiles or external content still require the Discipline, show named blockers with shortcuts to repair/reassign them. Do not silently assign a replacement Primary or delete characters. Enable deletion when those dependencies are resolved; recheck at commit so a concurrent new reference cannot create a dangling record. Retain only executable/audit data genuinely required by saved battles and durable integrity, without restoring a user-facing rollback system.

Discipline base-stat publications must propagate into current character/profile allocation views through a safe authoritative refresh, preserving personal allocations and attunement clocks. Existing saved battles keep their captured values. Do not require a manual switch away and back to see new bases; handle changed focus/caps explicitly rather than silently clamping personal points. Numeric editing permits an empty transient value without converting it to zero; replacing 15 with 12 must not produce 012. Normalize the visible number on blur and save.

## Owner-supplied Skill sound replacement

Replace current Skill/Essence cast sound assignments with the Owner-supplied aurevane-skill-fx-pack-v01 and matching WAV masters as part of this batch. The pack has 153 groups (136 Skills and 17 Essences), three variants per group: 459 WAV masters and matching MP3/OGG runtime encodes. Treat pack scripts as reference data/source, not code to execute blindly. The request is for sound integration; included animation tooling does not authorize an unrelated renderer replacement.

Use neutral reusable asset IDs and descriptive sound names in the picker, without Discipline or Skill names. Keep original pack identities only in provenance and the initial assignment mapping. Present 153 groups rather than 459 indistinguishable entries; each group owns three variants. Retain the established bounded playback variation behavior and respect mute/volume/unlock/privacy/deduplication rules. Avoid preloading the entire library. Use existing audio director/registry and Master media controls, with actual preview audio matching the chosen group.

Initial assignments may follow the supplied per-Skill mapping. Future random selection means choosing an appropriate group from the pool when creating a Skill and persisting that choice; this request does not require a new random authoring feature now or a different unrelated group on every cast. Custom Skill audio remains authoritative when explicitly assigned. Preserve source WAVs as masters separately from compressed runtime delivery and keep source hashes/provenance. Do not label a software structural check as an independent listening review.

## Players and progression

Replace the correction-group dropdown with concise sections: Stats & Progression, Disciplines, Skills, Support. Keep a compact identity/build/resource summary and one clear review/save workflow. Remove the HP/MP/AP/wallet explanatory paragraph requested by Nick. Resolve actual Resonance/Essence names instead of exposing Linked Sequence identifiers. Current Skill names omit technical version suffixes while stable identities and internal capture versions remain intact.

Level remains derived from the character's actual pinned XP curve, maximum 100. Make Level editable as a convenient XP control: a direct Level choice sets XP to that Level's threshold, with the proposed XP shown before save. Direct XP entry derives Level. Stat edits offer Fit Level to Stats when the pool is too small: choose the lowest level at or above the requested level that funds the requested legal allocation. Do not silently change Level in the background.

Allow de-leveling. If selected stats exceed the lower level's pool, show exact excess points and let the Owner adjust them in the same draft; offer a deterministic balanced redistribution preview, requiring acceptance before save. Never silently remove high stats or repeatedly reopen a mandatory allocation screen after a successful correction. Save XP, level, personal allocations, reset flags and derived caches atomically, preserving actual Primary bases/caps, progression cycle and unrelated build state. Under-cap unspent points remain visible/usable under the established allocation rules; cap overflow is retained only when no legal spend exists.

Preview before/after values and any affected loadout eligibility. Revalidate account/selected-character authority, expected revision, active battle and deletion state at commit. Fix related persisted allocation records, not just displayed totals. Do not award level-up rewards a second time when an administrative correction changes XP.

## Operations and navigation

- Use one ordered page registry for top navigation and Accessible pages; Staff & Access stays Owner-protected. Default order follows the current visible navigation.
- Gear beside Activity Log opens a compact reorder dialog with Move Up/Down, reset and Save. Decision: order is a shared Master Panel setting, editable by the Owner, so access lists and all staff navigation agree. Permission filtering does not change relative order or grant access. New/unknown IDs normalize safely.
- Revoked staff immediately disappear from the active list and stay absent after refresh. Retain the audit record and actual server-side revocation.
- Forced weather duration is editable even before selecting a weather override. Save continues to distinguish keep current, force, and clear; entering a duration alone does not force weather. Show expiry for an active override and use the chosen duration for a new forced selection.
- Moderation uses a compact search and Active Bans list, with player identity, reason, issuer, countdown/expiry or Permanent. Expired/lifted entries leave this list. Avoid duplicate rows for multiple characters on one banned account; show associated characters in details.
- Each active row has a direct Lift Ban button. One click submits the authorized revoke operation, with server revision checks, pending protection and an audit fact; no prior selection, typed reason or extra confirmation is required solely to lift. Server-generated audit wording records this deliberate action without weakening authorization.
- A banned verified player sees a deliberate Ban screen with reason, expiry/countdown or Permanent, at login/return and when the active session encounters a ban denial. The countdown reaching zero does not locally authorize gameplay; recheck server status. Ban removal and expiry allow reentry after verification. Never fall through to a generic server-error screen.

## Usage & Balance

Use a chart-first dashboard with compact KPI counts and explanatory tooltips:

1. Primary/Secondary adoption and distinct-player/character counts with explicit denominators.
2. Skill equipped counts and actual uses/battles-used, sortable to expose underuse.
3. Separate PvP and AI win/loss/draw bars with sample size, plus weekly trend only when real weekly buckets are available.
4. Pair adoption and opponent matchup win rates with sample counts; filter by source where supported.

Do not confuse current roster snapshots with historical usage, equipped with cast, zero with unavailable, or one battle with two participant appearances. Preserve tester/preview/unfinished-battle exclusions. Small/partial samples get a concise visible indicator, not paragraphs. Add a week selector/real bucket query to support comparisons from collection start; no fabricated legacy backfill. Optional extra balance metrics require actual receipts before appearing. Provide text/table access to chart values and mobile layouts.

## Verification, execution and release

Use focused/adjacent checks per task, with native desktop/mobile authoring checks on the actual components and disposable local database. Representative cases include Damage + Self Heal, enemy area plus friendly recovery, global recipients, Ground/Empty Tile, Pierce before damage, bounded Vengeance, HP/MP combined payment, automatic Resonance, restored artwork, draft switching, low/high-level corrections, ban/expiry/lift and deleted Discipline references.

Acceptance means flows are shorter and usable, not merely that components render: no lost edits, hidden active removed modifiers, broken target highlights, misaligned conditional fields, unwanted nested scrolling or missing tags. Check 320/390px mobile, 768px tablet, laptop/desktop and 200% zoom. Verify focus, keyboard reorder, touch help and media loading. Keep immutable-capture parity and negative authorization cases.

This is a broad batch spanning shared UI, combat, auth and persistence. Final quality and configured native workflows must pass once on the final candidate; report workflows separately from individual checks, and completed cases separately from discovery/skips. Preserve source/tree evidence. Do not run a full suite after every small edit or poll continuously.

Production remains unchanged during design/development. Deployment needs the applicable Owner authorization. Follow the documented protected cutover: Git deployments remain locked; allow compatible candidate hosts AND deployment IDs before promoting; stage application/schema/content changes in the reviewed order; preserve old-capture readers and required data. Never apply blanket db push or replay the four already-applied October 27 migrations. Verify actual Vercel production source and READY before claiming live.

## Planning estimate and reasoning setting

Provisional implementation plus verification estimate given to Nick: 8–16 active hours, excluding CI wait and an authorized release. Full tag/recipient migration and lifecycle dependency handling may affect this estimate; revise from measured implementation findings rather than promise a wall-clock completion. Finish this design/plan pass at Extra High, then switch to High for normal implementation. Escalate a concrete unresolved engine invariant only if needed.

## October28 Owner completion directive

Nick explicitly requests the mixed Ground/unit extension and remaining missing authoring support in this same patch, and deletion of the old sound effects. This supersedes the provisional mixed-delivery restriction and retained old-audio fallback. Continue natively under the existing delegated implementation choices; no new planning permission is required.

Selected approach: keep one geometryVersion3 shared aim and classify Ground versus unit delivery per effect. Ground immunity must gate only the Ground packet, including pending applications and continuous areas; unit packets use their own legal recipients and ordinary accuracy/resistance. Accuracy forecasts derive delivery from the effects actually eligible for each recipient, including repeated-tag groups, without consuming forecast RNG. Shared costs/cooldown are still charged once. Omitted target metadata and earlier geometry versions retain their saved delivery rules. Multiple independent casts or rewriting older captures would conflict with the agreed shared aim and compatibility requirements.

Audit every disabled target/tag option and distinguish missing support from real mechanics: occupancy, resource legality, required Summon context and selected-unit-only tags remain explicit. Remove purely artificial restrictions where the engine can be extended consistently, and record any actual unresolved requirement rather than claiming everything is done. Do not guess which earlier limitation Nick meant without reconciling the full request/evidence matrix.

Only the supplied sound pool remains in game sound-effect delivery. Delete old SFX files, registry entries, family routing and build-time regeneration. Map shared healing/cleanse/attrition/Resonance cues to appropriate fixed groups in the supplied pool, preserving variant rotation and explicit custom audio precedence. Music/ambience are separate existing systems. Keep audit/provenance facts, not obsolete playable audio. The not-yet-created PR must include these changes; publication approval for ZeiJM/Aurevane remains valid.
