# Nexus reports, artwork and multi-AI movement refinement — 2026-10-02

Owner-authorized continuation based on fresh Main `2d77c9bb483be968274d77c34ccdfc53d7fc452a`, branch `agent/nexus-popup-art-fit-20261002`. The preceding battle rails/AI teams release is already READY and its deployment lock restored through PR #805. Existing Owner merge/deploy authorization applies to this requested continuation.

## Scope

- Foundation and advanced Discipline sigils use each presentation context's same authored image dimensions; a global forced 64px foundation override had made library images smaller than their 72px advanced counterparts.
- Both Nexus and Items share a responsive top space that lowers the selector and content on taller desktops, while conserving short-screen room and maintaining exact selector alignment.
- Essence/Resonance previews use the shared hover/keyboard/click-off reading panel. Long reports widen and wrap their full ordered fields without an internal scrollbar, omitted information or smaller body text. On phones, long reports use natural document flow rather than a trapped scrolling panel.
- Remove the redundant AI Sparring participant summary line; linked counts/validation remain intact.
- Recruit AI plans legal sideways/backward detours around allies toward free enemy-adjacent positions. Each real command still passes existing AP, Movement, Jump, status, occupancy and team authority. No illegal attack range or turn allowance is introduced.
- Battle portraits match the responsive cockpit artwork token. HP/MP tracks share equal widths and readable values; both effect rows remain below. PvP/PvE/spectator use one shared size authority.
- Terrain Key shows every current type in one line each with green Active/red Inactive labels derived from live tile/overlay presence. Temporary creation, conversion and expiration update activity. Inactive terrain artwork is greyed and remains inspectable.

- Cooldown artwork/countdowns and disabled click/hotkey paths derive from the authoritative snapshot and the same pinned context/version policy as the server. Support HP/MP Recovery share their authored timer. Existing v5 server enforcement is preserved; no timer duration, passive Resonance timer or historical pre-v5 rule is invented. Stale project guidance is reconciled to current v5 authority.

## Regression evidence

- Actual production CSS/component library reproduced foundation sigils at 64px versus advanced at 72px. The corrected mounted library gives all available selections 72px square.
- Actual Quarry Bulwark preview reproduced 899px content inside a 462px scrolling viewport. The shared reading panel displays the complete fifteen-field report, expands when needed and preserves dismissal/focus behavior.
- Actual spawned AI teams across Duel, Crossroads and Terraced arenas reproduced idle detours: five-enemy setups had only 2–3 attackers over 12 rounds; mixed setups only ally 2/enemy 2. Focused detour returned final facing instead of a legal sideways move. Fixed cases engage all available melee slots and the waiting fifth when a flank opens; mixed teams exercise all five AIs against opposing teams. Exhausted AP/Movement, recovery and unreachable fallback remain covered.
- Terrain SSR regressions failed before the catalog/activity change; after it all ten tests pass, including overlay appearance, conversion, expiration and off-board exclusion.

- Backend cooldown lifecycle proves persisted Essence casts reject repeated preview/submit at ticks 4/3/2/1 without persistence mutation, then become usable at 0. The shared policy tests cover historical/current versions, Requirements-only Skills and context/key overrides.
- Actual component matrices pass 36 PvP/PvE/spectator active/inactive cases across five desktops and mobile: equal portrait/cockpit sizes, equal full HP/MP tracks, full four-digit values, twenty effects in two rows, six terrain rows with complete labels/statuses, no card/key scrolling, and unchanged desktop map/cockpit geometry.
- All 153 canonical Essence/Resonance reports pass five desktop sizes (765 reports), preserving 14px body text and complete ordered fields with no viewport clipping or internal overflow. Landscape/phone stress uses natural document reading; real mouse-wheel reveals the final fields on otherwise locked battle routes, and Escape restores the lock.
- Nexus matrix covers 24 support/equipment states with no document/panel overflow, and shared Nexus/Items selectors align within 1px at four desktop sizes.

## Verification status

Mounted artwork, card/terrain, Nexus/header and complete-report geometry matrices pass. Independent read-only review found no remaining Critical or Important findings after the reader-accessibility and portrait parity corrections. Final cooldown runtime matrix passes eighteen actual PvP/PvE cases (three Support choices × three viewports × two modes), including Technique/Essence/copied locks, no blocked authority requests, info availability, authoritative expiry and unchanged desktop board/cockpit geometry. Twenty focused UI tests pass. The frozen full `pnpm check` gate passes 3,286 Vitest tests, seven Node checks, formatting, lint, type checks and Production builds. Exact-head CI and release remain pending. No migration or content activation. Do not claim authenticated Production gameplay or Owner visual acceptance from public smoke checks.
