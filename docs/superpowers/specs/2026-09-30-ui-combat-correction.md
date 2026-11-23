# Accepted UI and combat correction

Nick accepted the refined battle concept on 30 September 2026 and explicitly instructed: “Implement everything exactly. Proceed.” This specification records that mandate alongside the visually rejected September 29 redesign. Functional tests are not visual acceptance.

## References and coverage

The supplied AUREVANE-UI-HANDOVER-2026-09-30.zip preserves nineteen original approved concept images. Use each screen's actual composition, artwork, material hierarchy and action placement. The refined battle image `exec-49f88d50-6ac0-4054-8df4-9e5928f8b2c5.png` supersedes the old battle composition. Concept sample names/numbers, scenery and log text do not authorize new mechanics or fabricated live data.

Cover account entry; character selection/creation; Haven; Profile/reset/edit; Loadout/Nexus/Atlas/mastery/details; World; Hall/lobby; combat/spectator/results; Training; Settings/account; public information; and all Master workspaces. Preserve every existing operation, Skill parameter/effect description, permission and legacy record. Items, matchmaking, daily rewards and supernatural paths remain honest future features.

## Shared frame and artwork

Use readable weathered stone/taupe surfaces, slate framing, thin muted bronze details, oxblood actions and restrained teal magic. Fixed header/footer and ordinary-page rail fit desktop 100% zoom. Diagnose and remove oversized structures rather than scaling, clipping controls or making text tiny. Mobile intentionally stacks and scrolls. Large document/library/editor content may use explicit collection/detail or modal reading areas; ordinary page scaffolding must not overflow.

Rail portrait displays approximately 144px square at normal desktop height, with a thin frame and crisp source. Compact navigation/stats preserve viewport fit. Replace bubble/orb animation with slow teal flowing wisps and faint rune lines; obey reduced-motion preference. Rail exceptions remain account/character entry, active combat and spectation.

Discipline, Skill, Resonance/Essence and future Severance/Ascension artwork remains 1:1 and grows beyond the rejected 64px display where viewport permits. Use adequate source resolution and avoid blurry enlargement. Keep all existing explanatory renderers.

## Combat geometry and composition

Standard arenas are 9×7, 12×7 and 15×7. Change width only; seven rows and tile display scale remain consistent across those sizes at a given viewport. Preserve historical snapshots and intentional micro-training scenarios.

The board dominates. Compact local-character card stays left; selected/inspected character card stays right and swaps without duplicating tall rosters. Positive/negative effects expose descriptions through accessible hover/focus/touch controls. Battlefield portraits fill approximately 85% of their tile; identity rings match panel accents and remain separate from target highlighting. Shared PvE/PvP/spectator presentation is mandatory. Fresh terrain art/backgrounds depict existing rules, not new passability or balance.

Automatic forecast sits directly below the battlefield. It displays authoritative cost/resources and every affected target's forecasts, including self/ground/area casts. Battle log sits below the right card with latest committed events and expandable history. Terrain key sits beneath the left card. At narrow widths, preserve reachable controls through an intentional mobile composition.

## Cockpit and interaction

Single cockpit order: Inspect (no number), Move [1], Basic Attack [2], Guard [3], four selected Discipline Skill slots [4,5,6,7], Essence/Resonance [8], future Severance/Ascension placeholder [9], End Turn [Space]. Show empty slots. Tag Skills with their source Discipline. Preserve current Recover functionality through a secondary accessible command rather than silently removing it. Basic Attack remains current; future weapon substitution is out of scope.

Skill artwork includes a separate “i” control opening the existing full parameter/effects renderer. Passive [8] and future [9] expose information without issuing a combat command. Selecting an actionable Skill arms it, selects a deterministic legal preview target and fetches its forecast without committing. A subsequent single target click or deliberate WASD directional targeting input commits that chosen intent; no confirm/double-click requirement. Self-target Skill executes on a subsequent explicit target/execute input, never merely because it was selected. Invalid/stale/blocked previews cannot authorize mutation. Editing input, modal inspection, busy/finished/nonlocal turns and key repeat cannot dispatch commands.

Space first enters facing selection; a second distinct Space ends with the existing facing. Directional facing choice ends with that facing. Use existing server validation, version and idempotency command submission; client previews remain advisory.

## Verification and release

Record actual rendered comparisons at desktop 100% zoom (1366×768, 1440×900 and 1920×1080) and mobile. Test interaction boundaries and full quality gate. Refresh current main before finalization and reconcile overlaps. Push a task branch/open a PR under existing authorization. All Vercel Git deployments remain disabled; a new release requires Nick's instruction.
