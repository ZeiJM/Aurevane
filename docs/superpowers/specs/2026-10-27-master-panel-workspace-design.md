# Master Panel workspace overhaul

Owner-authorized October 27, 2026. Status: implementation in progress, not released.
Base: main d20bb6c079cc6d8210426d0bbcb482aae01eed71 (preserve #983 preview sizing).
Nick supplied the detailed design through screenshots and explicitly requested implementation; proceed without another design approval round.

## Intent
Make every Master page attractive, compact, intuitive and practical on desktop and mobile. All extraordinary staff actions belong in the Master Panel. Preserve server authority, actual character facts, combat captures, current data, and existing artwork. This batch does not implement the unrelated World/P5 backlog.

## Approach
Extend the existing Next/React workspaces, shared engine parsers, private SQL/RPC authority and native modal. A replacement app or independent skill engine would duplicate authority; CSS-only treatment would leave reported functional defects. Use coherent components and scoped styles with a single integrated verification gate. Independent domains may be delegated with exclusive file ownership; root integrates shared contracts.

## Approved requirements
1. Music: recognise source type; YouTube watch URLs must not be silently accepted as playable HTML audio. Provide supported working playback/preview or precise unsupported-source feedback; investigate supported embedded playback rather than extracting media. Compact Global Music so all controls fit the reported desktop viewport; preview/save/game agree.
2. Staff: Owner edits role access to named pages, not a list of granular powers. Page access includes its necessary tools. Preserve single protected Owner and Owner-only role management. Enforce live page permissions in server/RPC and navigation, including Activity Log.
3. Add Moderation page: search players, temporary/permanent bans, duration, reasons, history, edit/extend/lift; canonical authority and audit.
4. Players: details stay in right column through reads/errors. Diagnose legal stat correction rejection. Allocation must block only while points can legally be spent; cap-saturated excess must persist without Profile lock/reopening, including level-up and class swap.
5. One Events navigation item, Definitions & Schedule and Live Operations subtabs; correct selected state/title and permission filtering.
6. Combat Rules: timing list on wide left and compact independent elevation on right. Let list use available height and show many readable rows. Mobile stacks sensibly.
7. Content: fixed left sidebar with category, fully scrollable matching list, search/sort/Commit Now beneath; no State/pagination UI. Right side for editor. Continuous list may fetch bounded pages internally with no manual next/previous controls.
8. Remove misplaced Commit help beside selected name; compact header/status/tabs. No duplicate name fields. Rename Parameters contextually (Discipline Details, Skill Details, etc.) and merge Text into it.
9. Refresh recovery across content: category, record, tab, search/sort, scroll, unsaved edits. Recovery does not commit; avoid duplicate writes and stale overwrite. Scope to authenticated actor/workspace; do not leak drafts across sign-out/account switch.
10. Show actual currently-used discipline image in Artwork, including builtin fallback; replacement preview before commit. Six core attribute columns at desktop; readable responsive stack.
11. Remove all expandable Find helpers while retaining complete selection choices. Remove Find existing Skill/Add Skill helper section and redundant resonance Edit button cloud.
12. Keep existing all-of unlock rules, prevent nested all-of groups in UI without destroying retained data. Grant to player: name search -> stable verified account recipients; chosen discipline available despite ordinary prerequisites. Only authorized staff, auditable, persistent and revocable. Do not forge earned mastery.
13. Investigate atlas progression band/presentation ratings; remove redundant/internal controls after tracing actual consumers; preserve metadata needed by current runtime rather than deleting blindly.
14. Skills subtab: readable named list -> modal full skill editor (mastery, name, tags, image/current and replacement previews, sound preview, battle/Technique descriptions and supported gameplay parameters). No raw-ID-centric form. Modal scrolls, page stationary, close retains edits; authoritative save updates actual skill.
15. Resonances: readable relationship list None (Essence), partner discipline names, Edit per row -> full supported editor. Toggle Use one relationship for all combinations selects relationship and overrides pair/pure selection for this discipline. Off restores original individual mappings. Must implement actual build/battle rules, with deterministic handling of two overriding disciplines and backwards-compatible captures.
16. Remove History tab and rollback; stop retaining data solely for rollback. Runtime-dependent immutable definitions require explicit safe retention/dependency handling, not blind deletion. Weekly Activity Log remains distinct.
17. Replace Identity & Relations with Usage & Balance: current primary/secondary player counts, skill equipped and actual-use counts, weekly completed wins/losses/draws/rates split PvP vs AI, common pairs/matchups and underused skills. Counts/time windows visible; unavailable data marked honestly. Exclude test/unfinished battles and protect identities. Reporting bounded/lightweight, no gameplay hot-path bulk scans.

## Visual direction (implementation judgment)
Retain Aurevane fantasy character with ink/teal/brass accents, warmer layered surfaces, restrained highlights and clear type hierarchy. Compact stable desktop frame, useful column proportions, aligned fields; mobile uses intentional stacked views and usable touch controls. Keep contrast, focus, accessible labels, dialog focus restoration and reduced-motion support. No generic numeric mystery controls, excessive instructional copy or tiny text to force fit.

## Verification and release
Focused reproduction/negative regressions during each domain. Final full pnpm check, DB authority/ACL/concurrency cases, configured exact-head workflows, native desktop/mobile Master flows, app entry and representative battle smoke. No test discovery claimed as executed. Fresh main before finalization. No preview deploys; preserve Git automatic deployment lock. Standing panel release authorization is scoped to this final verified batch; if a new release approval is required, finish the concrete reviewable candidate first. Physical Owner/mobile/multiplayer/load acceptance remains separate from automation.
